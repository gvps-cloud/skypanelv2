import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WordPressTab from "./WordPressTab";

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

const defaultWordPressUsers: Array<Record<string, unknown>> = [
  { id: "7", username: "admin", email: "admin@example.com", displayName: "Site Admin" },
];

function setupApiMocks(wordPressUsers: Array<Record<string, unknown>> = defaultWordPressUsers) {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path === "/hosting/wordpress/sub-123/wordpress") {
      return { installations: [{ id: "wp-app", name: "WordPress", path: "", version: "0.0.0", status: "active" }] };
    }
    if (path.endsWith("/wordpress/wp-app/users")) {
      return { users: wordPressUsers };
    }
    if (path.endsWith("/wordpress/wp-app/settings")) {
      return { settings: { autoUpdateCore: "minor", loginAccess: [] } };
    }
    if (path.endsWith("/wordpress/wp-app/maintenance-mode")) {
      return { status: "deactivated" };
    }
    if (path.includes("/wordpress/wp-app/plugins")) {
      return {
        plugins: [
          { name: "akismet", title: "Akismet", version: "5.3", status: "inactive", update: "available", autoUpdate: "disabled" },
        ],
      };
    }
    if (path.includes("/wordpress/wp-app/themes")) {
      return { themes: [{ name: "twentytwentyfive", version: "1.4", status: "active", update: "none", autoUpdate: "off" }] };
    }
    if (path.endsWith("/wordpress/wp-app/version")) {
      return { version: "6.5.4" };
    }
    if (path.endsWith("/wordpress/wp-app/wp-config/WpDebugLog")) {
      return { WpDebugLog: false };
    }
    if (path.endsWith("/wordpress/wp-app/wp-config/WpDebugDisplay")) {
      return { WpDebugDisplay: false };
    }
    if (path.endsWith("/wordpress/wp-app/wp-config/WpDebug")) {
      return { WpDebug: false };
    }
    if (path.startsWith("/hosting/wordpress/catalog/plugins?")) {
      return {
        items: [
          {
            slug: "woocommerce",
            name: "WooCommerce",
            version: "9.0.0",
            author: "Automattic",
            activeInstalls: 5000000,
            shortDescription: "Build an online store.",
          },
        ],
        page: 1,
        pages: 1,
      };
    }
    if (path.startsWith("/hosting/wordpress/catalog/themes?")) {
      return {
        items: [{ slug: "astra", name: "Astra", version: "4.8.0", downloads: 1000000 }],
        page: 1,
        pages: 1,
      };
    }
    throw new Error(`Unhandled GET ${path}`);
  });
  apiMocks.post.mockResolvedValue({ success: true });
  apiMocks.put.mockResolvedValue({ success: true, status: "active" });
  apiMocks.patch.mockResolvedValue({ success: true });
  apiMocks.delete.mockResolvedValue({ success: true });
}

describe("WordPressTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("renders runtime version and WordPress users after opening an installation", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));

    expect(await screen.findByText("v6.5.4")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /role/i })).not.toBeInTheDocument();
    expect(screen.getByText("Akismet v5.3")).toBeInTheDocument();
  });

  it("does not render unsupported WordPress user roles returned by Enhance", async () => {
    setupApiMocks([{ id: "7", username: "admin", email: "admin@example.com", role: "administrator", displayName: "Site Admin" }]);
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));

    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /role/i })).not.toBeInTheDocument();
    expect(screen.queryByText("administrator")).not.toBeInTheDocument();
  });

  it("saves WordPress user edits via PATCH with documented fields", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByText("admin@example.com");
    await user.click(screen.getByRole("button", { name: /edit user/i }));

    const dialog = await screen.findByRole("dialog", { name: /edit wordpress user/i });
    const nameInput = within(dialog).getByLabelText(/^name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "New Display");

    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/users/7", {
        email: "admin@example.com",
        name: "New Display",
      });
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/users?refreshCache=true");
    });
  });

  it("creates WordPress users with the documented Enhance payload shape", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByText("admin@example.com");
    await user.click(screen.getByRole("button", { name: /add user/i }));

    const dialog = await screen.findByRole("dialog", { name: /create wordpress user/i });
    await user.clear(within(dialog).getByPlaceholderText("admin"));
    await user.type(within(dialog).getByPlaceholderText("admin"), "testing");
    await user.clear(within(dialog).getByPlaceholderText("user@example.com"));
    await user.type(within(dialog).getByPlaceholderText("user@example.com"), "test@gvps.cloud");
    await user.type(within(dialog).getByPlaceholderText("••••••••"), "Password123!");

    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/users", {
        login: "testing",
        name: "testing",
        email: "test@gvps.cloud",
        password: "Password123!",
      });
    });
  });

  it("installs a plugin from the visual catalog", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByText("Akismet v5.3");
    await user.click(within(screen.getByText("Plugins").closest("div")!.parentElement!).getByRole("button", { name: /install/i }));

    expect(await screen.findByText("WooCommerce")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getAllByRole("button", { name: /install/i })[0]);

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/plugins", {
        slug: "woocommerce",
      });
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/plugins?refreshCache=true");
    });
  });

  it("saves documented settings and refreshes details from Enhance", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByText("Akismet v5.3");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/settings", {
        autoUpdateCore: "minor",
        loginAccess: [],
      });
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/plugins?refreshCache=true");
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/themes?refreshCache=true");
    });
  });

  it("toggles WordPress WP_DEBUG wp-config flags through the documented API shape", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByRole("switch", { name: "WP_DEBUG" });
    await user.click(screen.getByRole("switch", { name: "WP_DEBUG" }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/wp-config", {
        WpDebug: true,
      });
    });
  });

  it("toggles WordPress maintenance mode with the documented endpoint", async () => {
    const user = userEvent.setup();
    render(<WordPressTab subscriptionId="sub-123" />);

    await user.click(await screen.findByRole("button", { name: /wordpress/i }));
    await screen.findByText("Maintenance mode");
    await user.click(screen.getAllByRole("switch")[0]);

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith(
        "/hosting/wordpress/sub-123/wordpress/wp-app/maintenance-mode",
        { enabled: true },
      );
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/plugins?refreshCache=true");
      expect(apiMocks.get).toHaveBeenCalledWith("/hosting/wordpress/sub-123/wordpress/wp-app/themes?refreshCache=true");
    });
  });
});
