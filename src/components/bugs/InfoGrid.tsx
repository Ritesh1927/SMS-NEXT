import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Read-only label/value grid: the auto-filled fields in the report form and
// the reporter / system-info panels on ticket detail pages.

export interface InfoItem {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Spans the full row (long values like URLs). */
  wide?: boolean;
  mono?: boolean;
}

export function InfoGrid({ items, columns = 2, className }: { items: InfoItem[]; columns?: 1 | 2 | 3; className?: string }) {
  const visible = items.filter((i) => i.value !== undefined && i.value !== null && i.value !== "");
  return (
    <dl className={cn("grid grid-cols-1 gap-2", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "", className)}>
      {visible.map(({ label, value, icon: Icon, wide, mono }) => (
        <div
          key={label}
          className={cn(
            "min-w-0 rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-border/60 dark:bg-white/[0.03]",
            wide && (columns === 3 ? "sm:col-span-2 lg:col-span-3" : columns === 2 ? "sm:col-span-2" : ""),
          )}
        >
          <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            {Icon && <Icon className="h-3 w-3" />}
            {label}
          </dt>
          <dd className={cn("mt-0.5 truncate text-[13px] font-medium text-foreground", mono && "font-mono text-[12px]")} title={typeof value === "string" ? value : undefined}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Glass card section used across the ticket pages. */
export function TicketPanel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(80,72,229,0.18)] ring-1 ring-border/70 backdrop-blur-sm sm:p-5 dark:ring-white/10", className)}>
      {(title || action) && (
        <header className="mb-3.5 flex items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 font-heading text-[14.5px] font-bold text-foreground">
              {Icon && (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
