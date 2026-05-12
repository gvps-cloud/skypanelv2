import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { palette } from "../theme.js";

interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  secret?: boolean;
}

interface FormDialogProps {
  title: string;
  fields: FormField[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function FormDialog({
  title,
  fields,
  onSubmit,
  onCancel,
  submitLabel = "Submit",
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = f.defaultValue || "";
    return init;
  });
  const [focusIdx, setFocusIdx] = useState(0);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
      return;
    }
    if (key.name === "tab") {
      setFocusIdx((prev) => (prev + 1) % (fields.length + 2));
    }
    if (key.name === "return") {
      if (focusIdx === fields.length) {
        onSubmit(values);
      } else if (focusIdx === fields.length + 1) {
        onCancel();
      }
    }
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 3,
        right: 2,
        width: 50,
        backgroundColor: palette.surface,
        borderStyle: "rounded",
        borderColor: palette.primary,
        padding: 1,
        flexDirection: "column",
        gap: 1,
      }}
    >
      <text fg={palette.primary} content={title} />
      {fields.map((field, idx) => (
        <box key={field.key} style={{ flexDirection: "column", gap: 0 }}>
          <text fg={palette.textMuted} content={`${field.label}:`} />
          <box style={{ height: 1, borderStyle: "single", borderColor: focusIdx === idx ? palette.primary : palette.border }}>
            <input
              placeholder={field.placeholder || ""}
              width={44}
              value={values[field.key]}
              onInput={(val: string) => setValues((prev) => ({ ...prev, [field.key]: val }))}
              focused={focusIdx === idx}
              backgroundColor={palette.bg}
              focusedBackgroundColor={palette.surface}
              textColor={palette.text}
            />
          </box>
        </box>
      ))}
      <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            borderStyle: "single",
            borderColor: focusIdx === fields.length ? palette.success : palette.border,
            backgroundColor: focusIdx === fields.length ? palette.success : "transparent",
            height: 1,
          }}
          onMouseDown={() => onSubmit(values)}
        >
          <text fg={focusIdx === fields.length ? palette.selectedText : palette.success} content={submitLabel} />
        </box>
        <box
          style={{
            paddingLeft: 2,
            paddingRight: 2,
            borderStyle: "single",
            borderColor: focusIdx === fields.length + 1 ? palette.danger : palette.border,
            backgroundColor: focusIdx === fields.length + 1 ? palette.danger : "transparent",
            height: 1,
          }}
          onMouseDown={onCancel}
        >
          <text fg={focusIdx === fields.length + 1 ? palette.selectedText : palette.danger} content="Cancel" />
        </box>
      </box>
    </box>
  );
}
