import { describe, expect, it } from "vitest";

import {
  resolveAutoTerminalTheme,
  resolveTerminalTheme,
  sanitizeTerminalThemePreference,
} from "@/components/VPS/sshTerminalThemes";

describe("sshTerminalThemes", () => {
  it("defaults auto mode to matrix in dark mode", () => {
    expect(resolveAutoTerminalTheme("dark")).toBe("matrix");
    expect(resolveTerminalTheme("auto", "dark")).toBe("matrix");
  });

  it("defaults auto mode to light in light mode", () => {
    expect(resolveAutoTerminalTheme("light")).toBe("light");
    expect(resolveTerminalTheme("auto", "light")).toBe("light");
  });

  it("preserves explicit terminal theme selections", () => {
    expect(resolveTerminalTheme("dark", "light")).toBe("dark");
    expect(resolveTerminalTheme("light", "dark")).toBe("light");
    expect(resolveTerminalTheme("matrix", "light")).toBe("matrix");
  });

  it("falls back invalid saved preferences to auto", () => {
    expect(sanitizeTerminalThemePreference("auto")).toBe("auto");
    expect(sanitizeTerminalThemePreference("matrix")).toBe("matrix");
    expect(sanitizeTerminalThemePreference("bogus")).toBe("auto");
    expect(sanitizeTerminalThemePreference(null)).toBe("auto");
  });
});
