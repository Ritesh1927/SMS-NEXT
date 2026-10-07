"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, LayoutList, LifeBuoy, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/super-admin/ui";

// Kept for existing imports; the Super Admin shell now owns the polling.
export { TICKETS_UNREAD_CHANGED_EVENT } from "@/components/super-admin/events";

const TABS = [
  { href: "/super-admin/tickets", label: "Tickets", icon: LayoutList, exact: true },
  { href: "/super-admin/tickets/archive", label: "Solved Archive", icon: Archive },
  { href: "/super-admin/tickets/settings", label: "Settings", icon: Settings2 },
];

/**
 * Page header + section tabs for the Support Center pages. The sidebar,
 * top bar, notifications and logout come from the Super Admin shell
 * (app/super-admin/(protected)/layout.tsx).
 */
export function TicketsAdminShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={LifeBuoy}
        title="Support Center"
        description="Bug reports and tickets from every school and role."
        actions={actions}
      />
      <nav aria-label="Support Center sections" className="-mt-1 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 ring-1 ring-border/60">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href || /^\/super-admin\/tickets\/[a-f\d]{24}$/i.test(pathname) : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-all",
                active ? "bg-card text-foreground shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className={cn("h-4 w-4", active && "text-primary")} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
