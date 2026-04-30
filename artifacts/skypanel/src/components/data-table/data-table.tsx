import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  Row,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination.js";
import { DataTableSkeleton } from "./data-table-skeleton.js";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  pageSize?: number;
  onSelectionChange?: (selectedRows: TData[]) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: Dispatch<SetStateAction<RowSelectionState>>;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  emptyState,
  isLoading = false,
  pageSize = 10,
  onSelectionChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [uncontrolledRowSelection, setUncontrolledRowSelection] = useState<RowSelectionState>({});

  const rowSelection = controlledRowSelection ?? uncontrolledRowSelection;

  const updateRowSelection = (updater: RowSelectionState | ((selection: RowSelectionState) => RowSelectionState)) => {
    const previous = controlledRowSelection ?? uncontrolledRowSelection;
    const next = typeof updater === "function" ? (updater as (selection: RowSelectionState) => RowSelectionState)(previous) : updater;
    if (controlledRowSelection === undefined) {
      setUncontrolledRowSelection(next);
    }
    onRowSelectionChange?.(next);
  };

  const memoData = useMemo(() => data, [data]);

  const table = useReactTable({
    data: memoData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: updateRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
  });

  useEffect(() => {
    table.setPageSize(pageSize);
  }, [table, pageSize]);

  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  const columnCount = columns.length || 1;
  const hasRows = table.getRowModel().rows.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border border-border bg-card">
        {/* Mobile-friendly horizontal scroll wrapper */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <div className="min-w-full" style={{ touchAction: 'pan-x' }}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead 
                      key={header.id} 
                      className={cn(
                        "whitespace-nowrap",
                        header.column.columnDef.meta?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <DataTableSkeleton columns={columnCount} />
                ) : hasRows ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id}
                          className={cn(
                            cell.column.columnDef.meta?.className
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="h-24 text-center">
                      {emptyState ?? (
                        <div className="text-sm text-muted-foreground">
                          No data available.
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
