import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchableOptionSelect } from "@/components/VPS/SearchableOptionSelect";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

describe("SearchableOptionSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a dedicated scrollable command list inside the popover", async () => {
    render(
      <SearchableOptionSelect
        value=""
        options={Array.from({ length: 12 }, (_, index) => ({
          value: `option-${index + 1}`,
          label: `Option ${index + 1}`,
          description: `Description ${index + 1}`,
        }))}
        onChange={vi.fn()}
        placeholder="Choose an option"
        searchPlaceholder="Search options"
        emptyMessage="No options"
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");

    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("overscroll-contain");
    expect(list.className).toContain("touch-pan-y");
    expect(list.className).toContain("max-h-[min(20rem,calc(100vh-12rem))]");
  });

  it("selects an option and closes the popover", async () => {
    const handleChange = vi.fn();

    render(
      <SearchableOptionSelect
        value=""
        options={[
          { value: "standard", label: "Standard VPS", description: "Shared CPU" },
          { value: "premium", label: "Premium Performance", description: "Dedicated CPU" },
        ]}
        onChange={handleChange}
        placeholder="Choose a category"
        searchPlaceholder="Search categories"
        emptyMessage="No categories"
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Premium Performance"));

    expect(handleChange).toHaveBeenCalledWith("premium");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });
});
