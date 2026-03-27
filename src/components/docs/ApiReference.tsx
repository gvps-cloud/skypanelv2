import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  BookOpen,
  Copy,
  Search,
  Lock,
  Code2,
  Zap,
  DollarSign,
  HelpCircle,
  Mail,
  Palette,
  Activity,
  Server,
  Users,
  CreditCard,
  Shield,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { BRAND_NAME } from "@/lib/brand";
import { ACTIVE_API_ROUTE_MANIFEST, type ActiveApiRoute } from "@/lib/apiRouteManifest";

// ── Types ────────────────────────────────────────────────────────────────────

type GroupedEndpoint = ActiveApiRoute & {
  relativePath: string;
};

type ApiSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  basePath: string;
  endpoints: GroupedEndpoint[];
};

// ── Constants ────────────────────────────────────────────────────────────────

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
  POST: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  PUT: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800",
  PATCH: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  DELETE: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800",
  DEFAULT: "bg-muted text-foreground border-border",
};

// Section configuration based on path prefixes
const sectionConfig: Array<{
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  prefixes: string[];
  priority: number;
}> = [
  {
    id: "auth",
    title: "Authentication",
    description: "User authentication, registration, password management, and API keys.",
    icon: <Lock className="h-4 w-4" />,
    prefixes: ["/api/auth"],
    priority: 1,
  },
  {
    id: "vps",
    title: "VPS Management",
    description: "Create, manage, and control virtual private server instances.",
    icon: <Server className="h-4 w-4" />,
    prefixes: ["/api/vps"],
    priority: 2,
  },
  {
    id: "billing",
    title: "Billing & Payments",
    description: "Wallet management, payment processing, and transaction history.",
    icon: <CreditCard className="h-4 w-4" />,
    prefixes: ["/api/payments", "/api/invoices"],
    priority: 3,
  },
  {
    id: "organizations",
    title: "Organizations",
    description: "Organization management, membership, and invitations.",
    icon: <Users className="h-4 w-4" />,
    prefixes: ["/api/organizations"],
    priority: 4,
  },
  {
    id: "support",
    title: "Support Tickets",
    description: "Create and manage support tickets and replies.",
    icon: <HelpCircle className="h-4 w-4" />,
    prefixes: ["/api/support"],
    priority: 5,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Real-time notifications and activity streams.",
    icon: <Activity className="h-4 w-4" />,
    prefixes: ["/api/notifications", "/api/activities", "/api/activity"],
    priority: 6,
  },
  {
    id: "ssh-keys",
    title: "SSH Keys",
    description: "Manage SSH keys for VPS access.",
    icon: <Code2 className="h-4 w-4" />,
    prefixes: ["/api/ssh-keys"],
    priority: 7,
  },
  {
    id: "egress",
    title: "Egress & Network Transfer",
    description: "Prepaid network transfer credits and usage tracking.",
    icon: <Globe className="h-4 w-4" />,
    prefixes: ["/api/egress"],
    priority: 8,
  },
  {
    id: "admin",
    title: "Admin APIs",
    description: "Administrative endpoints for platform management.",
    icon: <Shield className="h-4 w-4" />,
    prefixes: ["/api/admin"],
    priority: 100,
  },
  {
    id: "public",
    title: "Public APIs",
    description: "Public endpoints for pricing, FAQ, contact, and health checks.",
    icon: <Globe className="h-4 w-4" />,
    prefixes: ["/api/pricing", "/api/faq", "/api/contact", "/api/health", "/api/theme", "/api/documentation"],
    priority: 0,
  },
];

// ── Utility Functions ────────────────────────────────────────────────────────

const normalizePath = (value: string): string => {
  if (!value) return "/";
  const collapsed = value.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
};

const getSectionForPath = (path: string): typeof sectionConfig[number] | null => {
  // Check admin first (higher priority match)
  if (path.startsWith("/api/admin")) {
    return sectionConfig.find(s => s.id === "admin") || null;
  }
  
  // Check egress (before other matches)
  if (path.startsWith("/api/egress")) {
    return sectionConfig.find(s => s.id === "egress") || null;
  }
  
  // Check other sections
  for (const section of sectionConfig) {
    if (section.id === "admin" || section.id === "egress") continue;
    for (const prefix of section.prefixes) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        return section;
      }
    }
  }
  return null;
};

const getRelativePath = (path: string, basePath: string): string => {
  if (path === basePath) return "/";
  const suffix = path.slice(basePath.length);
  if (!suffix) return "/";
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
};

const groupEndpointsBySection = (routes: ActiveApiRoute[]): ApiSection[] => {
  const sectionMap = new Map<string, GroupedEndpoint[]>();
  const unmatchedEndpoints: GroupedEndpoint[] = [];

  // Group routes by section
  for (const route of routes) {
    const section = getSectionForPath(route.path);
    const relativePath = section 
      ? getRelativePath(route.path, section.prefixes[0])
      : route.path;

    const endpoint: GroupedEndpoint = {
      ...route,
      relativePath,
    };

    if (section) {
      const key = section.id;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, []);
      }
      sectionMap.get(key)!.push(endpoint);
    } else {
      unmatchedEndpoints.push(endpoint);
    }
  }

  // Build sections array
  const sections: ApiSection[] = sectionConfig
    .filter(config => sectionMap.has(config.id))
    .map(config => ({
      id: config.id,
      title: config.title,
      description: config.description,
      icon: config.icon,
      basePath: config.prefixes[0],
      endpoints: sectionMap.get(config.id) || [],
    }))
    .sort((a, b) => {
      const aConfig = sectionConfig.find(s => s.id === a.id);
      const bConfig = sectionConfig.find(s => s.id === b.id);
      return (aConfig?.priority || 99) - (bConfig?.priority || 99);
    });

  // Add unmatched endpoints to "Other" section if any
  if (unmatchedEndpoints.length > 0) {
    sections.push({
      id: "other",
      title: "Other APIs",
      description: "Additional API endpoints.",
      icon: <Code2 className="h-4 w-4" />,
      basePath: "/api",
      endpoints: unmatchedEndpoints.sort((a, b) => a.path.localeCompare(b.path)),
    });
  }

  // Sort endpoints within each section
  for (const section of sections) {
    section.endpoints.sort((a, b) => {
      const pathCompare = a.relativePath.localeCompare(b.relativePath);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });
  }

  return sections;
};

const buildCurlCommand = (endpoint: GroupedEndpoint) => {
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://api.example.com';
  const url = `${baseUrl}${endpoint.path}`;

  const lines = [`curl -X ${endpoint.method} "${url}"`];

  if (endpoint.protected) {
    lines.push('  -H "Authorization: Bearer YOUR_API_KEY"');
  }

  if (["POST", "PUT", "PATCH"].includes(endpoint.method)) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push('  -d \'{"key": "value"}\'');
  }

  return lines.join(" \\\n");
};

// ── Component ────────────────────────────────────────────────────────────────

interface ApiReferenceProps {
  onBack?: () => void;
}

export default function ApiReference({ onBack }: ApiReferenceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  // Group endpoints by section
  const sections = useMemo(() => groupEndpointsBySection(ACTIVE_API_ROUTE_MANIFEST), []);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        endpoints: section.endpoints.filter(
          (endpoint) =>
            endpoint.path.toLowerCase().includes(query) ||
            endpoint.method.toLowerCase().includes(query) ||
            (endpoint.protected ? "auth" : "public").includes(query)
        ),
      }))
      .filter((section) => section.endpoints.length > 0);
  }, [sections, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = ACTIVE_API_ROUTE_MANIFEST.length;
    const protected_ = ACTIVE_API_ROUTE_MANIFEST.filter(r => r.protected).length;
    const public_ = total - protected_;
    return { total, protected: protected_, public: public_ };
  }, []);

  // Copy handler
  const handleCopy = useCallback(async (text: string, label: string, endpointKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEndpoint(endpointKey);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  return (
    <div className="relative space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Reference</h1>
            <p className="text-sm text-muted-foreground">
              Complete REST API documentation for {BRAND_NAME} v1
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search endpoints by path or method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-primary" />
              Total Endpoints
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">
              Across {sections.length} categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-amber-600" />
              Protected
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.protected}</p>
            <p className="text-xs text-muted-foreground">
              Require authentication
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-emerald-600" />
              Public
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.public}</p>
            <p className="text-xs text-muted-foreground">
              No authentication required
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {filteredSections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No endpoints found matching &quot;{searchQuery}&quot;
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSections.map((section) => (
              <Card key={section.id} id={`api-section-${section.id}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      {section.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-2 py-1 font-mono">
                      {section.basePath}
                    </code>
                    <Badge variant="secondary" className="font-normal">
                      {section.endpoints.length}{" "}
                      {section.endpoints.length === 1 ? "endpoint" : "endpoints"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible className="w-full">
                    {section.endpoints.map((endpoint, index) => {
                      const endpointKey = `${section.id}-${endpoint.method}-${endpoint.path}-${index}`;
                      return (
                        <AccordionItem
                          value={endpointKey}
                          key={endpointKey}
                          className="border-b last:border-0"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex w-full items-center gap-3 text-left pr-4">
                              <Badge
                                variant="outline"
                                className={`min-w-[4.5rem] justify-center font-mono text-xs font-semibold ${
                                  methodStyles[endpoint.method] || methodStyles.DEFAULT
                                }`}
                              >
                                {endpoint.method}
                              </Badge>
                              <code className="flex-1 text-sm font-medium truncate">
                                {endpoint.relativePath}
                              </code>
                              {endpoint.protected && (
                                <span title="Requires authentication">
                                  <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 pb-2">
                            <div className="space-y-4">
                              {/* Path display */}
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                  Full Path
                                </h4>
                                <code className="block text-sm font-mono bg-muted/50 rounded-md px-3 py-2">
                                  {endpoint.path}
                                </code>
                              </div>

                              {/* Authentication badge */}
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Authentication
                                </h4>
                                {endpoint.protected ? (
                                  <Badge variant="outline" className="text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Required
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                                    <Globe className="h-3 w-3 mr-1" />
                                    Public
                                  </Badge>
                                )}
                              </div>

                              {/* cURL Command */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    cURL Example
                                  </h4>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() =>
                                      handleCopy(
                                        buildCurlCommand(endpoint),
                                        "cURL command",
                                        endpointKey
                                      )
                                    }
                                  >
                                    {copiedEndpoint === endpointKey ? (
                                      "Copied!"
                                    ) : (
                                      <>
                                        <Copy className="mr-1.5 h-3 w-3" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-48 rounded-lg border bg-muted/30">
                                  <pre className="text-xs font-mono leading-relaxed p-4 whitespace-pre-wrap break-all">
                                    {buildCurlCommand(endpoint)}
                                  </pre>
                                </ScrollArea>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
