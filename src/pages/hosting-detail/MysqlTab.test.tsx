import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MysqlTab from "./MysqlTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
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

const databases = [
  {
    name: "thunderm1_test-database",
    size: 0,
    createdAt: null,
  },
];

const users = [
  {
    username: "thunderm1_test",
    accessHosts: ["85.239.231.165"],
    grants: {},
    authPlugin: null,
    createdAt: null,
  },
];

function setupApiMocks() {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/mysql-dbs")) return { databases };
    if (path.endsWith("/mysql-users")) return { users };
    throw new Error(`Unhandled GET ${path}`);
  });
  apiMocks.post.mockResolvedValue({ success: true });
  apiMocks.put.mockResolvedValue({ success: true });
  apiMocks.delete.mockResolvedValue({ success: true });
}

describe("MysqlTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("sends Enhance grant tokens when saving database access", async () => {
    const user = userEvent.setup();
    render(<MysqlTab subscriptionId="sub-123" />);

    await screen.findByText("thunderm1_test");
    await user.click(screen.getByTitle("Manage database access"));
    await user.click(screen.getByRole("button", { name: /save access/i }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith(
        "/hosting/mysql/sub-123/mysql-users/thunderm1_test/privileges",
        {
          dbName: "thunderm1_test-database",
          grants: ["all"],
        },
      );
    });
  });

  it("sends documented accessHosts body when adding an access host", async () => {
    const user = userEvent.setup();
    render(<MysqlTab subscriptionId="sub-123" />);

    await screen.findByText("thunderm1_test");
    await user.click(screen.getByTitle("Access hosts"));
    await user.type(screen.getByPlaceholderText(/192\.168\.1\.0\/24/), "203.0.113.10{Enter}");

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith(
        "/hosting/mysql/sub-123/mysql-users/thunderm1_test/access-hosts",
        { accessHosts: ["203.0.113.10"] },
      );
    });
  });

  it("sends documented accessHosts body when removing an access host", async () => {
    const user = userEvent.setup();
    render(<MysqlTab subscriptionId="sub-123" />);

    await screen.findByText("thunderm1_test");
    await user.click(screen.getByTitle("Access hosts"));
    await user.click(screen.getByLabelText("Remove access host 85.239.231.165"));

    await waitFor(() => {
      expect(apiMocks.delete).toHaveBeenCalledWith(
        "/hosting/mysql/sub-123/mysql-users/thunderm1_test/access-hosts",
        { accessHosts: ["85.239.231.165"] },
      );
    });
  });
});
