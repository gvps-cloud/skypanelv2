import React, { useCallback, useMemo, useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import {
  BookOpen,
  Copy,
  Search,
  Server,
  Lock,
  Shield,
  Code2,
  Key,
  Sparkles,
  KeyRound,
  Zap,
  Globe,
  Clock,
  Play,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

import "@/styles/home.css";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRAND_NAME } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import {
  type SectionDefinition,
  methodStyles,
  formatJson,
  syncSectionsWithActiveRoutes,
  buildBaseSections,
  buildCurlCommand,
} from "@/lib/apiDocsShared";
import { ApiKeyInput } from "@/components/api-docs/ApiKeyInput";
import { RequestBuilder } from "@/components/api-docs/RequestBuilder";
import { executeRequest, validateApiKey } from "@/lib/apiDocsTryIt";

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

/* ─── Trust Items ────────────────────────────────────────────────── */

const trustItems = [
  { icon: KeyRound, label: "JWT Auth" },
  { icon: Globe, label: "REST API" },
  { icon: Clock, label: "Rate Limited" },
  { icon: Zap, label: "JSON Responses" },
  { icon: Shield, label: "Webhook Support" },
  { icon: Server, label: "API Keys" },
  { icon: Code2, label: "Sandbox Mode" },
  { icon: BookOpen, label: "Versioned API" },
];

/* ─── Response State Type ────────────────────────────────────────── */

interface ResponseState {
  status: number | null;
  statusText: string | null;
  duration: number | null;
  data: unknown;
  error: string | null;
  headers?: Record<string, string>;
}

export default function ApiDocs() {
  const apiBase = (
    import.meta.env.VITE_API_URL ||
    `${window.location.protocol}//${window.location.host}/api`
  ).replace(/\/$/, "");

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [userOrgs, setUserOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgsFetchFailed, setOrgsFetchFailed] = useState(false);

  const baseSections = useMemo<SectionDefinition[]>(() => buildBaseSections(apiBase), [apiBase]);
  const sections = useMemo(
    () => syncSectionsWithActiveRoutes(baseSections, apiBase),
    [baseSections, apiBase],
  );

  // Initialize active section
  useEffect(() => {
    if (!activeSection && sections.length > 0) {
      setActiveSection(sections[0].title);
    }
  }, [sections, activeSection]);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{ organizations: Array<{ id: string; name: string }> }>("/organizations")
      .then((data) => {
        const orgs = data.organizations ?? [];
        setUserOrgs(orgs);
        if (orgs.length === 1) {
          setOrganizationId(orgs[0].id);
        } else if (orgs.length > 1 && !organizationId) {
          const activeMatch = orgs.find((o) => o.id === user.organizationId);
          if (activeMatch) setOrganizationId(activeMatch.id);
        }
      })
      .catch(() => {
        setOrgsFetchFailed(true);
        if (!organizationId && user.organizationId) {
          setOrganizationId(user.organizationId);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const endpointRequiresOrganization = useCallback(
    (fullPath: string): boolean => {
      const orgScopedPrefixes = [
        "/api/vps",
        "/api/payments",
        "/api/support",
        "/api/invoices",
        "/api/activity",
        "/api/notifications",
        "/api/ssh-keys",
        "/api/organizations",
        "/api/egress",
      ];
      return orgScopedPrefixes.some((prefix) => fullPath.startsWith(prefix));
    },
    [],
  );

  const [responses, setResponses] = useState<Map<string, ResponseState>>(new Map());
  const [executingEndpoint, setExecutingEndpoint] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    const query = searchQuery.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        endpoints: section.endpoints.filter(
          (endpoint) =>
            endpoint.path.toLowerCase().includes(query) ||
            endpoint.description.toLowerCase().includes(query) ||
            endpoint.method.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.endpoints.length > 0);
  }, [sections, searchQuery]);

  const activeSectionData = useMemo(() => {
    if (searchQuery) {
      return filteredSections;
    }
    return sections.filter((s) => s.title === activeSection);
  }, [sections, filteredSections, activeSection, searchQuery]);

  const handleValidateApiKey = useCallback(async (key: string) => {
    const result = await validateApiKey(key);
    if (result.valid && result.organizationId && !organizationId.trim()) {
      setOrganizationId(result.organizationId);
    }
    return result;
  }, [organizationId]);

  const handleExecuteRequest = useCallback(async (
    endpointKey: string,
    request: { method: string; url: string; body?: unknown; params?: Record<string, string> }
  ) => {
    setExecutingEndpoint(endpointKey);
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(endpointKey, { status: null, statusText: null, duration: null, data: null, error: null });
      return next;
    });

    try {
      const result = await executeRequest({
        ...request,
        apiKey,
        organizationId: organizationId.trim() || undefined,
      });

      setResponses((prev) => {
        const next = new Map(prev);
        next.set(endpointKey, {
          status: result.status,
          statusText: result.statusText,
          duration: result.duration,
          data: result.data,
          error: result.error || null,
          headers: result.headers,
        });
        return next;
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.status >= 200 && result.status < 300) {
        toast.success(`Request successful (${result.status})`);
      } else {
        toast.warning(`Request returned ${result.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Request failed";
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(endpointKey, {
          status: 0,
          statusText: "Error",
          duration: null,
          data: null,
          error: errorMessage,
        });
        return next;
      });
      toast.error(errorMessage);
    } finally {
      setExecutingEndpoint(null);
    }
  }, [apiKey, organizationId]);

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast.error("Unable to copy. Please copy manually.");
    }
  }, []);

  const handleCopyJson = useCallback(
    (payload: unknown, label: string) => handleCopy(formatJson(payload), label),
    [handleCopy],
  );

  return (
    <div className="relative bg-background min-h-screen">
      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="home-orb home-orb--1" aria-hidden="true" />
        <div className="home-orb home-orb--2" aria-hidden="true" />
        <div className="home-orb home-orb--3" aria-hidden="true" />
        <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="space-y-6"
          >
            <div className="space-y-5 lg:max-w-2xl">
              <Badge
                variant="outline"
                className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                API Reference
              </Badge>

              <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                  {BRAND_NAME} Developers
                </span>
              </h1>

              <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Build your next integration using our comprehensive REST API. Test endpoints instantly from your browser.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
      <section className="border-b border-border/40 bg-muted/20 py-4">
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

      {/* ═══════════════════ MAIN LAYOUT ════════════════════════ */}
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-10">
        
        {/* LEFT SIDEBAR (Navigation & Config) */}
        <aside className="w-full lg:w-[320px] shrink-0">
          <div className="sticky top-[100px] space-y-6">
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-base bg-card shadow-sm border-border"
              />
            </div>

            {/* Navigation Menu */}
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-4 px-5">
                <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  API Sections
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <nav className="p-3 space-y-1">
                    {filteredSections.map((section) => {
                      const isActive = activeSection === section.title && !searchQuery;
                      return (
                        <button
                          key={section.title}
                          onClick={() => {
                            setSearchQuery("");
                            setActiveSection(section.title);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                            isActive
                              ? "bg-primary/10 font-semibold text-primary shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                          }`}
                        >
                          <div className={isActive ? "text-primary" : "text-muted-foreground/70"}>
                            {section.icon}
                          </div>
                          <span className="flex-1 text-left leading-tight">
                            {section.title}
                          </span>
                          <Badge
                            variant={isActive ? "default" : "secondary"}
                            className="h-5 min-w-5 px-1.5 text-[10px] bg-background"
                          >
                            {section.endpoints.length}
                          </Badge>
                        </button>
                      );
                    })}
                    {filteredSections.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No sections match your search.
                      </div>
                    )}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 min-w-0 pb-32">
          
          {/* Interactive Config Panel (Top of content) */}
          <motion.div
            variants={revealContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mb-10"
          >
            <motion.div variants={revealItem}>
              <Card className="home-gradient-border-top home-animated-border shadow-md bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Interactive Try-It Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure your API Key to test endpoints directly from the documentation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 bg-muted/10">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Authentication
                      </label>
                      <ApiKeyInput
                        apiKey={apiKey}
                        onApiKeyChange={setApiKey}
                        onValidate={handleValidateApiKey}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Organization Context
                      </label>
                      {orgsFetchFailed ? (
                        <Input
                          value={organizationId}
                          onChange={(e) => setOrganizationId(e.target.value)}
                          placeholder="Organization UUID"
                          className="bg-background"
                          autoComplete="off"
                          data-1p-ignore
                          spellCheck={false}
                        />
                      ) : (
                        <Select value={organizationId} onValueChange={setOrganizationId}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select an organization…" />
                          </SelectTrigger>
                          <SelectContent>
                            {userOrgs.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                                <span className="ml-2 text-xs text-muted-foreground font-mono">
                                  ({org.id.slice(0, 8)}…)
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Required for endpoints that modify organization resources.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Endpoints List */}
          {activeSectionData.map((section) => (
            <div key={section.title} className="mb-20">
              <div className="mb-8 border-b pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                    {section.icon}
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">{section.title}</h2>
                </div>
                <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed mt-4">
                  {section.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Base URL:</span>
                  <code className="rounded-md bg-muted px-2.5 py-1 font-mono font-medium text-foreground">
                    {section.base}
                  </code>
                </div>
              </div>

              <div className="space-y-12">
                {section.endpoints.map((endpoint, index) => {
                  const endpointKey = `${section.title}-${endpoint.path}-${index}`;
                  return (
                    <Card
                      key={endpointKey}
                      className="overflow-hidden shadow-sm border-border transition-all hover:shadow-md bg-card/40"
                      id={`endpoint-${index}`}
                    >
                      <CardHeader className="bg-muted/30 border-b p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-3 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge
                              className={`text-xs px-2.5 py-0.5 rounded-md shadow-sm ${
                                methodStyles[endpoint.method] ?? methodStyles.DEFAULT
                              }`}
                            >
                              {endpoint.method}
                            </Badge>
                            <code className="text-base sm:text-lg font-mono font-bold break-all">
                              {endpoint.path}
                            </code>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {endpoint.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {endpoint.auth && (
                            <Badge variant="outline" className="text-amber-600 bg-amber-500/5 border-amber-500/20">
                              <Lock className="w-3 h-3 mr-1.5" /> Auth
                            </Badge>
                          )}
                          {endpoint.admin && (
                            <Badge variant="outline" className="text-red-600 bg-red-500/5 border-red-500/20">
                              <Shield className="w-3 h-3 mr-1.5" /> Admin
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Tabs
                          defaultValue={endpoint.body ? "request" : endpoint.response ? "response" : "tryit"}
                          className="w-full"
                        >
                          <div className="border-b bg-muted/10 px-2 sm:px-5">
                            <TabsList className="bg-transparent h-12 p-0 space-x-6 sm:space-x-8 rounded-none">
                              {endpoint.body && (
                                <TabsTrigger
                                  value="request"
                                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full font-medium"
                                >
                                  Request
                                </TabsTrigger>
                              )}
                              {endpoint.response && (
                                <TabsTrigger
                                  value="response"
                                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full font-medium"
                                >
                                  Response
                                </TabsTrigger>
                              )}
                              <TabsTrigger
                                value="curl"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full font-medium"
                              >
                                cURL
                              </TabsTrigger>
                              <TabsTrigger
                                value="tryit"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full font-medium text-primary flex items-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Try It
                              </TabsTrigger>
                            </TabsList>
                          </div>

                          {endpoint.body && (
                            <TabsContent value="request" className="m-0 p-5 space-y-4 bg-card">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold tracking-tight">Request Payload</h4>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => handleCopyJson(endpoint.body, "Request body")}
                                >
                                  <Copy className="mr-2 h-3 w-3" /> Copy JSON
                                </Button>
                              </div>
                              <ScrollArea className="max-h-[400px] rounded-lg border bg-[#0d1117] text-[#e6edf3] p-4">
                                <pre className="text-xs font-mono leading-relaxed">
                                  {formatJson(endpoint.body)}
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                          )}

                          {endpoint.response && (
                            <TabsContent value="response" className="m-0 p-5 space-y-4 bg-card">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold tracking-tight">Sample Response</h4>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => handleCopyJson(endpoint.response, "Response body")}
                                >
                                  <Copy className="mr-2 h-3 w-3" /> Copy JSON
                                </Button>
                              </div>
                              <ScrollArea className="max-h-[400px] rounded-lg border bg-[#0d1117] text-[#e6edf3] p-4">
                                <pre className="text-xs font-mono leading-relaxed">
                                  {formatJson(endpoint.response)}
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                          )}

                          <TabsContent value="curl" className="m-0 p-5 space-y-4 bg-card">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold tracking-tight">cURL Command</h4>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                onClick={() => handleCopy(buildCurlCommand(section.base, endpoint), "cURL command")}
                              >
                                <Copy className="mr-2 h-3 w-3" /> Copy cURL
                              </Button>
                            </div>
                            <ScrollArea className="max-h-[400px] rounded-lg border bg-[#0d1117] text-[#e6edf3] p-4">
                              <pre className="text-xs font-mono leading-relaxed">
                                {buildCurlCommand(section.base, endpoint)}
                              </pre>
                            </ScrollArea>
                            {endpoint.params && (
                              <div className="rounded-lg border bg-muted/30 p-4 mt-4">
                                <p className="text-xs font-semibold mb-2">Query Parameters:</p>
                                <pre className="text-xs text-muted-foreground font-mono">
                                  {formatJson(endpoint.params)}
                                </pre>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="tryit" className="m-0 p-5 bg-card/50">
                            <RequestBuilder
                              endpoint={endpoint}
                              apiBase={section.base}
                              apiKey={apiKey}
                              organizationId={organizationId.trim() || undefined}
                              requiresOrganization={endpointRequiresOrganization(
                                `${section.base.replace(apiBase, "/api")}${endpoint.path}`,
                              )}
                              requiresAuth={endpoint.auth}
                              isAdmin={isAdmin}
                              endpointAdmin={endpoint.admin}
                              onExecute={(request) => handleExecuteRequest(endpointKey, request)}
                              isLoading={executingEndpoint === endpointKey}
                              response={responses.get(endpointKey)}
                            />
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}