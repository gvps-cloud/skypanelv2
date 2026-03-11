import React from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Admin from "./Admin";
import { fireEvent, renderWithAuth, screen, waitFor, within } from "@/test-utils";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/components/admin/billing/BillingDashboard", () => ({ BillingDashboard: () => null }));
vi.mock("@/components/admin/UserProfileModal", () => ({ UserProfileModal: () => null }));
vi.mock("@/components/admin/UserEditModal", () => ({ UserEditModal: () => null }));
vi.mock("@/components/admin/UserManagement", () => ({ UserManagement: () => null }));
vi.mock("@/components/admin/OrganizationManagement", () => ({ OrganizationManagement: () => null }));
vi.mock("@/components/admin/email/EmailTemplatesManager", () => ({ EmailTemplatesManager: () => null }));
vi.mock("@/components/admin/RateLimitMonitoring", () => ({ RateLimitMonitoring: () => null }));
vi.mock("@/components/admin/CategoryManager", () => ({ CategoryManager: () => null }));
vi.mock("@/components/admin/FAQItemManager", () => ({ FAQItemManager: () => null }));
vi.mock("@/components/admin/UpdatesManager", () => ({ UpdatesManager: () => null }));
vi.mock("@/components/admin/ContactCategoryManager", () => ({ ContactCategoryManager: () => null }));
vi.mock("@/components/admin/ContactMethodManager", () => ({ ContactMethodManager: () => null }));
vi.mock("@/components/admin/PlatformAvailabilityManager", () => ({ default: () => null }));
vi.mock("@/components/admin/CategoryMappingManager", () => ({ CategoryMappingManager: () => null }));
vi.mock("@/components/admin/RegionAccessManager", () => ({ RegionAccessManager: () => null }));
vi.mock("@/components/admin/AdminSupportView", () => ({ AdminSupportView: () => null }));
vi.mock("@/components/admin/VPSPlanWizard", () => ({ VPSPlanWizard: () => null }));
vi.mock("@/components/VPS/SSHTerminal", () => ({ SSHTerminal: () => null }));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    themeId: "default",
    setTheme: vi.fn(),
    themes: [],
    reloadTheme: vi.fn(),
    customPreset: null,
  }),
}));

vi.mock("@/contexts/ImpersonationContext", () => ({
  useImpersonation: () => ({ startImpersonation: vi.fn() }),
}));

vi.mock("@/hooks/useCategoryMappings", () => ({
  useCategoryDisplayName: (category: string) =>
    ({ dedicated: "Dedicated CPU" }[category] ?? category),
}));

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

const TEST_PLAN = {
  id: "plan-1",
  provider_id: "provider-1",
  name: "DEDI EYPC VPSx3",
  provider_plan_id: "g6-dedicated-32",
  base_price: 80,
  markup_price: 3.6,
  backup_price_monthly: 0,
  backup_price_hourly: 0.12,
  backup_upcharge_monthly: 2.4,
  backup_upcharge_hourly: 0,
  daily_backups_enabled: true,
  weekly_backups_enabled: true,
  specifications: { vcpus: 32, memory: 65536, disk: 1310720, transfer: 8192 },
  type_class: "dedicated",
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  provider_name: "UpStream",
  provider_type: "linode",
};

const findEditablePlanRow = (planName: string) =>
  screen
    .getAllByDisplayValue(planName)
    .map((node) => node.closest("tr"))
    .find((row): row is HTMLTableRowElement => Boolean(row));

describe("Admin VPS plans page", () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("auth_token", "mock-jwt-token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "admin-1", role: "admin" }));
  });

  it("keeps plan category read-only and shows only the custom provider name across the VPS plans UI", async () => {
    const user = userEvent.setup();

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/admin/plans") return okJson({ plans: [TEST_PLAN] });
      if (url === "/api/admin/providers") {
        return okJson({
          providers: [
            {
              id: "provider-1",
              name: "UpStream",
              type: "linode",
              active: true,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (url === "/api/admin/upstream/plans") return okJson({ plans: [] });
      if (url === "/api/admin/upstream/regions") return okJson({ regions: [] });

      throw new Error(`Unhandled fetch: ${url}`);
    });

    renderWithAuth(
      <MemoryRouter initialEntries={["/admin#vps-plans"]}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /vps plans/i })).toBeInTheDocument();

    const providerFilter = screen.getByRole("combobox", {
      name: /filter by provider/i,
    });
    await user.click(providerFilter);

    expect(await screen.findByRole("option", { name: "UpStream" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /upstream \(linode\)/i }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("columnheader", { name: /provider plan id/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue(TEST_PLAN.name).length).toBeGreaterThan(0);
    });

    const categoryField = screen.getByText("Category:").parentElement;
    expect(categoryField).not.toBeNull();
    expect(within(categoryField!).getByText("Dedicated CPU")).toBeInTheDocument();
    expect(within(categoryField!).queryByRole("combobox")).not.toBeInTheDocument();

    const planRow = findEditablePlanRow(TEST_PLAN.name);
    expect(planRow).toBeTruthy();
    expect(within(planRow!).getByText("UpStream")).toBeInTheDocument();
    expect(within(planRow!).queryByText(/^linode$/i)).not.toBeInTheDocument();
    expect(within(planRow!).queryByText(TEST_PLAN.provider_plan_id)).not.toBeInTheDocument();
    expect(within(planRow!).getByText("Dedicated CPU")).toBeInTheDocument();
    expect(within(planRow!).queryByRole("combobox")).not.toBeInTheDocument();
  });
});