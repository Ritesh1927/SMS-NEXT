"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bell, Bug, LogOut, Megaphone, Search, Users, GraduationCap, School as SchoolIcon, Loader2, Settings as SettingsIcon,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ProfileMenuItem } from "@/components/dashboard/ProfileMenuItem";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { formatClassName } from "@/lib/helpers";

const ROLE_LABEL: Record<string, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  isPinned: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface NoticesResponse {
  success: boolean;
  data: NoticeItem[];
}

interface LicenseWarning {
  state: "countdown" | "expired" | "suspended";
  daysLeft: number | null;
  endDate: string | null;
}

interface SearchResult {
  id: string;
  label: string;
  sub: string;
}

interface StudentRow {
  _id: string;
  name: string;
  class: string;
  section: string;
}
interface TeacherRow {
  _id: string;
  name: string;
  designation?: string;
}
interface ClassRow {
  _id: string;
  name: string;
  section: string;
  studentCount?: number;
}

export function DashboardTopBar({
  user,
  licenseWarning,
  onLogout,
}: {
  user: AuthUser;
  licenseWarning: LicenseWarning | null;
  onLogout: () => void;
}) {
  const router = useRouter();
  const canSearch = user.role === "schooladmin";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<SearchResult[]>([]);
  const [teachers, setTeachers] = useState<SearchResult[]>([]);
  const [classes, setClasses] = useState<SearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  // The lastSeen cutoff that decides which rows are bolded as "new" and how
  // many the bell's badge shows. Left untouched while the panel is merely
  // open (so a freshly-opened panel still shows you what's new), and only
  // committed -- in state, not just localStorage, so it takes effect
  // immediately rather than on the next full page load -- once the user
  // actually acts on it: closes the panel, clicks a notice, or hits "View
  // all notices".
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const lastSeenKey = `notif_lastSeen_${user.id}`;

  // Only set for schools with a Super Admin-configured seat cap -- most
  // (self-signup) schools have none, and this stays null for them so the
  // usage line just doesn't render.
  const [seats, setSeats] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    if (user.role !== "schooladmin") return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { usersUsed: number | null; usersTotal: number } | null }>("/school/license", token)
      .then((res) => {
        if (res.data && res.data.usersUsed != null && res.data.usersTotal > 0) {
          setSeats({ used: res.data.usersUsed, total: res.data.usersTotal });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<NoticesResponse>("/notices", token)
      .then((res) => {
        const list = res.data.slice(0, 8);
        setNotices(list);
        setLastSeen(localStorage.getItem(lastSeenKey));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isNew = (n: NoticeItem) => !lastSeen || new Date(n.createdAt) > new Date(lastSeen);
  const newCount = notices.filter(isNew).length;

  const markAllSeen = () => {
    if (notices.length === 0) return;
    // notices is sorted pinned/urgent-first, not by recency, so the cutoff
    // has to be the max createdAt across the whole list -- not notices[0],
    // which could be an older pinned/urgent notice sitting ahead of a
    // newer plain one.
    const newest = notices.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), notices[0].createdAt);
    localStorage.setItem(lastSeenKey, newest);
    setLastSeen(newest);
  };

  const handleBellOpen = (isOpen: boolean) => {
    if (!isOpen) markAllSeen();
  };

  const goToNotice = () => {
    markAllSeen();
    router.push("/dashboard/notices");
  };

  useEffect(() => {
    const q = query.trim();
    if (!canSearch || q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: clearing stale results when the query shrinks below the search threshold.
      setStudents([]);
      setTeachers([]);
      setClasses([]);
      return;
    }
    const token = getToken();
    if (!token) return;
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.all([
        apiGet<{ data: StudentRow[] }>(`/students?search=${encodeURIComponent(q)}`, token).catch(() => ({ data: [] })),
        apiGet<{ data: TeacherRow[] }>(`/teachers?search=${encodeURIComponent(q)}`, token).catch(() => ({ data: [] })),
        apiGet<{ data: ClassRow[] }>("/classes", token).catch(() => ({ data: [] })),
      ]).then(([sRes, tRes, cRes]) => {
        setStudents(sRes.data.slice(0, 5).map((s) => ({ id: s._id, label: s.name, sub: formatClassName(s.class, s.section) })));
        setTeachers(tRes.data.slice(0, 5).map((t) => ({ id: t._id, label: t.name, sub: t.designation || "Teacher" })));
        const qLower = q.toLowerCase();
        setClasses(
          cRes.data
            .filter((c) => formatClassName(c.name, c.section).toLowerCase().includes(qLower))
            .slice(0, 5)
            .map((c) => ({ id: c._id, label: formatClassName(c.name, c.section), sub: `${c.studentCount ?? 0} students` })),
        );
      }).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, canSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goTo = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  const hasResults = students.length + teachers.length + classes.length > 0;
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 relative flex h-16 items-center gap-4 bg-card border-b border-border px-4 sm:px-6">
      <SidebarTrigger className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" />

      {canSearch && (
        <div className="relative hidden md:block" ref={boxRef}>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students, classes, teachers..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-80 h-10 pl-10 pr-14 rounded-2xl bg-muted/50 focus-visible:ring-primary/30"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            Ctrl K
          </kbd>

          {open && query.trim().length >= 2 && (
            <div className="absolute top-full mt-2 w-full bg-card rounded-xl border border-border shadow-lg z-40 max-h-96 overflow-y-auto py-2">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              ) : !hasResults ? (
                <p className="text-sm text-muted-foreground text-center py-6">No results for &quot;{query}&quot;.</p>
              ) : (
                <>
                  {students.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="h-3 w-3" /> Students
                      </p>
                      {students.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/students")} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{r.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{r.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {teachers.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" /> Teachers
                      </p>
                      {teachers.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/teachers")} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{r.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{r.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {classes.length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <SchoolIcon className="h-3 w-3" /> Classes
                      </p>
                      {classes.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/classes")} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{r.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{r.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {licenseWarning && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-2 shrink-0 max-w-md ml-auto ${
            licenseWarning.state === "countdown" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 shrink-0 ${licenseWarning.state === "countdown" ? "text-amber-600" : "text-red-600"}`}
          />
          <div className="min-w-0">
            <p
              className={`text-xs font-semibold leading-tight ${
                licenseWarning.state === "countdown" ? "text-amber-800" : "text-red-800"
              }`}
            >
              {licenseWarning.state === "countdown"
                ? `License expires in ${licenseWarning.daysLeft} day${licenseWarning.daysLeft !== 1 ? "s" : ""} (${licenseWarning.endDate})`
                : licenseWarning.state === "suspended"
                  ? `License suspended${licenseWarning.endDate ? ` (${licenseWarning.endDate})` : ""}`
                  : `License expired${licenseWarning.endDate ? ` (${licenseWarning.endDate})` : ""}`}
            </p>
            <p
              className={`text-[10px] leading-tight mt-0.5 ${
                licenseWarning.state === "countdown" ? "text-amber-600" : "text-red-600"
              }`}
            >
              {licenseWarning.state === "countdown"
                ? "Contact administrator to renew and avoid disruption."
                : "Contact the super-admin to renew."}
            </p>
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2.5 shrink-0 ${licenseWarning ? "" : "ml-auto"}`}>
        <DropdownMenu onOpenChange={handleBellOpen}>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
                <Bell className={`h-[18px] w-[18px] ${newCount > 0 ? "text-primary" : ""}`} />
                {newCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
                    <span className="relative">{newCount > 9 ? "9+" : newCount}</span>
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-96 p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-sm font-bold text-foreground">Notifications</span>
              {newCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {newCount} new
                </span>
              )}
            </div>
            {notices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <div className="icon-chip h-11 w-11 bg-muted text-muted-foreground/60">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">No notices yet.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-border/70">
                {notices.map((n) => {
                  const unread = isNew(n);
                  return (
                    <button
                      key={n._id}
                      onClick={goToNotice}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${unread ? "bg-primary/5" : ""}`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                          n.isUrgent ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-primary to-accent"
                        }`}
                      >
                        {n.isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm truncate ${unread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>{n.title}</p>
                          {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="border-t border-border p-2">
              <button
                onClick={goToNotice}
                className="w-full rounded-lg py-2 text-center text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                View all notices
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={false}
            render={
              <div className="group/avatar flex items-center gap-2 cursor-pointer rounded-full hover:bg-muted p-1 pr-2 transition-colors">
                <Avatar className="h-9 w-9 ring-2 ring-primary/20 transition-shadow group-data-popup-open/avatar:ring-primary/50 group-data-popup-open/avatar:shadow-[0_0_0_4px_rgba(80,72,229,0.12)]">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            }
          />
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="w-80 overflow-hidden rounded-2xl p-0 shadow-[0_24px_60px_-20px_rgba(37,30,140,0.35)] ring-1 ring-foreground/[0.07]"
          >
            {/* Identity header: brand gradient with soft light blobs. */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary to-accent px-4 pt-4 pb-5 text-white">
              <div className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <Avatar className="h-14 w-14 shrink-0 ring-[3px] ring-white/40 shadow-lg shadow-black/15">
                  <AvatarFallback className="bg-white text-lg font-bold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-heading text-[15px] leading-tight font-bold">{user.name}</p>
                  <p className="mt-0.5 truncate text-xs text-white/80">{user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-white/25 backdrop-blur-sm">
                      {ROLE_LABEL[user.role] || user.role}
                    </span>
                    {user.schoolName && (
                      <span className="inline-flex max-w-[150px] items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium text-white/90">
                        <SchoolIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{user.schoolName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {user.role === "teacher" && user.classTeacherOf && user.classTeacherOf.length > 0 && (
                <p className="relative mt-3 truncate text-[11px] text-white/85">
                  Class Teacher of {user.classTeacherOf.map((c) => `Class ${c}`).join(", ")}
                </p>
              )}
            </div>

            {/* Plan seat usage (only schools with a Super Admin seat cap). */}
            {seats && (
              <div className="mx-3 mt-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Plan users
                  </span>
                  <span>
                    <span className={seats.used >= seats.total ? "font-bold text-destructive" : "font-bold text-foreground"}>{seats.used}</span>
                    <span className="text-muted-foreground"> / {seats.total}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/70">
                  <div
                    className={seats.used >= seats.total ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-gradient-to-r from-primary to-accent"}
                    style={{ width: `${Math.min(100, Math.round((seats.used / seats.total) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-0.5 p-2">
              {user.role === "schooladmin" && (
                <ProfileMenuItem
                  icon={SettingsIcon}
                  title="Settings"
                  description="School configuration and preferences"
                  onClick={() => router.push("/dashboard/settings")}
                />
              )}
              <ProfileMenuItem
                icon={Bug}
                title="My Reported Bugs"
                description="Track issues you reported to support"
                onClick={() => router.push("/dashboard/my-bugs")}
              />
              <InstallButton variant="menu" />
            </div>

            <div className="mx-3 h-px bg-border/70" />
            <div className="p-2">
              <ProfileMenuItem icon={LogOut} title="Log out" description="Sign out of this device" onClick={onLogout} tone="danger" />
            </div>

            <div className="flex items-center justify-center gap-1.5 border-t border-border/60 bg-muted/30 px-4 py-2 text-[10.5px] text-muted-foreground">
              <GraduationCap className="h-3 w-3 text-primary" />
              <span className="font-semibold text-foreground/80">EduNivo</span>
              <span>· School Management System</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
