import React, { useState, useCallback, useMemo } from "react";
import { Play, Loader2, Copy, Check } from "lucide-react";
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
    if (!apiKey) {
      toast.error("Please enter an API key first");
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
  }, [apiKey, hasBody, bodyText, endpoint.method, fullUrl, queryParams, onExecute]);

  const handleCopyCurl = useCallback(async () => {
    const lines = [`curl -X ${endpoint.method} "${fullUrl}"`];
    lines.push('-H "X-API-Key: YOUR_API_KEY"');
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
  }, [endpoint.method, fullUrl, hasBody, bodyText]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          disabled={!endpoint.auth && !apiKey}
        >
          <Play className="h-4 w-4 mr-2" />
          Try It
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {/* Method and URL display */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
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
                  <code className="text-sm text-muted-foreground w-24">:{param.name}</code>
                  <Input
                    placeholder={`Enter ${param.name}`}
                    value={param.value}
                    onChange={(e) => handlePathParamChange(index, e.target.value)}
                    className="flex-1"
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
                  <code className="text-sm text-muted-foreground w-24">{key}</code>
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
              className="font-mono text-sm min-h-[120px]"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleExecute}
            disabled={isLoading || !apiKey}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Request
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleCopyCurl}>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!apiKey && endpoint.auth && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            ⚠️ This endpoint requires authentication. Please enter your API key above.
          </p>
        )}

        {/* Inline Response Viewer - shows response directly below the executed endpoint */}
        {response && (response.status !== null || response.error) && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Response</h4>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
