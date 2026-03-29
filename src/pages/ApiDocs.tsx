import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  BookOpen,
  Copy,
  Search,
  Server,
  Lock,
  Code2,
  Key,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND_NAME } from "@/lib/brand";
import {
  type SectionDefinition,
  type EndpointDefinition,
  methodStyles,
  formatJson,
  syncSectionsWithActiveRoutes,
  buildBaseSections,
  buildCurlCommand,
} from "@/lib/apiDocsShared";
import { ApiKeyInput } from "@/components/api-docs/ApiKeyInput";
import { RequestBuilder } from "@/components/api-docs/RequestBuilder";
import { ResponseViewer } from "@/components/api-docs/ResponseViewer";
import { executeRequest, validateApiKey } from "@/lib/apiDocsTryIt";

// Response state type
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
    if (!apiKey) {
      toast.error("Please enter an API key first");
      return;
    }

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
      <div className="space-y-6 pr-0 lg:pr-96">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {BRAND_NAME} API Documentation
            </h1>
            <p className="text-sm text-muted-foreground">
              Complete reference for all backend endpoints. Test endpoints directly with your API key.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* API Key Input */}
      <Card>
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-primary" />
              Endpoints
            </div>
            <p className="mt-2 text-2xl font-bold">
              {sections.reduce((acc, s) => acc + s.endpoints.length, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Across {sections.length} sections
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-amber-600" />
              Protected
            </div>
            <p className="mt-2 text-2xl font-bold">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-emerald-600" />
              Methods
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              GET, POST, PUT, PATCH, DELETE
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Fixed Sidebar */}
        <aside className="hidden lg:block fixed right-4 top-4 w-80 z-40">
          <Card>
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
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No endpoints found matching "{searchQuery}"
                </p>
              </CardContent>
            </Card>
          )}
          {filteredSections.map((section) => (
            <Card key={section.title} id={`section-${section.title}`}>
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
                        {endpoint.auth && (
                          <div className="mt-4 pt-4 border-t">
                            <RequestBuilder
                              endpoint={endpoint}
                              apiBase={section.base}
                              apiKey={apiKey}
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
                        )}
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
