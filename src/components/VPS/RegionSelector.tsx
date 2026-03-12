/**
 * RegionSelector Component
 * Allows users to select a datacenter region for VPS deployment
 */

import React, { useEffect, useMemo, useState } from "react";
import { Globe, MapPin } from "lucide-react";

import { SearchableOptionSelect } from "@/components/VPS/SearchableOptionSelect";
import type { ProviderRegion } from "@/types/vps";

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
  // Asia
  india: "in",
  japan: "jp",
  singapore: "sg",
  indonesia: "id",
  // Oceania
  australia: "au",
};

const getCountryCode = (country?: string): string | null => {
  const normalizedCountry = country?.trim().toLowerCase();
  if (!normalizedCountry) return null;
  
  // If it's already a 2-letter ISO code, return it directly
  if (normalizedCountry.length === 2 && /^[a-z]{2}$/.test(normalizedCountry)) {
    return normalizedCountry;
  }
  
  // Otherwise, look it up in the COUNTRY_CODES dictionary
  return COUNTRY_CODES[normalizedCountry] ?? null;
};

const getRegionMeta = (region?: ProviderRegion): string => {
  if (!region) {
    return "Select the datacenter location for this server.";
  }

  const parts = [region.country].filter(Boolean);
  if (region.status && region.status !== "ok") {
    parts.push(region.status.toUpperCase());
  }

  return parts.join(" • ") || "Available region";
};

const CountryIcon: React.FC<{ country?: string; label?: string }> = ({
  country,
  label,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const countryCode = useMemo(() => getCountryCode(country), [country]);
  const imageUrl = countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : null;
  const altText = `${country || label || "Region"} region icon`;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

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
};

interface RegionSelectorProps {
  providerId: string;
  selectedRegion: string;
  onSelect: (regionId: string) => void;
  token: string;
  disabled?: boolean;
  filterByCapabilities?: string[];
  typeClass?: string; // VPS plan type_class to filter regions by available plans
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  providerId,
  selectedRegion,
  onSelect,
  token,
  disabled = false,
  filterByCapabilities,
  typeClass,
}) => {
  const [regions, setRegions] = useState<ProviderRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter regions by capabilities if specified
  const filteredRegions = useMemo(() => {
    if (!filterByCapabilities || filterByCapabilities.length === 0) {
      return regions;
    }
    return regions.filter((region) =>
      filterByCapabilities.every((cap) => region.capabilities?.includes(cap)),
    );
  }, [regions, filterByCapabilities]);

  const selectedRegionDetails = useMemo(
    () => filteredRegions.find((region) => region.id === selectedRegion),
    [filteredRegions, selectedRegion],
  );

  const regionOptions = useMemo(
    () =>
      filteredRegions.map((region) => ({
        value: region.id,
        label: region.label,
        description: getRegionMeta(region),
        keywords: [region.country, ...(region.capabilities || [])].filter(Boolean),
        icon: <CountryIcon country={region.country} label={region.label} />,
      })),
    [filteredRegions],
  );

  useEffect(() => {
    const fetchRegions = async () => {
      if (!providerId) {
        setRegions([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build URL with type_class query parameter if provided
        const url = typeClass
          ? `/api/vps/providers/${providerId}/regions?type_class=${encodeURIComponent(typeClass)}`
          : `/api/vps/providers/${providerId}/regions`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch regions");
        }

        setRegions(data.regions || []);
      } catch (err: any) {
        console.error("Failed to fetch regions:", err);
        setError(err.message || "Failed to load regions");
        setRegions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, [providerId, token, typeClass]);

  const emptyMessage =
    filterByCapabilities && filterByCapabilities.length > 0
      ? `No regions available with the required capabilities: ${filterByCapabilities.join(", ")}.`
      : "No regions available for this provider.";

  const helperText = error
    ? error
    : selectedRegionDetails
      ? `Selected region: ${selectedRegionDetails.label}`
      : "Choose the closest datacenter for the best latency and availability.";

  return (
    <SearchableOptionSelect
      value={selectedRegion}
      options={regionOptions}
      onChange={onSelect}
      placeholder="Choose a region"
      searchPlaceholder="Search regions by city or country..."
      emptyMessage={emptyMessage}
      helperText={helperText}
      loading={loading}
      loadingMessage="Loading regions..."
      error={error}
      disabled={disabled}
      ariaLabel="Region selector"
      triggerIcon={<MapPin className="h-4 w-4 text-muted-foreground" />}
      triggerClassName="rounded-xl"
    />
  );
};
