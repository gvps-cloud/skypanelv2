import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encryptSecret, decryptSecret } from '../../lib/crypto';
import crypto from 'crypto';

vi.mock('../../config/index.js', () => ({
  config: {
    SSH_CRED_SECRET: 'test-ssh-secret-must-be-16-chars-long',
  },
}));

describe('crypto.ts - decryptSecret', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env.PROVIDER_TOKEN_SECRET = 'test-provider-secret-16-chars+';
    process.env.SSH_CRED_SECRET_PREVIOUS = 'old-ssh-secret-must-be-16-chars!';

    // Silence console warnings and errors during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('successfully decrypts a freshly encrypted ssh secret', () => {
    const plaintext = 'super-secret-ssh-key';
    const encrypted = encryptSecret(plaintext, 'ssh');
    const decrypted = decryptSecret(encrypted, 'ssh');
    expect(decrypted).toBe(plaintext);
  });

  it('successfully decrypts a freshly encrypted provider secret', () => {
    const plaintext = 'super-secret-provider-token';
    const encrypted = encryptSecret(plaintext, 'provider');
    const decrypted = decryptSecret(encrypted, 'provider');
    expect(decrypted).toBe(plaintext);
  });

  it('falls back to returning input directly when it is not base64', () => {
    const legacyPlaintext = 'legacy-unencrypted-secret';
    // Not valid base64 (contains invalid chars like '-', spaces won't throw directly but invalid structure might)
    // Actually Buffer.from doesn't strictly throw on some strings, so we pass a clear plain string that won't parse as JSON
    const result = decryptSecret(legacyPlaintext);
    expect(result).toBe(legacyPlaintext);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('decoded payload is not JSON'),
      expect.anything()
    );
  });

  it('falls back to returning input directly when it is not valid JSON', () => {
    const invalidJson = Buffer.from('not-json').toString('base64');
    const result = decryptSecret(invalidJson);
    expect(result).toBe(invalidJson);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('decoded payload is not JSON'),
      expect.anything()
    );
  });

  it('falls back to returning input when missing iv, tag, or ciphertext in the JSON payload', () => {
    const missingFields = Buffer.from(JSON.stringify({ keyVersion: 'current' })).toString('base64');
    const result = decryptSecret(missingFields);
    expect(result).toBe(missingFields);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('payload missing encryption fields')
    );
  });

  it('supports key rotation: decrypts using previous keys (v1)', () => {
    // Generate a payload manually using the old key to simulate legacy encrypted data
    const oldKey = crypto.createHash('sha256').update('old-ssh-secret-must-be-16-chars!').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', oldKey, iv);

    const plaintext = 'data-encrypted-with-old-key';
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const payload = {
      keyVersion: 'v1',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    const decrypted = decryptSecret(encoded, 'ssh');
    expect(decrypted).toBe(plaintext);
  });

  it('rejects an invalid key version', () => {
    const payload = {
      keyVersion: 'v2',
      iv: 'dummy-iv',
      tag: 'dummy-tag',
      ciphertext: 'dummy-ciphertext',
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    expect(() => decryptSecret(encoded, 'ssh')).toThrowError("Key version 'v2' not available");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("key version 'v2' not available")
    );
  });

  it('fails to decrypt when payload is tampered (corrupted tag)', () => {
    const plaintext = 'secret-data';
    const encrypted = encryptSecret(plaintext, 'ssh');

    // Tamper with the tag
    const decoded = Buffer.from(encrypted, 'base64');
    const payload = JSON.parse(decoded.toString('utf8'));

    // Modify tag by appending or changing a character
    payload.tag = Buffer.from('invalid-tag-data-that-is-long-enough').toString('base64');

    const tamperedEncoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    expect(() => decryptSecret(tamperedEncoded, 'ssh')).toThrowError();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("failed to decrypt with key version 'current'"),
      expect.anything()
    );
  });
});
