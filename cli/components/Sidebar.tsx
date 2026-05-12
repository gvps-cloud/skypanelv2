import React from "react";
import { palette } from "../theme.js";

export type ScreenId =
  | "users"
  | "orgs"
  | "vps"
  | "hosting"
  | "tickets"
  | "billing"
  | "platform"
  | "blog"
  | "metrics";

interface NavItem {
  id: ScreenId;
  label: string;
  key: string;
}

const NAV: NavItem[] = [
  { id: "metrics", label: "Dashboard", key: "1" },
  { id: "users", label: "Users", key: "2" },
  { id: "orgs", label: "Orgs", key: "3" },
  { id: "vps", label: "Servers", key: "4" },
  { id: "hosting", label: "Hosting", key: "5" },
  { id: "tickets", label: "Tickets", key: "6" },
  { id: "billing", label: "Billing", key: "7" },
  { id: "platform", label: "Platform", key: "8" },
  { id: "blog", label: "Blog", key: "9" },
];

interface SidebarProps {
  current: ScreenId;
  onSelect: (id: ScreenId) => void;
}

export function Sidebar({ current, onSelect }: SidebarProps) {
  return (
    <box
      style={{
        width: 16,
        flexDirection: "column",
        backgroundColor: palette.surface,
        borderStyle: "single",
        borderColor: palette.border,
      }}
    >
      <box style={{ padding: 1 }}>
        <text fg={palette.primary} content=" SkyPanel" />
      </box>
      <box style={{ height: 1, backgroundColor: palette.divider }}>
        <text content="" />
      </box>
      {NAV.map((item) => {
        const active = current === item.id;
        return (
          <box
            key={item.id}
            style={{
              height: 1,
              paddingLeft: 1,
              backgroundColor: active ? palette.selectedBg : "transparent",
            }}
            onMouseDown={() => onSelect(item.id)}
          >
            <text
              fg={active ? palette.selectedText : palette.textMuted}
              content={`${item.key} ${item.label}`}
            />
          </box>
        );
      })}
      <box style={{ flexGrow: 1 }} />
      <box style={{ height: 1, backgroundColor: palette.divider }}>
        <text content="" />
      </box>
      <box style={{ paddingLeft: 1, height: 1 }}>
        <text fg={palette.textDisabled} content=" ?: help" />
      </box>
    </box>
  );
}
