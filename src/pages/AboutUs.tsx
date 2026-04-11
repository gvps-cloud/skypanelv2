import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Award,
  Globe,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import "@/styles/home.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { BRAND_NAME } from "@/lib/brand";
import api from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────── */

interface PlatformStats {
  users: { total: number; admins: number; regular: number };
  vps: { total: number; active: number };
  support: { totalTickets: number; openTickets: number };
  plans: { vpsPlans: number; containerPlans: number };
  regions: { total: number };
}

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

/* ─── Data ───────────────────────────────────────────────────────── */

interface ValueItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

const values: ValueItem[] = [
  {
    title: "Reliability first",
    description:
      "99.99% uptime SLAs, redundant networking, and proactive alerting in every region.",
    icon: Shield,
  },
  {
    title: "Developer delight",
    description:
      "Intuitive UI, API-first control plane, and consistent account management for teams.",
    icon: Zap,
  },
  {
    title: "Transparent pricing",
    description:
      "Simple hourly billing, usage alerts, and no hidden egress buckets.",
    icon: Award,
  },
  {
    title: "Global reach",
    description:
      "Deploy infrastructure next to customers with 20+ regions and growing.",
    icon: Globe,
  },
  {
    title: "Human support",
    description:
      "24/7 engineering support and onboarding help for every plan.",
    icon: Users,
  },
  {
    title: "Security by design",
    description:
      "SSH hardening, audit logs, and policy guards at platform level.",
    icon: Target,
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;

const parseNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ─── Component ──────────────────────────────────────────────────── */

export default function AboutUs() {
  const [regionCount, setRegionCount] = useState(10);

  useEffect(() => {
    let mounted = true;

    const read = async (path: string) => {
      try {
        const r = await fetch(path);
        if (!r.ok) return null;
        return asRecord(await r.json());
      } catch {
        return null;
      }
    };

    const load = async () => {
      const regData = await read("/api/pricing/public-regions");
      if (!mounted) return;
      if (regData?.success === true) {
        const regions = regData.regions;
        if (Array.isArray(regions) && regions.length > 0) {
          setRegionCount(regions.length);
        } else {
          const c = parseNumber(regData.count);
          if (c !== null && c > 0) setRegionCount(c);
        }
      }
    };

    void load();
    return () => { mounted = false; };
  }, []);

  const trustItems = useMemo(
    () => [
      { icon: Shield, label: "99.99% Uptime SLA" },
      { icon: Zap, label: "45-Second Deploys" },
      { icon: Globe, label: `${regionCount}+ Global Regions` },
      { icon: Award, label: "Transparent Billing" },
      { icon: Users, label: "Team Workspaces" },
      { icon: Target, label: "Security by Design" },
    ],
    [regionCount],
  );

  const { data: stats, isLoading, isError } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const response = await api.get<any>("/health/platform-stats");
      const { success, timestamp, ...payload } = response;
      return payload as PlatformStats;
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const formatStat =
    (value?: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString()
      : "N/A";

  const totalNonAdminUsers = (() => {
    const regularUsers = stats?.users?.regular;
    if (typeof regularUsers === "number" && Number.isFinite(regularUsers)) {
      return regularUsers;
    }

    const totalUsers = stats?.users?.total;
    const adminUsers = stats?.users?.admins;
    if (
      typeof totalUsers === "number" &&
      Number.isFinite(totalUsers) &&
      typeof adminUsers === "number" &&
      Number.isFinite(adminUsers)
    ) {
      return Math.max(totalUsers - adminUsers, 0);
    }

    return undefined;
  })();

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
                  About {BRAND_NAME}
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Infrastructure{" "}
                  <br className="hidden sm:block" />
                  without{" "}
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    friction
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  {BRAND_NAME} is built for teams who need cloud speed with trusted
                  governance. Provision VPS, manage egress, and trace spend from one
                  dashboard.
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
                  <Link to="/contact">Talk to sales</Link>
                </Button>
              </div>
            </motion.div>

            {/* Mission + Metrics row */}
            <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Mission card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <Card className="h-full home-gradient-border-top border-border/50 bg-card/60 home-feature-card">
                  <CardContent className="space-y-4 p-6 sm:p-8">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Our mission
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Provide predictable, secure infrastructure and billing for
                      product teams who move fast. We combine automation-first
                      workflows with peer-grade support to reduce time-to-production.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Key metrics card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                <Card className="h-full home-animated-border border-primary/15 bg-gradient-to-b from-card to-background home-glass-panel">
                  <CardContent className="space-y-4 p-6 sm:p-8">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Platform at a glance
                    </h2>
                    {isLoading ? (
                      <div className="grid gap-3">
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <Skeleton key={idx} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : isError ? (
                      <p className="text-sm text-destructive">
                        Unable to load live metrics.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {[
                          {
                            label: "Total users",
                            value: formatStat(totalNonAdminUsers),
                          },
                          {
                            label: "VPS deployed",
                            value: formatStat(stats?.vps.total),
                          },
                          {
                            label: "Open tickets",
                            value: formatStat(stats?.support.openTickets),
                          },
                          {
                            label: "Regions",
                            value: formatStat(stats?.regions.total),
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between rounded-lg border border-border/40 bg-gradient-to-b from-background/80 to-muted/20 px-4 py-2.5"
                          >
                            <span className="text-sm text-muted-foreground">
                              {row.label}
                            </span>
                            <strong className="text-sm font-semibold text-foreground">
                              {row.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
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

        {/* ═══════════════════ WHAT DRIVES US ══════════════════════════ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-14 max-w-3xl"
            >
              <Badge
                variant="outline"
                className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary"
              >
                Our Values
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What drives us
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A single source of truth for cloud infrastructure teams, from
                developer environment to production billing.
              </p>
            </motion.div>

            <motion.div
              variants={revealContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
              {values.map((item) => (
                <motion.div key={item.title} variants={revealItem}>
                  <Card className="h-full home-feature-card group">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <item.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

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
                    Ready to launch your first deployment?
                  </h2>
                  <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
                    Start with a free account, onboard in minutes, and scale
                    across regions without surprise bills.
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
                    "Secure by default",
                    "API & CLI ready",
                    "24/7 support",
                    "Role-based access",
                    "Hourly billing",
                    "Global regions",
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
      </main>

      <MarketingFooter />
    </div>
  );
}
