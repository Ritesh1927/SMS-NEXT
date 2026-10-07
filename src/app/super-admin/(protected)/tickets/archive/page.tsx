"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, BookCheck, CheckCircle2, RefreshCw, School, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import { ROLE_LABELS, TICKET_CATEGORIES } from "@/lib/bugReports/constants";
import { formatDateTime, ticketFetch } from "@/lib/bugReports/client";
import type { Paginated } from "@/lib/bugReports/types";
import { CategoryChip, StatusBadge } from "@/components/bugs/TicketBadges";
import { TablePagination } from "@/components/bugs/TablePagination";
import { TicketsAdminShell } from "@/components/bugs/admin/TicketsAdminShell";

interface ArchiveRow {
  _id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  resolution: string;
  resolvedAt: string | null;
  resolvedBy: string;
  closedAt: string | null;
  status: string;
  isArchived: boolean;
  reporter: { name: string; role: string; schoolName: string };
}

// Super Admin: Solved Tickets Archive -- a searchable record of how past
// issues were fixed, to spot duplicates before working a new ticket.
export default function SolvedArchivePage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<ArchiveRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), limit: "12" });
    if (query) p.set("search", query);
    if (category) p.set("category", category);
    if (archivedOnly) p.set("archivedOnly", "true");
    ticketFetch<Paginated<ArchiveRow>>(getSuperAdminToken, `/superadmin/tickets/archive?${p}`)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the archive."))
      .finally(() => setLoading(false));
  }, [page, query, category, archivedOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load when filters change
    load();
  }, [load]);

  const rows = result?.data ?? [];

  return (
    <TicketsAdminShell>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent p-5 text-white shadow-lg shadow-primary/25 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur"><BookCheck className="h-5 w-5" /></span>
          <div>
            <h2 className="font-heading text-lg font-bold">Solved Tickets Archive</h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-white/85">
              Every resolved and closed ticket with its resolution. Search here before working a new report: it may already be solved.
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/70" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description, resolution, ticket number or school…"
              aria-label="Search solved tickets"
              className="h-11 rounded-xl border-white/25 bg-white/15 pl-9 text-white placeholder:text-white/60 focus-visible:ring-white/60 dark:bg-white/10"
            />
          </div>
          <label className="flex h-11 items-center gap-2 rounded-xl bg-white/15 px-3.5 text-[13px] font-medium ring-1 ring-white/25">
            <Switch checked={archivedOnly} onCheckedChange={(v) => { setArchivedOnly(v); setPage(1); }} aria-label="Archived only" />
            Archived only
          </label>
        </div>
      </section>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Category">
        {[{ value: "", label: "All categories" }, ...TICKET_CATEGORIES].map((c) => (
          <button
            key={c.value || "all"}
            type="button"
            role="tab"
            aria-selected={category === c.value}
            onClick={() => { setCategory(c.value); setPage(1); }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition",
              category === c.value ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-14 text-center ring-1 ring-border">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" onClick={load}><RefreshCw /> Retry</Button>
        </div>
      ) : loading && !result ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-border">
          <Archive className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-heading font-bold">{query ? "No solved tickets match your search" : "Nothing solved yet"}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Resolved and closed tickets appear here with their resolutions.</p>
        </div>
      ) : (
        <ul className={cn("grid gap-4 transition-opacity md:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {rows.map((t, i) => (
            <li
              key={t._id}
              className="group/card flex animate-in flex-col rounded-2xl bg-card/80 p-4 shadow-sm ring-1 ring-border/70 backdrop-blur transition-all duration-300 fill-mode-both fade-in-0 slide-in-from-bottom-2 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(80,72,229,0.35)]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <Link href={`/super-admin/tickets/${t._id}`} className="font-mono text-[11.5px] font-bold text-primary hover:underline">{t.ticketNumber}</Link>
                <div className="flex items-center gap-1.5">
                  {t.isArchived && <span className="rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">Archived</span>}
                  <StatusBadge status={t.status} />
                </div>
              </div>
              <Link href={`/super-admin/tickets/${t._id}`} className="mt-2 line-clamp-2 font-heading text-[15px] leading-snug font-bold text-foreground group-hover/card:text-primary">
                {t.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{t.description}</p>
              <div className="mt-3 rounded-xl bg-success/[0.07] p-3 ring-1 ring-success/20">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-success uppercase"><CheckCircle2 className="h-3.5 w-3.5" /> Resolution</p>
                <p className="mt-1 line-clamp-4 text-[12.5px] whitespace-pre-wrap text-foreground">{t.resolution || <span className="text-muted-foreground italic">No resolution written.</span>}</p>
              </div>
              <div className="mt-auto space-y-1.5 pt-3 text-[11.5px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-1.5"><CategoryChip category={t.category} /></div>
                <p>
                  Resolved {formatDateTime(t.resolvedAt ?? t.closedAt)}
                  {t.resolvedBy && <> by <span className="font-semibold text-foreground">{t.resolvedBy}</span></>}
                </p>
                <p className="flex items-center gap-1 truncate"><School className="h-3 w-3 shrink-0" /> {t.reporter.schoolName || "No school"}</p>
                <p className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" /> {t.reporter.name} · {ROLE_LABELS[t.reporter.role] || t.reporter.role}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result && (
        <TablePagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} limit={result.pagination.limit} onPage={setPage} noun="solved tickets" />
      )}
    </TicketsAdminShell>
  );
}
