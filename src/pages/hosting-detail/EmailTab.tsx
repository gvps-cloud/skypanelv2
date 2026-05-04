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
  Inbox,
  Forward,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

interface EmailDomain {
  id: string;
  domain: string;
  is_primary?: boolean;
}

interface EmailMailbox {
  address: string;
  mailboxName?: string | null;
  quota?: number | null;
  quotaUsage?: number | null;
  aliases: string[];
  forwarders?: string[];
  status?: string | null;
  hasMailbox: boolean;
  forwardersCount: number;
  autorespondersCount?: number | null;
  isCatchAll?: boolean;
  ssoAvailable?: boolean;
  createdAt?: string | null;
}

interface EmailTabProps {
  subscriptionId: string;
}

type EmailAccountType = "mailbox" | "forwarder";

interface NewEmailState {
  username: string;
  domainId: string;
  accountType: EmailAccountType;
  mailboxName: string;
  password: string;
  quota: number;
  forwarders: string;
  isCatchAll: boolean;
}

interface ClientConfigRow {
  label: string;
  value: string;
}

interface ClientConfigSection {
  title: string;
  rows: ClientConfigRow[];
}

interface EmailDomainsResponse {
  domains: EmailDomain[];
  note?: string;
  excludedCount?: number;
}

const DEFAULT_EMAIL_QUOTA_MB = 1024;

function createDefaultNewEmail(domainId = ""): NewEmailState {
  return {
    username: "",
    domainId,
    accountType: "mailbox",
    mailboxName: "",
    password: "",
    quota: DEFAULT_EMAIL_QUOTA_MB,
    forwarders: "",
    isCatchAll: false,
  };
}

function parseForwarders(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeQuota(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.trunc(numericValue));
}

function formatQuota(email: EmailMailbox): string {
  if (!email.hasMailbox) return "-";
  if (typeof email.quota !== "number") return "-";
  if (typeof email.quotaUsage === "number") return `${email.quotaUsage} / ${email.quota} MB`;
  return `${email.quota} MB`;
}

function getNestedValue(data: Record<string, any>, keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
}

function getFirstStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
}

function formatClientConfigValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}

function formatSecurityValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "boolean") return value ? "Required" : "Not required";
  return String(value);
}

function flattenConfig(data: unknown, prefix = ""): ClientConfigRow[] {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} ${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenConfig(value, label);
    }

    return [
      {
        label: label.replace(/([A-Z])/g, " $1").replace(/[_.-]+/g, " ").trim(),
        value: Array.isArray(value) ? value.join(", ") : formatClientConfigValue(value),
      },
    ];
  });
}

function buildClientConfigSections(config: Record<string, any>, emailAddress: string): ClientConfigSection[] {
  const emailServerDomain = getFirstStringValue(getNestedValue(config, ["emailServerDomains", "serverDomains.emailServerDomains"]));
  const imapServer = getNestedValue(config, ["imap.host", "imap.hostname", "imap.server", "imapServer", "imapHost", "incoming.host", "incoming.server", "incomingServer", "incomingHost"]) ?? emailServerDomain;
  const smtpServer = getNestedValue(config, ["smtp.host", "smtp.hostname", "smtp.server", "smtpServer", "smtpHost", "outgoing.host", "outgoing.server", "outgoingServer", "outgoingHost"]) ?? emailServerDomain;
  const popServer = getNestedValue(config, ["pop3.host", "pop3.hostname", "pop3.server", "pop3Server", "pop3Host", "pop.host", "pop.server", "popServer", "popHost"]) ?? emailServerDomain;

  const imapRows: ClientConfigRow[] = [
    { label: "Server", value: formatClientConfigValue(imapServer) },
    { label: "Port", value: formatClientConfigValue(getNestedValue(config, ["imap.port", "imapPort", "incoming.port", "incomingServerPort", "incomingPort"]) ?? (imapServer ? 993 : undefined)) },
    { label: "SSL/TLS", value: formatSecurityValue(getNestedValue(config, ["imap.ssl", "imap.tls", "imapSsl", "imapSSL", "incoming.ssl", "incoming.tls", "incomingSSL", "incomingSsl"]) ?? (imapServer ? true : undefined)) },
    { label: "Username", value: formatClientConfigValue(getNestedValue(config, ["imap.username", "imap.user", "incoming.username", "incoming.user", "username", "user"]) ?? emailAddress) },
  ];

  const smtpRows: ClientConfigRow[] = [
    { label: "Server", value: formatClientConfigValue(smtpServer) },
    { label: "Port", value: formatClientConfigValue(getNestedValue(config, ["smtp.port", "smtpPort", "outgoing.port", "outgoingServerPort", "outgoingPort"]) ?? (smtpServer ? 465 : undefined)) },
    { label: "SSL/TLS", value: formatSecurityValue(getNestedValue(config, ["smtp.ssl", "smtp.tls", "smtpSsl", "smtpSSL", "outgoing.ssl", "outgoing.tls", "outgoingSSL", "outgoingSsl"]) ?? (smtpServer ? true : undefined)) },
    { label: "Username", value: formatClientConfigValue(getNestedValue(config, ["smtp.username", "smtp.user", "outgoing.username", "outgoing.user", "username", "user"]) ?? emailAddress) },
  ];

  const popRows: ClientConfigRow[] = [
    { label: "Server", value: formatClientConfigValue(popServer) },
    { label: "Port", value: formatClientConfigValue(getNestedValue(config, ["pop3.port", "pop3Port", "pop.port", "popPort"]) ?? (popServer ? 995 : undefined)) },
    { label: "SSL/TLS", value: formatSecurityValue(getNestedValue(config, ["pop3.ssl", "pop3.tls", "pop3Ssl", "pop3SSL", "pop.ssl", "pop.tls", "popSSL", "popSsl"]) ?? (popServer ? true : undefined)) },
    { label: "Username", value: formatClientConfigValue(getNestedValue(config, ["pop3.username", "pop3.user", "pop.username", "pop.user", "username", "user"]) ?? emailAddress) },
  ];

  const sections = [
    { title: "IMAP Incoming", rows: imapRows },
    { title: "SMTP Outgoing", rows: smtpRows },
    { title: "POP3 Incoming", rows: popRows },
  ].filter((section) => section.rows.some((row) => row.label !== "Username" && row.value !== "Unavailable"));

  if (sections.length > 0) return sections;

  const rawRows = flattenConfig(config);
  return rawRows.length > 0 ? [{ title: "Raw Configuration", rows: rawRows }] : [];
}

export default function EmailTab({ subscriptionId }: EmailTabProps) {
  const [emails, setEmails] = useState<EmailMailbox[]>([]);
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [domainNote, setDomainNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState<NewEmailState>(() => createDefaultNewEmail());
  const [creating, setCreating] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editQuota, setEditQuota] = useState<number>(DEFAULT_EMAIL_QUOTA_MB);
  const [saving, setSaving] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [configAddress, setConfigAddress] = useState("");
  const [configData, setConfigData] = useState<Record<string, any> | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const [emailData, domainData] = await Promise.all([
        apiClient.get<{ emails: EmailMailbox[] }>(`/hosting/email/${subscriptionId}/emails`),
        apiClient.get<EmailDomainsResponse>(`/hosting/email/${subscriptionId}/domains`),
      ]);
      const domainList = (domainData.domains ?? []).filter((domain) => domain.id && domain.domain);
      setEmails(emailData.emails ?? []);
      setDomains(domainList);
      setDomainNote(domainData.note ?? "");
      setNewEmail((prev) => {
        if (domainList.length === 0) return { ...prev, domainId: "" };
        if (prev.domainId && domainList.some((domain) => domain.id === prev.domainId)) return prev;
        return { ...prev, domainId: domainList[0].id };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load email accounts";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!subscriptionId) return;
    const username = newEmail.username.trim();
    const selectedDomain = domains.find((domain) => domain.id === newEmail.domainId);

    if (!username || !selectedDomain) {
      toast.error("Email name and domain are required");
      return;
    }

    const payload: Record<string, any> = {
      username,
      domainId: selectedDomain.id,
      isCatchAll: newEmail.isCatchAll,
    };

    if (newEmail.mailboxName.trim()) payload.mailboxName = newEmail.mailboxName.trim();

    if (newEmail.accountType === "mailbox") {
      if (!newEmail.password.trim()) {
        toast.error("Mailbox password is required");
        return;
      }
      payload.mailboxPassword = newEmail.password;
      payload.quota = normalizeQuota(newEmail.quota);
    } else {
      const forwarders = parseForwarders(newEmail.forwarders);
      if (forwarders.length === 0) {
        toast.error("Add at least one forwarding address");
        return;
      }
      payload.forwarders = forwarders;
    }

    const address = `${username}@${selectedDomain.domain}`;
    setCreating(true);
    try {
      await apiClient.post(`/hosting/email/${subscriptionId}/emails`, payload);
      toast.success(`${newEmail.accountType === "mailbox" ? "Mailbox" : "Forwarder"} ${address} created`);
      setCreateOpen(false);
      setNewEmail(createDefaultNewEmail(domains[0]?.id ?? ""));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create email account");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (emailAddress: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete email account "${emailAddress}"?`)) return;
    setDeletingAddress(emailAddress);
    try {
      await apiClient.delete(`/hosting/email/${subscriptionId}/emails/${encodeURIComponent(emailAddress)}`);
      toast.success(`Email account ${emailAddress} deleted`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete email account");
    } finally {
      setDeletingAddress(null);
    }
  };

  const handleEdit = (email: EmailMailbox) => {
    setEditAddress(email.address);
    setEditPassword("");
    setEditQuota(email.quota ?? DEFAULT_EMAIL_QUOTA_MB);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!subscriptionId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { quota: normalizeQuota(editQuota) };
      if (editPassword) payload.mailboxPassword = editPassword;
      await apiClient.patch(`/hosting/email/${subscriptionId}/emails/${encodeURIComponent(editAddress)}`, payload);
      toast.success(`Mailbox ${editAddress} updated`);
      setEditOpen(false);
      await loadData();
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

  const handleWebmail = async (emailAddress: string) => {
    if (!subscriptionId) return;
    try {
      const data = await apiClient.get<{ url: string }>(
        `/hosting/email/${subscriptionId}/emails/${encodeURIComponent(emailAddress)}/sso`,
      );
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open webmail");
    }
  };

  if (loading && emails.length === 0) {
    return (
      <section className="rounded-2xl cyber-card cyber-card--hover">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading email accounts...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl cyber-card cyber-card--hover">
        <div className="px-6 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const clientConfigSections = configData ? buildClientConfigSections(configData, configAddress) : [];
  const hasEligibleDomains = domains.length > 0;

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Mail className="h-5 w-5 text-primary" />
              <span>Email Accounts</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage mailboxes, catch-all addresses, and forwarding for this subscription.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={(open) => hasEligibleDomains && setCreateOpen(open)}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={!hasEligibleDomains}
                  title={hasEligibleDomains ? "Add email account" : "Map a customer-owned domain before creating email accounts"}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Add Email Account</DialogTitle>
                  <DialogDescription>Create a mailbox or forwarder under a mapped hosting domain.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor="email-username">Email address</Label>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                        <Input
                          id="email-username"
                          className="border-0 focus-visible:ring-0"
                          value={newEmail.username}
                          onChange={(e) => setNewEmail((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="example"
                        />
                        <span className="px-3 text-sm text-muted-foreground">@</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Select
                        value={newEmail.domainId}
                        onValueChange={(domainId) => setNewEmail((prev) => ({ ...prev, domainId }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a domain" />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.length === 0 ? (
                            <SelectItem value="none" disabled>No mapped domains</SelectItem>
                          ) : (
                            domains.map((domain) => (
                              <SelectItem key={domain.id} value={domain.id}>{domain.domain}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {domainNote && (
                        <p className="text-xs text-muted-foreground">{domainNote}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="email-catch-all"
                      checked={newEmail.isCatchAll}
                      onCheckedChange={(checked) => setNewEmail((prev) => ({ ...prev, isCatchAll: checked === true }))}
                    />
                    <Label htmlFor="email-catch-all" className="text-sm font-normal">
                      Make this email address a catch-all
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Account type</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                          newEmail.accountType === "mailbox" && "border-primary bg-primary/5",
                        )}
                        onClick={() => setNewEmail((prev) => ({ ...prev, accountType: "mailbox" }))}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <Inbox className="h-4 w-4 text-primary" />
                          Mailbox
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Create an inbox with IMAP, POP3, and SMTP access.</p>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                          newEmail.accountType === "forwarder" && "border-primary bg-primary/5",
                        )}
                        onClick={() => setNewEmail((prev) => ({ ...prev, accountType: "forwarder" }))}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <Forward className="h-4 w-4 text-primary" />
                          Forwarder-only
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">No mailbox storage. Incoming email forwards to other addresses.</p>
                      </button>
                    </div>
                  </div>

                  {newEmail.accountType === "mailbox" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email-quota">Mailbox size (MB)</Label>
                        <Input
                          id="email-quota"
                          type="number"
                          min={0}
                          step={1}
                          value={newEmail.quota}
                          onChange={(e) => setNewEmail((prev) => ({ ...prev, quota: normalizeQuota(e.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-full-name">Full name</Label>
                        <Input
                          id="email-full-name"
                          value={newEmail.mailboxName}
                          onChange={(e) => setNewEmail((prev) => ({ ...prev, mailboxName: e.target.value }))}
                          placeholder="Optional display name"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="email-password">Password</Label>
                        <Input
                          id="email-password"
                          type="password"
                          value={newEmail.password}
                          onChange={(e) => setNewEmail((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Required for mailbox accounts"
                        />
                        <ul className="ml-4 list-disc text-xs text-muted-foreground">
                          <li>Use at least 10 characters.</li>
                          <li>Include uppercase, lowercase, number, and special characters.</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="email-forwarders">Forwarding addresses</Label>
                      <Textarea
                        id="email-forwarders"
                        value={newEmail.forwarders}
                        onChange={(e) => setNewEmail((prev) => ({ ...prev, forwarders: e.target.value }))}
                        placeholder="one@example.com\ntwo@example.com"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple addresses with commas or new lines.</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                    <X className="h-3 w-3 mr-1.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreate} disabled={creating || domains.length === 0}>
                    {creating ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
                    Add Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {domainNote && (
          <div className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            hasEligibleDomains
              ? "border-border bg-muted/30 text-muted-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200",
          )}>
            {domainNote}
            {!hasEligibleDomains && " Map a real customer domain to this website before adding mailboxes or forwarders."}
          </div>
        )}
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
                <TableHead>Type</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Forwarders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.address}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>{email.address}</div>
                      <div className="flex flex-wrap gap-1">
                        {email.isCatchAll && <Badge variant="outline" className="text-[10px]">Catch-all</Badge>}
                        {email.aliases?.map((alias) => (
                          <Badge key={alias} variant="secondary" className="text-[10px]">Alias: {alias}</Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{email.hasMailbox ? "Mailbox" : "Forwarder-only"}</TableCell>
                  <TableCell>{formatQuota(email)}</TableCell>
                  <TableCell>{email.forwarders?.length ?? email.forwardersCount}</TableCell>
                  <TableCell>{email.status ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(email)} disabled={!email.hasMailbox} title="Edit mailbox">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleWebmail(email.address)} disabled={!email.hasMailbox} title="Open webmail">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleClientConfig(email.address)} disabled={!email.hasMailbox} title="Email client setup">
                        <Settings2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(email.address)}
                        disabled={deletingAddress === email.address}
                        className="text-destructive hover:text-destructive"
                        title="Delete email account"
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Mailbox</DialogTitle>
            <DialogDescription>Update password or quota for {editAddress}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-email-password">New Password</Label>
              <Input
                id="edit-email-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email-quota">Quota (MB)</Label>
              <Input
                id="edit-email-quota"
                type="number"
                min={0}
                step={1}
                value={editQuota}
                onChange={(e) => setEditQuota(normalizeQuota(e.target.value))}
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

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Client Setup</DialogTitle>
            <DialogDescription>IMAP, SMTP, and POP3 settings for {configAddress}.</DialogDescription>
          </DialogHeader>
          {configLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : clientConfigSections.length > 0 ? (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              {clientConfigSections.map((section) => (
                <div key={section.title} className="rounded-lg border p-4">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>
                  <div className="space-y-2">
                    {section.rows.map((row) => (
                      <div key={`${section.title}-${row.label}`} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="break-all text-right font-mono">{row.value}</span>
                      </div>
                    ))}
                  </div>
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
