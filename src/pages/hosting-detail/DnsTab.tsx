import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle, RefreshCw, Globe, Eye, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Domain {
  id: string;
  domain: string;
  is_primary: boolean;
}

interface DnsRecord {
  id?: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
}

interface DnsZone {
  domain: string;
  records: DnsRecord[];
}

interface DnsTabProps {
  subscriptionId: string;
}

const DNS_TYPES = ["A", "CNAME", "MX", "TXT", "NS", "AAAA", "SRV"];

export default function DnsTab({ subscriptionId }: DnsTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [zone, setZone] = useState<DnsZone | null>(null);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);

  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<DnsRecord>>({
    type: "A",
    name: "",
    value: "",
    ttl: 3600,
  });
  const [addingRecord, setAddingRecord] = useState(false);

  const loadDomains = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ domains: Domain[] }>(`/hosting/dns/${subscriptionId}/domains`);
      setDomains(data.domains ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load domains";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const handleViewZone = async (domain: Domain) => {
    if (!subscriptionId) return;
    setSelectedDomain(domain);
    setZoneOpen(true);
    setZoneLoading(true);
    try {
      const data = await apiClient.get<DnsZone>(`/hosting/dns/${subscriptionId}/domains/${domain.id}/dns`);
      setZone(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load DNS zone");
      setZone(null);
    } finally {
      setZoneLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!subscriptionId || !selectedDomain) return;
    if (!newRecord.type || !newRecord.name || !newRecord.value) {
      toast.error("Please fill in all required fields");
      return;
    }

    setAddingRecord(true);
    try {
      await apiClient.post(`/hosting/dns/${subscriptionId}/domains/${selectedDomain.id}/dns/records`, {
        type: newRecord.type,
        name: newRecord.name,
        value: newRecord.value,
        ttl: newRecord.ttl ?? 3600,
      });
      toast.success("DNS record added successfully");
      setAddRecordOpen(false);
      setNewRecord({ type: "A", name: "", value: "", ttl: 3600 });
      // Refresh zone
      const data = await apiClient.get<DnsZone>(`/hosting/dns/${subscriptionId}/domains/${selectedDomain.id}/dns`);
      setZone(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add DNS record");
    } finally {
      setAddingRecord(false);
    }
  };

  if (loading && domains.length === 0) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading domains...</span>
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
          <Button variant="outline" size="sm" onClick={loadDomains}>
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
              <Globe className="h-5 w-5 text-primary" />
              <span>Domains &amp; DNS</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage domain mappings and DNS records.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDomains} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {domains.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No domains found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Primary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.domain}</TableCell>
                    <TableCell>
                      {domain.is_primary ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Primary
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewZone(domain)}
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        View DNS
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* DNS Zone Dialog */}
      <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              DNS Zone: {selectedDomain?.domain}
            </DialogTitle>
            <DialogDescription>
              View and manage DNS records for this domain.
            </DialogDescription>
          </DialogHeader>

          {zoneLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading DNS zone...</span>
            </div>
          ) : zone && zone.records.length > 0 ? (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>TTL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zone.records.map((record, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {record.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{record.name}</TableCell>
                      <TableCell className="break-all text-sm">{record.value}</TableCell>
                      <TableCell className="text-sm">{record.ttl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No DNS records found.</p>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <Dialog open={addRecordOpen} onOpenChange={setAddRecordOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!selectedDomain}>
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add DNS Record</DialogTitle>
                  <DialogDescription>
                    Add a new DNS record to {selectedDomain?.domain}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="record-type">Type</Label>
                    <Select
                      value={newRecord.type}
                      onValueChange={(v) => setNewRecord((prev) => ({ ...prev, type: v }))}
                    >
                      <SelectTrigger id="record-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DNS_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="record-name">Name</Label>
                    <Input
                      id="record-name"
                      value={newRecord.name}
                      onChange={(e) => setNewRecord((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="@ or subdomain"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="record-value">Value</Label>
                    <Input
                      id="record-value"
                      value={newRecord.value}
                      onChange={(e) => setNewRecord((prev) => ({ ...prev, value: e.target.value }))}
                      placeholder="IP address or target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="record-ttl">TTL (seconds)</Label>
                    <Input
                      id="record-ttl"
                      type="number"
                      value={newRecord.ttl}
                      onChange={(e) => setNewRecord((prev) => ({ ...prev, ttl: Number(e.target.value) }))}
                      placeholder="3600"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setAddRecordOpen(false)}>
                    <X className="h-3 w-3 mr-1.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddRecord} disabled={addingRecord}>
                    {addingRecord ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1.5" />
                    )}
                    Add Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={() => setZoneOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
