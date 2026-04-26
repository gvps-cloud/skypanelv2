import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enhanceAdminRouter from "../admin/enhance.js";

const mockGetStatus = vi.hoisted(() => vi.fn());
const mockSetRuntimeEnabled = vi.hoisted(() => vi.fn());
const mockRunHealthCheck = vi.hoisted(() => vi.fn());

vi.mock("../../services/enhanceToggle.js", () => ({
  EnhanceToggleService: {
    getStatus: mockGetStatus,
    setRuntimeEnabled: mockSetRuntimeEnabled,
    runHealthCheck: mockRunHealthCheck,
  },
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

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
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("../../services/enhanceService.js", () => ({
  EnhanceService: {
    getPlans: vi.fn().mockResolvedValue([]),
    createCustomer: vi.fn().mockResolvedValue({ id: "cust-123" }),
    updateWebsite: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../config/index.js", () => ({
  config: {
    ENHANCE_MASTER_ORG_ID: "master-org-123",
  },
}));

function createApp(userOverride?: Record<string, any>): Express {
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
  app.use("/", enhanceAdminRouter);
  return app;
}

describe("Admin Enhance Status Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /status", () => {
    it("returns status breakdown for admin", async () => {
      const status = {
        hardEnabled: true,
        envConfigured: true,
        missingEnv: [],
        runtimeEnabled: true,
        effectiveEnabled: true,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        lastHealthMessage: null,
      };
      mockGetStatus.mockResolvedValue(status);

      const app = createApp();
      const res = await request(app).get("/status");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(status);
      expect(mockGetStatus).toHaveBeenCalled();
    });

    it("returns 500 when getStatus throws", async () => {
      mockGetStatus.mockRejectedValue(new Error("DB error"));

      const app = createApp();
      const res = await request(app).get("/status");

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Failed to get enhance status");
    });
  });

  describe("PATCH /status", () => {
    it("toggles runtime state with valid boolean body", async () => {
      mockSetRuntimeEnabled.mockResolvedValue(undefined);
      const status = {
        hardEnabled: true,
        envConfigured: true,
        missingEnv: [],
        runtimeEnabled: true,
        effectiveEnabled: true,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        lastHealthMessage: null,
      };
      mockGetStatus.mockResolvedValue(status);

      const app = createApp();
      const res = await request(app).patch("/status").send({ enabled: true });

      expect(res.status).toBe(200);
      expect(mockSetRuntimeEnabled).toHaveBeenCalledWith(true, "00000000-0000-0000-0000-000000000001");
      expect(res.body).toEqual(status);
    });

    it("rejects non-boolean enabled value", async () => {
      const app = createApp();
      const res = await request(app).patch("/status").send({ enabled: "yes" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("enabled must be a boolean");
      expect(mockSetRuntimeEnabled).not.toHaveBeenCalled();
    });

    it("rejects missing enabled field", async () => {
      const app = createApp();
      const res = await request(app).patch("/status").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("enabled must be a boolean");
    });

    it("returns 400 when setRuntimeEnabled throws", async () => {
      mockSetRuntimeEnabled.mockRejectedValue(new Error("Hard gate is false"));

      const app = createApp();
      const res = await request(app).patch("/status").send({ enabled: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Hard gate is false");
    });
  });

  describe("POST /status/test", () => {
    it("runs health check and returns result", async () => {
      mockRunHealthCheck.mockResolvedValue({ success: true, message: "API connectivity confirmed" });

      const app = createApp();
      const res = await request(app).post("/status/test");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockRunHealthCheck).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
    });

    it("returns 500 when health check throws unexpectedly", async () => {
      mockRunHealthCheck.mockRejectedValue(new Error("Unexpected crash"));

      const app = createApp();
      const res = await request(app).post("/status/test");

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Unexpected crash");
    });
  });

  describe("Non-admin access", () => {
    it("returns 403 for non-admin user", async () => {
      const app = createApp({ role: "user" });
      const res = await request(app).get("/status");

      expect(res.status).toBe(403);
    });

    it("returns 401 when not authenticated", async () => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = undefined;
        next();
      });
      app.use("/", enhanceAdminRouter);

      const res = await request(app).get("/status");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin on PATCH", async () => {
      const app = createApp({ role: "user" });
      const res = await request(app).patch("/status").send({ enabled: true });

      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin on POST test", async () => {
      const app = createApp({ role: "user" });
      const res = await request(app).post("/status/test");

      expect(res.status).toBe(403);
    });
  });
});
