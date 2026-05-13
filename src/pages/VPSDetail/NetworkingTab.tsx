import { AlertTriangle, Copy, Database, Edit2, Gauge, Globe2, Network, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { IPv4Address, IPv6Range } from "./types";

interface RdnsEditorState {
  value: string;
  editing: boolean;
  saving: boolean;
}

interface IPv4Category {
  label: string;
  accent: string;
  addresses: IPv4Address[];
}

interface NetworkingTabProps {
  transferUsageTitle: string;
  transferUsageDescription: string;
  hasTransferData: boolean;
  transferUsagePercent: number;
  usageLabel: string;
  usageUsedGb: number;
  usageQuotaGb: number;
  accountTransferInfo: { quotaGb: number; usedGb: number; billableGb: number; remainingGb: number } | null;
  transferUsedGb: number;
  transferRemainingGb: number | null;
  usageRemainingGb: number | null;
  effectiveBillableGb: number;
  egressLoading: boolean;
  egressBalance: number | null;
  egressMonthlyUsed: number;
  publicIpv4Count: number;
  privateIpv4Count: number;
  rdnsEditable: boolean;
  hasSlaacIpv6: boolean;
  totalIpv4Count: number;
  ipv4Categories: IPv4Category[];
  rdnsEditor: Record<string, RdnsEditorState>;
  ipv6Info: {
    linkLocal: { address: string | null; prefix: number | null; gateway: string | null } | null;
    slaac: { address: string | null; prefix: number | null; gateway: string | null } | null;
    global: IPv6Range[];
    ranges: IPv6Range[];
    pools: IPv6Range[];
  } | null;
  slaacAddress: string | null;
  slaacCurrentValue: string;
  slaacEditing: boolean;
  slaacSaving: boolean;
  canEditSlaacRdns: boolean;
  onHandleCopy: (value: string, label?: string) => void;
  onUpdateRdnsValue: (address: string, value: string) => void;
  onSaveRdns: (address: string) => void;
  onCancelEditRdns: (address: string) => void;
  onBeginEditRdns: (address: string) => void;
  onOpenIpv6RdnsDialog: (rangeBase: string, prefix: number) => void;
  formatStatusLabel: (value: string | null | undefined) => string;
  shouldDisplayRdns: (rdns: string | null) => boolean;
}

export default function NetworkingTab({
  transferUsageTitle,
  transferUsageDescription,
  hasTransferData,
  transferUsagePercent,
  usageLabel,
  usageUsedGb,
  usageQuotaGb,
  accountTransferInfo,
  transferUsedGb,
  transferRemainingGb,
  usageRemainingGb,
  effectiveBillableGb,
  egressLoading,
  egressBalance,
  egressMonthlyUsed,
  publicIpv4Count,
  privateIpv4Count,
  rdnsEditable,
  hasSlaacIpv6,
  totalIpv4Count,
  ipv4Categories,
  rdnsEditor,
  ipv6Info,
  slaacAddress,
  slaacCurrentValue,
  slaacEditing,
  slaacSaving,
  canEditSlaacRdns,
  onHandleCopy,
  onUpdateRdnsValue,
  onSaveRdns,
  onCancelEditRdns,
  onBeginEditRdns,
  onOpenIpv6RdnsDialog,
  formatStatusLabel,
  shouldDisplayRdns,
}: NetworkingTabProps) {
  return (
    <section className="rounded-2xl border border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4 border">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Globe2 className="h-5 w-5 text-primary" />
          Networking
        </h2>
        <p className="text-sm text-muted-foreground">Current IPv4/IPv6 assignments and routing details.</p>
      </div>
      <div className="px-6 py-5 space-y-8">
        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border bg-background/60">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 dark:border-primary/40 dark:bg-primary/20">
                    <Gauge className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Transfer utilisation</p>
                    <h3 className="mt-1 text-base font-semibold text-foreground truncate">{transferUsageTitle}</h3>
                  </div>
                </div>
                {hasTransferData && (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-primary-foreground" aria-live="polite">
                    {transferUsagePercent.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{transferUsageDescription}</p>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{usageLabel}</span>
                  <span>{hasTransferData ? `${usageUsedGb.toFixed(2)} GB of ${usageQuotaGb.toFixed(0)} GB` : "Unavailable"}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={transferUsagePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Transfer utilisation">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${transferUsagePercent}%` }} />
                </div>
              </div>
              {hasTransferData ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{accountTransferInfo ? "Instance used" : "Used"}</dt>
                      <dd className="mt-1 text-base font-semibold text-foreground">{transferUsedGb.toFixed(2)} GB</dd>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{accountTransferInfo ? "Instance remaining" : "Remaining"}</dt>
                      <dd className="mt-1 text-base font-semibold text-foreground">{transferRemainingGb !== null ? `${transferRemainingGb.toFixed(2)} GB` : "-"}</dd>
                    </div>
                    {!accountTransferInfo && (
                      <>
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Available quota</dt>
                          <dd className="mt-1 text-base font-semibold text-foreground">{usageRemainingGb !== null ? `${usageRemainingGb.toFixed(2)} GB` : "-"}</dd>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Billable</dt>
                          <dd className="mt-1 text-base font-semibold text-foreground">{effectiveBillableGb.toFixed(2)} GB</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  {transferUsagePercent >= 90 && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      Approaching quota
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Usage data unavailable.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border bg-background/60">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pre-paid egress credits</p>
                    <h3 className="mt-1 text-base font-semibold text-foreground truncate">
                      {egressLoading ? "Loading..." : egressBalance !== null ? `${egressBalance.toFixed(2)} GB available` : "No credits"}
                    </h3>
                  </div>
                </div>
                <Link to="/egress-credits" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Purchase Credits
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Credits are deducted hourly when this VPS exceeds its included transfer quota. {egressMonthlyUsed > 0 && <><span>This VPS has used <span className="font-semibold text-foreground">{egressMonthlyUsed.toFixed(2)} GB</span> of credits this month.</span></>}
              </p>
              {egressBalance !== null && egressBalance < 200 && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Low egress credits - VPS may be suspended
                </div>
              )}
              {egressBalance === 0 && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  No egress credits - Add funds to prevent suspension
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border bg-background/60">
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Network className="h-4 w-4 text-primary" />
                  Connectivity overview
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Quick reference for address availability and DNS controls.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm min-h-[120px] flex flex-col justify-center border bg-background/60">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Public IPv4</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{publicIpv4Count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">rDNS {rdnsEditable ? "editable" : "locked"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm min-h-[120px] flex flex-col justify-center border bg-background/60">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Private IPv4</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{privateIpv4Count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Internal networking</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm min-h-[120px] flex flex-col justify-center border bg-background/60">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">IPv6 SLAAC</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{hasSlaacIpv6 ? "Available" : "Not provisioned"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{hasSlaacIpv6 ? "rDNS adjustable in-place" : "Automatic configuration pending"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm border bg-background/60">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">IPv4 assignments</h3>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Public and private allocations</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground bg-card/60 text-muted-foreground">
                {totalIpv4Count} {totalIpv4Count === 1 ? "address" : "addresses"}
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {ipv4Categories.map((category) => (
                <div key={category.label} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{category.label}</p>
                    <span className="text-xs font-semibold text-muted-foreground">{category.addresses.length}</span>
                  </div>
                  {category.addresses.length > 0 ? (
                    <ul className="space-y-3 text-sm text-foreground ">
                      {category.addresses.map((addr) => {
                        const editorState = rdnsEditor[addr.address];
                        const editing = editorState?.editing ?? false;
                        const saving = editorState?.saving ?? false;
                        const currentValue = editorState?.value ?? addr.rdns ?? "";
                        const isPrivate = !addr.public;
                        const showRdnsInfo = !isPrivate;
                        const canEditAddress = showRdnsInfo && rdnsEditable && addr.rdnsEditable;

                        return (
                          <li key={`${category.label}-${addr.address}`} className="rounded-lg bg-card px-3 py-2 shadow-sm bg-background/60">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground truncate" title={addr.address}>{addr.address}</span>
                              {addr.prefix !== null && <span className="text-xs text-muted-foreground">/{addr.prefix}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatStatusLabel(addr.type)} · {addr.public ? "Public" : "Private"}
                              {addr.region ? ` · ${addr.region}` : ""}
                            </p>
                            {addr.gateway && <p className="text-xs text-muted-foreground">Gateway: {addr.gateway}</p>}
                            {showRdnsInfo && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">rDNS: {shouldDisplayRdns(currentValue) ? currentValue : "Setting up..."}</span>
                                {shouldDisplayRdns(currentValue) ? (
                                  <button
                                    type="button"
                                    onClick={() => onHandleCopy(currentValue, `rDNS for ${addr.address}`)}
                                    className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                                    aria-label={`Copy rDNS for ${addr.address}`}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            )}
                            {canEditAddress && (
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                {editing ? (
                                  <>
                                    <input
                                      value={currentValue}
                                      onChange={(event) => onUpdateRdnsValue(addr.address, event.target.value)}
                                      className="w-full rounded-lg border border-input px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary border bg-background  dark:placeholder:text-muted-foreground"
                                      placeholder="reverse.example.com"
                                      disabled={saving}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => onSaveRdns(addr.address)}
                                        disabled={saving}
                                        className={`inline-flex items-center rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary ${saving ? "opacity-75" : ""}`}
                                      >
                                        {saving ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onCancelEditRdns(addr.address)}
                                        disabled={saving}
                                        className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-gray-300 border  dark:hover:bg-gray-800"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onBeginEditRdns(addr.address)}
                                    className="inline-flex w-fit items-center rounded-lg border border-dashed border-input px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                                  >
                                    Edit rDNS
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No addresses assigned.</p>
                  )}
                </div>
              ))}
            </div>

            <div className="my-6 border-t border-border border" />

            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">IPv6 assignments</h3>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Provider supplied ranges</p>
              </div>
              {hasSlaacIpv6 && <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">SLAAC active</span>}
            </div>
            {ipv6Info ? (
              <div className="mt-4 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {ipv6Info.slaac && (
                    <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">SLAAC</p>
                      <p className="mt-1 text-sm font-semibold text-foreground truncate" title={ipv6Info.slaac.address ?? ""}>{ipv6Info.slaac.address}</p>
                      <p className="text-xs text-muted-foreground">Prefix /{ipv6Info.slaac.prefix ?? "-"}</p>
                      {ipv6Info.slaac.gateway && <p className="text-xs text-muted-foreground">Gateway: {ipv6Info.slaac.gateway}</p>}
                      {slaacAddress && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">rDNS: {slaacCurrentValue || "Not set"}</span>
                          {slaacCurrentValue ? (
                            <button
                              type="button"
                              onClick={() => onHandleCopy(slaacCurrentValue, "SLAAC rDNS")}
                              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                              aria-label="Copy SLAAC rDNS"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      )}
                      {canEditSlaacRdns && slaacAddress && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          {slaacEditing ? (
                            <>
                              <input
                                value={slaacCurrentValue}
                                onChange={(event) => onUpdateRdnsValue(slaacAddress, event.target.value)}
                                className="w-full rounded-lg border border-input px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary border bg-background  dark:placeholder:text-muted-foreground"
                                placeholder="reverse.example.com"
                                disabled={slaacSaving}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => onSaveRdns(slaacAddress)}
                                  disabled={slaacSaving}
                                  className={`inline-flex items-center rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 ${slaacSaving ? "opacity-75" : ""}`}
                                  aria-label="Save rDNS"
                                >
                                  {slaacSaving ? "Saving..." : "Save"}
                                </button>
                                <Button type="button" onClick={() => onCancelEditRdns(slaacAddress)} disabled={slaacSaving} variant="outline" size="sm" aria-label="Cancel rDNS edit">
                                  Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBeginEditRdns(slaacAddress)}
                              className="inline-flex w-fit items-center rounded-lg border border-dashed border-input px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                              aria-label="Edit rDNS"
                            >
                              Edit rDNS
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {ipv6Info.linkLocal && (
                    <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Link-local</p>
                      <p className="mt-1 text-sm font-semibold text-foreground truncate" title={ipv6Info.linkLocal.address ?? ""}>{ipv6Info.linkLocal.address}</p>
                      <p className="text-xs text-muted-foreground">Prefix /{ipv6Info.linkLocal.prefix ?? "-"}</p>
                      {ipv6Info.linkLocal.gateway && <p className="text-xs text-muted-foreground">Gateway: {ipv6Info.linkLocal.gateway}</p>}
                    </div>
                  )}
                </div>
                {(ipv6Info.global ?? []).length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 border bg-background/60">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Global prefixes</p>
                    <ul className="mt-2 space-y-2 text-xs text-gray-600 text-muted-foreground">
                      {(ipv6Info.global ?? []).map((range, index) => (
                        <li key={`global-${index}`} className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 bg-background/60">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{range.range ?? "-"}/{range.prefix ?? "-"}</span>
                            {rdnsEditable && range.range && range.prefix != null && (
                              <button
                                type="button"
                                onClick={() => onOpenIpv6RdnsDialog(range.range!, range.prefix!)}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit rDNS
                              </button>
                            )}
                          </div>
                          <span>{range.region ?? "Region unknown"}</span>
                          {range.routeTarget && <span>Route: {range.routeTarget}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(ipv6Info.ranges ?? []).length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 border bg-background/60">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ranged allocations</p>
                    <ul className="mt-2 space-y-2 text-xs text-gray-600 text-muted-foreground">
                      {(ipv6Info.ranges ?? []).map((range, index) => (
                        <li key={`range-${index}`} className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 bg-background/60">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{range.range ?? "-"}/{range.prefix ?? "-"}</span>
                            {rdnsEditable && range.range && range.prefix != null && (
                              <button
                                type="button"
                                onClick={() => onOpenIpv6RdnsDialog(range.range!, range.prefix!)}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit rDNS
                              </button>
                            )}
                          </div>
                          <span>{range.region ?? "Region unknown"}</span>
                          {range.routeTarget && <span>Route: {range.routeTarget}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(ipv6Info.pools ?? []).length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 border bg-background/60">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pool assignments</p>
                    <ul className="mt-2 space-y-2 text-xs text-gray-600 text-muted-foreground">
                      {(ipv6Info.pools ?? []).map((pool, index) => (
                        <li key={`pool-${index}`} className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 bg-background/60">
                          <span className="font-semibold text-foreground ">{pool.range ?? "-"}/{pool.prefix ?? "-"}</span>
                          <span>{pool.region ?? "Region unknown"}</span>
                          {pool.routeTarget && <span>Route: {pool.routeTarget}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No IPv6 assignments reported by the provider.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
