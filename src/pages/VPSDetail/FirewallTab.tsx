import { AlertTriangle } from "lucide-react";
import type { FirewallActionType, FirewallOption, FirewallRule, FirewallSummary } from "./types";

interface FirewallTabProps {
  firewallSummaries: FirewallSummary[];
  availableFirewallOptions: FirewallOption[];
  selectedFirewallId: number | "";
  firewallAction: FirewallActionType;
  onSelectedFirewallIdChange: (value: number | "") => void;
  onAttachFirewall: () => void;
  onDetachFirewall: (firewallId: number, deviceId: number | null) => void;
  summarizeFirewallRule: (rule: FirewallRule) => string;
  formatDateTime: (value: string | null) => string;
  formatRelativeTime: (value: string | null) => string;
  formatStatusLabel: (value: string | null | undefined) => string;
  statusBadgeClasses: (status: string | null | undefined) => string;
}

export default function FirewallTab({
  firewallSummaries,
  availableFirewallOptions,
  selectedFirewallId,
  firewallAction,
  onSelectedFirewallIdChange,
  onAttachFirewall,
  onDetachFirewall,
  summarizeFirewallRule,
  formatDateTime,
  formatRelativeTime,
  formatStatusLabel,
  statusBadgeClasses,
}: FirewallTabProps) {
  return (
    <section className="rounded-2xl border border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4 border">
        <h2 className="text-lg font-semibold text-foreground">Firewall Management</h2>
        <p className="text-sm text-muted-foreground">Firewalls attached to this instance and their rule summaries.</p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm border bg-background/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Attach existing firewall</h3>
              <p className="text-xs text-muted-foreground">Assign a firewall from your catalogue to this server.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <select
                className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary border bg-background "
                value={selectedFirewallId === "" ? "" : String(selectedFirewallId)}
                onChange={(event) => {
                  const value = event.target.value;
                  onSelectedFirewallIdChange(value === "" ? "" : Number(value));
                }}
                disabled={firewallAction === "attach" || availableFirewallOptions.length === 0}
              >
                <option value="">- Select firewall -</option>
                {availableFirewallOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label || `Firewall ${option.id}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAttachFirewall}
                disabled={firewallAction === "attach" || selectedFirewallId === ""}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${firewallAction === "attach" || selectedFirewallId === "" ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              >
                {firewallAction === "attach" ? "Attaching..." : "Attach firewall"}
              </button>
            </div>
          </div>
          {availableFirewallOptions.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">No unattached firewalls were returned by the provider.</p>
          )}
        </div>

        {firewallSummaries.length > 0 ? (
          firewallSummaries.map((firewall) => {
            const inbound = firewall.rules?.inbound ?? [];
            const outbound = firewall.rules?.outbound ?? [];
            const detachBusy = firewallAction === `detach-${firewall.id}`;

            return (
              <div key={firewall.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm border bg-background/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{firewall.label || `Firewall ${firewall.id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {firewall.created ? `Created ${formatDateTime(firewall.created)}` : "Creation date unknown"}
                    </p>
                    {firewall.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {firewall.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground dark:bg-primary/40 dark:text-primary-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${statusBadgeClasses(firewall.status)}`}>
                      {formatStatusLabel(firewall.status)}
                    </span>
                    {firewall.pendingChanges && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Pending changes
                      </span>
                    )}
                    {firewall.updated && <span>Updated {formatRelativeTime(firewall.updated)}</span>}
                    {firewall.attachment?.id ? (
                      <button
                        type="button"
                        onClick={() => onDetachFirewall(firewall.id, firewall.attachment?.id ?? null)}
                        disabled={detachBusy}
                        className={`mt-2 inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary border  dark:hover:bg-gray-800 ${detachBusy ? "opacity-70" : ""}`}
                      >
                        {detachBusy ? "Detaching..." : "Detach firewall"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Inbound rules ({inbound.length})</p>
                    {inbound.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-xs text-gray-600 text-muted-foreground">
                        {inbound.slice(0, 5).map((rule, index) => (
                          <li key={`inbound-${firewall.id}-${index}`} className="rounded-lg bg-muted/50 px-3 py-2 bg-background/60">
                            <p className="font-semibold text-foreground ">{summarizeFirewallRule(rule)}</p>
                            {rule.addresses?.ipv4 && rule.addresses.ipv4.length > 0 && <p>IPv4: {rule.addresses.ipv4.join(", ")}</p>}
                            {rule.addresses?.ipv6 && rule.addresses.ipv6.length > 0 && <p>IPv6: {rule.addresses.ipv6.join(", ")}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No inbound rules.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Outbound rules ({outbound.length})</p>
                    {outbound.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-xs text-gray-600 text-muted-foreground">
                        {outbound.slice(0, 5).map((rule, index) => (
                          <li key={`outbound-${firewall.id}-${index}`} className="rounded-lg bg-muted/50 px-3 py-2 bg-background/60">
                            <p className="font-semibold text-foreground ">{summarizeFirewallRule(rule)}</p>
                            {rule.addresses?.ipv4 && rule.addresses.ipv4.length > 0 && <p>IPv4: {rule.addresses.ipv4.join(", ")}</p>}
                            {rule.addresses?.ipv6 && rule.addresses.ipv6.length > 0 && <p>IPv6: {rule.addresses.ipv6.join(", ")}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No outbound rules.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-input bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No firewalls are currently attached to this instance.
          </div>
        )}
      </div>
    </section>
  );
}
