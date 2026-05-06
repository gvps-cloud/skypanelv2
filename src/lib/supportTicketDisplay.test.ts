import { describe, expect, it } from "vitest";
import {
  formatTicketDateLabel,
  formatTicketDateTimeLabel,
} from "./supportTicketDisplay";

describe("formatTicketDateTimeLabel", () => {
  it("formats valid ISO strings", () => {
    const s = formatTicketDateTimeLabel("2026-05-06T15:30:00.000Z");
    expect(s).not.toBe("—");
    expect(s.length).toBeGreaterThan(4);
  });

  it("returns em dash for invalid input", () => {
    expect(formatTicketDateTimeLabel("")).toBe("—");
    expect(formatTicketDateTimeLabel(undefined)).toBe("—");
    expect(formatTicketDateTimeLabel("not-a-date")).toBe("—");
  });
});

describe("formatTicketDateLabel", () => {
  it("returns em dash for invalid input", () => {
    expect(formatTicketDateLabel("")).toBe("—");
  });
});
