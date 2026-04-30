// Frontend brand name sourced from environment variables
// Prefer COMPANY_NAME, fallback to VITE_COMPANY_NAME
const candidates = [
  import.meta.env.COMPANY_NAME,
  import.meta.env.VITE_COMPANY_NAME,
];

export const BRAND_NAME: string =
  candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0) ||
  'GVPSCloud';

// Use BRAND_NAME as the email domain when it already contains a dot (e.g. "GVPS.Cloud" → "gvps.cloud"),
// otherwise append ".com" (e.g. "GVPSCloud" → "gvpscloud.com").
export const BRAND_DOMAIN: string = BRAND_NAME.includes('.')
  ? BRAND_NAME.toLowerCase()
  : `${BRAND_NAME.toLowerCase()}.com`;