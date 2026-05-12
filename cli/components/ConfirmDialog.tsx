import React from "react";
import { useKeyboard } from "@opentui/react";
import { palette } from "../theme.js";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  useKeyboard((key) => {
    if (key.name === "escape") onCancel();
    if (key.name === "y") onConfirm();
    if (key.name === "n") onCancel();
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 5,
        right: 4,
        width: 45,
        backgroundColor: palette.surface,
        borderStyle: "rounded",
        borderColor: palette.danger,
        padding: 1,
        flexDirection: "column",
        gap: 1,
      }}
    >
      <text fg={palette.danger} content={`! ${title}`} />
      <text fg={palette.text} content={message} />
      <box style={{ flexDirection: "row", gap: 2 }}>
        <box
          style={{ paddingLeft: 2, paddingRight: 2, borderStyle: "single", borderColor: palette.danger, height: 1 }}
          onMouseDown={onConfirm}
        >
          <text fg={palette.danger} content="Yes (y)" />
        </box>
        <box
          style={{ paddingLeft: 2, paddingRight: 2, borderStyle: "single", borderColor: palette.textMuted, height: 1 }}
          onMouseDown={onCancel}
        >
          <text fg={palette.textMuted} content="No (n)" />
        </box>
      </box>
    </box>
  );
}
