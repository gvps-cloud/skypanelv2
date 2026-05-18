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

const mockSwapDisk = {
  id: 2,
  label: "512 MB Swap",
  status: "ready",
  size: 512,
  filesystem: "swap",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

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
    if (method === "GET" && /\/vps\/vps-001$/.test(url)) {
      return mockResponse({ status: "stopped" });
    }
    if (method === "DELETE" && /\/vps\/.*\/disks\/\d+$/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/disks\/\d+\/resize/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/disks\/\d+\/password/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/disks$/.test(url)) {
      return mockResponse({ success: true });
    }
    if (method === "POST" && /\/vps\/.*\/(shutdown|boot)/.test(url)) {
      return mockResponse({ success: true });
    }
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", mockFetch);
}

function renderComponent(
  instanceId = "vps-001",
  instanceLabel = "TestVPS",
  instanceStatus = "stopped",
  totalDiskAllocation?: number,
) {
  return renderWithAuth(
    <MemoryRouter>
      <VPSDisksTab
        instanceId={instanceId}
        instanceLabel={instanceLabel}
        instanceStatus={instanceStatus}
        totalDiskAllocation={totalDiskAllocation}
      />
    </MemoryRouter>,
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
        new Response("Server error", { status: 500, headers: { "Content-Type": "text/plain" } }),
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

    it("renders Resize, Password, and Delete buttons for ext4 disk", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /resize/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /password/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("does not render Password button for swap disks", async () => {
      setupFetchMock({ disks: [mockSwapDisk] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("512 MB Swap")).toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: /password/i })).not.toBeInTheDocument();
    });

    it("displays section header with instance label", async () => {
      setupFetchMock({ disks: [] });

      renderComponent("vps-001", "MyServer-Production");

      await waitFor(() => {
        expect(screen.getByText(/myserver-production/i)).toBeInTheDocument();
      });
    });
  });

  describe("Storage allocation display", () => {
    it("shows allocation info when totalDiskAllocation is provided", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent("vps-001", "TestVPS", "stopped", 81920);

      await waitFor(() => {
        expect(screen.getByText(/total:/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/unallocated:/i)).toBeInTheDocument();
    });

    it("shows Create Disk button when unallocated space exists", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent("vps-001", "TestVPS", "stopped", 81920);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /create disk/i })).toBeInTheDocument();
      });
    });

    it("disables Create Disk when no unallocated space", async () => {
      setupFetchMock({ disks: [...mockDisks, { ...mockDisks[0], id: 2, size: 30720 }] });

      renderComponent("vps-001", "TestVPS", "stopped", 81920);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /create disk/i })).toBeDisabled();
      });
    });
  });

  describe("Delete action", () => {
    it("shows confirmation dialog and deletes on confirm", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText(/delete disk/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Disk "Ubuntu 22.04 LTS" deleted');
      });
    });
  });
});
