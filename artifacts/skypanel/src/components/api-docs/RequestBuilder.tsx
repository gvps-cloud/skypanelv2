import React, { useState, useCallback, useMemo } from "react";
import { Play, Loader2, Copy, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { methodStyles, type EndpointDefinition } from "@/lib/apiDocsShared";
import { ResponseViewer } from "./ResponseViewer";

interface PathParam {
  name: string;
  value: string;
}

interface ResponseState {
  status: number | null;
  statusText: string | null;
  duration: number | null;
  data: unknown;
  error: string | null;
  headers?: Record<string, string>;
}

interface RequestBuilderProps {
  endpoint: EndpointDefinition;
  apiBase: string;
  apiKey: string | null;
  organizationId?: string;
  requiresOrganization?: boolean;
  requiresAuth?: boolean;
  isAdmin?: boolean;
  endpointAdmin?: boolean;
  onExecute: (request: {
    method: string;
    url: string;
    body?: unknown;
    params?: Record<string, string>;
  }) => Promise<void>;
  isLoading?: boolean;
  response?: ResponseState;
}

export function RequestBuilder({
  endpoint,
  apiBase,
  apiKey,
  organizationId,
  requiresOrganization = false,
  requiresAuth = true,
  isAdmin = false,
  endpointAdmin = false,
  onExecute,
  isLoading = false,
  response,
}: RequestBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bodyText, setBodyText] = useState(() =>
    endpoint.body ? JSON.stringify(endpoint.body, null, 2) : ""
  );
  const [queryParams, setQueryParams] = useState<Record<string, string>>(() =>
    endpoint.params ? Object.fromEntries(
      Object.entries(endpoint.params).map(([k, v]) => [k, String(v)])
    ) : {}
  );
  const [pathParams, setPathParams] = useState<PathParam[]>(() => {
    const matches = endpoint.path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (!matches) return [];
    return matches.map((m) => ({
      name: m.slice(1),
      value: "",
    }));
  });
  const [copied, setCopied] = useState(false);

  const hasBody = ["POST", "PUT", "PATCH"].includes(endpoint.method);
  const hasPathParams = pathParams.length > 0;
  const hasQueryParams = Object.keys(queryParams).length > 0;
  const isAdminBlocked = endpointAdmin && !isAdmin;
  const missingOrganization = requiresOrganization && !organizationId;

  const methodStyle = methodStyles[endpoint.method] || methodStyles.DEFAULT;

  const resolvedPath = useMemo(() => {
    let path = endpoint.path;
    for (const param of pathParams) {
      if (param.value) {
        path = path.replace(`:${param.name}`, param.value);
      }
    }
    return path;
  }, [endpoint.path, pathParams]);

  const fullUrl = useMemo(() => {
    const url = `${apiBase}${resolvedPath}`;
    const queryString = Object.entries(queryParams)
      .filter(([, v]) => v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return queryString ? `${url}?${queryString}` : url;
  }, [apiBase, resolvedPath, queryParams]);

  const handlePathParamChange = useCallback((index: number, value: string) => {
    setPathParams((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  }, []);

  const handleQueryParamChange = useCallback((key: string, value: string) => {
    setQueryParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBodyText(e.target.value);
  }, []);

  const handleExecute = useCallback(async () => {
    if (isAdminBlocked) {
      toast.error("Admin access required for this endpoint");
      return;
    }

    if (requiresAuth && !apiKey) {
      toast.error("Please enter an API key first");
      return;
    }
    if (missingOrganization) {
      toast.error("This endpoint requires an Organization ID");
      return;
    }

    let parsedBody: unknown | undefined;
    if (hasBody && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        toast.error("Invalid JSON in request body");
        return;
      }
    }

    await onExecute({
      method: endpoint.method,
      url: fullUrl,
      body: parsedBody,
      params: queryParams,
    });
  }, [isAdminBlocked, requiresAuth, apiKey, missingOrganization, hasBody, bodyText, endpoint.method, fullUrl, queryParams, onExecute]);

  const handleCopyCurl = useCallback(async () => {
    const lines = [`curl -X ${endpoint.method} "${fullUrl}"`];
    lines.push('-H "X-API-Key: YOUR_API_KEY"');
    if (requiresOrganization) {
      lines.push(
        `-H "X-Organization-ID: ${organizationId || "YOUR_ORGANIZATION_ID"}"`,
      );
    }
    if (hasBody && bodyText.trim()) {
      lines.push('-H "Content-Type: application/json"');
      lines.push(`-d '${bodyText}'`);
    }
    const curl = lines.join(" \\\n  ");

    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      toast.success("cURL command copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [endpoint.method, fullUrl, requiresOrganization, organizationId, hasBody, bodyText]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {isAdminBlocked ? (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-400">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" />
            Admin Access Required
          </div>
          <p className="mt-1 text-red-600 dark:text-red-400/80">
            This endpoint requires administrator privileges. Contact your platform admin for access.
          </p>
        </div>
      ) : (
        <>
          {/* Method and URL display */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <Badge className={methodStyle}>{endpoint.method}</Badge>
            <code className="text-sm font-mono flex-1 break-all">{fullUrl}</code>
          </div>

          {/* Path Parameters */}
          {hasPathParams && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Path Parameters</Label>
              <div className="grid gap-2">
                {pathParams.map((param, index) => (
                  <div key={param.name} className="flex items-center gap-2">
                    <code className="text-sm text-muted-foreground w-28 text-right">:{param.name}</code>
                    <Input
                      placeholder={`Enter ${param.name}`}
                      value={param.value}
                      onChange={(e) => handlePathParamChange(index, e.target.value)}
                      className="flex-1"
                      autoComplete="off"
                      data-1p-ignore
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Query Parameters */}
          {hasQueryParams && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Query Parameters</Label>
              <div className="grid gap-2">
                {Object.entries(queryParams).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <code className="text-sm text-muted-foreground w-28 text-right">{key}</code>
                    <Input
                      placeholder={key}
                      value={value}
                      onChange={(e) => handleQueryParamChange(key, e.target.value)}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {hasBody && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Request Body (JSON)</Label>
              <Textarea
                placeholder='{"key": "value"}'
                value={bodyText}
                onChange={handleBodyChange}
                className="font-mono text-sm min-h-[160px] resize-y"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleExecute}
              disabled={isLoading || (requiresAuth && !apiKey) || missingOrganization}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2 fill-current" />
                  Execute Request
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleCopyCurl} title="Copy cURL">
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Warnings */}
          <div className="space-y-1 mt-2">
            {!apiKey && requiresAuth && (
              <p className="text-xs font-medium flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                <ShieldAlert className="h-3.5 w-3.5" /> This endpoint requires authentication. Enter an API key in the configuration panel.
              </p>
            )}
            {missingOrganization && (
              <p className="text-xs font-medium flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                <ShieldAlert className="h-3.5 w-3.5" /> This endpoint requires an Organization ID. Select one in the configuration panel.
              </p>
            )}
          </div>

          {/* Inline Response Viewer */}
          {response && (response.status !== null || response.error) && (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" /> Response Result
              </h4>
              <ResponseViewer
                status={response.status}
                statusText={response.statusText}
                duration={response.duration}
                data={response.data}
                error={response.error}
                headers={response.headers}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
