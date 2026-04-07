import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  hasEncryptionKey,
  reencryptSecret,
} from './crypto';

describe('Cryptographic utilities', () => {
  const MOCK_SSH_SECRET = 'ssh-secret-must-be-32-chars-long-12345';
  const MOCK_PROVIDER_SECRET = 'provider-secret-must-be-32-chars-long-123';
  const MOCK_PREVIOUS_SSH_SECRET = 'old-ssh-secret-32-chars-long-1234567';

  beforeEach(() => {
    vi.stubEnv('SSH_CRED_SECRET', MOCK_SSH_SECRET);
    vi.stubEnv('PROVIDER_TOKEN_SECRET', MOCK_PROVIDER_SECRET);
    vi.stubEnv('SSH_CRED_SECRET_PREVIOUS', MOCK_PREVIOUS_SSH_SECRET);
    vi.stubEnv('PROVIDER_TOKEN_SECRET_PREVIOUS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('encryptSecret and decryptSecret', () => {
    it('should correctly encrypt and decrypt an SSH secret', () => {
      const plaintext = 'my-super-secret-ssh-key';
      const encrypted = encryptSecret(plaintext, 'ssh');

      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptSecret(encrypted, 'ssh');
      expect(decrypted).toBe(plaintext);
    });

    it('should correctly encrypt and decrypt a provider secret', () => {
      const plaintext = 'linode_api_token_abc123';
      const encrypted = encryptSecret(plaintext, 'provider');

      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptSecret(encrypted, 'provider');
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext due to random IVs', () => {
      const plaintext = 'identical-secret';
      const encrypted1 = encryptSecret(plaintext, 'ssh');
      const encrypted2 = encryptSecret(plaintext, 'ssh');

      expect(encrypted1).not.toBe(encrypted2);

      // Both should still decrypt to the same plaintext
      expect(decryptSecret(encrypted1, 'ssh')).toBe(plaintext);
      expect(decryptSecret(encrypted2, 'ssh')).toBe(plaintext);
    });

    it('should fall back to SSH_CRED_SECRET for provider if PROVIDER_TOKEN_SECRET is not set', () => {
      vi.stubEnv('PROVIDER_TOKEN_SECRET', '');
      const plaintext = 'provider-secret-fallback';
      const encrypted = encryptSecret(plaintext, 'provider');
      const decrypted = decryptSecret(encrypted, 'provider');
      expect(decrypted).toBe(plaintext);
    });

    it('should handle legacy unencrypted secrets (fallback behavior)', () => {
      // If a secret was never encrypted, decryptSecret should return it as-is
      const legacySecret = 'this-is-a-plain-text-secret';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const decrypted = decryptSecret(legacySecret, 'ssh');

      expect(decrypted).toBe(legacySecret);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle invalid base64 JSON payload (fallback behavior)', () => {
      // e.g., something base64 encoded but not JSON
      const invalidPayload = Buffer.from('just some base64 string').toString('base64');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const decrypted = decryptSecret(invalidPayload, 'ssh');

      expect(decrypted).toBe(invalidPayload);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw error if key version is not found', () => {
      const plaintext = 'secret';
      const encrypted = encryptSecret(plaintext, 'ssh');

      // Tamper with the keyVersion
      const payload = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
      payload.keyVersion = 'v999';
      const tamperedEncrypted = Buffer.from(JSON.stringify(payload)).toString('base64');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => decryptSecret(tamperedEncrypted, 'ssh')).toThrow(/not available/);
      consoleSpy.mockRestore();
    });
  });

  describe('key rotation (previous keys)', () => {
    it('should decrypt with a previous key version', () => {
      // First, simulate encrypting with an old key
      // We will do this by temporarily setting the current key to the old key
      vi.stubEnv('SSH_CRED_SECRET', MOCK_PREVIOUS_SSH_SECRET);
      const plaintext = 'secret-from-the-past';
      const encryptedWithOldKey = encryptSecret(plaintext, 'ssh');

      // Now set up the environment with the NEW key, and the OLD key in PREVIOUS
      vi.stubEnv('SSH_CRED_SECRET', MOCK_SSH_SECRET);
      vi.stubEnv('SSH_CRED_SECRET_PREVIOUS', MOCK_PREVIOUS_SSH_SECRET);

      // We need to manipulate the keyVersion since encryptSecret always uses 'current'
      const payload = JSON.parse(Buffer.from(encryptedWithOldKey, 'base64').toString('utf8'));
      payload.keyVersion = 'v1'; // v1 maps to the first previous key
      const versionedEncrypted = Buffer.from(JSON.stringify(payload)).toString('base64');

      const decrypted = decryptSecret(versionedEncrypted, 'ssh');
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('reencryptSecret', () => {
    it('should re-encrypt a secret (useful for key rotation migration)', () => {
      // Let's create an old encrypted payload
      vi.stubEnv('SSH_CRED_SECRET', MOCK_PREVIOUS_SSH_SECRET);
      const plaintext = 'needs-migration';
      const oldEncrypted = encryptSecret(plaintext, 'ssh');

      const payload = JSON.parse(Buffer.from(oldEncrypted, 'base64').toString('utf8'));
      payload.keyVersion = 'v1';
      const versionedOldEncrypted = Buffer.from(JSON.stringify(payload)).toString('base64');

      // Now set current environment
      vi.stubEnv('SSH_CRED_SECRET', MOCK_SSH_SECRET);
      vi.stubEnv('SSH_CRED_SECRET_PREVIOUS', MOCK_PREVIOUS_SSH_SECRET);

      // Re-encrypt
      const newEncrypted = reencryptSecret(versionedOldEncrypted, 'ssh');

      expect(newEncrypted).not.toBe(versionedOldEncrypted);

      // Verify new payload has 'current' version
      const newPayload = JSON.parse(Buffer.from(newEncrypted, 'base64').toString('utf8'));
      expect(newPayload.keyVersion).toBe('current');

      // Verify it decrypts back
      expect(decryptSecret(newEncrypted, 'ssh')).toBe(plaintext);
    });
  });

  describe('hasEncryptionKey', () => {
    it('should return true if a valid key is configured', () => {
      expect(hasEncryptionKey('ssh')).toBe(true);
      expect(hasEncryptionKey('provider')).toBe(true);
    });

    it('should return false if key is not configured or too short', () => {
      vi.stubEnv('SSH_CRED_SECRET', 'short');
      expect(hasEncryptionKey('ssh')).toBe(false);

      vi.stubEnv('PROVIDER_TOKEN_SECRET', '');
      vi.stubEnv('SSH_CRED_SECRET', '');
      expect(hasEncryptionKey('provider')).toBe(false);
    });
  });
});
