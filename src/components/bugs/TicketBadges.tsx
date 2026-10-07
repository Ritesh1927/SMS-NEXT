import { AlertOctagon, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryLabel, priorityLabel, statusGroup, statusLabel, type TicketStatusGroup } from "@/lib/bugReports/constants";

// Status / priority / category pills. Colours come from the theme tokens
// (info, accent, warning, success, destructive, coral...), so they follow
// the app's light/dark palette automatically. One distinct colour per status:
//   Open = blue, In Progress = violet, Waiting for Info = amber,
//   Resolved = green, Closed = grey, Rejected = red, Reopened = orange.

export const STATUS_STYLES: Record<TicketStatusGroup, { pill: string; dot: string }> = {
  open: {
    pill: "bg-info/12 text-info ring-info/25",
    dot: "bg-info",
  },
  in_progress: {
    pill: "bg-accent/12 text-accent ring-accent/25",
    dot: "bg-accent",
  },
  waiting: {
    pill: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/30 dark:text-warning",
    dot: "bg-warning",
  },
  resolved: {
    pill: "bg-success/12 text-success ring-success/25",
    dot: "bg-success",
  },
  closed: {
    pill: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground",
  },
  rejected: {
    pill: "bg-destructive/10 text-destructive ring-destructive/20",
    dot: "bg-destructive",
  },
  reopened: {
    pill: "bg-coral/12 text-coral ring-coral/25",
    dot: "bg-coral",
  },
};

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[statusGroup(status)];
  return (
    <span className={cn(pill, style.pill, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, { className: string; icon: typeof ArrowUp }> = {
  low: { className: "bg-muted text-muted-foreground ring-border", icon: ArrowDown },
  medium: { className: "bg-info/10 text-info ring-info/20", icon: Minus },
  high: { className: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/30 dark:text-warning", icon: ArrowUp },
  critical: { className: "bg-destructive text-white ring-destructive shadow-sm shadow-destructive/30", icon: AlertOctagon },
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  const Icon = style.icon;
  return (
    <span className={cn(pill, style.className, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {priorityLabel(priority)}
    </span>
  );
}

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground", className)}>
      {categoryLabel(category)}
    </span>
  );
}
