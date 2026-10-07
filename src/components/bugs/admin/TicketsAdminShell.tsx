"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArrowLeft, LayoutList, LifeBuoy, LogOut, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clearSuperAdminAuth, getSuperAdminToken } from "@/lib/superAdminAuth";
import { ticketFetch } from "@/lib/bugReports/client";

const TABS = [
  { href: "/super-admin/tickets", label: "Tickets", icon: LayoutList, exact: true },
  { href: "/super-admin/tickets/archive", label: "Solved Archive", icon: Archive },
  { href: "/super-admin/tickets/settings", label: "Settings", icon: Settings2 },
];

const POLL_MS = 30_000;

/** Fired by the shell when new unread tickets arrive, so the list can refresh. */
export const TICKETS_UNREAD_CHANGED_EVENT = "edunivo:tickets-unread-changed";

/**
 * Chrome for every Super Admin ticket page: header, section tabs and the
 * live "new tickets" badge. Polls unread count every 30 s while visible and
 * toasts when new reports arrive ("notify Super Admin instantly" in-app;
 * the support inbox gets an email too).
 */
export function TicketsAdminShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState<number | null>(null);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      ticketFetch<{ data: { unread: number } }>(getSuperAdminToken, "/superadmin/tickets/stats")
        .then((r) => {
          const count = r.data.unread;
          if (previous.current !== null && count > previous.current) {
            toast.info(`${count - previous.current} new ticket update${count - previous.current > 1 ? "s" : ""}`, {
              action: { label: "View", onClick: () => router.push("/super-admin/tickets") },
            });
            window.dispatchEvent(new Event(TICKETS_UNREAD_CHANGED_EVENT));
          }
          previous.current = count;
          setUnread(count);
        })
        .catch(() => {});
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [router, pathname]);

  const logout = () => {
    clearSuperAdminAuth();
    router.push("/super-admin/login");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary),transparent_92%),transparent_60%),var(--background)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/super-admin")} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/30">
            <LifeBuoy className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-[17px] leading-tight font-bold text-foreground">Support Tickets</h1>
            <p className="text-[11.5px] text-muted-foreground">Bug reports from every school and role</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Button variant="outline" size="sm" onClick={logout} className="rounded-xl">
              <LogOut /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Ticket sections" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href || /^\/super-admin\/tickets\/[a-f\d]{24}$/i.test(pathname) : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.exact && unread ? (
                  <span className="rounded-full bg-destructive px-1.5 py-px text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
                ) : null}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-accent" />}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
