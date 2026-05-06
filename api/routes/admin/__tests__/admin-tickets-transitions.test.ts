import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../../middleware/auth.js", () => ({
  authenticateToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/tokenBlacklistService.js", () => ({
  tokenBlacklistService: {},
}));

vi.mock("../../../services/ticketNotificationService.js", () => ({
  ticketNotificationService: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

import ticketsAdminRouter from "../tickets.js";

describe("PATCH /tickets/:id/status transitions", () => {
  const ticketId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "admin-1", role: "admin" };
      next();
    });
    app.use("/", ticketsAdminRouter);
    return app;
  }

  it("rejects closed -> in_progress", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: ticketId,
          status: "closed",
          created_by: "u1",
          organization_id: "o1",
          subject: "Hi",
        },
      ],
    });

    const res = await request(buildApp())
      .patch(`/tickets/${ticketId}/status`)
      .send({ status: "in_progress" });

    expect(res.status).toBe(400);
    expect(String(res.body.error || "")).toMatch(/Invalid status transition/);
  });

  it("allows closed -> open", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: ticketId,
            status: "closed",
            created_by: "u1",
            organization_id: "o1",
            subject: "Hi",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: ticketId, status: "open" }] })
      .mockResolvedValueOnce({ rows: [{ pg_notify: "" }] });

    const res = await request(buildApp())
      .patch(`/tickets/${ticketId}/status`)
      .send({ status: "open" });

    expect(res.status).toBe(200);
  });
});
