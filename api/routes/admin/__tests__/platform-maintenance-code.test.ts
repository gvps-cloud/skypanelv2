import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyPasswordMock = vi.fn();

vi.mock("../../../services/authService.js", () => ({
  AuthService: {
    verifyPassword: (...args: unknown[]) => verifyPasswordMock(...args),
  },
}));

vi.mock("../../../config/index.js", () => ({
  config: {
    MAINTENANCE_CODE: "secret-bypass-xyz",
  },
}));

vi.mock("../../../middleware/rateLimiting.js", () => ({
  maintenanceBypassCodeRevealRateLimiter: (
    _req: Request,
    _res: Response,
    next: NextFunction,
  ) => next(),
  adminMutationRateLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

vi.mock("../../../middleware/security.js", () => ({
  adminSecurityHeaders: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
  requestSizeLimit: () => (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

vi.mock("../../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as express.Request & { user?: { id: string } }).user = {
      id: "admin-1",
      organizationId: null,
      role: "admin",
    } as any;
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import platformRouter from "../platform.js";

describe("POST /platform/maintenance/code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/platform", platformRouter);
    return app;
  }

  it("returns 400 without password", async () => {
    const res = await request(buildApp()).post("/platform/maintenance/code").send({});
    expect(res.status).toBe(400);
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 401 when password invalid", async () => {
    verifyPasswordMock.mockResolvedValueOnce(false);
    const res = await request(buildApp())
      .post("/platform/maintenance/code")
      .send({ password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns configured code when password valid", async () => {
    verifyPasswordMock.mockResolvedValueOnce(true);
    const res = await request(buildApp())
      .post("/platform/maintenance/code")
      .send({ password: "ok" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      configured: true,
      code: "secret-bypass-xyz",
    });
  });
});
