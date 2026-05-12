import React, { useState, useEffect, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPost } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { FormDialog } from "../components/FormDialog.js";
import { palette } from "../theme.js";

interface BillingScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function BillingScreen({ toast }: BillingScreenProps) {
  const [stats, setStats] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"overview" | "transactions">("overview");
  const [focusZone, setFocusZone] = useState<"list" | "detail">("list");

  useKeyboard((key) => {
    if (dialog) return;
    if (tab === "transactions") {
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
    }
  });

  useEffect(() => {
    apiGet<any>("/api/admin/billing/stats")
      .then((res) => setStats(res.stats || null))
      .catch(() => {});
  }, [refreshKey]);

  const doAdjust = useCallback(
    async (vals: Record<string, string>) => {
      try {
        await apiPost("/api/admin/billing/transactions", {
          userId: vals.userId,
          amount: parseFloat(vals.amount),
          type: vals.type || "credit",
          description: vals.description || "Admin adjustment via CLI",
        });
        toast("Adjustment applied");
        setDialog(null);
        setRefreshKey((k) => k + 1);
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [toast],
  );

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ paddingLeft: 1, paddingTop: 1, flexDirection: "row", gap: 2 }}>
        {(["overview", "transactions"] as const).map((t) => (
          <box
            key={t}
            style={{
              paddingLeft: 1,
              paddingRight: 1,
              borderStyle: "single",
              borderColor: tab === t ? palette.primary : palette.border,
              height: 1,
            }}
            onMouseDown={() => setTab(t)}
          >
            <text fg={tab === t ? palette.primary : palette.textMuted} content={t} />
          </box>
        ))}
        <box
          style={{ paddingLeft: 1, paddingRight: 1, borderStyle: "single", borderColor: palette.success, height: 1 }}
          onMouseDown={() => setDialog("adjust")}
        >
          <text fg={palette.success} content="+ Adjust" />
        </box>
      </box>

      {tab === "overview" && stats && (
        <box style={{ padding: 1, flexDirection: "column" }}>
          <DetailPanel
            title="Billing Overview"
            focused={!dialog}
            fields={[
              { label: "Total Revenue", value: `$${stats.totalRevenue?.toFixed(2) || "0.00"}`, color: palette.success },
              { label: "Wallet Total", value: `$${stats.totalWalletBalance?.toFixed(2) || "0.00"}` },
              { label: "Transactions", value: String(stats.totalTransactions || 0) },
              { label: "Low Balance", value: String(stats.lowBalanceCount || 0), color: palette.warning },
              ...(stats.monthlyRevenue || []).slice(0, 6).map((m: any) => ({
                label: m.month || "-",
                value: `$${(m.amount || 0).toFixed(2)}`,
              })),
            ]}
          />
        </box>
      )}

      {tab === "transactions" && (
        <DataTable
          endpoint="/api/admin/billing/transactions"
          dataKey="transactions"
          title="Transactions"
          focused={focusZone === "list" && !dialog}
          columns={[
            { key: "id", label: "ID", width: 12, render: (v: string) => v?.slice(0, 8) || "-" },
            { key: "amount", label: "Amount", width: 10, render: (v: number) => `$${(v || 0).toFixed(2)}` },
            { key: "status", label: "Status", width: 12 },
            { key: "description", label: "Description", width: 30, render: (v: string) => (v || "").slice(0, 28) },
            { key: "created_at", label: "Date", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
          ]}
          onRowSelect={setSelected}
          onRefresh={refreshKey}
        />
      )}

      {dialog === "adjust" && (
        <FormDialog
          title="Manual Adjustment"
          fields={[
            { key: "userId", label: "User ID", placeholder: "UUID" },
            { key: "amount", label: "Amount", placeholder: "25.00" },
            { key: "type", label: "Type", placeholder: "credit or debit" },
            { key: "description", label: "Description", placeholder: "Reason" },
          ]}
          onSubmit={doAdjust}
          onCancel={() => setDialog(null)}
          submitLabel="Apply"
        />
      )}
    </box>
  );
}
