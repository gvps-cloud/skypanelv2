import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BootSequence } from "@/components/fx/BootSequence";

vi.mock("@/components/fx/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => true,
}));

describe("BootSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches snapshot when reduced motion shows all lines", () => {
    const { container } = render(
      <BootSequence
        lines={[
          { text: "[0.0] line a", kind: "info" },
          { text: "[0.1] line b", kind: "ok" },
        ]}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
