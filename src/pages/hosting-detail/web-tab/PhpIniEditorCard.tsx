import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plus, Trash2, FileCode } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface IniSetting {
  key: string;
  value: string;
  section?: string;
}

interface Props {
  subscriptionId: string;
}

export default function PhpIniEditorCard({ subscriptionId }: Props) {
  const [settings, setSettings] = useState<IniSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ items: IniSetting[] }>(`/hosting/web/${subscriptionId}/php/ini`);
      setSettings(data?.items ?? []);
    } catch {
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const handleSet = async (key: string, value: string) => {
    if (!key) return;
    setSaving(key);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/php/ini/${encodeURIComponent(key)}`, { value });
      toast.success(`Set ${key}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set directive");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Remove ${key}?`)) return;
    setSaving(key);
    try {
      await apiClient.delete(`/hosting/web/${subscriptionId}/php/ini/${encodeURIComponent(key)}`);
      toast.success(`Removed ${key}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove directive");
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    handleSet(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <FileCode className="h-5 w-5 text-primary" />
              <span>PHP.ini Editor</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Custom PHP.ini directives for this website.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Directive</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map((s) => (
                  <IniRow
                    key={s.key}
                    setting={s}
                    saving={saving === s.key}
                    onSave={(v) => handleSet(s.key, v)}
                    onDelete={() => handleDelete(s.key)}
                  />
                ))}
                {settings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
                      No custom PHP.ini directives set.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-end gap-3 pt-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-key">Directive</Label>
                <Input id="new-key" placeholder="memory_limit" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-val">Value</Label>
                <Input id="new-val" placeholder="256M" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
                <Plus className="h-3 w-3 mr-1.5" />Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function IniRow({ setting, saving, onSave, onDelete }: {
  setting: IniSetting;
  saving: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(setting.value);

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{setting.key}</TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onSave(val); setEditing(false); }
              if (e.key === "Escape") { setVal(setting.value); setEditing(false); }
            }}
            className="h-8 text-sm"
            autoFocus
          />
        ) : (
          <span
            className="font-mono text-sm cursor-pointer hover:underline"
            onClick={() => { setVal(setting.value); setEditing(true); }}
          >
            {setting.value}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDelete}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
