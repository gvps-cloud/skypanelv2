import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithAuth, screen, waitFor } from "@/test-utils";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VPS from "./VPS";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/hooks/useCategoryMappings", () => ({
  useEnabledCategoryMappings: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-mobile-navigation", () => ({
  useMobileNavigation: () => ({ setModalOpen: vi.fn(), goBack: vi.fn() }),
}));

vi.mock("@/hooks/use-mobile-performance", () => ({
  useMobilePerformance: () => ({
    measureRenderTime: () => () => {},
    getOptimizedSettings: { enableAnimations: false },
  }),
}));

vi.mock("@/components/ui/mobile-toast", () => ({
  useMobileToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

vi.mock("@/components/ui/mobile-loading", () => ({
  MobileLoading: () => null,
  useMobileLoading: () => ({
    isLoading: false,
    title: "",
    description: "",
    progress: 0,
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    updateProgress: vi.fn(),
  }),
}));

vi.mock("@/components/VPS/VpsTable", () => ({
  VpsInstancesTable: () => <div data-testid="vps-table" />,
}));

vi.mock("@/components/VPS/BulkDeleteModal", () => ({
  BulkDeleteModal: () => null,
}));

vi.mock("@/components/VPS/RegionSelector", () => ({
  RegionSelector: () => <div data-testid="region-selector" />,
}));

vi.mock("@/components/VPS/SearchableOptionSelect", () => ({
  SearchableOptionSelect: () => <div data-testid="searchable-select" />,
}));

vi.mock("@/components/ui/dialog-stack", () => ({
  DialogStack: ({ open, title, steps, activeStep, footer }: any) => {
    if (!open) return null;
    const currentStep = steps[Math.max(activeStep ?? 0, 0)];
    return (
      <div>
        <h2>{title}</h2>
        <div>{currentStep?.content}</div>
        <div>{footer}</div>
      </div>
    );
  },
}));

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe("VPS page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("auth_token", "mock-jwt-token");
  });

  it("keeps the create modal open and preserves the generated label across polling refreshes", async () => {
    const intervals: Array<{ handler: TimerHandler; timeout?: number }> = [];

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/vps/providers") {
        return okJson({ providers: [{ id: "provider-1", name: "Configured Provider", type: "linode" }] });
      }
      if (url === "/api/vps/plans") {
        return okJson({ plans: [] });
      }
      if (url === "/api/vps/providers/provider-1/regions") {
        return okJson({ regions: [] });
      }
      if (url === "/api/vps") {
        return okJson({ instances: [] });
      }
      if (url === "/api/vps/images") {
        return okJson({ images: [] });
      }
      if (url === "/api/vps/stackscripts?configured=true") {
        return okJson({ scripts: [] });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.spyOn(global, "setInterval").mockImplementation(((handler, timeout) => {
      intervals.push({ handler, timeout });
      return intervals.length as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);
    vi.spyOn(global, "clearInterval").mockImplementation(() => undefined);

    renderWithAuth(
      <MemoryRouter initialEntries={["/vps?create=1"]}>
        <Routes>
          <Route path="/vps" element={<VPS />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /vps instances/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Create New VPS Instance")).toBeInTheDocument();
    });

    const labelInput = screen.getByPlaceholderText(/generating unique label/i) as HTMLInputElement;
    const initialLabel = labelInput.value;

    expect(initialLabel).not.toBe("");
    expect(intervals.some((interval) => interval.timeout === 30000)).toBe(true);

    const latestPollingInterval = [...intervals].reverse().find((interval) => interval.timeout === 30000);
    expect(latestPollingInterval).toBeDefined();

    act(() => {
      if (typeof latestPollingInterval?.handler === "function") {
        latestPollingInterval.handler();
      }
    });

    await waitFor(() => {
      const vpsCalls = vi.mocked(global.fetch).mock.calls.filter(([input]) => String(input) === "/api/vps");
      expect(vpsCalls.length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText("Create New VPS Instance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /vps instances/i })).toBeInTheDocument();
    expect((screen.getByPlaceholderText(/generating unique label/i) as HTMLInputElement).value).toBe(initialLabel);
  });
});