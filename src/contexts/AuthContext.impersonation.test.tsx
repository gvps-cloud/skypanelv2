import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  IMPERSONATION_ADMIN_STORAGE_KEY,
  IMPERSONATION_EXPIRES_AT_STORAGE_KEY,
  IMPERSONATION_TOKEN_STORAGE_KEY,
  IMPERSONATION_USER_STORAGE_KEY,
} from "@/lib/impersonationSession";

function createJwt(payload: Record<string, unknown>) {
  const base64Url = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/u, "");

  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(payload)}.signature`;
}

function AuthConsumer() {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return <div>loading</div>;
  }

  return (
    <div>
      {user?.email ?? "no-user"}|{String(isImpersonating)}
    </div>
  );
}

describe("AuthProvider impersonation bootstrap", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it("keeps impersonation active after the startup refresh call", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60 * 30;
    const impersonationToken = createJwt({
      userId: "user-1",
      email: "john@example.com",
      role: "user",
      isImpersonating: true,
      originalAdminId: "admin-1",
      exp,
    });

    const impersonatedUser = {
      id: "user-1",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      emailVerified: true,
      organizationId: "org-1",
    };

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, impersonationToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(impersonatedUser));
    localStorage.setItem(IMPERSONATION_TOKEN_STORAGE_KEY, impersonationToken);
    localStorage.setItem(IMPERSONATION_USER_STORAGE_KEY, JSON.stringify(impersonatedUser));
    localStorage.setItem(
      IMPERSONATION_ADMIN_STORAGE_KEY,
      JSON.stringify({
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin Example",
        role: "admin",
      }),
    );
    localStorage.setItem(
      IMPERSONATION_EXPIRES_AT_STORAGE_KEY,
      new Date(exp * 1000).toISOString(),
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: impersonationToken,
        user: impersonatedUser,
      }),
    }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(await screen.findByText("john@example.com|true")).toBeTruthy();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/refresh",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${impersonationToken}`,
          }),
        }),
      );
    });

    expect(localStorage.getItem(IMPERSONATION_TOKEN_STORAGE_KEY)).toBe(impersonationToken);
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(impersonationToken);
  });
});
