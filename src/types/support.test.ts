import { describe, it, expect } from "vitest";
import {
  isReopenRequestMessage,
  formatTicketMessage,
  REOPEN_REQUEST_PREFIX,
} from "./support";

describe("Support Types Utilities", () => {
  describe("isReopenRequestMessage", () => {
    it("should return true for a string that starts with the prefix", () => {
      expect(isReopenRequestMessage(`${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe(true);
      expect(isReopenRequestMessage(REOPEN_REQUEST_PREFIX)).toBe(true);
    });

    it("should return false for a string containing the prefix not at the start or without prefix", () => {
      expect(isReopenRequestMessage(`Hello ${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe(false);
      expect(isReopenRequestMessage("Please reopen this ticket")).toBe(false);
      expect(isReopenRequestMessage("")).toBe(false);
    });

    it("should return false for different casing", () => {
      expect(isReopenRequestMessage("[reopen_request] Please reopen this")).toBe(false);
    });

    it("should handle non-string inputs gracefully", () => {
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage(null)).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage(undefined)).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage(123)).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage({})).toBe(false);
      // @ts-expect-error Testing invalid runtime inputs
      expect(isReopenRequestMessage([])).toBe(false);
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

    it("should safely return the input unchanged for non-string inputs", () => {
      // @ts-expect-error Testing invalid runtime inputs
      expect(formatTicketMessage(null)).toBe(null);
      // @ts-expect-error Testing invalid runtime inputs
      expect(formatTicketMessage(123)).toBe(123);
    });
  });
});
