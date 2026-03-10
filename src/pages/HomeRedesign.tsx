import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock3,
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
  Quote,
  type LucideIcon,
} from "lucide-react";

import "@/styles/home.css";
import { BRAND_NAME } from "@/lib/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

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
}

type CapabilityKey = "deploy" | "teams" | "protect";

const revealContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
};

const parseNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min(
        (currentTime - startTime) / (duration * 1000),
        1,
      );

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <>
      {count}
      {suffix}
    </>
  );
};

const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.92 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-6 right-6 z-50 rounded-full border border-border bg-background/90 p-3 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </motion.button>
  );
};

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
  },
  {
    icon: TerminalSquare,
    title: "Browser-Based SSH",
    description:
      "Access your server's terminal directly from our dashboard. No need to manage local SSH keys or external clients.",
    metric: "Instant root access",
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
  },
];

const faqs = [
  {
    question: "What exactly is " + BRAND_NAME + "?",
    answer:
      BRAND_NAME + " is a modern cloud hosting provider. We provide high-performance Virtual Private Servers (VPS) directly to developers, startups, and businesses to host their applications, websites, and services.",
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

export default function HomeRedesign() {
  const [regionCount, setRegionCount] = useState(10);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [activeCapability, setActiveCapability] =
    useState<CapabilityKey>("deploy");

  useEffect(() => {
    let isMounted = true;

    const loadHomepageData = async () => {
      const readEndpoint = async (path: string) => {
        try {
          const response = await fetch(path);
          if (!response.ok) {
            return null;
          }
          const payload: unknown = await response.json();
          return asRecord(payload);
        } catch {
          return null;
        }
      };

      const [regionsData, pricingData] = await Promise.all([
        readEndpoint("/api/pricing/public-regions"),
        readEndpoint("/api/pricing/vps"),
      ]);

      if (!isMounted) {
        return;
      }

      if (regionsData?.success === true) {
        const regions = regionsData.regions;
        if (Array.isArray(regions) && regions.length > 0) {
          setRegionCount(regions.length);
        } else {
          const count = parseNumber(regionsData.count);
          if (count !== null && count > 0) {
            setRegionCount(count);
          }
        }
      }

      if (pricingData) {
        const plans = pricingData.plans;
        if (Array.isArray(plans)) {
          const values = plans
            .map((plan) => {
              const planRecord = asRecord(plan);
              const base = parseNumber(planRecord?.base_price) ?? 0;
              const markup = parseNumber(planRecord?.markup_price) ?? 0;
              return base + markup;
            })
            .filter((value) => Number.isFinite(value) && value > 0);

          if (values.length > 0) {
            setLowestPrice(Math.min(...values));
          }
        }
      }

      setPricingLoading(false);
    };

    void loadHomepageData();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const activeCapabilityConfig =
    capabilityTabs.find((tab) => tab.key === activeCapability) ?? capabilityTabs[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="home-aurora absolute inset-0" aria-hidden />
          <div className="home-grid-mask absolute inset-0" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-24">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/10 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Next-Gen Cloud Infrastructure Platform
                </Badge>

                <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  Cloud Infrastructure Management,
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                    {" "}
                    Simplified
                  </span>
                </h1>

                <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                  Deploy VPS instances and applications in seconds with unified billing, real-time monitoring, and enterprise-grade security.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 px-7" asChild>
                  <Link to="/register">
                    Deploy Your First Server
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-7" asChild>
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <motion.div
                    key={metric.label}
                    className="flex flex-col p-4 rounded-xl home-glass-panel border-primary/20 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{metric.label}</span>
                      <metric.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">
                      {metric.value.includes('+') || metric.value.includes('%') ? metric.value : <AnimatedCounter value={parseInt(metric.value.replace(/\D/g, '')) || 0} suffix={metric.value.replace(/[\d,]/g, '')} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{metric.detail}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="home-panel-glow relative"
            >
              <Card className="overflow-hidden border-border/70 bg-card/95 shadow-2xl">
                <CardContent className="space-y-5 p-0">
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-destructive/80" />
                        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                        <div className="h-3 w-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="ml-2 h-4 w-32 rounded bg-muted" />
                    </div>
                    <Badge variant="outline" className="rounded-full bg-green-500/10 text-green-500 border-green-500/20">
                      System Operational
                    </Badge>
                  </div>

                  <div className="space-y-4 px-5 pb-5">
                    {/* Mock server list */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Instances</p>
                      {[
                        { name: "web-production-01", status: "Running", ip: "192.168.1.10", load: "24%" },
                        { name: "database-primary", status: "Running", ip: "192.168.1.11", load: "68%" },
                        { name: "staging-env", status: "Stopped", ip: "192.168.1.12", load: "0%" },
                      ].map((server) => (
                        <div key={server.name} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
                          <div className="flex items-center gap-3">
                            <Server className={`h-4 w-4 ${server.status === 'Running' ? 'text-green-500' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-medium">{server.name}</p>
                              <p className="text-xs text-muted-foreground">{server.ip}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs font-medium">{server.load} CPU</p>
                            </div>
                            <div className="h-2 w-12 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: server.load }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-border/70 bg-primary/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <TerminalSquare className="h-4 w-4 text-primary" />
                          <span>Quick Action</span>
                        </div>
                        <Button size="sm" variant="secondary" className="h-7 text-xs">Open Console</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* LOGO STRIP / TRUST BADGES */}
        <section className="border-b border-border/60 bg-muted/25 py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-4 text-sm sm:px-6 lg:px-8">
            <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background shadow-sm hover:border-primary/50 transition-colors">
              <Server className="mr-2 h-3.5 w-3.5 text-primary" />
              High Performance NVMe
            </Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background shadow-sm hover:border-primary/50 transition-colors">
              <ShieldCheck className="mr-2 h-3.5 w-3.5 text-primary" />
              DDoS Protection Available
            </Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background shadow-sm hover:border-primary/50 transition-colors">
              <Users className="mr-2 h-3.5 w-3.5 text-primary" />
              Built for Teams
            </Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background shadow-sm hover:border-primary/50 transition-colors">
              <Wallet className="mr-2 h-3.5 w-3.5 text-primary" />
              Hourly Billing
            </Badge>
          </div>
        </section>

        {/* CORE PLATFORM FEATURES */}
        <section id="platform" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-12 max-w-3xl"
            >
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary">
                Why {BRAND_NAME}
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything you need to host modern applications.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We've built a cloud platform that strips away the complexity. Get powerful virtual machines, straightforward billing, and tools designed for collaboration.
              </p>
            </motion.div>

            <motion.div
              variants={revealContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {platformCards.map((card) => (
                <motion.div key={card.title} variants={revealItem}>
                  <Card className="h-full border-border/70 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                        <card.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{card.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-primary">{card.metric}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CAPABILITIES TABS */}
        <section id="capabilities" className="border-y border-border/60 bg-muted/25 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="space-y-6"
            >
              <div>
                <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary">
                  Features
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  A complete toolkit for your infrastructure.
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Explore how our platform helps you deploy servers, manage your team, and keep your costs predictable.
                </p>
              </div>

              <div className="space-y-2">
                {capabilityTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCapability(tab.key)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      activeCapability === tab.key
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <tab.icon className="h-4 w-4" />
                      <span className="font-medium">{tab.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              key={activeCapabilityConfig.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Card className="border-border/70 bg-card/85 shadow-xl backdrop-blur h-full">
                <CardContent className="space-y-6 p-6 sm:p-7 h-full flex flex-col justify-center">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      {activeCapabilityConfig.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground leading-relaxed">
                      {activeCapabilityConfig.description}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {activeCapabilityConfig.callouts.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-border/70 bg-background/80 p-3 shadow-sm"
                      >
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-base font-semibold">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    {activeCapabilityConfig.bullets.map((point) => (
                      <div key={point} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                        <p className="text-sm text-foreground">{point}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* USE CASES / SOLUTIONS */}
        <section id="solutions" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-12 max-w-3xl"
            >
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary">
                Built For You
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                The foundation for your next big idea.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Whether you're a solo developer testing an app or a growing business scaling production workloads, we have the resources you need.
              </p>
            </motion.div>

            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  title: "Developers & Builders",
                  detail:
                    "Spin up a Linux instance in seconds to test your code, run containers, or host your personal projects.",
                  bullets: ["Full root access", "Instant provisioning", "Predictable costs"],
                },
                {
                  title: "Startups & Agencies",
                  detail:
                    "Create dedicated workspaces for different projects. Collaborate with your team securely.",
                  bullets: ["Organization workspaces", "Role-based access", "Centralized billing"],
                },
                {
                  title: "Production Workloads",
                  detail:
                    "Host critical applications with confidence using our reliable infrastructure and security tools.",
                  bullets: ["99.9% uptime SLA", "DDoS protection options", "Automated backups"],
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <Card className="h-full home-feature-card group shadow-sm hover:shadow-lg transition-all">
                    <CardContent className="space-y-4 p-6">
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground min-h-[60px]">{item.detail}</p>
                      <ul className="space-y-2 text-sm font-medium text-foreground">
                        {item.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 sm:py-24 border-y border-border/60 bg-muted/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary">
                Getting Started
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                From Zero to
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Live Infrastructure</span>
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
                Get your infrastructure up and running in minutes, not hours.
              </p>
            </motion.div>

            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-y-1/2" />
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { num: "01", title: "Sign Up & Add Funds", desc: "Create your account and add funds to your wallet.", icon: Users },
                  { num: "02", title: "Choose Infrastructure", desc: "Select from VPS instances or curated StackScripts.", icon: Server },
                  { num: "03", title: "Deploy Instantly", desc: "Launch your infrastructure in under 45 seconds.", icon: Rocket },
                  { num: "04", title: "Monitor & Manage", desc: "Track performance and scale through one dashboard.", icon: Activity }
                ].map((step, i) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="relative"
                  >
                    <Card className="h-full home-feature-card group hover:shadow-xl">
                      <CardContent className="p-8 text-center">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold group-hover:scale-110 transition-transform duration-300 shadow-lg ring-4 ring-primary/10">
                            {step.num}
                          </div>
                        </div>
                        <step.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-3 text-foreground">
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

        {/* TESTIMONIALS */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 rounded-full px-4 py-1.5 border-primary/30 text-primary">
                Trusted by Teams
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                What Our Customers Say
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
                Join thousands of satisfied customers who trust {BRAND_NAME} for their infrastructure needs.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {testimonials.map((test, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="touch-manipulation"
                >
                  <Card className="h-full home-feature-card group">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-1">
                          {[...Array(test.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          ))}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {test.location}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center ring-2 ring-primary/20">
                          <span className="text-primary font-bold text-sm">{test.avatar}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{test.name}</div>
                          <div className="text-xs text-muted-foreground">{test.role}</div>
                        </div>
                      </div>
                      <div className="relative mb-6">
                        <Quote className="absolute -top-3 -left-2 w-6 h-6 text-primary/10" />
                        <p className="text-sm text-muted-foreground leading-relaxed italic relative z-10 pl-5">
                          "{test.quote}"
                        </p>
                      </div>
                      <div className="pt-4 border-t border-border/40">
                        <div className="flex flex-wrap gap-2">
                          {test.results.map((r, i) => (
                            <div key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                              <TrendingUp className="w-3 h-3" />
                              {r.metric}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING PREVIEW */}
        <section className="border-y border-border/60 bg-muted/25 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full px-4 py-1.5 border-primary/30 text-primary">
                Transparent Pricing
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pay only for the resources you use.
              </h2>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Add funds to your prepaid wallet and instances are billed by the hour. No hidden fees, no long-term contracts. Destroy your instance anytime to stop charges.
              </p>
            </div>

            <Card className="min-w-[280px] border-primary/25 bg-gradient-to-br from-primary/5 to-background shadow-xl">
              <CardContent className="space-y-2 p-6 text-center">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  VPS Plans Starting At
                </p>
                <p className="text-4xl font-semibold tracking-tight text-primary">
                  {pricingLoading ? "…" : `$${lowestPrice ?? 5}`}
                  <span className="text-lg text-muted-foreground font-normal">/mo</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Billed hourly from your wallet
                </p>
                <Button asChild className="mt-3 w-full shadow-md hover:shadow-lg transition-all">
                  <Link to="/pricing">View All Plans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full px-4 py-1.5 border-primary/30 text-primary">
                FAQ
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Frequently asked questions.
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about hosting with {BRAND_NAME}.
              </p>
              <div className="mt-6 rounded-xl border border-border/70 bg-primary/5 p-6">
                <p className="text-sm font-medium text-foreground">Still have questions?</p>
                <p className="mt-1 text-sm text-muted-foreground mb-4">Our support team is ready to help you get started.</p>
                <Button variant="outline" asChild>
                  <Link to="/contact">Contact Support</Link>
                </Button>
              </div>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="rounded-xl border border-border/70 bg-card/50 px-5 shadow-sm"
                >
                  <AccordionTrigger className="text-left text-base font-medium hover:text-primary hover:no-underline py-4">
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

        {/* CTA */}
        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="home-cta-shell rounded-3xl border border-border/70 px-6 py-14 text-center sm:px-10 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Ready to launch your server?
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                  Create your account, add funds to your wallet, and deploy a high-performance Linux VPS in less than a minute.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                  <Button size="lg" className="h-12 px-8 text-base shadow-lg" asChild>
                    <Link to="/register">Create Account</Link>
                  </Button>
                  <Button size="lg" variant="secondary" className="h-12 px-8 text-base border border-border/50" asChild>
                    <Link to="/pricing">View Pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <BackToTopButton />
    </div>
  );
}
