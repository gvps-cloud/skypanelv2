import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Plus,
  Trash2,
  X,
  Pencil,
  Settings2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EmailMailbox {
  address: string;
  quota?: number | null;
  quotaUsage?: number | null;
  aliases: string[];
  status?: string | null;
  hasMailbox: boolean;
  forwardersCount: number;
  createdAt?: string | null;
}

interface EmailTabProps {
  subscriptionId: string;
}

export default function EmailTab({ subscriptionId }: EmailTabProps) {
  const [emails, setEmails] = useState<EmailMailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState({ address: "", password: "", quota: 1024 });
  const [creating, setCreating] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editQuota, setEditQuota] = useState<number>(1024);
  const [saving, setSaving] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [configAddress, setConfigAddress] = useState("");
  const [configData, setConfigData] = useState<Record<string, any> | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  const loadEmails = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ emails: EmailMailbox[] }>(`/hosting/email/${subscriptionId}/emails`);
      setEmails(data.emails ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load email accounts";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const handleCreate = async () => {
    if (!subscriptionId) return;
    if (!newEmail.address || !newEmail.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreating(true);
    try {
      await apiClient.post(`/hosting/email/${subscriptionId}/emails`, {
        address: newEmail.address,
        password: newEmail.password,
        quota: newEmail.quota,
      });
      toast.success(`Mailbox ${newEmail.address} created`);
      setCreateOpen(false);
      setNewEmail({ address: "", password: "", quota: 1024 });
      await loadEmails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create mailbox");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (emailAddress: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete mailbox "${emailAddress}"?`)) return;
    setDeletingAddress(emailAddress);
    try {
      await apiClient.delete(`/hosting/email/${subscriptionId}/emails/${encodeURIComponent(emailAddress)}`);
      toast.success(`Mailbox ${emailAddress} deleted`);
      await loadEmails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete mailbox");
    } finally {
      setDeletingAddress(null);
    }
  };

  const handleEdit = (email: EmailMailbox) => {
    setEditAddress(email.address);
    setEditPassword("");
    setEditQuota(email.quota ?? 1024);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!subscriptionId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (editPassword) payload.password = editPassword;
      if (editQuota) payload.quota = editQuota;
      await apiClient.patch(`/hosting/email/${subscriptionId}/emails/${encodeURIComponent(editAddress)}`, payload);
      toast.success(`Mailbox ${editAddress} updated`);
      setEditOpen(false);
      await loadEmails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update mailbox");
    } finally {
      setSaving(false);
    }
  };

  const handleClientConfig = async (emailAddress: string) => {
    if (!subscriptionId) return;
    setConfigAddress(emailAddress);
    setConfigOpen(true);
    setConfigLoading(true);
    setConfigData(null);
    try {
      const data = await apiClient.get<Record<string, any>>(
        `/hosting/email/${subscriptionId}/emails/${encodeURIComponent(emailAddress)}/client-conf`,
      );
      setConfigData(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load client config");
    } finally {
      setConfigLoading(false);
    }
  };

  if (loading && emails.length === 0) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading email accounts...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="px-6 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadEmails}>
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Mail className="h-5 w-5 text-primary" />
              <span>Email Accounts</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage mailboxes and forwarding for this subscription.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadEmails} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-3 w-3 mr-1.5" />
                  New Mailbox
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Mailbox</DialogTitle>
                  <DialogDescription>Add a new email mailbox.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="email-address">Email Address</Label>
                    <Input
                      id="email-address"
                      type="email"
                      value={newEmail.address}
                      onChange={(e) => setNewEmail((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-password">Password</Label>
                    <Input
                      id="email-password"
                      type="password"
                      value={newEmail.password}
                      onChange={(e) => setNewEmail((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-quota">Quota (MB)</Label>
                    <Input
                      id="email-quota"
                      type="number"
                      value={newEmail.quota}
                      onChange={(e) => setNewEmail((prev) => ({ ...prev, quota: Number(e.target.value) }))}
                      placeholder="1024"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                    <X className="h-3 w-3 mr-1.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
                    Create Mailbox
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {emails.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No email accounts found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Forwarders</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.address}>
                  <TableCell className="font-medium">{email.address}</TableCell>
                  <TableCell>{email.status ?? (email.hasMailbox ? "mailbox" : "forwarder")}</TableCell>
                  <TableCell>{email.quota ? `${email.quota} MB` : "—"}</TableCell>
                  <TableCell>{email.forwardersCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(email)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleClientConfig(email.address)}>
                        <Settings2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(email.address)}
                        disabled={deletingAddress === email.address}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingAddress === email.address ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Mailbox Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Mailbox</DialogTitle>
            <DialogDescription>Update password or quota for {editAddress}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label>Quota (MB)</Label>
              <Input
                type="number"
                value={editQuota}
                onChange={(e) => setEditQuota(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Client Setup</DialogTitle>
            <DialogDescription>IMAP/SMTP/POP3 settings for {configAddress}.</DialogDescription>
          </DialogHeader>
          {configLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : configData ? (
            <div className="space-y-3 py-2">
              {Object.entries(configData).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No client config available.</p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
