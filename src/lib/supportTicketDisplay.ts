/** Safe date labels for ticket sidebars / metadata (never blank for valid ISO strings). */
export function formatTicketDateTimeLabel(
  value: string | null | undefined,
): string {
  if (value == null || String(value).trim() === "") return "—";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatTicketDateLabel(
  value: string | null | undefined,
): string {
  if (value == null || String(value).trim() === "") return "—";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}
