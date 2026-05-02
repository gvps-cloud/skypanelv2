import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewTab from "./OverviewTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: apiMocks,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const service = {
  id: "sub-123",
  plan_name: "Testing Plan",
  service_type: "web",
  domain: "thunderm16.live",
  status: "active",
  enhance_subscription_id: "15",
  enhance_website_id: "web-123",
  created_at: "2026-05-02T04:16:59Z",
};

const bandwidth = {
  used: 0,
  monthlyTransferBytes: 0,
  limit: 10_000_000_000,
  transferQuotaBytes: 10_000_000_000,
  transferUnlimited: false,
  transferTrackedUsageBytes: 1234,
  percentage: 0,
  cacheNote: "Enhance caches current-month subscription bandwidth for up to 12 hours unless refreshCache=true.",
  billingPeriod: { label: "Current calendar month" },
  resellerNote: "For reseller subscriptions, Enhance may include all customer subscriptions.",
  metricsMonthToDate: {
    start: "2026-05-01T00:00:00.000Z",
    end: "2026-05-02T10:00:00.000Z",
    granularity: "day",
    bytesReceived: 1024,
    bytesSent: 2048,
    totalBytes: 3072,
    uniqueHits: 10,
    botHits: 2,
    totalHits: 12,
  },
};

function setupApiMocks() {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path.includes("/bandwidth")) {
      return {
        bandwidth: {
          ...bandwidth,
          refreshRequested: path.includes("refreshCache=true"),
        },
      };
    }
    if (path.endsWith("/website")) {
      return { serverIps: [{ ip: "85.239.231.165", isPrimary: true }] };
    }
    throw new Error(`Unhandled GET ${path}`);
  });
}

describe("OverviewTab bandwidth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("renders zero monthly transfer as 0 B with quota and metrics details", async () => {
    render(<OverviewTab service={service} />);

    expect(await screen.findByText("Monthly transfer used")).toBeInTheDocument();
    expect(screen.getAllByText("0 B").length).toBeGreaterThan(0);
    expect(screen.getByText("9.31 GB")).toBeInTheDocument();
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.getByText("Tracked transfer usage")).toBeInTheDocument();
    expect(screen.getByText("1.21 KB")).toBeInTheDocument();
    expect(screen.getByText("Website traffic month-to-date")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("1.00 KB")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("2.00 KB")).toBeInTheDocument();
    expect(screen.getByText("Combined traffic")).toBeInTheDocument();
    expect(screen.getByText("3.00 KB")).toBeInTheDocument();
    expect(screen.getByText("Total hits")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("requests a fresh Enhance bandwidth cache refresh", async () => {
    const user = userEvent.setup();
    render(<OverviewTab service={service} />);

    await screen.findByText("Monthly transfer used");
    await user.click(screen.getByRole("button", { name: /refresh usage/i }));

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/services/sub-123/bandwidth?refreshCache=true");
    });
    expect(await screen.findByText("A fresh Enhance cache refresh was requested.")).toBeInTheDocument();
  });
});
