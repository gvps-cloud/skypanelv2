import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VPSDetail from "@/pages/VPSDetail";
import { renderWithAuth } from "@/test-utils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/contexts/BreadcrumbContext", () => ({
  useBreadcrumb: () => ({
    setDynamicOverride: vi.fn(),
    removeDynamicOverride: vi.fn(),
  }),
}));

vi.mock("@/components/VPS/SSHTerminal", () => ({
  SSHTerminal: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="ssh-terminal">{instanceId}</div>
  ),
}));

vi.mock("@/components/VPS/RebuildOSSelect", () => ({
  default: () => <div data-testid="rebuild-os-select" />,
}));

vi.mock("@/services/egressService", () => ({
  egressService: {
    getBalance: vi.fn().mockResolvedValue({ success: false }),
    getVPSUsageSummary: vi.fn().mockResolvedValue({ success: false }),
  },
}));

const fetchMock = vi.fn();

const instanceResponse = {
  instance: {
    id: "vps-1",
    label: "alpha-vps",
    status: "running",
    ipAddress: "203.0.113.10",
    providerInstanceId: "linode-123",
    providerId: "provider-1",
    providerType: "linode",
    providerName: "Cloud",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    notes: "Test note",
    region: "us-east",
    regionLabel: "US East",
    configuration: {},
    image: "ubuntu-24.04",
    plan: {
      id: "plan-1",
      name: "Basic",
      providerPlanId: "g6-nanode-1",
      specs: {
        vcpus: 2,
        memory: 2048,
        disk: 50,
        transfer: 2000,
      },
      pricing: {
        hourly: 0.02,
        monthly: 12,
        currency: "USD",
      },
    },
    provider: {
      id: 1,
      label: "alpha-vps",
      status: "running",
      region: "us-east",
      image: "ubuntu-24.04",
      ipv4: ["203.0.113.10"],
      ipv6: "2001:db8::10",
      created: "2026-04-01T00:00:00.000Z",
      updated: "2026-04-01T00:00:00.000Z",
      specs: {
        vcpus: 2,
        memory: 2048,
        disk: 50,
        transfer: 2000,
      },
      watchdog_enabled: true,
    },
    metrics: null,
    transfer: {
      usedGb: 10,
      quotaGb: 2000,
      billableGb: 0,
      utilizationPercent: 0.5,
      account: null,
      usedBytes: 0,
    },
    backups: {
      enabled: false,
      available: false,
      schedule: null,
      lastSuccessful: null,
      automatic: [],
      snapshot: null,
      snapshotInProgress: null,
    },
    networking: {
      ipv4: {
        public: [
          {
            address: "203.0.113.10",
            type: "public",
            public: true,
            rdns: "alpha.example.com",
            gateway: "203.0.113.1",
            subnetMask: "255.255.255.0",
            prefix: 24,
            region: "us-east",
            rdnsEditable: true,
          },
        ],
        private: [],
        shared: [],
        reserved: [],
      },
      ipv6: null,
    },
    firewalls: [],
    firewallOptions: [],
    providerConfigs: [],
    activity: [],
    backupPricing: null,
    rdnsEditable: true,
    providerProgress: null,
    progressPercent: null,
  },
};

function createInstanceResponse(
  overrides: Partial<(typeof instanceResponse)["instance"]> = {},
) {
  return {
    instance: {
      ...instanceResponse.instance,
      ...overrides,
      provider: {
        ...instanceResponse.instance.provider,
        ...(overrides.provider ?? {}),
      },
    },
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = "/vps/vps-1") {
  return renderWithAuth(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/vps/:id"
          element={
            <>
              <VPSDetail />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VPSDetail tab routing", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/vps/vps-1") {
        return new Response(JSON.stringify(currentResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/auth/verify-password") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/vps/networking/config") {
        return new Response(
          JSON.stringify({
            config: { rdns_base_domain: "ip.rev.example.com" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unhandled fetch request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  let currentResponse = instanceResponse;

  beforeEach(() => {
    currentResponse = instanceResponse;
  });

  it("keeps ssh deep links on the tab until the console button is clicked", async () => {
    renderPage("/vps/vps-1?tab=ssh");

    expect(await screen.findByText("SSH Console")).toBeTruthy();
    expect(screen.getByTestId("location-search").textContent).toBe("?tab=ssh");
    expect(screen.queryByText("Confirm Password")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open SSH Console" }));

    expect(await screen.findByText("Confirm Password")).toBeTruthy();
  });

  it("syncs tab changes back into the URL", async () => {
    renderPage();

    expect(await screen.findByText("Instance Feature Views")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "networking" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe(
        "?tab=networking",
      );
    });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "overview" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("normalizes hidden provider-gated tabs back to a rendered tab", async () => {
    currentResponse = createInstanceResponse({
      providerType: "aws",
      provider: {
        ...instanceResponse.instance.provider,
        id: 2,
        label: "aws-vps",
      },
    });

    renderPage("/vps/vps-1?tab=metrics");

    expect(await screen.findByText("Instance Feature Views")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    const optionValues = Array.from(
      screen.getByRole("combobox").querySelectorAll("option"),
    ).map((option) => option.getAttribute("value"));
    expect(optionValues).not.toContain("metrics");
  });

  it("closes SSH dialogs when navigation leaves the ssh tab", async () => {
    renderPage("/vps/vps-1?tab=ssh");

    expect(await screen.findByText("SSH Console")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open SSH Console" }));

    expect(await screen.findByText("Confirm Password")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Sup3rSecure!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Open" }));

    expect(await screen.findByTestId("ssh-terminal")).toBeTruthy();

    const tabSelect = document.querySelector("select");
    expect(tabSelect).toBeTruthy();

    fireEvent.change(tabSelect as HTMLSelectElement, {
      target: { value: "overview" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Confirm Password")).toBeNull();
      expect(screen.queryByTestId("ssh-terminal")).toBeNull();
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });
});
