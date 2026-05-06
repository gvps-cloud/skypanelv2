import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/platformSettingsService.js", () => ({
  getPlatformSetting: vi.fn().mockImplementation((key: string) => {
    if (key === "maintenance_mode") {
      return Promise.resolve({
        enabled: true,
        messageHtml: "<p>Maint</p>",
      });
    }
    if (key === "registration_disabled") {
      return Promise.resolve({ enabled: false });
    }
    return Promise.resolve(null);
  }),
}));

import siteStatusRouter from "../siteStatus.js";

describe("GET /api/site-status (public)", () => {
  it("returns maintenance flags without leaking bypass code", async () => {
    const app = express();
    app.use(siteStatusRouter);

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.maintenanceMode).toBe(true);
    expect(res.body).not.toHaveProperty("code");
    expect(res.body).not.toHaveProperty("MAINTENANCE_CODE");
    expect(res.body).not.toHaveProperty("bypassCodeConfigured");
  });
});
