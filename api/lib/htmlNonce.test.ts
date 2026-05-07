import { describe, expect, it } from "vitest";

import { addNonceToInlineScripts } from "./htmlNonce.js";

describe("addNonceToInlineScripts", () => {
  it("adds a nonce to inline scripts without duplicating existing nonces", () => {
    const html = [
      '<script>window.a = 1;</script>',
      '<script nonce="existing">window.b = 2;</script>',
      '<script src="/theme-init.js"></script>',
    ].join("");

    expect(addNonceToInlineScripts(html, "abc123")).toBe(
      [
        '<script nonce="abc123">window.a = 1;</script>',
        '<script nonce="existing">window.b = 2;</script>',
        '<script src="/theme-init.js"></script>',
      ].join(""),
    );
  });

  it("leaves html unchanged when no nonce is available", () => {
    const html = '<script>window.a = 1;</script>';

    expect(addNonceToInlineScripts(html, "")).toBe(html);
  });
});
