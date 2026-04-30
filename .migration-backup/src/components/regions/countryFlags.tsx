import { useState } from 'react';
import { Globe, MapPin } from 'lucide-react';

const COUNTRY_CODE_MAP: Record<string, string> = {
  'united states': 'us',
  'united states of america': 'us',
  'usa': 'us',
  'us': 'us',
  'canada': 'ca',
  'brazil': 'br',
  'brasil': 'br',
  'united kingdom': 'gb',
  'uk': 'gb',
  'britain': 'gb',
  'great britain': 'gb',
  'netherlands': 'nl',
  'the netherlands': 'nl',
  'germany': 'de',
  'deutschland': 'de',
  'france': 'fr',
  'spain': 'es',
  'españa': 'es',
  'italy': 'it',
  'italia': 'it',
  'sweden': 'se',
  'sverige': 'se',
  'finland': 'fi',
  'belgium': 'be',
  'switzerland': 'ch',
  'norway': 'no',
  'poland': 'pl',
  'india': 'in',
  'japan': 'jp',
  'singapore': 'sg',
  'indonesia': 'id',
  'south korea': 'kr',
  'southkorea': 'kr',
  'hong kong': 'hk',
  'taiwan': 'tw',
  'australia': 'au',
  'south africa': 'za',
  'southafrica': 'za',
};

export function countryToCode(country: string): string | null {
  const normalized = country.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
    return normalized;
  }
  return COUNTRY_CODE_MAP[normalized] || null;
}

export { COUNTRY_CODE_MAP };

export function CountryFlag({ country, className }: { country: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const code = countryToCode(country);
  if (!code || failed) {
    return <Globe className={`h-4 w-4 text-muted-foreground ${className ?? ''}`} />;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`${country} flag`}
      className={`h-4 w-6 object-contain flex-shrink-0 ${className ?? ''}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function FlagIcon({ countryCode, className }: { countryCode: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <MapPin className={`h-4 w-4 text-muted-foreground ${className ?? ''}`} />;
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${countryCode}.png`}
      alt={`${countryCode} flag`}
      className={`object-contain ${className ?? ''}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
