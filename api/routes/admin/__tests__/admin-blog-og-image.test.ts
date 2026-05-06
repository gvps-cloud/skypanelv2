import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../../middleware/auth.js", () => ({
  authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = {
      id: "admin-1",
      organizationId: null,
      role: "admin",
    };
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../../../lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../../services/activityLogger.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../config/index.js", () => ({
  config: {
    UPLOAD_PATH: "./uploads-test",
    MAX_FILE_SIZE: 10485760,
  },
}));

import blogAdminRouter from "../blog.js";

describe("Admin blog og_image_url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/blog", blogAdminRouter);
    return app;
  }

  it("persists og_image_url on create", async () => {
    const ogUrl = "https://cdn.example.com/preview.png";
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "post-1",
            title: "T",
            slug: "t",
            og_image_url: ogUrl,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).post("/blog/posts").send({
      title: "Hello world post",
      content: "Body",
      status: "draft",
      og_image_url: ogUrl,
      tag_ids: [],
    });

    expect(res.status).toBe(201);
    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("INSERT INTO blog_posts"),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    expect(params).toContain(ogUrl);
  });
});
