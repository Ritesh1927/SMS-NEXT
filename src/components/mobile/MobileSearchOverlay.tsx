"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, GraduationCap, Loader2, School as SchoolIcon, Search, Users, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { formatClassName } from "@/lib/helpers";

interface SearchResult {
  id: string;
  label: string;
  sub: string;
}
interface StudentRow { _id: string; name: string; class: string; section: string }
interface TeacherRow { _id: string; name: string; designation?: string }
interface ClassRow { _id: string; name: string; section: string; studentCount?: number }

const RECENT_LIMIT = 5;

export function MobileSearchOverlay({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
}) {
  const router = useRouter();
  const recentKey = `mobile_recent_search_${user.id}`;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<SearchResult[]>([]);
  const [teachers, setTeachers] = useState<SearchResult[]>([]);
  const [classes, setClasses] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(recentKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reading recent searches from localStorage (an external system) fresh each time the overlay opens.
      setRecent(raw ? JSON.parse(raw) : []);
    } catch {
      setRecent([]);
    }
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
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
      ])
        .then(([sRes, tRes, cRes]) => {
          setStudents(sRes.data.slice(0, 6).map((s) => ({ id: s._id, label: s.name, sub: formatClassName(s.class, s.section) })));
          setTeachers(tRes.data.slice(0, 6).map((t) => ({ id: t._id, label: t.name, sub: t.designation || "Teacher" })));
          const qLower = q.toLowerCase();
          setClasses(
            cRes.data
              .filter((c) => formatClassName(c.name, c.section).toLowerCase().includes(qLower))
              .slice(0, 6)
              .map((c) => ({ id: c._id, label: formatClassName(c.name, c.section), sub: `${c.studentCount ?? 0} students` })),
          );
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const saveRecent = (q: string) => {
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, RECENT_LIMIT);
    setRecent(next);
    localStorage.setItem(recentKey, JSON.stringify(next));
  };

  const goTo = (path: string) => {
    if (query.trim().length >= 2) saveRecent(query.trim());
    setQuery("");
    onOpenChange(false);
    router.push(path);
  };

  const hasResults = students.length + teachers.length + classes.length > 0;
  const showRecent = query.trim().length < 2 && recent.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" showCloseButton={false} className="flex h-full max-h-full flex-col gap-0 border-none p-0">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students, classes, teachers..."
              className="h-11 rounded-2xl bg-muted/60 pl-10 pr-9 shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-border/70 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {searching && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          )}

          {showRecent && (
            <div>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recent Searches</p>
              <div className="flex flex-col gap-1">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuery(r)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground/80 active:bg-muted/60"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!searching && query.trim().length >= 2 && !hasResults && (
            <p className="py-10 text-center text-sm text-muted-foreground">No results for &quot;{query}&quot;.</p>
          )}

          {!searching && students.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3 w-3" /> Students
              </p>
              <div className="flex flex-col gap-1">
                {students.map((r) => (
                  <button key={r.id} onClick={() => goTo("/dashboard/students")} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left active:bg-muted/60">
                    <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!searching && teachers.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <GraduationCap className="h-3 w-3" /> Teachers
              </p>
              <div className="flex flex-col gap-1">
                {teachers.map((r) => (
                  <button key={r.id} onClick={() => goTo("/dashboard/teachers")} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left active:bg-muted/60">
                    <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!searching && classes.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <SchoolIcon className="h-3 w-3" /> Classes
              </p>
              <div className="flex flex-col gap-1">
                {classes.map((r) => (
                  <button key={r.id} onClick={() => goTo("/dashboard/classes")} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left active:bg-muted/60">
                    <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
