/**
 * Egress Utility Functions for SkyPanelV2
 * Shared utilities for egress credit billing and transfer normalization
 */

/**
 * Round a number to specified decimal places
 * @param value - The value to round
 * @param digits - Number of decimal places (default: 6)
 * @returns Rounded number, or 0 if value is not finite
 */
export function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

/**
 * Convert bytes to gigabytes (base 10: 1 GB = 1,000,000,000 bytes)
 * @param value - Value in bytes
 * @returns Value in gigabytes, or 0 if invalid
 */
export function bytesToGigabytes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value / 1_000_000_000;
}

/**
 * Extract transfer used bytes from various API response formats
 * Handles Linode API responses and potential format variations
 *
 * Expected formats:
 * - Direct number: 1234567890
 * - Object with total: { total: 1234567890 }
 * - Object with in/out: { in: 1000000, out: 2000000 }
 * - Object with used: { used: 1234567890 }
 * - Object with amount: { amount: 1234567890 }
 *
 * @param used - Transfer usage data from API
 * @returns Total transfer used in bytes
 */
export function extractTransferUsedBytes(used: unknown): number {
  if (typeof used === 'number') {
    return used;
  }

  if (typeof used === 'object' && used !== null) {
    const transfer = used as Record<string, unknown>;

    // Try total field (Linode API primary format)
    if (typeof transfer.total === 'number') {
      return transfer.total;
    }

    // Try summing in and out (alternative Linode format)
    const inbound = typeof transfer.in === 'number' ? transfer.in : 0;
    const outbound = typeof transfer.out === 'number' ? transfer.out : 0;
    const total = inbound + outbound;

    if (total > 0) {
      return total;
    }

    // Try used field
    if (typeof transfer.used === 'number') {
      return transfer.used;
    }

    // Try amount field
    if (typeof transfer.amount === 'number') {
      return transfer.amount;
    }
  }

  return 0;
}

/**
 * Normalize transfer usage to gigabytes with rounding
 * @param used - Transfer usage data from API
 * @returns Normalized transfer usage in GB
 */
export function normalizeTransferUsageGb(used: unknown): number {
  return round(bytesToGigabytes(extractTransferUsedBytes(used)), 6);
}
