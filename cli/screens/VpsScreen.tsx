import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPost, apiDelete } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette, getStatusColor } from "../theme.js";

interface VpsScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function VpsScreen({ toast }: VpsScreenProps) {
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

  const doPower = useCallback(
    async (action: string) => {
      if (!selected) return;
      try {
        await apiPost(`/api/admin/servers/${selected.id}/${action}`);
        toast(`${action} sent to ${selected.label}`);
        setRefreshKey((k) => k + 1);
        setSelected(null);
        setFocusZone("list");
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [selected, toast],
  );

  const doDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await apiDelete(`/api/admin/servers/${selected.id}`);
      toast("Server deleted");
      setDialog(null);
      setRefreshKey((k) => k + 1);
      setSelected(null);
      setFocusZone("list");
    } catch (err: any) {
      toast(err.message, "error");
    }
  }, [selected, toast]);

  const config = selected?.configuration || {};

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <DataTable
        endpoint="/api/admin/servers"
        dataKey="servers"
        title="Servers"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "label", label: "Label", width: 22 },
          { key: "status", label: "Status", width: 12, render: (v: string) => v || "unknown" },
          { key: "ip_address", label: "IP", width: 18, render: (v: string) => v || "N/A" },
          { key: "provider_name", label: "Provider", width: 12, render: (v: string, row: any) => v || row.provider_type || "-" },
          { key: "organization_name", label: "Org", width: 16, render: (v: string) => v || "-" },
        ]}
        onRowSelect={handleSelect}
        onRefresh={refreshKey}
      />

      {selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`Server: ${selected.label}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Label", value: selected.label },
              { label: "Status", value: selected.status || "unknown", color: getStatusColor(selected.status) },
              { label: "IP", value: selected.ip_address || "N/A" },
              { label: "Provider", value: selected.provider_name || selected.provider_type || "-" },
              { label: "Org", value: selected.organization_name || "-" },
              { label: "Owner", value: selected.owner_email || selected.owner_name || "-" },
              { label: "Region", value: config.region || selected.region_label || "-" },
              { label: "Type", value: config.type || "-" },
              { label: "Image", value: config.image || "-" },
              { label: "Created", value: selected.created_at ? new Date(selected.created_at).toLocaleString() : "-" },
            ]}
            actions={[
              { label: "Boot", color: palette.success, handler: () => doPower("boot") },
              { label: "Shutdown", color: palette.warning, handler: () => doPower("shutdown") },
              { label: "Reboot", color: palette.primary, handler: () => doPower("reboot") },
              { label: "Delete", color: palette.danger, handler: () => setDialog("delete") },
            ]}
          />
        </box>
      )}

      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete Server"
          message={`Permanently delete "${selected?.label}" (${selected?.ip_address || "no IP"})?`}
          onConfirm={doDelete}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
