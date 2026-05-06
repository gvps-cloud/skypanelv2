import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TerminalPanel } from "@/components/terminal/TerminalPanel";

describe("TerminalPanel", () => {
  it("matches snapshot with tone and traffic", () => {
    const { container } = render(
      <TerminalPanel
        title="TEST PANEL"
        tone="alert"
        traffic={true}
        prompt="$"
        glow={true}
        bodyClassName="p-4"
      >
        <p>Body content</p>
      </TerminalPanel>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
