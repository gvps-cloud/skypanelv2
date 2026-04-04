/**
 * LeafletMap Component
 * Interactive world map with clustering markers for regions
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "@/hooks/useTheme";
import { getRegionLatLng } from "@/lib/regionCoordinates";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Region {
  id: string;
  label: string;
  site_type: string;
  status: string;
  country: string;
  speedTestUrl?: string;
}

interface LatencyState {
  [regionId: string]: {
    loading: boolean;
    latency?: number;
    error?: boolean;
    avg?: number;
    min?: number;
    max?: number;
  };
}

interface LeafletMapProps {
  regions: Region[];
  latencyState: LatencyState;
  selectedRegion: string | null;
  onRegionClick: (regionId: string) => void;
  onRegionTest: (regionId: string, speedTestUrl: string) => void;
}

// Helper to get country code from region ID
function getCountryCode(regionId: string): string {
  const mapping: Record<string, string> = {
    "us-east": "us", "us-west": "us", "us-central": "us", "us-southeast": "us",
    "us-ord": "us", "us-lax": "us", "us-mia": "us", "us-sea": "us", "us-iad": "us",
    "us-east-1": "us", "us-west-2": "us", "us-central-1": "us",
    "ca-central": "ca", "ca-east": "ca",
    "br-gru": "br", "sa-east-1": "br",
    "eu-west": "gb", "eu-central": "de", "eu-west-1": "gb", "eu-central-1": "de",
    "nl-ams": "nl", "nl-ams-2": "nl",
    "de-fra": "de", "de-fra-2": "de",
    "gb-lon": "gb", "gb-lhr": "gb",
    "es-mad": "es", "it-mil": "it",
    "fr-par": "fr", "fr-par-2": "fr",
    "se-sto": "se", "pl-waw": "pl",
    "ap-south": "in", "ap-northeast": "jp", "ap-southeast": "sg", "ap-west": "in",
    "ap-south-1": "in", "ap-northeast-1": "jp", "ap-southeast-1": "sg",
    "in-maa": "in", "in-bom": "in", "in-bom-2": "in",
    "jp-tyo": "jp", "jp-tyo-2": "jp", "jp-tyo-3": "jp", "jp-osa": "jp",
    "sg-sin": "sg", "sg-sin-2": "sg",
    "id-cgk": "id",
    "au-mel": "au", "au-syd": "au", "au-east": "au",
    "kr-seoul": "kr",
    "hk-hkg": "hk",
    "tw-tpe": "tw",
  };
  return mapping[regionId] || "unknown";
}

// Get color based on latency
function getMarkerColor(state: LatencyState[string]): string {
  let color = "#6366f1"; // indigo default
  if (state.loading) color = "#3b82f6"; // blue
  else if (state.error) color = "#ef4444"; // red
  else if (state.latency !== undefined) {
    if (state.latency < 100) color = "#22c55e"; // green
    else if (state.latency < 200) color = "#eab308"; // yellow
    else if (state.latency < 300) color = "#f97316"; // orange
    else color = "#ef4444"; // red
  }
  return color;
}

// Create custom icon for a region marker
function createRegionIcon(regionId: string, state: LatencyState[string]): L.DivIcon {
  const color = getMarkerColor(state);
  const countryCode = getCountryCode(regionId);

  const html = `
    <div class="region-marker" style="
      width: 44px;
      height: 56px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      <div style="
        width: 36px;
        height: 36px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        border: 2px solid ${color};
        overflow: hidden;
      ">
        <img
          src="https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg"
          alt="${countryCode}"
          style="width: 28px; height: 28px;"
          onerror="this.style.display='none'"
        />
      </div>
      <div style="
        background: ${color};
        color: ${color === "#eab308" ? "black" : "white"};
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 8px;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      ">
        ${state.loading ? "..." : state.error ? "!" : state.latency !== undefined ? `${state.latency}ms` : "—"}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-region-marker",
    iconSize: L.point(44, 56),
    iconAnchor: L.point(22, 56),
    popupAnchor: L.point(0, -56),
  });
}

// Custom hook to handle map fly-to animations
function FlyToRegion({ selectedRegion }: { selectedRegion: string | null }) {
  const map = useMap();
  const prevRegionRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedRegion && selectedRegion !== prevRegionRef.current) {
      const coords = getRegionLatLng(selectedRegion);
      if (coords) {
        map.flyTo(coords, 6, {
          duration: 1.5,
        });
      }
      prevRegionRef.current = selectedRegion;
    }
  }, [selectedRegion, map]);

  return null;
}

// Region markers layer with clustering
function RegionMarkersLayer({ regions, latencyState, onRegionClick }: LeafletMapProps) {
  const map = useMap();

  useEffect(() => {
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && !(layer as any)._isCluster) {
        map.removeLayer(layer);
      }
    });

    // Add markers using MarkerClusterGroup approach
    const markers: L.Marker[] = [];

    regions.forEach((region) => {
      const coords = getRegionLatLng(region.id);
      if (!coords) return;

      const state = latencyState[region.id] ?? { loading: false, error: false };
      const icon = createRegionIcon(region.id, state);

      const marker = L.marker(coords as L.LatLngTuple, {
        icon,
        latency: state.latency,
      } as any);

      // Create popup content as HTML string
      const popupContent = createPopupContent(region, state);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: "region-popup",
      });

      marker.on("click", () => {
        onRegionClick(region.id);
      });

      markers.push(marker);
    });

    // Create a feature group for all markers
    const featureGroup = L.featureGroup(markers);
    featureGroup.addTo(map);

    return () => {
      featureGroup.remove();
    };
  }, [regions, latencyState, map, onRegionClick]);

  return null;
}

// Create popup HTML content
function createPopupContent(
  region: Region,
  state: LatencyState[string]
): string {
  const countryCode = getCountryCode(region.id);
  const latency = state.latency;
  const loading = state.loading;
  const error = state.error;
  const minLatency = state.min;
  const maxLatency = state.max;

  let color = "#6366f1";
  if (loading) color = "#3b82f6";
  else if (error) color = "#ef4444";
  else if (latency !== undefined) {
    if (latency < 100) color = "#22c55e";
    else if (latency < 200) color = "#eab308";
    else if (latency < 300) color = "#f97316";
    else color = "#ef4444";
  }

  const countryNames: Record<string, string> = {
    us: "United States", ca: "Canada", br: "Brazil",
    gb: "United Kingdom", nl: "Netherlands", de: "Germany",
    es: "Spain", it: "Italy", fr: "France", se: "Sweden", pl: "Poland",
    in: "India", jp: "Japan", sg: "Singapore", id: "Indonesia",
    au: "Australia", kr: "South Korea", hk: "Hong Kong", tw: "Taiwan",
  };

  return `
    <div style="width: 260px; padding: 16px; font-family: inherit;">
      <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
        <img
          src="https://flagcdn.com/w40/${countryCode}.png"
          alt="${countryCode}"
          style="width: 40px; height: 27px; border-radius: 4px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
          onerror="this.style.display='none'"
        />
        <div style="flex: 1; min-width: 0;">
          <h3 style="font-weight: 700; font-size: 15px; margin: 0; color: #0f172a;">
            ${region.label}
          </h3>
          <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">
            ${countryNames[countryCode] || region.country}
          </p>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: #f1f5f9; color: #475569;">
          ${region.site_type || "Datacenter"}
        </span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; ${
          region.status === "ok"
            ? "background: #dcfce7; color: #16a34a;"
            : "background: #fef9c3; color: #ca8a04;"
        }">
          ${region.status || "Unknown"}
        </span>
      </div>

      <div style="background: ${color}15; border: 1px solid ${color}30; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; color: #64748b;">Latency</span>
          ${loading ? '<span style="animation: spin 1s linear infinite;">&#9696;</span>' : ""}
          ${error ? '<span style="color: #ef4444;">&#9888;</span>' : ""}
        </div>

        ${
          loading
            ? `<div style="text-align: center; padding: 8px 0;">
                <span style="font-size: 18px; font-weight: 700; color: #3b82f6;">Testing...</span>
               </div>`
            : error
            ? `<div style="text-align: center; padding: 8px 0;">
                <span style="font-size: 14px; color: #ef4444;">Test failed</span>
               </div>`
            : latency !== undefined
            ? `<div style="text-align: center; margin-bottom: 8px;">
                <span style="font-size: 28px; font-weight: 700; color: ${color};">${latency}</span>
                <span style="font-size: 14px; color: #64748b; margin-left: 2px;">ms</span>
               </div>
               ${
                 minLatency !== undefined || maxLatency !== undefined
                   ? `<div style="display: flex; justify-content: center; gap: 16px; font-size: 12px;">
                       ${minLatency !== undefined ? `<span style="color: #22c55e;">&#9660; ${minLatency}ms</span>` : ""}
                       ${maxLatency !== undefined ? `<span style="color: #ef4444;">&#9650; ${maxLatency}ms</span>` : ""}
                     </div>`
                   : ""
               }`
            : `<div style="text-align: center; padding: 8px 0;">
                <span style="font-size: 14px; color: #64748b;">Not tested</span>
               </div>`
        }
      </div>
    </div>
  `;
}

export function LeafletMap(props: LeafletMapProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // CartoDB tile URLs
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100%", width: "100%" }}
      className="leaflet-map-container"
      zoomControl={true}
      scrollWheelZoom={true}
      attributionControl={true}
    >
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        maxZoom={19}
      />
      <FlyToRegion selectedRegion={props.selectedRegion} />
      <RegionMarkersLayer {...props} />
    </MapContainer>
  );
}

export default LeafletMap;
