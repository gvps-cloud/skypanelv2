import { useCallback, useEffect, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MetricsEntry {
  datetime: string;
  bytesReceived: number;
  bytesSent: number;
  uniqueHits: number;
  botHits: number;
  totalHits: number;
}

interface Props {
  subscriptionId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

const RANGES = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

export default function MetricsCard({ subscriptionId }: Props) {
  const [entries, setEntries] = useState<MetricsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("24h");

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const now = new Date();
      let start: Date;
      if (range === "24h") start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      else if (range === "7d") start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: now.toISOString(),
      });
      const data = await apiClient.get<{ items: MetricsEntry[] }>(
        `/hosting/web/${subscriptionId}/metrics?${params}`
      );
      setEntries(data?.items ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, range]);

  useEffect(() => { load(); }, [load]);

  const totalReceived = entries.reduce((s, e) => s + e.bytesReceived, 0);
  const totalSent = entries.reduce((s, e) => s + e.bytesSent, 0);
  const totalUnique = entries.reduce((s, e) => s + e.uniqueHits, 0);
  const totalBot = entries.reduce((s, e) => s + e.botHits, 0);
  const totalHits = entries.reduce((s, e) => s + e.totalHits, 0);

  const maxBandwidth = Math.max(...entries.map((e) => e.bytesReceived + e.bytesSent), 1);

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>Analytics</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Website traffic and bandwidth metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No metrics data available.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Bandwidth In", value: formatBytes(totalReceived) },
                { label: "Bandwidth Out", value: formatBytes(totalSent) },
                { label: "Unique Hits", value: formatNumber(totalUnique) },
                { label: "Bot Hits", value: formatNumber(totalBot) },
                { label: "Total Hits", value: formatNumber(totalHits) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold mt-1">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Bar Chart */}
            <div>
              <h3 className="text-sm font-medium mb-3">Bandwidth Over Time</h3>
              <div className="space-y-1">
                {entries.slice(-24).map((entry) => {
                  const total = entry.bytesReceived + entry.bytesSent;
                  const pct = (total / maxBandwidth) * 100;
                  const sentPct = (entry.bytesSent / Math.max(total, 1)) * 100;
                  return (
                    <div key={entry.datetime} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                        {new Date(entry.datetime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {" "}
                        {new Date(entry.datetime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
                        <div
                          className="h-full rounded-l bg-blue-500/70"
                          style={{ width: `${pct * (sentPct / 100)}%` }}
                        />
                        <div
                          className="h-full bg-green-500/70 -mt-4"
                          style={{ width: `${pct * (1 - sentPct / 100)}%`, marginLeft: `${pct * (sentPct / 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-20 text-right">
                        {formatBytes(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/70 inline-block" /> Sent</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/70 inline-block" /> Received</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
