import { CalendarClock, Cloud, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BackupPricing, VpsInstanceDetail } from "./types";

interface ChoiceOption {
  value: string;
  label: string;
}

interface BackupsTabProps {
  detail: VpsInstanceDetail | null;
  backupPricing: BackupPricing | null;
  backupsEnabled: boolean;
  backupToggleBusy: boolean;
  snapshotBusy: boolean;
  snapshotLabel: string;
  scheduleDay: string;
  scheduleWindow: string;
  scheduleBusy: boolean;
  scheduleDirty: boolean;
  normalizedOriginalDay: string;
  normalizedOriginalWindow: string;
  restoreBusyId: number | null;
  snapshotId: number | null;
  snapshotRestoreBusy: boolean;
  backupDayChoices: ChoiceOption[];
  backupWindowChoices: ChoiceOption[];
  onSnapshotLabelChange: (value: string) => void;
  onScheduleDayChange: (value: string) => void;
  onScheduleWindowChange: (value: string) => void;
  onBackupAction: (action: "enable" | "disable" | "snapshot") => void;
  onBackupScheduleSave: () => void;
  onBackupScheduleReset: () => void;
  onBackupRestore: (backupId: number) => void;
  describeBackupWindow: (value: string) => string;
  formatCurrency: (value: number) => string;
  formatHourlyCurrency: (value: number) => string;
  formatDateTime: (value: string | null) => string;
  formatRelativeTime: (value: string | null) => string;
  formatSizeFromMb: (sizeMb: number) => string;
}

export default function BackupsTab({
  detail,
  backupPricing,
  backupsEnabled,
  backupToggleBusy,
  snapshotBusy,
  snapshotLabel,
  scheduleDay,
  scheduleWindow,
  scheduleBusy,
  scheduleDirty,
  normalizedOriginalDay,
  normalizedOriginalWindow,
  restoreBusyId,
  snapshotId,
  snapshotRestoreBusy,
  backupDayChoices,
  backupWindowChoices,
  onSnapshotLabelChange,
  onScheduleDayChange,
  onScheduleWindowChange,
  onBackupAction,
  onBackupScheduleSave,
  onBackupScheduleReset,
  onBackupRestore,
  describeBackupWindow,
  formatCurrency,
  formatHourlyCurrency,
  formatDateTime,
  formatRelativeTime,
  formatSizeFromMb,
}: BackupsTabProps) {
  return (
    <section className="rounded-2xl border border bg-card shadow-sm">
      <div className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 border">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Backup Protection
        </h2>
        <p className="text-sm text-muted-foreground">
          Automatic snapshots captured by the underlying platform.
          {detail?.providerName && (
            <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
              Note: Backup features may vary by provider. Some options may not be available for {detail.providerName}.
            </span>
          )}
        </p>
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className={`h-4 w-4 ${detail?.backups?.enabled ? "text-green-500" : "text-muted-foreground"}`} />
            <span className="font-medium ">{detail?.backups?.enabled ? "Backups Enabled" : "Backups Disabled"}</span>
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {detail?.backups?.schedule
              ? `Schedule: ${detail.backups.schedule.day ?? "Any day"} · Window ${detail.backups.schedule.window ?? "Automatic"}`
              : "No schedule data available"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 border bg-background/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onBackupAction(backupsEnabled ? "disable" : "enable")}
                disabled={backupToggleBusy}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${backupsEnabled ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/30" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              >
                {backupToggleBusy ? "Applying..." : backupsEnabled ? "Disable backups" : "Enable backups"}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Snapshot label</label>
              <input
                type="text"
                value={snapshotLabel}
                onChange={(event) => onSnapshotLabelChange(event.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary border bg-background  dark:placeholder:text-muted-foreground"
                disabled={snapshotBusy}
              />
              <Button
                type="button"
                onClick={() => onBackupAction("snapshot")}
                disabled={snapshotBusy || !backupsEnabled}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${snapshotBusy || !backupsEnabled ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"}`}
              >
                {snapshotBusy ? "Requesting..." : "Capture snapshot"}
              </Button>
            </div>
          </div>
          {!backupsEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Manual snapshots require backups to be enabled. Toggle backups on to request a new snapshot.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 border bg-background/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock className="h-4 w-4 text-primary" />
                Automated backup schedule
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose the preferred weekly snapshot day and two-hour window. Leave either field on auto to let the provider pick.
              </p>
              <p className="text-xs text-muted-foreground">
                Current provider selection: {normalizedOriginalDay ? normalizedOriginalDay : "Auto"} · {normalizedOriginalWindow ? describeBackupWindow(normalizedOriginalWindow) : "Auto"}
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto">
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Preferred day</label>
                <select
                  value={scheduleDay}
                  onChange={(event) => onScheduleDayChange(event.target.value)}
                  disabled={!backupsEnabled || scheduleBusy}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted border bg-background  disabled:bg-card"
                >
                  {backupDayChoices.map((option) => (
                    <option key={option.value || "auto"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Backup window</label>
                <select
                  value={scheduleWindow}
                  onChange={(event) => onScheduleWindowChange(event.target.value)}
                  disabled={!backupsEnabled || scheduleBusy}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted border bg-background  disabled:bg-card"
                >
                  {backupWindowChoices.map((option) => (
                    <option key={option.value || "auto"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onBackupScheduleSave}
              disabled={!backupsEnabled || scheduleBusy || !scheduleDirty}
              variant="default"
              size="sm"
            >
              {scheduleBusy ? "Saving..." : "Save schedule"}
            </Button>
            <button
              type="button"
              onClick={onBackupScheduleReset}
              disabled={!scheduleDirty || scheduleBusy}
              className={`inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-gray-300 border  ${!scheduleDirty || scheduleBusy ? "cursor-not-allowed opacity-60" : "hover:bg-muted dark:hover:bg-gray-800"}`}
            >
              Reset
            </button>
          </div>
          {!backupsEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">Enable backups to configure the automated schedule.</p>
          )}
        </div>

        {backupPricing && (
          <div className="rounded-xl border border-primary bg-primary px-4 py-4 text-sm text-primary dark:border-primary/40 dark:bg-primary/30 dark:text-primary">
            <p className="font-semibold">Plan add-on pricing</p>
            <p className="mt-1 text-xs">
              Enabling backups adds {formatCurrency(backupPricing.monthly)} / month ({formatHourlyCurrency(backupPricing.hourly)} hourly) - 40% of your selected plan.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last successful backup</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {detail?.backups?.lastSuccessful
              ? `${formatDateTime(detail.backups.lastSuccessful)} (${formatRelativeTime(detail.backups.lastSuccessful)})`
              : "No successful backups recorded yet"}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Cloud className="h-4 w-4 text-primary" />
              Automatic backups
            </h3>
            <p className="text-xs text-muted-foreground">Most recent restore points (up to 5 shown).</p>
          </div>
          {detail?.backups?.automatic && detail.backups.automatic.length > 0 ? (
            <div className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-border dark:divide-gray-800 border">
              {detail.backups.automatic.slice(0, 5).map((backup) => {
                const backupId = typeof backup.id === "number" ? backup.id : null;
                const restoreAvailable = Boolean(backup.available && backupId !== null);
                const automaticRestoreBusy = backupId !== null && restoreBusyId === backupId;
                const restoreDisabled = !restoreAvailable || restoreBusyId !== null;
                const itemKey = backupId ?? backup.created ?? backup.label ?? Math.random().toString(36);

                return (
                  <div
                    key={itemKey}
                    className="flex flex-col gap-2 bg-white px-4 py-3 text-sm bg-background/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{backup.label || `Backup ${backupId ?? ""}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.created ? `${formatDateTime(backup.created)} (${formatRelativeTime(backup.created)})` : "Pending"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${backup.available ? "text-green-500" : "text-amber-500"}`}>
                          {backup.status || "pending"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatSizeFromMb(backup.totalSizeMb)}</span>
                      </div>
                      {restoreAvailable && (
                        <button
                          type="button"
                          onClick={() => {
                            if (backupId !== null) {
                              onBackupRestore(backupId);
                            }
                          }}
                          disabled={restoreDisabled}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${restoreDisabled ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"}`}
                        >
                          <RotateCcw className={`h-4 w-4 ${automaticRestoreBusy ? "animate-spin" : ""}`} />
                          {automaticRestoreBusy ? "Restoring..." : "Restore"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-input bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No automatic backups captured yet.
            </div>
          )}

          {detail?.backups?.snapshot || detail?.backups?.snapshotInProgress ? (
            <div className="rounded-xl border border-primary bg-primary px-4 py-4 text-sm text-primary dark:border-primary/60 dark:bg-primary/30 dark:text-primary">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Manual snapshots</span>
                </div>
                {snapshotId !== null && (
                  <button
                    type="button"
                    onClick={() => onBackupRestore(snapshotId)}
                    disabled={restoreBusyId !== null}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${restoreBusyId !== null ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"}`}
                  >
                    <RotateCcw className={`h-4 w-4 ${snapshotRestoreBusy ? "animate-spin" : ""}`} />
                    {snapshotRestoreBusy ? "Restoring..." : "Restore snapshot"}
                  </button>
                )}
              </div>
              {detail?.backups?.snapshot ? (
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <span>
                    Captured {detail.backups.snapshot.created ? formatDateTime(detail.backups.snapshot.created) : "at an unknown time"}
                    {detail.backups.snapshot.label ? ` · ${detail.backups.snapshot.label}` : ""}.
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-xs">A snapshot is currently running.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
