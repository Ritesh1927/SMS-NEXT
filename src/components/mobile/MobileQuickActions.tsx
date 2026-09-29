"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen, CalendarCheck, IndianRupee, Library, Megaphone, UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { UserRole } from "@/contexts/AuthContext";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  tint: string;
}

const ACTIONS_BY_ROLE: Record<UserRole, QuickAction[]> = {
  schooladmin: [
    { label: "Add Student", href: "/dashboard/students", icon: UserPlus, tint: "from-primary to-accent" },
    { label: "Mark Attendance", href: "/dashboard/attendance", icon: CalendarCheck, tint: "from-emerald-500 to-teal-500" },
    { label: "Collect Fee", href: "/dashboard/fees", icon: IndianRupee, tint: "from-amber-500 to-orange-500" },
    { label: "Send Notice", href: "/dashboard/notices", icon: Megaphone, tint: "from-rose-500 to-pink-500" },
  ],
  teacher: [
    { label: "Mark Attendance", href: "/dashboard/attendance", icon: CalendarCheck, tint: "from-emerald-500 to-teal-500" },
    { label: "Add Homework", href: "/dashboard/homework", icon: BookOpen, tint: "from-primary to-accent" },
    { label: "Study Material", href: "/dashboard/study-materials", icon: Library, tint: "from-sky-500 to-blue-500" },
    { label: "Send Notice", href: "/dashboard/notices", icon: Megaphone, tint: "from-rose-500 to-pink-500" },
  ],
  parent: [
    { label: "Pay Fees", href: "/dashboard/fees", icon: IndianRupee, tint: "from-amber-500 to-orange-500" },
    { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck, tint: "from-emerald-500 to-teal-500" },
    { label: "Homework", href: "/dashboard/homework", icon: BookOpen, tint: "from-primary to-accent" },
  ],
  student: [],
};

export function MobileQuickActions({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}) {
  const router = useRouter();
  const actions = ACTIONS_BY_ROLE[role] || [];

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-[26px] border-none p-0 pb-6">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border" />
        <div className="px-5 pb-1 pt-3">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Jump straight to what you need next.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pt-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => go(action.href)}
              className="flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.96]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tint} text-white shadow-sm`}>
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold leading-tight text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
