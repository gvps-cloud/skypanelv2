import React, { useState, useCallback, useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import { apiGet } from "../lib/client.js";
import { palette } from "../theme.js";

interface Column {
  key: string;
  label: string;
  width?: number;
  render?: (val: any, row: any) => string;
}

interface DataTableProps {
  endpoint: string;
  dataKey: string;
  columns: Column[];
  title: string;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowSelect?: (row: any) => void;
  onRefresh?: number;
  filterParams?: Record<string, string>;
  focused?: boolean;
}

export function DataTable({
  endpoint,
  dataKey,
  columns,
  title,
  searchPlaceholder = "Search...",
  pageSize = 50,
  onRowSelect,
  onRefresh,
  filterParams,
  focused = true,
}: DataTableProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), ...filterParams });
      const url = `${endpoint}?${params.toString()}`;
      const res = await apiGet<any>(url);
      const data = res[dataKey] || [];
      setRows(data);
      setTotal(res.total ?? res.pagination?.totalItems ?? data.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, dataKey, pageSize, filterParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData, onRefresh]);

  const filtered = search
    ? rows.filter((row) =>
        columns.some((col) => {
          const val = col.render ? col.render(row[col.key], row) : String(row[col.key] || "");
          return val.toLowerCase().includes(search.toLowerCase());
        }),
      )
    : rows;

  const clamp = useCallback(
    (idx: number) => {
      const len = filtered.length;
      if (len === 0) return 0;
      if (idx < 0) return 0;
      if (idx >= len) return len - 1;
      return idx;
    },
    [filtered.length],
  );

  useKeyboard(
    (key) => {
      if (!focused) return;
      if (key.name === "up" || key.name === "k") {
        setSelectedIdx((prev) => clamp(prev - 1));
        return;
      }
      if (key.name === "down" || key.name === "j") {
        setSelectedIdx((prev) => clamp(prev + 1));
        return;
      }
      if (key.name === "return") {
        const row = filtered[selectedIdx];
        if (row) onRowSelect?.(row);
        return;
      }
    },
  );

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }} padding={1}>
      <box style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 1 }}>
        <text fg={palette.primary} content={`${title} (${total})`} />
        <box style={{ width: 30, height: 1, borderStyle: "single", borderColor: palette.border }}>
          <input
            placeholder={searchPlaceholder}
            value={search}
            onInput={setSearch}
            width={28}
            backgroundColor={palette.bg}
            focusedBackgroundColor={palette.surface}
            textColor={palette.text}
          />
        </box>
      </box>

      {loading && <text fg={palette.warning} content="Loading..." />}
      {error && <text fg={palette.danger} content={`Error: ${error}`} />}

      {!loading && !error && (
        <>
          <box style={{ flexDirection: "row", height: 1, marginBottom: 0 }}>
            {columns.map((col) => (
              <text
                key={col.key}
                fg={palette.textMuted}
                content={col.label.padEnd(col.width || 20).slice(0, col.width || 20)}
              />
            ))}
          </box>
          <box style={{ height: 1, backgroundColor: palette.divider }}>
            <text content={" ".repeat(120)} />
          </box>
          <scrollbox style={{ flexGrow: 1 }} viewportCulling scrollY>
            {filtered.map((row, idx) => {
              const isSelected = idx === selectedIdx;
              return (
                <box
                  key={row.id || idx}
                  style={{
                    flexDirection: "row",
                    height: 1,
                    backgroundColor: isSelected ? palette.selectedBg : idx % 2 === 0 ? "transparent" : palette.bg,
                  }}
                  onMouseDown={() => {
                    setSelectedIdx(idx);
                    onRowSelect?.(row);
                  }}
                >
                  {columns.map((col) => {
                    const val = col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "-");
                    return (
                      <text
                        key={col.key}
                        fg={isSelected ? palette.selectedText : palette.text}
                        content={val.padEnd(col.width || 20).slice(0, col.width || 20)}
                      />
                    );
                  })}
                </box>
              );
            })}
          </scrollbox>
          {filtered.length > 0 && onRowSelect && (
            <box style={{ height: 1, marginTop: 1 }}>
              <text fg={palette.textDisabled} content={`Up/Down navigate | Enter: select | Tab: actions | Showing ${filtered.length} of ${total}`} />
            </box>
          )}
        </>
      )}
    </box>
  );
}
