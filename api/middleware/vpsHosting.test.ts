import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockIsEffectivelyEnabled = vi.hoisted(() => vi.fn());

vi.mock("../services/linodeToggle.js", () => ({
  LinodeToggleService: {
    isEffectivelyEnabled: mockIsEffectivelyEnabled,
  },
}));

import { requireVpsEnabledForUsers } from "./vpsHosting.js";

function mockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe("requireVpsEnabledForUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 for non-admin when VPS is disabled", async () => {
    mockIsEffectivelyEnabled.mockResolvedValue(false);
    const req = { user: { role: "user" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireVpsEnabledForUsers(req, res, next);

    expect((res as any).status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for admin when VPS is disabled", async () => {
    mockIsEffectivelyEnabled.mockResolvedValue(false);
    const req = { user: { role: "admin" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireVpsEnabledForUsers(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("calls next for regular user when VPS is enabled", async () => {
    mockIsEffectivelyEnabled.mockResolvedValue(true);
    const req = { user: { role: "user" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireVpsEnabledForUsers(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
