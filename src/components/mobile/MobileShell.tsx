"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { useNavAccess } from "@/config/mobileNav";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { MobileModulesDrawer } from "./MobileModulesDrawer";
import { MobileQuickActions } from "./MobileQuickActions";
import { MobileNotificationPanel } from "./MobileNotificationPanel";
import { MobileProfileSheet } from "./MobileProfileSheet";
import { MobileSearchOverlay } from "./MobileSearchOverlay";

export type MobileSheet = "modules" | "quickActions" | "notifications" | "profile" | "search" | null;

interface NoticeItem {
  _id: string;
  createdAt: string;
}
interface NoticesResponse {
  success: boolean;
  data: NoticeItem[];
}

// The entire mobile chrome layer for the dashboard: sticky top bar, fixed
// bottom navigation, and the full-screen sheets they open (modules,
// quick actions, notifications, profile, search). Everything here is
// gated `lg:hidden` (or, for the sheets, simply closed by default) so it
// never affects the ≥1024px desktop layout -- see AGENTS/CLAUDE notes on
// this task: desktop stays on AppSidebar + DashboardTopBar, untouched.
export function MobileShell({
  user,
  unreadChat,
  licenseWarning,
  onLogout,
}: {
  user: AuthUser;
  unreadChat: number;
  licenseWarning: { state: "countdown" | "expired" | "suspended"; daysLeft: number | null; endDate: string | null } | null;
  onLogout: () => void;
}) {
  const [activeSheet, setActiveSheet] = useState<MobileSheet>(null);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const sections = useNavAccess(user);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<NoticesResponse>("/notices", token)
      .then((res) => {
        const lastSeen = localStorage.getItem(`notif_lastSeen_${user.id}`);
        const count = res.data.filter((n) => !lastSeen || new Date(n.createdAt) > new Date(lastSeen)).length;
        setUnreadNotices(count);
      })
      .catch(() => {});
  }, [user.id, activeSheet]);

  const close = () => setActiveSheet(null);

  // Rendered twice below: once for real (fixed to the viewport, so it can
  // never scroll away -- same technique as the bottom nav), and once as an
  // invisible in-flow spacer of identical height, so <main> is pushed down
  // by exactly the right amount even though the license-warning banner
  // (which can wrap to two lines) makes that height variable. A plain
  // `pt-*` on <main> would either clip under the bar or leave a gap.
  const header = (
    <>
      <MobileTopBar
        user={user}
        canSearch={user.role === "schooladmin"}
        unreadNotices={unreadNotices}
        onOpenSearch={() => setActiveSheet("search")}
        onOpenNotifications={() => setActiveSheet("notifications")}
        onOpenProfile={() => setActiveSheet("profile")}
      />
      {licenseWarning && (
        <div
          className={`flex items-center gap-2.5 border-b px-4 py-2 ${
            licenseWarning.state === "countdown" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
          }`}
        >
          <AlertTriangle
            className={`h-3.5 w-3.5 shrink-0 ${licenseWarning.state === "countdown" ? "text-amber-600" : "text-red-600"}`}
          />
          <p
            className={`text-[11px] font-semibold leading-tight ${
              licenseWarning.state === "countdown" ? "text-amber-800" : "text-red-800"
            }`}
          >
            {licenseWarning.state === "countdown"
              ? `License expires in ${licenseWarning.daysLeft} day${licenseWarning.daysLeft !== 1 ? "s" : ""} (${licenseWarning.endDate})`
              : licenseWarning.state === "suspended"
                ? `License suspended${licenseWarning.endDate ? ` (${licenseWarning.endDate})` : ""}`
                : `License expired${licenseWarning.endDate ? ` (${licenseWarning.endDate})` : ""}`}
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 lg:hidden">{header}</div>
      <div className="invisible lg:hidden" aria-hidden="true">
        {header}
      </div>

      <div className="lg:hidden">
        <MobileBottomNavigation
          activeSheet={activeSheet}
          unreadNotices={unreadNotices}
          onOpenModules={() => setActiveSheet("modules")}
          onOpenQuickActions={() => setActiveSheet("quickActions")}
          onOpenNotifications={() => setActiveSheet("notifications")}
          onOpenProfile={() => setActiveSheet("profile")}
        />
      </div>

      <MobileModulesDrawer open={activeSheet === "modules"} onOpenChange={(o) => (o ? setActiveSheet("modules") : close())} sections={sections} unreadChat={unreadChat} />
      <MobileQuickActions open={activeSheet === "quickActions"} onOpenChange={(o) => (o ? setActiveSheet("quickActions") : close())} role={user.role} />
      <MobileNotificationPanel open={activeSheet === "notifications"} onOpenChange={(o) => (o ? setActiveSheet("notifications") : close())} user={user} />
      <MobileProfileSheet open={activeSheet === "profile"} onOpenChange={(o) => (o ? setActiveSheet("profile") : close())} user={user} onLogout={onLogout} />
      {user.role === "schooladmin" && (
        <MobileSearchOverlay open={activeSheet === "search"} onOpenChange={(o) => (o ? setActiveSheet("search") : close())} user={user} />
      )}
    </>
  );
}
