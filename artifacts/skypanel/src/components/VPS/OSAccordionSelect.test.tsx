import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OSAccordionSelect } from "@/components/VPS/OSAccordionSelect";

describe("OSAccordionSelect", () => {
  it("uses the shared capped scroll container for long operating system lists", async () => {
    render(
      <OSAccordionSelect
        images={Array.from({ length: 18 }, (_, index) => ({
          id: `linode/ubuntu${index + 1}`,
          label: `Ubuntu ${20 + index}.04 LTS`,
        }))}
        selectedImageId=""
        onImageSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    await screen.findByPlaceholderText("Search operating systems...");

    const scrollContainer = document.querySelector(
      ".max-h-80",
    ) as HTMLElement | null;

    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer?.className).toContain("max-h-80");
    expect(scrollContainer?.className).toContain("overflow-y-auto");
    expect(scrollContainer?.className).toContain("overscroll-contain");
    expect(scrollContainer?.className).toContain("touch-action-pan-y");
  });
});
