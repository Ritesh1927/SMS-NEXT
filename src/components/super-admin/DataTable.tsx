"use client";

import { useState, type ReactNode } from "react";
import { Columns3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Enterprise table: sticky header, row hover, column visibility and CSV
// export of exactly what's on screen. Rendering only -- data, filtering and
// actions stay with the page.

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Plain value for CSV export (omit to leave the column out of exports). */
  csv?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  /** Can't be hidden from the Columns menu. */
  pinned?: boolean;
  defaultHidden?: boolean;
}

export function useColumnVisibility<T>(columns: Column<T>[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)));
  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { visible: columns.filter((c) => !hidden.has(c.id)), hidden, toggle };
}

export function ColumnsMenu<T>({ columns, hidden, onToggle }: { columns: Column<T>[]; hidden: Set<string>; onToggle: (id: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-10 rounded-xl" />}>
        <Columns3 /> <span className="hidden sm:inline">Columns</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.filter((c) => !c.pinned).map((c) => (
          <DropdownMenuCheckboxItem key={c.id} checked={!hidden.has(c.id)} onCheckedChange={() => onToggle(c.id)}>
            {c.header}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Downloads the given rows/columns as a UTF-8 CSV (opens cleanly in Excel). */
export function exportCsv<T>(rows: T[], columns: Column<T>[], filename: string) {
  const exportable = columns.filter((c) => c.csv);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [exportable.map((c) => escape(c.header)).join(","), ...rows.map((r) => exportable.map((c) => escape(c.csv!(r))).join(","))];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" className="h-10 rounded-xl" onClick={onClick} disabled={disabled}>
      <Download /> <span className="hidden sm:inline">Export</span>
    </Button>
  );
}

export function DataTable<T>({
  columns, rows, rowKey, loading, empty, minWidth = 960, maxHeight = "calc(100dvh - 300px)",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty: ReactNode;
  minWidth?: number;
  /** The body scrolls inside this height, keeping the header pinned (sticky). */
  maxHeight?: string;
}) {
  return (
    <div className="overflow-auto overscroll-x-contain" style={{ maxHeight }}>
      <table className="w-full border-separate border-spacing-0 text-left text-[13px]" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={cn(
                  "sticky top-0 z-10 border-b border-border/70 bg-muted/70 px-4 py-3 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase backdrop-blur first:pl-5 last:pr-5",
                  c.headerClassName,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length} className="border-b border-border/50 px-5 py-3">
                  <Skeleton className="h-11 w-full rounded-lg" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="group/row transition-colors hover:bg-primary/[0.03] dark:hover:bg-white/[0.03]">
                {columns.map((c) => (
                  <td key={c.id} className={cn("border-b border-border/50 px-4 py-3.5 align-middle first:pl-5 last:pr-5", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
