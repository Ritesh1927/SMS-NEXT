"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { PageLoader } from "@/components/PageLoader";
import { MobileShell } from "@/components/mobile/MobileShell";

interface UnreadResponse {
  success: boolean;
  total: number;
}

interface LicenseResponse {
  success: boolean;
  data: { endDate: string | null; daysLeft: number | null } | null;
}

const UNREAD_POLL_MS = 15000;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [licenseWarning, setLicenseWarning] = useState<{ daysLeft: number; endDate: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

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
        if (!res.data?.endDate || res.data.daysLeft == null) return;
        if (res.data.daysLeft > 0 && res.data.daysLeft <= 7) {
          setLicenseWarning({
            daysLeft: res.data.daysLeft,
            endDate: new Date(res.data.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          });
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
      <AppSidebar user={user} unreadCount={unread} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Desktop (≥768px): unchanged sidebar-topbar shell. */}
        <div className="hidden md:block">
          <DashboardTopBar user={user} licenseWarning={licenseWarning} onLogout={handleLogout} />
        </div>

        {/* Mobile (<768px): sticky top bar, fixed bottom nav, and the
            sheets they open -- a separate chrome layer, not a restyle of
            the desktop one. See components/mobile/MobileShell.tsx. */}
        <MobileShell user={user} unreadChat={unread} licenseWarning={licenseWarning} onLogout={handleLogout} />

        <main className="flex-1 overflow-auto px-4 py-4 pb-28 md:p-6">
          <div className="mx-auto max-w-6xl w-full space-y-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
