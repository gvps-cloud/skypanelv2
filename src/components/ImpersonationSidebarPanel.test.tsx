import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ImpersonationSidebarPanel } from "@/components/ImpersonationSidebarPanel";
import { SidebarProvider } from "@/components/ui/sidebar";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

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
      <SidebarProvider>
        <ImpersonationSidebarPanel
          impersonatedUser={impersonatedUser}
          onExitImpersonation={onExitImpersonation}
        />
      </SidebarProvider>,
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
      <SidebarProvider>
        <ImpersonationSidebarPanel
          impersonatedUser={impersonatedUser}
          onExitImpersonation={onExitImpersonation}
          collapsed
        />
      </SidebarProvider>,
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
      <SidebarProvider>
        <ImpersonationSidebarPanel
          impersonatedUser={impersonatedUser}
          onExitImpersonation={vi.fn()}
          collapsed
          mobile
        />
      </SidebarProvider>,
    );

    expect(screen.getByText("Admin Mode")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Exit Impersonation" }),
    ).toBeTruthy();
  });
});
