import { describe, it, expect } from 'vitest';
import {
  getSpeedTestUrl,
  normalizeRegionList,
  matchesDefaultAllowedRegions,
  shouldFilterByAllowedRegions,
  parseStoredAllowedRegions,
  DEFAULT_LINODE_ALLOWED_REGIONS,
  LINODE_SPEED_TEST_URLS
} from './providerRegions.js';

describe('providerRegions', () => {
  describe('getSpeedTestUrl', () => {
    it('should return correct URL for a known region', () => {
      expect(getSpeedTestUrl('us-east')).toBe(LINODE_SPEED_TEST_URLS['us-east']);
    });

    it('should handle case-insensitivity and trimming', () => {
      expect(getSpeedTestUrl('  US-EAST  ')).toBe(LINODE_SPEED_TEST_URLS['us-east']);
    });

    it('should return undefined for unknown regions', () => {
      expect(getSpeedTestUrl('unknown-region')).toBeUndefined();
    });
  });

  describe('normalizeRegionList', () => {
    it('should handle empty array', () => {
      expect(normalizeRegionList([])).toEqual([]);
    });

    it('should trim and lowercase entries', () => {
      expect(normalizeRegionList(['  US-East  ', 'EU-West'])).toEqual(['us-east', 'eu-west']);
    });

    it('should remove duplicates', () => {
      expect(normalizeRegionList(['us-east', 'us-east', 'US-EAST'])).toEqual(['us-east']);
    });

    it('should filter out empty strings', () => {
      expect(normalizeRegionList(['us-east', '', '   '])).toEqual(['us-east']);
    });
  });

  describe('matchesDefaultAllowedRegions', () => {
    const defaultNormalized = DEFAULT_LINODE_ALLOWED_REGIONS.map(r => r.toLowerCase());

    it('should return true for exact match of default regions', () => {
      expect(matchesDefaultAllowedRegions(defaultNormalized)).toBe(true);
    });

    it('should return false for partial match', () => {
      expect(matchesDefaultAllowedRegions(['us-east', 'us-west'])).toBe(false);
    });

    it('should return false for empty list', () => {
      expect(matchesDefaultAllowedRegions([])).toBe(false);
    });

    it('should return false for list with same length but different contents', () => {
      const mixed = [...defaultNormalized.slice(1), 'unknown-region'];
      expect(matchesDefaultAllowedRegions(mixed)).toBe(false);
    });
  });

  describe('shouldFilterByAllowedRegions', () => {
    it('should return true for non-empty lists', () => {
      expect(shouldFilterByAllowedRegions(['us-east'])).toBe(true);
    });

    it('should return false for empty lists', () => {
      expect(shouldFilterByAllowedRegions([])).toBe(false);
    });
  });

  describe('parseStoredAllowedRegions', () => {
    it('should handle null/undefined', () => {
      expect(parseStoredAllowedRegions(null)).toEqual([]);
      expect(parseStoredAllowedRegions(undefined)).toEqual([]);
    });

    it('should handle array of strings and non-strings', () => {
      expect(parseStoredAllowedRegions(['us-east', 123, 'us-west', null])).toEqual(['us-east', 'us-west']);
    });

    it('should handle valid JSON array string', () => {
      expect(parseStoredAllowedRegions('["us-east", "us-west"]')).toEqual(['us-east', 'us-west']);
    });

    it('should handle invalid JSON string', () => {
      expect(parseStoredAllowedRegions('invalid-json')).toEqual([]);
    });

    it('should handle object (JSONB simulation)', () => {
      const jsonbObj = { "0": "us-east", "1": "us-west" };
      expect(parseStoredAllowedRegions(jsonbObj)).toEqual(['us-east', 'us-west']);
    });

    it('should handle empty string and whitespace string', () => {
      expect(parseStoredAllowedRegions('')).toEqual([]);
      expect(parseStoredAllowedRegions('   ')).toEqual([]);
    });
  });
});
