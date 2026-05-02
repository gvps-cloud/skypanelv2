import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FtpTab from "./FtpTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
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

describe("FtpTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.get.mockResolvedValue({ users: [] });
    apiMocks.post.mockResolvedValue({ success: true });
    apiMocks.patch.mockResolvedValue({ success: true });
    apiMocks.delete.mockResolvedValue({ success: true });
  });

  it("creates FTP users with Enhance-compatible local account and relative homeDir", async () => {
    const user = userEvent.setup();
    render(<FtpTab subscriptionId="sub-123" />);

    await screen.findByText("No FTP users found.");
    await user.click(screen.getByRole("button", { name: /create user/i }));
    await user.type(screen.getByLabelText("Account"), "test22@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.type(screen.getByLabelText("Home Directory"), "/dasda");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/ftp/sub-123/ftp-users?createHome=true", {
        account: "test22",
        password: "Password123!",
        homeDir: "dasda",
      });
    });
  });
});
