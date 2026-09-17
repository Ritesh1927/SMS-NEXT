import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  className?: string;
}

/** Standard empty-state recipe (Design.md §25): icon at opacity-30 + one muted line, centered. */
export function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div className={cn("py-12 text-center text-muted-foreground", className)}>
      <Icon className="mx-auto mb-2 h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/** Compact variant for tighter contexts (dropdown lists, small panels) — no icon, py-6. */
export function EmptyStateCompact({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("py-6 text-center text-muted-foreground", className)}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
