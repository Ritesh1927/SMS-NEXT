"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bell, LogOut, Megaphone, Search, Users, GraduationCap, School as SchoolIcon, Loader2, Settings as SettingsIcon,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
  daysLeft: number;
  endDate: string;
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
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 shrink-0 max-w-md ml-auto">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-800 leading-tight">
              License expires in {licenseWarning.daysLeft} day{licenseWarning.daysLeft !== 1 ? "s" : ""} ({licenseWarning.endDate})
            </p>
            <p className="text-[10px] text-amber-600 leading-tight mt-0.5">Contact administrator to renew and avoid disruption.</p>
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
              <div className="flex items-center gap-2 cursor-pointer rounded-full hover:bg-muted p-1 pr-2 transition-colors">
                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            }
          />
          <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
              <Avatar className="h-12 w-12 shrink-0 ring-2 ring-white shadow-[0_4px_12px_-2px_rgba(79,70,229,0.35)]">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-base font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <span className="inline-flex items-center mt-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {ROLE_LABEL[user.role] || user.role}
                </span>
                {user.role === "teacher" && user.classes && user.classes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    Teaches {user.classes.map((c) => `Class ${c}`).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="p-1.5">
              {user.role === "schooladmin" && (
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="gap-2 rounded-lg">
                  <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onLogout} className="gap-2 rounded-lg text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
