import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    if (path.endsWith("/billing")) {
      return {
        billing: {
          paymentStatus: "current",
          renewalAmount: 10,
          currency: "USD",
          hostingWalletBalance: 50,
          nextBillingAt: "2026-06-02T04:16:59Z",
          cycles: [],
          refunds: [],
        },
      };
    }
    throw new Error(`Unhandled GET ${path}`);
  });
}

function renderOverview(readOnly = false, overrides: Record<string, any> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewTab service={{ ...service, ...overrides }} readOnly={readOnly} />
    </QueryClientProvider>
  );
}

describe("OverviewTab bandwidth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("renders zero monthly transfer as 0 B with quota and metrics details", async () => {
    renderOverview();

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
    renderOverview();

    await screen.findByText("Monthly transfer used");
    await user.click(screen.getByRole("button", { name: /refresh usage/i }));

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/services/sub-123/bandwidth?refreshCache=true");
    });
    expect(await screen.findByText("A fresh Enhance cache refresh was requested.")).toBeInTheDocument();
  });

  it("renders reseller overview as read-only with package resources", async () => {
    renderOverview(true, {
      is_reseller_plan: true,
      plan_features: {
        resources: {
          customers: { total: 10 },
          websites: { total: 50 },
        },
      },
    });

    expect(await screen.findByText("Package Resource Summary")).toBeInTheDocument();
    expect(screen.getByText("Customer Accounts")).toBeInTheDocument();
    expect(screen.getByText("Websites")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh usage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate invoice/i })).not.toBeInTheDocument();
  });
});
