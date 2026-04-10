import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImpersonationSidebarPanel } from "@/components/ImpersonationSidebarPanel";

const impersonatedUser = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
};

describe("ImpersonationSidebarPanel", () => {
  it("renders the full footer card in expanded mode", async () => {
    const onExitImpersonation = vi.fn();
    const user = userEvent.setup();

    render(
      <ImpersonationSidebarPanel
        impersonatedUser={impersonatedUser}
        onExitImpersonation={onExitImpersonation}
      />,
    );

    expect(screen.getByText("Admin Mode")).toBeTruthy();
    expect(screen.getByText("John Doe")).toBeTruthy();
    expect(screen.getByText("john@example.com")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Exit Impersonation" }));
    expect(onExitImpersonation).toHaveBeenCalledTimes(1);
  });

  it("shows a compact trigger and popover in collapsed desktop mode", async () => {
    const onExitImpersonation = vi.fn();
    const user = userEvent.setup();

    render(
      <ImpersonationSidebarPanel
        impersonatedUser={impersonatedUser}
        onExitImpersonation={onExitImpersonation}
        collapsed
      />,
    );

    expect(screen.queryByText("Admin Mode")).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "Impersonation active. Acting as John Doe",
      }),
    );

    expect(await screen.findByText("Admin Mode")).toBeTruthy();
    expect(screen.getByText("John Doe")).toBeTruthy();
  });

  it("renders the full card on mobile even if the sidebar is collapsed", () => {
    render(
      <ImpersonationSidebarPanel
        impersonatedUser={impersonatedUser}
        onExitImpersonation={vi.fn()}
        collapsed
        mobile
      />,
    );

    expect(screen.getByText("Admin Mode")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Exit Impersonation" }),
    ).toBeTruthy();
  });
});
