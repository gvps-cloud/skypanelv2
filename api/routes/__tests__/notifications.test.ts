import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import notificationsRouter from "../notifications.js";

const mockQuery = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
}));

vi.mock("../../services/notificationService.js", () => ({
  notificationService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../../services/tokenBlacklistService.js", () => ({
  tokenBlacklistService: {
    isRevoked: vi.fn().mockResolvedValue(false),
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
  app.use("/notifications", notificationsRouter);
  return app;
}

const mockNotifications = [
  {
    id: "notif-001",
    user_id: "00000000-0000-0000-0000-000000000001",
    organization_id: "org-uuid-001",
    event_type: "vps.boot",
    message: "VPS booted successfully",
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "notif-002",
    user_id: "00000000-0000-0000-0000-000000000001",
    organization_id: "org-uuid-001",
    event_type: "vps.shutdown",
    message: "VPS shutdown initiated",
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

describe("Notifications Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /notifications", () => {
    it("returns only user's org notifications", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockNotifications })
        .mockResolvedValueOnce({ rows: [{ total: 2 }] });

      const app = createApp();
      const res = await request(app).get("/notifications/");

      expect(res.status).toBe(200);
      expect(res.body.notifications).toEqual(mockNotifications);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);

      const orgScopeCall = mockQuery.mock.calls.find(
        (call) => call[0].includes("organization_id")
      );
      expect(orgScopeCall).toBeDefined();
    });

    it("returns empty array when no notifications", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] });

      const app = createApp();
      const res = await request(app).get("/notifications/");

      expect(res.status).toBe(200);
      expect(res.body.notifications).toEqual([]);
    });

    it("returns 403 when user has no organization", async () => {
      const app = createApp({ organizationId: undefined });
      const res = await request(app).get("/notifications/");

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/organization membership required/i);
    });
  });

  describe("PATCH /:id/read", () => {
    it("marks notification as read for user's org", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "notif-001" }] })
        .mockResolvedValueOnce({ rows: [{ success: true }] });

      const app = createApp();
      const res = await request(app).patch("/notifications/notif-001/read");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/marked as read/i);
    });

    it("returns 404 when marking another org's notification as read", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp();
      const res = await request(app).patch("/notifications/notif-other-org/read");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 404 when notification not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp();
      const res = await request(app).patch("/notifications/nonexistent/read");

      expect(res.status).toBe(404);
    });

    it("returns 403 when user has no organization", async () => {
      const app = createApp({ organizationId: undefined });
      const res = await request(app).patch("/notifications/notif-001/read");

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /read-all", () => {
    it("marks all notifications as read for user's org", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });

      const app = createApp();
      const res = await request(app).patch("/notifications/read-all");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);
    });
  });

  describe("GET /unread", () => {
    it("returns only unread notifications for user's org", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNotifications[0]] });

      const app = createApp();
      const res = await request(app).get("/notifications/unread");

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].is_read).toBe(false);
    });
  });

  describe("GET /unread-count", () => {
    it("returns unread notification count", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "5" }] });

      const app = createApp();
      const res = await request(app).get("/notifications/unread-count");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(5);
    });
  });
});