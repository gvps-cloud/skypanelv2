/**
 * RegionMultiSelect Component
 *
 * A multi-select dropdown for filtering VPS instances by region.
 * Groups regions by country with flags for easy identification.
 */

import { useMemo, useState } from 'react';
import { Globe, Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface RegionOption {
  id: string;
  label: string;
  country?: string;
}

// Country code mapping from RegionAccordionSelect
const COUNTRY_CODES: Record<string, string> = {
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  us: "us",
  canada: "ca",
  brazil: "br",
  brasil: "br",
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
  india: "in",
  japan: "jp",
  singapore: "sg",
  indonesia: "id",
  "south korea": "kr",
  southkorea: "kr",
  australia: "au",
  "south africa": "za",
  southafrica: "za",
};

const getCountryCode = (country?: string): string | null => {
  const normalizedCountry = country?.trim().toLowerCase();
  if (!normalizedCountry) return null;
  if (normalizedCountry.length === 2 && /^[a-z]{2}$/.test(normalizedCountry)) {
    return normalizedCountry;
  }
  return COUNTRY_CODES[normalizedCountry] ?? null;
};

/**
 * Country Flag Component
 */
function CountryFlag({ country }: { country?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const countryCode = getCountryCode(country);
  const imageUrl = countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : null;

  if (!imageUrl || imageFailed) {
    return <Globe className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <img
      src={imageUrl}
      alt={`${country} flag`}
      className="h-4 w-6 rounded-sm object-cover shadow-sm"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

/**
 * Group regions by country
 */
function groupRegionsByCountry(regions: RegionOption[]): Record<string, RegionOption[]> {
  const groups: Record<string, RegionOption[]> = {};

  for (const region of regions) {
    const country = region.country || 'Other';
    if (!groups[country]) {
      groups[country] = [];
    }
    groups[country].push(region);
  }

  return groups;
}

interface RegionMultiSelectProps {
  regions: RegionOption[];
  selectedRegionIds: string[];
  onRegionToggle: (regionId: string) => void;
  onClearAll: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * RegionMultiSelect Component
 *
 * Multi-select dropdown for filtering by region.
 *
 * Features:
 * - Regions grouped by country with flags
 * - Checkboxes for multi-selection
 * - Search by region name or country
 * - "All regions" button to clear selection
 * - Selected regions shown as badges
 */
export function RegionMultiSelect({
  regions,
  selectedRegionIds,
  onRegionToggle,
  onClearAll,
  loading = false,
  disabled = false,
  className,
}: RegionMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Group regions by country
  const groupedRegions = useMemo(() => {
    return groupRegionsByCountry(regions);
  }, [regions]);

  // Order countries: priority first, then alphabetical
  const countryOrder = useMemo(() => {
    const priorityCountries = ['United States', 'Germany', 'United Kingdom', 'Japan', 'Canada', 'Singapore'];
    const allCountries = Object.keys(groupedRegions);

    return [
      ...priorityCountries.filter(c => allCountries.includes(c)),
      ...allCountries.filter(c => !priorityCountries.includes(c)).sort(),
    ];
  }, [groupedRegions]);

  // Filter by search query
  const filteredGroupedRegions = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedRegions;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, RegionOption[]> = {};

    for (const [country, regions] of Object.entries(groupedRegions)) {
      const matching = regions.filter(
        (r) =>
          r.label.toLowerCase().includes(query) ||
          r.country?.toLowerCase().includes(query) ||
          country.toLowerCase().includes(query)
      );

      if (matching.length > 0) {
        filtered[country] = matching;
      }
    }

    return filtered;
  }, [groupedRegions, searchQuery]);

  // Get selected regions for display
  const selectedRegions = useMemo(() => {
    return regions.filter((r) => selectedRegionIds.includes(r.id));
  }, [regions, selectedRegionIds]);

  // Trigger button content
  const triggerContent =
    selectedRegionIds.length === 0
      ? 'All regions'
      : selectedRegionIds.length === 1
        ? '1 region'
        : `${selectedRegionIds.length} regions`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className="truncate">{triggerContent}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="max-h-80 overflow-y-auto">
            {/* Search Input */}
            <div className="p-3 border-b sticky top-0 bg-background z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search regions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Clear All Button */}
            {selectedRegionIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors border-b border-border"
              >
                <X className="h-4 w-4 text-muted-foreground" />
                <span>Show all regions</span>
              </button>
            )}

            {/* Region Groups */}
            {countryOrder.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No regions found matching "{searchQuery}"
              </div>
            ) : (
              countryOrder.map((country) => {
                const countryRegions = filteredGroupedRegions[country];
                if (!countryRegions || countryRegions.length === 0) return null;

                return (
                  <div key={country} className="border-b border-border last:border-b-0">
                    {/* Country Header */}
                    <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
                      <CountryFlag country={country} />
                      <span className="text-xs font-medium">{country}</span>
                      <span className="text-xs text-muted-foreground">({countryRegions.length})</span>
                    </div>

                    {/* Region Items */}
                    {countryRegions.map((region) => {
                      const isSelected = selectedRegionIds.includes(region.id);

                      return (
                        <button
                          key={region.id}
                          type="button"
                          onClick={() => onRegionToggle(region.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors",
                            isSelected && "bg-primary/10"
                          )}
                        >
                          <div className="flex-shrink-0">
                            <div className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-border bg-background"
                            )}>
                              {isSelected && (
                                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{region.label}</div>
                            {region.id !== region.label && (
                              <div className="text-xs text-muted-foreground truncate">{region.id}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default RegionMultiSelect;
