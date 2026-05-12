import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPost } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { FormDialog } from "../components/FormDialog.js";
import { palette, getStatusColor } from "../theme.js";

interface HostingScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function HostingScreen({ toast }: HostingScreenProps) {
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
          case "suspend":
            await apiPost(`/api/admin/enhance/subscriptions/${selected.id}/suspend`, payload);
            break;
          case "unsuspend":
            await apiPost(`/api/admin/enhance/subscriptions/${selected.id}/unsuspend`);
            break;
          case "retry-billing":
            await apiPost(`/api/admin/enhance/subscriptions/${selected.id}/retry-billing`);
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

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <DataTable
        endpoint="/api/admin/enhance/subscriptions"
        dataKey="subscriptions"
        title="Hosting Subscriptions"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "domain", label: "Domain", width: 26 },
          { key: "status", label: "Status", width: 14 },
          { key: "plan_name", label: "Plan", width: 16, render: (v: any, row: any) => v || row.plan?.name || "-" },
          { key: "organization_name", label: "Org", width: 14, render: (v: any, row: any) => v || row.organization_id?.slice(0, 8) || "-" },
          { key: "created_at", label: "Created", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
        ]}
        onRowSelect={handleSelect}
        onRefresh={refreshKey}
      />

      {selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`Hosting: ${selected.domain}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Domain", value: selected.domain || "-" },
              { label: "Status", value: selected.status, color: getStatusColor(selected.status) },
              { label: "Plan", value: selected.plan_name || "-" },
              { label: "Enhance Sub ID", value: selected.enhance_subscription_id || "-" },
              { label: "Enhance Site ID", value: selected.enhance_website_id || "-" },
              { label: "Next Billing", value: selected.next_billing_at ? new Date(selected.next_billing_at).toLocaleDateString() : "-" },
              { label: "Created", value: selected.created_at ? new Date(selected.created_at).toLocaleString() : "-" },
            ]}
            actions={[
              { label: "Suspend", color: palette.danger, handler: () => setDialog("suspend") },
              { label: "Unsuspend", color: palette.success, handler: () => doAction("unsuspend") },
              { label: "Retry Billing", color: palette.warning, handler: () => doAction("retry-billing") },
            ]}
          />
        </box>
      )}

      {dialog === "suspend" && (
        <FormDialog
          title="Suspend Subscription"
          fields={[{ key: "reason", label: "Reason", placeholder: "Reason for suspension" }]}
          onSubmit={(vals) => doAction("suspend", vals)}
          onCancel={() => setDialog(null)}
          submitLabel="Suspend"
        />
      )}
    </box>
  );
}
