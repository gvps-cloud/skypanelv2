import { useMemo, useState } from "react";
import { Copy, Lock, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeyInput } from "@/components/api-docs/ApiKeyInput";
import { RequestBuilder } from "@/components/api-docs/RequestBuilder";
import {
  buildCurlCommand,
  formatJson,
  methodStyles,
  type EndpointDefinition,
  type SectionDefinition,
} from "@/lib/apiDocsShared";
import { cn } from "@/lib/utils";

interface ResponseState {
  status: number | null;
  statusText: string | null;
  duration: number | null;
  data: unknown;
  error: string | null;
  headers?: Record<string, string>;
}

interface SwaggerExplorerProps {
  sections: SectionDefinition[];
  apiKey?: string;
  organizationId?: string;
  onApiKeyChange?: (...args: [string]) => void;
  onOrganizationIdChange?: (...args: [string]) => void;
  userOrganizations?: Array<{ id: string; name: string }>;
  validateApiKey?: (...args: [string]) => Promise<{ valid: boolean; error?: string; organizationId?: string }>;
  onExecute?: (...args: [
    string,
    { method: string; url: string; body?: unknown; params?: Record<string, string> },
  ]) => Promise<void>;
  responses?: Map<string, ResponseState>;
  executingEndpoint?: string | null;
  isAdmin?: boolean;
  readonly?: boolean;
  onCopy: (...args: [string, string]) => void;
}

const endpointKeyFor = (section: SectionDefinition, endpoint: EndpointDefinition, index: number) =>
  `${section.title}-${endpoint.path}-${index}`;

export function SwaggerExplorer({
  sections,
  apiKey = "",
  organizationId = "",
  onApiKeyChange,
  onOrganizationIdChange,
  userOrganizations = [],
  validateApiKey,
  onExecute,
  responses,
  executingEndpoint,
  isAdmin = false,
  readonly = false,
  onCopy,
}: SwaggerExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(sections[0]?.title ?? "");

  const handleMissingApiKeyChange = () => undefined;
  const handleMissingValidateApiKey = () => Promise.resolve({ valid: false });

  const filteredSections = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return sections;

    return sections
      .map((section) => ({
        ...section,
        endpoints: section.endpoints.filter((endpoint) =>
          `${section.title} ${endpoint.method} ${endpoint.path} ${endpoint.description}`
            .toLowerCase()
            .includes(normalized),
        ),
      }))
      .filter((section) => section.endpoints.length > 0);
  }, [searchQuery, sections]);

  const displayedSections = searchQuery
    ? filteredSections
    : filteredSections.filter((section) => section.title === activeSection);

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="border-primary/20 bg-card/90 border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Swagger Explorer
            </CardTitle>
            <CardDescription>Search routes, then expand method cards to inspect schemas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              placeholder="Search endpoints..."
            />
            {!readonly && (
              <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <ApiKeyInput
                  apiKey={apiKey}
                  onApiKeyChange={onApiKeyChange ?? handleMissingApiKeyChange}
                  onValidate={validateApiKey ?? handleMissingValidateApiKey}
                />
                <Input
                  value={organizationId}
                  onChange={(event) => {
                    onOrganizationIdChange?.(event.target.value);
                  }}
                  placeholder="Organization ID"
                  list="swagger-orgs"
                />
                <datalist id="swagger-orgs">
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </datalist>
              </div>
            )}
            <ScrollArea className="h-[48vh] pr-2">
              <div className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.title}
                    type="button"
                    onClick={() => {
                      setActiveSection(section.title);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      activeSection === section.title && !searchQuery
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 hover:border-primary/30 hover:bg-primary/5",
                    )}
                  >
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="outline">{section.endpoints.length}</Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        {displayedSections.map((section) => (
          <section key={section.title} className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            {section.endpoints.map((endpoint, index) => {
              const endpointKey = endpointKeyFor(section, endpoint, index);
              return (
                <Card key={endpointKey} className="overflow-hidden border-primary/15">
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("font-mono", methodStyles[endpoint.method] ?? methodStyles.DEFAULT)}>
                            {endpoint.method}
                          </Badge>
                          <code className="rounded bg-background px-2 py-1 font-mono text-sm">{endpoint.path}</code>
                          {endpoint.auth && <Lock className="h-4 w-4 text-primary" />}
                        </div>
                        <CardDescription>{endpoint.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onCopy(`${section.base}${endpoint.path}`, "Endpoint URL");
                        }}
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copy URL
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Tabs defaultValue={readonly ? "response" : "tryit"}>
                      <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent px-4">
                        {!readonly && <TabsTrigger value="tryit">Try It</TabsTrigger>}
                        <TabsTrigger value="request">Request</TabsTrigger>
                        <TabsTrigger value="response">Response</TabsTrigger>
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                      </TabsList>
                      {!readonly && (
                        <TabsContent value="tryit" className="m-0 p-4">
                          <RequestBuilder
                            endpoint={endpoint}
                            apiBase={section.base}
                            apiKey={apiKey}
                            organizationId={organizationId}
                            requiresAuth={endpoint.auth}
                            isAdmin={isAdmin}
                            endpointAdmin={endpoint.admin}
                            onExecute={(request) => {
                              if (onExecute) {
                                return onExecute(endpointKey, request);
                              }
                              return Promise.resolve();
                            }}
                            isLoading={executingEndpoint === endpointKey}
                            response={responses?.get(endpointKey)}
                          />
                        </TabsContent>
                      )}
                      <TabsContent value="request" className="m-0 p-4">
                        <ScrollArea className="max-h-[360px] rounded-lg border bg-[#0d1117] p-4 text-[#e6edf3]">
                          <pre className="text-xs">{formatJson(endpoint.body ?? endpoint.params ?? {})}</pre>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="response" className="m-0 p-4">
                        <ScrollArea className="max-h-[360px] rounded-lg border bg-[#0d1117] p-4 text-[#e6edf3]">
                          <pre className="text-xs">{formatJson(endpoint.response ?? {})}</pre>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="curl" className="m-0 p-4">
                        <ScrollArea className="max-h-[360px] rounded-lg border bg-[#0d1117] p-4 text-[#e6edf3]">
                          <pre className="text-xs">{buildCurlCommand(section.base, endpoint)}</pre>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
