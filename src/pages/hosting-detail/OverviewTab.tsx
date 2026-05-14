import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Check, FileText, HardDrive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useHostingBilling } from "@/hooks/useHosting";

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
  if (bytes === null || typeof bytes === "undefined") return "—";
  const value = Number(bytes);
  if (!Number.isFinite(value)) return "—";
  if (value <= 0) return "0 B";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "—";
}

function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

function formatMoney(value: number | string | null | undefined, currency = "USD"): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

interface OverviewTabProps {
  service: Record<string, any>;
  readOnly?: boolean;
}

export default function OverviewTab({ service, readOnly = false }: OverviewTabProps) {
  const [bandwidth, setBandwidth] = useState<Record<string, any> | null>(null);
  const [bandwidthLoading, setBandwidthLoading] = useState(false);
  const [bandwidthError, setBandwidthError] = useState<string | null>(null);
  const [website, setWebsite] = useState<Record<string, any> | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const { data: billingData, isLoading: billingLoading, refetch: refetchBilling } = useHostingBilling(service?.id || "");

  const loadBandwidth = useCallback(async (refreshCache = false) => {
    if (!service?.id || !service.enhance_subscription_id) {
      setBandwidth(null);
      return;
    }

    setBandwidthLoading(true);
    setBandwidthError(null);
    try {
      const path = `/hosting/services/${service.id}/bandwidth${refreshCache ? "?refreshCache=true" : ""}`;
      const data = await apiClient.get<{ bandwidth: Record<string, any> | null }>(path);
      setBandwidth(data.bandwidth ?? null);
    } catch (error) {
      console.error("Failed to fetch bandwidth:", error);
      setBandwidthError(error instanceof Error ? error.message : "Failed to load bandwidth");
    } finally {
      setBandwidthLoading(false);
    }
  }, [service?.id, service?.enhance_subscription_id]);

  useEffect(() => {
    if (!service?.id) {
      setBandwidth(null);
      setWebsite(null);
      return;
    }

    loadBandwidth();

    if (service.enhance_website_id) {
      apiClient.get<Record<string, any>>(`/hosting/web/${service.id}/website`)
        .then(data => setWebsite(data))
        .catch(console.error);
    }
  }, [loadBandwidth, service?.id, service?.enhance_website_id]);

  const status = service.status || "unknown";
  const billing = billingData?.billing;
  const planResources = service.plan_features?.resources && typeof service.plan_features.resources === "object"
    ? service.plan_features.resources
    : {};

  const statusVariant =
    status === "active"
      ? "default"
      : status === "suspended" || status === "error"
        ? "destructive"
        : status === "provisioning"
          ? "secondary"
          : "outline";

  const primaryIp = website?.serverIps?.find((ip: any) => ip.isPrimary)?.ip
    || website?.serverIps?.[0]?.ip
    || service.primary_ip
    || "—";

  const websiteStatus = website?.isSuspended || website?.suspendedBy
    ? "suspended"
    : website?.status || service.website_status || status;

  const resellerResourceFields = [
    { key: "customers", label: "Customer Accounts" },
    { key: "websites", label: "Websites" },
    { key: "addonDomains", label: "Addon Domains" },
    { key: "subdomains", label: "Subdomains" },
    { key: "domainAliases", label: "Domain Aliases" },
    { key: "mailboxes", label: "Mailboxes" },
    { key: "mysqlDbs", label: "MySQL Databases" },
    { key: "ftpUsers", label: "FTP Users" },
  ]
    .map((resource) => ({
      ...resource,
      value: planResources?.[resource.key],
    }))
    .filter((resource) => resource.value);

  const formatResourceLimit = (resource: any) => {
    const total = resource?.total;
    if (total === null || typeof total === "undefined") return "Unlimited";
    const parsed = Number(total);
    return Number.isFinite(parsed) ? parsed.toLocaleString() : "—";
  };

  const monthlyTransferBytes = bandwidth?.monthlyTransferBytes ?? bandwidth?.used ?? null;
  const transferQuotaBytes = bandwidth?.transferQuotaBytes ?? bandwidth?.limit ?? null;
  const transferUnlimited = bandwidth?.transferUnlimited ?? transferQuotaBytes === null;
  const transferTrackedUsageBytes = bandwidth?.transferTrackedUsageBytes ?? null;
  const bandwidthPercentage = bandwidth?.percentage ?? null;
  const metricsMonthToDate = bandwidth?.metricsMonthToDate ?? null;

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
    {
      label: "Website Status",
      value: (
        <Badge variant={(websiteStatus === "active" ? "default" : websiteStatus === "suspended" || websiteStatus === "disabled" ? "destructive" : "outline") as any}>
          {websiteStatus}
        </Badge>
      ),
    },
    { label: "Primary IP", value: primaryIp },
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

  const billingStatusVariant =
    billing?.paymentStatus === "past_due"
      ? "destructive"
      : billing?.paymentStatus === "due"
        ? "secondary"
        : "default";

  const handleGenerateHostingInvoice = async () => {
    if (!service?.id) return;
    setInvoiceLoading(true);
    try {
      const response = await apiClient.post<{ invoiceId: string }>(
        "/invoices/from-hosting-cycles",
        { subscriptionId: service.id }
      );
      await refetchBilling();
      toast.success("Hosting invoice generated");
      if (response.invoiceId) {
        window.location.href = `/billing/invoice/${response.invoiceId}`;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/25">
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

      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Hosting Billing
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Renewals are charged from the dedicated hosting wallet.
              </p>
            </div>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateHostingInvoice}
                disabled={invoiceLoading || billingLoading || !billing?.cycles?.length}
              >
                <FileText className="mr-1.5 h-3 w-3" />
                {invoiceLoading ? "Generating..." : "Generate Invoice"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {billingLoading ? (
            <div className="text-sm text-muted-foreground">Loading hosting billing...</div>
          ) : billing ? (
            <>
              {billing.paymentStatus === "past_due" && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Billing is past due{billing.latestFailureReason ? `: ${billing.latestFailureReason}` : "."}
                  </span>
                </div>
              )}
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Payment Status</dt>
                  <dd className="mt-1">
                    <Badge variant={billingStatusVariant as any}>
                      {billing.paymentStatus.replace("_", " ")}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Renewal Amount</dt>
                  <dd className="mt-1 text-sm">{formatMoney(billing.renewalAmount, billing.currency)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Hosting Wallet</dt>
                  <dd className="mt-1 text-sm">{formatMoney(billing.hostingWalletBalance, billing.currency)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Next Renewal</dt>
                  <dd className="mt-1 text-sm">{formatDate(billing.nextBillingAt)}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Recent Billing Events</h3>
                {billing.cycles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hosting billing cycles recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {billing.cycles.slice(0, 5).map((cycle) => (
                      <div
                        key={cycle.id}
                        className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-medium">
                            {cycle.cycle_type} cycle · {formatMoney(cycle.amount, cycle.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(cycle.period_start)} to {formatDate(cycle.period_end)}
                            {cycle.failure_reason ? ` · ${cycle.failure_reason}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cycle.status === "failed" ? "destructive" : "secondary"}>
                            {cycle.status}
                          </Badge>
                          {cycle.invoice_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { window.location.href = `/billing/invoice/${cycle.invoice_id}`; }}
                            >
                              Invoice
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {billing.refunds.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Refund Credits</h3>
                  <div className="space-y-2">
                    {billing.refunds.slice(0, 3).map((refund) => (
                      <div key={refund.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <div className="font-medium">{formatMoney(refund.amount, refund.currency)}</div>
                          <div className="text-xs text-muted-foreground">{refund.reason}</div>
                        </div>
                        <Badge variant="secondary">{refund.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Hosting billing details are unavailable.</p>
          )}
        </CardContent>
      </Card>

      {readOnly && resellerResourceFields.length > 0 && (
        <Card className="border-primary/25">
          <CardHeader>
            <CardTitle>Package Resource Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {resellerResourceFields.map((resource) => (
                <div key={resource.key} className="rounded-md border p-3">
                  <dt className="text-sm font-medium text-muted-foreground">{resource.label}</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatResourceLimit(resource.value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Bandwidth Card */}
      {service?.enhance_subscription_id && (
        <Card className="border-primary/25">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Bandwidth
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current-month subscription bandwidth from Enhance, plus month-to-date website metrics when available.
                </p>
              </div>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadBandwidth(true)}
                  disabled={bandwidthLoading}
                >
                  <RefreshCw className={`mr-1.5 h-3 w-3 ${bandwidthLoading ? "animate-spin" : ""}`} />
                  Refresh Usage
                </Button>
              )}
            </div>
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
              <div className="space-y-4">
                {/* Progress bar */}
                {transferQuotaBytes != null && transferQuotaBytes > 0 && monthlyTransferBytes != null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatBytes(monthlyTransferBytes)} of {formatBytes(transferQuotaBytes)}
                      </span>
                      <span className="font-medium">
                        {formatPercent(bandwidthPercentage)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          bandwidthPercentage != null && bandwidthPercentage >= 90
                            ? "bg-destructive"
                            : bandwidthPercentage != null && bandwidthPercentage >= 75
                              ? "bg-yellow-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(bandwidthPercentage ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Detail rows */}
                <dl className="space-y-3">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Monthly transfer used</dt>
                    <dd className="text-sm text-foreground">{formatBytes(monthlyTransferBytes)}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Plan transfer limit</dt>
                    <dd className="text-sm text-foreground">{transferUnlimited ? "Unlimited" : formatBytes(transferQuotaBytes)}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm font-medium text-muted-foreground">Quota usage</dt>
                    <dd className="text-sm text-foreground">{formatPercent(bandwidthPercentage)}</dd>
                  </div>
                  {transferTrackedUsageBytes != null && (
                    <div className="flex justify-between items-center">
                      <dt className="text-sm font-medium text-muted-foreground">Tracked transfer usage</dt>
                      <dd className="text-sm text-foreground">{formatBytes(transferTrackedUsageBytes)}</dd>
                    </div>
                  )}
                </dl>

                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p>{bandwidth.billingPeriod?.label ?? "Current calendar month"} · {bandwidth.cacheNote}</p>
                  <p className="mt-1">{bandwidth.resellerNote}</p>
                  {bandwidth.refreshRequested && <p className="mt-1 text-foreground">A fresh Enhance cache refresh was requested.</p>}
                </div>

                {metricsMonthToDate && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Website traffic month-to-date</h4>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(metricsMonthToDate.start)} to {formatDate(metricsMonthToDate.end)} · {metricsMonthToDate.granularity}
                      </p>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Received</dt>
                        <dd className="text-sm text-foreground">{formatBytes(metricsMonthToDate.bytesReceived)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Sent</dt>
                        <dd className="text-sm text-foreground">{formatBytes(metricsMonthToDate.bytesSent)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Combined traffic</dt>
                        <dd className="text-sm text-foreground">{formatBytes(metricsMonthToDate.totalBytes)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Total hits</dt>
                        <dd className="text-sm text-foreground">{formatCount(metricsMonthToDate.totalHits)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Unique hits</dt>
                        <dd className="text-sm text-foreground">{formatCount(metricsMonthToDate.uniqueHits)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-sm text-muted-foreground">Bot hits</dt>
                        <dd className="text-sm text-foreground">{formatCount(metricsMonthToDate.botHits)}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      Enhance notes that the latest metrics bucket may still be incomplete.
                    </p>
                  </div>
                )}

                {bandwidth.metricsError && (
                  <p className="text-xs text-muted-foreground">Website traffic metrics unavailable: {bandwidth.metricsError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
