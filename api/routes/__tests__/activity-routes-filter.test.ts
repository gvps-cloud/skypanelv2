import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import activityRouter from "../activity.js";
import adminActivityRouter from "../admin/activity.js";

const mockQuery = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  requireAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../services/activityLogger.js", () => ({
  ensureActivityLogsTable: vi.fn().mockResolvedValue(undefined),
}));

describe("Activity routes — hosting / entity aliases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: "0" }] })
      .mockResolvedValueOnce({ rows: [] });
  });

  function customerApp(): Express {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { user?: Record<string, unknown> }).user = {
        id: "00000000-0000-4000-8000-000000000001",
        organizationId: "00000000-0000-4000-8000-0000000000aa",
        role: "user",
      };
      next();
    });
    app.use("/activity", activityRouter);
    return app;
  }

  it("GET /activity expands type=hosting into subscription, wallet, and hosting.* event patterns", async () => {
    const res = await request(customerApp()).get("/activity").query({ type: "hosting" });

    expect(res.status).toBe(200);
    const countCall = mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"));
    expect(countCall).toBeDefined();
    const sql = String(countCall![0]);
    expect(sql).toContain("hosting_subscription");
    expect(sql).toContain("hosting_wallet");
    expect(sql).toMatch(/event_type LIKE \$2.*event_type LIKE \$3/s);
    const countParams = countCall![1] as unknown[];
    expect(countParams).toContain("hosting.%");
    expect(countParams).toContain("billing.hosting_wallet.%");
  });

  it("GET /activity passes exact entity_type when type is not an alias", async () => {
    await request(customerApp()).get("/activity").query({ type: "billing_transaction" });

    const countCall = mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"));
    expect(countCall).toBeDefined();
    expect(String(countCall![0])).toMatch(/entity_type\s*=\s*\$2/);
    expect(countCall![1]).toContain("billing_transaction");
  });

  it("GET /activity adds event_type filter when requested", async () => {
    await request(customerApp()).get("/activity").query({
      type: "hosting",
      event_type: "hosting.purchase.completed",
    });

    const countSql = String(
      mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"))![0],
    );
    expect(countSql).toContain("event_type = ");
    const countParams = mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"))![
      1
    ] as unknown[];
    expect(countParams).toContain("hosting.purchase.completed");
  });

  function adminApp(): Express {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { user?: Record<string, unknown> }).user = {
        id: "00000000-0000-4000-8000-000000000010",
        role: "admin",
      };
      next();
    });
    app.use("/admin/activity", adminActivityRouter);
    return app;
  }

  it("GET /admin/activity expands entity_type=hosting like customer type=hosting", async () => {
    const res = await request(adminApp()).get("/admin/activity").query({
      entity_type: "hosting",
    });

    expect(res.status).toBe(200);
    const countSql = String(
      mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"))![0],
    );
    expect(countSql).toContain("hosting_subscription");
    const adminCountCall = mockQuery.mock.calls.find((c) => String(c[0]).includes("COUNT(*)"))!;
    const adminParams = adminCountCall[1] as unknown[];
    expect(adminParams).toContain("hosting.%");
    expect(adminParams).toContain("billing.hosting_wallet.%");
  });
});
