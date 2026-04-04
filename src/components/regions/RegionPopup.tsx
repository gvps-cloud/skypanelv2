/**
 * RegionPopup Component
 * Popup content for Leaflet markers showing region details
 */

import React, { useState } from "react";
import { Wifi, Loader2, AlertCircle, TrendingUp, TrendingDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRY_NAMES, REGION_TO_COUNTRY } from "./RegionMarker";

interface RegionPopupProps {
  regionId: string;
  regionLabel: string;
  country?: string;
  siteType?: string;
  status?: string;
  latency?: number;
  minLatency?: number;
  maxLatency?: number;
  loading?: boolean;
  error?: boolean;
  onTest?: () => void;
}

const FlagIcon: React.FC<{ countryCode: string; size?: number }> = ({ countryCode, size = 24 }) => {
  const [failed, setFailed] = useState(false);
  const imageUrl = `https://flagcdn.com/w${Math.floor(size / 2)}/${countryCode}.png`;

  if (failed) {
    return <MapPin className="text-muted-foreground" style={{ width: size, height: size * 0.75 }} />;
  }

  return (
    <img
      src={imageUrl}
      alt={`${countryCode} flag`}
      className="rounded-sm object-cover shadow-sm"
      style={{ width: size * 1.2, height: size * 0.8 }}
      onError={() => setFailed(true)}
    />
  );
};

const getLatencyColor = (latency: number | undefined, loading: boolean, error: boolean): { bg: string; text: string } => {
  if (loading) return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" };
  if (error) return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" };
  if (latency !== undefined) {
    if (latency < 100) return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" };
    if (latency < 200) return { bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400" };
    if (latency < 300) return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" };
    return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" };
  }
  return { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400" };
};

export const RegionPopup: React.FC<RegionPopupProps> = ({
  regionId,
  regionLabel,
  country,
  siteType,
  status,
  latency,
  minLatency,
  maxLatency,
  loading = false,
  error = false,
  onTest,
}) => {
  const countryCode = REGION_TO_COUNTRY[regionId] || (country?.toLowerCase().substring(0, 2));
  const countryName = countryCode ? COUNTRY_NAMES[countryCode] || country : country;
  const colors = getLatencyColor(latency, loading, error);

  return (
    <div className="w-64 p-4 rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      {/* Header with flag and region name */}
      <div className="flex items-start gap-3 mb-3">
        {countryCode && (
          <div className="flex-shrink-0 mt-0.5">
            <FlagIcon countryCode={countryCode} size={28} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
            {regionLabel}
          </h3>
          <p className="text-xs text-muted-foreground">{countryName}</p>
        </div>
      </div>

      {/* Status and type */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {siteType || "Datacenter"}
        </span>
        <span className={`px-2 py-0.5 rounded-full ${
          status === "ok"
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
        }`}>
          {status || "Unknown"}
        </span>
      </div>

      {/* Latency section */}
      <div className={`rounded-lg p-3 mb-3 ${colors.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Latency</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
          {error && <AlertCircle className="h-3 w-3 text-red-500" />}
        </div>

        {loading ? (
          <div className="text-center py-2">
            <span className={`text-lg font-bold ${colors.text}`}>Testing...</span>
          </div>
        ) : error ? (
          <div className="text-center py-2">
            <span className="text-sm text-red-600 dark:text-red-400">Test failed</span>
          </div>
        ) : latency !== undefined ? (
          <>
            <div className="text-center mb-2">
              <span className={`text-2xl font-bold ${colors.text}`}>{latency}</span>
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            {(minLatency !== undefined || maxLatency !== undefined) && (
              <div className="flex items-center justify-center gap-4 text-xs">
                {minLatency !== undefined && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <TrendingDown className="h-3 w-3" />
                    <span>{minLatency}ms</span>
                  </div>
                )}
                {maxLatency !== undefined && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>{maxLatency}ms</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-2">
            <span className="text-sm text-muted-foreground">Not tested</span>
          </div>
        )}
      </div>

      {/* Test button */}
      {onTest && (
        <Button
          size="sm"
          className="w-full"
          onClick={onTest}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Wifi className="mr-2 h-3.5 w-3.5" />
              Run Latency Test
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default RegionPopup;
