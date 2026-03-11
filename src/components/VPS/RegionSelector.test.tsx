import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegionSelector } from "./RegionSelector";

const okJson = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

describe("RegionSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads searchable regions with image icons and fallback icons", async () => {
    const onSelect = vi.fn();

    vi.mocked(global.fetch).mockResolvedValue(
      okJson({
        regions: [
          {
            id: "us-east",
            label: "Newark, NJ",
            country: "United States",
            capabilities: ["Premium"],
            status: "ok",
          },
          {
            id: "mystery-1",
            label: "Mystery Region",
            country: "Atlantis",
            capabilities: ["Premium"],
            status: "ok",
          },
        ],
      }) as Response,
    );

    const user = userEvent.setup();

    render(
      <RegionSelector
        providerId="provider-1"
        selectedRegion=""
        onSelect={onSelect}
        token="mock-jwt-token"
        typeClass="premium"
        filterByCapabilities={["Premium"]}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /region selector/i }),
      ).toBeEnabled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/vps/providers/provider-1/regions?type_class=premium",
      expect.objectContaining({
        headers: { Authorization: "Bearer mock-jwt-token" },
      }),
    );

    await user.click(screen.getByRole("combobox", { name: /region selector/i }));

    expect(screen.getByAltText(/united states region icon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/atlantis region icon/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/search regions by city or country/i),
      "united states",
    );

    expect(screen.getByText("Newark, NJ")).toBeInTheDocument();
    expect(screen.queryByText("Mystery Region")).not.toBeInTheDocument();

    await user.click(screen.getByText("Newark, NJ"));

    expect(onSelect).toHaveBeenCalledWith("us-east");
  });
});