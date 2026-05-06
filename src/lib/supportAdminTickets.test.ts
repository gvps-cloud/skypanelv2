import { describe, expect, it } from "vitest";
import {
  mapAdminReplyRows,
  normalizeAdminListTicket,
} from "./supportAdminTickets";
import type { SupportTicket } from "@/types/support";

describe("normalizeAdminListTicket", () => {
  it("defaults hosting flags to false when missing", () => {
    const t = {
      id: "a",
      subject: "s",
      status: "open" as const,
      priority: "medium" as const,
      category: "general" as const,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      messages: [],
    } satisfies SupportTicket;
    const n = normalizeAdminListTicket(t);
    expect(n.hosting_subscription_is_active).toBe(false);
    expect(n.hosting_plan_is_active).toBe(false);
  });

  it("uses created_at when updated_at is blank", () => {
    const t = {
      id: "a",
      subject: "s",
      status: "open" as const,
      priority: "medium" as const,
      category: "general" as const,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "   ",
      messages: [],
    } as SupportTicket;
    const n = normalizeAdminListTicket(t);
    expect(n.updated_at).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("mapAdminReplyRows", () => {
  it("maps valid reply rows", () => {
    const rows = [
      {
        id: "r1",
        ticket_id: "t1",
        sender_type: "user",
        sender_name: "Pat",
        message: "Hi",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const msgs = mapAdminReplyRows(rows);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("r1");
  });

  it("skips invalid rows", () => {
    expect(mapAdminReplyRows([{ foo: 1 }, null])).toHaveLength(0);
  });
});
