import React, { useState, useEffect, useCallback } from "react";
import { apiGet, apiPut } from "../lib/client.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette } from "../theme.js";

interface PlatformScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function PlatformScreen({ toast }: PlatformScreenProps) {
  const [health, setHealth] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<boolean>(false);
  const [registrationDisabled, setRegistrationDisabled] = useState<boolean>(false);
  const [dialog, setDialog] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    apiGet<any>("/api/health/detailed")
      .then(setHealth)
      .catch(() => {});
    apiGet<any>("/api/admin/platform/maintenance")
      .then((res) => {
        setMaintenance(res.maintenanceMode || false);
        setRegistrationDisabled(res.registrationDisabled || false);
      })
      .catch(() => {});
  }, [refreshKey]);

  const toggle = useCallback(
    async (setting: string, current: boolean) => {
      const next = !current;
      try {
        if (setting === "maintenance") {
          await apiPut("/api/admin/platform/maintenance", { maintenanceMode: next });
          setMaintenance(next);
        } else if (setting === "registration") {
          await apiPut("/api/admin/platform/maintenance", { registrationDisabled: next });
          setRegistrationDisabled(next);
        }
        toast(`${setting} is now ${next ? "on" : "off"}`);
        setDialog(null);
      } catch (err: any) {
        toast(err.message, "error");
      }
    },
    [toast],
  );

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 1, gap: 1 }}>
      <DetailPanel
        title="Platform Controls"
        focused={!dialog}
        fields={[
          { label: "Maintenance", value: maintenance ? "ON" : "OFF", color: maintenance ? palette.danger : palette.success },
          { label: "Registration", value: registrationDisabled ? "Disabled" : "Enabled", color: registrationDisabled ? palette.danger : palette.success },
        ]}
        actions={[
          { label: `Turn ${maintenance ? "Off" : "On"} Maintenance`, color: maintenance ? palette.success : palette.danger, handler: () => setDialog("maintenance") },
          { label: `${registrationDisabled ? "Enable" : "Disable"} Registration`, color: registrationDisabled ? palette.success : palette.danger, handler: () => setDialog("registration") },
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

      {dialog === "maintenance" && (
        <ConfirmDialog
          title="Toggle Maintenance Mode"
          message={`${maintenance ? "Disable" : "Enable"} maintenance mode?`}
          onConfirm={() => toggle("maintenance", maintenance)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "registration" && (
        <ConfirmDialog
          title="Toggle Registration"
          message={`${registrationDisabled ? "Enable" : "Disable"} user registration?`}
          onConfirm={() => toggle("registration", registrationDisabled)}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
