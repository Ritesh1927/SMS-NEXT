"use client";

import type { ComponentType } from "react";
import {
  Archive, ArchiveRestore, ArrowRight, Bug, CheckCircle2, Code2, Flag, Lock, MessageSquare, MessageSquareReply, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type TimelineType } from "@/lib/bugReports/constants";
import { formatDateTime, timeAgo } from "@/lib/bugReports/client";
import type { TimelineEntryDTO } from "@/lib/bugReports/types";
import { PriorityBadge, StatusBadge } from "./TicketBadges";
import { MediaGallery } from "./MediaGallery";

const TYPE_META: Record<TimelineType, { icon: ComponentType<{ className?: string }>; label: string; tone: string }> = {
  created: { icon: Bug, label: "reported the issue", tone: "from-primary to-accent text-white" },
  status_change: { icon: Flag, label: "changed the status", tone: "bg-info/15 text-info" },
  priority_change: { icon: Flag, label: "changed the priority", tone: "bg-warning/20 text-warning" },
  assignment: { icon: UserCheck, label: "updated the assignee", tone: "bg-primary/12 text-primary" },
  reply: { icon: MessageSquareReply, label: "replied", tone: "bg-primary/12 text-primary" },
  reporter_comment: { icon: MessageSquare, label: "commented", tone: "bg-secondary text-secondary-foreground" },
  internal_note: { icon: Lock, label: "added an internal note", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  developer_note: { icon: Code2, label: "added a developer note", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  resolution: { icon: CheckCircle2, label: "wrote the resolution", tone: "bg-success/15 text-success" },
  archived: { icon: Archive, label: "archived the ticket", tone: "bg-muted text-muted-foreground" },
  unarchived: { icon: ArchiveRestore, label: "restored the ticket", tone: "bg-muted text-muted-foreground" },
};

/**
 * Vertical activity feed. Reporters receive only public entries from the
 * API; Super Admins also see internal/developer notes, clearly marked.
 */
export function TicketTimeline({ entries, viewer }: { entries: TimelineEntryDTO[]; viewer: "reporter" | "admin" }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-gradient-to-b before:from-primary/40 before:via-border before:to-transparent">
      {entries.map((entry, index) => {
        const meta = TYPE_META[entry.type] ?? TYPE_META.reporter_comment;
        const Icon = meta.icon;
        const internal = entry.visibility === "internal";
        const isSupport = entry.actorRole === "superadmin";
        const actor =
          entry.actorRole === "system"
            ? "System"
            : viewer === "reporter" && isSupport
              ? "EduNivo Support"
              : entry.actorName || ROLE_LABELS[entry.actorRole];
        const hasBubble = Boolean(entry.message) && entry.type !== "created";

        return (
          <li
            key={entry._id}
            className="relative flex animate-in gap-3 pl-0 duration-500 fill-mode-both fade-in-0 slide-in-from-bottom-1"
            style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
          >
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                entry.type === "created" ? "bg-gradient-to-br" : "",
                meta.tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-snug">
                <span className="font-semibold text-foreground">{actor}</span>
                <span className="text-muted-foreground">{meta.label}</span>
                {entry.type === "status_change" && entry.from && entry.to && (
                  <span className="inline-flex items-center gap-1">
                    <StatusBadge status={entry.from} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <StatusBadge status={entry.to} />
                  </span>
                )}
                {entry.type === "priority_change" && entry.from && entry.to && (
                  <span className="inline-flex items-center gap-1">
                    <PriorityBadge priority={entry.from} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <PriorityBadge priority={entry.to} />
                  </span>
                )}
                {internal && viewer === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" /> Team only
                  </span>
                )}
                <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)} className="text-[11.5px] text-muted-foreground">
                  · {timeAgo(entry.createdAt)}
                </time>
              </p>

              {hasBubble && (
                <div
                  className={cn(
                    "mt-2 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ring-1",
                    entry.type === "internal_note" && "bg-amber-500/[0.06] ring-amber-500/20",
                    entry.type === "developer_note" && "bg-slate-500/[0.06] font-mono text-[12.5px] ring-slate-500/20",
                    entry.type === "reply" && "bg-primary/[0.05] ring-primary/15",
                    entry.type === "resolution" && "bg-success/[0.06] ring-success/20",
                    !["internal_note", "developer_note", "reply", "resolution"].includes(entry.type) && "bg-muted/60 ring-border/70",
                  )}
                >
                  {entry.message}
                  {entry.mentions && entry.mentions.length > 0 && viewer === "admin" && (
                    <p className="mt-1.5 text-[11.5px] font-medium text-primary">Mentioned: {entry.mentions.map((m) => `@${m}`).join(", ")}</p>
                  )}
                </div>
              )}

              {entry.attachments?.length > 0 && entry.type !== "created" && (
                <div className="mt-2">
                  <MediaGallery items={entry.attachments} size="sm" />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
