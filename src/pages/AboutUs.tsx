import { useEffect, useState } from "react";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MarketingPageShell from "@/components/MarketingPageShell";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { AsciiDivider } from "@/components/fx/AsciiDivider";
import { BRAND_NAME } from "@/lib/brand";
import api from "@/lib/api";
import { useHostingStatus } from "@/hooks/useHosting";

/* ─── Types ──────────────────────────────────────────────────────── */

interface PlatformStats {
  users: { total: number; admins: number; regular: number };
  vps: { total: number; active: number };
  support: { totalTickets: number; openTickets: number };
  plans: { vpsPlans: number; containerPlans: number };
  regions: { total: number };
  hosting: { active: number };
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

const parseNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ─── Component ──────────────────────────────────────────────────── */

export default function AboutUs() {
  const [regionCount, setRegionCount] = useState(10);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const regData = await api.get<{ success?: boolean; regions?: any[]; count?: number }>("/pricing/public-regions");
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
      } catch {
        // Silently fail - region count is optional
      }
    };

    void load();
    return () => { mounted = false; };
  }, []);

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

  const { data: hostingStatus } = useHostingStatus();
  const hostingEnabled = hostingStatus?.enabled === true;

  const formatStat =
    (value?: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString()
      : "N/A";

  const visibleStatRows = hostingEnabled
    ? [
        { label: "Total users", value: formatStat(stats?.users.total) },
        { label: "VPS instances", value: formatStat(stats?.vps.total) },
        { label: "Active VPS", value: formatStat(stats?.vps.active) },
        { label: "Open tickets", value: formatStat(stats?.support.openTickets) },
        { label: "Regions", value: formatStat(stats?.regions.total) },
        { label: "Active hosting accounts", value: formatStat(stats?.hosting.active) },
      ]
    : [
        { label: "Total users", value: formatStat(stats?.users.total) },
        { label: "VPS instances", value: formatStat(stats?.vps.total) },
        { label: "Active VPS", value: formatStat(stats?.vps.active) },
        { label: "Open tickets", value: formatStat(stats?.support.openTickets) },
        { label: "Regions", value: formatStat(stats?.regions.total) },
      ];

  return (
    <MarketingPageShell>
        <section className="relative overflow-hidden border-b border-border/40">
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
              <MarketingHero
                pathPrefix="~/www"
                command="about --story"
                eyebrow={
                  <Badge
                    variant="outline"
                    className="home-shimmer-badge w-fit rounded-full border-primary/30 bg-primary/5 px-4 py-1.5 text-primary"
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    About {BRAND_NAME}
                  </Badge>
                }
                title="Infrastructure without friction"
                subtitle={`${BRAND_NAME} is built for teams who need cloud speed with trusted governance. Provision VPS, manage egress, and trace spend from one dashboard.`}
                actions={
                  <>
                    <Button size="lg" className="h-12 px-7 home-btn-glow group" asChild>
                      <Link to="/register">
                        Get started
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 px-7" asChild>
                      <Link to="/contact">Talk to sales</Link>
                    </Button>
                  </>
                }
              />
            </motion.div>

            {/* Mission + Metrics row */}
            <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Mission card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <Card className="h-full home-gradient-border-top border-border/50 bg-card/60 home-feature-card border-primary/25">
                  <CardContent className="space-y-4 p-6 sm:p-8">
                    <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-primary/20 bg-muted">
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
                <Card className="h-full home-animated-border border-primary/15 bg-gradient-to-b from-card to-background home-glass-panel border-primary/25">
                  <CardContent className="space-y-4 p-6 sm:p-8">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Platform at a glance
                    </h2>
                    {isLoading ? (
                      <div className="grid gap-3">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Skeleton key={idx} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : isError ? (
                      <p className="text-sm text-destructive">
                        Unable to load live metrics.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {visibleStatRows.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between rounded-sm border border-border/40 bg-card px-4 py-2.5"
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

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AsciiDivider label="values" className="opacity-45 py-2" />
        </div>

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
                  <Card className="h-full home-feature-card group border-primary/25">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-primary/20 bg-muted">
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
    </MarketingPageShell>
  );
}
