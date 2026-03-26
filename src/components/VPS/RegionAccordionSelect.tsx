/**
 * RegionAccordionSelect Component
 *
 * An accordion-style dropdown for selecting VPS regions, grouped by country.
 * Provides a more organized and compact interface compared to flat lists.
 */

import { useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';

const COUNTRY_CODES: Record<string, string> = {
  // North America
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  us: "us",
  canada: "ca",
  // South America
  brazil: "br",
  brasil: "br",
  // Europe
  "united kingdom": "gb",
  uk: "gb",
  britain: "gb",
  "great britain": "gb",
  netherlands: "nl",
  "the netherlands": "nl",
  germany: "de",
  deutschland: "de",
  france: "fr",
  spain: "es",
  españa: "es",
  italy: "it",
  italia: "it",
  sweden: "se",
  sverige: "se",
  finland: "fi",
  belgium: "be",
  switzerland: "ch",
  norway: "no",
  // Asia
  india: "in",
  japan: "jp",
  singapore: "sg",
  indonesia: "id",
  "south korea": "kr",
  southkorea: "kr",
  // Oceania
  australia: "au",
  // Africa
  "south africa": "za",
  southafrica: "za",
};

/**
 * Get ISO country code from country name
 */
const getCountryCode = (country?: string): string | null => {
  const normalizedCountry = country?.trim().toLowerCase();
  if (!normalizedCountry) return null;

  if (normalizedCountry.length === 2 && /^[a-z]{2}$/.test(normalizedCountry)) {
    return normalizedCountry;
  }

  return COUNTRY_CODES[normalizedCountry] ?? null;
};

/**
 * Country Flag Icon Component
 */
function CountryFlag({ country, label }: { country?: string; label?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const countryCode = getCountryCode(country);
  const imageUrl = countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : null;
  const altText = `${country || label || "Region"} flag`;

  if (!imageUrl || imageFailed) {
    return <Globe className="h-4 w-4 text-muted-foreground" aria-label={altText} />;
  }

  return (
    <img
      src={imageUrl}
      alt={altText}
      className="h-4 w-6 rounded-sm object-cover shadow-sm"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

/**
 * Region type that works with both ProviderRegion and CreateRegionOption
 */
export type RegionLike = {
  id: string;
  label: string;
  country?: string;
  status?: string;
  capabilities?: string[];
};

/**
 * Group regions by country for accordion display
 */
function groupRegionsByCountry(regions: RegionLike[]): Record<string, AccordionSelectGroup> {
  const groups: Record<string, AccordionSelectGroup> = {};

  regions.forEach((region) => {
    const country = region.country || 'Other';

    if (!groups[country]) {
      groups[country] = {
        name: country,
        icon: <CountryFlag country={country} />,
        items: [],
      };
    }

    groups[country].items.push({
      id: region.id,
      label: region.label,
      description: region.id,
      metadata: region.status && region.status !== 'ok' ? region.status.toUpperCase() : undefined,
      disabled: region.status !== 'ok' && region.status !== undefined,
    });
  });

  return groups;
}

interface RegionAccordionSelectProps {
  regions: RegionLike[];
  selectedRegion: string;
  onSelect: (regionId: string) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * RegionAccordionSelect Component
 *
 * Displays regions grouped by country in an expandable accordion format.
 *
 * Features:
 * - Regions grouped by country with flag icons
 * - Region ID shown as metadata
 * - Status indicators for regions (e.g., "sold out")
 * - Search by region name, country, or ID
 * - Auto-expands country containing selected region
 */
export function RegionAccordionSelect({
  regions,
  selectedRegion,
  onSelect,
  loading = false,
  error = null,
  disabled = false,
  className,
}: RegionAccordionSelectProps) {
  const groupedRegions = useMemo(() => {
    return groupRegionsByCountry(regions);
  }, [regions]);

  // Order countries alphabetically, but prioritize common countries
  const countryOrder = useMemo(() => {
    const priorityCountries = ['United States', 'Germany', 'United Kingdom', 'Japan', 'Canada', 'Singapore'];
    const allCountries = Object.keys(groupedRegions);

    return [
      ...priorityCountries.filter(c => allCountries.includes(c)),
      ...allCountries.filter(c => !priorityCountries.includes(c)).sort(),
    ];
  }, [groupedRegions]);

  const emptyMessage = regions.length === 0
    ? "No regions available for this provider."
    : "No regions found matching your search.";

  return (
    <div className="space-y-2">
      <AccordionSelect
        groups={groupedRegions}
        selectedId={selectedRegion}
        onSelect={onSelect}
        placeholder="Select a region..."
        searchPlaceholder="Search regions..."
        loading={loading}
        loadingMessage="Loading regions..."
        emptyMessage={error || emptyMessage}
        disabled={disabled || !!error}
        groupOrder={countryOrder}
        className={className}
      />
    </div>
  );
}
