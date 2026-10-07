"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Bug, ChevronRight, Crown, LifeBuoy, Loader2, LogOut, Menu, Moon, Plus, School, Search, Settings2, Sun,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { saRequest, setPendingAction, SA_PENDING_ACTION_EVENT } from "@/lib/superAdminApi";
import { timeAgo } from "@/lib/bugReports/client";
import { PriorityBadge } from "@/components/bugs/TicketBadges";
import { breadcrumbsFor, pageTitleFor } from "./nav";

interface HeaderProps {
  unreadTickets: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  adminName: string;
  adminEmail: string;
  onLogout: () => void;
}

interface RecentTicket {
  _id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  adminUnread: boolean;
  lastActivityAt: string;
  reporter: { name: string; schoolName: string };
}

const iconButton =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground";

/** Floating top bar: breadcrumbs, global search, quick actions, notifications, theme, profile. */
export function SuperAdminHeader({
  unreadTickets, theme, onToggleTheme, onOpenMenu, onOpenSearch, adminName, adminEmail, onLogout,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = breadcrumbsFor(pathname);
  const [recent, setRecent] = useState<RecentTicket[] | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRecent = () => {
    setLoadingRecent(true);
    saRequest<{ data: RecentTicket[] }>("/superadmin/tickets?limit=6&sort=lastActivityAt&order=desc&archived=false")
      .then((r) => setRecent(r.data))
      .catch(() => setRecent([]))
      .finally(() => setLoadingRecent(false));
  };

  /** Quick actions open dialogs on their pages, navigating there first if needed. */
  const runAction = (action: "register-school" | "create-plan", href: string) => {
    setPendingAction({ type: action });
    if (pathname === href) window.dispatchEvent(new Event(SA_PENDING_ACTION_EVENT));
    else router.push(href);
  };

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-card/80 px-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-18px_rgba(37,30,140,0.25)] ring-1 ring-border/70 backdrop-blur-xl sm:px-3 dark:bg-card/70 dark:ring-white/10">
        <button type="button" onClick={onOpenMenu} aria-label="Open navigation" className={cn(iconButton, "lg:hidden")}>
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs (desktop) / page title (mobile) */}
        <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center pl-2 lg:flex">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
                  <li className="min-w-0 truncate">
                    {c.href && !last ? (
                      <Link href={c.href} className="text-muted-foreground transition-colors hover:text-foreground">{c.label}</Link>
                    ) : (
                      <span className={last ? "font-semibold text-foreground" : "text-muted-foreground"} aria-current={last ? "page" : undefined}>
                        {c.label}
                      </span>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
        <p className="min-w-0 flex-1 truncate pl-1 font-heading text-[15px] font-bold text-foreground lg:hidden">{pageTitleFor(pathname)}</p>

        {/* Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-10 w-64 items-center gap-2 rounded-xl bg-muted/60 px-3 text-[13px] text-muted-foreground ring-1 ring-border/60 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:flex xl:w-80"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search schools, tickets…</span>
          <kbd className="rounded-md border border-border bg-card px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
        <button type="button" onClick={onOpenSearch} aria-label="Search" className={cn(iconButton, "md:hidden")}>
          <Search className="h-5 w-5" />
        </button>

        {/* Quick actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Quick actions" className={cn(iconButton, "bg-gradient-to-br from-primary to-accent text-white hover:text-white hover:opacity-90 aria-expanded:text-white sm:w-auto sm:gap-1.5 sm:px-3")} />
            }
          >
            <Plus className="h-4.5 w-4.5" />
            <span className="hidden text-[13px] font-semibold sm:inline">New</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-xl p-1.5">
            <QuickAction icon={School} title="Register school" hint="Choose a plan and onboard" onClick={() => runAction("register-school", "/super-admin/schools")} />
            <QuickAction icon={Crown} title="Create plan" hint="New subscription plan" onClick={() => runAction("create-plan", "/super-admin/plans")} />
            <QuickAction icon={Bug} title="Report a bug" hint="File a support ticket" onClick={() => router.push("/super-admin/report-bug")} />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications: latest ticket activity */}
        <DropdownMenu onOpenChange={(open) => open && loadRecent()}>
          <DropdownMenuTrigger render={<button type="button" aria-label={unreadTickets ? `Notifications, ${unreadTickets} unread` : "Notifications"} className={iconButton} />}>
            <Bell className="h-5 w-5" />
            {unreadTickets > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white ring-2 ring-card">
                {unreadTickets > 9 ? "9+" : unreadTickets}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,380px)] overflow-hidden rounded-2xl p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[14px] font-bold text-foreground">Notifications</p>
              {unreadTickets > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">{unreadTickets} unread</span>}
            </div>
            <div className="max-h-96 overflow-y-auto p-1.5">
              {loadingRecent && !recent ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : !recent?.length ? (
                <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No ticket activity yet.</p>
              ) : (
                recent.map((t) => (
                  <DropdownMenuItem key={t._id} onClick={() => router.push(`/super-admin/tickets/${t._id}`)} className="items-start gap-3 rounded-xl px-3 py-2.5">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", t.adminUnread ? "bg-destructive" : "bg-transparent")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{t.title}</span>
                      <span className="block truncate text-[11.5px] opacity-75">
                        {t.ticketNumber} · {t.reporter.name} · {t.reporter.schoolName || "System"}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] opacity-75">
                        <PriorityBadge priority={t.priority} className="text-[10px]" />
                        {timeAgo(t.lastActivityAt)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <Link href="/super-admin/tickets" className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-[12.5px] font-semibold text-primary hover:bg-muted/60">
              <LifeBuoy className="h-3.5 w-3.5" /> View all tickets
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className={cn(iconButton, "hidden sm:flex")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Account" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[13px] font-bold text-white ring-2 ring-card">
              {(adminName || "S").slice(0, 1).toUpperCase()}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-1.5">
            <div className="px-3 py-2.5">
              <p className="truncate text-[13.5px] font-semibold text-foreground">{adminName || "Super Admin"}</p>
              <p className="truncate text-[12px] text-muted-foreground">{adminEmail}</p>
              <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">System Administrator</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleTheme} className="gap-2.5 rounded-lg px-3 py-2 sm:hidden">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {theme === "dark" ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/super-admin/tickets/settings")} className="gap-2.5 rounded-lg px-3 py-2">
              <Settings2 className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} variant="destructive" className="gap-2.5 rounded-lg px-3 py-2">
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function QuickAction({ icon: Icon, title, hint, onClick }: { icon: typeof School; title: string; hint: string; onClick: () => void }) {
  return (
    <DropdownMenuItem onClick={onClick} className="gap-3 rounded-lg px-2.5 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11.5px] opacity-75">{hint}</span>
      </span>
    </DropdownMenuItem>
  );
}
