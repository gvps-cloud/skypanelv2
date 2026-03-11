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