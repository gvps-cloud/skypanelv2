import React, { useCallback } from "react";
import { Copy, Check, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ResponseViewerProps {
  status: number | null;
  statusText: string | null;
  duration: number | null;
  data: unknown;
  error: string | null;
  headers?: Record<string, string>;
}

export function ResponseViewer({
  status,
  statusText,
  duration,
  data,
  error,
  headers,
}: ResponseViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = useCallback(async () => {
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Response copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [data]);

  if (!status && !error) {
    return null;
  }

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800";
    if (code >= 300 && code < 400) return "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800";
    if (code >= 400 && code < 500) return "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800";
    return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800";
  };

  const getStatusIcon = (code: number) => {
    if (code >= 200 && code < 300) return <CheckCircle className="h-4 w-4" />;
    if (code >= 400 && code < 500) return <AlertCircle className="h-4 w-4" />;
    if (code >= 500) return <XCircle className="h-4 w-4" />;
    return null;
  };

  const formattedData = JSON.stringify(data, null, 2);

  return (
    <div className="mt-4 space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {status && (
            <Badge className={getStatusColor(status)}>
              {getStatusIcon(status)}
              <span className="ml-1">{status}</span>
              {statusText && <span className="ml-1 opacity-70">{statusText}</span>}
            </Badge>
          )}
          {error && (
            <Badge className="bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800">
              <XCircle className="h-4 w-4 mr-1" />
              Error
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {duration !== null && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {duration}ms
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">Error</p>
          <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Response headers */}
      {headers && Object.keys(headers).length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Response Headers ({Object.keys(headers).length})
          </summary>
          <div className="mt-2 p-3 bg-muted/30 rounded-lg">
            <pre className="text-xs font-mono overflow-x-auto">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key}:</span> {value}
                </div>
              ))}
            </pre>
          </div>
        </details>
      )}

      {/* Response body */}
      {data !== null && data !== undefined && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Response Body</p>
          <ScrollArea className="h-[300px] rounded-lg border bg-muted/30">
            <pre className="p-4 text-sm font-mono overflow-x-auto">
              {formattedData}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
