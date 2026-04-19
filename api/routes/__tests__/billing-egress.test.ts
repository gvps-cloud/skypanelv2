import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import adminEgressRouter from "../admin/egress.js";

const mockQuery = vi.fn();
const mockListRegionPricing = vi.fn();
const mockSyncRegionPricing = vi.fn();

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
  requireAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  },
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../services/egressBillingService.js", () => ({
  EgressBillingService: {
    listRegionPricing: (...args: any[]) => mockListRegionPricing(...args),
    syncRegionPricing: (...args: any[]) => mockSyncRegionPricing(...args),
  },
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: "org-uuid-001",
      role: "admin",
    };
    next();
  });
  app.use("/", adminEgressRouter);
  return app;
}

describe("Admin Egress Billing Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /egress/pricing", () => {
    it("returns egress pricing stats", async () => {
      const mockPricing = [
        { region_id: "us-east", price_per_gb: 0.01, upcharge_price_per_gb: 0.02, billing_enabled: true },
        { region_id: "us-west", price_per_gb: 0.01, upcharge_price_per_gb: 0.025, billing_enabled: true },
      ];
      mockListRegionPricing.mockResolvedValue(mockPricing);

      const app = createApp();
      const res = await request(app).get("/egress/pricing");

      expect(res.status).toBe(200);
      expect(res.body.pricing).toEqual(mockPricing);
    });

    it("handles missing table error gracefully", async () => {
      mockListRegionPricing.mockRejectedValue(new Error("could not find the table"));

      const app = createApp();
      const res = await request(app).get("/egress/pricing");

      expect(res.status).toBe(200);
      expect(res.body.pricing).toEqual([]);
    });

    it("returns 500 on other errors", async () => {
      mockListRegionPricing.mockRejectedValue(new Error("database error"));

      const app = createApp();
      const res = await request(app).get("/egress/pricing");

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/database error/i);
    });
  });

  describe("POST /egress/pricing/sync", () => {
    it("returns synced egress pricing", async () => {
      const mockSyncedPricing = [
        { region_id: "us-east", price_per_gb: 0.01, upcharge_price_per_gb: 0.02 },
      ];
      mockSyncRegionPricing.mockResolvedValue(mockSyncedPricing);

      const app = createApp();
      const res = await request(app).post("/egress/pricing/sync");

      expect(res.status).toBe(200);
      expect(res.body.pricing).toEqual(mockSyncedPricing);
    });
  });

  describe("Unauthorized access", () => {
    it("returns 401 when not authenticated", async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = undefined;
        next();
      });
      app.use("/", adminEgressRouter);

      const res = await request(app).get("/egress/pricing");

      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: "org-uuid-001",
          role: "user",
        };
        next();
      });
      app.use("/", adminEgressRouter);

      const res = await request(app).get("/egress/pricing");

      expect(res.status).toBe(403);
    });
  });
});