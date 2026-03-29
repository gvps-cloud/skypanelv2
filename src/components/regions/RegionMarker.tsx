/**
 * RegionMarker Component
 * Renders a map marker with country flag and region info card
 */

import React, { useState, useMemo } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

// Country code mapping for regions
export const REGION_TO_COUNTRY: Record<string, string> = {
  // Americas
  "us-east": "us",
  "us-west": "us",
  "us-central": "us",
  "us-southeast": "us",
  "us-ord": "us",
  "us-lax": "us",
  "us-mia": "us",
  "us-sea": "us",
  "us-iad": "us",
  "us-east-1": "us",
  "us-west-2": "us",
  "us-central-1": "us",
  "ca-central": "ca",
  "ca-east": "ca",
  "br-gru": "br",
  "sa-east-1": "br",
  // Europe
  "eu-west": "gb",
  "eu-central": "de",
  "eu-west-1": "gb",
  "eu-central-1": "de",
  "nl-ams": "nl",
  "nl-ams-2": "nl",
  "de-fra": "de",
  "de-fra-2": "de",
  "gb-lon": "gb",
  "gb-lhr": "gb",
  "es-mad": "es",
  "it-mil": "it",
  "fr-par": "fr",
  "fr-par-2": "fr",
  "se-sto": "se",
  "pl-waw": "pl",
  // Asia-Pacific
  "ap-south": "in",
  "ap-northeast": "jp",
  "ap-southeast": "sg",
  "ap-west": "in",
  "ap-south-1": "in",
  "ap-northeast-1": "jp",
  "ap-southeast-1": "sg",
  "in-maa": "in",
  "in-bom": "in",
  "in-bom-2": "in",
  "jp-tyo": "jp",
  "jp-tyo-2": "jp",
  "jp-tyo-3": "jp",
  "jp-osa": "jp",
  "sg-sin": "sg",
  "sg-sin-2": "sg",
  "id-cgk": "id",
  "au-mel": "au",
  "au-syd": "au",
  "au-east": "au",
  "kr-seoul": "kr",
  "hk-hkg": "hk",
  "tw-tpe": "tw",
};

// Country names for display
export const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  ca: "Canada",
  br: "Brazil",
  gb: "United Kingdom",
  nl: "Netherlands",
  de: "Germany",
  es: "Spain",
  it: "Italy",
  fr: "France",
  se: "Sweden",
  pl: "Poland",
  in: "India",
  jp: "Japan",
  sg: "Singapore",
  id: "Indonesia",
  au: "Australia",
  kr: "South Korea",
  hk: "Hong Kong",
  tw: "Taiwan",
};

interface RegionMarkerProps {
  regionId: string;
  regionLabel: string;
  country?: string;
  latency?: number;
  minLatency?: number;
  maxLatency?: number;
  loading?: boolean;
  error?: boolean;
  isSelected?: boolean;
  isSpiderfied?: boolean;
  spiderAngle?: number;
  spiderRadius?: number;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  size?: "sm" | "md" | "lg";
}

const getLatencyColor = (latency: number | undefined, loading: boolean, error: boolean): string => {
  if (loading) return "bg-blue-500";
  if (error) return "bg-red-500";
  if (latency !== undefined) {
    if (latency < 100) return "bg-green-500";
    if (latency < 200) return "bg-yellow-500";
    if (latency < 300) return "bg-orange-500";
    return "bg-red-500";
  }
  return "bg-indigo-500";
};

const getLatencyTextColor = (latency: number | undefined): string => {
  if (latency === undefined) return "text-white";
  if (latency >= 100 && latency < 200) return "text-black";
  return "text-white";
};

export const CountryFlag: React.FC<{ countryCode: string; size?: number; className?: string }> = ({
  countryCode,
  size = 24,
  className = "",
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  
  // Use circle-flags which works reliably in SVG foreignObject
  const imageUrl = `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`;

  if (imageFailed) {
    return <MapPin className={`text-muted-foreground ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={imageUrl}
      alt={`${countryCode} flag`}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size, display: "block" }}
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
};

export const RegionMarker: React.FC<RegionMarkerProps> = ({
  regionId,
  regionLabel,
  country,
  latency,
  minLatency,
  maxLatency,
  loading = false,
  error = false,
  isSelected = false,
  isSpiderfied = false,
  spiderAngle = 0,
  spiderRadius = 0,
  onClick,
  onHover,
  size = "md",
}) => {
  const countryCode = REGION_TO_COUNTRY[regionId] || (country?.toLowerCase().substring(0, 2));
  const countryName = countryCode ? COUNTRY_NAMES[countryCode] || country : country;
  
  const sizeConfig = {
    sm: { flag: 16, padding: "p-1", text: "text-[7px]", badge: "text-[6px] px-1" },
    md: { flag: 20, padding: "p-1.5", text: "text-[9px]", badge: "text-[7px] px-1.5" },
    lg: { flag: 24, padding: "p-2", text: "text-[10px]", badge: "text-[8px] px-2" },
  };

  const config = sizeConfig[size];
  const latencyColor = getLatencyColor(latency, loading, error);
  const latencyTextColor = getLatencyTextColor(latency);

  // Calculate spider position if needed
  const spiderTransform = isSpiderfied && spiderRadius > 0
    ? `translate(${Math.cos(spiderAngle) * spiderRadius}, ${Math.sin(spiderAngle) * spiderRadius})`
    : "";

  return (
    <g
      transform={spiderTransform}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{ cursor: "pointer", transition: "transform 0.3s ease-out" }}
    >
      {/* Card background with foreignObject for HTML content */}
      <foreignObject
        x={isSelected ? -45 : -35}
        y={isSelected ? -28 : -22}
        width={isSelected ? 90 : 70}
        height={isSelected ? 56 : 44}
        style={{ overflow: "visible" }}
      >
        <div
          className={`
            ${config.padding} rounded-lg shadow-lg
            bg-white dark:bg-slate-800
            border border-slate-200 dark:border-slate-700
            flex flex-col items-center justify-center gap-0.5
            transition-all duration-200
            ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""}
            hover:shadow-xl
          `}
          style={{ pointerEvents: "auto" }}
        >
          {/* Flag */}
          {countryCode && (
            <div className="flex-shrink-0">
              <CountryFlag countryCode={countryCode} size={config.flag} />
            </div>
          )}
          
          {/* Region ID */}
          <span className={`${config.text} font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight`}>
            {regionId}
          </span>
          
          {/* Latency badge */}
          <div className={`${config.badge} ${latencyColor} ${latencyTextColor} rounded-full font-bold flex items-center gap-0.5`}>
            {loading ? (
              <span>...</span>
            ) : error ? (
              <span>!</span>
            ) : latency !== undefined ? (
              <span>{latency}ms</span>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export default RegionMarker;
