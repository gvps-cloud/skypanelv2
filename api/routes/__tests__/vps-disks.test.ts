import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import disksRouter from "../vps/disks.js";

const mockQuery = vi.fn();
const mockListDisks = vi.fn();
const mockGetDisk = vi.fn();
const mockCreateDisk = vi.fn();
const mockUpdateDisk = vi.fn();
const mockResizeDisk = vi.fn();
const mockCloneDisk = vi.fn();
const mockResetDiskPassword = vi.fn();
const mockDeleteDisk = vi.fn();
const mockCheckPermission = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../services/linodeService.js", () => ({
  linodeService: {
    listDisks: (...args: any[]) => mockListDisks(...args),
    getDisk: (...args: any[]) => mockGetDisk(...args),
    createDisk: (...args: any[]) => mockCreateDisk(...args),
    updateDisk: (...args: any[]) => mockUpdateDisk(...args),
    resizeDisk: (...args: any[]) => mockResizeDisk(...args),
    cloneDisk: (...args: any[]) => mockCloneDisk(...args),
    resetDiskPassword: (...args: any[]) => mockResetDiskPassword(...args),
    deleteDisk: (...args: any[]) => mockDeleteDisk(...args),
  },
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: (...args: any[]) => mockLogActivity(...args),
}));

vi.mock("../../services/roles.js", () => ({
  RoleService: {
    checkPermission: (...args: any[]) => mockCheckPermission(...args),
  },
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
  app.use("/", disksRouter);
  return app;
}

const mockVpsInstance = {
  id: "vps-001",
  organization_id: "org-uuid-001",
  provider_instance_id: 99999,
  label: "TestVPS",
  status: "running",
};

describe("VPS Disk Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockResolvedValue(true);
    mockQuery.mockResolvedValue({ rows: [{ ...mockVpsInstance }] });
  });

  describe("GET /:id/disks", () => {
    it("returns disks for a valid VPS instance", async () => {
      const mockDisks = [
        { id: 1, label: "Disk 1", status: "ready", size: 10240, filesystem: "ext4" },
        { id: 2, label: "Disk 2", status: "ready", size: 5120, filesystem: "ext4" },
      ];
      mockListDisks.mockResolvedValue(mockDisks);

      const app = createApp({ role: "user" });
      const res = await request(app).get("/vps-001/disks");

      expect(res.status).toBe(200);
      expect(res.body.disks).toEqual(mockDisks);
      expect(mockListDisks).toHaveBeenCalledWith(99999);
    });

    it("returns 404 when VPS instance not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "user" });
      const res = await request(app).get("/nonexistent/disks");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 403 when user lacks vps_manage permission", async () => {
      mockCheckPermission.mockResolvedValue(false);

      const app = createApp({ role: "user" });
      const res = await request(app).get("/vps-001/disks");

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it("returns 400 when provider_instance_id is invalid", async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockVpsInstance, provider_instance_id: "not-a-number" }],
      });

      const app = createApp({ role: "user" });
      const res = await request(app).get("/vps-001/disks");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing provider reference/i);
    });

    it("propagates Linode API errors from listDisks", async () => {
      mockListDisks.mockRejectedValue(new Error("Linode API error"));

      const app = createApp({ role: "admin" });
      const res = await request(app).get("/vps-001/disks");

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/linode/i);
    });
  });

  describe("GET /:id/disks/:diskId", () => {
    it("returns a single disk", async () => {
      const mockDisk = { id: 1, label: "Disk 1", status: "ready", size: 10240 };
      mockGetDisk.mockResolvedValue(mockDisk);

      const app = createApp({ role: "admin" });
      const res = await request(app).get("/vps-001/disks/1");

      expect(res.status).toBe(200);
      expect(res.body.disk).toEqual(mockDisk);
    });

    it("returns 400 for invalid disk ID", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app).get("/vps-001/disks/invalid");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid disk id/i);
    });
  });

  describe("POST /:id/disks", () => {
    it("creates a disk with valid params", async () => {
      const newDisk = { id: 3, label: "NewDisk", status: "ready", size: 2048 };
      mockCreateDisk.mockResolvedValue(newDisk);

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks")
        .send({ label: "NewDisk", size: 2048 });

      expect(res.status).toBe(201);
      expect(res.body.disk).toEqual(newDisk);
      expect(mockLogActivity).toHaveBeenCalled();
    });

    it("returns 400 when label is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks")
        .send({ size: 2048 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/label and size are required/i);
    });

    it("returns 400 when size is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks")
        .send({ label: "NewDisk" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/label and size are required/i);
    });

    it("returns 400 when size is not a positive number", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks")
        .send({ label: "NewDisk", size: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/size must be a positive number/i);
    });

    it("returns 400 when size is zero", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks")
        .send({ label: "NewDisk", size: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/label and size are required/i);
    });
  });

  describe("PUT /:id/disks/:diskId", () => {
    it("updates disk label", async () => {
      const updatedDisk = { id: 1, label: "UpdatedLabel", status: "ready", size: 10240 };
      mockUpdateDisk.mockResolvedValue(updatedDisk);

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .put("/vps-001/disks/1")
        .send({ label: "UpdatedLabel" });

      expect(res.status).toBe(200);
      expect(res.body.disk).toEqual(updatedDisk);
      expect(mockUpdateDisk).toHaveBeenCalledWith(99999, 1, { label: "UpdatedLabel" });
    });

    it("updates disk filesystem", async () => {
      const updatedDisk = { id: 1, label: "Disk 1", status: "ready", size: 10240, filesystem: "xfs" };
      mockUpdateDisk.mockResolvedValue(updatedDisk);

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .put("/vps-001/disks/1")
        .send({ filesystem: "xfs" });

      expect(res.status).toBe(200);
      expect(mockUpdateDisk).toHaveBeenCalledWith(99999, 1, { filesystem: "xfs" });
    });

    it("logs activity after update", async () => {
      mockUpdateDisk.mockResolvedValue({ id: 1, label: "Updated", status: "ready" });

      const app = createApp({ role: "admin" });
      await request(app)
        .put("/vps-001/disks/1")
        .send({ label: "Updated" });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "vps.disk.update" }),
        expect.any(Object)
      );
    });
  });

  describe("POST /:id/disks/:diskId/resize", () => {
    it("resizes a disk with valid size", async () => {
      mockResizeDisk.mockResolvedValue({});

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/resize")
        .send({ size: 20480 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockResizeDisk).toHaveBeenCalledWith(99999, 1, 20480);
    });

    it("returns 400 when size is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/resize")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/size must be a positive number/i);
    });

    it("returns 400 when size is not a number", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/resize")
        .send({ size: "big" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/size must be a positive number/i);
    });

    it("returns 400 for invalid disk ID", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/notanumber/resize")
        .send({ size: 20480 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid disk id/i);
    });
  });

  describe("POST /:id/disks/:diskId/clone", () => {
    it("clones a disk", async () => {
      const clonedDisk = { id: 5, label: "Disk 1-clone", status: "ready", size: 10240 };
      mockCloneDisk.mockResolvedValue(clonedDisk);

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/clone");

      expect(res.status).toBe(201);
      expect(res.body.disk).toEqual(clonedDisk);
      expect(mockCloneDisk).toHaveBeenCalledWith(99999, 1);
    });

    it("returns 400 for invalid disk ID", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/baddisk/clone");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid disk id/i);
    });
  });

  describe("POST /:id/disks/:diskId/password", () => {
    it("resets disk password with valid password", async () => {
      mockResetDiskPassword.mockResolvedValue({});

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/password")
        .send({ password: "newrootpassword123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockResetDiskPassword).toHaveBeenCalledWith(99999, 1, "newrootpassword123");
    });

    it("returns 400 when password is too short", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/password")
        .send({ password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });

    it("returns 400 when password is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/disks/1/password")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });
  });

  describe("DELETE /:id/disks/:diskId", () => {
    it("deletes a disk", async () => {
      mockDeleteDisk.mockResolvedValue(undefined);

      const app = createApp({ role: "admin" });
      const res = await request(app).delete("/vps-001/disks/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDeleteDisk).toHaveBeenCalledWith(99999, 1);
    });

    it("logs activity after deletion", async () => {
      mockDeleteDisk.mockResolvedValue(undefined);

      const app = createApp({ role: "admin" });
      await request(app).delete("/vps-001/disks/1");

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "vps.disk.delete" }),
        expect.any(Object)
      );
    });

    it("returns 400 for invalid disk ID", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app).delete("/vps-001/disks/notanumber");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid disk id/i);
    });
  });
});
