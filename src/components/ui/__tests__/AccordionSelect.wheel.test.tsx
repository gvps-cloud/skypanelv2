import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AccordionSelect } from "../AccordionSelect";

// Minimal groups with many items to enable scrolling
const groups = {
  test: {
    name: "Test Group",
    items: Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`,
      label: `Item ${i}`,
    })),
  },
};

it("mouse wheel scrolls the dropdown list", async () => {
  const handleSelect = vi.fn();
  render(
    <AccordionSelect
      groups={groups}
      selectedId=""
      onSelect={handleSelect}
      placeholder="Select..."
    />,
  );

  // Open the popover
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);

  // The scroll container is the element with max-h-80 class
  const scrollContainer = document.querySelector(".max-h-80");
  expect(scrollContainer).not.toBeNull();

  // Initial scrollTop should be 0
  const initialTop = (scrollContainer as HTMLElement).scrollTop;
  expect(initialTop).toBe(0);

  // Fire a wheel event (deltaY positive to scroll down)
  fireEvent.wheel(scrollContainer!, { deltaY: 100 });

  // After wheel, scrollTop should have increased (allow some tolerance)
  const afterTop = (scrollContainer as HTMLElement).scrollTop;
  expect(afterTop).toBeGreaterThan(initialTop);
});
