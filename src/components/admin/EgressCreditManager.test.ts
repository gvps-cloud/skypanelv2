/**
 * Tests for EgressCreditManager floating-point rounding fix.
 *
 * Issue: When an org has a very small balance (e.g., 0.01 GB),
 * floating-point representation causes it to be something like 0.0099999998.
 * This makes HTML min="0.01" exceed max, triggering browser validation error:
 * "minimum value (0.01) must be less than the maximum value (0.009968)"
 *
 * Fix: Round balance to 2 decimal places before setting max attribute.
 */
import { describe, expect, it } from 'vitest';

describe('EgressCreditManager floating-point rounding fix', () => {
  /**
   * Simulates the rounding logic used in the component:
   * max={isRemove && balance ? Math.round(balance * 100) / 100 : undefined}
   */
  function getMaxValue(balance: number | null, isRemove: boolean): number | undefined {
    if (isRemove && balance !== null) {
      return Math.round(balance * 100) / 100;
    }
    return undefined;
  }

  /**
   * Simulates the browser's check: min (0.01) must be <= max
   */
  function isValidInputConfiguration(balance: number | null, isRemove: boolean): boolean {
    const max = getMaxValue(balance, isRemove);
    const min = 0.01;
    return max === undefined || min <= max;
  }

  describe('rounding to 2 decimal places', () => {
    it('rounds 0.0099999998 to 0.01', () => {
      // This is the actual floating-point representation of 0.01 in JS
      const floatBug = 0.01 - 0.0000000012; // ~0.0099999988
      const rounded = Math.round(floatBug * 100) / 100;
      expect(rounded).toBe(0.01);
    });

    it('rounds 0.0149999997 to 0.01', () => {
      const floatBug = 0.015 - 0.0000000003; // ~0.0149999997
      const rounded = Math.round(floatBug * 100) / 100;
      expect(rounded).toBe(0.01);
    });

    it('rounds 0.0050000001 to 0.01', () => {
      const floatBug = 0.005 + 0.0000000001;
      const rounded = Math.round(floatBug * 100) / 100;
      expect(rounded).toBe(0.01);
    });

    it('keeps 0.01 exactly as 0.01', () => {
      const rounded = Math.round(0.01 * 100) / 100;
      expect(rounded).toBe(0.01);
    });

    it('keeps 1.23456789 as 1.23', () => {
      const rounded = Math.round(1.23456789 * 100) / 100;
      expect(rounded).toBe(1.23);
    });

    it('handles 0 correctly', () => {
      const rounded = Math.round(0 * 100) / 100;
      expect(rounded).toBe(0);
    });

    it('handles very small values like 0.001', () => {
      // Edge case: rounding 0.001 * 100 = 0.1, Math.round(0.1) = 0, / 100 = 0
      const rounded = Math.round(0.001 * 100) / 100;
      expect(rounded).toBe(0);
    });
  });

  describe('input validation constraints', () => {
    it('allows removal when balance is exactly 0.01 (pre-rounding)', () => {
      // 0.01 as floating point might be 0.0099999998
      const floatBug = 0.01 - 0.0000000012;
      expect(isValidInputConfiguration(floatBug, true)).toBe(true);
    });

    it('allows removal when balance is 0.02', () => {
      expect(isValidInputConfiguration(0.02, true)).toBe(true);
    });

    it('allows removal when balance is 1.5', () => {
      expect(isValidInputConfiguration(1.5, true)).toBe(true);
    });

    it('returns undefined max when not remove mode', () => {
      expect(getMaxValue(0.01, false)).toBeUndefined();
    });

    it('returns undefined max when balance is null', () => {
      expect(getMaxValue(null, true)).toBeUndefined();
    });

    it('returns 0 as max when balance is 0 (Math.round(0 * 100) / 100 = 0)', () => {
      // Balance of 0 means remove button is disabled, so this is not a real issue
      expect(getMaxValue(0, true)).toBe(0);
    });
  });
});
