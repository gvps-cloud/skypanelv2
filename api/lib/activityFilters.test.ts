import { describe, expect, it } from "vitest";
import { appendActivityEntityTypeFilter, normalizeActivityTypeInput } from "./activityFilters.js";

describe("normalizeActivityTypeInput", () => {
  it("collapses whitespace and hyphen variants", () => {
    expect(normalizeActivityTypeInput("  Web Hosting ")).toBe("web_hosting");
    expect(normalizeActivityTypeInput("enhance-web-hosting")).toBe("enhance_web_hosting");
  });
});

describe("appendActivityEntityTypeFilter", () => {
  it("matches hosting aliases with OR across entity types and event prefixes", () => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const next = appendActivityEntityTypeFilter({
      rawValue: "hosting",
      clauses,
      params,
      placeholderStart: 2,
    });
    expect(next).toBe(4);
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toContain("hosting_subscription");
    expect(clauses[0]).toMatch(/event_type LIKE \$\d+/);
    expect(params).toEqual(["hosting.%", "billing.hosting_wallet.%"]);
  });

  it("treats hosting_subscription alias as hosting scope", () => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    appendActivityEntityTypeFilter({
      rawValue: "hosting_subscription",
      clauses,
      params,
      placeholderStart: 2,
    });
    expect(params[0]).toBe("hosting.%");
  });

  it("matches enhance alias with platform integration rows", () => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    appendActivityEntityTypeFilter({
      rawValue: "enhance",
      clauses,
      params,
      placeholderStart: 5,
    });
    expect(params).toEqual(["enhance.%", "platform_integration", "enhance"]);
  });

  it("falls back to exact entity_type match when not an alias", () => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const next = appendActivityEntityTypeFilter({
      rawValue: "vps",
      clauses,
      params,
      placeholderStart: 3,
    });
    expect(next).toBe(4);
    expect(clauses[0]).toBe("entity_type = $3");
    expect(params).toEqual(["vps"]);
  });

  it("returns unchanged placeholder when raw value empty", () => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const next = appendActivityEntityTypeFilter({
      rawValue: "   ",
      clauses,
      params,
      placeholderStart: 2,
    });
    expect(next).toBe(2);
    expect(clauses).toHaveLength(0);
  });
});
