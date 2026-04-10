import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  Globe2,
  Lock,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wallet,
  Zap,
  Users,
  Activity,
  Star,
  MapPin,
  TrendingUp,
  Database,
  type LucideIcon,
} from "lucide-react";

import "@/styles/home.css";
import { BRAND_NAME } from "@/lib/brand";
import { API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ParticleGlobe from "@/components/home/ParticleGlobe";
import GlobeRegionPanel from "@/components/home/GlobeRegionPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

/* ─── Types ──────────────────────────────────────────────────────── */

interface MetricCard {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}

interface PlatformCard {
  title: string;
  description: string;
  metric: string;
  icon: LucideIcon;
  span?: string;
}

type CapabilityKey = "deploy" | "teams" | "protect";

interface RegionData {
  id: string;
  label: string;
  country: string;
  status: string;
  site_type: string;
  displayLabel?: string;
  displayCountry?: string;
  speedTestUrl?: string;
  capabilities?: string[];
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

/* ─── Helpers ────────────────────────────────────────────────────── */

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;

const parseNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const AnimatedCounter = ({
  value,
  suffix = "",
  duration = 2,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start: number;
    let raf: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      setCount(Math.floor(p * value));
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {count}
      {suffix}
    </>
  );
};

/* ─── Data ───────────────────────────────────────────────────────── */

const capabilityTabs: Array<{
  key: CapabilityKey;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
  callouts: Array<{ label: string; value: string }>;
}> = [
  {
    key: "deploy",
    label: "Compute",
    icon: Server,
    title: "High-performance virtual machines",
    description:
      "Spin up Linux distributions instantly. Get full root access and scale resources up as your application grows.",
    bullets: [
      "Provisioning times under 45 seconds",
      "Full root access & seamless web-based SSH console",
      "Multiple Linux distributions (Ubuntu, Debian, AlmaLinux, etc.)",
    ],
    callouts: [
      { label: "Deployment", value: "Instant" },
      { label: "Storage", value: "NVMe SSD" },
      { label: "Network", value: "IPv4 & IPv6" },
    ],
  },
  {
    key: "teams",
    label: "Teams & Orgs",
    icon: Users,
    title: "Collaborate securely with your team",
    description:
      "Organize your infrastructure into workspaces. Invite developers, assign roles, and manage permissions without sharing credentials.",
    bullets: [
      "Create multiple organization workspaces",
      "Granular roles: Owner, Admin, Member",
      "Centralized billing and resource tracking per team",
    ],
    callouts: [
      { label: "Workspaces", value: "Unlimited" },
      { label: "Access", value: "Role-based" },
      { label: "Collaboration", value: "Seamless" },
    ],
  },
  {
    key: "protect",
    label: "Security & Billing",
    icon: ShieldCheck,
    title: "Built for resilience and predictability",
    description:
      "Keep your applications online with built-in DDoS protection, automated backups, and a transparent, prepaid wallet billing system.",
    bullets: [
      "Robust DDoS protection available for critical workloads",
      "Automated daily and weekly backup scheduling",
      "Pay-as-you-go hourly billing from a prepaid wallet",
    ],
    callouts: [
      { label: "Uptime SLA", value: "99.9%" },
      { label: "Protection", value: "DDoS Ready" },
      { label: "Billing", value: "By the hour" },
    ],
  },
];

const platformCards: PlatformCard[] = [
  {
    icon: Zap,
    title: "Lightning Fast Setup",
    description:
      "From account creation to a running server in less than a minute. Skip the complexity and start building immediately.",
    metric: "45s average deployment",
    span: "sm:col-span-2 xl:col-span-1",
  },
  {
    icon: TerminalSquare,
    title: "Browser-Based SSH",
    description:
      "Access your server's terminal directly from our dashboard. No need to manage local SSH keys or external clients.",
    metric: "Instant root access",
    span: "xl:col-span-2",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description:
      "Your data is protected with industry-standard encryption, role-based access control, and robust firewall options.",
    metric: "Secure by design",
  },
  {
    icon: Globe2,
    title: "Global Network",
    description:
      "Deploy your applications closer to your users. Choose from multiple strategic regions worldwide.",
    metric: "Low-latency delivery",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    description:
      "Keep an eye on CPU, memory, and network usage with live telemetry and historical graphs.",
    metric: "Full visibility",
  },
  {
    icon: Wallet,
    title: "Predictable Pricing",
    description:
      "Fund your wallet and pay only for the hours you use. No hidden fees, no complicated contracts.",
    metric: "Hourly precision",
    span: "sm:col-span-2 xl:col-span-1",
  },
  {
    icon: Database,
    title: "Automated Backups",
    description:
      "Schedule daily or weekly backups with one click. Restore your server to any point in time.",
    metric: "Point-in-time restore",
  },
  {
    icon: Code2,
    title: "REST API",
    description:
      "Manage your infrastructure programmatically. Full REST API with SDK support for automation and integration.",
    metric: "Full API access",
  },
];

const faqs = [
  {
    question: "What exactly is " + BRAND_NAME + "?",
    answer:
      BRAND_NAME +
      " is a modern cloud hosting provider. We provide high-performance Virtual Private Servers (VPS) directly to developers, startups, and businesses to host their applications, websites, and services.",
  },
  {
    question: "How does the billing work?",
    answer:
      "We use a straightforward prepaid wallet system. You add funds to your account via PayPal, and we deduct the cost of your active servers on an hourly basis. You only pay for what you use, and there are no surprise bills at the end of the month.",
  },
  {
    question: "Do I get full root access?",
    answer:
      "Yes! Every VPS comes with full root access, giving you complete control over your server environment to install and configure any software you need.",
  },
  {
    question: "Can I host multiple projects and share access with my team?",
    answer:
      "Absolutely. You can create 'Organizations' within your account, representing different teams or projects. You can invite team members to specific organizations and assign them roles (like Admin or Member) to control what they can view and modify.",
  },
  {
    question: "Do you offer DDoS protection?",
    answer:
      "Yes, we offer robust DDoS protection options to ensure your applications stay online and accessible, even during targeted attacks.",
  },
  {
    question: "Do you support nested virtualization?",
    answer:
      "No, we do not support nested virtualization (nested KVM) on our platform at this time. Our infrastructure is optimized for direct workloads and containerization rather than running hypervisors within our VMs.",
  },
  {
    question: "What is egress billing and how does it work?",
    answer:
      "Egress is the outbound network data sent from your VPS to the internet. We use a prepaid credit model: you purchase egress credit packs in advance (starting at $0.50 for 100GB), and your usage is automatically deducted from your balance every hour. This keeps your costs predictable with no surprise bills.",
  },
  {
    question: "What happens if my egress credits run out?",
    answer:
      "When your organization's egress credit balance reaches zero, your VPS instances may be suspended to prevent unbilled network usage. You'll receive notifications before your balance runs low, and you can purchase additional credit packs at any time to restore service immediately.",
  },
];

const testimonials = [
  {
    quote:
      "The deployment speed is incredible. We went from signup to having our production servers running in under 5 minutes. The unified dashboard gives us complete visibility.",
    name: "Marcus Chen",
    role: "DevOps Engineer",
    rating: 5,
    results: [
      { metric: "99.9% uptime", period: "6 months" },
      { metric: "5 min deploy", period: "vs 2 hours" },
    ],
    avatar: "MC",
    location: "San Francisco, CA",
  },
  {
    quote:
      "Finally, a platform that combines VPS and application hosting with transparent billing. The cost savings have been significant for our startup.",
    name: "Sarah Williams",
    role: "CTO",
    rating: 5,
    results: [
      { metric: "40% cost reduction", period: "monthly" },
      { metric: "2x performance", period: "vs previous" },
    ],
    avatar: "SW",
    location: "Austin, TX",
  },
  {
    quote:
      "The web-based SSH console and real-time monitoring have transformed how we manage our infrastructure. It's like having a datacenter in our browser.",
    name: "David Rodriguez",
    role: "Infrastructure Lead",
    rating: 5,
    results: [
      { metric: "3x faster deployments", period: "average" },
      { metric: "Zero downtime", period: "12 months" },
    ],
    avatar: "DR",
    location: "Miami, FL",
  },
];

const solutionCards = [
  {
    icon: Code2,
    title: "Developers & Builders",
    detail:
      "Spin up a Linux instance in seconds to test your code, run containers, or host your personal projects.",
    bullets: ["Full root access", "Instant provisioning", "Predictable costs"],
  },
  {
    icon: Users,
    title: "Startups & Agencies",
    detail:
      "Create dedicated workspaces for different projects. Collaborate with your team securely.",
    bullets: [
      "Organization workspaces",
      "Role-based access",
      "Centralized billing",
    ],
  },
  {
    icon: Server,
    title: "Production Workloads",
    detail:
      "Host critical applications with confidence using our reliable infrastructure and security tools.",
    bullets: [
      "99.9% uptime SLA",
      "DDoS protection options",
      "Automated backups",
    ],
  },
];

const trustItems = [
  { icon: Server, label: "High Performance NVMe" },
  { icon: ShieldCheck, label: "DDoS Protection" },
  { icon: Users, label: "Built for Teams" },
  { icon: Wallet, label: "Hourly Billing" },
  { icon: Globe2, label: "Global Regions" },
  { icon: Lock, label: "Encrypted at Rest" },
];

/* ─── Social Proof Component ────────────────────────────────────── */

function SocialProof() {
  const { data: orgData } = useQuery({
    queryKey: ['public-organizations'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/health/organizations`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const orgInitials = useMemo(() => {
    const fallbackInitials =
      BRAND_NAME.trim().substring(0, 2).toUpperCase() || "??";

    if (orgData?.organizations?.length > 0) {
      return orgData.organizations
        .slice(0, 3)
        .map((org: { name: string }) => {
          const name = (org.name || '').trim();

          if (!name) {
            return fallbackInitials;
          }

          const words = name.split(/\s+/).filter(Boolean);
          if (words.length > 1 && words[0]?.[0] && words[1]?.[0]) {
            return `${words[0][0]}${words[1][0]}`.toUpperCase();
          }

          return (name.substring(0, 2) || fallbackInitials).toUpperCase();
        });
    }
    return [fallbackInitials];
  }, [orgData]);

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <div className="flex -space-x-2">
        {orgInitials.map((initials, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center ring-2 ring-background text-[9px] font-bold text-primary"
          >
            {initials}
          </div>
        ))}
      </div>
      <span>
        Join teams already using {BRAND_NAME}
      </span>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function HomeRedesign() {
  const [regionCount, setRegionCount] = useState(10);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [activeCapability, setActiveCapability] =
    useState<CapabilityKey>("deploy");
  const [regionsData, setRegionsData] = useState<RegionData[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionData | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const read = async (path: string) => {
        try {
          const r = await fetch(path);
          if (!r.ok) return null;
          return asRecord(await r.json());
        } catch {
          return null;
        }
      };

      const [regData, priceData] = await Promise.all([
        read("/api/pricing/public-regions"),
        read("/api/pricing/vps"),
      ]);

      if (!mounted) return;

      if (regData?.success === true) {
        const regions = regData.regions;
        if (Array.isArray(regions) && regions.length > 0) {
          setRegionCount(regions.length);
          setRegionsData(regions as RegionData[]);
        } else {
          const c = parseNumber(regData.count);
          if (c !== null && c > 0) setRegionCount(c);
        }
      }

      if (priceData) {
        const plans = priceData.plans;
        if (Array.isArray(plans)) {
          const values = plans
            .map((p) => {
              const rec = asRecord(p);
              return (parseNumber(rec?.base_price) ?? 0) + (parseNumber(rec?.markup_price) ?? 0);
            })
            .filter((v) => Number.isFinite(v) && v > 0);
          if (values.length > 0) setLowestPrice(Math.min(...values));
        }
      }

      setPricingLoading(false);
    };

    void load();
    return () => { mounted = false; };
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [location.hash]);

  const heroMetrics: MetricCard[] = useMemo(
    () => [
      {
        label: "Global locations",
        value: `${regionCount}+`,
        detail: "Deploy close to your users",
        icon: Globe2,
      },
      {
        label: "Deployment time",
        value: "~45s",
        detail: "From click to root access",
        icon: Clock3,
      },
      {
        label: "Uptime guarantee",
        value: "99.9%",
        detail: "Reliability you can trust",
        icon: ShieldCheck,
      },
    ],
    [regionCount],
  );

  const activeTab =
    capabilityTabs.find((t) => t.key === activeCapability) ?? capabilityTabs[0];

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section className="relative overflow-hidden border-b border-border/40">
          {/* Floating orbs */}
          <div className="home-orb home-orb--1" aria-hidden />
          <div className="home-orb home-orb--2" aria-hidden />
          <div className="home-orb home-orb--3" aria-hidden />
          <div className="home-grid-mask absolute inset-0" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-24 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-28">
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
                  Next-Gen Cloud Infrastructure Platform
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Cloud Infrastructure{" "}
                  <br className="hidden sm:block" />
                  Management,
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    Simplified
                  </span>
                </h1>

                <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Deploy VPS instances in seconds with unified billing,
                  real-time monitoring, and enterprise-grade security.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 px-7 home-btn-glow group"
                  asChild
                >
                  <Link to="/register">
                    Deploy Your First Server
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7"
                  asChild
                >
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>

              {/* Metric cards with connecting line */}
              <div className="relative grid gap-4 sm:grid-cols-3">
                <div className="hidden sm:block absolute top-1/2 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-primary/10 via-primary/25 to-primary/10 -translate-y-1/2 z-0" />
                {heroMetrics.map((metric) => (
                  <motion.div
                    key={metric.label}
                    className="relative z-10 flex flex-col rounded-xl p-4 home-glass-panel home-animated-border border-primary/15 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{metric.label}</span>
                      <metric.icon className="h-4 w-4 text-primary/70" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">
                      {metric.value.includes("+") ||
                      metric.value.includes("%") ? (
                        metric.value
                      ) : (
                        <AnimatedCounter
                          value={
                            parseInt(metric.value.replace(/\D/g, "")) || 0
                          }
                          suffix={metric.value.replace(/[\d,]/g, "")}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.detail}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Globe */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hero-globe-container"
            >
              <div className="home-globe-glow" aria-hidden />
              <ParticleGlobe
                regions={regionsData}
                onRegionSelect={setSelectedRegion}
                selectedRegion={selectedRegion}
                displayMode="pixel"
                disableClick={true}
              />
              <GlobeRegionPanel
                region={selectedRegion}
                onClose={() => setSelectedRegion(null)}
              />
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

        {/* ═══════════════════ PLATFORM — BENTO GRID ════════════════════ */}
        <section id="platform" className="py-24 sm:py-28">
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
                Why {BRAND_NAME}
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything you need to host modern applications.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A cloud platform that strips away the complexity. Powerful
                virtual machines, straightforward billing, and tools designed for
                collaboration.
              </p>
            </motion.div>

            <motion.div
              variants={revealContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              {platformCards.map((card) => (
                <motion.div
                  key={card.title}
                  variants={revealItem}
                  className={card.span}
                >
                  <Card className="h-full home-gradient-border-top border-border/50 bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.04]">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
                        <card.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                          {card.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                        {card.metric}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════ CAPABILITIES TABS ═══════════════════════ */}
        <section
          id="capabilities"
          className="border-y border-border/40 bg-muted/20 py-24 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="space-y-6"
            >
              <div>
                <Badge
                  variant="outline"
                  className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary"
                >
                  Features
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  A complete toolkit for your infrastructure.
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Explore how our platform helps you deploy servers, manage your
                  team, and keep your costs predictable.
                </p>
              </div>

              <div className="space-y-2">
                {capabilityTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCapability(tab.key)}
                    className={`relative flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all ${
                      activeCapability === tab.key
                        ? "border-primary/40 bg-primary/[0.07] text-foreground shadow-sm"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                    }`}
                  >
                    {activeCapability === tab.key && (
                      <motion.div
                        layoutId="capability-indicator"
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="flex items-center gap-3 pl-2">
                      <tab.icon className="h-4 w-4" />
                      <span className="font-medium">{tab.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 opacity-50" />
                  </button>
                ))}
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border/50 bg-card/80 shadow-xl backdrop-blur h-full">
                  <CardContent className="space-y-6 p-6 sm:p-8 h-full flex flex-col justify-center">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {activeTab.title}
                      </h3>
                      <p className="mt-3 text-muted-foreground leading-relaxed">
                        {activeTab.description}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {activeTab.callouts.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-border/50 bg-gradient-to-b from-background/80 to-muted/30 p-3.5"
                        >
                          <p className="text-xs text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-semibold tracking-tight">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/40">
                      {activeTab.bullets.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                          <p className="text-sm text-foreground">{point}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ═══════════════════════ SOLUTIONS ═══════════════════════════ */}
        <section id="solutions" className="py-24 sm:py-28">
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
                Built For You
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                The foundation for your next big idea.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Whether you're a solo developer testing an app or a growing
                business scaling production workloads.
              </p>
            </motion.div>

            <div className="grid gap-5 md:grid-cols-3">
              {solutionCards.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <Card className="h-full home-feature-card group">
                    <CardContent className="space-y-5 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <item.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed min-h-[48px]">
                        {item.detail}
                      </p>
                      <ul className="space-y-2 text-sm font-medium text-foreground">
                        {item.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/register"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline pt-1"
                      >
                        Get started
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ════════════════════════════ */}
        <section className="py-24 sm:py-28 border-y border-border/40 bg-muted/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center mb-16"
            >
              <Badge
                variant="outline"
                className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary"
              >
                Getting Started
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                From Zero to{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Live Infrastructure
                </span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Get your infrastructure up and running in minutes, not hours.
              </p>
            </motion.div>

            <div className="relative">
              <div className="hidden lg:block home-timeline-connector" />
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    num: "01",
                    title: "Sign Up & Add Funds",
                    desc: "Create your account and add funds to your wallet via PayPal.",
                    icon: Users,
                  },
                  {
                    num: "02",
                    title: "Choose Infrastructure",
                    desc: "Select your VPS plan, region, and operating system.",
                    icon: Server,
                  },
                  {
                    num: "03",
                    title: "Deploy Instantly",
                    desc: "Launch your infrastructure in under 45 seconds.",
                    icon: Rocket,
                  },
                  {
                    num: "04",
                    title: "Monitor & Manage",
                    desc: "Track performance and scale through one dashboard.",
                    icon: Activity,
                  },
                ].map((step, i) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.12 }}
                    className="relative"
                  >
                    <Card className="h-full home-feature-card group">
                      <CardContent className="p-6 text-center">
                        <div className="relative mb-5 inline-flex">
                          <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/50 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-primary/10 group-hover:scale-105 transition-transform duration-300">
                            <step.icon className="w-6 h-6 text-primary-foreground" />
                          </div>
                          <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-[10px] font-bold text-primary ring-2 ring-primary/30">
                            {step.num}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold mb-2 text-foreground">
                          {step.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.desc}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ TESTIMONIALS ════════════════════════════ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center mb-16"
            >
              <Badge
                variant="outline"
                className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary"
              >
                Trusted by Teams
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What Our Customers Say
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Join teams who trust {BRAND_NAME} for their infrastructure
                needs.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
              {testimonials.map((test, idx) => {
                const isFeatured = idx === 1;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                    whileHover={{ y: -4 }}
                    className={`touch-manipulation ${isFeatured ? "lg:-mt-4 lg:mb-4" : ""}`}
                  >
                    <Card
                      className={`h-full home-feature-card group ${isFeatured ? "ring-1 ring-primary/20 shadow-lg" : ""}`}
                    >
                      <CardContent className="p-7 home-testimonial-quote">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-1">
                            {[...Array(test.rating)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 text-yellow-500 fill-yellow-500"
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {test.location}
                          </div>
                        </div>

                        <p className="relative z-10 text-sm text-muted-foreground leading-relaxed italic mb-6">
                          &ldquo;{test.quote}&rdquo;
                        </p>

                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary/25 to-primary/50 rounded-full flex items-center justify-center ring-2 ring-primary/15">
                            <span className="text-primary font-bold text-xs">
                              {test.avatar}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">
                              {test.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {test.role}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-4 border-t border-border/30">
                          {test.results.map((r, i) => (
                            <div
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/[0.07] text-primary text-xs font-semibold rounded-full border border-primary/15"
                            >
                              <TrendingUp className="w-3 h-3" />
                              {r.metric}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════ PRICING PREVIEW ═════════════════════════ */}
        <section className="border-y border-border/40 bg-muted/20 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center mb-12"
            >
              <Badge
                variant="outline"
                className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary"
              >
                Transparent Pricing
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pay only for the resources you use.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Add funds to your prepaid wallet and instances are billed by the
                hour. No hidden fees, no long-term contracts.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto max-w-md"
            >
              <Card className="home-animated-border border-primary/20 bg-gradient-to-b from-card to-background shadow-2xl">
                <CardContent className="space-y-5 p-8 text-center">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    VPS Plans Starting At
                  </p>
                  <p className="text-5xl font-bold tracking-tight text-primary">
                    {pricingLoading ? "…" : `$${lowestPrice ?? 5}`}
                    <span className="text-lg text-muted-foreground font-normal">
                      /mo
                    </span>
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "NVMe SSD storage",
                      "Full root access",
                      "DDoS protection options",
                      "Billed hourly from your wallet",
                    ].map((f) => (
                      <div key={f} className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <Button
                    asChild
                    className="w-full home-btn-glow shadow-md"
                    size="lg"
                  >
                    <Link to="/pricing">View All Plans</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════ FAQ ═════════════════════════════════ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:px-8">
            <div className="space-y-5">
              <Badge
                variant="outline"
                className="rounded-full px-4 py-1.5 border-primary/30 text-primary"
              >
                FAQ
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Frequently asked questions.
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about hosting with {BRAND_NAME}.
              </p>
              <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-6">
                <p className="text-sm font-semibold text-foreground">
                  Still have questions?
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground mb-4">
                  Our support team is ready to help you get started.
                </p>
                <Button variant="outline" asChild className="home-btn-glow">
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="home-faq-item rounded-xl border border-border/50 bg-card/40 px-5 shadow-sm transition-colors data-[state=open]:border-primary/30 data-[state=open]:bg-card/70"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:text-primary hover:no-underline py-4 sm:text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════════════ CTA ═════════════════════════════════ */}
        <section className="pb-24 sm:pb-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="home-cta-shell relative overflow-hidden rounded-3xl border border-border/50 px-6 py-16 text-center sm:px-12 shadow-2xl">
              {/* Floating orbs in CTA */}
              <div
                className="home-orb absolute w-[300px] h-[300px] -top-[100px] -left-[80px] opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
                  filter: "blur(60px)",
                  animation: "float-orb-1 16s ease-in-out infinite",
                }}
                aria-hidden
              />
              <div
                className="home-orb absolute w-[250px] h-[250px] -bottom-[80px] -right-[60px] opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)",
                  filter: "blur(60px)",
                  animation: "float-orb-2 20s ease-in-out infinite",
                }}
                aria-hidden
              />

              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Ready to launch your server?
                </h2>
                <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                  Create your account, add funds, and deploy a high-performance
                  Linux VPS in less than a minute.
                </p>

                <SocialProof />

                <div className="flex flex-col justify-center gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base home-btn-glow"
                    asChild
                  >
                    <Link to="/register">Create Account</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-12 px-8 text-base border border-border/40"
                    asChild
                  >
                    <Link to="/pricing">View Pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
