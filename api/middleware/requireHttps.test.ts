import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireHttps } from "./requireHttps.js";

function createResponseMock() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    send: vi.fn(),
  };

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res as unknown as Response;
}

function createRequestMock(overrides: Partial<Request> = {}) {
  const req = {
    secure: false,
    protocol: "http",
    method: "GET",
    headers: { host: "example.com" },
    originalUrl: "/",
    url: "/",
    hostname: "example.com",
    ...overrides,
  };

  return req as Request;
}

describe("requireHttps", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bypasses redirect for localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const middleware = requireHttps();
    const req = createRequestMock({
      headers: { host: "localhost:3001" },
      hostname: "localhost",
    });
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((res as any).status).not.toHaveBeenCalled();
  });

  it("redirects non-secure external requests in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const middleware = requireHttps();
    const req = createRequestMock({
      headers: { host: "example.com" },
      hostname: "example.com",
      originalUrl: "/dashboard",
      url: "/dashboard",
    });
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(301);
    expect((res as any).setHeader).toHaveBeenCalledWith(
      "Location",
      "https://example.com/dashboard",
    );
  });

  it("accepts secure requests in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const middleware = requireHttps();
    const req = createRequestMock({
      secure: true,
      protocol: "https",
      headers: { host: "example.com" },
      hostname: "example.com",
    });
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  });

  it("does not bypass redirect when only X-Forwarded-Host is localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    const middleware = requireHttps();
    const req = createRequestMock({
      headers: { host: "example.com", "x-forwarded-host": "localhost" },
      hostname: "example.com",
    });
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(301);
  });
});
