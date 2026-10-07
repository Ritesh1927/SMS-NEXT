"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The Super Admin design system: one set of building blocks so every page
// shares the same header, cards, badges and states. All colours are theme
// tokens, so light and dark mode both work.

type IconType = ComponentType<{ className?: string }>;

export const SURFACE =
  "rounded-2xl bg-card/85 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(37,30,140,0.22)] ring-1 ring-border/70 backdrop-blur-sm dark:bg-card/70 dark:ring-white/10";

/** Page title row: icon, title, description and right-aligned actions. */
export function AdminPageHeader({
  title, description, icon: Icon, actions,
}: {
  title: string;
  description?: string;
  icon?: IconType;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] leading-tight font-bold tracking-tight text-foreground sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card section with optional header row. */
export function AdminPanel({
  title, description, icon: Icon, actions, children, className, bodyClassName,
}: {
  title?: string;
  description?: string;
  icon?: IconType;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(SURFACE, "overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate font-heading text-[15px] font-bold text-foreground">{title}</h2>}
              {description && <p className="truncate text-[12px] text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const KPI_TONES = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  accent: "bg-accent/12 text-accent",
  coral: "bg-coral/12 text-coral",
} as const;

/** KPI stat tile: label, big value, optional hint line and link. */
export function KpiCard({
  label, value, icon: Icon, tone = "primary", hint, href, loading,
}: {
  label: string;
  value: ReactNode;
  icon: IconType;
  tone?: keyof typeof KPI_TONES;
  hint?: ReactNode;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", KPI_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5 group-hover/kpi:text-primary" />}
      </div>
      <p className="mt-4 text-[12.5px] font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-8 w-20" />
      ) : (
        <p className="mt-0.5 font-heading text-[28px] leading-tight font-extrabold tracking-tight text-foreground tabular-nums">{value}</p>
      )}
      {hint && <p className="mt-1 truncate text-[12px] text-muted-foreground">{hint}</p>}
    </>
  );
  const className = cn(SURFACE, "group/kpi block p-5 transition-all duration-200", href && "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(37,30,140,0.45)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none");
  return href ? (
    <Link href={href} className={className}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ---- Status system ------------------------------------------------------------

const STATUS_TONES = {
  success: { pill: "bg-success/10 text-success ring-success/25", dot: "bg-success" },
  warning: { pill: "bg-warning/12 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/30 dark:text-warning", dot: "bg-warning" },
  danger: { pill: "bg-destructive/10 text-destructive ring-destructive/25", dot: "bg-destructive" },
  info: { pill: "bg-info/10 text-info ring-info/25", dot: "bg-info" },
  progress: { pill: "bg-accent/10 text-accent ring-accent/25", dot: "bg-accent" },
  neutral: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground" },
} as const;
export type StatusTone = keyof typeof STATUS_TONES;

/** Semantic statuses used across the console, each with a fixed tone. */
const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  success: { label: "Success", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  warning: { label: "Warning", tone: "warning" },
  expiring: { label: "Expiring soon", tone: "warning" },
  trial: { label: "Trial", tone: "info" },
  in_progress: { label: "In Progress", tone: "progress" },
  testing: { label: "Testing", tone: "progress" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
  none: { label: "No license", tone: "neutral" },
};

/** Colour-coded status pill with a dot (never colour alone: it always has a label). */
export function StatusPill({ status, label, tone, className }: { status?: string; label?: string; tone?: StatusTone; className?: string }) {
  const mapped = status ? STATUS_MAP[status] : undefined;
  const t = STATUS_TONES[tone ?? mapped?.tone ?? "neutral"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset", t.pill, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {label ?? mapped?.label ?? status}
    </span>
  );
}

/** Thin usage meter; turns amber then red as it fills. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-gradient-to-r from-primary to-accent";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- States ---------------------------------------------------------------------

export function EmptyBlock({ icon: Icon, title, description, action }: { icon: IconType; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 font-heading text-[15px] font-bold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[14px] font-semibold text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4 rounded-xl" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

/** Primary gradient button styling shared by page-level CTAs. */
export const PRIMARY_CTA = "rounded-xl bg-gradient-to-r from-primary to-accent font-semibold text-white shadow-md shadow-primary/25 hover:opacity-95";
