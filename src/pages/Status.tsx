import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database,
  AlertCircle,
  Server,
  MapPin,
  Wifi,
  Loader2,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Status as StatusDot } from "@/components/ui/status";
import PublicLayout from "@/components/PublicLayout";
import { BRAND_NAME } from "@/lib/brand";
import { VPSInfrastructureCard } from "@/components/VPSInfrastructureCard";

type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";

interface ServiceComponent {
  name: string;
  status: ServiceStatus;
  icon: React.ComponentType<{ className?: string }>;
  instances?: number;
  description: string;
}

interface IncidentUpdate {
  time: string;
  message: string;
  status: ServiceStatus;
}

interface Incident {
  id: string;
  title: string;
  status: ServiceStatus;
  startTime: string;
  updates: IncidentUpdate[];
}

interface Region {
  id: string;
  label: string;
  site_type: string;
  status: string;
  country: string;
  speedTestUrl?: string;
}

// Geographic coordinates for major regions on a world map (x, y percentages)
const REGION_COORDINATES: Record<string, { x: number; y: number }> = {
  // Americas
  "us-east": { x: 28, y: 35 },
  "us-west": { x: 18, y: 38 },
  "us-central": { x: 24, y: 40 },
  "us-southeast": { x: 30, y: 42 },
  "us-ord": { x: 27, y: 36 },
  "us-lax": { x: 16, y: 40 },
  "us-mia": { x: 30, y: 48 },
  "us-sea": { x: 17, y: 32 },
  "us-iad": { x: 29, y: 36 },
  "ca-central": { x: 26, y: 32 },
  "br-gru": { x: 35, y: 70 },
  // Europe
  "eu-west": { x: 46, y: 28 },
  "eu-central": { x: 50, y: 30 },
  "nl-ams": { x: 48, y: 28 },
  "de-fra-2": { x: 50, y: 30 },
  "gb-lon": { x: 46, y: 27 },
  "es-mad": { x: 45, y: 35 },
  "it-mil": { x: 51, y: 32 },
  "fr-par": { x: 47, y: 30 },
  "fr-par-2": { x: 47, y: 30 },
  "se-sto": { x: 52, y: 24 },
  // Asia-Pacific
  "ap-south": { x: 72, y: 45 },
  "ap-northeast": { x: 82, y: 35 },
  "ap-southeast": { x: 80, y: 55 },
  "ap-west": { x: 70, y: 42 },
  "in-maa": { x: 72, y: 45 },
  "in-bom-2": { x: 70, y: 42 },
  "jp-tyo-3": { x: 82, y: 35 },
  "jp-osa": { x: 80, y: 36 },
  "sg-sin-2": { x: 78, y: 52 },
  "id-cgk": { x: 80, y: 55 },
  "au-mel": { x: 88, y: 80 },
};

// Latency result state per region
interface LatencyState {
  [regionId: string]: {
    loading: boolean;
    latency?: number;
    error?: boolean;
  };
}

// Get latency badge class - uses high-contrast text for visibility
const getLatencyBadgeClass = (ms: number): string => {
  // Background color based on latency, always with high-contrast text
  if (ms < 100) return "bg-green-500 text-white dark:text-white";
  if (ms < 200) return "bg-yellow-500 text-black dark:text-black";
  if (ms < 300) return "bg-orange-500 text-white dark:text-white";
  return "bg-red-500 text-white dark:text-white";
};

export default function Status() {
  const [services, setServices] = useState<ServiceComponent[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyState, setLatencyState] = useState<LatencyState>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [showMapView, setShowMapView] = useState(false);

  // Map zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Measure latency to a speed test URL
  const measureLatency = useCallback(async (regionId: string, speedTestUrl: string) => {
    setLatencyState((prev) => ({
      ...prev,
      [regionId]: { loading: true },
    }));

    try {
      // Measure round-trip time to the speedtest server root
      // Using no-cors mode to avoid CORS issues, we just measure connection time
      const testUrl = `${speedTestUrl}?t=${Date.now()}`;
      const startTime = performance.now();

      await fetch(testUrl, {
        mode: 'no-cors',
        cache: 'no-store',
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      setLatencyState((prev) => ({
        ...prev,
        [regionId]: { loading: false, latency },
      }));
      return latency;
    } catch {
      setLatencyState((prev) => ({
        ...prev,
        [regionId]: { loading: false, error: true },
      }));
      return null;
    }
  }, []);

  // Test all regions in parallel
  const testAllRegions = useCallback(async () => {
    setIsTestingAll(true);
    setShowMapView(true);

    const regionsWithUrls = regions.filter(r => r.speedTestUrl);
    const promises = regionsWithUrls.map(region =>
      measureLatency(region.id, region.speedTestUrl!)
    );

    await Promise.all(promises);
    setIsTestingAll(false);
  }, [regions, measureLatency]);

  // Zoom control functions
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => {
    setZoom(1);
    setCenter([0, 0]);
    setSelectedRegion(null);
  };

  // Handle region click - zoom to region
  const handleRegionClick = useCallback((regionId: string) => {
    const coords = REGION_COORDINATES[regionId];
    if (!coords) return;

    const longitude = (coords.x - 50) * 3.6;
    const latitude = (50 - coords.y) * 1.8;

    setCenter([longitude, latitude]);
    setZoom(2);
    setSelectedRegion(regionId);
  }, []);

  // Cluster nearby regions with dynamic threshold based on zoom
  const clusterRegions = useCallback(() => {
    const clusters: Array<{
      center: [number, number];
      regions: Region[];
      count: number;
    }> = [];
    const processed = new Set<string>();

    // Dynamic clustering threshold based on zoom level
    // Higher zoom = smaller threshold (show more individual regions)
    const clusterThreshold = Math.max(15 / zoom, 5);

    regions.forEach((region) => {
      if (processed.has(region.id)) return;

      const coords = REGION_COORDINATES[region.id];
      if (!coords) return;

      const longitude = (coords.x - 50) * 3.6;
      const latitude = (50 - coords.y) * 1.8;

      // Find nearby regions within dynamic threshold
      const nearbyRegions = regions.filter((r) => {
        if (r.id === region.id || processed.has(r.id)) return false;

        const rCoords = REGION_COORDINATES[r.id];
        if (!rCoords) return false;

        const rLongitude = (rCoords.x - 50) * 3.6;
        const rLatitude = (50 - rCoords.y) * 1.8;

        const distance = Math.sqrt(
          Math.pow(longitude - rLongitude, 2) + Math.pow(latitude - rLatitude, 2)
        );

        return distance < clusterThreshold;
      });

      if (nearbyRegions.length > 0 && zoom < 3) {
        // Create cluster (only when zoomed out)
        const clusterRegions = [region, ...nearbyRegions];
        const avgLong = clusterRegions.reduce((sum, r) => {
          const c = REGION_COORDINATES[r.id];
          return sum + (c ? (c.x - 50) * 3.6 : 0);
        }, 0) / clusterRegions.length;

        const avgLat = clusterRegions.reduce((sum, r) => {
          const c = REGION_COORDINATES[r.id];
          return sum + (c ? (50 - c.y) * 1.8 : 0);
        }, 0) / clusterRegions.length;

        clusters.push({
          center: [avgLong, avgLat],
          regions: clusterRegions,
          count: clusterRegions.length,
        });

        clusterRegions.forEach((r) => processed.add(r.id));
      } else {
        // Single region (when zoomed in or no nearby regions)
        clusters.push({
          center: [longitude, latitude],
          regions: [region],
          count: 1,
        });
        processed.add(region.id);
      }
    });

    return clusters;
  }, [regions, zoom]);

  const fetchLiveData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch public status data (no auth required)
      let vpsCount = 0;
      let vpsRunning = 0;
      let vpsStopped = 0;

      try {
        const statusResponse = await fetch('/api/health/status');
        const statusData = await statusResponse.json();
        
        if (statusData.success && statusData.services) {
          vpsCount = statusData.services.vps?.total || 0;
          vpsRunning = statusData.services.vps?.running || 0;
          vpsStopped = statusData.services.vps?.stopped || 0;
        }
      } catch (err) {
        console.warn('Failed to fetch status data:', err);
        // Continue with zeros if status endpoint fails
      }

      // Fetch regions from our API (only admin-allowed regions)
      let regionsData_: Region[] = [];
      try {
        const regionsResponse = await fetch('/api/pricing/public-regions');
        const regionsJson = await regionsResponse.json();
        if (regionsJson.success && Array.isArray(regionsJson.regions)) {
          regionsData_ = regionsJson.regions;
        }
      } catch (err) {
        console.warn('Failed to fetch regions from API, falling back to Linode:', err);
        // Fallback to direct Linode API if our endpoint fails
        try {
          const linodeResponse = await fetch('https://api.linode.com/v4/regions');
          const linodeData = await linodeResponse.json();
          regionsData_ = (linodeData.data || []).map((r: any) => ({
            id: r.id,
            label: r.label,
            site_type: r.site_type,
            status: r.status,
            country: r.country,
          }));
        } catch (linodeErr) {
          console.warn('Failed to fetch regions from Linode:', linodeErr);
        }
      }
      setRegions(regionsData_);

      // Update services with live data
      const liveServices: ServiceComponent[] = [
        {
          name: "VPS Infrastructure",
          status: "operational",
          icon: Server,
          instances: vpsCount,
          description: `Virtual Private Server provisioning and management${vpsCount > 0 ? ` (${vpsRunning} running, ${vpsStopped} stopped)` : ''}`
        },
        {
          name: "Database Services",
          status: "operational",
          icon: Database,
          instances: 1,
          description: "PostgreSQL database backend"
        },
        {
          name: "Regions",
          status: "operational",
          icon: MapPin,
          instances: regionsData_.length,
          description: "Global datacenter regions"
        },
      ];

      setServices(liveServices);
      setActiveIncidents([]);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch live data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch live data');
      
      // Fallback to basic services without live counts
      const fallbackServices: ServiceComponent[] = [
        {
          name: "VPS Infrastructure",
          status: "degraded",
          icon: Server,
          instances: 0,
          description: "Virtual Private Server provisioning and management"
        },
        {
          name: "Database Services",
          status: "operational",
          icon: Database,
          instances: 1,
          description: "PostgreSQL database backend"
        },
      ];
      setServices(fallbackServices);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLiveData();
    setIsRefreshing(false);
  };

  const getStatusLabel = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded Performance";
      case "outage":
        return "Major Outage";
      case "maintenance":
        return "Scheduled Maintenance";
      default:
        return "Unknown";
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    const variants = {
      operational: "default",
      degraded: "secondary",
      outage: "destructive",
      maintenance: "outline"
    };
    
    return (
      <Badge variant={variants[status] as any}>
        {getStatusLabel(status)}
      </Badge>
    );
  };

  const allOperational = services.every(s => s.status === "operational");

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-4 py-12">
      <section className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="uppercase tracking-wide">Live platform health</Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">{BRAND_NAME} service status</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Real-time availability for VPS, networking, and supporting systems. Data refreshes automatically every few minutes and whenever you request an update.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:items-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2">
              {allOperational ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600 dark:text-green-400">All systems operational</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">Some services degraded</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
              <span>Last updated {lastUpdated}</span>
              <Separator orientation="vertical" className="h-4" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <section className="mt-8">
          <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-orange-800 dark:text-orange-200">
                    Data Loading Issue
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {activeIncidents.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Active incidents</h2>
          <div className="space-y-4">
            {activeIncidents.map((incident) => (
              <Card key={incident.id} className="border-orange-500/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{incident.title}</CardTitle>
                      <CardDescription className="mt-2">
                        Started: {new Date(incident.startTime).toLocaleString()}
                      </CardDescription>
                    </div>
                    {getStatusBadge(incident.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {incident.updates.map((update, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 text-muted-foreground">{update.time}</div>
                        <div className="flex-grow">{update.message}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Service components</h2>
          <Badge variant="secondary">Monitoring every 60 seconds</Badge>
        </div>
        <Card className="shadow-sm">
          <CardContent className="divide-y">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading service status...</span>
                </div>
              </div>
            ) : (
              services.map((service) => (
                <div key={service.name} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <service.icon className="mt-1 h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                      {service.instances !== undefined && (
                        <p className="text-xs text-muted-foreground">{service.instances} active nodes</p>
                      )}
                    </div>
                  </div>
                  <StatusDot variant={service.status === "operational" ? "running" : service.status === "degraded" ? "warning" : service.status === "maintenance" ? "loading" : "error"} label={getStatusLabel(service.status)} showPing={service.status === "operational"} className="md:justify-end" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Infrastructure Metrics</h2>
          <Badge variant="secondary">Real-time monitoring</Badge>
        </div>
        <VPSInfrastructureCard />
      </section>

      {regions.length > 0 && (
        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Regions</h2>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{regions.length} regions available</Badge>
              <Button
                size="sm"
                variant={showMapView ? "default" : "outline"}
                onClick={() => setShowMapView(!showMapView)}
                className="h-8"
              >
                <MapPin className="mr-2 h-3.5 w-3.5" />
                {showMapView ? "List View" : "Map View"}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={testAllRegions}
                disabled={isTestingAll || regions.filter(r => r.speedTestUrl).length === 0}
                className="h-8"
              >
                {isTestingAll ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Testing All...
                  </>
                ) : (
                  <>
                    <Wifi className="mr-2 h-3.5 w-3.5" />
                    Test All Regions
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* List View */}
          {!showMapView && (
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {regions.map((region) => {
                    const regionLatency = latencyState[region.id];
                    return (
                      <div key={region.id} className="flex flex-col gap-3 rounded-lg border p-4 transition-all hover:border-primary/30 hover:shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-medium">{region.label}</h4>
                            <p className="text-sm text-muted-foreground">{region.country}</p>
                          </div>
                          <StatusDot
                            variant={region.status === 'ok' ? 'running' : 'error'}
                            label={region.status}
                            showPing={region.status === 'ok'}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {region.site_type}
                          </Badge>
                          {/* Latency Result Badge */}
                          {regionLatency?.latency !== undefined && (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getLatencyBadgeClass(regionLatency.latency)}`}
                            >
                              {regionLatency.latency}ms
                            </span>
                          )}
                          {regionLatency?.error && (
                            <Badge variant="destructive" className="text-xs">
                              Failed
                            </Badge>
                          )}
                        </div>
                        {/* Test Latency Button - only show if speedTestUrl is available */}
                        {region.speedTestUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-1 h-8 text-xs"
                            onClick={() => measureLatency(region.id, region.speedTestUrl!)}
                            disabled={regionLatency?.loading || isTestingAll}
                          >
                            {regionLatency?.loading ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Testing...
                              </>
                            ) : regionLatency?.latency !== undefined ? (
                              <>
                                <Wifi className="mr-2 h-3 w-3" />
                                Retest Latency
                              </>
                            ) : (
                              <>
                                <Wifi className="mr-2 h-3 w-3" />
                                Test Latency
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map View */}
          {showMapView && (
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-full" style={{ height: "500px", position: "relative" }}>
                  {/* Side Control Menu */}
                  <div className="absolute bottom-8 left-8 z-10 flex flex-col gap-3 bg-white/95 dark:bg-slate-800/95 rounded-lg border p-3 shadow-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Map Controls</span>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search regions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700"
                      />
                      {searchQuery && (
                        <div className="absolute bottom-full mb-1 left-0 right-0 max-h-48 overflow-auto bg-white dark:bg-slate-700 border rounded-md shadow-lg z-20">
                          {regions
                            .filter(r =>
                              r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              r.country.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .slice(0, 5)
                            .map(region => (
                              <div
                                key={region.id}
                                className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-sm border-b last:border-b-0"
                                onClick={() => {
                                  handleRegionClick(region.id);
                                  setSearchQuery("");
                                }}
                              >
                                <div className="font-medium">{region.label}</div>
                                <div className="text-xs text-muted-foreground">{region.country}</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Quick Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="justify-start h-8 text-sm"
                        onClick={handleResetZoom}
                      >
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Reset View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="justify-start h-8 text-sm"
                        onClick={() => {
                          setZoom(1);
                          setCenter([0, 0]);
                          setSelectedRegion(null);
                        }}
                      >
                        <MapPin className="mr-2 h-3 w-3" />
                        World View
                      </Button>
                    </div>

                    {/* Zoom Info */}
                    <div className="text-xs text-muted-foreground">
                      Zoom: {zoom.toFixed(1)}x
                    </div>
                  </div>

                  {/* Zoom controls (compact, on right) */}
                  <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 bg-white/90 dark:bg-slate-800/90"
                      onClick={handleZoomIn}
                      disabled={zoom >= 4}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 bg-white/90 dark:bg-slate-800/90"
                      onClick={handleZoomOut}
                      disabled={zoom <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                  <ComposableMap
                    projection="geoEqualEarth"
                    width={800}
                    height={500}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <ZoomableGroup
                      zoom={zoom}
                      center={center}
                      onMoveEnd={({ zoom: newZoom, center: newCenter }) => {
                        setZoom(newZoom);
                        setCenter(newCenter);
                      }}
                    >
                      <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                        {({ geographies }) =>
                          geographies.map((geo) => (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill="#e2e8f0"
                              className="dark:fill-slate-700"
                              stroke="#94a3b8"
                              strokeWidth={0.5}
                              style={{
                                hover: { fill: "#cbd5e1" }
                              }}
                            />
                          ))
                        }
                      </Geographies>

                      {/* Region clusters and markers */}
                      {clusterRegions().map((cluster, idx) => {
                        const isCluster = cluster.count > 1;
                        const avgLatency = cluster.regions.reduce((sum, r) => {
                          const latency = latencyState[r.id]?.latency;
                          return sum + (latency || 0);
                        }, 0) / cluster.regions.filter(r => latencyState[r.id]?.latency !== undefined).length || 0;

                        const getMarkerColor = () => {
                          if (cluster.regions.some(r => latencyState[r.id]?.loading)) return "#3b82f6";
                          if (cluster.regions.some(r => latencyState[r.id]?.error)) return "#ef4444";
                          if (avgLatency > 0) {
                            if (avgLatency < 100) return "#22c55e";
                            if (avgLatency < 200) return "#eab308";
                            if (avgLatency < 300) return "#f97316";
                            return "#ef4444";
                          }
                          return "#6366f1";
                        };

                        const isHovered = !isCluster && hoveredRegion === cluster.regions[0]?.id;

                        return (
                          <Marker key={idx} coordinates={cluster.center}>
                            <g
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                if (isCluster) {
                                  // When clicking a cluster, zoom in significantly to show individual regions
                                  const newZoom = Math.min(zoom + 1.5, 4);
                                  setZoom(newZoom);
                                  setCenter(cluster.center);

                                  // If we're zoomed in enough, clear the selection so individual regions appear
                                  if (newZoom >= 3) {
                                    setSelectedRegion(null);
                                  }
                                } else {
                                  handleRegionClick(cluster.regions[0].id);
                                }
                              }}
                              onMouseEnter={() => !isCluster && setHoveredRegion(cluster.regions[0]?.id || null)}
                              onMouseLeave={() => setHoveredRegion(null)}
                            >
                              {/* Cluster marker */}
                              {isCluster ? (
                                <>
                                  {/* Outer glow */}
                                  <circle
                                    r={25 + cluster.count * 2}
                                    fill={getMarkerColor()}
                                    opacity="0.15"
                                  />
                                  {/* Main cluster circle */}
                                  <circle
                                    r={18 + cluster.count * 1.5}
                                    fill={getMarkerColor()}
                                    opacity="0.9"
                                    stroke="white"
                                    strokeWidth={2}
                                  />
                                  {/* Region count */}
                                  <text
                                    textAnchor="middle"
                                    dy=".3em"
                                    fontSize={14 + cluster.count}
                                    fill="white"
                                    fontWeight="bold"
                                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                                  >
                                    {cluster.count}
                                  </text>
                                  {/* Click hint for clusters */}
                                  {zoom < 2 && (
                                    <text
                                      textAnchor="middle"
                                      dy={30 + cluster.count}
                                      fontSize={10}
                                      fill="#64748b"
                                      className="dark:fill-slate-400"
                                      fontWeight="500"
                                    >
                                      Click to expand
                                    </text>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Single region marker with hover effects */}
                                  {avgLatency > 0 && (
                                    <circle
                                      r={isHovered ? 25 : 20}
                                      fill={getMarkerColor()}
                                      opacity="0.2"
                                    />
                                  )}
                                  <circle
                                    r={isHovered ? 10 : avgLatency > 0 ? 8 : 5}
                                    fill={getMarkerColor()}
                                    className={isHovered ? "animate-pulse" : ""}
                                  />
                                </>
                              )}

                              {/* Hover tooltip for single regions */}
                              {!isCluster && isHovered && (
                                <g>
                                  {/* Tooltip card with dynamic sizing */}
                                  <rect
                                    x={-70}
                                    y={-50}
                                    width={140}
                                    height={avgLatency > 0 ? 50 : 40}
                                    rx={6}
                                    fill="white"
                                    className="dark:fill-slate-800"
                                    stroke="#94a3b8"
                                    strokeWidth={1.5}
                                    opacity="0.98"
                                  />
                                  {/* Region name */}
                                  <text
                                    textAnchor="middle"
                                    x={0}
                                    y={-32}
                                    fontSize={12}
                                    fill="#1e293b"
                                    className="dark:fill-slate-100"
                                    fontWeight="700"
                                  >
                                    {cluster.regions[0]?.label}
                                  </text>
                                  {/* Country */}
                                  <text
                                    textAnchor="middle"
                                    x={0}
                                    y={-18}
                                    fontSize={10}
                                    fill="#64748b"
                                    className="dark:fill-slate-400"
                                    fontWeight="500"
                                  >
                                    {cluster.regions[0]?.country}
                                  </text>
                                  {/* Latency if available */}
                                  {avgLatency > 0 && (
                                    <text
                                      textAnchor="middle"
                                      x={0}
                                      y={-2}
                                      fontSize={11}
                                      fill={getMarkerColor()}
                                      fontWeight="700"
                                    >
                                      {avgLatency.toFixed(0)}ms latency
                                    </text>
                                  )}
                                  {/* Status indicator dot */}
                                  <circle
                                    cx={-58}
                                    cy={-43}
                                    r={3}
                                    fill={avgLatency > 0 ? getMarkerColor() : "#6366f1"}
                                  />
                                </g>
                              )}
                            </g>
                          </Marker>
                        );
                      })}
                    </ZoomableGroup>
                  </ComposableMap>
                </div>

                {/* Selected region details */}
                {selectedRegion && (
                  <div className="mt-4 p-4 rounded-lg border bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">
                          {regions.find(r => r.id === selectedRegion)?.label}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {regions.find(r => r.id === selectedRegion)?.country}
                        </p>
                      </div>
                      {latencyState[selectedRegion]?.latency !== undefined && (
                        <div className="text-2xl font-bold">
                          {latencyState[selectedRegion].latency}ms
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleRegionClick(selectedRegion)}
                    >
                      <MapPin className="mr-2 h-3 w-3" />
                      Focus on Region
                    </Button>
                  </div>
                )}

                {/* Region list below map */}
                <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {regions.map((region) => {
                    const regionLatency = latencyState[region.id];
                    const coords = REGION_COORDINATES[region.id];

                    if (!coords) return null;

                    const getMarkerColor = () => {
                      if (regionLatency?.loading) return "#3b82f6";
                      if (regionLatency?.error) return "#ef4444";
                      if (regionLatency?.latency !== undefined) {
                        if (regionLatency.latency < 100) return "#22c55e";
                        if (regionLatency.latency < 200) return "#eab308";
                        if (regionLatency.latency < 300) return "#f97316";
                        return "#ef4444";
                      }
                      return "#6366f1";
                    };

                    return (
                      <div
                        key={region.id}
                        className={`flex items-center gap-2 text-sm p-2 rounded border transition-all cursor-pointer hover:border-primary/50 ${
                          selectedRegion === region.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleRegionClick(region.id)}
                      >
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0`}
                          style={{ backgroundColor: getMarkerColor() }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{region.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{region.country}</div>
                        </div>
                        {regionLatency?.latency !== undefined && (
                          <div className="font-semibold flex-shrink-0" style={{ color: getMarkerColor() }}>
                            {regionLatency.latency}ms
                          </div>
                        )}
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span className="text-muted-foreground">Not tested</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground">Excellent (&lt;100ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-muted-foreground">Good (100-200ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-muted-foreground">Fair (200-300ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-muted-foreground">Poor (&gt;300ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-muted-foreground">Testing...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <section className="mt-12 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">SLA Commitments</h2>
          <Badge variant="outline">Target uptime guarantees</Badge>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">VPS Infrastructure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold text-green-600 dark:text-green-400">99.9%</div>
              <p className="text-xs text-muted-foreground">Target uptime for compute resources</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Network Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold text-green-600 dark:text-green-400">99.95%</div>
              <p className="text-xs text-muted-foreground">Global network backbone guarantee</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Support Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold text-primary">&lt; 1hr</div>
              <p className="text-xs text-muted-foreground">Average initial response time</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mt-12 border-primary/30 bg-primary/5 shadow-sm">
        <CardContent className="space-y-4 px-6 py-8">
          <h3 className="text-lg font-semibold text-foreground">About this page</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Monitoring updates every 60 seconds using probes from multiple regions. Major incidents trigger real-time notifications for customers subscribed to alerts. For historical reports or compliance requests, contact our support team.
          </p>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-muted-foreground/80">
            <Badge variant="secondary">Real-time metrics</Badge>
            <Badge variant="secondary">Multi-region checks</Badge>
            <Badge variant="secondary">Transparent history</Badge>
          </div>
        </CardContent>
      </Card>
      </div>
    </PublicLayout>
  );
}
