import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createSecurityMiddleware } from "./security.js";

function buildApp() {
  const app = express();
  app.use(createSecurityMiddleware());
  app.get("/", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("createSecurityMiddleware", () => {
  it("does not set HSTS on loopback hosts", async () => {
    const app = buildApp();
    const response = await request(app).get("/").set("Host", "localhost:3001");

    expect(response.status).toBe(200);
    expect(response.headers["strict-transport-security"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("sets HSTS on external hosts", async () => {
    const app = buildApp();
    const response = await request(app).get("/").set("Host", "example.com");

    expect(response.status).toBe(200);
    expect(response.headers["strict-transport-security"]).toBeDefined();
  });

  it("does not treat spoofed X-Forwarded-Host as loopback", async () => {
    const app = buildApp();
    const response = await request(app)
      .get("/")
      .set("Host", "example.com")
      .set("X-Forwarded-Host", "localhost");

    expect(response.status).toBe(200);
    expect(response.headers["strict-transport-security"]).toBeDefined();
  });
});
