import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { NavUser } from "@/components/nav-user";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithAuth } from "@/test-utils";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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

describe("NavUser", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("waits for logout before navigating home", async () => {
    let resolveLogout!: () => void;
    const logout = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    const user = userEvent.setup();

    renderWithAuth(
      <MemoryRouter>
        <SidebarProvider>
          <NavUser
            user={{
              name: "Jane Doe",
              email: "jane@example.com",
              avatar: "",
              role: "user",
            }}
          />
        </SidebarProvider>
      </MemoryRouter>,
      { logout },
    );

    render(<div />);

    await user.click(screen.getByRole("button", { name: /jane@example.com/i }));
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();

    resolveLogout();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/");
    });
  });
});
