"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, Users, GraduationCap, School as SchoolIcon, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { formatClassName } from "@/lib/helpers";

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

export function DashboardTopBar({ user, licenseWarning }: { user: AuthUser; licenseWarning: LicenseWarning | null }) {
  const router = useRouter();
  const canSearch = user.role === "schooladmin";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<SearchResult[]>([]);
  const [teachers, setTeachers] = useState<SearchResult[]>([]);
  const [classes, setClasses] = useState<SearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#E2E8F0] bg-white/80 backdrop-blur px-4 sm:px-6">
      <SidebarTrigger className="text-[#475569] hover:text-[#4F46E5] hover:bg-[#F1F5F9] rounded-lg" />

      {canSearch && (
        <div className="relative hidden md:block" ref={boxRef}>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            placeholder="Search students, classes, teachers..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-80 h-10 pl-10 rounded-full bg-[#F8FAFC] border-[#E2E8F0]"
          />

          {open && query.trim().length >= 2 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-40 max-h-96 overflow-y-auto py-2">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              ) : !hasResults ? (
                <p className="text-sm text-[#64748B] text-center py-6">No results for &quot;{query}&quot;.</p>
              ) : (
                <>
                  {students.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="h-3 w-3" /> Students
                      </p>
                      {students.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/students")} className="w-full text-left px-3 py-2 hover:bg-[#F1F5F9] flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#172554] truncate">{r.label}</span>
                          <span className="text-xs text-[#64748B] shrink-0">{r.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {teachers.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" /> Teachers
                      </p>
                      {teachers.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/teachers")} className="w-full text-left px-3 py-2 hover:bg-[#F1F5F9] flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#172554] truncate">{r.label}</span>
                          <span className="text-xs text-[#64748B] shrink-0">{r.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {classes.length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
                        <SchoolIcon className="h-3 w-3" /> Classes
                      </p>
                      {classes.map((r) => (
                        <button key={r.id} onClick={() => goTo("/dashboard/classes")} className="w-full text-left px-3 py-2 hover:bg-[#F1F5F9] flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#172554] truncate">{r.label}</span>
                          <span className="text-xs text-[#64748B] shrink-0">{r.sub}</span>
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
    </header>
  );
}
