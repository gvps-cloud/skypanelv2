import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import RuntimeTab from "./RuntimeTab";

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

describe("RuntimeTab", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = vi.fn();
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = vi.fn();
    }
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.get.mockImplementation(async (path: string) => {
      if (path.endsWith("/persistent-apps")) return { items: [] };
      if (path.endsWith("/node/possible-versions")) return { versions: ["20.11.1", "22.0.0"] };
      if (path.endsWith("/node/versions")) return { versions: ["20.11.1"] };
      throw new Error(`Unhandled GET ${path}`);
    });
    apiMocks.post.mockResolvedValue({ success: true });
    apiMocks.put.mockResolvedValue({ success: true });
    apiMocks.delete.mockResolvedValue({ success: true });
  });

  it("creates persistent apps with the selected Enhance nodeVersion", async () => {
    const user = userEvent.setup();
    render(<RuntimeTab subscriptionId="sub-123" />);

    await screen.findByText("No persistent apps configured.");
    await user.click(screen.getByRole("button", { name: /new app/i }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Command"), "node server.js");
    await user.click(within(dialog).getAllByRole("combobox")[1]);
    await user.click(await screen.findByRole("option", { name: "20.11.1" }));
    await user.type(within(dialog).getByLabelText("Working Directory (optional)"), "/app");
    await user.type(within(dialog).getByLabelText("Proxy Path"), "/api");
    await user.type(within(dialog).getByLabelText("Proxy Port"), "3000");
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/node/sub-123/persistent-apps", {
        command: "node server.js",
        startMode: "automatic",
        nodeVersion: "20.11.1",
        workingDirectory: "/app",
        proxyDetails: { path: "/api", port: 3000 },
      });
    });
  });
});
