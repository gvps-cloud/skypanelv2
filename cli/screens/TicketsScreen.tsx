import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { FormDialog } from "../components/FormDialog.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette, getStatusColor } from "../theme.js";

interface TicketsScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function TicketsScreen({ toast }: TicketsScreenProps) {
  const [selected, setSelected] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [dialog, setDialog] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterStatus, setFilterStatus] = useState("open");
  const [focusZone, setFocusZone] = useState<"list" | "detail">("list");

  useKeyboard((key) => {
    if (dialog) return;
    if (key.name === "tab") {
      setFocusZone((prev) => {
        if (prev === "list" && selected) return "detail";
        return "list";
      });
    }
    if (key.name === "escape") {
      if (focusZone === "detail") {
        setFocusZone("list");
      } else {
        setSelected(null);
        setReplies([]);
      }
    }
  });

  const handleSelect = useCallback(async (row: any) => {
    setSelected(row);
    setFocusZone("detail");
    try {
      const res = await apiGet<any>(`/api/admin/tickets/${row.id}/replies`);
      setReplies(res.replies || []);
    } catch {
      setReplies([]);
    }
  }, []);

  const doAction = useCallback(
    async (action: string, payload?: any) => {
      if (!selected) return;
      try {
        switch (action) {
          case "reply":
            await apiPost(`/api/admin/tickets/${selected.id}/replies`, { message: payload?.message });
            break;
          case "close":
            await apiPatch(`/api/admin/tickets/${selected.id}/status`, { status: "closed" });
            break;
          case "reopen":
            await apiPatch(`/api/admin/tickets/${selected.id}/status`, { status: "open" });
            break;
          case "in_progress":
            await apiPatch(`/api/admin/tickets/${selected.id}/status`, { status: "in_progress" });
            break;
          case "delete":
            await apiDelete(`/api/admin/tickets/${selected.id}`);
            break;
        }
        toast(`${action} succeeded`);
        setDialog(null);
        setRefreshKey((k) => k + 1);
        setSelected(null);
        setReplies([]);
        setFocusZone("list");
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [selected, toast],
  );

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return palette.danger;
      case "high": return palette.warning;
      case "medium": return palette.primary;
      case "low": return palette.textMuted;
      default: return palette.textMuted;
    }
  };

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ paddingLeft: 1, paddingTop: 1, flexDirection: "row", gap: 2 }}>
        {["open", "in_progress", "all"].map((s) => (
          <box
            key={s}
            style={{
              paddingLeft: 1,
              paddingRight: 1,
              borderStyle: "single",
              borderColor: filterStatus === s ? palette.primary : palette.border,
              height: 1,
            }}
            onMouseDown={() => setFilterStatus(s)}
          >
            <text fg={filterStatus === s ? palette.primary : palette.textMuted} content={s} />
          </box>
        ))}
      </box>

      <DataTable
        endpoint="/api/admin/tickets"
        dataKey="tickets"
        title="Support Tickets"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "subject", label: "Subject", width: 30 },
          { key: "priority", label: "Priority", width: 10 },
          { key: "status", label: "Status", width: 14 },
          { key: "category", label: "Category", width: 12 },
          { key: "created_at", label: "Created", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
        ]}
        onRowSelect={handleSelect}
        onRefresh={refreshKey}
        filterParams={filterStatus !== "all" ? { status: filterStatus } : {}}
      />

      {selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`Ticket: ${selected.subject}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Subject", value: selected.subject },
              { label: "Status", value: selected.status, color: getStatusColor(selected.status) },
              { label: "Priority", value: selected.priority, color: priorityColor(selected.priority) },
              { label: "Category", value: selected.category || "-" },
              { label: "Creator", value: selected.creator?.name || selected.creator?.email || "-" },
              { label: "Message", value: (selected.message || "").slice(0, 80) },
              ...(replies.slice(0, 3).map((r: any, i: number) => ({
                label: `Reply ${i + 1}`,
                value: `${r.is_staff_reply ? "[Staff] " : ""}${(r.message || "").slice(0, 60)}`,
                color: r.is_staff_reply ? palette.primary : palette.text,
              }))),
              ...(replies.length > 3 ? [{ label: "...", value: `+${replies.length - 3} more replies` }] : []),
            ]}
            actions={[
              { label: "Reply", color: palette.success, handler: () => setDialog("reply") },
              ...(selected.status !== "closed" ? [{ label: "Close", color: palette.warning, handler: () => doAction("close") }] : []),
              ...(selected.status === "closed" ? [{ label: "Reopen", color: palette.primary, handler: () => doAction("reopen") }] : []),
              ...(selected.status === "open" ? [{ label: "In Progress", color: palette.primary, handler: () => doAction("in_progress") }] : []),
              { label: "Delete", color: palette.danger, handler: () => setDialog("delete") },
            ]}
          />
        </box>
      )}

      {dialog === "reply" && (
        <FormDialog
          title="Reply to Ticket"
          fields={[{ key: "message", label: "Message", placeholder: "Type your reply..." }]}
          onSubmit={(vals) => doAction("reply", vals)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete Ticket"
          message={`Delete ticket "${selected?.subject}"?`}
          onConfirm={() => doAction("delete")}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
