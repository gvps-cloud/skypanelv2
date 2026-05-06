import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../api/lib/database.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("../../api/config/index.js", () => ({
  config: {
    UPLOAD_PATH: "./uploads-test-blog",
  },
}));

import blogPublicRouter from "../../api/routes/blog.js";

describe("Public blog security", () => {
  it("GET /posts uses published-only filter in SQL", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = express();
    app.use("/blog", blogPublicRouter);

    const res = await request(app).get("/blog/posts");
    expect(res.status).toBe(200);

    const countSql = String(mockQuery.mock.calls[0][0]);
    expect(countSql).toContain("status = 'published'");
    expect(countSql).toContain("deleted_at IS NULL");
  });

  it("GET /images rejects path traversal in filename", async () => {
    const app = express();
    app.use("/blog", blogPublicRouter);

    const res = await request(app).get("/blog/images/../../etc/passwd");
    expect(res.status).toBe(404);
  });
});
