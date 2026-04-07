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
import {
  Loader2,
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
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import '@/styles/home.css';

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

const trustItems = [
  { icon: Clock, label: '99.9% Uptime' },
  { icon: Zap, label: 'Hourly Billing' },
  { icon: Shield, label: 'No Lock-in' },
  { icon: HardDrive, label: 'SSD Storage' },
  { icon: Shield, label: 'DDoS Protection' },
  { icon: Globe, label: '24/7 Support' },
  { icon: Zap, label: 'Instant Deploy' },
  { icon: Server, label: 'Full Root Access' },
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

const PricingPage: React.FC = () => {
  const [vpsPlans, setVpsPlans] = useState<VPSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { data: enabledCategoryMappings = [] } = useEnabledCategoryMappings();

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    setError(null);

    try {
      const vpsResponse = await fetch('/api/pricing/vps');
      const vpsResult = await vpsResponse.json().catch(() => ({}));

      if (!vpsResponse.ok) {
        console.warn('VPS plans fetch failed:', (vpsResult as any).error);
        setError('Failed to load pricing information');
      } else {
        console.log('VPS plans loaded:', vpsResult.plans?.length || 0);
        setVpsPlans(vpsResult.plans || []);
      }
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing information');
      setVpsPlans([]);
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

  const formatCurrency = (amount: number | string | null | undefined): string => {
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
      <div className="min-h-screen bg-background text-foreground">
        <MarketingNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading pricing information...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Transparent Pricing
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Simple, Predictable
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    Pricing
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Choose from our VPS instances. Pay only for what you use with transparent hourly and monthly billing.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 px-7 home-btn-glow group"
                  asChild
                >
                  <Link to="/register">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7"
                  asChild
                >
                  <Link to="/contact">Contact Sales</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* â”€â”€â”€ TRUST MARQUEE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="border-b border-border/40 bg-muted/20 py-6">
          <div className="home-marquee">
            <div className="home-marquee__track">
              {[...trustItems, ...trustItems].map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary/60" />
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                  <span className="ml-4 h-1 w-1 rounded-full bg-border" />
                </div>
              ))}
            </div>
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
                          ? 'bg-primary text-primary-foreground shadow-sm'
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
              <Card>
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
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredPlans.map((plan) => {
                  const basePrice = Number(plan.base_price) || 0;
                  const markupPrice = Number(plan.markup_price) || 0;
                  const totalMonthly = basePrice + markupPrice;
                  const totalHourly = totalMonthly / 730;
                  const specs = plan.specifications || {};
                  const networkOutMbits = plan.network_out || 0;

                  return (
                    <motion.div key={plan.id} variants={revealItem}>
                      <Card className="home-gradient-border-top home-animated-border home-feature-card flex flex-col h-full">
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
                            <span className="text-3xl font-bold">{formatCurrency(totalMonthly)}</span>
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
                              <span className="text-sm">40 Gbps Network In</span>
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
                                +{formatCurrency((Number(plan.backup_price_monthly) || 0) + (Number(plan.backup_upcharge_monthly) || 0))}/month
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
              <Card className="home-gradient-border-top home-glass-panel">
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
                      '40 Gbps inbound network',
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
              className="relative mt-20 overflow-hidden rounded-3xl"
            >
              <div className="home-orb home-orb--1 pointer-events-none" aria-hidden="true" />
              <div className="home-orb home-orb--2 pointer-events-none" aria-hidden="true" />

              <Card className="home-cta-shell border-border/40">
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
          </div>
        </section>

        {/* Pricing Footer Info */}
        <div className="border-t border-border/60 bg-muted/20 mt-0">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-sm text-muted-foreground">
              <p>All prices are in USD. VPS instances are billed hourly.</p>
              <p className="mt-2">
                Questions about pricing? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default PricingPage;
