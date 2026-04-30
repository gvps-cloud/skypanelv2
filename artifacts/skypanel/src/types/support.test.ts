import { describe, it, expect } from "vitest";
import {
  isReopenRequestMessage,
  formatTicketMessage,
  REOPEN_REQUEST_PREFIX,
} from "./support";

describe("Support Types Utilities", () => {
  describe("isReopenRequestMessage", () => {
    it("should return true when the message starts with the reopen prefix", () => {
      expect(isReopenRequestMessage(`${REOPEN_REQUEST_PREFIX} Please reopen`)).toBe(true);
      expect(isReopenRequestMessage(REOPEN_REQUEST_PREFIX)).toBe(true);
    });

    it("should return false when the message does not start with the reopen prefix", () => {
      expect(isReopenRequestMessage("Please reopen this ticket")).toBe(false);
      expect(isReopenRequestMessage(`Hello ${REOPEN_REQUEST_PREFIX}`)).toBe(false);
      expect(isReopenRequestMessage("")).toBe(false);
    });

    it("should handle non-string inputs gracefully", () => {
      // Testing invalid runtime inputs
      expect(isReopenRequestMessage(null as any)).toBe(false);
      // Testing invalid runtime inputs
      expect(isReopenRequestMessage(undefined as any)).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage(123)).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage({})).toBe(false);
    });
  });

  describe("formatTicketMessage", () => {
    it("should remove the reopen prefix and trim the message", () => {
      expect(formatTicketMessage(`${REOPEN_REQUEST_PREFIX} Please reopen this issue `)).toBe("Please reopen this issue");
      expect(formatTicketMessage(`${REOPEN_REQUEST_PREFIX}Please reopen`)).toBe("Please reopen");
      expect(formatTicketMessage(REOPEN_REQUEST_PREFIX)).toBe("");
    });

    it("should return the original message if it does not contain the prefix at the start", () => {
      expect(formatTicketMessage("Please reopen this issue")).toBe("Please reopen this issue");
      expect(formatTicketMessage(`Hello ${REOPEN_REQUEST_PREFIX}`)).toBe(`Hello ${REOPEN_REQUEST_PREFIX}`);
    });

    it("should handle empty strings", () => {
      expect(formatTicketMessage("")).toBe("");
    });
  });
});
