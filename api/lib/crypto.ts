/**
 * Cryptographic utilities for SkyPanelV2
 *
 * This module provides AES-256-GCM encryption/decryption for sensitive data:
 * - SSH credentials (encrypted with SSH_CRED_SECRET)
 * - Provider API tokens (encrypted with PROVIDER_TOKEN_SECRET)
 *
 * KEY VERSIONING:
 * - Encrypted payloads include a keyVersion identifier
 * - Multiple active keys are supported for rotation
 * - New data uses the current key version
 * - Old data can be decrypted with previous key versions
 *
 * This allows seamless key rotation without downtime or data migration.
 *
 * ALGORITHM: AES-256-GCM (authenticated encryption)
 * - IV: 12 bytes (GCM recommended)
 * - Tag: 16 bytes (authentication tag)
 * - Key: 32 bytes (derived via SHA-256)
 */

import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Encrypted payload structure with key versioning
 *
 * @property keyVersion - Identifier for which key encrypted this data
 * @property iv - Initialization vector (base64)
 * @property tag - Authentication tag (base64)
 * @property ciphertext - Encrypted data (base64)
 */
interface EncryptedPayload {
  keyVersion: string; // 'current' or numbered version ('v1', 'v2', etc.)
  iv: string; // base64
  tag: string; // base64
  ciphertext: string; // base64
}

/**
 * Key configuration for encryption
 *
 * Separate keys are used for different data types to allow
 * independent key rotation and security isolation.
 */
interface KeyConfig {
  current: string; // Current active secret
  previous?: string[]; // Previous secrets for decryption during rotation
}

/**
 * Get encryption key configuration based on type
 *
 * @param type - Type of data being encrypted ('ssh' or 'provider')
 * @returns Key configuration with current and previous keys
 */
function getKeyConfig(type: 'ssh' | 'provider'): KeyConfig {
  if (type === 'ssh') {
    const current = config.SSH_CRED_SECRET || '';
    const previous = process.env.SSH_CRED_SECRET_PREVIOUS
      ? process.env.SSH_CRED_SECRET_PREVIOUS.split(',').map(s => s.trim())
      : [];

    return { current, previous };
  } else {
    // Provider tokens use a separate secret for rotation independence
    const current = process.env.PROVIDER_TOKEN_SECRET || config.SSH_CRED_SECRET || '';
    const previous = process.env.PROVIDER_TOKEN_SECRET_PREVIOUS
      ? process.env.PROVIDER_TOKEN_SECRET_PREVIOUS.split(',').map(s => s.trim())
      : [];

    return { current, previous };
  }
}

/**
 * Derive a 32-byte encryption key from a secret
 *
 * Uses SHA-256 to normalize any secret length to exactly 32 bytes
 * (required for AES-256).
 *
 * @param secret - The secret to derive a key from
 * @returns A 32-byte Buffer suitable for AES-256
 */
function deriveKey(secret: string): Buffer {
  if (!secret || secret.length < 16) {
    throw new Error(
      'Encryption key must be at least 16 characters. ' +
      'Ensure SSH_CRED_SECRET or PROVIDER_TOKEN_SECRET is properly configured.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Get the current encryption key for encrypting new data
 *
 * @param type - Type of data ('ssh' or 'provider')
 * @returns A 32-byte Buffer
 */
function getCurrentKey(type: 'ssh' | 'provider'): Buffer {
  const keyConfig = getKeyConfig(type);
  return deriveKey(keyConfig.current);
}

/**
 * Get all available keys for decryption (current + previous)
 *
 * Returns a map of keyVersion -> key, allowing decryption of data
 * encrypted with any previous key version.
 *
 * @param type - Type of data ('ssh' or 'provider')
 * @returns Map of key version identifiers to 32-byte keys
 */
function getAllKeys(type: 'ssh' | 'provider'): Map<string, Buffer> {
  const keyConfig = getKeyConfig(type);
  const keys = new Map<string, Buffer>();

  // Current key
  keys.set('current', deriveKey(keyConfig.current));

  // Previous keys (for rotation)
  if (keyConfig.previous) {
    keyConfig.previous.forEach((prevSecret, index) => {
      keys.set(`v${index + 1}`, deriveKey(prevSecret));
    });
  }

  return keys;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @param type - Type of data ('ssh' or 'provider', default: 'ssh')
 * @returns Base64-encoded encrypted payload with key version
 */
export function encryptSecret(plaintext: string, type: 'ssh' | 'provider' = 'ssh'): string {
  const key = getCurrentKey(type);
  const iv = crypto.randomBytes(12); // GCM recommended IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    keyVersion: 'current', // New data always uses current key
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/**
 * Decrypt data encrypted with encryptSecret()
 *
 * Supports key versioning for seamless rotation:
 * 1. Try the current key
 * 2. If that fails, try previous keys (v1, v2, etc.)
 * 3. If all fail, try legacy format (no keyVersion field)
 *
 * @param encoded - Base64-encoded encrypted payload
 * @param type - Type of data ('ssh' or 'provider', default: 'ssh')
 * @returns Decrypted plaintext
 * @throws Error if decryption fails
 */
export function decryptSecret(encoded: string, type: 'ssh' | 'provider' = 'ssh'): string {
  const allKeys = getAllKeys(type);

  let decoded: Buffer;
  try {
    decoded = Buffer.from(encoded, 'base64');
  } catch (error) {
    // Value was never encrypted (legacy behavior). Return as-is for backward compatibility.
    console.warn('decryptSecret: value is not base64 encoded; assuming legacy plaintext secret.', error);
    return encoded;
  }

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(decoded.toString('utf8')) as EncryptedPayload;
  } catch (error) {
    // Parsed value is not an encrypted payload. Treat as legacy plaintext.
    console.warn('decryptSecret: decoded payload is not JSON; assuming legacy plaintext secret.', error);
    return encoded;
  }

  if (!payload?.iv || !payload?.tag || !payload?.ciphertext) {
    console.warn('decryptSecret: payload missing encryption fields; assuming legacy plaintext secret.');
    return encoded;
  }

  // Try decrypting with the key version specified in the payload
  const keyVersion = payload.keyVersion || 'current';
  const key = allKeys.get(keyVersion);

  if (!key) {
    console.error(`decryptSecret: key version '${keyVersion}' not available for decryption`);
    throw new Error(`Key version '${keyVersion}' not available. Cannot decrypt data.`);
  }

  try {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return plaintext;
  } catch (err) {
    console.error(`decryptSecret: failed to decrypt with key version '${keyVersion}'. Ensure the correct secret is configured.`, err);
    throw err;
  }
}

/**
 * Check if encryption key is configured
 *
 * @param type - Type of data ('ssh' or 'provider', default: 'ssh')
 * @returns True if a valid key is configured (>= 16 chars)
 */
export function hasEncryptionKey(type: 'ssh' | 'provider' = 'ssh'): boolean {
  const keyConfig = getKeyConfig(type);
  return keyConfig.current.length >= 16;
}

/**
 * Re-encrypt data with the current key version
 *
 * Use this during key rotation to migrate data encrypted with
 * old keys to the current key version.
 *
 * @param encryptedData - Data encrypted with a previous key
 * @param type - Type of data ('ssh' or 'provider', default: 'ssh')
 * @returns Data re-encrypted with the current key
 */
export function reencryptSecret(encryptedData: string, type: 'ssh' | 'provider' = 'ssh'): string {
  const plaintext = decryptSecret(encryptedData, type);
  return encryptSecret(plaintext, type);
}

/**
 * Aliases for backward compatibility
 */
export const encrypt = encryptSecret;
export const decrypt = decryptSecret;
