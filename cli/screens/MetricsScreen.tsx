import React, { useState, useEffect } from "react";
import { apiGet } from "../lib/client.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { palette } from "../theme.js";

interface MetricsScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function MetricsScreen({ toast }: MetricsScreenProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    apiGet<any>("/api/health/detailed")
      .then(setHealth)
      .catch(() => {});
    apiGet<any>("/api/health/metrics")
      .then(setMetrics)
      .catch(() => {});
    apiGet<any>("/api/admin/billing/stats")
      .then((res) => setBilling(res.stats || null))
      .catch(() => {});
  }, [refreshKey]);

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 1, gap: 1 }}>
      <DetailPanel
        title="Platform Overview"
        focused
        fields={[
          { label: "Total Users", value: String(metrics?.users?.total || metrics?.totalUsers || "-"), color: palette.primary },
          { label: "Total Orgs", value: String(metrics?.organizations?.total || metrics?.totalOrgs || "-"), color: palette.primary },
          { label: "Active VPS", value: String(metrics?.vps?.active || metrics?.totalVps || "-"), color: palette.success },
          { label: "Hosting Active", value: String(metrics?.hosting?.active || metrics?.totalHosting || "-"), color: palette.success },
          { label: "Open Tickets", value: String(metrics?.tickets?.open || metrics?.openTickets || "-"), color: palette.warning },
          ...(billing ? [
            { label: "Revenue", value: `$${(billing.totalRevenue || 0).toFixed(2)}`, color: palette.success },
            { label: "Wallet Balance", value: `$${(billing.totalWalletBalance || 0).toFixed(2)}` },
            { label: "Transactions", value: String(billing.totalTransactions || 0) },
          ] : []),
        ]}
        actions={[
          { label: "Refresh", color: palette.primary, handler: () => setRefreshKey((k) => k + 1) },
        ]}
      />

      {health && (
        <DetailPanel
          title="System Health"
          fields={[
            { label: "Status", value: health.status || "unknown", color: health.status === "ok" ? palette.success : palette.danger },
            { label: "Uptime", value: health.uptime ? `${Math.floor(health.uptime / 60)}min` : "-" },
            { label: "DB Status", value: health.database?.status || "-", color: health.database?.status === "connected" ? palette.success : palette.danger },
            { label: "Memory", value: health.memory ? `${(health.memory.used / 1024 / 1024).toFixed(0)}MB` : "-" },
          ]}
        />
      )}
    </box>
  );
}
