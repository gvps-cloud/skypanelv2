import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();
const mockListActiveRateLimitOverrides = vi.fn().mockResolvedValue([]);
const mockListActiveRateLimitIpRules = vi.fn().mockResolvedValue([]);

vi.mock("../../../middleware/auth.js", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = {
      id: "admin-1",
      organizationId: null,
      role: "admin",
    };
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/rateLimitOverrideService.js", () => ({
  listActiveRateLimitOverrides: (...args: unknown[]) =>
    mockListActiveRateLimitOverrides(...args),
  upsertRateLimitOverride: vi.fn().mockResolvedValue({ id: "override-1" }),
  deleteRateLimitOverride: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../services/rateLimitIpRuleService.js", () => ({
  listActiveRateLimitIpRules: (...args: unknown[]) =>
    mockListActiveRateLimitIpRules(...args),
  deleteRateLimitIpRule: vi.fn().mockResolvedValue(true),
  upsertRateLimitIpRule: vi
    .fn()
    .mockResolvedValue({ id: "rule-1", ipAddress: "1.2.3.4" }),
  getActiveRateLimitIpRule: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../lib/ipDetection.js", () => ({
  isValidIP: vi.fn().mockReturnValue(true),
  sanitizeIP: vi.fn((ip: string) => ip),
}));

import rateLimitsRouter from "../rateLimits.js";

describe("Admin rate-limits IP activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/", rateLimitsRouter);
    return app;
  }

  describe("GET /rate-limits/ip-activity", () => {
    it("returns aggregated IP activity with user details", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              ip: "192.168.1.1",
              first_seen: "2025-01-01T00:00:00Z",
              last_seen: "2025-01-01T12:00:00Z",
              total_events: 10,
              activity_count: 5,
              login_count: 3,
              failed_login_count: 1,
              fraud_check_count: 2,
              rate_limit_count: 0,
              event_types: ["vps.created", "login.success", "fraud_check"],
              last_user_agent: "Mozilla/5.0",
              user_ids: ["user-1"],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: "user-1", email: "test@example.com", name: "Test User" }],
        });

      const res = await request(buildApp()).get("/rate-limits/ip-activity");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ips).toHaveLength(1);
      expect(res.body.ips[0].ip).toBe("192.168.1.1");
      expect(res.body.ips[0].totalEvents).toBe(10);
      expect(res.body.ips[0].users).toHaveLength(1);
      expect(res.body.ips[0].users[0].email).toBe("test@example.com");
      expect(res.body.ips[0].users[0].name).toBe("Test User");
      expect(res.body.pagination.total).toBe(1);
    });

    it("clamps hours to max 168", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(buildApp()).get(
        "/rate-limits/ip-activity?hours=999",
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const sql = String(mockQuery.mock.calls[0][0]);
      expect(sql).toContain("168 hours");
    });

    it("supports IP substring search", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(buildApp()).get(
        "/rate-limits/ip-activity?q=192.168",
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ips).toEqual([]);
    });

    it("returns empty ips array when no activity", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(buildApp()).get("/rate-limits/ip-activity");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ips).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it("tags IPs with ip rule status", async () => {
      mockListActiveRateLimitIpRules.mockResolvedValueOnce([
        { ipAddress: "10.0.0.1", ruleType: "blocked" },
      ]);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              ip: "10.0.0.1",
              first_seen: "2025-01-01T00:00:00Z",
              last_seen: "2025-01-01T12:00:00Z",
              total_events: 5,
              activity_count: 5,
              login_count: 0,
              failed_login_count: 0,
              fraud_check_count: 0,
              rate_limit_count: 0,
              event_types: ["vps.created"],
              last_user_agent: null,
              user_ids: [],
            },
          ],
        });

      const res = await request(buildApp()).get("/rate-limits/ip-activity");

      expect(res.status).toBe(200);
      expect(res.body.ips).toHaveLength(1);
      expect(res.body.ips[0].ipRuleStatus).toBe("blocked");
    });
  });

  describe("GET /rate-limits/ip-activity/:ip/events", () => {
    it("returns events for a specific IP", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "evt-1",
              event_type: "vps.created",
              message: "Created VPS",
              status: "success",
              metadata: {},
              ip_address: "192.168.1.1",
              user_agent: "Mozilla/5.0",
              created_at: "2025-01-01T12:00:00Z",
              user_id: "user-1",
              user_email: "test@example.com",
              user_name: "Test User",
            },
          ],
        });

      const res = await request(buildApp()).get(
        "/rate-limits/ip-activity/192.168.1.1/events",
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].id).toBe("evt-1");
      expect(res.body.events[0].eventType).toBe("vps.created");
      expect(res.body.events[0].userEmail).toBe("test@example.com");
      expect(res.body.events[0].userName).toBe("Test User");
      expect(res.body.pagination.total).toBe(1);
    });

    it("returns empty events for IP with no activity", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(buildApp()).get(
        "/rate-limits/ip-activity/10.0.0.1/events",
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });
  });
});
