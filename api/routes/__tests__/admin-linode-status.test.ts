import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import linodeAdminRouter from "../admin/linode.js";

const mockGetStatus = vi.hoisted(() => vi.fn());
const mockSetRuntimeEnabled = vi.hoisted(() => vi.fn());

vi.mock("../../services/linodeToggle.js", () => ({
  LinodeToggleService: {
    getStatus: mockGetStatus,
    setRuntimeEnabled: mockSetRuntimeEnabled,
    isEffectivelyEnabled: vi.fn(),
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
  query: vi.fn().mockResolvedValue({ rows: [{ n: 0 }] }),
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
  app.use("/", linodeAdminRouter);
  return app;
}

describe("Admin Linode Status Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /status", () => {
    it("returns status for admin", async () => {
      const status = {
        hardEnabled: true,
        envConfigured: true,
        missingEnv: [],
        runtimeEnabled: true,
        effectiveEnabled: true,
      };
      mockGetStatus.mockResolvedValue(status);

      const app = createApp();
      const res = await request(app).get("/status");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(status);
    });
  });

  describe("PATCH /status", () => {
    it("returns 400 when enabled is not boolean", async () => {
      const app = createApp();
      const res = await request(app).patch("/status").send({ enabled: "yes" });
      expect(res.status).toBe(400);
    });

    it("updates status when enabled true", async () => {
      mockSetRuntimeEnabled.mockResolvedValue(undefined);
      mockGetStatus.mockResolvedValue({
        hardEnabled: true,
        envConfigured: true,
        missingEnv: [],
        runtimeEnabled: true,
        effectiveEnabled: true,
      });

      const app = createApp();
      const res = await request(app).patch("/status").send({ enabled: true });

      expect(res.status).toBe(200);
      expect(mockSetRuntimeEnabled).toHaveBeenCalledWith(true, "00000000-0000-0000-0000-000000000001");
    });
  });
});
