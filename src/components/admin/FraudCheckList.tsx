import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import Pagination from "@/components/ui/Pagination";
import {
  Loader2,
  Shield,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Eye,
  Wifi,
  Globe,
  Network,
  X,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────

interface FraudCheck {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  check_type: string;
  ip_address: string;
  email: string;
  amount: string;
  currency: string;
  score: number;
  status: "approve" | "review" | "reject";
  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;
  raw_response: any;
  action_taken: "allowed" | "blocked" | "flagged";
  created_at: string;
  updated_at: string | null;
  user_email: string | null;
  user_name: string | null;
  organization_name: string | null;
}

interface FraudStats {
  total_checks: string;
  blocked: string;
  flagged: string;
  allowed: string;
  rejected: string;
  review: string;
  approved: string;
  today_checks: string;
  today_blocked: string;
  avg_score: string;
}

interface ByType {
  check_type: string;
  count: string;
  blocked: string;
  flagged: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function scoreBg(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (score >= 60) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  if (score >= 30) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
}

function actionBadgeVariant(action: string): "default" | "destructive" | "outline" {
  if (action === "blocked") return "destructive";
  if (action === "flagged") return "outline";
  return "default";
}

function statusBadgeVariant(status: string): "default" | "destructive" | "outline" {
  if (status === "reject") return "destructive";
  if (status === "review") return "outline";
  return "default";
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy HH:mm");
}

// ─── Stats Cards ────────────────────────────────────────────────────

function FraudStatsCards({
  stats,
  byType: _byType,
  isLoading,
}: {
  stats: FraudStats | undefined;
  byType: ByType[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Total Checks",
      value: stats.total_checks,
      icon: BarChart3,
      color: "text-muted-foreground",
    },
    {
      label: "Blocked",
      value: stats.blocked,
      icon: ShieldX,
      color: "text-red-600",
    },
    {
      label: "Flagged",
      value: stats.flagged,
      icon: ShieldAlert,
      color: "text-orange-500",
    },
    {
      label: "Allowed",
      value: stats.allowed,
      icon: ShieldCheck,
      color: "text-green-600",
    },
    {
      label: "Today",
      value: stats.today_checks,
      icon: BarChart3,
      color: "text-blue-600",
    },
    {
      label: "Avg Score",
      value: stats.avg_score,
      icon: Shield,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Detail Dialog ──────────────────────────────────────────────────

function FraudCheckDetailDialog({
  check,
  open,
  onClose,
  onOverride,
}: {
  check: FraudCheck | null;
  open: boolean;
  onClose: () => void;
  onOverride: (check: FraudCheck) => void;
}) {
  if (!check) return null;

  const rawJson = check.raw_response
    ? JSON.stringify(check.raw_response, null, 2)
    : "{}";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Fraud Check Detail
          </DialogTitle>
          <DialogDescription>ID: {check.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Check Type</p>
              <p className="font-medium capitalize">{check.check_type.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <span
                className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${scoreBg(check.score)}`}
              >
                {check.score}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={statusBadgeVariant(check.status)}>{check.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Action Taken</p>
              <Badge variant={actionBadgeVariant(check.action_taken)}>
                {check.action_taken}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{check.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">IP Address</p>
              <p className="font-medium font-mono text-sm">{check.ip_address || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-medium">
                {check.amount ? `${check.currency} ${Number(check.amount).toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">User</p>
              <p className="font-medium">
                {check.user_email || "—"}
                {check.user_name && check.user_name !== check.user_email && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({check.user_name})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="font-medium">{check.organization_name || "—"}</p>
            </div>
          </div>

          {/* Risk flags */}
          <div className="flex gap-3">
            {check.is_vpn && (
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3 w-3" /> VPN
              </Badge>
            )}
            {check.is_proxy && (
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" /> Proxy
              </Badge>
            )}
            {check.is_tor && (
              <Badge variant="outline" className="gap-1">
                <Network className="h-3 w-3" /> TOR
              </Badge>
            )}
            {!check.is_vpn && !check.is_proxy && !check.is_tor && (
              <span className="text-sm text-muted-foreground">No risk flags detected</span>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm">{formatDate(check.created_at)}</p>
            </div>
            {check.updated_at && (
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDate(check.updated_at)}</p>
              </div>
            )}
          </div>

          {/* Admin override info */}
          {check.raw_response?.admin_override && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="py-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  Admin Override Applied
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-500">
                  Reason: {check.raw_response.admin_override.reason}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {formatDate(check.raw_response.admin_override.at)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Raw response */}
          <div>
            <p className="mb-2 text-sm font-medium">Raw API Response</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {rawJson}
            </pre>
          </div>

          {/* Override button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOverride(check)}>
              Override Decision
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Override Dialog ────────────────────────────────────────────────

function FraudOverrideDialog({
  check,
  open,
  onClose,
  onComplete,
}: {
  check: FraudCheck | null;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [action, setAction] = useState<"allowed" | "blocked">("allowed");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!check || !reason.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/fraud-checks/${check.id}/override`, {
        action,
        reason: reason.trim(),
      });
      toast.success(`Fraud check overridden to ${action}`);
      onClose();
      setReason("");
      onComplete();
    } catch (error: any) {
      toast.error(error?.message || "Failed to override");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Fraud Check</DialogTitle>
          <DialogDescription>
            {check
              ? `Override the decision for ${check.email || check.ip_address || check.id}`
              : "Override fraud check decision"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "allowed" | "blocked")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allowed">Allow</SelectItem>
                <SelectItem value="blocked">Block</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea
              placeholder="Explain why you are overriding this fraud check..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={action === "blocked" ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === "blocked" ? "Block" : "Allow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function FraudCheckList() {
  // Filter state
  const [status, setStatus] = useState<string>("");
  const [checkType, setCheckType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Dialog state
  const [selectedCheck, setSelectedCheck] = useState<FraudCheck | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [overrideCheck, setOverrideCheck] = useState<FraudCheck | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const offset = (page - 1) * limit;

  // Build query params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (checkType && checkType !== "all") params.set("check_type", checkType);
    if (search) params.set("search", search);
    if (scoreMin) params.set("score_min", scoreMin);
    if (scoreMax) params.set("score_max", scoreMax);
    if (dateFrom) params.set("date_from", dateFrom.toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.set("date_to", end.toISOString());
    }
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return params.toString();
  }, [status, checkType, search, scoreMin, scoreMax, dateFrom, dateTo, limit, offset]);

  // Fetch checks
  const {
    data: checksData,
    isLoading: checksLoading,
    refetch,
  } = useQuery({
    queryKey: ["fraud-checks", buildParams()],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/fraud-checks?${buildParams()}`);
      return res as { checks: FraudCheck[]; total: number };
    },
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["fraud-checks-stats"],
    queryFn: async () => {
      const res = await apiClient.get("/admin/fraud-checks/stats/summary");
      return res as { stats: FraudStats; by_type: ByType[] };
    },
  });

  const total = checksData?.total ?? 0;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatus("");
    setCheckType("");
    setSearch("");
    setSearchInput("");
    setScoreMin("");
    setScoreMax("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const hasActiveFilters =
    (status && status !== "all") ||
    (checkType && checkType !== "all") ||
    search ||
    scoreMin ||
    scoreMax ||
    dateFrom ||
    dateTo;

  const handleOpenDetail = (check: FraudCheck) => {
    setSelectedCheck(check);
    setDetailOpen(true);
  };

  const handleOpenOverride = (check: FraudCheck) => {
    setDetailOpen(false);
    setOverrideCheck(check);
    setOverrideOpen(true);
  };

  const handleOverrideComplete = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <FraudStatsCards
        stats={statsData?.stats}
        byType={statsData?.by_type}
        isLoading={statsLoading}
      />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-3">
            {/* Row 1: Status, Type, Search */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Check Type</Label>
                <Select value={checkType} onValueChange={(v) => { setCheckType(v); setPage(1); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="wallet_topup">Wallet Top-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label className="text-xs">Search Email or IP</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com or 1.2.3.4"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2: Score range, Date range */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Score Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={scoreMin}
                  onChange={(e) => { setScoreMin(e.target.value); setPage(1); }}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Score Max</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  value={scoreMax}
                  onChange={(e) => { setScoreMax(e.target.value); setPage(1); }}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <DatePicker
                  date={dateFrom}
                  onDateChange={(d) => { setDateFrom(d); setPage(1); }}
                  placeholder="Start date"
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <DatePicker
                  date={dateTo}
                  onDateChange={(d) => { setDateTo(d); setPage(1); }}
                  placeholder="End date"
                  className="w-40"
                />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {checksLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : checksData?.checks && checksData.checks.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checksData.checks.map((check) => (
                    <TableRow
                      key={check.id}
                      className="cursor-pointer"
                      onClick={() => handleOpenDetail(check)}
                    >
                      <TableCell>
                        <span className="capitalize">{check.check_type.replace("_", " ")}</span>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {check.email || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {check.ip_address || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${scoreBg(check.score)}`}
                        >
                          {check.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(check.status)} className="text-xs">
                          {check.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionBadgeVariant(check.action_taken)} className="text-xs">
                          {check.action_taken}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {check.is_vpn && (
                            <Badge variant="outline" className="px-1.5 py-0 text-xs">
                              <Wifi className="h-3 w-3" />
                            </Badge>
                          )}
                          {check.is_proxy && (
                            <Badge variant="outline" className="px-1.5 py-0 text-xs">
                              <Globe className="h-3 w-3" />
                            </Badge>
                          )}
                          {check.is_tor && (
                            <Badge variant="outline" className="px-1.5 py-0 text-xs">
                              <Network className="h-3 w-3" />
                            </Badge>
                          )}
                          {!check.is_vpn && !check.is_proxy && !check.is_tor && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(check.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(check);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={limit}
                onPageChange={setPage}
                onItemsPerPageChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
                showItemsPerPage
                itemsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="mb-3 h-8 w-8" />
              <p>No fraud checks found.</p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={handleClearFilters} className="mt-1">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <FraudCheckDetailDialog
        check={selectedCheck}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onOverride={handleOpenOverride}
      />
      <FraudOverrideDialog
        check={overrideCheck}
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        onComplete={handleOverrideComplete}
      />
    </div>
  );
}
