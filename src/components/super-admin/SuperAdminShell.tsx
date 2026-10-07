"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearSuperAdminAuth, getSuperAdminUser } from "@/lib/superAdminAuth";
import { saRequest } from "@/lib/superAdminApi";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { SuperAdminHeader } from "./SuperAdminHeader";
import { CommandPalette } from "./CommandPalette";
import { TICKETS_UNREAD_CHANGED_EVENT } from "./events";
import { pageTitleFor } from "./nav";

const COLLAPSED_KEY = "sms_next_sa_sidebar_collapsed";
const THEME_KEY = "sms_next_sa_theme";
const UNREAD_POLL_MS = 30_000;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // preference just won't persist
  }
}

/**
 * Chrome for every protected Super Admin page: collapsible sidebar (drawer
 * on mobile), floating header, Ctrl/⌘+K search, Ctrl/⌘+B sidebar toggle,
 * theme switch and the live unread-ticket count. Rendered by the protected
 * layout only after the auth check, so it's always client-side.
 */
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin] = useState(() => getSuperAdminUser());
  const [collapsed, setCollapsed] = useState(() => readStorage(COLLAPSED_KEY) === "1");
  const [theme, setTheme] = useState<"light" | "dark">(() => (readStorage(THEME_KEY) === "dark" ? "dark" : "light"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const previousUnread = useRef<number | null>(null);

  // Theme applies to the whole document while inside the console (dialogs
  // and toasts render in portals), and is removed again on the way out so
  // the school-facing app is never affected.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    document.title = `${pageTitleFor(pathname)} · EduNivo Admin`;
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      writeStorage(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  }, []);

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      writeStorage(THEME_KEY, next);
      return next;
    });

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (key === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // Live unread-ticket count ("notify Super Admin instantly", in-app side).
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      saRequest<{ data: { unread: number } }>("/superadmin/tickets/stats")
        .then((r) => {
          const count = r.data.unread;
          if (previousUnread.current !== null && count > previousUnread.current) {
            const added = count - previousUnread.current;
            toast.info(`${added} new ticket update${added > 1 ? "s" : ""}`, {
              action: { label: "View", onClick: () => router.push("/super-admin/tickets") },
            });
            window.dispatchEvent(new Event(TICKETS_UNREAD_CHANGED_EVENT));
          }
          previousUnread.current = count;
          setUnread(count);
        })
        .catch(() => {});
    };
    check();
    const id = window.setInterval(check, UNREAD_POLL_MS);
    // Opening a ticket clears its unread flag; refresh the badge on navigation.
    return () => window.clearInterval(id);
  }, [router, pathname]);

  const logout = () => {
    clearSuperAdminAuth();
    router.push("/super-admin/login");
  };

  const adminName = admin?.name ?? "";
  const adminEmail = admin?.email ?? "";

  return (
    <TooltipProvider delay={200}>
      <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_80%_-10%,color-mix(in_oklch,var(--primary),transparent_90%),transparent),radial-gradient(900px_400px_at_-10%_10%,color-mix(in_oklch,var(--accent),transparent_93%),transparent),var(--background)] text-foreground lg:flex">
        {/* Desktop sidebar */}
        <aside
          className="sticky top-0 z-20 hidden h-screen shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:block"
          style={{ width: collapsed ? 76 : 268 }}
        >
          <SuperAdminSidebar
            variant="desktop"
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            unreadTickets={unread}
            adminName={adminName}
            adminEmail={adminEmail}
            onLogout={logout}
          />
        </aside>

        {/* Mobile drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" showCloseButton={false} className="w-[86vw] max-w-[300px] gap-0 border-none p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SuperAdminSidebar
              variant="drawer"
              collapsed={false}
              unreadTickets={unread}
              adminName={adminName}
              adminEmail={adminEmail}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={logout}
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <a href="#sa-main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow-lg">
            Skip to content
          </a>
          <SuperAdminHeader
            unreadTickets={unread}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenMenu={() => setDrawerOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            adminName={adminName}
            adminEmail={adminEmail}
            onLogout={logout}
          />
          <main id="sa-main" className="mx-auto w-full max-w-[1440px] px-3 pt-5 pb-12 sm:px-5 lg:px-7">
            {children}
          </main>
        </div>

        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </TooltipProvider>
  );
}
