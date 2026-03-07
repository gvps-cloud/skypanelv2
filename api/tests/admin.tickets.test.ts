import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../app.js";
import { query } from "../lib/database.js";

vi.mock("../middleware/auth.js", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-id", role: "admin", organizationId: "org-id" };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireOrganization: (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/database.js", () => ({
  query: vi.fn(),
}));

vi.mock("../services/paypalService.js", () => ({
  PayPalService: {},
}));
vi.mock("../services/activityLogger.js", () => ({
  logActivity: vi.fn(),
}));
vi.mock("../services/billingCronService.js", () => ({
  BillingCronService: { start: vi.fn() },
}));
vi.mock("../services/rateLimitMetrics.js", () => ({
  initializeMetricsCollection: vi.fn(),
  startMetricsPersistence: vi.fn(),
  recordRateLimitEvent: vi.fn(),
}));

describe("Admin Tickets API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/admin/tickets includes creator object when user data exists", async () => {
    const mockQuery = query as any;

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "ticket-1",
          organization_id: "org-1",
          created_by: "user-1",
          subject: "Need help",
          message: "Server is unreachable",
          status: "open",
          priority: "high",
          category: "general",
          created_at: "2026-03-07T01:00:00.000Z",
          updated_at: "2026-03-07T01:10:00.000Z",
          creator_id: "user-1",
          creator_name: "Jane Customer",
          creator_email: "jane@example.com",
        },
      ],
    });

    const res = await request(app).get("/api/admin/tickets");

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0]).toMatchObject({
      id: "ticket-1",
      created_by: "user-1",
      subject: "Need help",
      status: "open",
      creator: {
        id: "user-1",
        name: "Jane Customer",
        email: "jane@example.com",
        displayName: "Jane Customer",
      },
    });
    expect(res.body.tickets[0].creator_id).toBeUndefined();
    expect(res.body.tickets[0].creator_name).toBeUndefined();
    expect(res.body.tickets[0].creator_email).toBeUndefined();
  });

  it("GET /api/admin/tickets falls back creator.displayName to created_by", async () => {
    const mockQuery = query as any;

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "ticket-2",
          organization_id: "org-2",
          created_by: "user-2",
          subject: "Billing question",
          message: "Please review my invoice",
          status: "open",
          priority: "medium",
          category: "billing",
          created_at: "2026-03-07T02:00:00.000Z",
          updated_at: "2026-03-07T02:05:00.000Z",
          creator_id: "user-2",
          creator_name: null,
          creator_email: null,
        },
      ],
    });

    const res = await request(app).get("/api/admin/tickets");

    expect(res.status).toBe(200);
    expect(res.body.tickets[0].creator).toEqual({
      id: "user-2",
      name: null,
      email: null,
      displayName: "user-2",
    });
    expect(res.body.tickets[0]).toMatchObject({
      id: "ticket-2",
      subject: "Billing question",
      status: "open",
      priority: "medium",
    });
  });
});
