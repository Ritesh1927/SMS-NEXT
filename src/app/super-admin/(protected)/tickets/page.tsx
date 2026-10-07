"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronDown, CircleDot, Clock, Film, Hourglass,
  ImageIcon, Inbox, MoreHorizontal, RefreshCw, RotateCcw, Search, ShieldX, Wrench, X, XCircle, Minus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import {
  ROLE_LABELS, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, type TicketStatus, type TicketStatusGroup,
} from "@/lib/bugReports/constants";
import { formatDateTime, ticketFetch, timeAgo } from "@/lib/bugReports/client";
import type { AdminTicketRow, Paginated, TeamMember } from "@/lib/bugReports/types";
import { PriorityBadge, StatusBadge } from "@/components/bugs/TicketBadges";
import { TablePagination } from "@/components/bugs/TablePagination";
import { TICKETS_UNREAD_CHANGED_EVENT, TicketsAdminShell } from "@/components/bugs/admin/TicketsAdminShell";

interface Stats {
  total: number;
  unread: number;
  archived: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  schools: { id: string; name: string; count: number }[];
}

interface Filters {
  search: string;
  status: string;
  priority: string;
  category: string;
  role: string;
  schoolId: string;
  from: string;
  to: string;
  archived: "" | "true" | "false";
}

const EMPTY_FILTERS: Filters = { search: "", status: "", priority: "", category: "", role: "", schoolId: "", from: "", to: "", archived: "false" };
type SortKey = "createdAt" | "lastActivityAt" | "priority" | "status" | "ticketNumber";

const statusesIn = (group: TicketStatusGroup) => TICKET_STATUSES.filter((s) => s.group === group).map((s) => s.value).join(",");

const STATUS_CARDS: { label: string; group: TicketStatusGroup; icon: ComponentType<{ className?: string }>; tone: string }[] = [
  { label: "Open", group: "open", icon: Inbox, tone: "text-info bg-info/10" },
  { label: "In Progress", group: "in_progress", icon: Wrench, tone: "text-accent bg-accent/10" },
  { label: "Waiting for Info", group: "waiting", icon: Hourglass, tone: "text-warning bg-warning/15" },
  { label: "Reopened", group: "reopened", icon: RotateCcw, tone: "text-coral bg-coral/10" },
  { label: "Resolved", group: "resolved", icon: CheckCircle2, tone: "text-success bg-success/10" },
  { label: "Closed", group: "closed", icon: XCircle, tone: "text-muted-foreground bg-muted" },
  { label: "Rejected", group: "rejected", icon: ShieldX, tone: "text-destructive bg-destructive/10" },
];

const PRIORITY_CARDS = [
  { value: "critical", label: "Critical", icon: AlertOctagon, tone: "text-white bg-destructive" },
  { value: "high", label: "High", icon: ArrowUp, tone: "text-warning bg-warning/15" },
  { value: "medium", label: "Medium", icon: Minus, tone: "text-info bg-info/10" },
  { value: "low", label: "Low", icon: ArrowDown, tone: "text-muted-foreground bg-muted" },
];

const ALL = "__all";

// Super Admin: ticket management dashboard (cards + filters + table).
export default function TicketsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; order: "asc" | "desc" }>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AdminTicketRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<TeamMember | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadStats = useCallback(() => {
    ticketFetch<{ data: Stats }>(getSuperAdminToken, "/superadmin/tickets/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: "20", sort: sort.key, order: sort.order });
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    if (!filters.archived) p.set("archived", "");
    return p.toString();
  }, [filters, page, sort]);

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError(null);
    ticketFetch<Paginated<AdminTicketRow>>(getSuperAdminToken, `/superadmin/tickets?${query}`)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load tickets."))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load when the query changes
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadStats();
    ticketFetch<{ data: TeamMember[] }>(getSuperAdminToken, "/superadmin/tickets/team")
      .then((r) => setMe(r.data.find((m) => m.isMe) ?? null))
      .catch(() => {});
    const refresh = () => {
      loadStats();
      loadTickets();
    };
    window.addEventListener(TICKETS_UNREAD_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TICKETS_UNREAD_CHANGED_EVENT, refresh);
  }, [loadStats, loadTickets]);

  // Debounced search.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const setFilter = (key: keyof Filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value === ALL ? "" : value }));
  };

  const groupCount = (group: TicketStatusGroup) =>
    TICKET_STATUSES.filter((s) => s.group === group).reduce((sum, s) => sum + (stats?.byStatus[s.value] ?? 0), 0);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !(k === "archived" && v === "false")).length;

  const quickUpdate = async (ticket: AdminTicketRow, body: Record<string, unknown>, success: string) => {
    try {
      await ticketFetch(getSuperAdminToken, `/superadmin/tickets/${ticket._id}`, { method: "PATCH", body });
      toast.success(success, { description: ticket.ticketNumber });
      loadTickets();
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, order: s.key === key && s.order === "desc" ? "asc" : "desc" }));

  const rows = result?.data ?? [];

  return (
    <TicketsAdminShell
      actions={
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { loadStats(); loadTickets(); }}>
          <RefreshCw className={cn(loading && "animate-spin")} /> <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    >
      {/* Overview cards */}
      <section aria-label="Ticket overview" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Total Tickets"
            value={stats?.total}
            icon={CircleDot}
            tone="text-white bg-gradient-to-br from-primary to-accent"
            active={!filters.status && !filters.priority}
            onClick={() => setFilters((f) => ({ ...f, status: "", priority: "" }))}
            sub={stats ? `${stats.unread} new · ${stats.archived} archived` : undefined}
          />
          {STATUS_CARDS.map((c) => (
            <StatCard
              key={c.group}
              label={c.label}
              value={stats ? groupCount(c.group) : undefined}
              icon={c.icon}
              tone={c.tone}
              active={filters.status === statusesIn(c.group)}
              onClick={() => setFilter("status", filters.status === statusesIn(c.group) ? "" : statusesIn(c.group))}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRIORITY_CARDS.map((c) => (
            <StatCard
              key={c.value}
              label={`${c.label} priority`}
              value={stats?.byPriority[c.value] ?? (stats ? 0 : undefined)}
              icon={c.icon}
              tone={c.tone}
              compact
              active={filters.priority === c.value}
              onClick={() => setFilter("priority", filters.priority === c.value ? "" : c.value)}
            />
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl bg-card/80 p-3 shadow-sm ring-1 ring-border/70 backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ticket number, title, reporter, email or school…"
              aria-label="Search tickets"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <SegmentedArchive value={filters.archived} onChange={(v) => setFilter("archived", v)} />
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              Filters {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
              <ChevronDown className={cn("transition-transform", showFilters && "rotate-180")} />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/70 pt-3 animate-in fade-in-0 slide-in-from-top-1 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="School"
              value={filters.schoolId}
              onChange={(v) => setFilter("schoolId", v)}
              options={(stats?.schools ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))}
            />
            <FilterSelect
              label="Role"
              value={filters.role}
              onChange={(v) => setFilter("role", v)}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilter("priority", v)} options={TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(v) => setFilter("status", v)}
              options={TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter("category", v)} options={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
            <label className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">From</span>
              <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} className="h-10 rounded-xl" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">To</span>
              <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} className="h-10 rounded-xl" />
            </label>
            <div className="flex items-end">
              <Button
                variant="ghost"
                className="h-10 w-full rounded-xl text-muted-foreground"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setSearchInput("");
                  setPage(1);
                }}
                disabled={activeFilterCount === 0 && !searchInput}
              >
                <X /> Clear all filters
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-24px_rgba(80,72,229,0.25)] ring-1 ring-border/70">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" onClick={loadTickets}><RefreshCw /> Retry</Button>
          </div>
        ) : loading && !result ? (
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="mt-3 font-heading text-base font-bold">No tickets match</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Try clearing some filters.</p>
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[1180px] text-left text-[13px]">
              <thead className="bg-muted/50 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <SortHeader label="Ticket" sortKey="ticketNumber" sort={sort} onSort={toggleSort} className="pl-5" />
                  <th scope="col" className="px-3 py-3">Title</th>
                  <th scope="col" className="px-3 py-3">Reporter</th>
                  <th scope="col" className="px-3 py-3">School</th>
                  <SortHeader label="Priority" sortKey="priority" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Created" sortKey="createdAt" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="px-3 py-3">Assigned to</th>
                  <SortHeader label="Last updated" sortKey="lastActivityAt" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="px-3 py-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((t) => {
                  const images = t.attachments?.filter((a) => a.kind === "image").length ?? 0;
                  const videos = t.attachments?.filter((a) => a.kind === "video").length ?? 0;
                  return (
                    <tr key={t._id} className={cn("group/row transition-colors hover:bg-primary/[0.03]", t.adminUnread && "bg-primary/[0.025]")}>
                      <td className="py-3 pr-3 pl-5 align-top">
                        <Link href={`/super-admin/tickets/${t._id}`} className="flex items-center gap-2 font-mono text-[12px] font-bold text-primary hover:underline">
                          {t.adminUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="Unread" />}
                          {t.ticketNumber}
                        </Link>
                        {t.isArchived && <span className="mt-1 inline-block rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">Archived</span>}
                      </td>
                      <td className="max-w-[280px] px-3 py-3 align-top">
                        <Link href={`/super-admin/tickets/${t._id}`} className={cn("line-clamp-2 text-foreground hover:text-primary", t.adminUnread ? "font-bold" : "font-medium")}>
                          {t.title}
                        </Link>
                        <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {images > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" />{images}</span>}
                          {videos > 0 && <span className="inline-flex items-center gap-0.5"><Film className="h-3 w-3" />{videos}</span>}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-3 py-3 align-top">
                        <p className="truncate font-medium text-foreground">{t.reporter.name}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{ROLE_LABELS[t.reporter.role] || t.reporter.role}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground" title={t.reporter.email}>{t.reporter.email}</p>
                      </td>
                      <td className="max-w-[180px] px-3 py-3 align-top">
                        <p className="line-clamp-2 text-foreground">{t.reporter.schoolName || "—"}</p>
                      </td>
                      <td className="px-3 py-3 align-top"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-3 py-3 align-top"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                      <td className="px-3 py-3 align-top">
                        {t.assignedTo ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">
                              {t.assignedTo.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="truncate">{t.assignedTo.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap text-muted-foreground" title={formatDateTime(t.lastActivityAt)}>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.lastActivityAt)}</span>
                      </td>
                      <td className="py-3 pr-5 pl-3 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="rounded-lg" nativeButton={false} render={<Link href={`/super-admin/tickets/${t._id}`} />}>
                            Open
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`More actions for ${t.ticketNumber}`} />}>
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => router.push(`/super-admin/tickets/${t._id}`)}>Open ticket</DropdownMenuItem>
                              {me && t.assignedTo?.id !== me.id && (
                                <DropdownMenuItem onClick={() => quickUpdate(t, { assignedTo: me.id }, "Assigned to you")}>Assign to me</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {(["in_progress", "waiting_for_information", "resolved", "closed", "rejected"] as TicketStatus[])
                                .filter((s) => s !== t.status)
                                .map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => quickUpdate(t, { status: s }, `Marked ${TICKET_STATUSES.find((x) => x.value === s)?.label}`)}>
                                    Mark {TICKET_STATUSES.find((x) => x.value === s)?.label}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result && (
        <TablePagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} limit={result.pagination.limit} onPage={setPage} />
      )}
    </TicketsAdminShell>
  );
}

function StatCard({
  label, value, icon: Icon, tone, onClick, active, compact, sub,
}: {
  label: string;
  value: number | undefined;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  onClick: () => void;
  active?: boolean;
  compact?: boolean;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group/stat relative overflow-hidden rounded-2xl bg-card/80 text-left shadow-sm ring-1 ring-border/70 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_rgba(80,72,229,0.35)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        compact ? "flex items-center gap-3 p-3" : "p-3.5",
        active && "ring-2 ring-primary/60",
      )}
    >
      <span className={cn("flex shrink-0 items-center justify-center rounded-xl", compact ? "h-9 w-9" : "mb-2.5 h-9 w-9", tone)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
        {value === undefined ? (
          <Skeleton className="mt-1 h-6 w-10" />
        ) : (
          <span className="block font-heading text-[22px] leading-tight font-extrabold text-foreground tabular-nums">{value}</span>
        )}
        {sub && <span className="block truncate text-[10.5px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const items = [{ value: ALL, label: `All` }, ...options];
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <Select items={items} value={value || ALL} onValueChange={(v) => onChange((v as string) || ALL)}>
        <SelectTrigger className="h-10 data-[size=default]:h-10 w-full rounded-xl" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SegmentedArchive({ value, onChange }: { value: Filters["archived"]; onChange: (v: string) => void }) {
  const options: { value: Filters["archived"]; label: string }[] = [
    { value: "false", label: "Active" },
    { value: "true", label: "Archived" },
    { value: "", label: "All" },
  ];
  return (
    <div role="radiogroup" aria-label="Archive filter" className="flex h-10 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value === "" ? ALL : o.value)}
          className={cn(
            "rounded-lg px-3 text-[12px] font-semibold transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SortHeader({
  label, sortKey, sort, onSort, className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; order: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-3", className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}>
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
