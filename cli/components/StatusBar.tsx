import React from "react";
import { palette } from "../theme.js";

export function StatusBar({ user }: { user: { email: string; role: string } }) {
  return (
    <box
      style={{
        height: 1,
        flexDirection: "row",
        backgroundColor: palette.surface,
        borderStyle: "single",
        borderColor: palette.border,
        paddingLeft: 1,
        paddingRight: 1,
        justifyContent: "space-between",
      }}
    >
      <text fg={palette.textMuted} content={`${user.email} (${user.role})`} />
      <text fg={palette.textDisabled} content="SkyPanel Admin TUI v2.0" />
    </box>
  );
}
