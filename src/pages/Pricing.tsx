/**
 * Pricing Page
 *
 * Public-facing pricing page that displays available VPS plans with transparent pricing
 * information. Includes plan specifications, hourly/monthly rates, and feature comparisons.
 * Plans are grouped by category tabs derived from type_class.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  Shield,
  AlertCircle,
  ArrowRight,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Clock,
  Zap,
  Globe,
} from 'lucide-react';
import type { VPSPlan } from '@/types/vps';
import { useEnabledCategoryMappings } from '@/hooks/useCategoryMappings';
import { BRAND_NAME } from '@/lib/brand';
import MarketingPageShell from '@/components/MarketingPageShell';
import { MarketingHero } from '@/components/marketing/MarketingHero';
import DataStreamCanvas from '@/components/home/DataStreamCanvas';
import { usePrefersReducedMotion } from '@/components/fx/usePrefersReducedMotion';
import { AsciiBox } from '@/components/fx/AsciiBox';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { getHostingFeatureRows, getHostingFeatureSpecRows } from '@/lib/hostingPlanFeatures';
import type { HostingPlan } from '@/hooks/useHosting';
import { cn } from '@/lib/utils';

/* â”€â”€â”€ Animation Variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€ Trust Marquee Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const baseTrustItems = [
  { icon: Clock, label: '99.9% Uptime' },
  { icon: Zap, label: 'Transparent Billing' },
  { icon: Shield, label: 'No Lock-in' },
  { icon: Globe, label: '24/7 Support' },
];

const vpsTrustItems = [
  { icon: HardDrive, label: 'SSD Storage' },
  { icon: Shield, label: 'DDoS Protection' },
  { icon: Zap, label: 'Instant Deploy' },
  { icon: Server, label: 'Full Root Access' },
];

const hostingTrustItems = [
  { icon: Globe, label: 'Managed Websites' },
  { icon: Shield, label: 'Secure Control Panel' },
];

const DEFAULT_CATEGORY_META: Record<string, { label: string; order: number }> = {
  nanode:      { label: 'Nanode',         order: 0 },
  standard:    { label: 'Standard',       order: 1 },
  dedicated:   { label: 'Dedicated CPU',  order: 2 },
  premium:     { label: 'Premium',        order: 3 },
  highmem:     { label: 'High Memory',    order: 4 },
  gpu:         { label: 'GPU',            order: 5 },
  accelerated: { label: 'Accelerated',    order: 6 },
};

const formatNetworkSpeed = (mbits: number): string => {
  if (mbits >= 1000) {
    const gbps = mbits / 1000;
    return `${Number.isInteger(gbps) ? gbps : gbps.toFixed(1)} Gbps`;
  }
  return `${mbits} Mbps`;
};


const hostingCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatHostingMonthly = (amount: number | string | null | undefined): string => {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  const normalizedValue = Number.isFinite(value) && value !== undefined && value !== null ? value : 0;
  return hostingCurrencyFormatter.format(normalizedValue);
};

const HostingPricingSection = ({ plans }: { plans: HostingPlan[] }) => {
  const content = plans.length === 0 ? <EmptyHostingPlans /> : <HostingPlanGrid plans={plans} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-20 space-y-10"
    >
      <HostingPricingHeader />
      {content}
      <EnhanceHostingInfo />
    </motion.div>
  );
};

const HostingPricingHeader = () => (
  <div className="text-center">
    <Badge
      variant="outline"
      className="mb-4 rounded-full border-primary/30 px-4 py-1.5 text-primary"
    >
      Enhance Web Hosting
    </Badge>
    <h2 className="mb-4 text-3xl font-semibold">Managed Hosting Plans</h2>
    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
      Hosting prices and features are loaded from the configured hosting catalog, so this page reflects the plans available in the panel.
    </p>
  </div>
);

const EnhanceHostingInfo = () => (
  <Card className="home-glass-panel border-primary/25">
    <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <div>
        <Badge
          variant="outline"
          className="mb-4 rounded-full border-primary/30 px-3 py-1 text-primary"
        >
          Control panel layer
        </Badge>
        <h3 className="text-2xl font-semibold">GVPS.Cloud hosting with Enhance panel controls</h3>
        <p className="mt-3 text-muted-foreground">
          Hosting runs on GVPS.Cloud-operated servers. Enhance is the control panel
          software we use, similar in purpose to Plesk or cPanel, for managing
          websites, databases, mailboxes, FTP users, backups, and resource limits
          after checkout.
        </p>
      </div>
      <div className="rounded-sm border border-border/60 bg-card p-5">
        <p className="text-sm font-medium text-foreground">How hosting works</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>You create an account and fund your GVPS.Cloud wallet</span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>You buy a GVPS.Cloud hosting plan from the catalog</span>
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>We provision it on GVPS.Cloud servers with panel access</span>
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
);

const EmptyHostingPlans = () => (
  <Card className="border-primary/25">
    <CardContent className="py-12 text-center">
      <Globe className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-medium">No Hosting Plans Available</h3>
      <p className="mb-4 text-muted-foreground">
        Enhance hosting is enabled, but no active hosting plans are configured yet.
      </p>
      <Button asChild variant="outline">
        <Link to="/contact">Contact Support</Link>
      </Button>
    </CardContent>
  </Card>
);

const HostingPlanGrid = ({ plans }: { plans: HostingPlan[] }) => (
  <motion.div
    variants={revealContainer}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true }}
    className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
  >
    {plans.map((plan) => (
      <HostingPlanCard key={plan.id} plan={plan} />
    ))}
  </motion.div>
);

const getHostingDisplayFeatures = (plan: HostingPlan): string[] => {
  const featureRows = getHostingFeatureRows(plan, 9, { zeroMeansUnlimited: true });
  return featureRows.length > 0 ? featureRows : ['Managed website hosting', 'Panel access after purchase'];
};

const HostingPlanCard = ({ plan }: { plan: HostingPlan }) => {
  const specRows = getHostingFeatureSpecRows(plan, 9, { zeroMeansUnlimited: true });
  const fallbackRows = getHostingDisplayFeatures(plan);

  return (
    <motion.div variants={revealItem}>
      <Card className="home-gradient-border-top home-animated-border home-feature-card flex h-full flex-col border-primary/25">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <Badge variant="secondary" className="text-xs capitalize">
              {plan.service_type}
            </Badge>
          </div>
          {plan.description && (
            <CardDescription>{plan.description}</CardDescription>
          )}
          <div className="pt-2">
            <span className="text-3xl font-bold">{formatHostingMonthly(plan.price_monthly)}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          {specRows.length > 0
            ? specRows.map((row) => (
                <div key={row.key} className="flex items-center gap-3">
                  <row.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">{row.label}</span>
                </div>
              ))
            : fallbackRows.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link to="/register">
              Start Hosting
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

const PricingPage: React.FC = () => {
  const [vpsPlans, setVpsPlans] = useState<VPSPlan[]>([]);
  const [vpsProductEnabled, setVpsProductEnabled] = useState(false);
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [hostingPlans, setHostingPlans] = useState<HostingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeProduct, setActiveProduct] = useState<'vps' | 'hosting'>('vps');
  const { data: enabledCategoryMappings = [] } = useEnabledCategoryMappings();
  const heroReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!hostingEnabled && activeProduct === 'hosting') {
      setActiveProduct('vps');
    }
  }, [hostingEnabled, activeProduct]);

  useEffect(() => {
    if (!vpsProductEnabled && activeProduct === 'vps') {
      setActiveProduct(hostingEnabled ? 'hosting' : 'vps');
    }
  }, [vpsProductEnabled, hostingEnabled, activeProduct]);

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [vpsResult, hostingResult] = await Promise.allSettled([
        apiClient.get<{ plans?: VPSPlan[]; error?: string }>('/pricing/vps'),
        apiClient.get<{ enabled?: boolean; plans?: HostingPlan[]; error?: string }>('/pricing/hosting'),
      ]);

      if (vpsResult.status === 'fulfilled') {
        const vpsPayload = vpsResult.value as { enabled?: boolean; plans?: VPSPlan[] };
        const vpsOn = vpsPayload.enabled !== false;
        setVpsProductEnabled(vpsOn);
        console.log('VPS plans loaded:', vpsPayload.plans?.length || 0);
        setVpsPlans(vpsPayload.plans || []);
      } else {
        console.error('Failed to load VPS pricing data:', vpsResult.reason);
        setError(vpsResult.reason instanceof Error ? vpsResult.reason.message : 'Failed to load pricing information');
        setVpsPlans([]);
        setVpsProductEnabled(false);
      }

      if (hostingResult.status === 'fulfilled') {
        setHostingEnabled(hostingResult.value.enabled === true);
        setHostingPlans(hostingResult.value.plans || []);
      } else {
        console.warn('Failed to load hosting pricing data:', hostingResult.reason);
        setHostingEnabled(false);
        setHostingPlans([]);
      }
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing information');
      setVpsPlans([]);
      setVpsProductEnabled(false);
      setHostingEnabled(false);
      setHostingPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string): string => {
    const mapping = enabledCategoryMappings.find(
      (item) => item.original_category === category,
    );

    if (mapping?.custom_name) {
      return mapping.custom_name;
    }

    return (
      DEFAULT_CATEGORY_META[category]?.label ??
      category.charAt(0).toUpperCase() + category.slice(1)
    );
  };

  // Derive active categories from available plans (only show tabs for categories that have plans)
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const plan of vpsPlans) {
      seen.add(plan.type_class || 'standard');
    }

    return Array.from(seen)
      .sort((a, b) => {
        const mappingA = enabledCategoryMappings.find((item) => item.original_category === a);
        const mappingB = enabledCategoryMappings.find((item) => item.original_category === b);

        const orderA = mappingA?.display_order ?? DEFAULT_CATEGORY_META[a]?.order ?? 99;
        const orderB = mappingB?.display_order ?? DEFAULT_CATEGORY_META[b]?.order ?? 99;

        return orderA - orderB;
      });
  }, [enabledCategoryMappings, vpsPlans]);

  // Filter plans by active category
  const filteredPlans = useMemo(() => {
    if (activeCategory === 'all') return vpsPlans;
    return vpsPlans.filter((p) => (p.type_class || 'standard') === activeCategory);
  }, [vpsPlans, activeCategory]);

  const visibleTrustItems = useMemo(() => {
    return [
      ...baseTrustItems,
      ...(vpsProductEnabled ? vpsTrustItems : []),
      ...(hostingEnabled ? hostingTrustItems : []),
    ];
  }, [hostingEnabled, vpsProductEnabled]);

  const formatCurrency = (amount: number | string | null | undefined): string => {
    if (amount == null) {
      return '$0.000000';
    }

    const value = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (!Number.isFinite(value) || value < 0) {
      return '$0.000000';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(value);
  };

  const formatMonthly = (amount: number | string | null | undefined): string => {
    if (amount == null) {
      return '$0.00';
    }

    const value = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (!Number.isFinite(value) || value < 0) {
      return '$0.00';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatResource = (value: number, unit: string): string => {
    const pluralizeUnit = (unit: string, count: number): string => {
      if (count === 1) return unit;
      const specialCases: Record<string, string> = {
        'GB Memory': 'GB Memory',
        'GB Storage': 'GB Storage',
        'Memory': 'Memory',
        'Storage': 'Storage',
      };
      if (specialCases[unit]) return specialCases[unit];
      return `${unit}s`;
    };
    return `${value} ${pluralizeUnit(unit, value)}`;
  };



  if (loading) {
    return (
      <MarketingPageShell background="aurora">
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-6">
                  <Skeleton className="h-4 w-20 mb-4" />
                  <Skeleton className="h-8 w-36 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingPageShell>
    );
  }

  return (
    <MarketingPageShell background="aurora">
        {/* â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            <DataStreamCanvas
              className="h-full w-full opacity-[0.25]"
              reducedMotion={heroReducedMotion}
              pauseWhenOffscreen
            />
          </div>
          <div className="home-orb home-orb--1" aria-hidden="true" />
          <div className="home-orb home-orb--2" aria-hidden="true" />
          <div className="home-orb home-orb--3" aria-hidden="true" />
          <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

          <div className="relative z-[2] mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-6"
            >
              <MarketingHero
                pathPrefix="~/www"
                command="pricing --manifest"
                eyebrow={
                  <Badge
                    variant="outline"
                    className="home-shimmer-badge w-fit rounded-full border-primary/30 bg-primary/5 px-4 py-1.5 text-primary"
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Transparent pricing
                  </Badge>
                }
                title="Simple, predictable pricing"
                subtitle={
                  vpsProductEnabled && hostingEnabled
                    ? "Choose from compute and hosting plans. Pay only for what you use with transparent billing."
                    : vpsProductEnabled
                      ? "Choose from our VPS instances. Pay only for what you use with transparent hourly and monthly billing."
                      : hostingEnabled
                        ? "Choose from managed hosting plans with transparent monthly billing."
                        : "Review available product catalogs and transparent billing options."
                }
                actions={
                  <>
                    <Button size="lg" className="h-12 px-7 home-btn-glow group" asChild>
                      <Link to="/register">
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 px-7" asChild>
                      <Link to="/contact">Contact Sales</Link>
                    </Button>
                  </>
                }
              />

              <div className="relative z-10">
              <div className="max-w-4xl overflow-hidden rounded-sm border border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
                <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-[11px] sm:text-xs text-muted-foreground">
                  {visibleTrustItems.map(({ icon: Icon, label }) => (
                    <span key={label} className="inline-flex shrink-0 items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* â”€â”€â”€ PRICING CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {error && (
              <Alert className="mb-8" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!vpsProductEnabled && !hostingEnabled ? (
              <Card className="mx-auto max-w-2xl border-primary/25">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No public pricing catalogs are enabled on this deployment.
                </CardContent>
              </Card>
            ) : (
            <Tabs
              value={activeProduct}
              onValueChange={(value) => setActiveProduct(value as 'vps' | 'hosting')}
              className="space-y-16"
            >
              <div className="mx-auto max-w-3xl rounded-sm border border-primary/25 bg-card p-3 shadow-none">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="px-2 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                      Product catalog
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hostingEnabled && vpsProductEnabled
                        ? "Switch between VPS compute plans and Enhance hosting packages."
                        : hostingEnabled
                          ? "Enhance hosting packages available on this platform."
                          : vpsProductEnabled
                            ? "Choose from our VPS instances with transparent hourly and monthly billing."
                            : "Product pricing will appear here when offerings are enabled for this deployment."}
                    </p>
                  </div>
                  <TabsList className="h-12 rounded-sm border border-border/60 bg-muted/50 p-1.5">
                    {vpsProductEnabled && (
                    <TabsTrigger
                      value="vps"
                      className="rounded-sm px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      VPS
                    </TabsTrigger>
                    )}
                    {hostingEnabled && (
                      <TabsTrigger
                        value="hosting"
                        className="rounded-sm px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        Hosting
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
              </div>

              {vpsProductEnabled && (
              <TabsContent value="vps" className="mt-0">

            {/* VPS Instances header */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mb-12 text-center"
            >
              <h2 className="text-3xl font-semibold mb-4">VPS Instances</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                High-performance virtual private servers powered by AMD EPYC CPUs with full root access and SSH console
              </p>
            </motion.div>

            {/* Category Tabs */}
            {categories.length > 1 && (
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="flex flex-wrap justify-center gap-2 mb-12"
              >
                {['all', ...categories].map((cat) => (
                  <motion.div key={cat} variants={revealItem}>
                    <button
                      onClick={() => setActiveCategory(cat)}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                        activeCategory === cat
                          ? 'bg-primary text-primary-foreground shadow-none'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {cat === 'all' ? 'All Plans' : getCategoryLabel(cat)}
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {filteredPlans.length === 0 ? (
              <Card className="border-primary/25">
                <CardContent className="py-12">
                  <div className="text-center">
                    <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No VPS Plans Available</h3>
                    <p className="text-muted-foreground mb-4">
                      VPS plans are not currently configured. Please check back later.
                    </p>
                    <Button asChild variant="outline">
                      <Link to="/contact">Contact Support</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <motion.div
                key={activeCategory}
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredPlans.map((plan, planIndex) => {
                  const basePrice = Number(plan.base_price) || 0;
                  const markupPrice = Number(plan.markup_price) || 0;
                  const totalMonthly = basePrice + markupPrice;
                  const totalHourly = totalMonthly / 730;
                  const specs = plan.specifications || {};
                  const networkOutMbits = plan.network_out || 0;

                  return (
                    <motion.div key={plan.id} variants={revealItem}>
                      <Card
                        className={cn(
                          'home-gradient-border-top home-animated-border home-feature-card flex h-full flex-col border-primary/25',
                          planIndex === 0 && 'fx-glow ring-1 ring-primary/25',
                        )}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                            {plan.type_class && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {getCategoryLabel(plan.type_class)}
                              </Badge>
                            )}
                          </div>
                          {plan.description && (
                            <CardDescription>{plan.description}</CardDescription>
                          )}
                          <div className="pt-2">
                            <span className="text-3xl font-bold">{formatMonthly(totalMonthly)}</span>
                            <span className="text-muted-foreground">/month</span>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(totalHourly)} per hour
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1">
                          <div className="space-y-3">
                            {specs.vcpus && (
                              <div className="flex items-center gap-3">
                                <Cpu className="h-4 w-4 text-primary" />
                                <span className="text-sm">{formatResource(specs.vcpus, 'vCPU')}</span>
                              </div>
                            )}
                            {(specs.memory || specs.memory_gb) && (
                              <div className="flex items-center gap-3">
                                <MemoryStick className="h-4 w-4 text-primary" />
                                <span className="text-sm">
                                  {specs.memory_gb ? `${specs.memory_gb}GB` : `${Math.round(specs.memory / 1024)}GB`} Memory
                                </span>
                              </div>
                            )}
                            {(specs.disk || specs.storage_gb) && (
                              <div className="flex items-center gap-3">
                                <HardDrive className="h-4 w-4 text-primary" />
                                <span className="text-sm">
                                  {specs.storage_gb ? `${specs.storage_gb}GB` : `${Math.round(specs.disk / 1024)}GB`} SSD Storage
                                </span>
                              </div>
                            )}
                            {(specs.transfer || specs.transfer_gb || specs.bandwidth_gb) && (
                              <div className="flex items-center gap-3">
                                <ArrowDownUp className="h-4 w-4 text-primary" />
                                <span className="text-sm">
                                  {(() => {
                                    const gb = specs.transfer_gb || specs.bandwidth_gb || specs.transfer;
                                    return gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`;
                                  })()} Transfer
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <ArrowDown className="h-4 w-4 text-primary" />
                              <span className="text-sm">40 Gbps Network In per VPS</span>
                            </div>
                            {networkOutMbits > 0 && (
                              <div className="flex items-center gap-3">
                                <ArrowUp className="h-4 w-4 text-primary" />
                                <span className="text-sm">{formatNetworkSpeed(networkOutMbits)} Network Out</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <Shield className="h-4 w-4 text-primary" />
                              <span className="text-sm">
                                {plan.daily_backups_enabled || plan.weekly_backups_enabled ? 'Backups Available' : 'No Backups'}
                              </span>
                            </div>
                          </div>

                          {((Number(plan.backup_price_monthly) || 0) > 0 || (Number(plan.backup_upcharge_monthly) || 0) > 0) && (
                            <div className="pt-2 border-t border-border/60">
                              <p className="text-xs text-muted-foreground mb-1">Backup Pricing:</p>
                              <p className="text-sm">
                                +{formatMonthly((Number(plan.backup_price_monthly) || 0) + (Number(plan.backup_upcharge_monthly) || 0))}/month
                              </p>
                            </div>
                          )}
                        </CardContent>

                        <CardFooter>
                          <Button asChild className="w-full">
                            <Link to="/register">
                              Get Started
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* All Plans Include */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16"
            >
              <Card className="home-gradient-border-top home-glass-panel border-primary/25">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-6 text-lg">All Plans Include:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      'Full root access',
                      'Web-based SSH console',
                      'Multiple Linux distributions',
                      'Instant deployment (45 seconds)',
                      'High-performance SSD storage',
                      'DDoS protection',
                      'IPv4 and IPv6 support',
                      '99.9% uptime SLA',
                      '40 Gbps inbound network per VPS',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Call to Action */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative mt-20 overflow-hidden rounded-sm"
            >
              <div className="home-orb home-orb--1 pointer-events-none" aria-hidden="true" />
              <div className="home-orb home-orb--2 pointer-events-none" aria-hidden="true" />

              <Card className="home-cta-shell border-border/40 border-primary/25">
                <CardContent className="py-16">
                  <div className="text-center relative">
                    <Badge
                      variant="outline"
                      className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary mx-auto mb-6"
                    >
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Ready to Deploy?
                    </Badge>
                    <h2 className="text-3xl font-semibold mb-6">Ready to Get Started?</h2>
                    <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                      Create your {BRAND_NAME} account today and start deploying your infrastructure in minutes.
                      Add funds to your wallet and pay only for what you use.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <Button size="lg" asChild className="px-8 home-btn-glow group">
                        <Link to="/register">
                          Create Account
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                      <Button size="lg" variant="outline" asChild className="px-8">
                        <Link to="/contact">Contact Sales</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
              </TabsContent>
              )}

              {hostingEnabled && (
                <TabsContent value="hosting" className="mt-0">
                  <HostingPricingSection plans={hostingPlans} />
                </TabsContent>
              )}
            </Tabs>
            )}
          </div>
        </section>

        {/* Pricing Footer Info */}
        <div className="border-t border-border/60 bg-muted/20 mt-0">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {vpsProductEnabled && 'All prices are in USD. VPS instances are billed hourly.'}
                {vpsProductEnabled && hostingEnabled && ' '}
                {hostingEnabled && 'Hosting plans are monthly subscriptions on GVPS.Cloud-operated servers; Enhance is the control panel used to manage websites, databases, mailboxes, and FTP users.'}
                {!vpsProductEnabled && !hostingEnabled && 'Product pricing will appear here when offerings are enabled for this deployment.'}
              </p>
              <p className="mt-2">
                Questions about pricing? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>
              </p>
            </div>
          </div>
        </div>
    </MarketingPageShell>
  );
};

export default PricingPage;
