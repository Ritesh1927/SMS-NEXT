"use client";

import { Bell, GraduationCap as Logo, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AuthUser } from "@/contexts/AuthContext";

export function MobileTopBar({
  user,
  canSearch,
  unreadNotices,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
}: {
  user: AuthUser;
  canSearch: boolean;
  unreadNotices: number;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <header
      className="flex h-14 items-center gap-2 border-b border-border/70 bg-card/75 px-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-sm shadow-primary/25">
          <Logo className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold leading-tight text-foreground">{user.schoolName || "EduNivo"}</p>
          <p className="truncate text-[10.5px] leading-tight text-muted-foreground">{user.name}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-95 active:bg-muted"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-95 active:bg-muted"
        >
          <Bell className={`h-[18px] w-[18px] ${unreadNotices > 0 ? "text-primary" : ""}`} />
          {unreadNotices > 0 && (
            <span className="absolute right-1 top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-card">
              {unreadNotices > 9 ? "9+" : unreadNotices}
            </span>
          )}
        </button>

        <button type="button" onClick={onOpenProfile} aria-label="Profile" className="rounded-full p-0.5 transition-transform active:scale-95">
          <Avatar className="h-8 w-8 ring-2 ring-primary/20">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[11px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
