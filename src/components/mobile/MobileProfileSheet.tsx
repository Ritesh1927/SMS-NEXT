"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, School, Settings, ShieldCheck, X } from "lucide-react";
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
      <SheetContent side="bottom" showCloseButton={false} className="flex h-[92vh] flex-col gap-0 rounded-t-[26px] border-none p-0">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-5 pb-6 pt-2.5">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border/80" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-black/5"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="mt-4 flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 ring-4 ring-white shadow-[0_8px_24px_-6px_rgba(79,70,229,0.4)]">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <p className="mt-3 text-lg font-extrabold tracking-tight text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user.role]}
              </span>
              {user.schoolName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 ring-1 ring-border/60">
                  <School className="h-3 w-3" /> {user.schoolName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {(seats || (user.role === "teacher" && user.classTeacherOf?.length) || (user.role === "parent" && user.children?.length)) && (
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {seats && (
                <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Seats Used</p>
                  <p className={`mt-1 text-xl font-extrabold ${seats.used >= seats.total ? "text-destructive" : "text-foreground"}`}>
                    {seats.used}
                    <span className="text-sm font-semibold text-muted-foreground"> / {seats.total}</span>
                  </p>
                </div>
              )}
              {user.role === "teacher" && user.classTeacherOf && user.classTeacherOf.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Class Teacher Of</p>
                  <p className="mt-1 text-sm font-bold text-foreground truncate">{user.classTeacherOf.map((c) => `Class ${c}`).join(", ")}</p>
                </div>
              )}
              {user.role === "parent" && user.children && user.children.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 col-span-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Children</p>
                  <p className="mt-1 text-sm font-bold text-foreground truncate">{user.children.map((c) => c.name).join(", ")}</p>
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
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left transition-colors active:bg-muted/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Settings className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground">Settings</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-left transition-colors active:bg-destructive/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
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
