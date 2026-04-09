import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getIPv6RangeRdnsRecords,
  updateIPv6RangeRdns,
  type IPv6RangeRdnsVpsRow,
} from "@/services/ipamService";
import { ChevronLeft, ChevronRight, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface IPv6PrefixOption {
  range: string;
  prefixLength: number;
  region?: string;
  routeTarget?: string | null;
}

interface IPv6RangeRdnsEditorProps {
  prefixes: IPv6PrefixOption[];
  className?: string;
  title?: string;
  description?: string;
  onSaved?: () => void;
}

const RECORDS_PAGE_SIZE = 5;

function getPrefixKey(prefix: IPv6PrefixOption): string {
  return `${prefix.range}/${prefix.prefixLength}`;
}

function getDefaultAddress(range: string): string {
  return range.endsWith("::") ? `${range}1` : `${range}::1`;
}

export function IPv6RangeRdnsEditor({
  prefixes,
  className,
  title = "IPv6 range reverse DNS",
  description,
  onSaved,
}: IPv6RangeRdnsEditorProps) {
  const [selectedPrefixKey, setSelectedPrefixKey] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [existingRecords, setExistingRecords] = useState<Array<{ address: string; rdns: string }>>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsFilter, setRecordsFilter] = useState("");
  const [recordsPage, setRecordsPage] = useState(0);
  const [vpsInstances, setVpsInstances] = useState<IPv6RangeRdnsVpsRow[]>([]);

  useEffect(() => {
    if (prefixes.length === 0) {
      setSelectedPrefixKey("");
      return;
    }
    const selectedExists = prefixes.some((prefix) => getPrefixKey(prefix) === selectedPrefixKey);
    if (!selectedExists) {
      setSelectedPrefixKey(getPrefixKey(prefixes[0]));
    }
  }, [prefixes, selectedPrefixKey]);

  const selectedPrefix = useMemo(
    () => prefixes.find((prefix) => getPrefixKey(prefix) === selectedPrefixKey) ?? null,
    [prefixes, selectedPrefixKey],
  );
  const selectedRange = selectedPrefix?.range ?? null;
  const selectedPrefixLength = selectedPrefix?.prefixLength ?? null;

  const filteredRecords = useMemo(() => {
    const term = recordsFilter.trim().toLowerCase();
    if (!term) return existingRecords;
    return existingRecords.filter(
      (record) =>
        record.address.toLowerCase().includes(term) ||
        record.rdns.toLowerCase().includes(term),
    );
  }, [existingRecords, recordsFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PAGE_SIZE));
  const currentPage = Math.min(recordsPage, totalPages - 1);
  const pageRecords = filteredRecords.slice(
    currentPage * RECORDS_PAGE_SIZE,
    currentPage * RECORDS_PAGE_SIZE + RECORDS_PAGE_SIZE,
  );

  useEffect(() => {
    const prefixLength = selectedPrefixLength;
    if (!selectedRange || prefixLength === null) {
      setExistingRecords([]);
      setVpsInstances([]);
      setLoadingRecords(false);
      setIpAddress("");
      setDomain("");
      setRecordsFilter("");
      setRecordsPage(0);
      return;
    }

    setIpAddress(getDefaultAddress(selectedRange));
    setDomain("");
    setSaving(false);
    setDeletingAddress(null);
    setExistingRecords([]);
    setRecordsFilter("");
    setRecordsPage(0);
    setVpsInstances([]);
    setLoadingRecords(true);

    let active = true;
    (async () => {
      const result = await getIPv6RangeRdnsRecords(selectedRange, prefixLength);
      if (!active) return;
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to load IPv6 rDNS records");
        setLoadingRecords(false);
        return;
      }
      setExistingRecords(result.data.records);
      setVpsInstances(result.data.vpsInstances);
      setLoadingRecords(false);
    })();

    return () => {
      active = false;
    };
  }, [selectedRange, selectedPrefixLength]);

  const saveRangeRdns = async () => {
    if (!selectedPrefix) return;
    if (!ipAddress.trim()) {
      toast.error("An IPv6 address is required");
      return;
    }

    setSaving(true);
    const trimmedAddress = ipAddress.trim();
    const trimmedDomain = domain.trim();
    const result = await updateIPv6RangeRdns(
      selectedPrefix.range,
      selectedPrefix.prefixLength,
      trimmedAddress,
      trimmedDomain.length > 0 ? trimmedDomain : null,
    );
    setSaving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to update reverse DNS");
      return;
    }

    setDomain("");
    setExistingRecords((prev) =>
      trimmedDomain
        ? [...prev.filter((record) => record.address !== trimmedAddress), { address: trimmedAddress, rdns: trimmedDomain }]
        : prev.filter((record) => record.address !== trimmedAddress),
    );
    setRecordsPage(0);
    toast.success(trimmedDomain ? "Reverse DNS updated" : "Reverse DNS cleared");
    onSaved?.();
  };

  const clearRangeRdnsRecord = async (address: string) => {
    if (!selectedPrefix) return;
    setDeletingAddress(address);
    const result = await updateIPv6RangeRdns(
      selectedPrefix.range,
      selectedPrefix.prefixLength,
      address,
      null,
    );
    setDeletingAddress(null);

    if (!result.success) {
      toast.error(result.error || "Failed to clear reverse DNS");
      return;
    }

    setExistingRecords((prev) => prev.filter((record) => record.address !== address));
    setRecordsPage(0);
    toast.success("Reverse DNS cleared");
    onSaved?.();
  };

  if (!selectedPrefix) {
    return (
      <div className={cn("rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground", className)}>
        No IPv6 prefix context is available for this address.
      </div>
    );
  }

  const locked = saving || vpsInstances.length === 0;
  const defaultDescription = `Set custom reverse DNS records for addresses within ${selectedPrefix.range}/${selectedPrefix.prefixLength}.`;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description ?? defaultDescription}</p>
      </div>

      {prefixes.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="ipv6-prefix-select">IPv6 prefix</Label>
          <Select value={selectedPrefixKey} onValueChange={setSelectedPrefixKey}>
            <SelectTrigger id="ipv6-prefix-select">
              <SelectValue placeholder="Select prefix" />
            </SelectTrigger>
            <SelectContent>
              {prefixes.map((prefix) => (
                <SelectItem key={getPrefixKey(prefix)} value={getPrefixKey(prefix)}>
                  {prefix.range}/{prefix.prefixLength}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          {selectedPrefix.range}/{selectedPrefix.prefixLength}
        </Badge>
        {selectedPrefix.region ? <Badge variant="outline">{selectedPrefix.region}</Badge> : null}
        {selectedPrefix.routeTarget ? (
          <Badge variant="outline" className="font-mono">
            Route {selectedPrefix.routeTarget}
          </Badge>
        ) : null}
      </div>

      {vpsInstances.length === 0 && !loadingRecords ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No panel VPS is linked to this range. Sub-address rDNS updates are unavailable until a VPS is attached.
        </p>
      ) : null}

      {vpsInstances.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Linked VPS: {vpsInstances.map((item) => `${item.label} (${item.provider_instance_id})`).join(", ")}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="ipv6-rdns-address">IPv6 address</Label>
        <Input
          id="ipv6-rdns-address"
          value={ipAddress}
          onChange={(event) => setIpAddress(event.target.value)}
          placeholder={getDefaultAddress(selectedPrefix.range)}
          className="font-mono text-sm"
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ipv6-rdns-domain">Domain name</Label>
        <Input
          id="ipv6-rdns-domain"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="mail.example.com"
          disabled={locked}
        />
        <p className="text-xs text-muted-foreground">Leave blank to clear rDNS for the selected address.</p>
      </div>

      {(loadingRecords || existingRecords.length > 0) ? (
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Existing records{" "}
              {!loadingRecords ? (
                <span className="text-xs font-normal text-muted-foreground">
                  ({filteredRecords.length}
                  {recordsFilter ? " filtered" : ""})
                </span>
              ) : null}
            </p>
          </div>

          {loadingRecords ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading records...
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recordsFilter}
                  onChange={(event) => {
                    setRecordsFilter(event.target.value);
                    setRecordsPage(0);
                  }}
                  placeholder="Filter by address or domain..."
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {pageRecords.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">No records match your filter.</p>
              ) : (
                <ul className="max-h-[220px] space-y-1.5 overflow-y-auto">
                  {pageRecords.map((record) => {
                    const isDeleting = deletingAddress === record.address;
                    return (
                      <li
                        key={record.address}
                        className="group flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                          onClick={() => {
                            setIpAddress(record.address);
                            setDomain(record.rdns);
                          }}
                          title="Use this address"
                        >
                          <span className="block truncate font-mono font-semibold text-foreground">
                            {record.address}
                          </span>
                          <span className="block truncate text-muted-foreground">{record.rdns}</span>
                        </button>
                        <button
                          type="button"
                          title="Clear rDNS"
                          onClick={() => clearRangeRdnsRecord(record.address)}
                          disabled={isDeleting || saving || deletingAddress !== null}
                          className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground opacity-0 transition-opacity hover:border-destructive hover:text-destructive focus:opacity-100 focus:outline-none group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-40"
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {totalPages > 1 ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 0}
                      onClick={() => setRecordsPage((prev) => prev - 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setRecordsPage((prev) => prev + 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={saveRangeRdns} disabled={locked || !ipAddress.trim()}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
