import React from "react";
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Admin from "@/pages/Admin";
import { renderWithAuth } from "@/test-utils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/contexts/ImpersonationContext", () => ({
  useImpersonation: () => ({
    startImpersonation: vi.fn(),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "default",
    setTheme: vi.fn(),
    reloadTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCategoryMappings", () => ({
  useCategoryDisplayName: (category: string) => category,
}));

vi.mock("@/components/fx/MatrixRain", () => ({
  MatrixRain: () => null,
}));

const initialPlans = [
  {
    id: "plan-1",
    provider_id: "provider-1",
    name: "KVM 64",
    provider_plan_id: "g6-standard-16",
    base_price: 80,
    markup_price: 0.05,
    backup_price_monthly: 40,
    backup_price_hourly: 0.1,
    backup_upcharge_monthly: 0.05,
    backup_upcharge_hourly: 0.000068,
    daily_backups_enabled: true,
    weekly_backups_enabled: true,
    specifications: {
      vcpus: 16,
      memory: 65536,
      disk: 1280,
      transfer: 20,
    },
    type_class: "standard",
    regions: [{ region_id: "us-east" }],
    active: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    provider_name: "Upstream",
    provider_type: "linode",
  },
  {
    id: "plan-2",
    provider_id: "provider-1",
    name: "KVM 32",
    provider_plan_id: "g6-standard-8",
    base_price: 40,
    markup_price: 0.05,
    backup_price_monthly: 20,
    backup_price_hourly: 0.05,
    backup_upcharge_monthly: 0.05,
    backup_upcharge_hourly: 0.000068,
    daily_backups_enabled: true,
    weekly_backups_enabled: false,
    specifications: {
      vcpus: 8,
      memory: 32768,
      disk: 640,
      transfer: 16,
    },
    type_class: "standard",
    regions: [{ region_id: "us-east" }],
    active: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    provider_name: "Upstream",
    provider_type: "linode",
  },
  {
    id: "plan-3",
    provider_id: "provider-1",
    name: "KVM 16",
    provider_plan_id: "g6-standard-4",
    base_price: 20,
    markup_price: 0.05,
    backup_price_monthly: 10,
    backup_price_hourly: 0.025,
    backup_upcharge_monthly: 0.05,
    backup_upcharge_hourly: 0.000068,
    daily_backups_enabled: false,
    weekly_backups_enabled: true,
    specifications: {
      vcpus: 4,
      memory: 16384,
      disk: 320,
      transfer: 8,
    },
    type_class: "standard",
    regions: [{ region_id: "us-east" }],
    active: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    provider_name: "Upstream",
    provider_type: "linode",
  },
];

const providersResponse = {
  providers: [
    {
      id: "provider-1",
      name: "Upstream",
      type: "linode",
      active: true,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
      allowed_regions: ["us-east", "us-central"],
    },
  ],
};

const regionsResponse = {
  regions: [
    {
      id: "us-east",
      label: "Newark",
      country: "US",
      capabilities: ["Premium Plans", "GPU Linodes", "Accelerated"],
      status: "ok",
    },
    {
      id: "us-central",
      label: "Dallas",
      country: "US",
      capabilities: [],
      status: "ok",
    },
  ],
};

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Admin VPS plans region editing", () => {
  const fetchMock = vi.fn();
  let plansState = structuredClone(initialPlans);
  let plansGetCount = 0;
  let putRegionsPayload: string[] | null = null;

  beforeEach(() => {
    plansState = structuredClone(initialPlans);
    plansGetCount = 0;
    putRegionsPayload = null;

    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === "string" ? input : input.toString();
        const method = (init?.method ?? "GET").toUpperCase();
        const url = new URL(rawUrl, "http://localhost:3001");
        const path = url.pathname;

        if (path.endsWith("/api/admin/plans") && method === "GET") {
          plansGetCount += 1;
          return jsonResponse({ plans: plansState });
        }

        if (path.endsWith("/api/admin/plans/plan-1") && method === "PUT") {
          const payload = init?.body ? JSON.parse(String(init.body)) : {};
          putRegionsPayload = Array.isArray(payload.regions)
            ? payload.regions
            : null;

          if (Array.isArray(payload.regions)) {
            plansState = plansState.map((plan) =>
              plan.id === "plan-1"
                ? {
                    ...plan,
                    regions: payload.regions.map((regionId: string) => ({
                      region_id: regionId,
                    })),
                  }
                : plan,
            );
          }

          const updatedPlan =
            plansState.find((plan) => plan.id === "plan-1") ?? plansState[0];
          return jsonResponse({ plan: updatedPlan });
        }

        if (path.endsWith("/api/admin/providers") && method === "GET") {
          return jsonResponse(providersResponse);
        }

        if (path.endsWith("/api/admin/upstream/regions") && method === "GET") {
          return jsonResponse(regionsResponse);
        }

        if (path.endsWith("/api/admin/upstream/plans") && method === "GET") {
          return jsonResponse({ plans: [] });
        }

        if (path.endsWith("/api/admin/tickets") && method === "GET") {
          return jsonResponse({ tickets: [] });
        }

        if (path.endsWith("/api/admin/servers") && method === "GET") {
          return jsonResponse({ servers: [] });
        }

        if (path.endsWith("/api/admin/users") && method === "GET") {
          return jsonResponse({ users: [] });
        }

        if (path.endsWith("/api/admin/theme") && method === "GET") {
          return jsonResponse({ theme: {} });
        }

        return jsonResponse({});
      },
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("opens region wizard, saves selected regions, and refreshes plans", async () => {
    const user = userEvent.setup();

    renderWithAuth(
      <MemoryRouter initialEntries={["/admin#vps-plans"]}>
        <Admin />
      </MemoryRouter>,
    );

    await screen.findAllByText("KVM 64");
    expect(screen.getByText("Policy: Daily + Weekly")).toBeTruthy();
    expect(screen.getByText("Policy: Daily")).toBeTruthy();
    expect(screen.getByText("Policy: Weekly")).toBeTruthy();

    const initialPlansFetches = plansGetCount;

    const regionButtons = await screen.findAllByRole("button", {
      name: "Regions",
    });
    await user.click(regionButtons[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent || "").toContain("KVM 64");

    await user.click(within(dialog).getByRole("checkbox", { name: "Dallas" }));
    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Save Regions" }),
    );

    await waitFor(() => {
      expect(putRegionsPayload).toEqual(["us-east", "us-central"]);
    });

    await waitFor(() => {
      expect(plansGetCount).toBeGreaterThan(initialPlansFetches);
    });

    const reopenButtons = await screen.findAllByRole("button", {
      name: "Regions",
    });
    await user.click(reopenButtons[0]);

    const reopenedDialog = await screen.findByRole("dialog");
    expect(reopenedDialog.textContent || "").toContain("2 regions selected");
  });
});
