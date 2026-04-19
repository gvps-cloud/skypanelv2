import type { InstanceEventSummary } from "./types";

interface ActivityTabProps {
  eventFeed: InstanceEventSummary[];
  formatEventAction: (value: string | null | undefined) => string;
  formatStatusLabel: (value: string | null | undefined) => string;
  statusBadgeClasses: (status: string | null | undefined) => string;
  formatDateTime: (value: string | null) => string;
}

export default function ActivityTab({
  eventFeed,
  formatEventAction,
  formatStatusLabel,
  statusBadgeClasses,
  formatDateTime,
}: ActivityTabProps) {
  return (
    <section className="rounded-2xl border border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4 border">
        <h2 className="text-lg font-semibold text-foreground">Provider Activity Feed</h2>
        <p className="text-sm text-muted-foreground">Recent VPS events for this instance.</p>
      </div>
      <div className="px-6 py-5">
        {eventFeed.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {eventFeed.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{formatEventAction(event.action)}</p>
                  <p className="text-xs text-muted-foreground">{event.message || "No additional details provided."}</p>
                  {event.entityLabel && (
                    <p className="text-xs text-muted-foreground">Entity: {event.entityLabel}</p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                  <span>{formatDateTime(event.created)}</span>
                  {event.username && <span>By {event.username}</span>}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${statusBadgeClasses(event.status)}`}>
                    {formatStatusLabel(event.status)}
                  </span>
                  {event.percentComplete !== null && <span>{event.percentComplete}% complete</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-input bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground dark:bg-muted/20 dark:text-muted-foreground">
            No provider events recorded in the last 90 days.
          </div>
        )}
      </div>
    </section>
  );
}
