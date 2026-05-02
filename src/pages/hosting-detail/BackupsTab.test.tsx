import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupsTab from "./BackupsTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getBlob: vi.fn(),
  postBinary: vi.fn(),
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

const backups = [
  {
    id: "42",
    startedAt: "2026-05-02T10:00:00Z",
    finishedAt: "2026-05-02T10:05:00Z",
    displayDate: "2026-05-02T10:00:00Z",
    displayStatus: "successful",
    canRestore: true,
    size: 10000,
    homeDirStatus: "successful",
    mysqlDbsStatus: "successful",
    emailsStatus: "failed",
    kind: "manual",
    storageKind: "enhance",
    components: {
      files: { status: "successful", size: 1048576 },
      databases: { status: "successful", size: 524288, count: 1 },
      emails: { status: "failed", size: 262144, count: 0 },
    },
  },
];

function setupApiMocks() {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/backups")) return { backups };
    if (path.endsWith("/backups-disabled")) return { disabled: false };
    if (path.endsWith("/backup-status")) return { status: null };
    if (path.endsWith("/restore-status")) return { status: null };
    if (path.includes("/directory-tree")) return { nodes: [] };
    if (path.includes("/backups/42")) return { backup: backups[0] };
    throw new Error(`Unhandled GET ${path}`);
  });
  apiMocks.post.mockResolvedValue({ id: "43" });
  apiMocks.put.mockResolvedValue({ success: true });
  apiMocks.delete.mockResolvedValue({ success: true });
  apiMocks.postBinary.mockResolvedValue({ success: true });
}

describe("BackupsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("renders normalized Enhance backup metadata instead of unknown values", async () => {
    render(<BackupsTab subscriptionId="sub-123" />);

    expect(await screen.findByText("Successful")).toBeInTheDocument();
    expect(screen.getByText("1.75 MB")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
    expect(screen.getByText("enhance")).toBeInTheDocument();
    expect(screen.getByText(/Email: Failed/i)).toBeInTheDocument();
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
  });

  it("creates a manual backup with description and email inclusion", async () => {
    const user = userEvent.setup();
    render(<BackupsTab subscriptionId="sub-123" />);

    await screen.findByText("Successful");
    await user.click(screen.getByRole("button", { name: /backup now/i }));
    await user.type(screen.getByLabelText(/description/i), "Before plugin update");
    await user.click(screen.getByRole("checkbox", { name: /include email data/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /create backup/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/backups/sub-123/backups", {
        description: "Before plugin update",
        includeEmails: true,
      });
    });
  });

  it("restores a backup with documented restore options", async () => {
    const user = userEvent.setup();
    render(<BackupsTab subscriptionId="sub-123" />);

    await screen.findByText("Successful");
    await user.click(screen.getByRole("button", { name: /restore/i }));
    await user.selectOptions(screen.getByLabelText("Databases"), "none");
    await user.selectOptions(screen.getByLabelText("Email"), "all");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^restore$/i }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith(
        "/hosting/backups/sub-123/backups/42?storageKind=enhance",
        {
          restoreFiles: true,
          includeEmails: true,
          restoreDatabases: [],
          restoreAllEmails: true,
        },
      );
    });
  });

  it("uploads a gzip backup archive for restore", async () => {
    const user = userEvent.setup();
    const bytes = new Uint8Array([31, 139, 8]);
    const file = new File([bytes], "backup.tar.gz", { type: "application/gzip" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => bytes.buffer,
    });

    render(<BackupsTab subscriptionId="sub-123" />);

    await screen.findByText("Successful");
    await user.click(screen.getByRole("button", { name: /^upload$/i }));
    await user.upload(screen.getByLabelText("Archive file"), file);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^upload$/i }));

    await waitFor(() => {
      expect(apiMocks.postBinary).toHaveBeenCalledWith(
        "/hosting/backups/sub-123/backup/upload",
        bytes.buffer,
        "application/gzip",
      );
    });
  });
});
