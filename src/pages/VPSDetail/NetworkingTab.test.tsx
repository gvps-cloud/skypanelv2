import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NetworkingTab from "./NetworkingTab";

const baseProps: ComponentProps<typeof NetworkingTab> = {
  transferUsageTitle: "vps-quick-vertex transfer usage",
  transferUsageDescription: "Track bandwidth consumption for this specific server instance.",
  hasTransferData: true,
  transferUsagePercent: 52,
  usageLabel: "Usage",
  usageUsedGb: 520,
  usageQuotaGb: 1000,
  accountTransferInfo: null,
  transferUsedGb: 520,
  transferRemainingGb: 480,
  usageRemainingGb: 480,
  effectiveBillableGb: 0,
  egressLoading: false,
  egressBalance: 0,
  egressMonthlyUsed: 0,
  publicIpv4Count: 1,
  privateIpv4Count: 1,
  rdnsEditable: true,
  hasSlaacIpv6: false,
  totalIpv4Count: 2,
  ipv4Categories: [],
  rdnsEditor: {},
  ipv6Info: null,
  slaacAddress: null,
  slaacCurrentValue: "",
  slaacEditing: false,
  slaacSaving: false,
  canEditSlaacRdns: false,
  onHandleCopy: vi.fn(),
  onUpdateRdnsValue: vi.fn(),
  onSaveRdns: vi.fn(),
  onCancelEditRdns: vi.fn(),
  onBeginEditRdns: vi.fn(),
  onOpenIpv6RdnsDialog: vi.fn(),
  formatStatusLabel: (value: string | null | undefined) => value ?? "Unknown",
  shouldDisplayRdns: (rdns: string | null) => Boolean(rdns),
};

const renderNetworkingTab = (overrides: Partial<ComponentProps<typeof NetworkingTab>> = {}) =>
  render(
    <MemoryRouter>
      <NetworkingTab {...baseProps} {...overrides} />
    </MemoryRouter>,
  );

describe("VPSDetail NetworkingTab", () => {
  it("renders the transfer icon tile and percentage badge with readable contrast classes", () => {
    const { container } = renderNetworkingTab();

    const gaugeIcon = container.querySelector("svg.lucide-gauge");
    expect(gaugeIcon).toBeInTheDocument();

    const iconTile = gaugeIcon?.parentElement;
    expect(iconTile).toBeInTheDocument();
    expect(iconTile).toHaveClass("bg-primary/10", "border-primary/20");
    expect(iconTile).not.toHaveClass("bg-primary");

    const usageBadge = screen.getByText("52%");
    expect(usageBadge).toHaveClass("bg-primary/10", "text-primary", "dark:text-primary-foreground");
    expect(usageBadge).not.toHaveClass("bg-primary");
  });
});
