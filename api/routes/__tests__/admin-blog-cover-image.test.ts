import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/auth.js", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: "admin-1", role: "admin" };
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../lib/database.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: "post-1" }] }),
}));

vi.mock("../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../config/index.js", () => ({
  config: {
    UPLOAD_PATH: "./uploads-test-cover",
    MAX_FILE_SIZE: 10485760,
  },
}));

import blogAdminRouter from "../admin/blog.js";

describe("Admin blog cover image upload", () => {
  it("rejects non-image MIME type", async () => {
    const app = express();
    app.use("/blog", blogAdminRouter);

    const res = await request(app)
      .post("/blog/posts/post-1/cover-image")
      .attach("cover", Buffer.from("not an image"), {
        filename: "x.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const msg = JSON.stringify(res.body || {}) + (res.text || "");
    expect(msg.toLowerCase()).toMatch(/upload|file|image|multer|error/);
  });
});
