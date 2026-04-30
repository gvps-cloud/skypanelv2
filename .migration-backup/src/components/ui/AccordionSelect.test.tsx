import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccordionSelect } from "@/components/ui/AccordionSelect";

describe("AccordionSelect", () => {
  it("renders a capped scroll container with explicit wheel and touch scroll classes", async () => {
    render(
      <AccordionSelect
        groups={{
          linux: {
            name: "Linux",
            items: Array.from({ length: 12 }, (_, index) => ({
              id: `linux-${index + 1}`,
              label: `Linux ${index + 1}`,
              description: `Version ${index + 1}`,
            })),
          },
        }}
        selectedId=""
        onSelect={vi.fn()}
        placeholder="Select an item"
        searchPlaceholder="Search items..."
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    await screen.findByPlaceholderText("Search items...");

    const scrollContainer = document.querySelector(
      ".max-h-80",
    ) as HTMLElement | null;

    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer?.className).toContain("overflow-y-auto");
    expect(scrollContainer?.className).toContain("overflow-x-hidden");
    expect(scrollContainer?.className).toContain("overscroll-contain");
    expect(scrollContainer?.className).toContain("overscroll-y-contain");
    expect(scrollContainer?.className).toContain("touch-pan-y");
    expect(scrollContainer?.className).toContain("overscroll-behavior-y-contain");
    expect(scrollContainer?.className).toContain("touch-action-pan-y");
  });
});
