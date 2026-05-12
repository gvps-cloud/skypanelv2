export const palette = {
  bg: "#0d1117",
  surface: "#161b22",
  surfaceHover: "#1f242c",
  border: "#30363d",
  borderFocus: "#58a6ff",
  divider: "#21262d",
  text: "#c9d1d9",
  textMuted: "#8b949e",
  textDisabled: "#484f58",
  primary: "#58a6ff",
  success: "#3fb950",
  warning: "#d29922",
  danger: "#f85149",
  info: "#56d4dd",
  selectedBg: "#1f6feb",
  selectedText: "#ffffff",
} as const;

export const statusColors: Record<string, string> = {
  active: palette.success,
  running: palette.success,
  published: palette.success,
  open: palette.success,
  completed: palette.success,
  suspended: palette.danger,
  stopped: palette.danger,
  draft: palette.warning,
  in_progress: palette.primary,
  provisioning: palette.warning,
  cancelled: palette.textDisabled,
  closed: palette.textDisabled,
  resolved: palette.warning,
  failed: palette.danger,
  error: palette.danger,
  refunded: palette.primary,
  pending: palette.warning,
  unknown: palette.textDisabled,
};

export function getStatusColor(status?: string | null): string {
  return statusColors[status || "unknown"] || palette.textMuted;
}
