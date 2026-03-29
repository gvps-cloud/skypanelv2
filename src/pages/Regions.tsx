import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Wifi, Loader2, Plus, Minus } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PublicLayout from "@/components/PublicLayout";
import { BRAND_NAME } from "@/lib/brand";

interface Region {
  id: string;
  label: string;
  site_type: string;
  status: string;
  country: string;
  speedTestUrl?: string;
}

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
  "us-east-1": { x: 28, y: 35 },
  "us-west-2": { x: 18, y: 38 },
  "us-central-1": { x: 24, y: 40 },
  "ca-central": { x: 26, y: 32 },
  "ca-east": { x: 28, y: 33 },
  "br-gru": { x: 35, y: 70 },
  "sa-east-1": { x: 35, y: 70 },
  // Europe
  "eu-west": { x: 46, y: 28 },
  "eu-central": { x: 50, y: 30 },
  "eu-west-1": { x: 46, y: 28 },
  "eu-central-1": { x: 50, y: 30 },
  "nl-ams": { x: 48, y: 28 },
  "de-fra": { x: 50, y: 30 },
  "de-fra-2": { x: 50, y: 30 },
  "gb-lon": { x: 46, y: 27 },
  "gb-lhr": { x: 46, y: 27 },
  "es-mad": { x: 45, y: 35 },
  "it-mil": { x: 51, y: 32 },
  "fr-par": { x: 47, y: 30 },
  "fr-par-2": { x: 47, y: 30 },
  "se-sto": { x: 52, y: 24 },
  "pl-waw": { x: 52, y: 28 },
  "nl-ams-2": { x: 48, y: 28 },
  // Asia-Pacific
  "ap-south": { x: 72, y: 45 },
  "ap-northeast": { x: 82, y: 35 },
  "ap-southeast": { x: 80, y: 55 },
  "ap-west": { x: 70, y: 42 },
  "ap-south-1": { x: 72, y: 45 },
  "ap-northeast-1": { x: 82, y: 35 },
  "ap-southeast-1": { x: 80, y: 55 },
  "in-maa": { x: 72, y: 45 },
  "in-bom": { x: 70, y: 42 },
  "in-bom-2": { x: 70, y: 42 },
  "jp-tyo": { x: 82, y: 35 },
  "jp-tyo-2": { x: 82, y: 35 },
  "jp-tyo-3": { x: 82, y: 35 },
  "jp-osa": { x: 80, y: 36 },
  "sg-sin": { x: 78, y: 52 },
  "sg-sin-2": { x: 78, y: 52 },
  "id-cgk": { x: 80, y: 55 },
  "au-mel": { x: 88, y: 80 },
  "au-syd": { x: 88, y: 78 },
  "au-east": { x: 88, y: 78 },
  "kr-seoul": { x: 80, y: 34 },
  "hk-hkg": { x: 78, y: 40 },
  "tw-tpe": { x: 80, y: 38 },
};

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

const getLatencyBadgeClass = (ms: number): string => {
  if (ms < 100) return "bg-green-500 text-white dark:text-white";
  if (ms < 200) return "bg-yellow-500 text-black dark:text-black";
  if (ms < 300) return "bg-orange-500 text-white dark:text-white";
  return "bg-red-500 text-white dark:text-white";
};

const getMarkerColor = (latency: number | undefined, loading: boolean, error: boolean): string => {
  if (loading) return "#3b82f6";
  if (error) return "#ef4444";
  if (latency !== undefined) {
    if (latency < 100) return "#22c55e";
    if (latency < 200) return "#eab308";
    if (latency < 300) return "#f97316";
    return "#ef4444";
  }
  return "#6366f1";
};

export default function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyState, setLatencyState] = useState<LatencyState>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [showMapView, setShowMapView] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const currentPageRef = useRef(0);
  const RESULTS_PER_PAGE = 10;

  const measureLatency = useCallback(async (speedTestUrl: string): Promise<number | null> => {
    try {
      const testUrl = `${speedTestUrl}?t=${Date.now()}`;
      const start = performance.now();
      await fetch(testUrl, { mode: "no-cors", cache: "no-store" });
      const end = performance.now();
      return Math.round(end - start);
    } catch {
      return null;
    }
  }, []);

  const setLatency = useCallback((regionId: string, value: Partial<LatencyState[string]>) => {
    setLatencyState((prev) => ({ ...prev, [regionId]: { ...prev[regionId], ...value } }));
  }, []);

  const zoomToRegion = useCallback((regionId: string, select: boolean = false) => {
    const coords = REGION_COORDINATES[regionId];
    if (!coords) return;
    setCenter([(coords.x - 50) * 3.6, (50 - coords.y) * 1.8]);
    setZoom(2);
    if (select) {
      setSelectedRegion(regionId);
    }
  }, []);

  const testRegion = useCallback(async (regionId: string, speedTestUrl: string) => {
    zoomToRegion(regionId, false);
    setLatency(regionId, { loading: true, error: false });
    const latency = await measureLatency(speedTestUrl);
    if (latency === null) {
      setLatency(regionId, { loading: false, error: true });
    } else {
      setLatency(regionId, { loading: false, latency, avg: latency, min: latency, max: latency });
    }
  }, [measureLatency, setLatency, zoomToRegion]);

  const testAllRegions = useCallback(async () => {
    setIsTestingAll(true);
    setShowMapView(true);
    setSelectedRegion(null);
    const eligible = regions.filter((r) => r.speedTestUrl);

    for (let idx = 0; idx < eligible.length; idx++) {
      const region = eligible[idx];
      // Auto-advance pagination to show the currently testing region
      const targetPage = Math.floor(idx / RESULTS_PER_PAGE);
      if (targetPage !== currentPageRef.current) {
        currentPageRef.current = targetPage;
        setResultPage(targetPage);
      }
      
      zoomToRegion(region.id, false);
      setLatency(region.id, { loading: true, error: false });
      const samples: number[] = [];
      for (let i = 0; i < 3; i++) {
        const latency = await measureLatency(region.speedTestUrl!);
        if (latency !== null) samples.push(latency);
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 140));
      }
      if (!samples.length) {
        setLatency(region.id, { loading: false, error: true });
      } else {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = Math.round(samples.reduce((sum, val) => sum + val, 0) / samples.length);
        setLatency(region.id, { loading: false, latency: avg, min, max, avg, error: false });
      }
    }

    setIsTestingAll(false);
  }, [regions, measureLatency, setLatency, zoomToRegion]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => { setZoom(1); setCenter([0, 0]); setSelectedRegion(null); };

  const handleRegionClick = useCallback((regionId: string) => {
    zoomToRegion(regionId, true);
  }, [zoomToRegion]);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setIsLoading(true); setError(null);
        let regionsData: Region[] = [];

        try {
          const response = await fetch("/api/pricing/public-regions");
          const json = await response.json();
          if (json.success && Array.isArray(json.regions)) regionsData = json.regions;
        } catch {
          const fallback = await fetch("https://api.linode.com/v4/regions");
          const json = await fallback.json();
          regionsData = (json.data || []).map((r: any) => ({ id: r.id, label: r.label, site_type: r.site_type, status: r.status, country: r.country, speedTestUrl: r.speed_test_url || r.api_endpoint || "" }));
        }

        setRegions(regionsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch regions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRegions();
  }, []);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Global Regions</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{BRAND_NAME} has a global infrastructure footprint. Use the map to find the best region for your workloads and test live latency.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <Card className="shadow-sm"><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
        ) : regions.length === 0 ? (
          <Card className="shadow-sm"><CardContent className="p-6 text-center text-muted-foreground">No regions available</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <Badge variant="secondary">{regions.length} regions</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant={showMapView ? "default" : "outline"} onClick={() => setShowMapView((prev) => !prev)} className="h-8"><MapPin className="mr-2 h-3.5 w-3.5" />{showMapView ? "List View" : "Map View"}</Button>
                <Button size="sm" variant="default" onClick={testAllRegions} disabled={isTestingAll || !regions.some((r) => r.speedTestUrl)} className="h-8">{isTestingAll ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Testing...</> : <><Wifi className="mr-2 h-3.5 w-3.5" />Test All</>}</Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-semibold">Interactive Map</h2>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center rounded-full bg-green-500 px-2 py-1 text-white">&lt;100ms</span>
                        <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-1 text-black">100-199ms</span>
                        <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-1 text-white">200-299ms</span>
                        <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-1 text-white">300ms+</span>
                      </div>
                    </div>
                    <div className="relative h-[520px] rounded-md overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <ComposableMap projection="geoEqualEarth" width={900} height={520} style={{ width: "100%", height: "100%" }}>
                        <ZoomableGroup zoom={zoom} center={center} onMoveEnd={({ zoom: newZoom, center: newCenter }) => { setZoom(newZoom); setCenter(newCenter); }}>
                          <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                            {({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} fill="#e2e8f0" stroke="#94a3b8" className="hover:fill-slate-300 transition" />)}
                          </Geographies>
                          {regions.map((region) => {
                            const coords = REGION_COORDINATES[region.id];
                            if (!coords) return null;
                            const state = (latencyState[region.id] ?? { loading: false, error: false }) as LatencyState[string];
                            return (
                              <Marker key={region.id} coordinates={[(coords.x - 50) * 3.6, (50 - coords.y) * 1.8]}>
                                <circle r={selectedRegion === region.id ? 8 : 6} fill={getMarkerColor(state.latency, state.loading, state.error)} stroke="#fff" strokeWidth={1.5} onClick={() => { handleRegionClick(region.id); setSelectedRegion(region.id); }} />
                                <text y={-12} textAnchor="middle" fontSize={8} fill="#1e293b" pointerEvents="none">{region.id}</text>
                              </Marker>
                            );
                          })}
                        </ZoomableGroup>
                      </ComposableMap>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleZoomIn} className="h-8 w-8 p-0" disabled={zoom >= 4}><Plus className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={handleZoomOut} className="h-8 w-8 p-0" disabled={zoom <= 1}><Minus className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={handleResetZoom} className="h-8">Reset</Button>
                      <span className="ml-auto text-xs text-muted-foreground">Tip: click a region to show details</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold">Region details</h3>
                  {!selectedRegion ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm text-muted-foreground">Click a region marker to inspect basic stats and run a latency test.</p>
                      <p className="text-sm text-muted-foreground">Tip: the list below also shows live test results so you can evaluate regions without toggling modes.</p>

                      {Object.keys(latencyState).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No latency results yet. Run "Test All" or click any marker.</p>
                      ) : (
                        (() => {
                          const resultRegions = regions.filter((region) => latencyState[region.id]?.latency !== undefined || latencyState[region.id]?.error);
                          const totalPages = Math.max(Math.ceil(resultRegions.length / RESULTS_PER_PAGE), 1);
                          const pageStart = resultPage * RESULTS_PER_PAGE;
                          const pageRegions = resultRegions.slice(pageStart, pageStart + RESULTS_PER_PAGE);

                          return (
                            <div className="rounded-lg border border-border p-3">
                              <h4 className="text-sm font-semibold mb-2">Latency results</h4>
                              {pageRegions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No results on this page.</p>
                              ) : (
                                <div className="space-y-2 text-sm">
                                  {pageRegions.map((region) => {
                                    const state = (latencyState[region.id] ?? { loading: false, error: false }) as LatencyState[string];
                                    return (
                                      <div key={region.id} className="flex items-center justify-between">
                                        <span>{region.label}</span>
                                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${state.error ? 'bg-red-500 text-white' : state.latency !== undefined ? getLatencyBadgeClass(state.latency) : 'bg-slate-200 text-slate-700'}`}>
                                          {state.error ? 'Failed' : state.latency !== undefined ? `${state.latency} ms` : 'Pending'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span>Page {resultPage + 1} of {totalPages}</span>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => { const newPage = Math.max(resultPage - 1, 0); setResultPage(newPage); currentPageRef.current = newPage; }} disabled={resultPage === 0}>Prev</Button>
                                  <Button size="sm" variant="outline" onClick={() => { const newPage = Math.min(resultPage + 1, totalPages - 1); setResultPage(newPage); currentPageRef.current = newPage; }} disabled={resultPage >= totalPages - 1}>Next</Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  ) : (
                    (() => {
                      const region = regions.find((r) => r.id === selectedRegion);
                      if (!region) return <p className="text-sm text-muted-foreground mt-3">Region unavailable</p>;
                      const state = (latencyState[region.id] ?? { loading: false, error: false }) as LatencyState[string];
                      return (
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="text-base font-semibold">{region.label}</p>
                            <p className="text-xs text-muted-foreground">{region.country} • {region.site_type}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm">Status: <strong>{region.status}</strong></p>
                            <p className="text-sm">Latency: {state.latency !== undefined ? `${state.latency}ms` : 'Not tested'}</p>
                            {state.error && <p className="text-sm text-destructive">Latency test failed</p>}
                          </div>
                          <Button size="sm" variant="default" onClick={() => region.speedTestUrl && testRegion(region.id, region.speedTestUrl)} disabled={!region.speedTestUrl || state.loading}>
                            <Wifi className="mr-2 h-3.5 w-3.5" />{state.loading ? 'Testing…' : 'Run Test'}
                          </Button>
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
            </div>

            {!showMapView && (
              <Card className="shadow-sm mt-4">
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {regions.map((region) => {
                      const state = latencyState[region.id];
                      return (
                        <div key={region.id} className="rounded-lg border p-4 hover:border-primary/40 hover:shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{region.label}</h4>
                              <p className="text-xs text-muted-foreground">{region.country}</p>
                            </div>
                            {state?.latency !== undefined && <span className={`px-2 py-1 rounded text-xs font-semibold ${getLatencyBadgeClass(state.latency)}`}>{state.latency}ms</span>}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{region.site_type} • {region.status}</div>
                          <Button size="sm" variant="ghost" className="mt-2" onClick={() => region.speedTestUrl && testRegion(region.id, region.speedTestUrl)} disabled={!region.speedTestUrl || !!state?.loading}>
                            {state?.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
