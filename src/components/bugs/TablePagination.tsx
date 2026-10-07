"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Showing 21–40 of 132" + prev/next, shared by every ticket list. */
export function TablePagination({
  page,
  pages,
  total,
  limit,
  onPage,
  noun = "tickets",
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3 text-[12.5px] text-muted-foreground">
      <p>
        Showing <span className="font-semibold text-foreground">{from}–{to}</span> of <span className="font-semibold text-foreground">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-1.5 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
