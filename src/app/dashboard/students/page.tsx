"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, User, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface StudentRow {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  phone?: string;
  isActive: boolean;
  parent?: { name: string; email: string; phone?: string } | null;
}

interface StudentsResponse {
  success: boolean;
  count: number;
  data: StudentRow[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {students.map((s) => (
            <div key={s._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#172554]">{s.name}</p>
                  {!s.isActive && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {s.studentId} · Class {s.class}
                  {s.section ? `-${s.section}` : ""} · Roll {s.rollNumber || "—"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B] shrink-0">
                <span className="hidden sm:flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> {s.parent?.name || "No parent linked"}
                </span>
                {!isTeacher && (
                  <div className="flex items-center gap-1">
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
