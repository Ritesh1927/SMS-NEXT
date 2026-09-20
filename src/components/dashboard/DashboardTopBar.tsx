"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, LogOut, Megaphone, Search, Users, GraduationCap, School as SchoolIcon, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { formatClassName } from "@/lib/helpers";

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  createdAt: string;
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
  const [hasUnseen, setHasUnseen] = useState(false);
  const lastSeenKey = `notif_lastSeen_${user.id}`;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<NoticesResponse>("/notices", token)
      .then((res) => {
        const list = res.data.slice(0, 8);
        setNotices(list);
        const lastSeen = localStorage.getItem(lastSeenKey);
        const newest = list[0]?.createdAt;
        setHasUnseen(!!newest && (!lastSeen || new Date(newest) > new Date(lastSeen)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBellOpen = (isOpen: boolean) => {
    if (isOpen && notices[0]?.createdAt) {
      localStorage.setItem(lastSeenKey, notices[0].createdAt);
      setHasUnseen(false);
    }
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
                <Bell className="h-[18px] w-[18px]" />
                {hasUnseen && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Notices</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No notices yet.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1">
                {notices.map((n) => (
                  <div key={n._id} className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted">
                    {n.isUrgent ? (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <Megaphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/notices")}>View all notices</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={false}
            render={
              <div className="flex items-center gap-2 cursor-pointer rounded-full hover:bg-muted p-1 pr-2 transition-colors">
                <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
