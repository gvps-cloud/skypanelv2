import type { ITerminalOptions } from "xterm";

export type SiteColorMode = "light" | "dark";
export type TerminalThemeName = "dark" | "light" | "matrix";
export type TerminalThemePreference = "auto" | TerminalThemeName;

type TerminalPalette = NonNullable<ITerminalOptions["theme"]>;

export const SSH_TERMINAL_THEME_STORAGE_KEY = "skypanelv2:ssh-terminal-theme";

export const TERMINAL_THEMES: Record<TerminalThemeName, TerminalPalette> = {
  dark: {
    background: "#111827",
    foreground: "#e5e7eb",
    cursor: "#93c5fd",
    black: "#000000",
    red: "#ef4444",
    green: "#10b981",
    yellow: "#f59e0b",
    blue: "#3b82f6",
    magenta: "#8b5cf6",
    cyan: "#06b6d4",
    white: "#f3f4f6",
    brightBlack: "#6b7280",
    brightRed: "#f87171",
    brightGreen: "#34d399",
    brightYellow: "#fbbf24",
    brightBlue: "#60a5fa",
    brightMagenta: "#a78bfa",
    brightCyan: "#22d3ee",
    brightWhite: "#ffffff",
  },
  light: {
    background: "#ffffff",
    foreground: "#1f2937",
    cursor: "#3b82f6",
    black: "#000000",
    red: "#dc2626",
    green: "#059669",
    yellow: "#d97706",
    blue: "#2563eb",
    magenta: "#7c3aed",
    cyan: "#0891b2",
    white: "#f9fafb",
    brightBlack: "#6b7280",
    brightRed: "#ef4444",
    brightGreen: "#10b981",
    brightYellow: "#f59e0b",
    brightBlue: "#3b82f6",
    brightMagenta: "#8b5cf6",
    brightCyan: "#06b6d4",
    brightWhite: "#ffffff",
  },
  matrix: {
    background: "#000000",
    foreground: "#00ff00",
    cursor: "#00ff00",
    black: "#000000",
    red: "#00ff00",
    green: "#00ff00",
    yellow: "#00ff00",
    blue: "#00ff00",
    magenta: "#00ff00",
    cyan: "#00ff00",
    white: "#00ff00",
    brightBlack: "#006600",
    brightRed: "#00ff00",
    brightGreen: "#00ff00",
    brightYellow: "#00ff00",
    brightBlue: "#00ff00",
    brightMagenta: "#00ff00",
    brightCyan: "#00ff00",
    brightWhite: "#00ff00",
  },
};

export function sanitizeTerminalThemePreference(
  value: string | null | undefined,
): TerminalThemePreference {
  return value === "auto" ||
    value === "dark" ||
    value === "light" ||
    value === "matrix"
    ? value
    : "auto";
}

export function resolveAutoTerminalTheme(
  siteColorMode: SiteColorMode,
): TerminalThemeName {
  return siteColorMode === "dark" ? "matrix" : "light";
}

export function resolveTerminalTheme(
  preference: TerminalThemePreference,
  siteColorMode: SiteColorMode,
): TerminalThemeName {
  return preference === "auto"
    ? resolveAutoTerminalTheme(siteColorMode)
    : preference;
}
