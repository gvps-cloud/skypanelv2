/**
 * Whitelabel Provider Name Security Tests for SkyPanelV2
 *
 * **Test Coverage:**
 * - Error messages use whitelabel provider name instead of hardcoded "Linode"
 * - Fallback displays generic name instead of raw providerType
 * - No hardcoded provider names exposed to users
 *
 * **Security Principles Verified:**
 * 1. Provider names are configurable and whitelabelable
 * 2. Error messages do not expose upstream provider identity
 * 3. Fallback displays use generic terms, not raw internal identifiers
 */

import { describe, it, expect } from 'vitest';
import {
  getUserFriendlyErrorMessage,
  formatErrorDisplay,
  ProviderError,
} from '../../src/lib/providerErrors.js';

describe('Whitelabel Provider Name Security', () => {
  describe('Error Message Whitelabeling', () => {
    /**
     * **SECURITY TEST: Error messages use whitelabel provider name**
     *
     * Verifies that error messages use the provided provider name
     * instead of hardcoded "Linode".
     *
     * **Threat Mitigated:** Exposure of upstream provider identity
     * **Security Standard:** OWASP Information Disclosure
     */
    it('should use provided provider name in error messages', () => {
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Authentication failed',
        provider: 'MyCloud',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toContain('MyCloud');
      expect(message).not.toContain('Linode');
      expect(message).not.toContain('linode');
    });

    it('should use whitelabel name for rate limit errors', () => {
      const error: ProviderError = {
        code: 'HTTP_429',
        message: 'Rate limit exceeded',
        provider: 'CloudServices',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toContain('CloudServices');
      expect(message).not.toContain('Linode');
    });

    it('should use whitelabel name for server errors', () => {
      const error: ProviderError = {
        code: 'HTTP_503',
        message: 'Service unavailable',
        provider: 'MyBrand',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toContain('MyBrand');
      expect(message).not.toContain('Linode');
    });

    it('should use whitelabel name for network errors', () => {
      const error: ProviderError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        provider: 'CustomCloud',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toContain('CustomCloud');
      expect(message).not.toContain('Linode');
    });
  });

  describe('Fallback Provider Name', () => {
    /**
     * **SECURITY TEST: Generic fallback when no provider name**
     *
     * Verifies that when no provider name is provided,
     * a generic term is used instead of exposing the upstream provider.
     *
     * **Threat Mitigated:** Information disclosure via error messages
     * **Security Standard:** OWASP Error Handling
     */
    it('should use generic "Provider" when no provider name provided', () => {
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Authentication failed',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toContain('Provider');
      expect(message).not.toContain('Linode');
      expect(message).not.toContain('linode');
    });

    it('should use generic fallback for missing credentials', () => {
      const error: ProviderError = {
        code: 'MISSING_CREDENTIALS',
        message: 'Credentials not configured',
      };

      const message = getUserFriendlyErrorMessage(error);

      expect(message).toMatch(/Provider|cloud/i);
      expect(message).not.toContain('Linode');
    });
  });

  describe('No Hardcoded Provider Names', () => {
    /**
     * **SECURITY TEST: No hardcoded "Linode" in user-facing messages**
     *
     * Verifies that the error handling code does not contain
     * hardcoded references to the upstream provider.
     *
     * **Threat Mitigated:** Whitelabel bypass via error messages
     * **Security Standard:** OWASP Information Protection
     */
    it('should not expose "linode" in any error message when using custom name', () => {
      const errorCodes = [
        'HTTP_401',
        'HTTP_403',
        'HTTP_429',
        'HTTP_500',
        'HTTP_502',
        'HTTP_503',
        'HTTP_504',
        'MISSING_CREDENTIALS',
        'INVALID_CREDENTIALS',
        'NETWORK_ERROR',
        'TIMEOUT',
        'SERVICE_UNAVAILABLE',
        'PROVIDER_UNAVAILABLE',
      ];

      for (const code of errorCodes) {
        const error: ProviderError = {
          code,
          message: 'Test error',
          provider: 'WhitelabelCloud',
        };

        const message = getUserFriendlyErrorMessage(error);

        expect(message).not.toMatch(/linode/i);
        expect(message).toContain('WhitelabelCloud');
      }
    });

    it('should handle unknown provider types gracefully', () => {
      const error: ProviderError = {
        code: 'HTTP_500',
        message: 'Server error',
        provider: 'unknown-provider-type',
      };

      const message = getUserFriendlyErrorMessage(error);

      // Should use the provider name as-is (capitalized) if not in display names map
      // The function capitalizes the first letter for display
      expect(message.toLowerCase()).toContain('unknown-provider-type');
      expect(message).not.toContain('Linode');
    });
  });

  describe('Format Error Display', () => {
    it('should include whitelabel name in formatted display', () => {
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Auth failed',
        provider: 'MyCloudService',
      };

      const display = formatErrorDisplay(error);

      expect(display.message).toContain('MyCloudService');
      expect(display.message).not.toContain('Linode');
      expect(display.suggestion).toBeDefined();
      expect(typeof display.isRetryable).toBe('boolean');
    });
  });

  describe('Provider Display Name Function', () => {
    /**
     * **SECURITY TEST: getProviderDisplayName uses provided name**
     *
     * Verifies that the internal getProviderDisplayName function
     * respects the provided provider name.
     *
     * Note: This tests the implementation detail that the function
     * should use the provided name, not a hardcoded mapping.
     */
    it('should return provided provider name when given', () => {
      // This is tested indirectly through getUserFriendlyErrorMessage
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Auth failed',
        provider: 'CustomProvider',
      };

      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('CustomProvider');
    });

    it('should handle empty provider name', () => {
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Auth failed',
        provider: '',
      };

      const message = getUserFriendlyErrorMessage(error);
      // Should fall back to generic "Provider"
      expect(message).toContain('Provider');
    });

    it('should handle undefined provider name', () => {
      const error: ProviderError = {
        code: 'HTTP_401',
        message: 'Auth failed',
        provider: undefined,
      };

      const message = getUserFriendlyErrorMessage(error);
      // Should fall back to generic "Provider"
      expect(message).toContain('Provider');
    });
  });
});
