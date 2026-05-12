import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPut, apiDelete } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { FormDialog } from "../components/FormDialog.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette, getStatusColor } from "../theme.js";

interface UsersScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function UsersScreen({ toast }: UsersScreenProps) {
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
        setDetail(null);
      }
    }
  });

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await apiGet<any>(`/api/admin/users/${id}/detail`);
      setDetail(res.user);
    } catch {}
  }, []);

  const handleSelect = useCallback(
    (row: any) => {
      setSelected(row);
      fetchDetail(row.id);
      setFocusZone("detail");
    },
    [fetchDetail],
  );

  const doAction = useCallback(
    async (action: string, payload?: any) => {
      if (!selected) return;
      try {
        switch (action) {
          case "role":
            await apiPut(`/api/admin/users/${selected.id}`, { role: payload?.role });
            break;
          case "delete":
            await apiDelete(`/api/admin/users/${selected.id}`);
            break;
        }
        toast(`${action} succeeded`);
        setDialog(null);
        setRefreshKey((k) => k + 1);
        setSelected(null);
        setDetail(null);
        setFocusZone("list");
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [selected, toast],
  );

  const statusColor = (s: string) => getStatusColor(s || "active");

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <DataTable
        endpoint="/api/admin/users"
        dataKey="users"
        title="Users"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "email", label: "Email", width: 32 },
          { key: "name", label: "Name", width: 20 },
          { key: "role", label: "Role", width: 10 },
          { key: "status", label: "Status", width: 12, render: (v: string) => v || "active" },
          { key: "created_at", label: "Created", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
        ]}
        onRowSelect={handleSelect}
        onRefresh={refreshKey}
      />

      {detail && selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`User: ${selected.email}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Email", value: selected.email },
              { label: "Name", value: selected.name || "-" },
              { label: "Role", value: selected.role, color: selected.role === "admin" ? palette.warning : palette.text },
              { label: "Status", value: selected.status || "active", color: statusColor(selected.status || "active") },
              { label: "Phone", value: selected.phone || detail.phone || "-" },
              { label: "Timezone", value: selected.timezone || detail.timezone || "-" },
              { label: "VPS Count", value: String(detail.activity_summary?.vps_count || 0) },
              ...(detail.organizations || []).slice(0, 3).map((org: any, i: number) => ({
                label: `Org ${i + 1}`,
                value: `${org.organizationName || org.name || org.id?.slice(0, 8)} (${org.role || "member"})`,
              })),
            ]}
            actions={[
              { label: "Set Role", color: palette.primary, handler: () => setDialog("role") },
              { label: "Delete", color: palette.danger, handler: () => setDialog("delete") },
            ]}
          />
        </box>
      )}

      {dialog === "role" && (
        <FormDialog
          title="Change Role"
          fields={[{ key: "role", label: "Role", placeholder: "admin or user", defaultValue: selected?.role }]}
          onSubmit={(vals) => doAction("role", vals)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete User"
          message={`Permanently delete ${selected?.email}?`}
          onConfirm={() => doAction("delete")}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
