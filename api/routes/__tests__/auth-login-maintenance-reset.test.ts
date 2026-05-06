import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetAttemptsMock } = vi.hoisted(() => ({
  resetAttemptsMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/bruteForceProtectionService.js", () => ({
  bruteForceProtectionService: {
    isLockedOut: vi.fn().mockResolvedValue({ locked: false }),
    resetAttempts: (...args: unknown[]) => resetAttemptsMock(...args),
    trackFailedAttempt: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../services/platformSettingsService.js", () => ({
  getPlatformSetting: vi.fn().mockResolvedValue({ enabled: true }),
}));

vi.mock("../../middleware/rateLimiting.js", () => ({
  loginRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  apiKeyMutationRateLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
  passwordResetRateLimiter: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

vi.mock("../../lib/ipDetection.js", () => ({
  getClientIP: () => ({ ip: "127.0.0.1" }),
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { AuthService } from "../../services/authService.js";
import authRouter from "../auth.js";

describe("POST /auth/login — maintenance mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthService, "login").mockResolvedValue({
      user: { id: "u1", email: "user@test.com", role: "user" },
      token: "jwt-token",
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets brute-force counter after successful credential check even when maintenance blocks non-admin", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    const res = await request(app).post("/auth/login").send({
      email: "user@test.com",
      password: "correct-password",
    });

    expect(res.status).toBe(403);
    expect(resetAttemptsMock).toHaveBeenCalledWith("127.0.0.1", "user@test.com");
  });
});
