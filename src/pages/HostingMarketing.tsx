import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Globe,
  Mail,
  PanelsTopLeft,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import "@/styles/home.css";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { BRAND_NAME } from "@/lib/brand";
import type { HostingPlan } from "@/hooks/useHosting";

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

const capabilities = [
  {
    icon: PanelsTopLeft,
    title: "Website control panel",
    description:
      "Manage purchased websites from the dashboard and open the hosting panel when your account has an active subscription.",
  },
  {
    icon: Mail,
    title: "Email and domains",
    description:
      "Use the configured hosting integration for website, DNS, SSL, email, database, and application workflows.",
  },
  {
    icon: Wallet,
    title: "Dedicated hosting wallet",
    description:
      "Keep monthly website hosting spend separate from VPS spend with a hosting wallet that can be funded from your main wallet or PayPal.",
  },
  {
    icon: ShieldCheck,
    title: "Organization-aware access",
    description:
      "Hosting subscriptions appear alongside organization resources, permissions, support, and billing history.",
  },
];

const formatMonthly = (amount: number | string | null | undefined): string => {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;

  if (!Number.isFinite(value ?? NaN) || (value ?? 0) < 0) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
};

const formatResource = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === -1) return "Unlimited";
  return String(value);
};

const getFeatureRows = (plan: HostingPlan) => {
  const rows: string[] = [];
  const resources = plan.features?.resources ?? {};

  for (const [key, resource] of Object.entries(resources)) {
    const label = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    rows.push(`${formatResource(resource.total)} ${label}`);
  }

  if (plan.features?.allowances?.length) {
    rows.push(...plan.features.allowances);
  }

  return rows.slice(0, 5);
};

export default function HostingMarketing() {
  const [enabled, setEnabled] = useState(false);
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      try {
        const response = await apiClient.get<{
          enabled?: boolean;
          plans?: HostingPlan[];
        }>("/pricing/hosting");

        if (!mounted) return;
        setEnabled(response.enabled === true);
        setPlans(response.plans ?? []);
      } catch {
        if (!mounted) return;
        setEnabled(false);
        setPlans([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="home-orb home-orb--1" aria-hidden />
          <div className="home-orb home-orb--2" aria-hidden />
          <div className="home-grid-mask absolute inset-0" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-24 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:pb-24 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full border-primary/30 bg-primary/5 px-4 py-1.5 text-primary"
                >
                  <Globe className="mr-2 h-3.5 w-3.5" />
                  Enhance Web Hosting
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                  Website hosting managed from the same{" "}
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text font-bold text-transparent">
                    {BRAND_NAME}
                  </span>{" "}
                  console.
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Offer and manage Enhance-backed websites, domains, email, SSL,
                  databases, billing, and support without separating hosting from
                  the rest of your cloud workflow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 px-7 home-btn-glow group" asChild>
                  <Link to="/register">
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-7" asChild>
                  <Link to="/pricing">View Hosting Pricing</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <Card className="home-glass-panel home-animated-border">
                <CardContent className="space-y-5 p-6">
                  {[
                    ["Hosting catalog", enabled ? "Enabled" : "Available when configured"],
                    ["Active plans", isLoading ? "Loading" : String(plans.length)],
                    ["Billing model", "Dedicated wallet"],
                    ["Management", "Panel SSO"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 p-4"
                    >
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={revealContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"
            >
              {capabilities.map((item) => (
                <motion.div key={item.title} variants={revealItem}>
                  <Card className="home-gradient-border-top home-feature-card h-full">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="border-y border-border/40 bg-muted/20 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge
                variant="outline"
                className="mb-4 rounded-full border-primary/30 px-4 py-1.5 text-primary"
              >
                Live Catalog
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Hosting plans come from your configured platform catalog.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                We avoid hardcoded plan promises here. When Enhance is enabled,
                the available plans below are loaded from the same catalog used
                by checkout.
              </p>
            </div>

            {!enabled ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <PanelsTopLeft className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-medium">Hosting catalog is not enabled</h3>
                  <p className="mx-auto max-w-xl text-muted-foreground">
                    Web hosting can be enabled by configuring the Enhance integration and active hosting plans.
                  </p>
                </CardContent>
              </Card>
            ) : plans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-medium">No active hosting plans yet</h3>
                  <p className="mx-auto max-w-xl text-muted-foreground">
                    Enhance hosting is enabled, but no active plans are configured for checkout.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <Card key={plan.id} className="home-feature-card flex h-full flex-col">
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      <p className="pt-2 text-3xl font-bold">
                        {formatMonthly(plan.price_monthly)}
                        <span className="text-base font-normal text-muted-foreground">/month</span>
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      {(getFeatureRows(plan).length > 0 ? getFeatureRows(plan) : ["Managed website hosting"]).map((feature) => (
                        <div key={feature} className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
