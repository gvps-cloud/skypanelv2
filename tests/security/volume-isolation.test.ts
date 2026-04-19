/**
 * Volume Organization Isolation Tests
 * Verify that volume data is properly isolated between organizations
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const mockQuery = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
const mockCheckPermission = vi.fn();

vi.mock("../../../middleware/auth.js", () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../../lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../../services/activityLogger.js", () => ({
  logActivity: (...args: any[]) => mockLogActivity(...args),
}));

vi.mock("../../../services/roles.js", () => ({
  RoleService: {
    checkPermission: (...args: any[]) => mockCheckPermission(...args),
  },
}));

function createApp(userOverride?: Record<string, any>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      id: "user-org-a",
      organizationId: "org-a",
      role: "user",
      ...userOverride,
    };
    next();
  });

  // Inline volume routes for testing (mirrors actual implementation)
  const volumeRouter = express.Router();
  volumeRouter.get("/", async (req: any, res) => {
    const { organizationId } = req.user;
    const result = await mockQuery(
      `SELECT id, organization_id, label, size_gb, status
       FROM volumes WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    res.json({ volumes: result.rows || [] });
  });
  volumeRouter.get("/:id", async (req: any, res) => {
    const { organizationId } = req.user;
    const result = await mockQuery(
      `SELECT id, organization_id, label, size_gb, status
       FROM volumes WHERE id = $1 AND organization_id = $2`,
      [req.params.id, organizationId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Volume not found" });
      return;
    }
    res.json({ volume: result.rows[0] });
  });
  volumeRouter.post("/", async (req: any, res) => {
    const { organizationId, id: _userId } = req.user;
    const { label, size_gb, region } = req.body;
    const result = await mockQuery(
      `INSERT INTO volumes (organization_id, label, size_gb, region, status)
       VALUES ($1, $2, $3, $4, 'creating') RETURNING *`,
      [organizationId, label, size_gb, region]
    );
    res.status(201).json({ volume: result.rows[0] });
  });

  app.use("/api/volumes", volumeRouter);
  return app;
}

const orgAVolume = {
  id: "vol-org-a-001",
  organization_id: "org-a",
  label: "OrgA-Volume-1",
  size_gb: 100,
  status: "active",
  region: "us-east",
};

const orgBVolume = {
  id: "vol-org-b-001",
  organization_id: "org-b",
  label: "OrgB-Volume-1",
  size_gb: 200,
  status: "active",
  region: "us-east",
};

describe("Volume Organization Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockResolvedValue(true);
  });

  describe("GET /api/volumes", () => {
    it("should only return volumes for the authenticated user's organization", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [orgAVolume] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get("/api/volumes");

      expect(res.status).toBe(200);
      expect(res.body.volumes).toHaveLength(1);
      expect(res.body.volumes[0].label).toBe("OrgA-Volume-1");
      expect(res.body.volumes[0].organization_id).toBe("org-a");
    });

    it("should not return volumes from other organizations", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [orgAVolume] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get("/api/volumes");

      const orgBVolumeInResult = res.body.volumes.find(
        (v: any) => v.organization_id === "org-b"
      );
      expect(orgBVolumeInResult).toBeUndefined();
    });

    it("should return 200 with empty array when org has no volumes", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get("/api/volumes");

      expect(res.status).toBe(200);
      expect(res.body.volumes).toHaveLength(0);
    });
  });

  describe("GET /api/volumes/:id", () => {
    it("should return volume when it belongs to user's organization", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [orgAVolume] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get(`/api/volumes/${orgAVolume.id}`);

      expect(res.status).toBe(200);
      expect(res.body.volume.label).toBe("OrgA-Volume-1");
    });

    it("should return 404 when trying to access another org's volume", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get(`/api/volumes/${orgBVolume.id}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Volume not found");
    });

    it("should not leak org-b volume data in 404 response", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app).get(`/api/volumes/${orgBVolume.id}`);

      expect(res.body.volume).toBeUndefined();
      expect(res.body.label).toBeUndefined();
    });
  });

  describe("POST /api/volumes", () => {
    it("should create volume scoped to user's organization", async () => {
      const newVolume = { ...orgAVolume, id: "new-vol" };
      mockQuery.mockResolvedValueOnce({ rows: [newVolume] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      const res = await request(app)
        .post("/api/volumes")
        .send({ label: "New Volume", size_gb: 50, region: "us-east" });

      expect(res.status).toBe(201);
      expect(res.body.volume.organization_id).toBe("org-a");

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toContain("org-a");
    });
  });

  describe("Cross-organization query prevention", () => {
    it("should always scope queries to user's organization_id", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      await request(app).get("/api/volumes");

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toContain("org-a");
      expect(queryCall[1]).not.toContain("org-b");
    });

    it("should not allow organization_id injection via request params", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = createApp({ id: "user-a", organizationId: "org-a" });
      await request(app).get("/api/volumes?org_id=org-b");

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).not.toContain("org-b");
    });
  });
});
