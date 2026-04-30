import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VPSDisksTab from "@/pages/vps-detail/VPSDisksTab";
import { renderWithAuth } from "@/test-utils";

const mockFetch = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

const mockDisks = [
  {
    id: 1,
    label: "Ubuntu 22.04 LTS",
    status: "ready",
    size: 51200,
    filesystem: "ext4",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
];

function mockResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setupFetchMock(data: any) {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method || "GET";
    if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
      return mockResponse(data);
    }
    if (method === "DELETE" && /\/vps\/.*\/disks\/\d+$/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/disks\/\d+\/resize/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/disks\/\d+\/clone/.test(url)) {
      return mockResponse({ disk: { id: 4, label: "Disk 1-clone" } });
    }
    if (method === "POST" && /\/vps\/.*\/disks\/\d+\/password/.test(url)) {
      return mockResponse({ success: true });
    }
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", mockFetch);
}

function renderComponent(instanceId = "vps-001", instanceLabel = "TestVPS") {
  return renderWithAuth(
    <MemoryRouter>
      <VPSDisksTab instanceId={instanceId} instanceLabel={instanceLabel} />
    </MemoryRouter>
  );
}

describe("VPSDisksTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Loading state", () => {
    it("shows loading spinner initially", () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));
      vi.stubGlobal("fetch", mockFetch);

      renderComponent();

      expect(screen.getByText(/loading disks/i)).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message when API fails", async () => {
      mockFetch.mockResolvedValue(
        new Response("Server error", { status: 500, headers: { "Content-Type": "text/plain" } })
      );
      vi.stubGlobal("fetch", mockFetch);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no disks", async () => {
      setupFetchMock({ disks: [] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no disks found/i)).toBeInTheDocument();
      });
    });
  });

  describe("Disk list rendering", () => {
    it("renders disk label and details", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });
    });

    it("renders action buttons", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /resize/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clone/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /password/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("displays section header with instance label", async () => {
      setupFetchMock({ disks: [] });

      renderComponent("vps-001", "MyServer-Production");

      await waitFor(() => {
        expect(screen.getByText(/myserver-production/i)).toBeInTheDocument();
      });
    });

    it("renders section header with custom instance label", async () => {
      setupFetchMock({ disks: [] });

      renderComponent("vps-001", "CustomServer");

      await waitFor(() => {
        expect(screen.getByText(/customserver/i)).toBeInTheDocument();
      });
    });
  });

  describe("Delete action", () => {
    it("shows error toast when delete fails", async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          return mockResponse({ disks: mockDisks });
        }
        if (method === "DELETE") {
          throw new Error("Delete failed");
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("confirm", () => true);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Delete failed");
      });
    });
  });
});
