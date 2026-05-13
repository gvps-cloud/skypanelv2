import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import BackupsTab from "./BackupsTab";
import type { BackupSummary, BackupPricing, VpsInstanceDetail } from "./types";

const buildBackup = (overrides: Partial<BackupSummary> = {}): BackupSummary => ({
  id: 101,
  label: "Weekly backup",
  type: "auto",
  status: "successful",
  created: "2026-05-13T10:00:00.000Z",
  finished: "2026-05-13T10:10:00.000Z",
  updated: "2026-05-13T10:10:00.000Z",
  available: true,
  totalSizeMb: 5120,
  configs: [],
  ...overrides,
});

const buildDetail = (overrides: Partial<VpsInstanceDetail> = {}): VpsInstanceDetail => ({
  id: "vps-1",
  label: "vps-quick-vertex",
  status: "running",
  ipAddress: "203.0.113.10",
  providerInstanceId: "linode-1",
  providerId: "1",
  providerType: "linode",
  providerName: "Upstream",
  createdAt: "2026-05-13T07:53:50.000Z",
  updatedAt: "2026-05-13T07:55:09.000Z",
  notes: null,
  region: "ca-central",
  regionLabel: "Canada Central",
  configuration: {},
  image: "ubuntu24.04",
  plan: {
    id: "plan-1",
    name: "Standard 4GB",
    providerPlanId: "g6-standard-2",
    specs: { vcpus: 2, memory: 4096, disk: 80, transfer: 1000 },
    pricing: { hourly: 0.006917, monthly: 5.04, currency: "USD" },
  },
  provider: null,
  metrics: null,
  transfer: null,
  backups: {
    enabled: false,
    available: true,
    schedule: { day: null, window: null },
    lastSuccessful: null,
    automatic: [],
    snapshot: null,
    snapshotInProgress: null,
  },
  networking: null,
  firewalls: [],
  firewallOptions: [],
  providerConfigs: [],
  activity: [],
  backupPricing: null,
  rdnsEditable: true,
  providerProgress: null,
  progressPercent: null,
  ...overrides,
});

const baseProps: ComponentProps<typeof BackupsTab> = {
  detail: buildDetail(),
  backupPricing: null,
  backupsEnabled: false,
  backupToggleBusy: false,
  snapshotBusy: false,
  snapshotLabel: "",
  scheduleDay: "",
  scheduleWindow: "",
  scheduleBusy: false,
  scheduleDirty: false,
  normalizedOriginalDay: "",
  normalizedOriginalWindow: "",
  restoreBusyId: null,
  snapshotId: null,
  snapshotRestoreBusy: false,
  backupDayChoices: [{ value: "", label: "Auto (provider selected)" }],
  backupWindowChoices: [{ value: "", label: "Auto (provider selected)" }],
  onSnapshotLabelChange: vi.fn(),
  onScheduleDayChange: vi.fn(),
  onScheduleWindowChange: vi.fn(),
  onBackupAction: vi.fn(),
  onBackupScheduleSave: vi.fn(),
  onBackupScheduleReset: vi.fn(),
  onBackupRestore: vi.fn(),
  describeBackupWindow: (value: string) => value,
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
  formatHourlyCurrency: (value: number) => `$${value.toFixed(6)}`,
  formatDateTime: (value: string | null) => value ?? "—",
  formatRelativeTime: () => "just now",
  formatSizeFromMb: (sizeMb: number) => `${sizeMb.toFixed(0)} MB`,
};

const renderBackupsTab = (overrides: Partial<ComponentProps<typeof BackupsTab>> = {}) => {
  const props = { ...baseProps, ...overrides };
  return render(<BackupsTab {...props} />);
};

describe("VPSDetail BackupsTab", () => {
  it("uses readable contrast classes for pricing and manual snapshot callouts", () => {
    const manualSnapshot = buildBackup({ id: 202, label: "Manual pre-upgrade snapshot", type: "snapshot" });
    const pricing: BackupPricing = { monthly: 2.02, hourly: 0.002767, currency: "USD" };

    renderBackupsTab({
      backupPricing: pricing,
      detail: buildDetail({
        backups: {
          enabled: true,
          available: true,
          schedule: { day: "Sunday", window: "W2" },
          lastSuccessful: "2026-05-13T10:10:00.000Z",
          automatic: [],
          snapshot: manualSnapshot,
          snapshotInProgress: null,
        },
      }),
      backupsEnabled: true,
      snapshotId: 202,
    });

    const pricingCard = screen.getByText("Plan add-on pricing").closest("div.rounded-xl");
    expect(pricingCard).toBeInTheDocument();
    expect(pricingCard).toHaveClass("bg-primary/10", "text-primary");
    expect(pricingCard).not.toHaveClass("bg-primary");

    const manualSnapshotsCard = screen.getByText("Manual snapshots").closest("div.rounded-xl");
    expect(manualSnapshotsCard).toBeInTheDocument();
    expect(manualSnapshotsCard).toHaveClass("bg-primary/10", "text-primary");
    expect(manualSnapshotsCard).not.toHaveClass("bg-primary");
  });

  it("renders a clear empty automatic-backups state with helper guidance", () => {
    renderBackupsTab({
      detail: buildDetail({
        backups: {
          enabled: false,
          available: true,
          schedule: { day: null, window: null },
          lastSuccessful: null,
          automatic: [],
          snapshot: null,
          snapshotInProgress: null,
        },
      }),
    });

    const emptyStateMessage = screen.getByText("No automatic backups captured yet.");
    expect(emptyStateMessage).toBeInTheDocument();
    expect(emptyStateMessage).toHaveClass("text-foreground");
    expect(
      screen.getByText("Enable backups and wait for the next provider snapshot window to populate this list."),
    ).toBeInTheDocument();
  });
});
