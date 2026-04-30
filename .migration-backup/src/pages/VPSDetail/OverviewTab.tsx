import { Activity, Cloud, Cpu, HardDrive, LayoutDashboard, Network, RefreshCw, Shield } from "lucide-react";
import { ActiveHoursDisplay } from "@/components/VPS/ActiveHoursDisplay";
import type { VpsInstanceDetail } from "./types";

interface OverviewTabProps {
  detail: VpsInstanceDetail | null;
  watchdogSaving: boolean;
  onToggleWatchdog: (enabled: boolean) => void;
  isTransitionalState: (status: string) => boolean;
  formatMemory: (memoryMb: number) => string;
  formatStorage: (disk: number) => string;
  formatTransferAllowance: (transferGb: number) => string;
  formatCurrency: (value: number) => string;
  formatHourlyCurrency: (value: number) => string;
  formatDateTime: (value: string | null) => string;
}

export default function OverviewTab({
  detail,
  watchdogSaving,
  onToggleWatchdog,
  isTransitionalState,
  formatMemory,
  formatStorage,
  formatTransferAllowance,
  formatCurrency,
  formatHourlyCurrency,
  formatDateTime,
}: OverviewTabProps) {
  return (
    <>
      <section className="rounded-2xl border border bg-card shadow-sm">
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6 border">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span>Instance Overview</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Metadata and quick actions for this server.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-6 sm:py-8">
          <div className="space-y-6 sm:space-y-8">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>vCPUs</span>
                  <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary dark:text-primary" />
                </div>
                <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-foreground">
                  {detail?.plan.specs.vcpus ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>Memory</span>
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary dark:text-primary" />
                </div>
                <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-foreground">
                  {formatMemory(detail?.plan.specs.memory ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>Storage</span>
                  <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary dark:text-primary" />
                </div>
                <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-foreground">
                  {formatStorage(detail?.plan.specs.disk ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>Transfer</span>
                  <Network className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary dark:text-primary" />
                </div>
                <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-foreground">
                  {formatTransferAllowance(detail?.plan.specs.transfer ?? 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="rounded-xl border border bg-card p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-muted-foreground">Plan</p>
                <p className="mt-1 text-sm sm:text-base font-semibold text-foreground">
                  {detail?.plan.name || "Custom Plan"}
                </p>
              </div>
              <div className="rounded-xl border border bg-card p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-muted-foreground">Pricing</p>
                <p className="mt-1 text-sm sm:text-base font-semibold text-foreground">
                  {formatCurrency(detail?.plan.pricing.monthly ?? 0)}{" "}
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                    / month
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatHourlyCurrency(detail?.plan.pricing.hourly ?? 0)} hourly billable
                </p>
              </div>
            </div>
          </div>

          <dl className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Instance ID</dt>
              <dd className="mt-1 text-xs sm:text-sm font-medium text-foreground  break-all">
                {detail?.id}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Provider Reference</dt>
              <dd className="mt-1 text-xs sm:text-sm font-medium text-foreground  break-all">
                {detail?.providerInstanceId}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cloud Provider</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-foreground">
                  {detail?.providerName || "Cloud"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Public IPv4</dt>
              <dd className="mt-1 text-xs sm:text-sm font-medium text-foreground ">
                {detail?.ipAddress || "Not yet assigned"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Region</dt>
              <dd className="mt-1 text-xs sm:text-sm font-medium text-foreground ">
                {detail?.regionLabel || detail?.region || "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Created</dt>
              <dd className="mt-1 text-xs sm:text-sm text-foreground text-muted-foreground">
                {formatDateTime(detail?.createdAt || null)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Active Hours</dt>
              <dd className="mt-1">
                <ActiveHoursDisplay
                  createdAt={detail?.createdAt || null}
                  hourlyRate={detail?.plan?.pricing?.hourly}
                  context="detail"
                  className="text-xs sm:text-sm"
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</dt>
              <dd className="mt-1 text-xs sm:text-sm text-foreground text-muted-foreground">
                {formatDateTime(detail?.updatedAt || null)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {(detail?.providerType === "linode" || !detail?.providerType) && (
        <section className="rounded-2xl border border bg-card shadow-sm">
          <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6 border">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span>Shutdown Watchdog</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Lassie monitors your server and automatically reboots it if it powers off unexpectedly.
            </p>
          </div>
          <div className="px-6 sm:px-8 py-5 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Shutdown Watchdog (Lassie)</p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Automatically reboots your server if it powers off without a shutdown job. Lassie stops retrying after 5 boot attempts within 15 minutes.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={detail?.provider?.watchdog_enabled ?? false}
                onClick={() => onToggleWatchdog(!(detail?.provider?.watchdog_enabled ?? false))}
                disabled={watchdogSaving || isTransitionalState(detail?.status ?? "")}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${(detail?.provider?.watchdog_enabled ?? false) ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${(detail?.provider?.watchdog_enabled ?? false) ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            {watchdogSaving && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Saving...
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
