import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FraudLabsProService } from './fraudLabsProService.js';

describe('FraudLabsProService', () => {
  beforeEach(() => {
    process.env.FRAUDLABSPRO_ENABLED = 'true';
    process.env.FRAUDLABSPRO_API_KEY = 'test-key';
    process.env.FRAUDLABSPRO_REJECT_SCORE = '80';
    process.env.FRAUDLABSPRO_REJECT_VPN = 'true';
    process.env.FRAUDLABSPRO_REJECT_PROXY = 'true';
    process.env.FRAUDLABSPRO_REJECT_TOR = 'true';
    process.env.FRAUDLABSPRO_REJECT_DISPOSABLE_EMAIL = 'true';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return pass result when disabled', async () => {
    process.env.FRAUDLABSPRO_ENABLED = 'false';
    const result = await FraudLabsProService.screen({
      checkType: 'registration',
      ip: '1.2.3.4',
      email: 'test@example.com',
    });

    expect(result.action).toBe('allowed');
    expect(result.score).toBe(0);
  });

  it('should block high score transactions', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        fraudlabspro_score: '85',
        isVpn: 'N',
        isProxy: 'N',
        isTor: 'N',
        email_domain_blacklist: 'N',
      }),
    });

    const result = await FraudLabsProService.screen({
      checkType: 'wallet_topup',
      ip: '1.2.3.4',
      email: 'test@example.com',
      amount: 100,
      currency: 'USD',
    });

    expect(result.action).toBe('blocked');
    expect(result.score).toBe(85);
  });

  it('should block VPN users when configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        fraudlabspro_score: '10',
        isVpn: 'Y',
        isProxy: 'N',
        isTor: 'N',
        email_domain_blacklist: 'N',
      }),
    });

    const result = await FraudLabsProService.screenRegistration('1.2.3.4', 'test@example.com');
    expect(result.action).toBe('blocked');
    expect(result.reason).toContain('VPN');
  });

  it('should fail open on API error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await FraudLabsProService.screen({
      checkType: 'registration',
      ip: '1.2.3.4',
      email: 'test@example.com',
    });

    expect(result.action).toBe('flagged');
    expect(result.reason).toContain('unavailable');
  });

  it('should throw when assertNotBlocked is called on blocked result', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        fraudlabspro_score: '85',
        isVpn: 'N',
        isProxy: 'N',
        isTor: 'N',
        email_domain_blacklist: 'N',
      }),
    });

    await expect(FraudLabsProService.assertNotBlocked({
      checkType: 'wallet_topup',
      ip: '1.2.3.4',
      email: 'test@example.com',
    })).rejects.toThrow('Fraud score 85 exceeds threshold 80');
  });
});
