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
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
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
  {
    id: 2,
    label: "Data Volume",
    status: "ready",
    size: 102400,
    filesystem: "xfs",
    created: "2026-01-02T00:00:00Z",
    updated: "2026-01-02T00:00:00Z",
  },
];

function mockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setupFetchMock(data: unknown) {
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
      return mockResponse({ disk: { id: 3, label: "Disk 1-clone" } });
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

    it("shows retry button on error", async () => {
      mockFetch.mockResolvedValue(
        new Response("Server error", { status: 500, headers: { "Content-Type": "text/plain" } })
      );
      vi.stubGlobal("fetch", mockFetch);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe("Disk list rendering", () => {
    it("renders disk list with multiple disks", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
        expect(screen.getByText("Data Volume")).toBeInTheDocument();
      });
    });

    it("renders action buttons for each disk", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const resizeButtons = screen.getAllByRole("button", { name: /resize/i });
      const cloneButtons = screen.getAllByRole("button", { name: /clone/i });
      const passwordButtons = screen.getAllByRole("button", { name: /password/i });
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

      expect(resizeButtons).toHaveLength(2);
      expect(cloneButtons).toHaveLength(2);
      expect(passwordButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });

    it("displays disk size in GB", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("50.0 GB")).toBeInTheDocument();
        expect(screen.getByText("100.0 GB")).toBeInTheDocument();
      });
    });

    it("displays section header with instance label", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent("vps-001", "MyServer-Production");

      await waitFor(() => {
        expect(screen.getByText(/myserver-production/i)).toBeInTheDocument();
      });
    });

    it("renders empty state when no disks", async () => {
      setupFetchMock({ disks: [] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no disks found/i)).toBeInTheDocument();
      });
    });
  });

  describe("apiClient calls", () => {
    it("calls apiClient.get to fetch disks", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/vps/vps-001/disks"),
          expect.objectContaining({ method: "GET" })
        );
      });
    });

    it("calls apiClient.delete when deleting a disk", async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          return mockResponse({ disks: mockDisks });
        }
        if (method === "DELETE" && /\/vps\/.*\/disks\/\d+$/.test(url)) {
          return mockResponse({ success: true });
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("confirm", () => true);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const deleteBtn = screen.getAllByRole("button", { name: /delete/i })[0];
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/vps/vps-001/disks/1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    it("calls apiClient.post to resize a disk", async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          return mockResponse({ disks: mockDisks });
        }
        if (method === "POST" && /\/vps\/.*\/disks\/\d+\/resize/.test(url)) {
          return mockResponse({ success: true });
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("prompt", () => "60000");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const resizeBtn = screen.getAllByRole("button", { name: /resize/i })[0];
      await userEvent.click(resizeBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/vps/vps-001/disks/1/resize"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    it("calls apiClient.post to clone a disk", async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          return mockResponse({ disks: mockDisks });
        }
        if (method === "POST" && /\/vps\/.*\/disks\/\d+\/clone/.test(url)) {
          return mockResponse({ disk: { id: 3, label: "Disk 1-clone" } });
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("confirm", () => true);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const cloneBtn = screen.getAllByRole("button", { name: /clone/i })[0];
      await userEvent.click(cloneBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/vps/vps-001/disks/1/clone"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });

  describe("Disk actions", () => {
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

      const deleteBtn = screen.getAllByRole("button", { name: /delete/i })[0];
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Delete failed");
      });
    });

    it("shows success toast when clone succeeds", async () => {
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          return mockResponse({ disks: mockDisks });
        }
        if (method === "POST" && /\/vps\/.*\/disks\/\d+\/clone/.test(url)) {
          return mockResponse({ disk: { id: 3, label: "Disk 1-clone" } });
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("confirm", () => true);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const cloneBtn = screen.getAllByRole("button", { name: /clone/i })[0];
      await userEvent.click(cloneBtn);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Disk "Ubuntu 22.04 LTS" cloned');
      });
    });

    it("reloads disks after successful delete", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method || "GET";
        if (method === "GET" && /\/vps\/.*\/disks/.test(url)) {
          callCount++;
          return mockResponse({ disks: mockDisks });
        }
        if (method === "DELETE") {
          return mockResponse({ success: true });
        }
        throw new Error(`Unhandled: ${method} ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.stubGlobal("confirm", () => true);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const initialCalls = callCount;

      const deleteBtn = screen.getAllByRole("button", { name: /delete/i })[0];
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(callCount).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe("Refresh button", () => {
    it("has a refresh button that reloads disks", async () => {
      setupFetchMock({ disks: mockDisks });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Ubuntu 22.04 LTS")).toBeInTheDocument();
      });

      const refreshBtn = screen.getByRole("button", { name: /refresh/i });
      expect(refreshBtn).toBeInTheDocument();
    });
  });
});
