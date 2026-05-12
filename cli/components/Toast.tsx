import React from "react";
import { palette } from "../theme.js";

export interface ToastMessage {
  message: string;
  type: "success" | "error";
}

export function Toast({ message, type }: ToastMessage) {
  const color = type === "error" ? palette.danger : palette.success;
  return (
    <box
      style={{
        position: "absolute",
        bottom: 2,
        right: 2,
        paddingLeft: 1,
        paddingRight: 1,
        height: 1,
        borderStyle: "single",
        borderColor: color,
        backgroundColor: palette.surface,
      }}
    >
      <text fg={color} content={message} />
    </box>
  );
}
