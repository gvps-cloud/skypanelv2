/**
 * Shared formatting helpers for presentation logic.
 * Consolidating these utilities reduces duplicate code across pages
 * and ensures a consistent display for numerical values.
 */
export interface FormatCurrencyOptions {
  currency?: string;
  fallback?: string;
  absolute?: boolean;
  locale?: string;
}

export function formatCurrency(
  amount: number | null | undefined,
  {
    currency = "USD",
    fallback,
    absolute = false,
    locale = "en-US",
  }: FormatCurrencyOptions = {}
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return fallback ?? formatter.format(0);
  }

  const value = absolute ? Math.abs(amount) : amount;
  return formatter.format(value);
}

export interface FormatGigabytesOptions {
  precision?: number;
  fallback?: string;
}

export function formatGigabytes(
  bytes: number | null | undefined,
  { precision = 0, fallback = "0 GB" }: FormatGigabytesOptions = {}
): string {
  if (!Number.isFinite(bytes ?? NaN) || !bytes) {
    return fallback;
  }

  const gigabytes = (bytes as number) / 1024;
  const normalizedPrecision = Math.max(0, precision);

  if (normalizedPrecision === 0) {
    return `${Math.round(gigabytes)} GB`;
  }

  return `${gigabytes.toFixed(normalizedPrecision)} GB`;
}
