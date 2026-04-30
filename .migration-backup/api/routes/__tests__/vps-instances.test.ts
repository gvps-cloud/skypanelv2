import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import instancesRouter from "../vps/instances.js";

const mockQuery = vi.fn();
const mockBootInstance = vi.fn();
const mockShutdownInstance = vi.fn();
const mockRebootInstance = vi.fn();
const mockRebuildInstance = vi.fn();
const mockDeleteInstance = vi.fn();
const mockGetLinodeInstance = vi.fn();
const mockCheckPermission = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
const mockAuthLogin = vi.fn();
const mockCaptureDeletionSnapshot = vi.fn().mockResolvedValue(undefined);
const mockEncryptSecret = vi.fn().mockReturnValue("encrypted_password_placeholder");

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOrganization: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../lib/database.js", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../../services/linodeService.js", () => ({
  linodeService: {
    bootLinodeInstance: (...args: any[]) => mockBootInstance(...args),
    shutdownLinodeInstance: (...args: any[]) => mockShutdownInstance(...args),
    rebootLinodeInstance: (...args: any[]) => mockRebootInstance(...args),
    rebuildLinodeInstance: (...args: any[]) => mockRebuildInstance(...args),
    deleteLinodeInstance: (...args: any[]) => mockDeleteInstance(...args),
    getLinodeInstance: (...args: any[]) => mockGetLinodeInstance(...args),
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

vi.mock("../../services/authService.js", () => ({
  AuthService: {
    login: (...args: any[]) => mockAuthLogin(...args),
    verifyTwoFactorCode: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../services/egressBillingService.js", () => ({
  EgressBillingService: {
    captureDeletionSnapshot: (...args: any[]) => mockCaptureDeletionSnapshot(...args),
  },
}));

vi.mock("../../lib/crypto.js", () => ({
  encryptSecret: (...args: any[]) => mockEncryptSecret(...args),
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
  app.use("/", instancesRouter);
  return app;
}

const mockVpsInstance = {
  id: "vps-001",
  organization_id: "org-uuid-001",
  provider_instance_id: 99999,
  label: "TestVPS",
  status: "running",
  provider_type: "linode",
};

const mockLinodeDetail = {
  id: 99999,
  label: "TestVPS",
  status: "running",
  ipv4: ["192.168.1.1"],
  ipv6: [],
};

describe("VPS Instance Action Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockResolvedValue(true);
    mockQuery.mockResolvedValue({ rows: [{ ...mockVpsInstance }] });
    mockGetLinodeInstance.mockResolvedValue(mockLinodeDetail);
  });

  describe("POST /:id/boot", () => {
    it("returns success and calls linodeService.bootLinodeInstance", async () => {
      mockBootInstance.mockResolvedValue(undefined);

      const app = createApp({ role: "admin" });
      const res = await request(app).post("/vps-001/boot");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("running");
      expect(mockBootInstance).toHaveBeenCalledWith(99999);
    });

    it("returns 404 when VPS not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "admin" });
      const res = await request(app).post("/nonexistent/boot");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 403 when user lacks vps_manage permission", async () => {
      mockCheckPermission.mockResolvedValue(false);

      const app = createApp({ role: "user" });
      const res = await request(app).post("/vps-001/boot");

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });
  });

  describe("POST /:id/shutdown", () => {
    it("returns success and calls linodeService.shutdownLinodeInstance", async () => {
      mockShutdownInstance.mockResolvedValue(undefined);
      mockGetLinodeInstance.mockResolvedValue({ ...mockLinodeDetail, status: "offline" });

      const app = createApp({ role: "admin" });
      const res = await request(app).post("/vps-001/shutdown");

      expect(res.status).toBe(200);
      expect(mockShutdownInstance).toHaveBeenCalledWith(99999);
    });

    it("returns 404 when VPS not found (org isolation)", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "user" });
      const res = await request(app).post("/vps-001/shutdown");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("POST /:id/reboot", () => {
    it("returns success and calls linodeService.rebootLinodeInstance", async () => {
      mockRebootInstance.mockResolvedValue(undefined);

      const app = createApp({ role: "admin" });
      const res = await request(app).post("/vps-001/reboot");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("running");
      expect(mockRebootInstance).toHaveBeenCalledWith(99999);
    });

    it("returns 404 when VPS not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "admin" });
      const res = await request(app).post("/nonexistent/reboot");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("POST /:id/rebuild", () => {
    it("returns success and calls linodeService.rebuildLinodeInstance", async () => {
      mockRebuildInstance.mockResolvedValue({
        id: 99999,
        label: "TestVPS",
        status: "rebuilding",
        ipv4: ["192.168.1.1"],
      });
      mockQuery.mockResolvedValue({
        rows: [{ ...mockVpsInstance, provider_id: null }],
      });

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/rebuild")
        .send({ image: "linode/ubuntu22.04", rootPassword: "validpassword123" });

      expect(res.status).toBe(200);
      expect(mockRebuildInstance).toHaveBeenCalled();
    });

    it("returns 400 when image is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/rebuild")
        .send({ rootPassword: "validpassword123" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/image is required/i);
    });

    it("returns 400 when rootPassword is too short", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/vps-001/rebuild")
        .send({ image: "linode/ubuntu22.04", rootPassword: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/i);
    });

    it("returns 404 when VPS not found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .post("/nonexistent/rebuild")
        .send({ image: "linode/ubuntu22.04", rootPassword: "validpassword123" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("DELETE /:id", () => {
    it("returns 200 with deleted flag and calls linodeService.deleteLinodeInstance", async () => {
      mockDeleteInstance.mockResolvedValue(undefined);
      mockAuthLogin.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({
        rows: [{ ...mockVpsInstance, provider_type: "linode" }],
      });

      const app = createApp({ role: "admin" });
      const res = await request(app)
        .delete("/vps-001")
        .send({ password: "correctpassword" });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(mockDeleteInstance).toHaveBeenCalledWith(99999);
    });

    it("returns 400 when password is missing", async () => {
      const app = createApp({ role: "admin" });
      const res = await request(app).delete("/vps-001").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password is required/i);
    });

    it("returns 404 when VPS not found (org isolation)", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const app = createApp({ role: "user" });
      const res = await request(app)
        .delete("/vps-001")
        .send({ password: "correctpassword" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});