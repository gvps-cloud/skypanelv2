import { useState, useEffect } from "react";
import { Copy, Check, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function truncateId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

interface OverviewTabProps {
  service: Record<string, any>;
}

export default function OverviewTab({ service }: OverviewTabProps) {
  const [bandwidth, setBandwidth] = useState<Record<string, any> | null>(null);
  const [bandwidthLoading, setBandwidthLoading] = useState(false);
  const [bandwidthError, setBandwidthError] = useState<string | null>(null);

  // Fetch bandwidth data
  useEffect(() => {
    if (!service?.id || !service?.enhance_subscription_id) {
      setBandwidth(null);
      return;
    }

    const fetchBandwidth = async () => {
      setBandwidthLoading(true);
      setBandwidthError(null);
      try {
        const data = await apiClient.get<{ bandwidth: Record<string, any> | null }>(
          `/hosting/services/${service.id}/bandwidth`
        );
        setBandwidth(data.bandwidth ?? null);
      } catch (error) {
        console.error("Failed to fetch bandwidth:", error);
        setBandwidthError(error instanceof Error ? error.message : "Failed to load bandwidth");
      } finally {
        setBandwidthLoading(false);
      }
    };

    fetchBandwidth();
  }, [service?.id, service?.enhance_subscription_id]);

  const status = service.status || "unknown";

  const statusVariant =
    status === "active"
      ? "default"
      : status === "suspended" || status === "error"
        ? "destructive"
        : status === "provisioning"
          ? "secondary"
          : "outline";

  const fields = [
    { label: "Plan Name", value: service.plan_name || "—" },
    { label: "Service Type", value: service.service_type || "—" },
    { label: "Domain", value: service.domain || "—" },
    {
      label: "Status",
      value: (
        <Badge variant={statusVariant as any}>
          {status}
        </Badge>
      ),
    },
    { label: "Primary IP", value: service.primary_ip || "—" },
    { label: "Next Billing Date", value: formatDate(service.next_billing_at) },
    { label: "Last Billed Date", value: formatDate(service.last_billed_at) },
    {
      label: "Enhance Subscription ID",
      value: service.enhance_subscription_id ? (
        <span className="inline-flex items-center gap-1">
          {truncateId(service.enhance_subscription_id)}
          <CopyButton
            value={service.enhance_subscription_id}
            label="Subscription ID"
          />
        </span>
      ) : (
        "—"
      ),
    },
    {
      label: "Enhance Website ID",
      value: service.enhance_website_id ? (
        <span className="inline-flex items-center gap-1">
          {truncateId(service.enhance_website_id)}
          <CopyButton
            value={service.enhance_website_id}
            label="Website ID"
          />
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Created At", value: formatDate(service.created_at) },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col">
                <dt className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-sm text-foreground mt-0.5">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Bandwidth Card */}
      {service?.enhance_subscription_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Bandwidth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bandwidthLoading && (
              <p className="text-sm text-muted-foreground">Loading bandwidth...</p>
            )}
            {bandwidthError && (
              <p className="text-sm text-destructive">{bandwidthError}</p>
            )}
            {!bandwidthLoading && !bandwidthError && !bandwidth && (
              <p className="text-sm text-muted-foreground">No bandwidth data available</p>
            )}
            {!bandwidthLoading && !bandwidthError && bandwidth && (
              <dl className="space-y-3">
                {bandwidth.used !== undefined && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Used</dt>
                    <dd className="text-sm text-foreground">{formatBytes(bandwidth.used)}</dd>
                  </div>
                )}
                {bandwidth.limit !== undefined && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Limit</dt>
                    <dd className="text-sm text-foreground">{formatBytes(bandwidth.limit)}</dd>
                  </div>
                )}
                {bandwidth.percentage !== undefined && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Usage</dt>
                    <dd className="text-sm text-foreground">{Math.round(bandwidth.percentage)}%</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
