import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  Pencil,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CronItem {
  cronCmd?: {
    lineNumber: number;
    expr: string;
  };
  variable?: {
    lineNumber: number;
    key: string;
    val: string;
  };
}

interface CronTabProps {
  subscriptionId: string;
}

const PRESETS: { label: string; expr: string }[] = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Every 5 minutes", expr: "*/5 * * * *" },
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every week (Sun midnight)", expr: "0 0 * * 0" },
  { label: "Every month (1st midnight)", expr: "0 0 1 * *" },
];

export default function CronTab({ subscriptionId }: CronTabProps) {
  const [items, setItems] = useState<CronItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLineNumber, setEditLineNumber] = useState<number | null>(null);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ items?: CronItem[] }>(`/hosting/cron/${subscriptionId}/crontab`);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveCrontab = async (updated: CronItem[]) => {
    if (!subscriptionId) return;
    setSaving(true);
    try {
      await apiClient.patch(`/hosting/cron/${subscriptionId}/crontab`, { items: updated });
      toast.success("Crontab updated");
      setItems(updated);
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update crontab");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setEditLineNumber(null);
    setExpr("");
    setDialogOpen(true);
  };

  const handleEdit = (item: CronItem) => {
    if (!item.cronCmd) return;
    setEditLineNumber(item.cronCmd.lineNumber);
    setExpr(item.cronCmd.expr);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!expr.trim()) { toast.error("Expression is required"); return; }
    const updated = [...items];
    if (editLineNumber !== null) {
      const idx = updated.findIndex((i) => i.cronCmd?.lineNumber === editLineNumber);
      if (idx >= 0) {
        updated[idx] = { cronCmd: { lineNumber: editLineNumber, expr: expr.trim() } };
      }
    } else {
      const maxLine = updated.reduce((max, i) => Math.max(max, i.cronCmd?.lineNumber ?? 0, i.variable?.lineNumber ?? 0), 0);
      updated.push({ cronCmd: { lineNumber: maxLine + 1, expr: expr.trim() } });
    }
    await saveCrontab(updated);
  };

  const handleDelete = async (lineNumber: number) => {
    if (!confirm("Delete this cron job?")) return;
    const updated = items.filter((i) => i.cronCmd?.lineNumber !== lineNumber && i.variable?.lineNumber !== lineNumber);
    await saveCrontab(updated);
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL cron jobs?")) return;
    await saveCrontab([]);
  };

  const cronEntries = items.filter((i) => i.cronCmd);

  if (loading) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading cron jobs...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1.5" />Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border bg-card shadow-sm")}>
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              <span>Cron Jobs</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Scheduled tasks for this website.</p>
          </div>
          <div className="flex items-center gap-2">
            {cronEntries.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3 mr-1.5" />Clear All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />Add Job
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {cronEntries.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No cron jobs configured.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expression</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cronEntries.map((item) => (
                <TableRow key={item.cronCmd!.lineNumber}>
                  <TableCell className="font-mono text-xs">{item.cronCmd!.expr}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.cronCmd!.lineNumber)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLineNumber !== null ? "Edit" : "Add"} Cron Job</DialogTitle>
            <DialogDescription>Configure a scheduled task using cron expression format.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quick Preset</Label>
              <Select onValueChange={(value) => { const p = PRESETS[Number(value)]; if (p) setExpr(p.expr); }}>
                <SelectTrigger><SelectValue placeholder="Select a preset..." /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map((preset, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cron Expression</Label>
              <Input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="* * * * * command" />
              <p className="text-xs text-muted-foreground">Format: minute hour day month weekday command</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !expr.trim()}>
              {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
