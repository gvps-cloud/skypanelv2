import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import healthRoutes from "../../api/routes/health.js";
import { authenticateApiKey } from "../../api/routes/apiKeys/middleware.js";

describe("API hardening regressions", () => {
  it("blocks unauthenticated access to sensitive health diagnostics", async () => {
    const app = express();
    app.use("/api/health", healthRoutes);

    const response = await request(app).get("/api/health/rate-limiting");
    expect(response.status).toBe(401);
  });

  it("rejects API keys passed via query string", async () => {
    const app = express();
    app.use(authenticateApiKey);
    app.get("/api/protected", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get(
      "/api/protected?apikey=sk_live_test123456789",
    );
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Query-string API keys");
  });
});

