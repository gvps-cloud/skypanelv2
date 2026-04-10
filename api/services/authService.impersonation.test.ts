import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/database.js", () => ({
  query: queryMock,
  transaction: vi.fn(),
}));

import { config } from "../config/index.js";
import { AuthService } from "./authService.js";

describe("AuthService.refreshToken impersonation handling", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("preserves impersonation claims and expiration when refreshing an impersonation session", async () => {
    const exp = Math.floor(Date.now() / 1000) + 1800;

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            email: "john@example.com",
            role: "user",
            name: "John Doe",
            phone: null,
            timezone: null,
            preferences: {},
            two_factor_enabled: false,
            active_organization_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ organization_id: "org-1", role: "member" }],
      });

    const result = await AuthService.refreshToken("user-1", {
      isImpersonating: true,
      originalAdminId: "admin-1",
      exp,
    });

    const decoded = jwt.verify(result.token, config.JWT_SECRET) as jwt.JwtPayload;

    expect(decoded.userId).toBe("user-1");
    expect(decoded.email).toBe("john@example.com");
    expect(decoded.role).toBe("user");
    expect(decoded.isImpersonating).toBe(true);
    expect(decoded.originalAdminId).toBe("admin-1");
    expect(decoded.exp).toBe(exp);
    expect(result.user.organizationId).toBe("org-1");
  });

  it("keeps standard refresh tokens free of impersonation claims", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-1",
            email: "admin@example.com",
            role: "admin",
            name: "Admin User",
            phone: null,
            timezone: null,
            preferences: {},
            two_factor_enabled: false,
            active_organization_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ organization_id: "org-admin", role: "owner" }],
      });

    const result = await AuthService.refreshToken("admin-1");
    const decoded = jwt.verify(result.token, config.JWT_SECRET) as jwt.JwtPayload;

    expect(decoded.isImpersonating).toBeUndefined();
    expect(decoded.originalAdminId).toBeUndefined();
    expect(decoded.userId).toBe("admin-1");
  });
});
