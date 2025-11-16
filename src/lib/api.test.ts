import { describe, it, expect } from "vitest";
import { buildApiUrl } from "./api";

describe("buildApiUrl", () => {
  it("combines relative /api base with admin paths once", () => {
    const url = buildApiUrl("/admin/theme", "/api");
    expect(url).toBe("/api/admin/theme");
  });

  it("deduplicates /api when base already ends with /api", () => {
    const url = buildApiUrl("/api/admin/theme", "https://example.com/api");
    expect(url).toBe("https://example.com/api/admin/theme");
  });

  it("keeps query params intact when normalizing", () => {
    const url = buildApiUrl(
      "/api/health/metrics?window=15",
      "https://example.com/api"
    );
    expect(url).toBe("https://example.com/api/health/metrics?window=15");
  });

  it("returns absolute URLs unchanged", () => {
    const absolute = "https://other.dev/api/admin";
    expect(buildApiUrl(absolute)).toBe(absolute);
  });

  it("normalizes paths when no base is provided", () => {
    expect(buildApiUrl("notifications/stream", "")).toBe(
      "/notifications/stream"
    );
  });
});
