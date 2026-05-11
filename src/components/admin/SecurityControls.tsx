import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  Clock,
  Eye,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminHeroCard } from "@/components/admin/AdminHeroCard";
import { FraudCheckList } from "@/components/admin/FraudCheckList";
import type {
  RateLimitHealthResponse,
  RateLimitMetrics,
  RateLimitOverrideSummary,
} from "@/components/admin/rate-limit-monitoring/types";
import {
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatWindowMinutes,
} from "@/components/admin/rate-limit-monitoring/utils";
import { normalizeHealthResponse, normalizeOverride } from "@/components/admin/rate-limit-monitoring/normalize";

interface RecentIp {
  ip: string;
  lastSeen: string;
  count: number;
  sources: string[];
}

interface AccountSearchResult {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string | null;
  recentIps: RecentIp[];
  activeOverride: RateLimitOverrideSummary | null;
}

interface RateLimitIpRule {
  id: string;
  ipAddress: string;
  ruleType: "trusted" | "blocked";
  maxRequests: number | null;
  windowMs: number | null;
  reason: string | null;
  createdBy: string | null;
  createdByEmail?: string | null;
  createdByName?: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountOverrideForm {
  userId: string;
  email: string;
  maxRequests: number;
  windowMinutes: number;
  reason: string;
  expiresAt: string;
}

interface IpRuleForm {
  ipAddress: string;
  ruleType: "trusted" | "blocked";
  maxRequests: number;
  windowMinutes: number;
  reason: string;
  expiresAt: string;
}

interface IpActivityRow {
  ip: string;
  firstSeen: string | null;
  lastSeen: string | null;
  totalEvents: number;
  activityCount: number;
  loginCount: number;
  failedLoginCount: number;
  fraudCheckCount: number;
  rateLimitCount: number;
  eventTypes: string[];
  lastUserAgent: string | null;
  users: Array<{ id: string; email: string; name: string }>;
  ipRuleStatus: "none" | "blocked" | "trusted";
}

interface IpEventRow {
  id: string;
  eventType: string;
  message: string | null;
  status: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

function toDateTimeLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function emptyAccountForm(defaultLimit: number, defaultWindow: number): AccountOverrideForm {
  return {
    userId: "",
    email: "",
    maxRequests: defaultLimit,
    windowMinutes: defaultWindow,
    reason: "",
    expiresAt: "",
  };
}

function emptyIpRuleForm(defaultLimit: number, defaultWindow: number): IpRuleForm {
  return {
    ipAddress: "",
    ruleType: "blocked",
    maxRequests: defaultLimit,
    windowMinutes: defaultWindow,
    reason: "",
    expiresAt: "",
  };
}

function normalizeAccount(account: AccountSearchResult): AccountSearchResult {
  return {
    ...account,
    activeOverride: account.activeOverride ? normalizeOverride(account.activeOverride) : null,
    recentIps: Array.isArray(account.recentIps) ? account.recentIps : [],
  };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Shield;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-card/70">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div
            className={cn(
              "rounded-xl border p-3",
              tone === "good" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
              tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-500",
              tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-500",
              tone === "default" && "border-primary/25 bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityControls() {
  const [metrics, setMetrics] = useState<RateLimitMetrics | null>(null);
  const [health, setHealth] = useState<RateLimitHealthResponse | null>(null);
  const [overrides, setOverrides] = useState<RateLimitOverrideSummary[]>([]);
  const [ipRules, setIpRules] = useState<RateLimitIpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<AccountSearchResult[]>([]);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountSearchResult | null>(null);
  const [savingAccountOverride, setSavingAccountOverride] = useState(false);
  const [savingIpRule, setSavingIpRule] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);
  const [deletingIpRuleId, setDeletingIpRuleId] = useState<string | null>(null);
  const [ipActivity, setIpActivity] = useState<IpActivityRow[]>([]);
  const [ipActivityLoading, setIpActivityLoading] = useState(false);
  const [ipActivitySearch, setIpActivitySearch] = useState("");
  const [ipActivityHours, setIpActivityHours] = useState(24);
  const [ipActivityPage, setIpActivityPage] = useState(0);
  const [ipActivityTotal, setIpActivityTotal] = useState(0);
  const [selectedIpDetail, setSelectedIpDetail] = useState<string | null>(null);
  const [ipEvents, setIpEvents] = useState<IpEventRow[]>([]);
  const [ipEventsLoading, setIpEventsLoading] = useState(false);
  const [ipEventsTotal, setIpEventsTotal] = useState(0);

  const defaultAccountLimit = health?.configuration.rawLimits.authenticated ?? 5000;
  const defaultAccountWindow = Math.max(1, Math.round((health?.configuration.windows.authenticatedMs ?? 900000) / 60000));

  const [accountForm, setAccountForm] = useState<AccountOverrideForm>(() => emptyAccountForm(5000, 15));
  const [ipRuleForm, setIpRuleForm] = useState<IpRuleForm>(() => emptyIpRuleForm(5000, 15));

  useEffect(() => {
    setAccountForm((previous) => {
      if (previous.userId || previous.email || previous.maxRequests !== 5000 || previous.windowMinutes !== 15) {
        return previous;
      }
      return emptyAccountForm(defaultAccountLimit, defaultAccountWindow);
    });
    setIpRuleForm((previous) => {
      if (previous.ipAddress || previous.maxRequests !== 5000 || previous.windowMinutes !== 15) {
        return previous;
      }
      return emptyIpRuleForm(defaultAccountLimit, defaultAccountWindow);
    });
  }, [defaultAccountLimit, defaultAccountWindow]);

  const loadSecurityData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsResult, healthResult, overrideResult, ipRuleResult] = await Promise.allSettled([
        apiClient.get<{ metrics?: RateLimitMetrics }>("/api/health/metrics?window=15"),
        apiClient.get("/api/health/rate-limiting"),
        apiClient.get<{ overrides?: RateLimitOverrideSummary[] }>("/api/admin/rate-limits/overrides"),
        apiClient.get<{ rules?: RateLimitIpRule[] }>("/api/admin/rate-limits/ip-rules"),
      ]);

      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value.metrics ?? null);
      } else {
        console.error("Failed to load rate-limit metrics:", metricsResult.reason);
      }

      if (healthResult.status === "fulfilled") {
        setHealth(normalizeHealthResponse(healthResult.value));
      } else {
        console.error("Failed to load rate-limit health:", healthResult.reason);
      }

      if (overrideResult.status === "fulfilled") {
        setOverrides(Array.isArray(overrideResult.value.overrides) ? overrideResult.value.overrides.map(normalizeOverride) : []);
      } else {
        console.error("Failed to load account overrides:", overrideResult.reason);
      }

      if (ipRuleResult.status === "fulfilled") {
        setIpRules(Array.isArray(ipRuleResult.value.rules) ? ipRuleResult.value.rules : []);
      } else {
        console.error("Failed to load IP rules:", ipRuleResult.reason);
      }
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error("Failed to load security controls:", error);
      toast.error(error?.message ?? "Failed to load security controls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecurityData();
  }, [loadSecurityData]);

  const searchAccounts = useCallback(async () => {
    const query = accountSearch.trim();
    if (query.length < 2) {
      toast.error("Search by at least 2 characters of name or email");
      return;
    }

    setAccountSearchLoading(true);
    try {
      const data = await apiClient.get<{ accounts?: AccountSearchResult[] }>(
        `/api/admin/rate-limits/accounts/search?q=${encodeURIComponent(query)}`,
      );
      setAccountResults(Array.isArray(data.accounts) ? data.accounts.map(normalizeAccount) : []);
    } catch (error: any) {
      console.error("Failed to search accounts:", error);
      toast.error(error?.message ?? "Failed to search accounts");
    } finally {
      setAccountSearchLoading(false);
    }
  }, [accountSearch]);

  const selectAccount = useCallback((account: AccountSearchResult) => {
    setSelectedAccount(account);
    setAccountForm({
      userId: account.id,
      email: account.email,
      maxRequests: account.activeOverride?.maxRequests ?? defaultAccountLimit,
      windowMinutes: account.activeOverride ? formatWindowMinutes(account.activeOverride.windowMs) : defaultAccountWindow,
      reason: account.activeOverride?.reason ?? "",
      expiresAt: toDateTimeLocalInput(account.activeOverride?.expiresAt ?? null),
    });
  }, [defaultAccountLimit, defaultAccountWindow]);

  const submitAccountOverride = useCallback(async () => {
    if (!accountForm.userId && !accountForm.email.trim()) {
      toast.error("Select or enter an account first");
      return;
    }
    if (accountForm.maxRequests < 1 || accountForm.windowMinutes < 1) {
      toast.error("Max requests and window must be positive values");
      return;
    }

    setSavingAccountOverride(true);
    try {
      const payload: Record<string, unknown> = {
        maxRequests: Number(accountForm.maxRequests),
        windowMinutes: Number(accountForm.windowMinutes),
      };
      if (accountForm.userId) payload.userId = accountForm.userId;
      else payload.email = accountForm.email.trim().toLowerCase();
      if (accountForm.reason.trim()) payload.reason = accountForm.reason.trim();
      if (accountForm.expiresAt) payload.expiresAt = new Date(accountForm.expiresAt).toISOString();

      await apiClient.post("/api/admin/rate-limits/overrides", payload);
      toast.success("Account rate limit override saved");
      const refreshSearch = accountSearch.trim().length >= 2
        ? searchAccounts().catch(() => undefined)
        : Promise.resolve();
      await Promise.all([loadSecurityData(), refreshSearch]);
    } catch (error: any) {
      console.error("Failed to save account override:", error);
      toast.error(error?.message ?? "Failed to save account override");
    } finally {
      setSavingAccountOverride(false);
    }
  }, [accountForm, accountSearch, loadSecurityData, searchAccounts]);

  const deleteAccountOverride = useCallback(async (override: RateLimitOverrideSummary) => {
    setDeletingOverrideId(override.id);
    try {
      await apiClient.delete(`/api/admin/rate-limits/overrides/${override.userId}`);
      toast.success("Account override removed");
      await loadSecurityData();
    } catch (error: any) {
      console.error("Failed to remove account override:", error);
      toast.error(error?.message ?? "Failed to remove override");
    } finally {
      setDeletingOverrideId(null);
    }
  }, [loadSecurityData]);

  const submitIpRule = useCallback(async () => {
    if (!ipRuleForm.ipAddress.trim()) {
      toast.error("IP address is required");
      return;
    }
    if (ipRuleForm.ruleType === "trusted" && (ipRuleForm.maxRequests < 1 || ipRuleForm.windowMinutes < 1)) {
      toast.error("Trusted IP rules need a positive request budget and window");
      return;
    }

    setSavingIpRule(true);
    try {
      const payload: Record<string, unknown> = {
        ipAddress: ipRuleForm.ipAddress.trim(),
        ruleType: ipRuleForm.ruleType,
      };
      if (ipRuleForm.ruleType === "trusted") {
        payload.maxRequests = Number(ipRuleForm.maxRequests);
        payload.windowMinutes = Number(ipRuleForm.windowMinutes);
      }
      if (ipRuleForm.reason.trim()) payload.reason = ipRuleForm.reason.trim();
      if (ipRuleForm.expiresAt) payload.expiresAt = new Date(ipRuleForm.expiresAt).toISOString();

      await apiClient.post("/api/admin/rate-limits/ip-rules", payload);
      toast.success(ipRuleForm.ruleType === "blocked" ? "IP address blocked" : "Trusted IP rule saved");
      setIpRuleForm(emptyIpRuleForm(defaultAccountLimit, defaultAccountWindow));
      await loadSecurityData();
    } catch (error: any) {
      console.error("Failed to save IP rule:", error);
      toast.error(error?.message ?? "Failed to save IP rule");
    } finally {
      setSavingIpRule(false);
    }
  }, [defaultAccountLimit, defaultAccountWindow, ipRuleForm, loadSecurityData]);

  const deleteIpRule = useCallback(async (rule: RateLimitIpRule) => {
    setDeletingIpRuleId(rule.id);
    try {
      await apiClient.delete(`/api/admin/rate-limits/ip-rules/${rule.id}`);
      toast.success("IP rule removed");
      await loadSecurityData();
    } catch (error: any) {
      console.error("Failed to remove IP rule:", error);
      toast.error(error?.message ?? "Failed to remove IP rule");
    } finally {
      setDeletingIpRuleId(null);
    }
  }, [loadSecurityData]);

  const loadIpActivity = useCallback(async () => {
    setIpActivityLoading(true);
    try {
      const params = new URLSearchParams({
        hours: String(ipActivityHours),
        limit: "50",
        offset: String(ipActivityPage * 50),
      });
      if (ipActivitySearch.trim()) params.set("q", ipActivitySearch.trim());
      const data = await apiClient.get<{ success: boolean; ips: IpActivityRow[]; pagination: { total: number } }>(
        `/api/admin/rate-limits/ip-activity?${params}`,
      );
      setIpActivity(data.ips ?? []);
      setIpActivityTotal(data.pagination?.total ?? 0);
    } catch (error: any) {
      console.error("Failed to load IP activity:", error);
      toast.error(error?.message ?? "Failed to load IP activity");
    } finally {
      setIpActivityLoading(false);
    }
  }, [ipActivityHours, ipActivitySearch, ipActivityPage]);

  const loadIpEvents = useCallback(async (ip: string) => {
    setIpEventsLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; events: IpEventRow[]; pagination: { total: number } }>(
        `/api/admin/rate-limits/ip-activity/${encodeURIComponent(ip)}/events?hours=${ipActivityHours}&limit=50`,
      );
      setIpEvents(data.events ?? []);
      setIpEventsTotal(data.pagination?.total ?? 0);
    } catch (error: any) {
      console.error("Failed to load IP events:", error);
      toast.error(error?.message ?? "Failed to load IP events");
    } finally {
      setIpEventsLoading(false);
    }
  }, [ipActivityHours]);

  const inspectIp = useCallback((ip: string) => {
    setSelectedIpDetail(ip);
    void loadIpEvents(ip);
  }, [loadIpEvents]);

  useEffect(() => {
    void loadIpActivity();
  }, [loadIpActivity]);

  const blockedRules = useMemo(() => ipRules.filter((rule) => rule.ruleType === "blocked"), [ipRules]);
  const trustedRules = useMemo(() => ipRules.filter((rule) => rule.ruleType === "trusted"), [ipRules]);
  const hitRate = metrics?.rateLimitHitRate ?? 0;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        badge="sec.controls"
        badgeIcon={Shield}
        title="Rate Limits, Account Trust, and FraudLabsPro"
        description="Manage client lockouts from one place: raise limits by authenticated account, trust or block specific IPs, and review FraudLabsPro decisions before they become support tickets"
        decorativeIcon={Shield}
        actions={
          <Button variant="outline" onClick={() => void loadSecurityData()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="System"
          value={health?.status ?? "loading"}
          detail={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for telemetry"}
          icon={ShieldCheck}
          tone={health?.status === "healthy" ? "good" : health?.status === "error" ? "bad" : "warn"}
        />
        <MetricCard
          label="Rate Hit"
          value={formatPercentage(hitRate)}
          detail={`${formatNumber(metrics?.rateLimitedRequests ?? 0)} blocked of ${formatNumber(metrics?.totalRequests ?? 0)} requests`}
          icon={Activity}
          tone={hitRate > 10 ? "bad" : hitRate > 2 ? "warn" : "default"}
        />
        <MetricCard
          label="Account Overrides"
          value={formatNumber(overrides.length)}
          detail="Authenticated users with custom budgets"
          icon={UserRound}
        />
        <MetricCard
          label="IP Rules"
          value={formatNumber(ipRules.length)}
          detail={`${blockedRules.length} blocked, ${trustedRules.length} trusted`}
          icon={Ban}
          tone={blockedRules.length > 0 ? "warn" : "default"}
        />
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-muted/40 p-1">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="ip-rules">IP Rules</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="ip-activity">IP Activity</TabsTrigger>
          <TabsTrigger value="fraudlabspro">FraudLabsPro</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Find Customer Account</CardTitle>
                <CardDescription>
                  Account overrides follow the authenticated user ID, so customers are not tied to a changing IP address. Recent IPs are auto-detected for context only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchAccounts();
                  }}
                >
                  <Input
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value)}
                    placeholder="Search name or email"
                  />
                  <Button type="submit" disabled={accountSearchLoading}>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </form>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Recent IPs</TableHead>
                        <TableHead>Current Override</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            Search for a customer to inspect recent IPs and grant an account-level override.
                          </TableCell>
                        </TableRow>
                      ) : accountResults.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{account.name || account.email}</div>
                            <div className="text-xs text-muted-foreground">{account.email}</div>
                          </TableCell>
                          <TableCell>
                            {account.recentIps.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No recent IPs</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {account.recentIps.slice(0, 3).map((entry) => (
                                  <Badge key={entry.ip} variant="outline" className="font-mono text-[11px]">
                                    {entry.ip}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.activeOverride ? (
                              <span className="text-sm">
                                {formatNumber(account.activeOverride.maxRequests)} / {formatWindowMinutes(account.activeOverride.windowMs)} min
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Default policy</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => selectAccount(account)}>
                              Use Account
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Account Override</CardTitle>
                <CardDescription>
                  Raise a trusted customer's authenticated request budget without whitelisting their IP.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitAccountOverride();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="security-account-email">Account Email</Label>
                    <Input
                      id="security-account-email"
                      type="email"
                      value={accountForm.email}
                      onChange={(event) => {
                        setSelectedAccount(null);
                        setAccountForm((previous) => ({ ...previous, userId: "", email: event.target.value }));
                      }}
                      placeholder="customer@example.com"
                    />
                  </div>
                  {selectedAccount?.recentIps.length ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Auto-detected recent IPs</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedAccount.recentIps.map((entry) => (
                          <Badge key={entry.ip} variant="secondary" className="font-mono">
                            {entry.ip}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="security-account-max">Max Requests</Label>
                      <Input
                        id="security-account-max"
                        type="number"
                        min={1}
                        value={accountForm.maxRequests}
                        onChange={(event) => setAccountForm((previous) => ({ ...previous, maxRequests: Number(event.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="security-account-window">Window Minutes</Label>
                      <Input
                        id="security-account-window"
                        type="number"
                        min={1}
                        value={accountForm.windowMinutes}
                        onChange={(event) => setAccountForm((previous) => ({ ...previous, windowMinutes: Number(event.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security-account-reason">Reason</Label>
                    <Textarea
                      id="security-account-reason"
                      value={accountForm.reason}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, reason: event.target.value }))}
                      placeholder="Why this account needs a higher budget"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security-account-expiry">Expires At</Label>
                    <Input
                      id="security-account-expiry"
                      type="datetime-local"
                      value={accountForm.expiresAt}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, expiresAt: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={savingAccountOverride} className="w-full">
                    {savingAccountOverride ? "Saving..." : "Save Account Override"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Active Account Overrides</CardTitle>
              <CardDescription>Authenticated users currently using a custom rate limit budget.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No active account overrides.
                        </TableCell>
                      </TableRow>
                    ) : overrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{override.userName || override.userEmail}</div>
                          <div className="text-xs text-muted-foreground">{override.userEmail}</div>
                        </TableCell>
                        <TableCell>{formatNumber(override.maxRequests)} / {formatWindowMinutes(override.windowMs)} min</TableCell>
                        <TableCell className="max-w-sm truncate">{override.reason || <span className="text-muted-foreground">No reason</span>}</TableCell>
                        <TableCell>{formatDateTime(override.expiresAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingOverrideId === override.id}
                            onClick={() => void deleteAccountOverride(override)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip-rules" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>IP Rule</CardTitle>
                <CardDescription>Block abusive IPs or grant a controlled higher budget to trusted infrastructure.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitIpRule();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="security-ip-address">IP Address</Label>
                    <Input
                      id="security-ip-address"
                      value={ipRuleForm.ipAddress}
                      onChange={(event) => setIpRuleForm((previous) => ({ ...previous, ipAddress: event.target.value }))}
                      placeholder="203.0.113.10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rule Type</Label>
                    <Select
                      value={ipRuleForm.ruleType}
                      onValueChange={(value) => setIpRuleForm((previous) => ({ ...previous, ruleType: value as "trusted" | "blocked" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blocked">Blacklist IP</SelectItem>
                        <SelectItem value="trusted">Trusted IP Budget</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ipRuleForm.ruleType === "trusted" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="security-ip-max">Max Requests</Label>
                        <Input
                          id="security-ip-max"
                          type="number"
                          min={1}
                          value={ipRuleForm.maxRequests}
                          onChange={(event) => setIpRuleForm((previous) => ({ ...previous, maxRequests: Number(event.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="security-ip-window">Window Minutes</Label>
                        <Input
                          id="security-ip-window"
                          type="number"
                          min={1}
                          value={ipRuleForm.windowMinutes}
                          onChange={(event) => setIpRuleForm((previous) => ({ ...previous, windowMinutes: Number(event.target.value) }))}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="security-ip-reason">Reason</Label>
                    <Textarea
                      id="security-ip-reason"
                      value={ipRuleForm.reason}
                      onChange={(event) => setIpRuleForm((previous) => ({ ...previous, reason: event.target.value }))}
                      placeholder="Document abuse evidence or trusted use case"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security-ip-expiry">Expires At</Label>
                    <Input
                      id="security-ip-expiry"
                      type="datetime-local"
                      value={ipRuleForm.expiresAt}
                      onChange={(event) => setIpRuleForm((previous) => ({ ...previous, expiresAt: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={savingIpRule} className="w-full">
                    {savingIpRule ? "Saving..." : ipRuleForm.ruleType === "blocked" ? "Block IP" : "Save Trusted IP"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Active IP Rules</CardTitle>
                <CardDescription>Blocked IPs are denied before account overrides. Trusted IPs receive the configured request budget.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipRules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No IP rules configured.
                          </TableCell>
                        </TableRow>
                      ) : ipRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-mono text-sm">{rule.ipAddress}</TableCell>
                          <TableCell>
                            <Badge variant={rule.ruleType === "blocked" ? "destructive" : "secondary"}>
                              {rule.ruleType === "blocked" ? "Blocked" : "Trusted"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {rule.ruleType === "trusted" && rule.maxRequests && rule.windowMs
                              ? `${formatNumber(rule.maxRequests)} / ${formatWindowMinutes(rule.windowMs)} min`
                              : "Denied"}
                          </TableCell>
                          <TableCell className="max-w-sm truncate">{rule.reason || <span className="text-muted-foreground">No reason</span>}</TableCell>
                          <TableCell>{formatDateTime(rule.expiresAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingIpRuleId === rule.id}
                              onClick={() => void deleteIpRule(rule)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Top Violators</CardTitle>
                <CardDescription>Recent sources that exceeded rate limits in the current observation window.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(metrics?.topViolatingIPs ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent rate-limit violations.</p>
                  ) : metrics?.topViolatingIPs.map((entry) => (
                    <div key={`${entry.identifier}-${entry.ip}`} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                      <div>
                        <p className="font-mono text-sm text-foreground">{entry.userEmail ?? entry.ip}</p>
                        <p className="text-xs text-muted-foreground">{entry.userType} · {entry.ip}</p>
                      </div>
                      <Badge variant="outline">{entry.violations} hits</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Endpoint Pressure</CardTitle>
                <CardDescription>Routes generating the most rate-limit violations.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(metrics?.topViolatingEndpoints ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No endpoint pressure detected.</p>
                  ) : metrics?.topViolatingEndpoints.map((entry) => (
                    <div key={entry.endpoint} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                      <span className="font-mono text-sm text-foreground">{entry.endpoint}</span>
                      <Badge variant="outline">{entry.violations} hits</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ip-activity" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                value={ipActivitySearch}
                onChange={(event) => { setIpActivitySearch(event.target.value); setIpActivityPage(0); }}
                placeholder="Filter by IP address..."
                onKeyDown={(event) => { if (event.key === "Enter") void loadIpActivity(); }}
              />
            </div>
            <Select value={String(ipActivityHours)} onValueChange={(value) => { setIpActivityHours(Number(value)); setIpActivityPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="12">Last 12 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="48">Last 48 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void loadIpActivity()} disabled={ipActivityLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", ipActivityLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> All Observed IPs</CardTitle>
              <CardDescription>
                Every IP seen across activity logs, login attempts, fraud checks, and rate-limit events. Showing {ipActivityPage * 50 + 1}–{Math.min((ipActivityPage + 1) * 50, ipActivityTotal)} of {ipActivityTotal} IPs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Logins</TableHead>
                      <TableHead>Rate Limits</TableHead>
                      <TableHead>Fraud</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipActivity.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                          {ipActivityLoading ? "Loading..." : "No IP activity found for the selected period."}
                        </TableCell>
                      </TableRow>
                    ) : ipActivity.map((row) => (
                      <TableRow key={row.ip}>
                        <TableCell className="font-mono text-sm">{row.ip}</TableCell>
                        <TableCell>
                          {row.users.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Anonymous</span>
                          ) : row.users.slice(0, 2).map((user) => (
                            <div key={user.id} className="text-xs">
                              <span className="text-foreground">{user.name || user.email}</span>
                              {user.name && <span className="ml-1 text-muted-foreground">{user.email}</span>}
                            </div>
                          ))}
                          {row.users.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{row.users.length - 2} more</span>
                          )}
                        </TableCell>
                        <TableCell>{formatNumber(row.totalEvents)}</TableCell>
                        <TableCell>
                          {row.loginCount > 0 ? (
                            <span>{row.loginCount}{row.failedLoginCount > 0 ? <span className="text-destructive"> ({row.failedLoginCount} failed)</span> : null}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {row.rateLimitCount > 0 ? (
                            <Badge variant="destructive" className="text-[11px]">{row.rateLimitCount}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {row.fraudCheckCount > 0 ? (
                            <Badge variant="outline" className="text-[11px]">{row.fraudCheckCount}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.lastSeen ? formatDateTime(row.lastSeen) : "—"}</TableCell>
                        <TableCell>
                          {row.ipRuleStatus === "blocked" ? (
                            <Badge variant="destructive">Blocked</Badge>
                          ) : row.ipRuleStatus === "trusted" ? (
                            <Badge variant="secondary">Trusted</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => inspectIp(row.ip)}
                            disabled={selectedIpDetail === row.ip && ipEventsLoading}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {ipActivityTotal > 50 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ipActivityPage === 0}
                    onClick={() => setIpActivityPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {ipActivityPage + 1} of {Math.ceil(ipActivityTotal / 50)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(ipActivityPage + 1) * 50 >= ipActivityTotal}
                    onClick={() => setIpActivityPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedIpDetail && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" /> Activity for {selectedIpDetail}
                    </CardTitle>
                    <CardDescription>
                      {ipEventsTotal} event{ipEventsTotal !== 1 ? "s" : ""} in the last {ipActivityHours} hour{ipActivityHours !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedIpDetail(null); setIpEvents([]); }}>
                    Back to list
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ipEventsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading events...</p>
                ) : ipEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events found for this IP.</p>
                ) : (
                  <div className="space-y-2">
                    {ipEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="mt-0.5">
                          <Badge variant={event.status === "warning" ? "destructive" : event.status === "error" ? "destructive" : "secondary"} className="text-[10px]">
                            {event.eventType}
                          </Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{event.message || event.eventType}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {event.userEmail && <span>{event.userName ? `${event.userName} (${event.userEmail})` : event.userEmail}</span>}
                            {event.createdAt && <span>{formatDateTime(event.createdAt)}</span>}
                          </div>
                          {event.userAgent && (
                            <p className="mt-1 truncate text-[11px] text-muted-foreground/60">{event.userAgent}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fraudlabspro" className="space-y-4">
          <FraudCheckList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
