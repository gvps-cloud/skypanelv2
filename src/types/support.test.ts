import { describe, it, expect } from "vitest";
import {
  isReopenRequestMessage,
  formatTicketMessage,
  REOPEN_REQUEST_PREFIX,
} from "./support";

describe("Support Types Utils", () => {
  describe("isReopenRequestMessage", () => {
    it("should return true for a string that starts with the prefix", () => {
      expect(isReopenRequestMessage(`${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe(true);
    });

    it("should return true for the exact prefix string", () => {
      expect(isReopenRequestMessage(REOPEN_REQUEST_PREFIX)).toBe(true);
    });

    it("should return false for a string containing the prefix not at the start", () => {
      expect(isReopenRequestMessage(`Hello ${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe(false);
    });

    it("should return false for a string without the prefix", () => {
      expect(isReopenRequestMessage("Please reopen this")).toBe(false);
    });

    it("should return false for an empty string", () => {
      expect(isReopenRequestMessage("")).toBe(false);
    });

    it("should return false for different casing", () => {
      expect(isReopenRequestMessage("[reopen_request] Please reopen this")).toBe(false);
    });

    it("should return false for non-string inputs", () => {
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
    it("should return the trimmed message when the prefix is present at the start", () => {
      expect(formatTicketMessage(`${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe("Please reopen this");
    });

    it("should return an empty string when the message is exactly the prefix", () => {
      expect(formatTicketMessage(REOPEN_REQUEST_PREFIX)).toBe("");
    });

    it("should return the original string if the prefix is not at the start", () => {
      expect(formatTicketMessage(`Hello ${REOPEN_REQUEST_PREFIX} Please reopen this`)).toBe(`Hello ${REOPEN_REQUEST_PREFIX} Please reopen this`);
    });

    it("should return the original string if there is no prefix", () => {
      expect(formatTicketMessage("Please reopen this")).toBe("Please reopen this");
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
