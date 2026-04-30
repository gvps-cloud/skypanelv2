/**
 * Cryptographic random number generation utilities for SkyPanelV2
 *
 * This module provides secure random generation functions using Node.js's
 * built-in crypto module. All random values use crypto.randomBytes() which
 * generates cryptographically strong random values suitable for:
 * - API keys
 * - Authentication tokens
 * - Session identifiers
 * - CSRF tokens
 * - Password reset tokens
 *
 * SECURITY NOTE: Never use Math.random() for security-sensitive operations.
 * Always use crypto.randomBytes() for any cryptographic operations.
 */

import crypto from 'crypto';

/**
 * Generate a secure API key with format: sk_live_<64-hex-characters>
 *
 * The API key format:
 * - Prefix: sk_live_ (indicates this is a live secret key)
 * - Suffix: 64 hexadecimal characters (32 bytes = 256 bits of entropy)
 *
 * This provides 256 bits of entropy, which is sufficient for security
 * according to NIST recommendations.
 *
 * @returns A secure API key string
 *
 * @example
 * const apiKey = generateApiKey();
 * // Returns: "sk_live_a1b2c3d4e5f6...7890"
 */
export function generateApiKey(): string {
  const bytes = crypto.randomBytes(32);
  return `sk_live_${bytes.toString('hex')}`;
}

/**
 * Generate a secure random token
 *
 * Creates a hexadecimal string from cryptographically secure random bytes.
 * The length parameter specifies the number of bytes, not the output string length.
 * The output string will be twice the length (2 hex chars per byte).
 *
 * Common uses:
 * - 32 bytes (64 hex chars) - Password reset tokens, session IDs
 * - 16 bytes (32 hex chars) - CSRF tokens
 * - 24 bytes (48 hex chars) - Email verification tokens
 *
 * @param length - Number of random bytes to generate (default: 32)
 * @returns A hexadecimal string representing the random bytes
 *
 * @example
 * const token = generateSecureToken(32);
 * // Returns: "a1b2c3d4e5f6...7890" (64 hex characters)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash an API key for storage
 *
 * API keys should never be stored in plaintext. This function creates a
 * SHA-256 hash of the key for secure storage in the database.
 *
 * The hash is one-way, meaning the original API key cannot be recovered
 * from the hash. When verifying an API key, hash the provided key and
 * compare it with the stored hash.
 *
 * @param key - The API key to hash
 * @returns A hexadecimal string representing the SHA-256 hash
 *
 * @example
 * const apiKey = generateApiKey();
 * const hash = hashApiKey(apiKey);
 * // Store 'hash' in database, never store 'apiKey'
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the prefix from an API key for display purposes
 *
 * Returns the first 12 characters of the key (sk_live_ + first 4 chars)
 * which can be safely displayed in the UI to help users identify their keys.
 *
 * @param key - The full API key
 * @returns A truncated prefix (e.g., "sk_live_a1b2")
 *
 * @example
 * const prefix = extractApiKeyPrefix("sk_live_a1b2c3d4...");
 * // Returns: "sk_live_a1b2"
 */
export function extractApiKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

/**
 * Validate an API key format
 *
 * Checks if the key matches the expected format: sk_live_<64-hex-chars>
 *
 * @param key - The API key to validate
 * @returns True if the key format is valid, false otherwise
 *
 * @example
 * const isValid = validateApiKeyFormat("sk_live_a1b2c3...");
 * // Returns: true or false
 */
export function validateApiKeyFormat(key: string): boolean {
  const apiKeyRegex = /^sk_live_[a-f0-9]{64}$/;
  return apiKeyRegex.test(key);
}

/**
 * Generate a secure random string for user-facing purposes
 *
 * Creates a URL-safe random string suitable for:
 * - Verification codes
 * - Short-lived tokens
 * - Unique identifiers
 *
 * @param length - Desired length of the output string (default: 24)
 * @returns A URL-safe random string
 *
 * @example
 * const code = generateSecureString(16);
 * // Returns: "AbC1dE2fG3hI4jK5"
 */
export function generateSecureString(length: number = 24): string {
  const bytes = crypto.randomBytes(Math.ceil(length / 2));
  return bytes.toString('hex').substring(0, length);
}
