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
} from "lucide-react";
import { toast } from "sonner";

import "@/styles/home.css";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BRAND_NAME } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
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
  // Per-endpoint response tracking - each endpoint has its own response displayed inline
  const [responses, setResponses] = useState<Map<string, ResponseState>>(new Map());
  const [executingEndpoint, setExecutingEndpoint] = useState<string | null>(null);

  const baseSections = useMemo<SectionDefinition[]>(() => buildBaseSections(apiBase), [apiBase]);
  const sections = useMemo(
    () => syncSectionsWithActiveRoutes(baseSections, apiBase),
    [baseSections, apiBase],
  );

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

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((section) =>
        document.getElementById(`section-${section.title}`),
      );
      const scrollPosition = window.scrollY + 100;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].title);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  // Validate API key
  const handleValidateApiKey = useCallback(async (key: string) => {
    return validateApiKey(key);
  }, []);

  // Execute API request - stores response per-endpoint for inline display
  const handleExecuteRequest = useCallback(async (
    endpointKey: string,
    request: { method: string; url: string; body?: unknown; params?: Record<string, string> }
  ) => {
    setExecutingEndpoint(endpointKey);
    // Clear previous response for this endpoint
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(endpointKey, { status: null, statusText: null, duration: null, data: null, error: null });
      return next;
    });

    try {
      const result = await executeRequest({
        ...request,
        apiKey,
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
  }, [apiKey]);

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

  const handleScrollToSection = useCallback((title: string) => {
    setActiveSection(title);
    const anchor = document.getElementById(`section-${title}`);
    if (anchor) {
      const offset = 80;
      const elementPosition = anchor.offsetTop - offset;
      window.scrollTo({ top: elementPosition, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="relative">
      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Floating orbs */}
        <div className="home-orb home-orb--1" aria-hidden="true" />
        <div className="home-orb home-orb--2" aria-hidden="true" />
        <div className="home-orb home-orb--3" aria-hidden="true" />
        <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="space-y-6"
          >
            <div className="space-y-5">
              <Badge
                variant="outline"
                className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                API Reference
              </Badge>

              <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                  {BRAND_NAME} API Documentation
                </span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Complete reference for all backend endpoints. Test any endpoint directly from your browser using your API key — no cURL required.
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-base bg-card/80 backdrop-blur"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
      <section className="border-b border-border/40 bg-muted/20 py-5">
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

      {/* ═══════════════════ API DOCS CONTENT ════════════════════════ */}
      <div className="space-y-6 pr-0 lg:pr-96">

        {/* API Key Input */}
        <motion.div
          variants={revealContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <motion.div variants={revealItem}>
            <Card className="home-gradient-border-top home-animated-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Interactive Testing
                </CardTitle>
                <CardDescription>
                  Enter your API key to test endpoints directly from this page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyInput
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                  onValidate={handleValidateApiKey}
                />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={revealContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <motion.div variants={revealItem}>
            <Card className="home-feature-card">
              <CardContent className="space-y-1 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-4 w-4 text-primary" />
                  Endpoints
                </div>
                <p className="text-2xl font-bold mt-2">
                  {sections.reduce((acc, s) => acc + s.endpoints.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {sections.length} sections
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={revealItem}>
            <Card className="home-feature-card">
              <CardContent className="space-y-1 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-amber-600" />
                  Protected
                </div>
                <p className="text-2xl font-bold mt-2">
                  {sections.reduce(
                    (acc, s) =>
                      acc + s.endpoints.filter((e) => e.auth).length,
                    0,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Require authentication
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={revealItem}>
            <Card className="home-feature-card">
              <CardContent className="space-y-1 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Code2 className="h-4 w-4 text-emerald-600" />
                  Methods
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  GET, POST, PUT, PATCH, DELETE
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Fixed Sidebar */}
          <aside className="hidden lg:block fixed right-4 top-[76px] w-80 z-40">
            <Card className="home-gradient-border-top">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Navigation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  <nav className="space-y-1">
                    {filteredSections.map((section) => (
                      <button
                        key={section.title}
                        onClick={() => handleScrollToSection(section.title)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${activeSection === section.title
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                      >
                        {section.icon}
                        <span className="flex-1 text-left leading-tight">
                          {section.title}
                        </span>
                        <Badge
                          variant="secondary"
                          className="h-5 min-w-5 px-1.5 text-xs"
                        >
                          {section.endpoints.length}
                        </Badge>
                      </button>
                    ))}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          {/* Content Area */}
          <div className="flex-1 space-y-8 min-w-0">
            {filteredSections.length === 0 && (
              <Card className="home-gradient-border-top">
                <CardContent className="py-12 text-center">
                  <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No endpoints found matching "{searchQuery}"
                  </p>
                </CardContent>
              </Card>
            )}
            {filteredSections.map((section) => (
              <Card
                key={section.title}
                id={`section-${section.title}`}
                className="home-gradient-border-top"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        {section.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {section.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {section.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-2 py-1 font-mono">
                      {section.base}
                    </code>
                    <Badge variant="secondary" className="font-normal">
                      {section.endpoints.length}{" "}
                      {section.endpoints.length === 1 ? "endpoint" : "endpoints"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible className="w-full">
                    {section.endpoints.map((endpoint, index) => (
                      <AccordionItem
                        value={`${section.title}-${index}`}
                        key={`${section.title}-${endpoint.path}-${index}`}
                        className="border-b last:border-0"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full items-center gap-3 text-left pr-4">
                            <Badge
                              variant="outline"
                              className={`min-w-[4.5rem] justify-center font-mono text-xs font-semibold ${methodStyles[endpoint.method] ??
                                methodStyles.DEFAULT
                                }`}
                            >
                              {endpoint.method}
                            </Badge>
                            <div className="flex flex-1 flex-col gap-1 min-w-0">
                              <code className="font-semibold text-sm truncate">
                                {endpoint.path}
                              </code>
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {endpoint.description}
                              </span>
                            </div>
                            {endpoint.auth && (
                              <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                            )}
                            {endpoint.admin && (
                              <Shield className="h-4 w-4 text-red-600 shrink-0" />
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          <Tabs
                            defaultValue={
                              endpoint.body
                                ? "request"
                                : endpoint.response
                                  ? "response"
                                  : "curl"
                            }
                          >
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                              {endpoint.body && (
                                <TabsTrigger value="request">Request</TabsTrigger>
                              )}
                              {endpoint.response && (
                                <TabsTrigger value="response">
                                  Response
                                </TabsTrigger>
                              )}
                              <TabsTrigger value="curl">cURL</TabsTrigger>
                            </TabsList>
                            {endpoint.body && (
                              <TabsContent value="request" className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">
                                    Request Body
                                  </h4>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleCopyJson(
                                        endpoint.body,
                                        "Request body",
                                      )
                                    }
                                  >
                                    <Copy className="mr-2 h-3 w-3" /> Copy
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-96 rounded-lg border bg-muted/30 p-4">
                                  <pre className="text-xs font-mono leading-relaxed">
                                    {formatJson(endpoint.body)}
                                  </pre>
                                </ScrollArea>
                              </TabsContent>
                            )}
                            {endpoint.response && (
                              <TabsContent value="response" className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">
                                    Sample Response
                                  </h4>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleCopyJson(
                                        endpoint.response,
                                        "Response body",
                                      )
                                    }
                                  >
                                    <Copy className="mr-2 h-3 w-3" /> Copy
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-96 rounded-lg border bg-muted/30 p-4">
                                  <pre className="text-xs font-mono leading-relaxed">
                                    {formatJson(endpoint.response)}
                                  </pre>
                                </ScrollArea>
                              </TabsContent>
                            )}
                            <TabsContent value="curl" className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                  cURL Command
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleCopy(
                                      buildCurlCommand(section.base, endpoint),
                                      "cURL command",
                                    )
                                  }
                                >
                                  <Copy className="mr-2 h-3 w-3" /> Copy
                                </Button>
                              </div>
                              <ScrollArea className="max-h-96 rounded-lg border bg-muted/30 p-4">
                                <pre className="text-xs font-mono leading-relaxed">
                                  {buildCurlCommand(section.base, endpoint)}
                                </pre>
                              </ScrollArea>
                              {endpoint.params && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs font-medium mb-2">
                                    Query Parameters:
                                  </p>
                                  <pre className="text-xs text-muted-foreground font-mono">
                                    {formatJson(endpoint.params)}
                                  </pre>
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>

                          {/* Try It Section */}
                          <div className="mt-4 pt-4 border-t">
                            <RequestBuilder
                              endpoint={endpoint}
                              apiBase={section.base}
                              apiKey={apiKey}
                              requiresAuth={endpoint.auth}
                              isAdmin={isAdmin}
                              endpointAdmin={endpoint.admin}
                              onExecute={(request) =>
                                handleExecuteRequest(
                                  `${section.title}-${endpoint.path}-${index}`,
                                  request
                                )
                              }
                              isLoading={executingEndpoint === `${section.title}-${endpoint.path}-${index}`}
                              response={responses.get(`${section.title}-${endpoint.path}-${index}`)}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
