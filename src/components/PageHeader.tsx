import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export type PageHeaderAccent = "primary" | "blue" | "violet" | "emerald" | "amber" | "coral" | "fuchsia" | "cyan" | "slate";

const ACCENT_CLASSES: Record<PageHeaderAccent, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600",
  violet: "bg-violet-500/10 text-violet-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  coral: "bg-coral/10 text-coral",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-600",
  cyan: "bg-cyan-500/10 text-cyan-600",
  slate: "bg-slate-500/10 text-slate-600",
};

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: PageHeaderAccent;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header: icon chip + title/subtitle + right-aligned actions.
 * Use on every top-level dashboard page in place of an ad hoc <h1> block —
 * see src/Design.md §11 for the header conventions this composes from.
 */
export function PageHeader({ icon: Icon, title, subtitle, accent = "primary", actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3.5">
        <div className={cn("icon-chip h-11 w-11", ACCENT_CLASSES[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
