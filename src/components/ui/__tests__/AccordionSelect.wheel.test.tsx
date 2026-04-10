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

it("renders a scroll container for long dropdown lists", async () => {
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

  const containerElement = scrollContainer as HTMLElement;
  containerElement.scrollTop = 100;

  expect(containerElement.scrollTop).toBe(100);
});
