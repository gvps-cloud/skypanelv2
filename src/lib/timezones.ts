/**
 * Shared timezone configuration
 * Used in both user settings and admin user management
 */

export interface TimezoneOption {
  value: string;
  label: string;
  region?: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // UTC
  {
    value: 'UTC',
    label: 'UTC (Coordinated Universal Time)',
    region: 'Global',
  },
  // North America
  {
    value: 'America/New_York',
    label: 'Eastern Time (US & Canada)',
    region: 'North America',
  },
  {
    value: 'America/Chicago',
    label: 'Central Time (US & Canada)',
    region: 'North America',
  },
  {
    value: 'America/Denver',
    label: 'Mountain Time (US & Canada)',
    region: 'North America',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Pacific Time (US & Canada)',
    region: 'North America',
  },
  {
    value: 'America/Phoenix',
    label: 'Mountain Time (Arizona, no DST)',
    region: 'North America',
  },
  {
    value: 'America/Anchorage',
    label: 'Alaska Time',
    region: 'North America',
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Hawaii Time',
    region: 'North America',
  },
  // Europe
  {
    value: 'Europe/London',
    label: 'London (GMT/BST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Paris',
    label: 'Paris (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Berlin',
    label: 'Berlin (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Amsterdam',
    label: 'Amsterdam (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Rome',
    label: 'Rome (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Madrid',
    label: 'Madrid (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Zurich',
    label: 'Zurich (CET/CEST)',
    region: 'Europe',
  },
  {
    value: 'Europe/Moscow',
    label: 'Moscow Time',
    region: 'Europe',
  },
  // Asia
  {
    value: 'Asia/Tokyo',
    label: 'Tokyo (JST)',
    region: 'Asia',
  },
  {
    value: 'Asia/Shanghai',
    label: 'Shanghai (CST)',
    region: 'Asia',
  },
  {
    value: 'Asia/Hong_Kong',
    label: 'Hong Kong (HKT)',
    region: 'Asia',
  },
  {
    value: 'Asia/Singapore',
    label: 'Singapore (SGT)',
    region: 'Asia',
  },
  {
    value: 'Asia/Seoul',
    label: 'Seoul (KST)',
    region: 'Asia',
  },
  {
    value: 'Asia/Dubai',
    label: 'Dubai (GST)',
    region: 'Asia',
  },
  {
    value: 'Asia/Kolkata',
    label: 'India (IST)',
    region: 'Asia',
  },
  {
    value: 'Asia/Bangkok',
    label: 'Bangkok (ICT)',
    region: 'Asia',
  },
  {
    value: 'Asia/Jakarta',
    label: 'Jakarta (WIB)',
    region: 'Asia',
  },
  // Australia
  {
    value: 'Australia/Sydney',
    label: 'Sydney (AEST/AEDT)',
    region: 'Oceania',
  },
  {
    value: 'Australia/Melbourne',
    label: 'Melbourne (AEST/AEDT)',
    region: 'Oceania',
  },
  {
    value: 'Australia/Brisbane',
    label: 'Brisbane (AEST)',
    region: 'Oceania',
  },
  {
    value: 'Australia/Perth',
    label: 'Perth (AWST)',
    region: 'Oceania',
  },
  // South America
  {
    value: 'America/Sao_Paulo',
    label: 'São Paulo (BRT)',
    region: 'South America',
  },
  {
    value: 'America/Buenos_Aires',
    label: 'Buenos Aires (ART)',
    region: 'South America',
  },
  {
    value: 'America/Lima',
    label: 'Lima (PET)',
    region: 'South America',
  },
  {
    value: 'America/Bogota',
    label: 'Bogota (COT)',
    region: 'South America',
  },
  // Africa
  {
    value: 'Africa/Johannesburg',
    label: 'Johannesburg (SAST)',
    region: 'Africa',
  },
  {
    value: 'Africa/Cairo',
    label: 'Cairo (EET)',
    region: 'Africa',
  },
  {
    value: 'Africa/Lagos',
    label: 'Lagos (WAT)',
    region: 'Africa',
  },
];

/**
 * Get friendly label for a timezone value
 */
export function getTimezoneLabel(timezoneValue: string): string {
  const option = TIMEZONE_OPTIONS.find(tz => tz.value === timezoneValue);
  return option?.label || timezoneValue;
}

/**
 * Group timezones by region for display in organized dropdowns
 */
export function getTimezonesByRegion(): Record<string, TimezoneOption[]> {
  const grouped: Record<string, TimezoneOption[]> = {};

  for (const tz of TIMEZONE_OPTIONS) {
    const region = tz.region || 'Other';
    if (!grouped[region]) {
      grouped[region] = [];
    }
    grouped[region].push(tz);
  }

  return grouped;
}
