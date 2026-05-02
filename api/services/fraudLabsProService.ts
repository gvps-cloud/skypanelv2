import { config } from '../config/index.js';
import { query } from '../lib/database.js';

export interface FraudScreenData {
  ip?: string;
  email?: string;
  amount?: number;
  currency?: string;
  checkType: 'registration' | 'wallet_topup';
  userId?: string;
  organizationId?: string;
}

export interface FraudScreenResult {
  score: number;
  status: 'approve' | 'review' | 'reject';
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isEmailBlacklist: boolean;
  rawResponse: any;
  action: 'allowed' | 'blocked' | 'flagged';
  reason?: string;
}

export class FraudLabsProService {
  static async screen(data: FraudScreenData): Promise<FraudScreenResult> {
    if (!config.FRAUDLABSPRO_ENABLED || !config.FRAUDLABSPRO_API_KEY) {
      return this.createPassResult();
    }

    const params = new URLSearchParams({
      key: config.FRAUDLABSPRO_API_KEY,
      ip: data.ip || '',
      email: data.email || '',
      amount: String(data.amount || 0),
      currency: data.currency || 'USD',
    });

    try {
      const response = await fetch(
        `https://api.fraudlabspro.com/v1/order/screen?${params.toString()}`,
        { method: 'GET' }
      );

      const raw = await response.json();

      const score = parseInt(raw.fraudlabspro_score || '0', 10);
      const isVpn = raw.isVpn === 'Y';
      const isProxy = raw.isProxy === 'Y';
      const isTor = raw.isTor === 'Y';
      const isEmailBlacklist = raw.email_domain_blacklist === 'Y' || raw.email_blacklist === 'Y';

      let status: 'approve' | 'review' | 'reject' = 'approve';
      if (score >= config.FRAUDLABSPRO_REJECT_SCORE) status = 'reject';
      else if (score >= 50) status = 'review';

      const result: FraudScreenResult = {
        score,
        status,
        isVpn,
        isProxy,
        isTor,
        isEmailBlacklist,
        rawResponse: raw,
        action: 'allowed',
      };

      // Apply policy rules
      if (status === 'reject') {
        result.action = 'blocked';
        result.reason = `Fraud score ${score} exceeds threshold ${config.FRAUDLABSPRO_REJECT_SCORE}`;
      } else if (config.FRAUDLABSPRO_REJECT_VPN && isVpn) {
        result.action = 'blocked';
        result.reason = 'VPN usage detected';
      } else if (config.FRAUDLABSPRO_REJECT_PROXY && isProxy) {
        result.action = 'blocked';
        result.reason = 'Proxy usage detected';
      } else if (config.FRAUDLABSPRO_REJECT_TOR && isTor) {
        result.action = 'blocked';
        result.reason = 'TOR usage detected';
      } else if (config.FRAUDLABSPRO_REJECT_DISPOSABLE_EMAIL && isEmailBlacklist) {
        result.action = 'blocked';
        result.reason = 'Disposable or blacklisted email domain';
      } else if (status === 'review') {
        result.action = 'flagged';
        result.reason = `Fraud score ${score} flagged for review`;
      }

      await this.recordCheck(data, result);
      return result;
    } catch (error) {
      console.error('FraudLabsPro screen error:', error);
      // Fail open: allow the transaction but flag it
      const failOpen = this.createPassResult();
      failOpen.action = 'flagged';
      failOpen.reason = 'FraudLabsPro service unavailable';
      await this.recordCheck(data, failOpen);
      return failOpen;
    }
  }

  static async screenRegistration(ip: string, email: string, userId?: string): Promise<FraudScreenResult> {
    return this.screen({
      ip,
      email,
      checkType: 'registration',
      userId,
      amount: 0,
    });
  }

  static async assertNotBlocked(data: FraudScreenData): Promise<void> {
    const result = await this.screen(data);
    if (result.action === 'blocked') {
      const error = new Error(result.reason || 'Transaction blocked due to fraud risk');
      (error as any).fraudResult = result;
      throw error;
    }
  }

  private static createPassResult(): FraudScreenResult {
    return {
      score: 0,
      status: 'approve',
      isVpn: false,
      isProxy: false,
      isTor: false,
      isEmailBlacklist: false,
      rawResponse: {},
      action: 'allowed',
    };
  }

  private static async recordCheck(data: FraudScreenData, result: FraudScreenResult): Promise<void> {
    try {
      await query(
        `INSERT INTO fraud_checks (user_id, organization_id, check_type, ip_address, email, amount, currency, score, status, is_vpn, is_proxy, is_tor, raw_response, action_taken)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          data.userId || null,
          data.organizationId || null,
          data.checkType,
          data.ip || null,
          data.email || null,
          data.amount || 0,
          data.currency || 'USD',
          result.score,
          result.status,
          result.isVpn,
          result.isProxy,
          result.isTor,
          JSON.stringify(result.rawResponse),
          result.action,
        ]
      );
    } catch (err) {
      console.error('Failed to record fraud check:', err);
    }
  }
}
