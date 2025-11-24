/**
 * Pricing Page
 * 
 * Public-facing pricing page that displays available VPS plans with transparent pricing
 * information. Includes plan specifications, hourly/monthly rates, and feature comparisons.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Network,
  Shield,
  AlertCircle,
  ArrowRight,
  Cloud,
} from 'lucide-react';
import type { VPSPlan } from '@/types/vps';
import { BRAND_NAME } from '@/lib/brand';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

interface PaaSPlan {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  plan_type: 'monthly' | 'per_resource' | 'custom';
  monthly_price?: number | string | null;
  cpu_cores?: number | string | null;
  ram_mb?: number | null;
  disk_gb?: number | null;
  bandwidth_gb?: number | null;
  max_applications?: number | null;
  buildpack_support?: boolean;
  custom_domain_support?: boolean;
  ssl_support?: boolean;
  is_default?: boolean;
}

const PricingPage: React.FC = () => {
  const [vpsPlans, setVpsPlans] = useState<VPSPlan[]>([]);
  const [paasPlans, setPaasPlans] = useState<PaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vps' | 'paas'>('vps');

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [vpsResponse, paasResponse] = await Promise.all([
        fetch('/api/pricing/vps'),
        fetch('/api/pricing/paas'),
      ]);

      const vpsResult = await vpsResponse.json().catch(() => ({}));
      const paasResult = await paasResponse.json().catch(() => ({}));

      if (!vpsResponse.ok) {
        console.warn('VPS plans fetch failed:', (vpsResult as any).error);
      } else {
        console.log('VPS plans loaded:', vpsResult.plans?.length || 0);
        setVpsPlans(vpsResult.plans || []);
      }

      if (!paasResponse.ok) {
        console.warn('PaaS plans fetch failed:', (paasResult as any).error);
      } else {
        console.log('PaaS plans loaded:', paasResult.plans?.length || 0);
        setPaasPlans(paasResult.plans || []);
      }

      if (!vpsResponse.ok && !paasResponse.ok) {
        setError('Failed to load pricing information');
      }
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing information');
      setVpsPlans([]);
      setPaasPlans([]);
    } finally {
      setLoading(false);
    }
  };

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
    // Handle special pluralization cases
    const pluralizeUnit = (unit: string, count: number): string => {
      if (count === 1) return unit;
      
      // Special cases that don't follow standard pluralization
      const specialCases: Record<string, string> = {
        'GB Memory': 'GB Memory',
        'GB Storage': 'GB Storage',
        'Memory': 'Memory',
        'Storage': 'Storage'
      };
      
      if (specialCases[unit]) {
        return specialCases[unit];
      }
      
      // Standard pluralization for other units
      return `${unit}s`;
    };
    
    return `${value} ${pluralizeUnit(unit, value)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <MarketingNavbar />
      
      <main className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-6 border-primary/40 bg-primary/10 text-primary">
            Transparent Pricing
          </Badge>
          <h1 className="text-4xl font-bold mb-6 lg:text-5xl">
            Simple, Predictable Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Choose from VPS instances and PaaS application plans. Pay only for what you use with transparent billing.
          </p>
        </div>

        {error && (
          <Alert className="mb-8" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pricing tabs */}
        <div className="flex justify-center mb-12 px-4">
          <div className="inline-flex bg-card rounded-xl p-1 shadow-sm border border-border flex-wrap justify-center max-w-full backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setActiveTab('vps')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 rounded-lg transition-all duration-300 touch-manipulation ${
                activeTab === 'vps'
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Server className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">VPS Instances</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paas')}
              className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 rounded-lg transition-all duration-300 touch-manipulation ${
                activeTab === 'paas'
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Cloud className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">PaaS Application Plans</span>
            </button>
          </div>
        </div>

        {/* VPS Plans */}
        {activeTab === 'vps' && (
        <div className="space-y-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4">VPS Instances</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              High-performance virtual private servers with full root access and SSH console
            </p>
          </div>

            {vpsPlans.length === 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vpsPlans.map((plan) => {
                  // Safely calculate prices with fallbacks
                  const basePrice = Number(plan.base_price) || 0;
                  const markupPrice = Number(plan.markup_price) || 0;
                  const totalMonthly = basePrice + markupPrice;
                  const totalHourly = totalMonthly / 730; // Approximate hours per month
                  const specs = plan.specifications || {};
                  
                  // Debug logging
                  if (totalMonthly === 0) {
                    console.log('VPS Plan with zero price:', {
                      name: plan.name,
                      base_price: plan.base_price,
                      markup_price: plan.markup_price,
                      basePrice,
                      markupPrice,
                      totalMonthly
                    });
                  }

                  return (
                    <Card key={plan.id} className="relative border border-border/60 bg-card hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
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

                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          {specs.vcpus && (
                            <div className="flex items-center gap-3">
                              <Cpu className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">
                                {formatResource(specs.vcpus, 'vCPU')}
                              </span>
                            </div>
                          )}
                          
                          {(specs.memory || specs.memory_gb) && (
                            <div className="flex items-center gap-3">
                              <MemoryStick className="h-4 w-4 text-green-600" />
                              <span className="text-sm">
                                {specs.memory_gb ? `${specs.memory_gb}GB` : `${Math.round(specs.memory / 1024)}GB`} Memory
                              </span>
                            </div>
                          )}
                          
                          {(specs.disk || specs.storage_gb) && (
                            <div className="flex items-center gap-3">
                              <HardDrive className="h-4 w-4 text-purple-600" />
                              <span className="text-sm">
                                {specs.storage_gb ? `${specs.storage_gb}GB` : `${Math.round(specs.disk / 1024)}GB`} SSD Storage
                              </span>
                            </div>
                          )}
                          
                          {(specs.transfer || specs.transfer_gb || specs.bandwidth_gb) && (
                            <div className="flex items-center gap-3">
                              <Network className="h-4 w-4 text-orange-600" />
                              <span className="text-sm">
                                {specs.transfer_gb || specs.bandwidth_gb ? 
                                  `${specs.transfer_gb || specs.bandwidth_gb}GB` : 
                                  `${Math.round(specs.transfer / 1024)}GB`
                                } Transfer
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-red-600" />
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
                  );
                })}
              </div>
            )}

            {/* VPS Features */}
            <Card className="bg-muted/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">VPS Features Include:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    'Full root access',
                    'Web-based SSH console',
                    'Multiple Linux distributions',
                    'Instant deployment (45 seconds)',
                    'High-performance SSD storage',
                    'DDoS protection',
                    'IPv4 and IPv6 support',
                    '99.9% uptime SLA'
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
        </div>
        )}

        {/* PaaS Application Plans */}
        {activeTab === 'paas' && (
        <div className="space-y-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4">PaaS Application Plans</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Application hosting plans with included resources and features for your apps.
            </p>
          </div>
          {paasPlans.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No PaaS Plans Available</h3>
                  <p className="text-muted-foreground mb-4">
                    PaaS pricing plans are not currently configured. Please check back later.
                  </p>
                  <Button asChild variant="outline">
                    <Link to="/contact">Contact Support</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paasPlans.map((plan) => {
                const isMonthly = plan.plan_type === 'monthly';
                const monthlyPrice =
                  isMonthly && plan.monthly_price != null
                    ? Number(plan.monthly_price)
                    : null;

                return (
                  <Card
                    key={plan.id}
                    className="relative border border-border/60 bg-card hover:border-primary/50 transition-colors"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{plan.name}</CardTitle>
                          {plan.description && (
                            <CardDescription>{plan.description}</CardDescription>
                          )}
                        </div>
                        {plan.is_default && (
                          <Badge className="ml-2" variant="secondary">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <div className="pt-2">
                        {isMonthly && monthlyPrice != null ? (
                          <>
                            <span className="text-3xl font-bold">
                              {formatCurrency(monthlyPrice)}
                            </span>
                            <span className="text-muted-foreground">/month</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {plan.plan_type === 'per_resource'
                              ? 'Usage-based pricing'
                              : 'Custom pricing'}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 text-sm">
                      <div className="space-y-3">
                        {plan.cpu_cores != null && (
                          <div className="flex items-center gap-3">
                            <Cpu className="h-4 w-4 text-blue-600" />
                            <span>
                              {typeof plan.cpu_cores === 'string'
                                ? `${parseFloat(plan.cpu_cores)} vCPU`
                                : `${plan.cpu_cores} vCPU`}
                            </span>
                          </div>
                        )}
                        {plan.ram_mb != null && (
                          <div className="flex items-center gap-3">
                            <MemoryStick className="h-4 w-4 text-green-600" />
                            <span>{`${Math.round(plan.ram_mb / 1024)}GB Memory`}</span>
                          </div>
                        )}
                        {plan.disk_gb != null && (
                          <div className="flex items-center gap-3">
                            <HardDrive className="h-4 w-4 text-purple-600" />
                            <span>{`${plan.disk_gb}GB SSD Storage`}</span>
                          </div>
                        )}
                        {plan.bandwidth_gb != null && (
                          <div className="flex items-center gap-3">
                            <Network className="h-4 w-4 text-orange-600" />
                            <span>{`${plan.bandwidth_gb}GB Bandwidth`}</span>
                          </div>
                        )}
                        {plan.max_applications != null && (
                          <div className="flex items-center gap-3">
                            <Server className="h-4 w-4 text-indigo-600" />
                            <span>Up to {plan.max_applications} applications</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-border/60 space-y-1">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>
                            Buildpack deployments{' '}
                            {plan.buildpack_support === false ? 'not included' : 'included'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>
                            {plan.custom_domain_support === false
                              ? 'No custom domains'
                              : 'Custom domains supported'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>
                            {plan.ssl_support === false
                              ? 'Managed SSL not included'
                              : 'Managed SSL included'}
                          </span>
                        </div>
                      </div>
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
                );
              })}
            </div>
          )}

          {/* PaaS Features */}
          <Card className="bg-muted/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">PaaS Features Include:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[ 
                  'Buildpack-based application deployments',
                  'Zero-downtime rolling deployments',
                  'Automatic HTTPS and reverse proxy configuration',
                  'Custom domains and managed SSL certificates',
                  'Scaling services across multiple machines',
                  'Private WireGuard mesh network between services',
                  'DNS-based service discovery and load balancing',
                  'Persistent storage for stateful services',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Call to Action */}
        <Card className="mt-16 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
          <CardContent className="py-16">
            <div className="text-center">
              <h2 className="text-3xl font-semibold mb-6">Ready to Get Started?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                Create your {BRAND_NAME} account today and start deploying your infrastructure in minutes. 
                Add funds to your wallet and pay only for what you use.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" asChild className="px-8">
                  <Link to="/register">Create Account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="px-8">
                  <Link to="/contact">Contact Sales</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Pricing Footer Info */}
      <div className="border-t border-border/60 bg-muted/20 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>All prices are in USD. VPS instances are billed hourly. Container plans are billed monthly.</p>
            <p className="mt-2">
              Questions about pricing? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>
            </p>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
};

export default PricingPage;
