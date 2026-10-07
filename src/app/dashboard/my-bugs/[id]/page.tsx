"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, FileText, History, Info, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/contexts/AuthContext";
import { AWAITING_REPORTER_STATUSES, SOLVED_STATUSES, categoryLabel, statusGroup } from "@/lib/bugReports/constants";
import { formatDateTime, ticketFetch, timeAgo } from "@/lib/bugReports/client";
import type { ReporterTicketDTO, TicketConfig } from "@/lib/bugReports/types";
import { CategoryChip, PriorityBadge, StatusBadge } from "@/components/bugs/TicketBadges";
import { MediaGallery } from "@/components/bugs/MediaGallery";
import { TicketTimeline } from "@/components/bugs/TicketTimeline";
import { CommentComposer, type CommentPayload } from "@/components/bugs/CommentComposer";
import { ReporterCard } from "@/components/bugs/TicketSidePanels";
import { InfoGrid, TicketPanel } from "@/components/bugs/InfoGrid";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bugReports/events";

const STATUS_EXPLAINERS: Record<string, string> = {
  open: "Your report is in the support queue and will be reviewed shortly.",
  assigned: "A support engineer has picked up your report.",
  in_progress: "The team is actively working on this.",
  waiting: "The team needs something from you. Please reply below.",
  testing: "A fix is being tested.",
  resolved: "This has been fixed. Let us know below if it still happens.",
  closed: "This report is closed.",
  rejected: "This report was closed without a change. See the timeline for why.",
  reopened: "The report was reopened and is being looked at again.",
};

// Reporter view of one ticket: status, details, public timeline, comments.
export default function MyBugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<ReporterTicketDTO | null>(null);
  const [limits, setLimits] = useState<TicketConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    ticketFetch<{ data: ReporterTicketDTO }>(getToken, `/bug-reports/${id}`)
      .then((r) => {
        setTicket(r.data);
        // Opening it cleared the unread flag; refresh the floating badge.
        window.dispatchEvent(new Event(BUG_REPORTS_CHANGED_EVENT));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this report."));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount / id change
    load();
    ticketFetch<{ data: TicketConfig }>(getToken, "/bug-reports/config").then((r) => setLimits(r.data)).catch(() => {});
  }, [load]);

  const addComment = async (payload: CommentPayload) => {
    const res = await ticketFetch<{ data: ReporterTicketDTO }>(getToken, `/bug-reports/${id}/comments`, {
      method: "POST",
      body: { message: payload.message, attachments: payload.attachments },
    });
    setTicket(res.data);
    toast.success("Comment added");
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-border">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/my-bugs" />}><ArrowLeft /> My reports</Button>
          <Button onClick={load}><RefreshCw /> Try again</Button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const awaitingReporter = AWAITING_REPORTER_STATUSES.includes(ticket.status);
  const solved = SOLVED_STATUSES.includes(ticket.status);

  return (
    <div className="space-y-5">
      <Link href="/dashboard/my-bugs" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Reported Bugs
      </Link>

      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-22px_rgba(80,72,229,0.3)] ring-1 ring-border/70 sm:p-6">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(ticket.ticketNumber).then(() => toast.success("Ticket number copied"), () => {})}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.07] px-2.5 py-1 font-mono text-[12px] font-bold text-primary hover:bg-primary/10"
          >
            {ticket.ticketNumber} <Copy className="h-3 w-3 opacity-70" />
          </button>
          <h1 className="mt-2.5 font-heading text-xl leading-snug font-bold text-foreground sm:text-2xl">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <CategoryChip category={ticket.category} />
            <span className="text-[12px] text-muted-foreground">Reported {formatDateTime(ticket.createdAt)} · updated {timeAgo(ticket.lastActivityAt)}</span>
          </div>
        </div>
      </header>

      {awaitingReporter && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 ring-1 ring-warning/30">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-[13px]">
            <p className="font-semibold text-foreground">The support team needs more information</p>
            <p className="mt-0.5 text-muted-foreground">Check their latest reply below, then add a comment. You can attach screenshots or a recording.</p>
          </div>
        </div>
      )}

      {solved && ticket.resolution && (
        <div className="flex items-start gap-3 rounded-2xl bg-success/[0.08] p-4 ring-1 ring-success/25">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="text-[13px]">
            <p className="font-semibold text-foreground">Resolution</p>
            <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{ticket.resolution}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <TicketPanel title="Description" icon={FileText}>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{ticket.description}</p>
          </TicketPanel>

          <TicketPanel title={`Attachments (${ticket.attachments.length})`} icon={Paperclip}>
            <MediaGallery items={ticket.attachments} />
          </TicketPanel>

          <TicketPanel title="Activity" icon={History}>
            <TicketTimeline entries={ticket.timeline} viewer="reporter" />
            <div className="mt-5">
              <CommentComposer
                mode="reporter"
                getToken={getToken}
                limits={limits}
                allowAttachments={awaitingReporter}
                onSubmit={addComment}
                disabledReason={ticket.isArchived ? "This report is archived. If the problem is back, please open a new report." : undefined}
              />
            </div>
          </TicketPanel>
        </div>

        <aside className="space-y-5">
          <TicketPanel title="Status" icon={Info}>
            <StatusBadge status={ticket.status} className="text-[12px]" />
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{STATUS_EXPLAINERS[statusGroup(ticket.status)]}</p>
            <InfoGrid
              className="mt-3.5"
              items={[
                { label: "Category", value: categoryLabel(ticket.category) },
                { label: "Created", value: formatDateTime(ticket.createdAt) },
                { label: "Last updated", value: formatDateTime(ticket.lastActivityAt) },
                { label: "Resolved", value: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : "" },
              ]}
            />
          </TicketPanel>
          <ReporterCard reporter={ticket.reporter} title="Your details" />
        </aside>
      </div>
    </div>
  );
}
