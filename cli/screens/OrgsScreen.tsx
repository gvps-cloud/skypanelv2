import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiPost, apiPut, apiDelete } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { FormDialog } from "../components/FormDialog.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette } from "../theme.js";

interface OrgsScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function OrgsScreen({ toast }: OrgsScreenProps) {
  const [selected, setSelected] = useState<any>(null);
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
      }
    }
  });

  const handleSelect = useCallback((row: any) => {
    setSelected(row);
    setFocusZone("detail");
  }, []);

  const doAction = useCallback(
    async (action: string, payload?: any) => {
      if (!selected) return;
      try {
        switch (action) {
          case "create":
            await apiPost("/api/admin/organizations", payload);
            break;
          case "update":
            await apiPut(`/api/admin/organizations/${selected.id}`, payload);
            break;
          case "delete":
            await apiDelete(`/api/admin/organizations/${selected.id}`);
            break;
          case "add-member":
            await apiPost(`/api/admin/organizations/${selected.id}/members`, payload);
            break;
        }
        toast(`${action} succeeded`);
        setDialog(null);
        setRefreshKey((k) => k + 1);
        setSelected(null);
        setFocusZone("list");
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [selected, toast],
  );

  const members = selected?.members || [];

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ paddingLeft: 1, paddingTop: 1, flexDirection: "row", gap: 2 }}>
        <box
          style={{ paddingLeft: 1, paddingRight: 1, borderStyle: "single", borderColor: palette.success, height: 1 }}
          onMouseDown={() => setDialog("create")}
        >
          <text fg={palette.success} content="+ New Org" />
        </box>
      </box>

      <DataTable
        endpoint="/api/admin/organizations"
        dataKey="organizations"
        title="Organizations"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "name", label: "Name", width: 24 },
          { key: "slug", label: "Slug", width: 18 },
          { key: "ownerEmail", label: "Owner", width: 26, render: (_v: any, row: any) => row.ownerName || row.ownerEmail || "-" },
          { key: "memberCount", label: "Members", width: 8 },
          { key: "createdAt", label: "Created", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
        ]}
        onRowSelect={handleSelect}
        onRefresh={refreshKey}
      />

      {selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`Organization: ${selected.name}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Name", value: selected.name },
              { label: "Slug", value: selected.slug || "-" },
              { label: "Owner", value: selected.ownerName || selected.ownerEmail || "-" },
              { label: "Members", value: String(selected.memberCount || 0) },
              ...(members.slice(0, 5).map((m: any, i: number) => ({
                label: `Member ${i + 1}`,
                value: `${m.userName || m.userEmail || m.userId?.slice(0, 8)} (${m.role || "member"})`,
              }))),
              ...(members.length > 5 ? [{ label: "...", value: `+${members.length - 5} more` }] : []),
            ]}
            actions={[
              { label: "Edit", color: palette.primary, handler: () => setDialog("update") },
              { label: "Add Member", color: palette.success, handler: () => setDialog("add-member") },
              { label: "Delete", color: palette.danger, handler: () => setDialog("delete") },
            ]}
          />
        </box>
      )}

      {dialog === "create" && (
        <FormDialog
          title="Create Organization"
          fields={[
            { key: "name", label: "Name", placeholder: "Organization name" },
            { key: "slug", label: "Slug", placeholder: "url-friendly-slug" },
            { key: "ownerId", label: "Owner User ID", placeholder: "UUID of owner" },
          ]}
          onSubmit={(vals) => doAction("create", vals)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "update" && (
        <FormDialog
          title="Update Organization"
          fields={[{ key: "name", label: "Name", defaultValue: selected?.name }]}
          onSubmit={(vals) => doAction("update", vals)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "add-member" && (
        <FormDialog
          title="Add Member"
          fields={[
            { key: "userId", label: "User ID", placeholder: "UUID of user" },
            { key: "role", label: "Role", placeholder: "member (default)" },
          ]}
          onSubmit={(vals) => doAction("add-member", vals)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete Organization"
          message={`Permanently delete "${selected?.name}" and all its data?`}
          onConfirm={() => doAction("delete")}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
