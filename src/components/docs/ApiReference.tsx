import React, { useMemo, useState, useCallback } from "react";
import {
  BookOpen,
  Copy,
  Search,
  Lock,
  Code2,
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
import {
  type SectionDefinition,
  type EndpointDefinition,
  syncSectionsWithActiveRoutes,
  buildBaseSections,
} from "@/lib/apiDocsShared";
import { ACTIVE_API_ROUTE_MANIFEST } from "@/lib/apiRouteManifest";

// ── Rendering Helpers ──────────────────────────────────────────────────────

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
  POST: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  PUT: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800",
  PATCH: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  DELETE: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800",
  DEFAULT: "bg-muted text-foreground border-border",
};

const buildCurlCommand = (sectionBase: string, endpoint: EndpointDefinition) => {
  const url = `${sectionBase}${endpoint.path}`;

  const lines = [`curl -X ${endpoint.method} "${url}"`];

  if (endpoint.auth) {
    lines.push('  -H "Authorization: Bearer YOUR_API_KEY"');
  }

  if (endpoint.body) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(endpoint.body)}'`);
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

  const apiBase = (
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}/api`
      : "/api"
  ).replace(/\/$/, "");

  // Use the same shared data source as ApiDocs (/api-docs)
  const baseSections = useMemo<SectionDefinition[]>(
    () => buildBaseSections(apiBase),
    [apiBase],
  );
  const sections = useMemo(
    () => syncSectionsWithActiveRoutes(baseSections, apiBase),
    [baseSections, apiBase],
  );

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
            endpoint.description.toLowerCase().includes(query) ||
            endpoint.method.toLowerCase().includes(query) ||
            (endpoint.auth ? "auth" : "public").includes(query)
        ),
      }))
      .filter((section) => section.endpoints.length > 0);
  }, [sections, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const allEndpoints = sections.flatMap((s) => s.endpoints);
    const total = allEndpoints.length;
    const protected_ = allEndpoints.filter((e) => e.auth).length;
    const public_ = total - protected_;
    return { total, protected: protected_, public: public_ };
  }, [sections]);

  // Copy handler
  const handleCopy = useCallback(async (text: string, label: string, endpointKeyStr: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEndpoint(endpointKeyStr);
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
            filteredSections.map((section, sectionIdx) => (
              <Card key={sectionIdx} id={`api-section-${sectionIdx}`}>
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
                    {section.endpoints.map((endpoint, index) => {
                      const endpointKeyStr = `${sectionIdx}-${endpoint.method}-${endpoint.path}-${index}`;
                      return (
                        <AccordionItem
                          value={endpointKeyStr}
                          key={endpointKeyStr}
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
                                {endpoint.path}
                              </code>
                              {endpoint.auth && (
                                <span title="Requires authentication">
                                  <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 pb-2">
                            <div className="space-y-4">
                              {/* Full Path */}
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                  Full Path
                                </h4>
                                <code className="block text-sm font-mono bg-muted/50 rounded-md px-3 py-2">
                                  {section.base}{endpoint.path}
                                </code>
                              </div>

                              {/* Description */}
                              {endpoint.description && (
                                <div>
                                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                    Description
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {endpoint.description}
                                  </p>
                                </div>
                              )}

                              {/* Authentication badge */}
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Authentication
                                </h4>
                                {endpoint.auth ? (
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
                                        buildCurlCommand(section.base, endpoint),
                                        "cURL command",
                                        endpointKeyStr
                                      )
                                    }
                                  >
                                    {copiedEndpoint === endpointKeyStr ? (
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
                                    {buildCurlCommand(section.base, endpoint)}
                                  </pre>
                                </ScrollArea>
                              </div>

                              {/* Request Body (if available) */}
                              {endpoint.body && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Request Body
                                    </h4>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() =>
                                        handleCopy(
                                          JSON.stringify(endpoint.body, null, 2),
                                          "Request body",
                                          `body-${endpointKeyStr}`
                                        )
                                      }
                                    >
                                      {copiedEndpoint === `body-${endpointKeyStr}` ? (
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
                                      {JSON.stringify(endpoint.body, null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}

                              {/* Response (if available) */}
                              {endpoint.response && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Response
                                    </h4>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() =>
                                        handleCopy(
                                          JSON.stringify(endpoint.response, null, 2),
                                          "Response",
                                          `response-${endpointKeyStr}`
                                        )
                                      }
                                    >
                                      {copiedEndpoint === `response-${endpointKeyStr}` ? (
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
                                      {JSON.stringify(endpoint.response, null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
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
