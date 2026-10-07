"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, ChevronRight, GraduationCap, LogOut, School, Settings, ShieldCheck, Users, X } from "lucide-react";
import { InstallButton } from "@/components/pwa/InstallButton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { ROLE_LABEL } from "@/config/mobileNav";

interface LicenseResponse {
  success: boolean;
  data: { usersUsed: number | null; usersTotal: number } | null;
}

export function MobileProfileSheet({
  open,
  onOpenChange,
  user,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
  onLogout: () => void;
}) {
  const router = useRouter();
  const [seats, setSeats] = useState<{ used: number; total: number } | null>(null);
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const hasStats = Boolean(seats || (user.role === "teacher" && user.classTeacherOf?.length) || (user.role === "parent" && user.children?.length));

  useEffect(() => {
    if (!open || user.role !== "schooladmin") return;
    const token = getToken();
    if (!token) return;
    apiGet<LicenseResponse>("/school/license", token)
      .then((res) => {
        if (res.data && res.data.usersUsed != null && res.data.usersTotal > 0) {
          setSeats({ used: res.data.usersUsed, total: res.data.usersTotal });
        }
      })
      .catch(() => {});
  }, [open, user.role]);

  const goSettings = () => {
    onOpenChange(false);
    router.push("/dashboard/settings");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="flex h-[92vh] flex-col gap-0 overflow-hidden rounded-t-[26px] border-none p-0">
        <div className="relative shrink-0 overflow-hidden rounded-t-[26px] bg-gradient-to-br from-primary to-accent px-5 pb-4 pt-2.5">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-white/30" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute right-3 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors active:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mt-3.5 flex items-center gap-3.5">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-white/60 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.3)]">
              <AvatarFallback className="bg-white/15 text-base font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="truncate text-[15px] font-bold leading-tight text-white">{user.name}</p>
              <p className="truncate text-[11.5px] leading-tight text-white/70">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/25">
                  <ShieldCheck className="h-2.5 w-2.5" /> {ROLE_LABEL[user.role]}
                </span>
                {user.schoolName && (
                  <span className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/25">
                    <School className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{user.schoolName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
          {hasStats && (
            <div className="mb-5 grid grid-cols-2 gap-2.5">
              {seats && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-sm">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Seats Used</p>
                    <p className={`text-base font-extrabold leading-tight ${seats.used >= seats.total ? "text-destructive" : "text-foreground"}`}>
                      {seats.used}
                      <span className="text-xs font-semibold text-muted-foreground"> / {seats.total}</span>
                    </p>
                  </div>
                </div>
              )}
              {user.role === "teacher" && user.classTeacherOf && user.classTeacherOf.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Class Teacher Of</p>
                    <p className="truncate text-sm font-bold leading-tight text-foreground">{user.classTeacherOf.map((c) => `Class ${c}`).join(", ")}</p>
                  </div>
                </div>
              )}
              {user.role === "parent" && user.children && user.children.length > 0 && (
                <div className="col-span-2 flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Children</p>
                    <p className="truncate text-sm font-bold leading-tight text-foreground">{user.children.map((c) => c.name).join(", ")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Account</p>
          <div className="flex flex-col gap-2">
            {user.role === "schooladmin" && (
              <button
                type="button"
                onClick={goSettings}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left shadow-sm transition-all active:scale-[0.98] active:bg-muted/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-black/10">
                  <Settings className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground">Settings</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push("/dashboard/my-bugs");
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left shadow-sm transition-all active:scale-[0.98] active:bg-muted/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-black/10">
                <Bug className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground">My Reported Bugs</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Close this sheet first so the install sheet isn't stacked on it. */}
            <InstallButton variant="sheet" onSelect={() => onOpenChange(false)} />

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-left shadow-sm transition-all active:scale-[0.98] active:bg-destructive/10"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-black/10">
                <LogOut className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-sm font-semibold text-destructive">Log out</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
