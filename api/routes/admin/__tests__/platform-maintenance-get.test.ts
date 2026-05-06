import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../services/platformSettingsService.js", () => ({
  getPlatformSetting: vi.fn().mockResolvedValue({
    enabled: true,
    messageHtml: "<p>We will be back soon</p>",
  }),
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

describe("GET /platform/maintenance", () => {
  it("never exposes raw MAINTENANCE_CODE or code field", async () => {
    const app = express();
    app.use(express.json());
    app.use("/platform", platformRouter);

    const res = await request(app).get("/platform/maintenance");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("code");
    expect(res.body).not.toHaveProperty("MAINTENANCE_CODE");
    expect(typeof res.body.bypassCodeConfigured).toBe("boolean");
    expect(res.body.maintenanceMode).toBe(true);
  });
});
