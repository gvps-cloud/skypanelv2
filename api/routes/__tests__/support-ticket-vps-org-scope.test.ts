import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = {
      id: "user-1",
      organizationId: "org-aaa",
      role: "user",
    };
    next();
  },
  requireOrganization: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../services/roles.js", () => ({
  RoleService: {
    checkPermission: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../middleware/rateLimiting.js", () => ({
  createCustomRateLimiter: () => (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

import supportRouter from "../support.js";

describe("POST /support/tickets VPS snapshot", () => {
  const vpsId = "11111111-1111-4111-8111-111111111111";
  const orgId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/support", supportRouter);
    return app;
  }

  it("queries vps_instances with organization_id bound param", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "admin-1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "ticket-1",
            subject: "Need help",
            organization_id: orgId,
          },
        ],
      });

    const res = await request(buildApp())
      .post("/support/tickets")
      .send({
        subject: "Need help please",
        message: "This is my message with enough chars",
        priority: "low",
        category: "general",
        vpsId,
        organizationId: orgId,
      });

    expect(res.status).toBe(201);

    const vpsCall = mockQuery.mock.calls.find(
      (c) =>
        String(c[0]).includes("vps_instances") &&
        String(c[0]).includes("organization_id"),
    );
    expect(vpsCall).toBeDefined();
    expect(vpsCall![1]).toEqual([vpsId, orgId]);
  });
});
