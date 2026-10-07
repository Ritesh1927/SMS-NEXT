"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, Archive, ArchiveRestore, ArrowLeft, CheckCircle2, Copy, FileText, Film, History, ImageIcon, Info, Loader2, RefreshCw, Save,
  Trash2, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import {
  FIELD_LIMITS, ROLE_LABELS, STATUS_PHASES, TERMINAL_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus, type TimelineType,
} from "@/lib/bugReports/constants";
import { formatDateTime, ticketFetch, timeAgo } from "@/lib/bugReports/client";
import type { AdminTicketDTO, TeamMember, TicketConfig } from "@/lib/bugReports/types";
import { CategoryChip, PriorityBadge, STATUS_STYLES, StatusBadge } from "@/components/bugs/TicketBadges";
import { MediaGallery } from "@/components/bugs/MediaGallery";
import { TicketTimeline } from "@/components/bugs/TicketTimeline";
import { CommentComposer, type CommentPayload } from "@/components/bugs/CommentComposer";
import { ReporterCard, SystemInfoCard, reporterIdLabel } from "@/components/bugs/TicketSidePanels";
import { InfoGrid, TicketPanel } from "@/components/bugs/InfoGrid";
import { TicketsAdminShell } from "@/components/bugs/admin/TicketsAdminShell";

const TIMELINE_FILTERS: { value: string; label: string; types: TimelineType[] | null }[] = [
  { value: "all", label: "All activity", types: null },
  { value: "comments", label: "Comments", types: ["reply", "reporter_comment", "created"] },
  { value: "status", label: "Status history", types: ["status_change", "priority_change", "assignment", "resolution", "archived", "unarchived"] },
  { value: "internal", label: "Internal notes", types: ["internal_note"] },
  { value: "developer", label: "Developer notes", types: ["developer_note"] },
];

// Super Admin: one ticket, everything about it, and the controls to move it.
export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<AdminTicketDTO | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [limits, setLimits] = useState<TicketConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState("all");

  // Workflow form
  const [status, setStatus] = useState<TicketStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hydrate = (t: AdminTicketDTO) => {
    setTicket(t);
    setStatus(t.status);
    setResolution(t.resolution);
  };

  const load = useCallback(() => {
    setError(null);
    ticketFetch<{ data: AdminTicketDTO }>(getSuperAdminToken, `/superadmin/tickets/${id}`)
      .then((r) => hydrate(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this ticket."));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount / id change
    load();
    ticketFetch<{ data: TeamMember[] }>(getSuperAdminToken, "/superadmin/tickets/team").then((r) => setTeam(r.data)).catch(() => {});
    ticketFetch<{ data: TicketConfig }>(getSuperAdminToken, "/bug-reports/config").then((r) => setLimits(r.data)).catch(() => {});
  }, [load]);

  const patch = async (body: Record<string, unknown>, label: string, key: string) => {
    setSaving(key);
    try {
      const res = await ticketFetch<{ data: AdminTicketDTO; message: string }>(getSuperAdminToken, `/superadmin/tickets/${id}`, { method: "PATCH", body });
      hydrate(res.data);
      setStatusNote("");
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(null);
    }
  };

  const setArchived = async (archived: boolean) => {
    setSaving("archive");
    try {
      const res = await ticketFetch<{ data: AdminTicketDTO; message: string }>(getSuperAdminToken, `/superadmin/tickets/${id}/archive`, { method: "POST", body: { archived } });
      hydrate(res.data);
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(null);
    }
  };

  const deleteTicket = async () => {
    setSaving("delete");
    try {
      await ticketFetch(getSuperAdminToken, `/superadmin/tickets/${id}`, { method: "DELETE" });
      toast.success("Ticket deleted permanently");
      router.push("/super-admin/tickets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
      setSaving(null);
      setConfirmDelete(false);
    }
  };

  const addComment = async (payload: CommentPayload) => {
    const res = await ticketFetch<{ data: AdminTicketDTO }>(getSuperAdminToken, `/superadmin/tickets/${id}/comments`, { method: "POST", body: payload });
    hydrate(res.data);
    toast.success(payload.type === "reply" ? "Reply sent. The reporter has been notified." : "Note added");
  };

  const timeline = useMemo(() => {
    if (!ticket) return [];
    const types = TIMELINE_FILTERS.find((f) => f.value === timelineFilter)?.types;
    const entries = types ? ticket.timeline.filter((e) => types.includes(e.type)) : ticket.timeline;
    return entries;
  }, [ticket, timelineFilter]);

  if (error) {
    return (
      <TicketsAdminShell>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-border">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/super-admin/tickets" />}><ArrowLeft /> All tickets</Button>
            <Button onClick={load}><RefreshCw /> Retry</Button>
          </div>
        </div>
      </TicketsAdminShell>
    );
  }

  if (!ticket) {
    return (
      <TicketsAdminShell>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-[520px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      </TicketsAdminShell>
    );
  }

  const images = ticket.attachments.filter((a) => a.kind === "image");
  const videos = ticket.attachments.filter((a) => a.kind === "video");
  const isTerminal = TERMINAL_STATUSES.includes(ticket.status);
  const r = ticket.reporter;

  return (
    <TicketsAdminShell
      actions={
        <>
          {ticket.isArchived ? (
            <>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setArchived(false)} disabled={saving !== null}>
                <ArchiveRestore /> <span className="hidden sm:inline">Restore</span>
              </Button>
              <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setConfirmDelete(true)} disabled={saving !== null}>
                <Trash2 /> <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          ) : (
            isTerminal && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setArchived(true)} disabled={saving !== null}>
                <Archive /> <span className="hidden sm:inline">Archive</span>
              </Button>
            )
          )}
        </>
      }
    >
      <Link href="/super-admin/tickets" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>

      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-22px_rgba(80,72,229,0.3)] ring-1 ring-border/70 sm:p-6">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(ticket.ticketNumber).then(() => toast.success("Copied"), () => {})}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.07] px-2.5 py-1 font-mono text-[12px] font-bold text-primary hover:bg-primary/10"
              >
                {ticket.ticketNumber} <Copy className="h-3 w-3 opacity-70" />
              </button>
              {ticket.isArchived && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Archived {ticket.archivedAt ? timeAgo(ticket.archivedAt) : ""}</span>}
            </div>
            <h1 className="mt-2.5 font-heading text-xl leading-snug font-bold text-foreground sm:text-2xl">{ticket.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryChip category={ticket.category} />
              <span className="text-[12px] text-muted-foreground">Created {formatDateTime(ticket.createdAt)} · updated {timeAgo(ticket.lastActivityAt)}</span>
            </div>
          </div>
          {/* Who + where, at a glance */}
          <div className="shrink-0 rounded-xl bg-muted/50 px-4 py-3 ring-1 ring-border/70 lg:max-w-xs">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Raised by {ROLE_LABELS[r.role] || r.role}</p>
            <p className="mt-0.5 font-semibold text-foreground">{r.name}</p>
            <p className="text-[12.5px] font-medium text-foreground">{r.role === "superadmin" ? "System Administrator" : r.schoolName}</p>
            {reporterIdLabel(r.role) && r.userCode && (
              <p className="mt-1 font-mono text-[12px] text-muted-foreground">{reporterIdLabel(r.role)}: {r.userCode}</p>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <TicketPanel title="Bug details" icon={FileText}>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{ticket.description}</p>
          </TicketPanel>

          {images.length > 0 && (
            <TicketPanel title={`Uploaded images (${images.length})`} icon={ImageIcon}>
              <MediaGallery items={images} />
            </TicketPanel>
          )}
          {videos.length > 0 && (
            <TicketPanel title={`Uploaded videos (${videos.length})`} icon={Film}>
              <MediaGallery items={videos} />
            </TicketPanel>
          )}

          <TicketPanel
            title="Timeline"
            icon={History}
            action={<span className="text-[12px] text-muted-foreground">{ticket.timeline.length} events</span>}
          >
            <div role="tablist" aria-label="Filter timeline" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {TIMELINE_FILTERS.map((f) => {
                const count = f.types ? ticket.timeline.filter((e) => f.types!.includes(e.type)).length : ticket.timeline.length;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={timelineFilter === f.value}
                    onClick={() => setTimelineFilter(f.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all",
                      timelineFilter === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label} <span className="ml-0.5 text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
            <TicketTimeline entries={timeline} viewer="admin" />
            <div className="mt-5">
              <CommentComposer mode="admin" getToken={getSuperAdminToken} limits={limits} allowAttachments team={team} onSubmit={addComment} />
            </div>
          </TicketPanel>
        </div>

        <aside className="space-y-5">
          <TicketPanel title="Workflow" icon={Workflow}>
            <div className="space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <span id="status-picker-label" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</span>
                <Select
                  items={TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  value={status}
                  onValueChange={(v) => v && setStatus(v as TicketStatus)}
                >
                  <SelectTrigger className="h-10 data-[size=default]:h-10 w-full rounded-xl" aria-labelledby="status-picker-label">
                    <SelectValue>
                      {(value: TicketStatus) => {
                        const s = TICKET_STATUSES.find((x) => x.value === value);
                        return s ? (
                          <span className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", STATUS_STYLES[s.group].dot)} aria-hidden />
                            {s.label}
                          </span>
                        ) : null;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-72">
                    {STATUS_PHASES.map((phase, index) => (
                      <SelectGroup key={phase.key}>
                        {index > 0 && <SelectSeparator />}
                        <SelectLabel className="text-[10.5px] font-semibold tracking-wide uppercase">{phase.label}</SelectLabel>
                        {TICKET_STATUSES.filter((s) => s.phase === phase.key).map((s) => (
                          <SelectItem key={s.value} value={s.value} className="py-2">
                            <span className={cn("mt-0.5 h-2 w-2 shrink-0 self-start rounded-full", STATUS_STYLES[s.group].dot)} aria-hidden />
                            <span className="flex min-w-0 flex-col">
                              <span className="font-medium">
                                {s.label}
                                {s.value === ticket.status && <span className="ml-1.5 text-[10.5px] font-normal text-muted-foreground">(current)</span>}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{s.description}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {status !== ticket.status && (
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1">
                    <Textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      maxLength={FIELD_LIMITS.comment.max}
                      rows={2}
                      placeholder="Optional note for the reporter about this change…"
                      className="rounded-xl text-[13px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => { setStatus(ticket.status); setStatusNote(""); }}>Cancel</Button>
                      <Button
                        size="sm"
                        className="flex-1 rounded-lg bg-gradient-to-r from-primary to-accent font-semibold"
                        disabled={saving === "status"}
                        onClick={() => patch({ status, note: statusNote || undefined }, "Status updated. The reporter has been notified.", "status")}
                      >
                        {saving === "status" ? <Loader2 className="animate-spin" /> : <Save />} Update status
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Priority</span>
                <div role="radiogroup" aria-label="Priority" className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
                  {TICKET_PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={ticket.priority === p.value}
                      disabled={saving === "priority"}
                      onClick={() => ticket.priority !== p.value && patch({ priority: p.value as TicketPriority }, `Priority set to ${p.label}`, "priority")}
                      className={cn(
                        "rounded-lg py-1.5 text-[12px] font-semibold transition-all",
                        ticket.priority === p.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Assigned to</span>
                <Select
                  items={[{ value: "__none", label: "Unassigned" }, ...team.map((m) => ({ value: m.id, label: m.isMe ? `${m.name} (me)` : m.name }))]}
                  value={ticket.assignedTo?.id ?? "__none"}
                  onValueChange={(v) => {
                    const next = v === "__none" ? null : (v as string);
                    if (next !== (ticket.assignedTo?.id ?? null)) patch({ assignedTo: next }, next ? "Assignee updated" : "Unassigned", "assignee");
                  }}
                >
                  <SelectTrigger className="h-10 data-[size=default]:h-10 w-full rounded-xl" aria-label="Assigned to"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.isMe ? `${m.name} (me)` : m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution */}
              <div className="space-y-1.5">
                <span className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Resolution
                  <span className="font-normal normal-case">{resolution.length}/{FIELD_LIMITS.resolution.max}</span>
                </span>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  maxLength={FIELD_LIMITS.resolution.max}
                  rows={3}
                  placeholder="How was it fixed? Shown to the reporter once resolved, and in the Solved Archive."
                  className="rounded-xl text-[13px]"
                />
                {resolution !== ticket.resolution && (
                  <Button size="sm" variant="outline" className="w-full rounded-lg" disabled={saving === "resolution"} onClick={() => patch({ resolution }, "Resolution saved", "resolution")}>
                    {saving === "resolution" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Save resolution
                  </Button>
                )}
              </div>
            </div>
          </TicketPanel>

          <TicketPanel title="Ticket info" icon={Info}>
            <InfoGrid
              items={[
                { label: "Created", value: formatDateTime(ticket.createdAt) },
                { label: "Last activity", value: formatDateTime(ticket.lastActivityAt) },
                { label: "Resolved", value: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : "" },
                { label: "Resolved by", value: ticket.resolvedBy },
                { label: "Closed", value: ticket.closedAt ? formatDateTime(ticket.closedAt) : "" },
                { label: "Archived", value: ticket.archivedAt ? formatDateTime(ticket.archivedAt) : "" },
                { label: "Reporter has unread updates", value: ticket.reporterUnread ? "Yes" : "No" },
              ]}
            />
          </TicketPanel>

          <ReporterCard reporter={ticket.reporter} />
          <SystemInfoCard context={ticket.context} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${ticket.ticketNumber} permanently?`}
        description="The ticket, its timeline and all uploaded files will be deleted. This can't be undone."
        confirmLabel="Delete permanently"
        variant="destructive"
        loading={saving === "delete"}
        onConfirm={deleteTicket}
      />
    </TicketsAdminShell>
  );
}
