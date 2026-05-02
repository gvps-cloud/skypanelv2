import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoomlaTab from "./JoomlaTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
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

const defaultJoomlaUsers = [
  { id: "1", username: "admin", email: "admin@example.com", name: "Admin", blocked: false, superUser: true },
];

function setupApiMocks(joomlaUsers = defaultJoomlaUsers) {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path === "/hosting/joomla/sub-123/joomla") {
      return { installations: [{ id: "joomla-app", name: "Joomla (cms)", path: "cms", version: "5.1.0", status: "active" }] };
    }
    if (path.endsWith("/joomla/joomla-app/info")) {
      return { info: { version: "5.1.0", siteUrl: "https://site.example", pluginCount: 12, userCount: 1 } };
    }
    if (path.endsWith("/joomla/joomla-app/users")) {
      return { users: joomlaUsers };
    }
    throw new Error(`Unhandled GET ${path}`);
  });
  apiMocks.post.mockResolvedValue({ success: true });
  apiMocks.put.mockResolvedValue({ success: true });
  apiMocks.patch.mockResolvedValue({ success: true });
  apiMocks.delete.mockResolvedValue({ success: true });
}

describe("JoomlaTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("renders Joomla installation info and users after opening", async () => {
    const user = userEvent.setup();
    render(<JoomlaTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /joomla/i }));

    expect(await screen.findByText("v5.1.0")).toBeInTheDocument();
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("creates Joomla users with documented fields", async () => {
    const user = userEvent.setup();
    render(<JoomlaTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /joomla/i }));
    await screen.findByText("admin@example.com");
    await user.click(screen.getByRole("button", { name: /add user/i }));

    const dialog = await screen.findByRole("dialog", { name: /create joomla user/i });
    await user.type(within(dialog).getByPlaceholderText("admin"), "testing");
    await user.type(within(dialog).getByPlaceholderText("user@example.com"), "test@gvps.cloud");
    await user.type(within(dialog).getByPlaceholderText("Password"), "Password123!");

    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/joomla/sub-123/joomla/joomla-app/users", {
        username: "testing",
        email: "test@gvps.cloud",
        password: "Password123!",
      });
    });
  });

  it("edits Joomla users by PATCH with documented fields", async () => {
    const user = userEvent.setup();
    render(<JoomlaTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /joomla/i }));
    await screen.findByText("admin@example.com");
    await user.click(screen.getByRole("button", { name: /edit joomla user/i }));

    const dialog = await screen.findByRole("dialog", { name: /edit joomla user/i });
    const nameInput = within(dialog).getByLabelText(/^username$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "site-admin");

    const emailInput = within(dialog).getByLabelText(/^email$/i);
    await user.clear(emailInput);
    await user.type(emailInput, "site-admin@example.com");

    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith(
        "/hosting/joomla/sub-123/joomla/joomla-app/users/admin",
        { username: "site-admin", email: "site-admin@example.com" },
      );
    });
  });

  it("deletes Joomla users with documented endpoint", async () => {
    const user = userEvent.setup();
    render(<JoomlaTab subscriptionId="sub-123" />);

    vi.stubGlobal("confirm", () => true);

    await user.click(await screen.findByRole("button", { name: /joomla/i }));
    await screen.findByText("admin@example.com");

    const deleteButton = screen.getByRole("button", { name: /delete joomla user/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(apiMocks.delete).toHaveBeenCalledWith("/hosting/joomla/sub-123/joomla/joomla-app/users/admin");
    });
  });
});
