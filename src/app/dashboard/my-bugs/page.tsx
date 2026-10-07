"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Bug, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/contexts/AuthContext";
import { ticketFetch, formatDateTime, timeAgo } from "@/lib/bugReports/client";
import type { MyTicketRow, Paginated } from "@/lib/bugReports/types";
import { PriorityBadge, StatusBadge } from "@/components/bugs/TicketBadges";
import { TablePagination } from "@/components/bugs/TablePagination";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bugReports/events";

const LIMIT = 10;

// "My Reported Bugs": every signed-in school user sees only their own
// tickets here (the API scopes by the JWT), newest activity first.
export default function MyBugsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<MyTicketRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    ticketFetch<Paginated<MyTicketRow>>(getToken, `/bug-reports?page=${page}&limit=${LIMIT}`)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your reports."))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount / page change
    load();
    window.addEventListener(BUG_REPORTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(BUG_REPORTS_CHANGED_EVENT, load);
  }, [load]);

  const reportHref = "/dashboard/report-bug?from=%2Fdashboard%2Fmy-bugs";
  const rows = result?.data ?? [];

  return (
    <>
      <PageHeader
        icon={Bug}
        title="My Reported Bugs"
        subtitle="Track the status of issues you've reported to the EduNivo support team."
        accent="coral"
        actions={
          <Button nativeButton={false} render={<Link href={reportHref} />} className="rounded-xl bg-gradient-to-r from-primary to-accent font-semibold shadow-md shadow-primary/25">
            <Plus /> Report a bug
          </Button>
        }
      />

      <section className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(80,72,229,0.18)] ring-1 ring-border/70">
        {loading && !result ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" onClick={load}><RefreshCw /> Try again</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bug className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-heading text-lg font-bold text-foreground">No reports yet</h2>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
              Spotted something broken? Use the <b>Report a Bug</b> tab on the right edge of any page, or the button below.
            </p>
            <Button nativeButton={false} render={<Link href={reportHref} />} className="mt-5 rounded-xl"><Plus /> Report a bug</Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-3">Ticket</th>
                    <th scope="col" className="px-3 py-3">Title</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">Priority</th>
                    <th scope="col" className="px-3 py-3">Created</th>
                    <th scope="col" className="px-3 py-3">Last updated</th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.map((t) => (
                    <tr
                      key={t._id}
                      onClick={() => router.push(`/dashboard/my-bugs/${t._id}`)}
                      className="cursor-pointer transition-colors hover:bg-primary/[0.03]"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2 font-mono text-[12px] font-semibold text-primary">
                          {t.reporterUnread && <span className="h-2 w-2 rounded-full bg-destructive" aria-label="New update" />}
                          {t.ticketNumber}
                        </span>
                      </td>
                      <td className="max-w-[320px] px-3 py-3.5">
                        <Link href={`/dashboard/my-bugs/${t._id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3.5"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">{timeAgo(t.lastActivityAt)}</td>
                      <td className="px-3 py-3.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border/70 md:hidden">
              {rows.map((t) => (
                <li key={t._id}>
                  <Link href={`/dashboard/my-bugs/${t._id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-muted/60">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-mono text-[11.5px] font-semibold text-primary">
                        {t.reporterUnread && <span className="h-2 w-2 rounded-full bg-destructive" aria-label="New update" />}
                        {t.ticketNumber}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[14px] font-semibold text-foreground">{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                        <span className="text-[11.5px] text-muted-foreground">· {timeAgo(t.lastActivityAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-6 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {result && (
        <TablePagination
          page={result.pagination.page}
          pages={result.pagination.pages}
          total={result.pagination.total}
          limit={result.pagination.limit}
          onPage={setPage}
          noun="reports"
        />
      )}
    </>
  );
}
