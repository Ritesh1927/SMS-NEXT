import type { LucideIcon } from "lucide-react";

// Read-only counterparts to StudentForm/TeacherForm's Section/Field — same
// card chrome and label/value rhythm, just rendered as plain text instead
// of inputs, for the "View" pages reached from the list's eye icon.
export function DetailSection({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="card-premium p-6">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2.5 pb-3.5 border-b border-border">
        {Icon && (
          <div className="icon-chip h-8 w-8 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function DetailRow({ label, value, full }: { label: string; value?: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value || value === 0 ? value : <span className="text-muted-foreground/60">—</span>}</p>
    </div>
  );
}
