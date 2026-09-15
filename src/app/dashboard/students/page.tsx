"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface StudentRow {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  phone?: string;
  photo?: string;
  isActive: boolean;
  attendance: number;
  parent?: { name: string; email: string; phone?: string } | null;
}

interface StudentsResponse {
  success: boolean;
  count: number;
  data: StudentRow[];
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  // Teachers get a read-only view scoped to their own classes — matches
  // SMS-BACKEND, where the student create/update/delete routes are
  // schooladmin-only at the router level (no teacher-facing path exists at
  // all, regardless of their canEditStudent/canDeleteStudent flags).
  const isTeacher = user?.role === "teacher";

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<StudentsResponse>(isTeacher ? "/teachers/my-students" : "/students", token)
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load students."));
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const toggleActive = async (s: StudentRow) => {
    const token = getToken();
    if (!token) return;
    setBusyId(s._id);
    try {
      const res = await fetch(`/api/students/${s._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update student.");
      toast.success(s.isActive ? "Student deactivated" : "Student activated");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (s: StudentRow) => {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(s._id);
    try {
      const res = await fetch(`/api/students/${s._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete student.");
      toast.success("Student deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const filteredStudents = (students || []).filter((s) => {
    if (classFilter && s.class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.studentId.toLowerCase().includes(q) &&
        !(s.rollNumber || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Students</h1>
          <p className="text-sm text-[#64748B] mt-1">
            {isTeacher ? "Students in your classes." : "Manage student admissions and records."}
          </p>
        </div>
        {!isTeacher && (
          <Button onClick={() => router.push("/dashboard/students/new")} className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]">
            <Plus className="h-4 w-4" /> Add Student
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {students && students.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Search by name or roll number..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "")}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c.name}>Class {c.name}-{c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error ? null : !students ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">
            {isTeacher ? "No students in your classes yet." : "No students yet. Add your first admission to get started."}
          </p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No students match your filters.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-[#F1F5F9]">
            <p className="flex-1 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Student</p>
            <p className="w-28 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Class</p>
            <p className="w-16 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Roll No.</p>
            <p className="w-32 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Attendance</p>
            <p className="w-[104px] shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Actions</p>
          </div>
          {filteredStudents.map((s) => (
            <div key={s._id} className="flex items-center gap-4 px-5 py-4 border-b border-[#F1F5F9] last:border-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-11 w-11 shrink-0 border border-[#E2E8F0]">
                  <AvatarImage src={s.photo} alt={s.name} />
                  <AvatarFallback className="bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold">
                    {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#172554] truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className="shrink-0 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5 truncate">{s.studentId}</p>
                  {s.parent?.email && <p className="text-xs text-[#94A3B8] truncate">{s.parent.email}</p>}
                  <p className="text-xs text-[#64748B] mt-0.5 sm:hidden">
                    Class {s.class}
                    {s.section ? `-${s.section}` : ""} · Roll {s.rollNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-28 shrink-0">
                <p className="text-sm text-[#334155] truncate">
                  Class {s.class}
                  {s.section ? `-${s.section}` : ""}
                </p>
              </div>
              <div className="hidden sm:block w-16 shrink-0">
                <p className="text-sm text-[#334155]">{s.rollNumber || "—"}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                {s.attendance > 0 ? (
                  <>
                    <div className="w-16 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${s.attendance}%` }} />
                    </div>
                    <span className="text-xs font-medium text-[#475569]">{s.attendance}%</span>
                  </>
                ) : (
                  <span className="text-xs text-[#94A3B8]">—</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 w-[104px] shrink-0">
                {!isTeacher && (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/students/${s._id}/edit`)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleActive(s)}
                      disabled={busyId === s._id}
                      aria-label={s.isActive ? "Deactivate" : "Activate"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(s)}
                      disabled={busyId === s._id}
                      aria-label="Delete"
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
