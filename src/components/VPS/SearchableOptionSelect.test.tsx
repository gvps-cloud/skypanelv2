import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SearchableOptionSelect } from "./SearchableOptionSelect";

function SearchableOptionSelectHarness() {
  const [value, setValue] = useState("");

  return (
    <SearchableOptionSelect
      value={value}
      onChange={setValue}
      placeholder="Choose a plan"
      searchPlaceholder="Search plans by name, specs, or price..."
      emptyMessage="No matching plans"
      helperText="Shared selector used by category and plan steps."
      ariaLabel="Plan selector"
      options={[
        {
          value: "plan-us-east",
          label: "Shared 2 GB",
          description: "2 GB RAM • 1 CPU",
          meta: "$12/mo",
          keywords: ["newark", "east coast", "standard"],
        },
        {
          value: "plan-jp",
          label: "Dedicated 8 GB",
          description: "8 GB RAM • 4 CPU",
          meta: "$48/mo",
          keywords: ["tokyo", "premium"],
        },
      ]}
    />
  );
}

describe("SearchableOptionSelect", () => {
  it("filters by descriptive keywords and updates the selected value", async () => {
    const user = userEvent.setup();

    render(<SearchableOptionSelectHarness />);

    await user.click(screen.getByRole("combobox", { name: /plan selector/i }));
    await user.type(
      screen.getByPlaceholderText(/search plans by name, specs, or price/i),
      "east coast",
    );

    expect(screen.getByText("Shared 2 GB")).toBeInTheDocument();
    expect(screen.queryByText("Dedicated 8 GB")).not.toBeInTheDocument();

    await user.click(screen.getByText("Shared 2 GB"));

    expect(
      screen.getByRole("combobox", { name: /plan selector/i }),
    ).toHaveTextContent("Shared 2 GB");
    expect(
      screen.getByText(/shared selector used by category and plan steps/i),
    ).toBeInTheDocument();
  });
});