import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function AuthConsumer() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div>loading</div>;
  }

  return (
    <div>
      <div>{user?.email ?? "no-user"}</div>
      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </div>
  );
}

describe("AuthProvider logout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears local auth state before the logout request resolves", async () => {
    const logoutResponse = deferred<Response>();
    const restoredUser = {
      id: "user-1",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      emailVerified: true,
      organizationId: "org-1",
    };

    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.endsWith("/api/auth/me")) {
          return Promise.resolve(
            new Response(JSON.stringify({ user: restoredUser }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
          return logoutResponse.promise;
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      },
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("john@example.com")).toBeTruthy();
    expect(sessionStorage.getItem("skypanel_org_id")).toBe("org-1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByText("no-user")).toBeTruthy();
    });

    expect(sessionStorage.getItem("skypanel_org_id")).toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/logout"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });

    logoutResponse.resolve(
      new Response(JSON.stringify({ message: "Logout successful" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
