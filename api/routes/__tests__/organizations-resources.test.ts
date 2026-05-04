import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import organizationsRouter from "../organizations.js";

const mockQuery = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

function createApp(userOverride?: Record<string, any>): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: "org-uuid-001",
      role: "user",
      ...userOverride,
    };
    next();
  });
  app.use("/organizations", organizationsRouter);
  return app;
}

describe("Organizations Resources Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all hosting subscriptions for an org and does not truncate to 5", async () => {
    const hostingRows = Array.from({ length: 7 }, (_, index) => ({
      id: `hs-${index + 1}`,
      organization_id: "org-uuid-001",
      domain: `example-${index + 1}.com`,
      status: "active",
      next_billing_at: `2026-0${index + 1}-01T00:00:00Z`,
      last_billed_at: `2026-0${index + 1}-01T00:00:00Z`,
      created_at: `2026-0${index + 1}-01T00:00:00Z`,
      plan_name: "Basic",
      price_monthly: 10,
    }));

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "org-uuid-001", name: "Acme Corp" }] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org-uuid-001", legacy_role: "owner" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: hostingRows })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get("/organizations/resources");

    expect(res.status).toBe(200);
    expect(res.body.resources).toHaveLength(1);
    expect(res.body.resources[0].hosting_subscriptions).toHaveLength(7);
    expect(mockQuery.mock.calls[5][0]).not.toContain("rn <= 5");
  });
});
