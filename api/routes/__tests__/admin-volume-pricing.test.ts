import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import volumePricingRouter from "../admin/volumePricing.js";

const mockQuery = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  },
  requireAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  },
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  transaction: vi.fn(),
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock("../../services/linodeService.js", () => ({
  linodeService: {},
}));

function createApp(userOverride?: Record<string, unknown>): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: "org-uuid-001",
      role: "admin",
      ...userOverride,
    };
    next();
  });
  app.use("/", volumePricingRouter);
  return app;
}

const sampleVolumeType = {
  id: "11111111-1111-4111-8111-111111111111",
  label: "NVMe Block Storage",
  storage_type: "nvme",
  size_min_gb: 10,
  size_max_gb: 10000,
  price_per_gb_month: 0.12,
  price_per_gb_hour: 0.000167,
  region_pricing: {},
  is_active: true,
  display_order: 0,
  description: "Fast storage tier",
};

describe("Admin Volume Billing Routes", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockLogActivity.mockReset();
    mockLogActivity.mockResolvedValue(undefined);
  });

  describe("GET /volume-types", () => {
    it("returns configured volume types", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleVolumeType] });

      const app = createApp();
      const res = await request(app).get("/volume-types");

      expect(res.status).toBe(200);
      expect(res.body.volume_types).toEqual([sampleVolumeType]);
    });
  });

  describe("POST /volume-types", () => {
    it("creates a volume type", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleVolumeType] });

      const app = createApp();
      const res = await request(app)
        .post("/volume-types")
        .send({
          label: "NVMe Block Storage",
          storage_type: "nvme",
          size_min_gb: 10,
          size_max_gb: 10000,
          price_per_gb_month: 0.12,
          price_per_gb_hour: 0.000167,
          region_pricing: {},
          is_active: true,
          display_order: 0,
          description: "Fast storage tier",
        });

      expect(res.status).toBe(201);
      expect(res.body.volume_type).toEqual(sampleVolumeType);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "volume_type.created",
          entityType: "volume_types",
          entityId: sampleVolumeType.id,
        }),
      );
    });

    it("returns 400 for invalid payloads", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/volume-types")
        .send({ storage_type: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("PUT /volume-types/:id", () => {
    it("updates a volume type", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...sampleVolumeType, label: "Updated Volume Type", is_active: false }],
      });

      const app = createApp();
      const res = await request(app)
        .put(`/${"volume-types"}/${sampleVolumeType.id}`)
        .send({ label: "Updated Volume Type", is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.volume_type.label).toBe("Updated Volume Type");
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "volume_type.updated",
          entityId: sampleVolumeType.id,
        }),
      );
    });

    it("returns 404 when the volume type does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp();
      const res = await request(app)
        .put(`/${"volume-types"}/${sampleVolumeType.id}`)
        .send({ label: "Updated Volume Type" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("DELETE /volume-types/:id", () => {
    it("deletes a volume type", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: sampleVolumeType.id, label: sampleVolumeType.label }] });

      const app = createApp();
      const res = await request(app).delete(`/${"volume-types"}/${sampleVolumeType.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "volume_type.deleted",
          entityId: sampleVolumeType.id,
        }),
      );
    });
  });

  describe("GET /volumes", () => {
    it("returns volume inventory", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "vol-001",
            organization_id: "org-uuid-001",
            organization_name: "Example Org",
            vps_id: "vps-001",
            vps_label: "Example VPS",
            provider: "linode",
            provider_volume_id: "linode-vol-1",
            label: "Data Volume",
            region: "us-east",
            size_gb: 100,
            storage_type: "nvme",
            status: "active",
            hourly_price: 0.0167,
          },
        ],
      });

      const app = createApp();
      const res = await request(app).get("/volumes?region=us-east");

      expect(res.status).toBe(200);
      expect(res.body.volumes).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("FROM volumes v"), ["us-east"]);
    });
  });

  describe("GET /volumes/:id/billing", () => {
    it("returns billing history and summary", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: "billing-001",
              volume_id: "vol-001",
              total_amount: 1.67,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ total_charges: 1.67, total_gb_hours: 100, volume_count: 1 }],
        });

      const app = createApp();
      const res = await request(app).get("/volumes/vol-001/billing");

      expect(res.status).toBe(200);
      expect(res.body.billing_records).toHaveLength(1);
      expect(res.body.summary.total_charges).toBe(1.67);
    });
  });

  describe("GET /volumes/overview", () => {
    it("returns aggregated overview stats", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: "3" }] })
        .mockResolvedValueOnce({ rows: [{ active: "2" }] })
        .mockResolvedValueOnce({ rows: [{ total_gb: "250" }] })
        .mockResolvedValueOnce({ rows: [{ status: "active", count: "2", total_gb: "200" }] })
        .mockResolvedValueOnce({ rows: [{ id: "org-uuid-001", name: "Example Org", volume_count: "3", total_gb: "250" }] })
        .mockResolvedValueOnce({ rows: [{ id: "billing-001", organization_name: "Example Org", total_amount: 1.67 }] });

      const app = createApp();
      const res = await request(app).get("/volumes/overview");

      expect(res.status).toBe(200);
      expect(res.body.stats).toEqual({
        total_volumes: 3,
        active_volumes: 2,
        total_capacity_gb: 250,
      });
      expect(res.body.by_status).toHaveLength(1);
      expect(res.body.by_organization).toHaveLength(1);
      expect(res.body.recent_billing).toHaveLength(1);
    });
  });

  describe("authorization", () => {
    it("returns 401 when not authenticated", async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = undefined;
        next();
      });
      app.use("/", volumePricingRouter);

      const res = await request(app).get("/volume-types");
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      const app = createApp({ role: "user" });
      const res = await request(app).get("/volume-types");
      expect(res.status).toBe(403);
    });
  });
});
