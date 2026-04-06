import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  Wifi,
  Loader2,
  Sparkles,
  Globe,
  Zap,
  Shield,
  Clock,
  Server,
  CheckCircle2,
} from "lucide-react";

import "@/styles/home.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { BRAND_NAME } from "@/lib/brand";
import { LeafletMap } from "@/components/regions";

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

const getLatencyBadgeClass = (ms: number): string => {
  if (ms < 100) return "bg-green-500 text-white dark:text-white";
  if (ms < 200) return "bg-yellow-500 text-black dark:text-black";
  if (ms < 300) return "bg-orange-500 text-white dark:text-white";
  return "bg-red-500 text-white dark:text-white";
};

/* ─── Animation Variants ─────────────────────────────────────────── */

const revealContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ─── Trust Marquee Items ────────────────────────────────────────── */

const trustItems = [
  { icon: Globe, label: "Global Infrastructure" },
  { icon: Zap, label: "Low Latency" },
  { icon: Shield, label: "DDoS Protected" },
  { icon: Clock, label: "99.9% Uptime SLA" },
  { icon: Server, label: "NVMe Storage" },
  { icon: CheckCircle2, label: "24/7 Monitoring" },
  { icon: MapPin, label: "Multi-Region" },
  { icon: Wifi, label: "Live Latency Tests" },
];

/* ─── Component ──────────────────────────────────────────────────── */

export default function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyState, setLatencyState] = useState<LatencyState>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [showMapView, setShowMapView] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const currentPageRef = useRef(0);
  const RESULTS_PER_PAGE = 10;

  const measureLatency = useCallback(
    async (speedTestUrl: string): Promise<number | null> => {
      try {
        const testUrl = `${speedTestUrl}?t=${Date.now()}`;
        const start = performance.now();
        await fetch(testUrl, { mode: "no-cors", cache: "no-store" });
        const end = performance.now();
        return Math.round(end - start);
      } catch {
        return null;
      }
    },
    [],
  );

  const setLatency = useCallback(
    (regionId: string, value: Partial<LatencyState[string]>) => {
      setLatencyState((prev) => ({
        ...prev,
        [regionId]: { ...prev[regionId], ...value },
      }));
    },
    [],
  );

  const handleRegionClick = useCallback((regionId: string) => {
    setSelectedRegion(regionId);
  }, []);

  const testRegion = useCallback(
    async (regionId: string, speedTestUrl: string) => {
      setLatency(regionId, { loading: true, error: false });
      const samples: number[] = [];
      for (let i = 0; i < 3; i++) {
        const latency = await measureLatency(speedTestUrl);
        if (latency !== null) samples.push(latency);
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 140));
      }
      if (!samples.length) {
        setLatency(regionId, { loading: false, error: true });
      } else {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = Math.round(
          samples.reduce((sum, val) => sum + val, 0) / samples.length,
        );
        setLatency(regionId, {
          loading: false,
          latency: avg,
          min,
          max,
          avg,
          error: false,
        });
      }
    },
    [measureLatency, setLatency],
  );

  const testAllRegions = useCallback(async () => {
    setIsTestingAll(true);
    setShowMapView(true);
    setSelectedRegion(null);
    const eligible = regions.filter((r) => r.speedTestUrl);

    for (let idx = 0; idx < eligible.length; idx++) {
      const region = eligible[idx];
      setSelectedRegion(region.id);

      const targetPage = Math.floor(idx / RESULTS_PER_PAGE);
      if (targetPage !== currentPageRef.current) {
        currentPageRef.current = targetPage;
        setResultPage(targetPage);
      }

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
        const avg = Math.round(
          samples.reduce((sum, val) => sum + val, 0) / samples.length,
        );
        setLatency(region.id, {
          loading: false,
          latency: avg,
          min,
          max,
          avg,
          error: false,
        });
      }
    }

    setIsTestingAll(false);
    setSelectedRegion(null);
    setResultPage(0);
    currentPageRef.current = 0;
  }, [regions, measureLatency, setLatency]);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        let regionsData: Region[] = [];

        try {
          const response = await fetch("/api/pricing/public-regions");
          const json = await response.json();
          if (json.success && Array.isArray(json.regions))
            regionsData = json.regions;
        } catch {
          const fallback = await fetch("https://api.linode.com/v4/regions");
          const json = await fallback.json();
          regionsData = (json.data || []).map((r: any) => ({
            id: r.id,
            label: r.label,
            site_type: r.site_type,
            status: r.status,
            country: r.country,
            speedTestUrl: r.speed_test_url || r.api_endpoint || "",
          }));
        }

        setRegions(regionsData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch regions",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchRegions();
  }, []);

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section className="relative overflow-hidden border-b border-border/40">
          {/* Floating orbs */}
          <div className="home-orb home-orb--1" aria-hidden="true" />
          <div className="home-orb home-orb--2" aria-hidden="true" />
          <div className="home-orb home-orb--3" aria-hidden="true" />
          <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Global Infrastructure
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Deploy{" "}
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    close to your users
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  {BRAND_NAME} has a global infrastructure footprint. Test live
                  latency from your location and find the best region for your
                  workloads.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 px-7 home-btn-glow group"
                  asChild
                >
                  <Link to="/register">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7"
                  asChild
                >
                  <Link to="/pricing">View pricing</Link>
                </Button>
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary/70" />
                  {regions.length > 0
                    ? `${regions.length}+ global regions`
                    : "Global regions available"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary/70" />
                  Live latency testing from your browser
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
        <section className="border-b border-border/40 bg-muted/20 py-6">
          <div className="home-marquee">
            <div className="home-marquee__track">
              {[...trustItems, ...trustItems].map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary/60" />
                  <span className="whitespace-nowrap font-medium">
                    {item.label}
                  </span>
                  <span className="ml-4 h-1 w-1 rounded-full bg-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ MAIN CONTENT ═════════════════════════ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {isLoading ? (
              <div className="flex justify-center py-24">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-muted-foreground">
                    Loading regions...
                  </span>
                </div>
              </div>
            ) : error ? (
              <motion.div variants={revealItem} initial="hidden" animate="show">
                <Card className="home-gradient-border-top border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">{error}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : regions.length === 0 ? (
              <motion.div variants={revealItem} initial="hidden" animate="show">
                <Card className="home-gradient-border-top">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No regions available
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="space-y-16"
              >
                {/* Controls bar */}
                <motion.div variants={revealItem}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="secondary" className="text-sm">
                      {regions.length} regions
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showMapView ? "default" : "outline"}
                        onClick={() => setShowMapView((prev) => !prev)}
                        className="h-8"
                      >
                        <MapPin className="mr-2 h-3.5 w-3.5" />
                        {showMapView ? "List View" : "Map View"}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={testAllRegions}
                        disabled={
                          isTestingAll || !regions.some((r) => r.speedTestUrl)
                        }
                        className="h-8"
                      >
                        {isTestingAll ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <Wifi className="mr-2 h-3.5 w-3.5" />
                            Test All
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>

                {/* Map + Details grid */}
                {showMapView && (
                  <div>
                    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                      {/* Interactive Map */}
                      <Card className="home-feature-card shadow-sm">
                        <CardContent className="p-6">
                          <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">
                              Interactive Map
                            </h2>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="inline-flex items-center rounded-full bg-green-500 px-2 py-1 text-white">
                                &lt;100ms
                              </span>
                              <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-1 text-black">
                                100-199ms
                              </span>
                              <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-1 text-white">
                                200-299ms
                              </span>
                              <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-1 text-white">
                                300ms+
                              </span>
                            </div>
                          </div>
                          <div className="relative h-[520px] rounded-lg overflow-hidden border border-border/50">
                            <LeafletMap
                              regions={regions}
                              latencyState={latencyState}
                              selectedRegion={selectedRegion}
                              onRegionClick={handleRegionClick}
                              onRegionTest={testRegion}
                            />
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Tip: Click a region marker to see details and run
                            latency tests
                          </p>
                        </CardContent>
                      </Card>

                      {/* Region Details Sidebar */}
                      <Card className="home-gradient-border-top home-glass-panel shadow-sm">
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold mb-4">
                            Region Details
                          </h3>
                          {!selectedRegion ? (
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">
                                Click a region marker on the map to inspect
                                basic stats and run a latency test.
                              </p>

                              {Object.keys(latencyState).length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No latency results yet. Run &quot;Test
                                  All&quot; or click any marker.
                                </p>
                              ) : (
                                (() => {
                                  const allTestedRegions = regions.filter(
                                    (region) =>
                                      latencyState[region.id]?.latency !==
                                        undefined ||
                                      latencyState[region.id]?.error,
                                  );
                                  const resultRegions = !isTestingAll
                                    ? allTestedRegions.filter((region) => {
                                        const latency =
                                          latencyState[region.id]?.latency;
                                        return (
                                          latency !== undefined &&
                                          latency <= 125
                                        );
                                      })
                                    : allTestedRegions;
                                  const totalPages = Math.max(
                                    Math.ceil(
                                      resultRegions.length / RESULTS_PER_PAGE,
                                    ),
                                    1,
                                  );
                                  const pageStart =
                                    resultPage * RESULTS_PER_PAGE;
                                  const pageRegions = resultRegions.slice(
                                    pageStart,
                                    pageStart + RESULTS_PER_PAGE,
                                  );

                                  return (
                                    <div className="rounded-lg border border-border/40 p-3 mt-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-semibold">
                                          Latency Results
                                        </h4>
                                        {!isTestingAll &&
                                          allTestedRegions.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                              Showing {resultRegions.length} of{" "}
                                              {allTestedRegions.length}
                                              (&le;125ms)
                                            </span>
                                          )}
                                      </div>
                                      {pageRegions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                          No results on this page.
                                        </p>
                                      ) : (
                                        <div className="space-y-2 text-sm">
                                          {pageRegions.map((region) => {
                                            const state = latencyState[
                                              region.id
                                            ] ?? {
                                              loading: false,
                                              error: false,
                                            };
                                            return (
                                              <div
                                                key={region.id}
                                                className="flex items-center justify-between"
                                              >
                                                <span>{region.label}</span>
                                                <span
                                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                                    state.error
                                                      ? "bg-red-500 text-white"
                                                      : state.latency !==
                                                          undefined
                                                        ? getLatencyBadgeClass(
                                                            state.latency,
                                                          )
                                                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                                  }`}
                                                >
                                                  {state.error
                                                    ? "Failed"
                                                    : state.latency !==
                                                        undefined
                                                      ? `${state.latency} ms`
                                                      : "Pending"}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <div className="mt-3 flex items-center justify-between text-xs">
                                        <span>
                                          Page {resultPage + 1} of {totalPages}
                                        </span>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const newPage = Math.max(
                                                resultPage - 1,
                                                0,
                                              );
                                              setResultPage(newPage);
                                              currentPageRef.current = newPage;
                                            }}
                                            disabled={resultPage === 0}
                                          >
                                            Prev
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const newPage = Math.min(
                                                resultPage + 1,
                                                totalPages - 1,
                                              );
                                              setResultPage(newPage);
                                              currentPageRef.current = newPage;
                                            }}
                                            disabled={
                                              resultPage >= totalPages - 1
                                            }
                                          >
                                            Next
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          ) : (
                            (() => {
                              const region = regions.find(
                                (r) => r.id === selectedRegion,
                              );
                              if (!region)
                                return (
                                  <p className="text-sm text-muted-foreground mt-3">
                                    Region unavailable
                                  </p>
                                );
                              const state = latencyState[region.id] ?? {
                                loading: false,
                                error: false,
                              };
                              return (
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-base font-semibold">
                                      {region.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {region.country} &bull; {region.site_type}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      Status: <strong>{region.status}</strong>
                                    </p>
                                    <p className="text-sm">
                                      Latency:{" "}
                                      {state.latency !== undefined
                                        ? `${state.latency}ms`
                                        : "Not tested"}
                                    </p>
                                    {state.min !== undefined &&
                                      state.max !== undefined && (
                                        <p className="text-xs text-muted-foreground">
                                          Range: {state.min}ms - {state.max}ms
                                        </p>
                                      )}
                                    {state.error && (
                                      <p className="text-sm text-destructive">
                                        Latency test failed
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() =>
                                      region.speedTestUrl &&
                                      testRegion(region.id, region.speedTestUrl)
                                    }
                                    disabled={
                                      !region.speedTestUrl || state.loading
                                    }
                                  >
                                    <Wifi className="mr-2 h-3.5 w-3.5" />
                                    {state.loading ? "Testing..." : "Run Test"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedRegion(null)}
                                    className="w-full"
                                  >
                                    Close
                                  </Button>
                                </div>
                              );
                            })()
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* List View */}
                {!showMapView && (
                  <div>
                    <Card className="home-gradient-border-top shadow-sm">
                      <CardContent className="p-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {regions.map((region) => {
                            const state = latencyState[region.id];
                            return (
                              <div
                                key={region.id}
                                className="rounded-lg border border-border/50 p-4 home-glass-panel transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">
                                      {region.label}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {region.country}
                                    </p>
                                  </div>
                                  {state?.latency !== undefined && (
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getLatencyBadgeClass(state.latency)}`}
                                    >
                                      {state.latency}ms
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  {region.site_type} &bull; {region.status}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() =>
                                    region.speedTestUrl &&
                                    testRegion(region.id, region.speedTestUrl)
                                  }
                                  disabled={
                                    !region.speedTestUrl || !!state?.loading
                                  }
                                >
                                  {state?.loading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Test"
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>
      </main>

      {/* ═══════════════════════ CTA ═════════════════════════════════ */}
      <section className="border-y border-border/40 bg-muted/20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="home-cta-shell relative overflow-hidden rounded-3xl border border-border/50 px-6 py-16 text-center sm:px-12 shadow-2xl">
            {/* Floating orbs */}
            <div
              className="home-orb absolute w-[300px] h-[300px] -top-[100px] -left-[80px] opacity-40"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
                filter: "blur(60px)",
                animation: "float-orb-1 16s ease-in-out infinite",
              }}
              aria-hidden="true"
            />
            <div
              className="home-orb absolute w-[250px] h-[250px] -bottom-[80px] -right-[60px] opacity-40"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)",
                filter: "blur(60px)",
                animation: "float-orb-2 20s ease-in-out infinite",
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:text-left">
              {/* Left CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Ready to deploy near your users?
                </h2>
                <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
                  Spin up VPS instances in seconds across global regions with
                  transparent hourly billing and real-time monitoring.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-start">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base home-btn-glow"
                    asChild
                  >
                    <Link to="/register">Get started</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-12 px-8 text-base border border-border/40"
                    asChild
                  >
                    <Link to="/contact">Talk to sales</Link>
                  </Button>
                </div>
              </motion.div>

              {/* Right feature pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-wrap items-start gap-3 lg:pt-4"
              >
                {[
                  "Global regions",
                  "Low-latency access",
                  "Hourly billing",
                  "DDoS protection",
                  "NVMe storage",
                  "24/7 monitoring",
                ].map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 text-sm font-medium text-primary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {tag}
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
