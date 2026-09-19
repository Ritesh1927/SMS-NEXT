import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  className?: string;
}

/** Standard empty-state recipe: soft tinted icon circle + one muted line, centered. */
export function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div className={cn("py-14 text-center", className)}>
      <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
        <Icon className="h-6 w-6 text-primary/60" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
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
