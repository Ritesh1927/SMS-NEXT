"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { PageLoader } from "@/components/PageLoader";
import { MobileShell } from "@/components/mobile/MobileShell";
import { InstallPromptGate } from "@/components/pwa/InstallPromptGate";

interface UnreadResponse {
  success: boolean;
  total: number;
}

interface LicenseResponse {
  success: boolean;
  data: { endDate: string | null; daysLeft: number | null; status?: "trial" | "active" | "expired" | "suspended" | null } | null;
}

// countdown = amber "expires in N days" (final week before expiry);
// expired/suspended = red notice — shown even past endDate, where the old
// daysLeft > 0 condition used to silently drop the banner entirely.
interface LicenseWarning {
  state: "countdown" | "expired" | "suspended";
  daysLeft: number | null;
  endDate: string | null;
}

const UNREAD_POLL_MS = 15000;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [licenseWarning, setLicenseWarning] = useState<LicenseWarning | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  // <main> (below) is `overflow-auto`, which makes it its own scrolling
  // element rather than the page/window -- Next's built-in "reset scroll on
  // navigate" only resets window scroll, not a custom scroll container like
  // this one. Left alone, navigating away from a page you'd scrolled down on
  // (e.g. Home) carries that scroll offset into the next page, so its
  // heading loads already partway under the fixed mobile top bar. Force it
  // back to the top on every route change instead.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    const poll = () => {
      apiGet<UnreadResponse>("/chat/unread", token)
        .then((res) => setUnread(res.total))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user?.role !== "schooladmin") return;
    const token = getToken();
    if (!token) return;
    apiGet<LicenseResponse>("/school/license", token)
      .then((res) => {
        if (!res.data) return;
        const { endDate, daysLeft, status } = res.data;
        const endDateLabel = endDate
          ? new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : null;
        if (status === "suspended") {
          setLicenseWarning({ state: "suspended", daysLeft, endDate: endDateLabel });
          return;
        }
        if (status === "expired" || (endDate && daysLeft != null && daysLeft <= 0)) {
          setLicenseWarning({ state: "expired", daysLeft, endDate: endDateLabel });
          return;
        }
        if (endDate && daysLeft != null && daysLeft > 0 && daysLeft <= 7) {
          setLicenseWarning({ state: "countdown", daysLeft, endDate: endDateLabel });
        }
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) {
    return <PageLoader fullScreen />;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <SidebarProvider>
      {/* Desktop (≥1024px): unchanged sidebar. Wrapped in `hidden lg:block`
          rather than left to AppSidebar's own internal mobile detection --
          that's hardcoded to the old 768px breakpoint (components/ui/sidebar.tsx
          -> use-mobile.ts), which is now *below* our 1024px mobile/tablet
          cutoff. Left unwrapped, AppSidebar rendered its "desktop" branch for
          the whole 768-1023px band (since 768px-and-up looked like desktop to
          its own check), showing at the same time as MobileShell's bottom
          nav below. This outer wrapper is the single source of truth for
          "is the sidebar visible" and overrides that regardless of what
          AppSidebar's own hook thinks. */}
      <div className="hidden lg:block">
        <AppSidebar user={user} unreadCount={unread} onLogout={handleLogout} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Desktop (≥1024px): unchanged sidebar-topbar shell. */}
        <div className="hidden lg:block">
          <DashboardTopBar user={user} licenseWarning={licenseWarning} onLogout={handleLogout} />
        </div>

        {/* Mobile/tablet (<1024px): sticky top bar, fixed bottom nav, and the
            sheets they open -- a separate chrome layer, not a restyle of
            the desktop one. See components/mobile/MobileShell.tsx. */}
        <MobileShell user={user} unreadChat={unread} licenseWarning={licenseWarning} onLogout={handleLogout} />

        <main ref={mainRef} className="flex-1 overflow-auto px-4 py-4 pb-28 lg:p-6">
          <div className="mx-auto max-w-6xl w-full space-y-6">{children}</div>
        </main>
      </div>
      {/* Offers "Install app" a few seconds after login, for every role. */}
      <InstallPromptGate />
    </SidebarProvider>
  );
}
