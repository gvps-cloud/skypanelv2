import type { Request } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../config/index.js";
import {
  generateRateLimitKey,
  getUserType,
  isDashboardEndpoint,
} from "./rateLimiting.js";

function requestWithCookieToken(token: string): Request {
  return {
    headers: {},
    cookies: { auth_token: token },
    query: {},
    ip: "198.51.100.10",
    socket: { remoteAddress: "198.51.100.10" },
  } as unknown as Request;
}

describe("rate limiting auth classification", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "rate-limit-test-secret";
  });

  it("classifies HttpOnly cookie JWT users as authenticated", () => {
    const token = jwt.sign(
      { userId: "11111111-1111-4111-8111-111111111111", role: "user" },
      config.JWT_SECRET,
    );

    const req = requestWithCookieToken(token);

    expect(getUserType(req)).toBe("authenticated");
    expect(generateRateLimitKey(req, "authenticated")).toBe(
      "authenticated:11111111-1111-4111-8111-111111111111",
    );
  });

  it("classifies HttpOnly cookie JWT admins as admin users", () => {
    const token = jwt.sign(
      { userId: "22222222-2222-4222-8222-222222222222", role: "admin" },
      config.JWT_SECRET,
    );

    expect(getUserType(requestWithCookieToken(token))).toBe("admin");
  });

  it("treats hosting and hosting wallet traffic as dashboard traffic", () => {
    expect(isDashboardEndpoint("/api/hosting/services")).toBe(true);
    expect(isDashboardEndpoint("/api/hosting/web/service-1/website")).toBe(true);
    expect(isDashboardEndpoint("/api/payments/wallet/hosting/balance")).toBe(true);
  });
});
