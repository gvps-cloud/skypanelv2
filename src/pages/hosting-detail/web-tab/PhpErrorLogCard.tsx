import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Download, FileText } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Props {
  subscriptionId: string;
}

export default function PhpErrorLogCard({ subscriptionId }: Props) {
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    try {
      const data = await apiClient.get<{ log: string }>(`/hosting/web/${subscriptionId}/php/error-log`);
      setLog(data?.log ?? "");
    } catch {
      setLog("");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const handleDownload = () => {
    const blob = new Blob([log], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "php-error.log";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              <span>PHP Error Log</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Last 256KB of PHP error output.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!log}>
              <Download className="h-3 w-3 mr-1.5" />Download
            </Button>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <pre className="bg-zinc-950 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96 font-mono whitespace-pre-wrap break-all">
            {log || <span className="text-zinc-500">No error log entries found.</span>}
          </pre>
        )}
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
