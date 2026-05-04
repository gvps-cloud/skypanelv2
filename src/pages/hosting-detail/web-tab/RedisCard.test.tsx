import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RedisCard from "./RedisCard";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
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

describe("RedisCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows documented Redis operations and disables controls when plan gated", async () => {
    apiMocks.get.mockResolvedValue({
      enabled: false,
      allowed: false,
      status: "not_in_plan",
      operations: [
        { method: "GET", operationId: "getWebsiteRedisState", enhancePath: "/v2/websites/{website_id}/redis" },
        { method: "PUT", operationId: "setWebsiteRedisState", enhancePath: "/v2/websites/{website_id}/redis" },
      ],
    });

    render(<RedisCard subscriptionId="sub-123" />);

    expect(await screen.findByText("Not included in this plan")).toBeInTheDocument();
    expect(screen.getByText("getWebsiteRedisState")).toBeInTheDocument();
    expect(screen.getByText("setWebsiteRedisState")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("toggles Redis through the documented hosting endpoint when available", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue({
      enabled: false,
      allowed: true,
      status: "available",
      operations: [],
    });
    apiMocks.put.mockResolvedValue({ enabled: true, allowed: true, status: "available", operations: [] });

    render(<RedisCard subscriptionId="sub-123" />);

    await screen.findByText("Disabled");
    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith("/hosting/web/sub-123/redis", { enabled: true });
    });
  });
});
