/**
 * RegionSelector Component
 * Allows users to select a datacenter region for VPS deployment
 */

import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Globe } from "lucide-react";

import { SearchableOptionSelect } from "@/components/VPS/SearchableOptionSelect";
import { apiClient } from "@/lib/api";
import type { ProviderRegion } from "@/types/vps";
import { countryToCode } from "@/components/regions/countryFlags";

function CountryIcon({ country, label }: { country?: string; label: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const code = country ? countryToCode(country) : null;
  if (!code || imageFailed) {
    return <Globe className="h-4 w-4 text-muted-foreground" />;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`${label} flag`}
      className="h-4 w-6 object-contain flex-shrink-0"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

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

export { CountryIcon };

interface RegionSelectorProps {
  providerId: string;
  selectedRegion: string;
  onSelect: (regionId: string) => void;
  disabled?: boolean;
  filterByCapabilities?: string[];
  typeClass?: string; // VPS plan type_class to filter regions by available plans
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  providerId,
  selectedRegion,
  onSelect,
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
        keywords: [region.country].filter(Boolean) as string[],
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

        const data = await apiClient.get<{ regions?: ProviderRegion[] }>(url);

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
  }, [providerId, typeClass]);

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
