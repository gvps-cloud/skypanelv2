import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { palette } from "../theme.js";

interface Field {
  label: string;
  value: string;
  color?: string;
}

interface DetailPanelProps {
  title: string;
  fields: Field[];
  actions?: { label: string; color?: string; handler: () => void }[];
  focused?: boolean;
}

export function DetailPanel({ title, fields, actions, focused = false }: DetailPanelProps) {
  const [actionIdx, setActionIdx] = useState(0);

  useKeyboard((key) => {
    if (!focused || !actions || actions.length === 0) return;
    if (key.name === "left" || key.name === "h") {
      setActionIdx((prev) => (prev <= 0 ? actions.length - 1 : prev - 1));
    }
    if (key.name === "right" || key.name === "l") {
      setActionIdx((prev) => (prev >= actions.length - 1 ? 0 : prev + 1));
    }
    if (key.name === "return") {
      const action = actions[actionIdx];
      if (action) action.handler();
    }
  });

  return (
    <box style={{ flexDirection: "column", padding: 1 }} borderStyle="single" borderColor={palette.border}>
      <text fg={palette.primary} content={title} />
      <box style={{ height: 1, backgroundColor: palette.divider, marginTop: 1, marginBottom: 1 }}>
        <text content="" />
      </box>
      {fields.map((field, idx) => (
        <box key={idx} style={{ flexDirection: "row", height: 1 }}>
          <text fg={palette.textMuted} content={`${field.label}:`.padEnd(16)} />
          <text fg={field.color || palette.text} content={field.value} />
        </box>
      ))}
      {actions && actions.length > 0 && (
        <>
          <box style={{ height: 1, backgroundColor: palette.divider, marginTop: 1, marginBottom: 1 }}>
            <text content="" />
          </box>
          <box style={{ flexDirection: "row", gap: 2 }}>
            {actions.map((action, idx) => {
              const isActionFocused = focused && idx === actionIdx;
              return (
                <box
                  key={idx}
                  style={{
                    paddingLeft: 1,
                    paddingRight: 1,
                    borderStyle: "single",
                    borderColor: isActionFocused ? palette.selectedText : action.color || palette.border,
                    backgroundColor: isActionFocused ? action.color || palette.border : "transparent",
                    height: 1,
                  }}
                  onMouseDown={action.handler}
                >
                  <text
                    fg={isActionFocused ? palette.selectedText : action.color || palette.text}
                    content={action.label}
                  />
                </box>
              );
            })}
          </box>
          {focused && (
            <box style={{ height: 1, marginTop: 1 }}>
              <text fg={palette.textDisabled} content="Left/Right select action | Enter: execute | Tab: back to list" />
            </box>
          )}
        </>
      )}
    </box>
  );
}
