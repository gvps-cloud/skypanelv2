import React, { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet, apiPut, apiDelete } from "../lib/client.js";
import { DataTable } from "../components/DataTable.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { palette, getStatusColor } from "../theme.js";

interface BlogScreenProps {
  toast: (msg: string, type?: "success" | "error") => void;
}

export function BlogScreen({ toast }: BlogScreenProps) {
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

  const doAction = useCallback(
    async (action: string) => {
      if (!selected) return;
      try {
        switch (action) {
          case "publish":
            await apiPut(`/api/admin/blog/posts/${selected.id}`, { status: "published" });
            break;
          case "unpublish":
            await apiPut(`/api/admin/blog/posts/${selected.id}`, { status: "draft" });
            break;
          case "delete":
            await apiDelete(`/api/admin/blog/posts/${selected.id}`);
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
        endpoint="/api/admin/blog/posts"
        dataKey="posts"
        title="Blog Posts"
        focused={focusZone === "list" && !dialog}
        columns={[
          { key: "title", label: "Title", width: 32, render: (v: string) => (v || "").slice(0, 30) },
          { key: "status", label: "Status", width: 12 },
          { key: "author_name", label: "Author", width: 18, render: (v: any, row: any) => v || row.author_email || "-" },
          { key: "category_name", label: "Category", width: 14, render: (v: any, row: any) => v || row.category?.name || "-" },
          { key: "created_at", label: "Created", width: 14, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
        ]}
        onRowSelect={setSelected}
        onRefresh={refreshKey}
      />

      {selected && (
        <box style={{ marginTop: 1 }}>
          <DetailPanel
            title={`Post: ${selected.title}`}
            focused={focusZone === "detail" && !dialog}
            fields={[
              { label: "ID", value: selected.id?.slice(0, 12) || "-" },
              { label: "Title", value: selected.title },
              { label: "Status", value: selected.status || "draft", color: getStatusColor(selected.status || "draft") },
              { label: "Author", value: selected.author_name || selected.author_email || "-" },
              { label: "Category", value: selected.category_name || "-" },
              { label: "Slug", value: selected.slug || "-" },
              { label: "Excerpt", value: (selected.excerpt || "").slice(0, 80) },
              { label: "Created", value: selected.created_at ? new Date(selected.created_at).toLocaleString() : "-" },
            ]}
            actions={[
              ...(selected.status !== "published"
                ? [{ label: "Publish", color: palette.success, handler: () => doAction("publish") }]
                : [{ label: "Unpublish", color: palette.warning, handler: () => doAction("unpublish") }]),
              { label: "Delete", color: palette.danger, handler: () => setDialog("delete") },
            ]}
          />
        </box>
      )}

      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete Post"
          message={`Delete "${selected?.title}"?`}
          onConfirm={() => doAction("delete")}
          onCancel={() => setDialog(null)}
        />
      )}
    </box>
  );
}
