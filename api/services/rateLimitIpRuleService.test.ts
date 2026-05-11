import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/database.js", () => ({
  query: vi.fn(),
}));

import { query } from "../lib/database.js";
import {
  clearRateLimitIpRuleCache,
  deleteRateLimitIpRule,
  getActiveRateLimitIpRule,
  upsertRateLimitIpRule,
} from "./rateLimitIpRuleService.js";

const queryMock = vi.mocked(query);

describe("rateLimitIpRuleService", () => {
  beforeEach(() => {
    queryMock.mockReset();
    clearRateLimitIpRuleCache();
  });

  it("hydrates an active IP rule", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          ip_address: "203.0.113.10",
          rule_type: "blocked",
          max_requests: null,
          window_ms: null,
          reason: "abuse",
          created_by: null,
          expires_at: null,
          created_at: "2026-05-11T00:00:00.000Z",
          updated_at: "2026-05-11T00:00:00.000Z",
        },
      ],
    } as any);

    const rule = await getActiveRateLimitIpRule("203.0.113.10");

    expect(rule?.ruleType).toBe("blocked");
    expect(rule?.ipAddress).toBe("203.0.113.10");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("requires trusted IP rules to have a positive request budget", async () => {
    await expect(
      upsertRateLimitIpRule({
        ipAddress: "203.0.113.11",
        ruleType: "trusted",
      }),
    ).rejects.toThrow("Trusted IP rules require positive maxRequests and windowMs values");
  });

  it("saves blocked IP rules without a request budget", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          ip_address: "203.0.113.12",
          rule_type: "blocked",
          max_requests: null,
          window_ms: null,
          reason: "credential stuffing",
          created_by: null,
          expires_at: null,
          created_at: "2026-05-11T00:00:00.000Z",
          updated_at: "2026-05-11T00:00:00.000Z",
        },
      ],
    } as any);

    const rule = await upsertRateLimitIpRule({
      ipAddress: "203.0.113.12",
      ruleType: "blocked",
      reason: "credential stuffing",
    });

    expect(rule.ruleType).toBe("blocked");
    expect(queryMock.mock.calls[0][1]).toEqual([
      "203.0.113.12",
      "blocked",
      null,
      null,
      "credential stuffing",
      null,
      null,
    ]);
  });

  it("clears the cached IP after deleting a rule", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ip_address: "203.0.113.13" }] } as any);

    await expect(deleteRateLimitIpRule("55555555-5555-4555-8555-555555555555")).resolves.toBe(true);
  });
});
