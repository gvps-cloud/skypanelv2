import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { encryptSecret, decryptSecret, hasEncryptionKey, reencryptSecret, encrypt, decrypt } from '../../lib/crypto';

describe('Crypto Library Tests', () => {
  const originalEnv = process.env;

  const MOCK_SSH_SECRET = 'test-ssh-secret-must-be-16-chars';
  const MOCK_PROVIDER_SECRET = 'test-provider-secret-also-16-chars';

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.SSH_CRED_SECRET = MOCK_SSH_SECRET;
    process.env.PROVIDER_TOKEN_SECRET = MOCK_PROVIDER_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('encryptSecret', () => {
    it('should successfully encrypt a string using default type (ssh)', () => {
      const plaintext = 'my-super-secret-password';
      const encrypted = encryptSecret(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);

      // Verify the structure
      const decodedPayload = Buffer.from(encrypted, 'base64').toString('utf8');
      const payload = JSON.parse(decodedPayload);

      expect(payload).toHaveProperty('keyVersion', 'current');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('tag');
      expect(payload).toHaveProperty('ciphertext');
    });

    it('should successfully encrypt a string using type provider', () => {
      const plaintext = 'provider-api-key-123';
      const encrypted = encryptSecret(plaintext, 'provider');

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      const decodedPayload = Buffer.from(encrypted, 'base64').toString('utf8');
      const payload = JSON.parse(decodedPayload);

      expect(payload).toHaveProperty('keyVersion', 'current');
    });

    it('should produce different ciphertext for the same plaintext due to random IV', () => {
      const plaintext = 'same-password';
      const encrypted1 = encryptSecret(plaintext);
      const encrypted2 = encryptSecret(plaintext);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should throw an error if the key is too short', () => {
      process.env.SSH_CRED_SECRET = 'short'; // less than 16 chars
      expect(() => encryptSecret('test')).toThrow('Encryption key must be at least 16 characters.');
    });

    it('should throw an error if the key is missing', () => {
      process.env.SSH_CRED_SECRET = '';
      expect(() => encryptSecret('test')).toThrow('Encryption key must be at least 16 characters.');
    });
  });

  describe('decryptSecret', () => {
    it('should decrypt a valid encrypted payload (ssh)', () => {
      const plaintext = 'test-decryption';
      const encrypted = encryptSecret(plaintext, 'ssh');
      const decrypted = decryptSecret(encrypted, 'ssh');

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt a valid encrypted payload (provider)', () => {
      const plaintext = 'test-provider-decryption';
      const encrypted = encryptSecret(plaintext, 'provider');
      const decrypted = decryptSecret(encrypted, 'provider');

      expect(decrypted).toBe(plaintext);
    });

    it('should handle legacy unencrypted payloads gracefully', () => {
      const legacySecret = 'legacy-plain-text-secret';

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const decrypted = decryptSecret(legacySecret, 'ssh');

      expect(decrypted).toBe(legacySecret);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should handle invalid base64 gracefully', () => {
      const invalidBase64 = 'invalid base 64 string %%!!';

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const decrypted = decryptSecret(invalidBase64, 'ssh');

      expect(decrypted).toBe(invalidBase64);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = Buffer.from('invalid json content').toString('base64');

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const decrypted = decryptSecret(invalidJson, 'ssh');

      expect(decrypted).toBe(invalidJson);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should handle missing payload fields gracefully', () => {
      const missingFields = Buffer.from(JSON.stringify({ keyVersion: 'current' })).toString('base64');

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const decrypted = decryptSecret(missingFields, 'ssh');

      expect(decrypted).toBe(missingFields);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should throw if key version is missing from config', () => {
      const payload = {
        keyVersion: 'v1',
        iv: 'fakeiv',
        tag: 'faketag',
        ciphertext: 'fakecipher'
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => decryptSecret(encoded, 'ssh')).toThrow("Key version 'v1' not available. Cannot decrypt data.");
      spy.mockRestore();
    });

    it('should throw if decryption fails (wrong key/tampered data)', () => {
      const encrypted = encryptSecret('test', 'ssh');
      // Change the secret to simulate wrong key
      process.env.SSH_CRED_SECRET = 'new-secret-must-be-16-chars-long';

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => decryptSecret(encrypted, 'ssh')).toThrow();
      spy.mockRestore();
    });

    it('should successfully decrypt with previous keys during rotation', () => {
      // 1. Encrypt with old key
      const oldSecret = 'old-secret-must-be-16-chars-long';
      process.env.SSH_CRED_SECRET = oldSecret;
      const encryptedWithOldKey = encryptSecret('test-data', 'ssh');

      // 2. Rotate keys
      const newSecret = 'new-secret-must-be-16-chars-long';
      process.env.SSH_CRED_SECRET = newSecret;
      process.env.SSH_CRED_SECRET_PREVIOUS = oldSecret;

      // Manually mock the payload to indicate it was encrypted with 'v1' (previous key)
      const decodedPayload = Buffer.from(encryptedWithOldKey, 'base64').toString('utf8');
      const payload = JSON.parse(decodedPayload);
      payload.keyVersion = 'v1';
      const modifiedEncrypted = Buffer.from(JSON.stringify(payload)).toString('base64');

      // 3. Try decrypting
      const decrypted = decryptSecret(modifiedEncrypted, 'ssh');
      expect(decrypted).toBe('test-data');
    });
  });

  describe('hasEncryptionKey', () => {
    it('should return true if key is valid', () => {
      expect(hasEncryptionKey('ssh')).toBe(true);
    });

    it('should return false if key is missing or too short', () => {
      process.env.SSH_CRED_SECRET = 'short';
      expect(hasEncryptionKey('ssh')).toBe(false);

      process.env.SSH_CRED_SECRET = '';
      expect(hasEncryptionKey('ssh')).toBe(false);
    });
  });

  describe('reencryptSecret', () => {
    it('should decrypt old data and re-encrypt with current key', () => {
      // 1. Encrypt with old key
      const oldSecret = 'old-secret-must-be-16-chars-long';
      process.env.SSH_CRED_SECRET = oldSecret;
      const encryptedWithOldKey = encryptSecret('test-data', 'ssh');

      // 2. Rotate keys
      const newSecret = 'new-secret-must-be-16-chars-long';
      process.env.SSH_CRED_SECRET = newSecret;
      process.env.SSH_CRED_SECRET_PREVIOUS = oldSecret;

      const decodedPayload = Buffer.from(encryptedWithOldKey, 'base64').toString('utf8');
      const payload = JSON.parse(decodedPayload);
      payload.keyVersion = 'v1';
      const modifiedEncrypted = Buffer.from(JSON.stringify(payload)).toString('base64');

      // 3. Re-encrypt
      const reencrypted = reencryptSecret(modifiedEncrypted, 'ssh');

      // 4. Verify re-encrypted data
      expect(reencrypted).not.toBe(modifiedEncrypted);
      const newDecodedPayload = Buffer.from(reencrypted, 'base64').toString('utf8');
      const newPayload = JSON.parse(newDecodedPayload);
      expect(newPayload.keyVersion).toBe('current');

      // 5. Verify it decrypts with current key
      expect(decryptSecret(reencrypted, 'ssh')).toBe('test-data');
    });
  });

  describe('Aliases', () => {
    it('encrypt should be encryptSecret', () => {
      expect(encrypt).toBe(encryptSecret);
    });

    it('decrypt should be decryptSecret', () => {
      expect(decrypt).toBe(decryptSecret);
    });
  });
});
