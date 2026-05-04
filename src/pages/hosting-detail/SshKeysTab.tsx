import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Key,
  Pencil,
  Lock,
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

interface SshKey {
  id: string;
  name?: string;
  fingerprint?: string;
  createdAt?: string;
}

interface SshKeysTabProps {
  subscriptionId: string;
}

export default function SshKeysTab({ subscriptionId }: SshKeysTabProps) {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [editKey, setEditKey] = useState<SshKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editPublicKey, setEditPublicKey] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ keys?: SshKey[] }>(`/hosting/ssh/${subscriptionId}/ssh-keys?sanitize=true`);
      setKeys(data.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SSH keys");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!subscriptionId) return;
    if (!publicKey.trim()) { toast.error("Public key is required"); return; }
    setCreating(true);
    try {
      await apiClient.post(`/hosting/ssh/${subscriptionId}/ssh-keys`, {
        name: keyName.trim() || undefined,
        publicKey: publicKey.trim(),
      });
      toast.success("SSH key added");
      setKeyName("");
      setPublicKey("");
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add SSH key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!subscriptionId) return;
    if (!confirm("Delete this SSH key?")) return;
    setActionLoading(keyId);
    try {
      await apiClient.delete(`/hosting/ssh/${subscriptionId}/ssh-keys/${keyId}`);
      toast.success("SSH key deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete SSH key");
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (key: SshKey) => {
    setEditKey(key);
    setEditName(key.name ?? "");
    setEditPublicKey("");
  };

  const handleUpdate = async () => {
    if (!subscriptionId || !editKey) return;
    setActionLoading(editKey.id);
    try {
      await apiClient.patch(`/hosting/ssh/${subscriptionId}/ssh-keys/${editKey.id}`, {
        name: editName.trim() || undefined,
        value: editPublicKey.trim() || undefined,
      });
      toast.success("SSH key updated");
      setEditKey(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update SSH key");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPassword = async () => {
    if (!subscriptionId || !sshPassword.trim()) return;
    setActionLoading("ssh-password");
    try {
      await apiClient.post(`/hosting/ssh/${subscriptionId}/ssh-password`, { newPassword: sshPassword });
      toast.success("SSH password updated");
      setSshPassword("");
      setPasswordOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set SSH password");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading SSH keys...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
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
    <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Key className="h-5 w-5 text-primary" />
              <span>SSH Keys</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage SSH access keys for this website.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Key
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              <Lock className="h-4 w-4 mr-1" />SSH Password
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {keys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No SSH keys found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Fingerprint</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{key.fingerprint || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(key)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(key.id)}
                        disabled={actionLoading === key.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {actionLoading === key.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add SSH Key Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add SSH Key</DialogTitle>
            <DialogDescription>Paste your public key to grant SSH access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="My Laptop" />
            </div>
            <div className="space-y-2">
              <Label>Public Key</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="ssh-rsa AAAA..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !publicKey.trim()}>
              {creating && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editKey} onOpenChange={(open) => !open && setEditKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit SSH Key</DialogTitle>
            <DialogDescription>Rename this key or replace its public key value.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="My Laptop" />
            </div>
            <div className="space-y-2">
              <Label>New Public Key (optional)</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                value={editPublicKey}
                onChange={(e) => setEditPublicKey(e.target.value)}
                placeholder="Leave blank to keep current key"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditKey(null)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} disabled={actionLoading === editKey?.id}>
              {actionLoading === editKey?.id && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set SSH Password</DialogTitle>
            <DialogDescription>Authorize or replace password access for the website Unix user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New Password</Label>
            <Input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSetPassword} disabled={!sshPassword.trim() || actionLoading === "ssh-password"}>
              {actionLoading === "ssh-password" && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
