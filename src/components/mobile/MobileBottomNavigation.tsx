"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, LayoutGrid, UserRound, Zap } from "lucide-react";
import type { MobileSheet } from "./MobileShell";

export function MobileBottomNavigation({
  activeSheet,
  unreadNotices,
  onOpenModules,
  onOpenQuickActions,
  onOpenNotifications,
  onOpenProfile,
}: {
  activeSheet: MobileSheet;
  unreadNotices: number;
  onOpenModules: () => void;
  onOpenQuickActions: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard" && activeSheet === null;

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 transition-colors active:scale-95 ${
      active ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex max-w-md items-center px-2 pt-1.5">
        <Link href="/dashboard" className={tabClass(isHome)}>
          <House className={`h-[21px] w-[21px] ${isHome ? "fill-primary/15" : ""}`} />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        <button type="button" onClick={onOpenQuickActions} className={tabClass(activeSheet === "quickActions")}>
          <Zap className={`h-[21px] w-[21px] ${activeSheet === "quickActions" ? "fill-primary/15" : ""}`} />
          <span className="text-[10px] font-semibold">Quick Add</span>
        </button>

        {/* Center FAB -- elevated above the bar, Modules */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            onClick={onOpenModules}
            aria-label="Modules"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[0_8px_20px_-4px_rgba(79,70,229,0.55)] ring-4 ring-card transition-transform active:scale-90"
          >
            <LayoutGrid
              className={`h-6 w-6 transition-transform duration-300 ease-out ${
                activeSheet === "modules" ? "rotate-[135deg]" : "rotate-0 animate-spin [animation-duration:4s]"
              }`}
            />
          </button>
          <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Modules</span>
        </div>

        <button type="button" onClick={onOpenNotifications} className={`relative ${tabClass(activeSheet === "notifications")}`}>
          <span className="relative">
            <Bell className={`h-[21px] w-[21px] ${activeSheet === "notifications" ? "fill-primary/15" : ""}`} />
            {unreadNotices > 0 && (
              <span className="absolute -right-1.5 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent px-0.5 text-[8.5px] font-bold leading-none text-white ring-2 ring-card">
                {unreadNotices > 9 ? "9+" : unreadNotices}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold">Alerts</span>
        </button>

        <button type="button" onClick={onOpenProfile} className={tabClass(activeSheet === "profile")}>
          <UserRound className={`h-[21px] w-[21px] ${activeSheet === "profile" ? "fill-primary/15" : ""}`} />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
}
