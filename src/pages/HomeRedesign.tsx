import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import DataStreamCanvas from "@/components/home/DataStreamCanvas";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Code2,
  Cpu,
  Globe2,
  HardDrive,
  Lock,
  MemoryStick,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Wallet,
  Zap,
  Users,
  Activity,
  Database,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";

import "@/styles/home.css";
import { BRAND_NAME } from "@/lib/brand";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import SkyPanelPreview from "@/components/home/SkyPanelPreview";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { getHostingFeatureSpecRows } from "@/lib/hostingPlanFeatures";
import { useEnabledCategoryMappings } from "@/hooks/useCategoryMappings";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────── */

interface PlatformCard {
  title: string;
  description: string;
  metric: string;
  icon: LucideIcon;
  span?: string;
}

/* ─── Animation Variants ─────────────────────────────────────────── */

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
  viewport: { once: true, margin: "-80px" as const },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  viewport: { once: true },
};

/* ─── Helpers ────────────────────────────────────────────────────── */

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;

const parseNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const hostingCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatHostingMonthly = (
  amount: number | string | null | undefined,
): string => {
  const value =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const normalizedValue =
    Number.isFinite(value) && value !== undefined && value !== null ? value : 0;
  return hostingCurrencyFormatter.format(normalizedValue);
};

const formatMonthly = (amount: number | string | null | undefined): string => {
  if (amount == null) return "$0.00";
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(value) || value < 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatCurrency6 = (amount: number | string | null | undefined): string => {
  if (amount == null) return "$0.000000";
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(value) || value < 0) return "$0.000000";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value);
};

interface VpsSpecRow {
  icon: LucideIcon;
  label: string;
}

const formatNetworkSpeed = (mbits: number): string => {
  if (mbits >= 1000) {
    const gbps = mbits / 1000;
    return `${Number.isInteger(gbps) ? gbps : gbps.toFixed(1)} Gbps`;
  }
  return `${mbits} Mbps`;
};

const getVpsSpecRows = (plan: any): VpsSpecRow[] => {
  const specs = asRecord(plan?.specifications) ?? {};
  const rows: VpsSpecRow[] = [];

  const vcpus = parseNumber(specs.vcpus);
  if (vcpus) rows.push({ icon: Cpu, label: `${vcpus} vCPU${vcpus > 1 ? "s" : ""}` });

  const memoryGb =
    parseNumber(specs.memory_gb) ??
    (parseNumber(specs.memory) != null ? Math.round(parseNumber(specs.memory)! / 1024) : null);
  if (memoryGb) rows.push({ icon: MemoryStick, label: `${memoryGb}GB Memory` });

  const storageGb =
    parseNumber(specs.storage_gb) ??
    (parseNumber(specs.disk) != null ? Math.round(parseNumber(specs.disk)! / 1024) : null);
  if (storageGb) rows.push({ icon: HardDrive, label: `${storageGb}GB SSD Storage` });

  const transferGb =
    parseNumber(specs.transfer_gb) ??
    parseNumber(specs.bandwidth_gb) ??
    parseNumber(specs.transfer);
  if (transferGb) {
    const label = transferGb >= 1000 ? `${transferGb / 1000} TB Transfer` : `${transferGb} GB Transfer`;
    rows.push({ icon: ArrowDownUp, label });
  }

  rows.push({ icon: ArrowDownUp, label: "40 Gbps Network In per VPS" });

  const networkOutMbits = parseNumber(plan?.network_out);
  if (networkOutMbits && networkOutMbits > 0) {
    rows.push({ icon: ArrowUp, label: `${formatNetworkSpeed(networkOutMbits)} Network Out` });
  }

  const backupsEnabled = plan?.daily_backups_enabled === true || plan?.weekly_backups_enabled === true;
  rows.push({ icon: Shield, label: backupsEnabled ? "Backups Available" : "No Backups" });

  return rows;
};

/* ─── Data ───────────────────────────────────────────────────────── */

const DEFAULT_CATEGORY_META: Record<string, { label: string; order: number }> = {
  nanode:      { label: "Nanode",         order: 0 },
  standard:    { label: "Standard",       order: 1 },
  dedicated:   { label: "Dedicated CPU",  order: 2 },
  premium:     { label: "Premium",        order: 3 },
  highmem:     { label: "High Memory",    order: 4 },
  gpu:         { label: "GPU",            order: 5 },
  accelerated: { label: "Accelerated",    order: 6 },
};

const capabilityCards = [
  {
    icon: Server,
    label: "VPS Compute",
    description:
      "Spin up high-performance Linux instances with full root access and NVMe storage in under 45 seconds.",
    specs: [
      { label: "Deployment", value: "Instant" },
      { label: "Storage", value: "NVMe SSD" },
      { label: "Network", value: "IPv4 & IPv6" },
    ],
  },
  {
    icon: PanelsTopLeft,
    label: "Web Hosting",
    description:
      "Launch managed website hosting directly from the same console. WordPress, email, SSL, and databases.",
    specs: [
      { label: "Catalog", value: "Live plans" },
      { label: "Control", value: "Panel SSO" },
      { label: "Billing", value: "Hosting wallet" },
    ],
  },
  {
    icon: Users,
    label: "Organizations",
    description:
      "Organize infrastructure into workspaces. Invite developers, assign roles, manage permissions granularly.",
    specs: [
      { label: "Workspaces", value: "Unlimited" },
      { label: "Access", value: "Role-based" },
      { label: "Billing", value: "Per team" },
    ],
  },
  {
    icon: ShieldCheck,
    label: "Security & Billing",
    description:
      "Built-in DDoS protection, automated backups, and transparent prepaid wallet billing with hourly rates.",
    specs: [
      { label: "Uptime SLA", value: "99.9%" },
      { label: "Protection", value: "DDoS Ready" },
      { label: "Billing", value: "Hourly" },
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
    icon: Globe2,
    title: "Browser-Based SSH & Hosting Tools",
    description:
      "Access server terminals and hosting controls directly from the dashboard. Keep compute and website operations in one place.",
    metric: "Unified console",
  },
  {
    icon: PanelsTopLeft,
    title: "Enhance Web Hosting",
    description:
      "Offer websites, WordPress, email, databases, SSL, backups, and runtime controls through the configured Enhance integration.",
    metric: "Live hosting catalog",
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
      " is a modern cloud hosting provider. We provide high-performance Virtual Private Servers (VPS) and, when enabled by the platform, Enhance-backed web hosting from the same dashboard.",
  },
  {
    question: "Do you offer managed web hosting?",
    answer:
      "Yes, when the Enhance integration is enabled. Available hosting plans, features, and prices come from the platform hosting catalog rather than hardcoded marketing values.",
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
      "The deployment speed is incredible. We went from signup to having our production servers running in under 45 seconds. The unified dashboard gives us complete visibility.",
    name: "Marcus Chen",
    role: "DevOps Engineer",
    results: [
      { metric: "99.9% uptime", period: "6 months" },
      { metric: "45s deploy", period: "vs 2 hours" },
    ],
    avatar: "MC",
  },
  {
    quote:
      "Finally, a platform that combines VPS and application hosting with transparent billing. The cost savings have been significant for our startup.",
    name: "Sarah Williams",
    role: "CTO",
    results: [
      { metric: "40% cost reduction", period: "monthly" },
      { metric: "2x performance", period: "vs previous" },
    ],
    avatar: "SW",
  },
  {
    quote:
      "The web-based SSH console and real-time monitoring have transformed how we manage our infrastructure. It's like having a datacenter in our browser.",
    name: "David Rodriguez",
    role: "Infrastructure Lead",
    results: [
      { metric: "3x faster deployments", period: "average" },
      { metric: "Zero downtime", period: "12 months" },
    ],
    avatar: "DR",
  },
];

type SolutionCard = {
  icon: LucideIcon;
  title: string;
  detail: string;
  bullets: string[];
  detailNoHosting?: string;
  bulletsNoHosting?: string[];
  detailNoVps?: string;
  bulletsNoVps?: string[];
};

const solutionCards: SolutionCard[] = [
  {
    icon: Code2,
    title: "Developers & Builders",
    detail:
      "Spin up a Linux instance in seconds to test your code, run containers, or host your personal projects.",
    bullets: ["Full root access", "Instant provisioning", "Predictable costs"],
    detailNoVps:
      "Create projects, organize collaborators, and manage support from one streamlined control plane.",
    bulletsNoVps: ["Project workspaces", "Team collaboration", "Predictable costs"],
  },
  {
    icon: Users,
    title: "Startups & Agencies",
    detail:
      "Create dedicated workspaces for client projects, VPS resources, and website hosting subscriptions. Collaborate with your team securely.",
    bullets: [
      "Organization workspaces",
      "Role-based access",
      "Centralized billing",
    ],
    detailNoHosting:
      "Create dedicated workspaces for client projects and VPS resources. Collaborate with your team securely.",
    detailNoVps:
      "Create dedicated workspaces for client projects. Collaborate with your team securely.",
    bulletsNoHosting: [
      "Organization workspaces",
      "Role-based access",
      "Centralized billing",
    ],
  },
  {
    icon: PanelsTopLeft,
    title: "Web Hosting Customers",
    detail:
      "Sell or manage websites with configured hosting plans, domain checkout, panel SSO, and support from one dashboard.",
    bullets: [
      "Configured plan catalog",
      "Dedicated hosting wallet",
      "Website control panel",
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
    detailNoVps:
      "Coordinate customer-facing projects with reliable account controls and support workflows.",
    bulletsNoVps: ["99.9% uptime SLA", "Team support workflows", "Centralized billing"],
  },
];

/* ─── Social Proof Component ────────────────────────────────────── */

function SocialProof() {
  const { data: orgData } = useQuery({
    queryKey: ["public-organizations"],
    queryFn: async () => {
      return apiClient.get<any>("/health/organizations");
    },
    staleTime: 5 * 60 * 1000,
  });

  const orgInitials = useMemo(() => {
    const fallbackInitials =
      BRAND_NAME.trim().substring(0, 2).toUpperCase() || "??";

    if (orgData?.organizations?.length > 0) {
      return orgData.organizations.slice(0, 3).map((org: { name: string }) => {
        const name = (org.name || "").trim();

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
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center ring-2 ring-background text-[9px] font-bold text-foreground"
          >
            {initials}
          </div>
        ))}
      </div>
      <span>Join teams already using {BRAND_NAME}</span>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function HomeRedesign() {
  const [regionCount, setRegionCount] = useState(10);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [hostingPlanCount, setHostingPlanCount] = useState(0);
  const [hostingPlans, setHostingPlans] = useState<any[]>([]);
  const [hostingLowestPrice, setHostingLowestPrice] = useState<number | null>(null);
  const [hostingCheapestPlan, setHostingCheapestPlan] = useState<any | null>(null);
  const [vpsCheapestPlan, setVpsCheapestPlan] = useState<any | null>(null);
  const [vpsProductEnabled, setVpsProductEnabled] = useState(false);
  const [heroReducedMotion, setHeroReducedMotion] = useState(false);

  // Filter hosting/VPS-related content based on enabled state
  const visibleCapabilityCards = useMemo(() => {
    let cards = capabilityCards;
    if (!hostingEnabled) {
      cards = cards.filter((card) => card.label !== "Web Hosting");
    }
    if (!vpsProductEnabled) {
      cards = cards.filter((card) => card.label !== "VPS Compute");
    }
    return cards.map((card) => {
      if (card.label !== "Security & Billing" || vpsProductEnabled) return card;

      return {
        ...card,
        description:
          "Role-based access, support workflows, and transparent prepaid wallet billing.",
        specs: [
          { label: "Access", value: "Role-based" },
          { label: "Billing", value: "Wallet" },
          { label: "Support", value: "24/7" },
        ],
      };
    });
  }, [hostingEnabled, vpsProductEnabled]);

  const visiblePlatformCards = useMemo(() => {
    let cards = platformCards;
    if (!hostingEnabled) {
      cards = cards.filter(
        (card) =>
          card.title !== "Browser-Based SSH & Hosting Tools" &&
          card.title !== "Enhance Web Hosting",
      );
    }
    if (!vpsProductEnabled) {
      cards = cards.filter(
        (card) =>
          card.title !== "Lightning Fast Setup" &&
          card.title !== "Browser-Based SSH & Hosting Tools" &&
          card.title !== "Real-Time Monitoring" &&
          card.title !== "Automated Backups",
      );
    }
    if (!vpsProductEnabled && !hostingEnabled) {
      cards = cards.filter((card) => card.title !== "Global Network");
    }

    return cards.map((card) => {
      if (card.title === "Predictable Pricing" && !vpsProductEnabled) {
        return {
          ...card,
          description: hostingEnabled
            ? "Choose monthly plans with clear wallet controls. No hidden fees, no complicated contracts."
            : "Fund your wallet and keep account spending clear. No hidden fees, no complicated contracts.",
          metric: hostingEnabled ? "Monthly precision" : "Clear billing",
        };
      }

      if (card.title === "REST API" && !vpsProductEnabled && !hostingEnabled) {
        return {
          ...card,
          description:
            "Manage account and workspace workflows programmatically with API access for automation and integration.",
        };
      }

      return card;
    });
  }, [hostingEnabled, vpsProductEnabled]);

  const visibleSolutionCards = useMemo(() => {
    let cards = hostingEnabled
      ? solutionCards
      : solutionCards.filter((card) => card.title !== "Web Hosting Customers");

    if (!vpsProductEnabled && !hostingEnabled) {
      cards = cards.filter((card) => card.title !== "Production Workloads");
    }

    return cards.map((card) => ({
      ...card,
      detail: !vpsProductEnabled
        ? card.detailNoVps ?? card.detailNoHosting ?? card.detail
        : !hostingEnabled
          ? card.detailNoHosting ?? card.detail
          : card.detail,
      bullets: !vpsProductEnabled
        ? card.bulletsNoVps ?? card.bulletsNoHosting ?? card.bullets
        : !hostingEnabled
          ? card.bulletsNoHosting ?? card.bullets
          : card.bullets,
    }));
  }, [hostingEnabled, vpsProductEnabled]);

  const visibleFaqs = faqs.filter((faq) => {
    const text = `${faq.question} ${faq.answer}`.toLowerCase();
    if (!hostingEnabled && (text.includes("web hosting") || text.includes("enhance") || text.includes("managed"))) {
      return false;
    }
    if (!vpsProductEnabled && (text.includes("vps") || text.includes("egress") || text.includes("root access") || text.includes("nested virtualization") || text.includes("ddos") || text.includes("active servers") || text.includes("server environment"))) {
      return false;
    }
    return true;
  });

  const visibleTestimonials = testimonials.filter((test) => {
    const quote = test.quote.toLowerCase();
    if (!hostingEnabled && quote.includes("application hosting")) return false;
    if (!vpsProductEnabled && (quote.includes("vps") || quote.includes("ssh") || quote.includes("server") || quote.includes("deployment"))) return false;
    return true;
  });

  const showHostingPricingCard =
    hostingEnabled && hostingLowestPrice !== null && hostingCheapestPlan != null;
  const showVpsPricingCard = vpsProductEnabled;

  const heroSubtitle = vpsProductEnabled
    ? `Deploy high-performance virtual machines${hostingEnabled ? " and managed web hosting" : ""} from one dashboard. Full root access, hourly billing, zero surprises.`
    : hostingEnabled
      ? "Launch managed web hosting from one dashboard. Clear billing, team workspaces, and support are built in."
      : "Manage your account, teams, billing, and support from one dashboard. Clear controls, zero surprises.";

  const heroCtaLabel = vpsProductEnabled
    ? "Deploy Your First Server"
    : hostingEnabled
      ? "Start Hosting"
      : "Create Account";

  const heroStats = vpsProductEnabled
    ? [
        { icon: Globe2, label: `${regionCount}+ Regions` },
        { icon: Clock3, label: "~45s Deploy" },
        { icon: ShieldCheck, label: "99.9% Uptime SLA" },
      ]
    : hostingEnabled
      ? [
          { icon: Globe2, label: `${regionCount}+ Regions` },
          { icon: PanelsTopLeft, label: "Managed Sites" },
          { icon: ShieldCheck, label: "99.9% Uptime SLA" },
        ]
      : [
          { icon: Users, label: "Team Workspaces" },
          { icon: Wallet, label: "Wallet Billing" },
          { icon: ShieldCheck, label: "24/7 Support" },
        ];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setHeroReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [regData, priceData, hostingData] = await Promise.all([
          apiClient.get<{ success?: boolean; regions?: any[]; count?: number }>(
            "/pricing/public-regions",
          ),
          apiClient.get<{ enabled?: boolean; plans?: any[] }>("/pricing/vps"),
          apiClient
            .get<{ enabled?: boolean; plans?: any[] }>("/pricing/hosting")
            .catch(() => ({ enabled: false, plans: [] })),
        ]);

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

        if (priceData) {
          setVpsProductEnabled(priceData.enabled !== false);
          const plans = priceData.plans;
          if (Array.isArray(plans)) {
            const sorted = plans
              .map((p) => {
                const rec = asRecord(p);
                const price =
                  (parseNumber(rec?.base_price) ?? 0) +
                  (parseNumber(rec?.markup_price) ?? 0);
                return { plan: p, price };
              })
              .filter((v) => Number.isFinite(v.price) && v.price > 0)
              .sort((a, b) => a.price - b.price);
            if (sorted.length > 0) {
              setLowestPrice(sorted[0].price);
              setVpsCheapestPlan(sorted[0].plan);
            }
          }
        }

        setHostingEnabled(hostingData.enabled === true);
        setHostingPlanCount(hostingData.plans?.length ?? 0);
        setHostingPlans(hostingData.plans ?? []);
        if (Array.isArray(hostingData.plans) && hostingData.plans.length > 0) {
          const sorted = [...hostingData.plans]
            .map((p) => {
              const rec = asRecord(p);
              const price = parseNumber(rec?.price_monthly);
              return { plan: p, price };
            })
            .filter((v): v is { plan: any; price: number } => v.price !== null && v.price > 0)
            .sort((a, b) => a.price - b.price);
          if (sorted.length > 0) {
            setHostingLowestPrice(sorted[0].price);
            setHostingCheapestPlan(sorted[0].plan);
          }
        }
      } catch {
        // Silently fail - pricing data is optional
      } finally {
        setPricingLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el)
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
          100,
        );
    }
  }, [location.hash]);

  const { data: enabledCategoryMappings = [] } = useEnabledCategoryMappings();

  const getCategoryLabel = (category: string): string => {
    const mapping = enabledCategoryMappings.find(
      (item) => item.original_category === category,
    );
    if (mapping?.custom_name) return mapping.custom_name;
    return (
      DEFAULT_CATEGORY_META[category]?.label ??
      category.charAt(0).toUpperCase() + category.slice(1)
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main className="flex flex-col">
        {/* ── 1. HERO ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)_/_0.08)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)_/_0.12)_0%,transparent_60%)] pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-6 md:px-12 pt-28 pb-16 md:pt-36 md:pb-24">
            {/* Two-column: headline + data stream canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Headline block */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                className="max-w-3xl lg:max-w-none"
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                  Cloud infrastructure,{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    simplified.
                  </span>
                </h1>
                <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted-foreground max-w-2xl">
                  {heroSubtitle}
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="h-12 px-7 rounded-sm" asChild>
                    <Link to="/register" className="flex items-center">
                      {heroCtaLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-7 rounded-sm" asChild>
                    <Link to="/pricing">View Pricing</Link>
                  </Button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {heroStats.map(({ icon: Icon, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {label}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Data stream canvas */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                className="relative h-[320px] sm:h-[380px] lg:h-[420px] rounded-sm border border-border/40 overflow-hidden bg-card hidden lg:block"
              >
                <DataStreamCanvas className="absolute inset-0" reducedMotion={heroReducedMotion} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
              </motion.div>
            </div>

            {/* Product preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
              className="mt-16 md:mt-20"
            >
              <TerminalPanel title="Control plane preview" bodyClassName="overflow-hidden">
                <SkyPanelPreview />
              </TerminalPanel>
            </motion.div>
          </div>
        </section>

        {/* ── 2. CAPABILITIES ──────────────────────────────────────── */}
        <section id="platform" className="py-24 bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight font-mono">
                Platform capabilities
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                {vpsProductEnabled && hostingEnabled
                  ? "Everything you need to deploy, manage, and scale cloud infrastructure, from VPS to web hosting."
                  : vpsProductEnabled
                    ? "Everything you need to deploy, manage, and scale cloud infrastructure."
                    : hostingEnabled
                      ? "Everything you need to launch, manage, and support websites."
                      : "Everything you need to manage teams, billing, and support."}
              </p>
            </motion.div>

            <motion.div
              {...staggerContainer}
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-4",
                hostingEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}
            >
              {visibleCapabilityCards.map((card) => (
                <motion.div key={card.label} {...staggerItem}>
                  <div className="h-full border border-border/50 bg-card/50 rounded-sm p-6 hover:border-primary/30 transition-colors">
                    <card.icon className="w-6 h-6 text-primary mb-4" />
                    <h3 className="text-base font-semibold mb-2">{card.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                      {card.description}
                    </p>
                    <div className="space-y-2">
                      {card.specs.map((spec) => (
                        <div
                          key={spec.label}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-mono text-muted-foreground uppercase tracking-wider">
                            {spec.label}
                          </span>
                          <span className="font-medium text-foreground">
                            {spec.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 3. FEATURES GRID ─────────────────────────────────────── */}
        <section id="features" className="border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12 py-24">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight font-mono">
                Everything you need
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                {vpsProductEnabled || hostingEnabled
                  ? "A complete toolkit for managing your cloud infrastructure, from provisioning to monitoring."
                  : "A complete toolkit for account management, team workflows, billing, and support."}
              </p>
            </motion.div>

            <motion.div
              {...staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4"
            >
              {visiblePlatformCards.map((card) => (
                <motion.div key={card.title} {...staggerItem}>
                  <div className="h-full border border-border/50 bg-card/50 rounded-sm p-6 hover:border-primary/20 transition-colors">
                    <card.icon className="w-5 h-5 text-muted-foreground mb-6" />
                    <h3 className="text-base font-semibold mb-2">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[48px]">
                      {card.description}
                    </p>
                    <div className="inline-flex font-mono text-[10px] uppercase tracking-widest text-muted-foreground border border-border/50 px-2.5 py-1 rounded-sm">
                      {card.metric}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 4. SOLUTIONS ─────────────────────────────────────────── */}
        <section id="solutions" className="py-24 bg-background border-t border-border">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="mb-12 max-w-2xl"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Built for every team
              </h2>
              <p className="mt-2 text-muted-foreground">
                {vpsProductEnabled || hostingEnabled
                  ? "Whether you're a solo developer testing an app or a growing business scaling production workloads."
                  : "Whether you're organizing a team or centralizing account operations."}
              </p>
            </motion.div>

            <motion.div
              {...staggerContainer}
              className={cn(
                "grid grid-cols-1 md:grid-cols-2 gap-4",
                hostingEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}
            >
              {visibleSolutionCards.map((item, idx) => (
                <motion.div key={idx} {...staggerItem}>
                  <div className="h-full border border-border/50 bg-card/50 rounded-sm p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted mb-5">
                      <item.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5 min-h-[40px]">
                      {item.detail}
                    </p>
                    <ul className="space-y-2 text-sm text-foreground">
                      {item.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-4 hover:underline"
                    >
                      Get started
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 5. HOW IT WORKS ──────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {vpsProductEnabled || hostingEnabled ? "Get started in under a minute" : "Get started in minutes"}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
                {vpsProductEnabled || hostingEnabled
                  ? "From signup to running infrastructure in four simple steps."
                  : "From signup to organized workspace operations in four simple steps."}
              </p>
            </motion.div>

            <motion.div
              {...staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[
                { num: "01", title: "Sign Up & Add Funds", desc: "Create your account and add funds to your wallet via PayPal.", icon: Users },
                {
                  num: "02",
                  title: vpsProductEnabled || hostingEnabled ? "Choose a Plan" : "Configure Workspace",
                  desc: vpsProductEnabled && hostingEnabled
                    ? "Select your server or hosting package and preferred location."
                    : vpsProductEnabled
                      ? "Select your server plan, region, and operating system."
                      : hostingEnabled
                        ? "Select your hosting package and website details."
                        : "Set up your workspace, billing, and organization preferences.",
                  icon: vpsProductEnabled ? Server : hostingEnabled ? PanelsTopLeft : Users,
                },
                {
                  num: "03",
                  title: vpsProductEnabled || hostingEnabled ? "Launch Instantly" : "Start Collaborating",
                  desc: vpsProductEnabled || hostingEnabled
                    ? "Launch your service quickly from the dashboard."
                    : "Invite your team and centralize your account operations.",
                  icon: Rocket,
                },
                { num: "04", title: "Monitor & Manage", desc: "Track activity and manage everything through one dashboard.", icon: Activity },
              ].map((step) => (
                <motion.div key={step.num} {...staggerItem}>
                  <div className="h-full border border-border/50 bg-card/50 rounded-sm p-6 text-center">
                    <span className="font-mono text-xs text-muted-foreground mb-4 block">
                      {step.num}
                    </span>
                    <div className="w-10 h-10 bg-muted rounded-sm flex items-center justify-center mx-auto mb-4">
                      <step.icon className="w-5 h-5 text-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 6. TESTIMONIALS ───────────────────────────────────────── */}
        {visibleTestimonials.length > 0 && (
        <section id="testimonials" className="py-24 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                What our users say
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
              {visibleTestimonials.map((test, i) => (
                <motion.div
                  key={i}
                  {...fadeInUp}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="border border-border/50 bg-card/50 rounded-sm p-6 flex flex-col"
                >
                  <p className="text-sm text-foreground/80 leading-relaxed mb-8 flex-1">
                    &ldquo;{test.quote}&rdquo;
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center font-mono text-[10px] text-foreground font-medium">
                        {test.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{test.name}</p>
                        <p className="text-xs text-muted-foreground">{test.role}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
                      {test.results.map((r, k) => (
                        <span
                          key={k}
                          className="font-mono text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded"
                        >
                          {r.metric}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ── 7. PRICING PREVIEW ────────────────────────────────────── */}
        <section className="border-t border-border bg-background py-24">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
                {vpsProductEnabled
                  ? "Add funds to your prepaid wallet and instances are billed by the hour. No hidden fees, no contracts."
                  : hostingEnabled
                    ? "Choose a hosting plan with clear monthly pricing. No hidden fees, no contracts."
                    : "Review available plans with clear pricing when product catalogs are enabled."}
              </p>
            </motion.div>

            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={cn(
                "mx-auto grid grid-cols-1 gap-6",
                showVpsPricingCard && showHostingPricingCard ? "max-w-4xl md:grid-cols-2" : "max-w-md",
              )}
            >
              {showVpsPricingCard && (vpsCheapestPlan ? (
                <Card className="border border-border/50 bg-card rounded-sm flex flex-col">
                  <CardHeader className="pb-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Starting at
                    </p>
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <CardTitle className="text-lg">
                        {vpsCheapestPlan.name}
                      </CardTitle>
                      {vpsCheapestPlan.type_class && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {getCategoryLabel(vpsCheapestPlan.type_class)}
                        </Badge>
                      )}
                    </div>
                    {vpsCheapestPlan.description && (
                      <p className="text-sm text-muted-foreground">
                        {vpsCheapestPlan.description}
                      </p>
                    )}
                    <div className="pt-3">
                      <span className="text-4xl font-bold tracking-tight text-foreground">
                        {pricingLoading ? "..." : formatMonthly(lowestPrice ?? 5)}
                      </span>
                      <span className="text-base text-muted-foreground font-normal">
                        /month
                      </span>
                      {lowestPrice != null && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatCurrency6(lowestPrice / 730)} per hour
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2.5">
                    {getVpsSpecRows(vpsCheapestPlan).map((spec) => (
                      <div key={spec.label} className="flex items-center gap-2.5">
                        <spec.icon className="h-4 w-4 text-primary/70 shrink-0" />
                        <span className="text-sm">{spec.label}</span>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full rounded-sm" size="lg">
                      <Link to="/register">
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="border border-border/50 bg-card rounded-sm">
                  <CardContent className="space-y-5 p-6 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      VPS Plans Starting At
                    </p>
                    <p className="text-4xl font-bold tracking-tight text-foreground">
                      {pricingLoading ? "..." : `$${lowestPrice ?? 5}`}
                      <span className="text-base text-muted-foreground font-normal">
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
                    <Button asChild className="w-full rounded-sm" size="lg">
                      <Link to="/pricing">View All Plans</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {showHostingPricingCard && (
                <Card className="border border-border/50 bg-card rounded-sm flex flex-col">
                  <CardHeader className="pb-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Starting at
                    </p>
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <CardTitle className="text-lg">
                        {hostingCheapestPlan.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {hostingCheapestPlan.service_type}
                      </Badge>
                    </div>
                    {hostingCheapestPlan.description && (
                      <p className="text-sm text-muted-foreground">
                        {hostingCheapestPlan.description}
                      </p>
                    )}
                    <div className="pt-3">
                      <span className="text-4xl font-bold tracking-tight text-foreground">
                        {formatHostingMonthly(hostingCheapestPlan.price_monthly)}
                      </span>
                      <span className="text-base text-muted-foreground font-normal">
                        /month
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2.5">
                    {getHostingFeatureSpecRows(hostingCheapestPlan).map((feature) => (
                      <div key={feature.key} className="flex items-center gap-2.5">
                        <feature.icon className="h-4 w-4 text-primary/70 shrink-0" />
                        <span className="text-sm">{feature.label}</span>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full rounded-sm" size="lg">
                      <Link to="/register">
                        Start Hosting
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </motion.div>

            <div className="text-center mt-8">
              <Button variant="ghost" asChild>
                <Link to="/pricing" className="flex items-center gap-1.5 text-sm">
                  View all plans
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── 8. FAQ ────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14">
              <div className="space-y-5 lg:sticky lg:top-32 lg:self-start">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Frequently asked questions
                </h2>
                <p className="text-muted-foreground">
                  Everything you need to know about {BRAND_NAME}.
                </p>
                <div className="mt-6 rounded-sm border border-border/50 bg-card p-6">
                  <p className="text-sm font-medium">
                    Still have questions?
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground mb-4">
                    Our support team is ready to help you get started.
                  </p>
                  <Button variant="outline" asChild className="rounded-sm">
                    <Link to="/contact">Contact Support</Link>
                  </Button>
                </div>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {visibleFaqs.map((faq, index) => (
                  <AccordionItem
                    key={faq.question}
                    value={`faq-${index}`}
                    className="rounded-sm border border-border/50 bg-card/50 px-5 transition-colors data-[state=open]:border-primary/30 data-[state=open]:bg-card"
                  >
                    <AccordionTrigger className="text-left text-sm font-medium hover:text-primary hover:no-underline py-4">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* ── 9. FINAL CTA ─────────────────────────────────────────── */}
        <section className="py-24 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="border border-border/50 bg-card rounded-sm px-6 py-16 text-center sm:px-12">
              <div className="space-y-6">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {vpsProductEnabled ? "Ready to launch your server?" : hostingEnabled ? "Ready to launch your website?" : "Ready to get started?"}
                </h2>
                <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                  {vpsProductEnabled
                    ? "Create your account, add funds, and deploy a high-performance Linux VPS in less than a minute."
                    : hostingEnabled
                      ? "Create your account, choose a hosting plan, and launch your website from one dashboard."
                      : "Create your account and manage your workspace, billing, and support from one dashboard."}
                </p>

                <SocialProof />

                <div className="flex flex-col justify-center gap-3 sm:flex-row pt-2">
                  <Button size="lg" className="h-11 px-8 text-base rounded-sm" asChild>
                    <Link to="/register">Create Account</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 px-8 text-base rounded-sm"
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
