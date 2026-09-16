"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Trash2, Power, ShieldCheck, Filter, Building2, GraduationCap, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface TeacherPermissions {
  canCreateStudent: boolean;
  canEditStudent: boolean;
  canDeleteStudent: boolean;
  canViewAllStudents: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canManageFees: boolean;
  canViewFees: boolean;
  canCreateExam: boolean;
  canEnterMarks: boolean;
  canViewExams: boolean;
  canPostNotice: boolean;
  canViewNotices: boolean;
  canAssignHomework: boolean;
  canViewHomework: boolean;
  canPostNoticeBoard: boolean;
  canManageLibrary: boolean;
  canDailyChallenge: boolean;
  canAwardBadges: boolean;
}

const PERMISSION_GROUPS: { label: string; keys: (keyof TeacherPermissions)[] }[] = [
  { label: "Students", keys: ["canCreateStudent", "canEditStudent", "canDeleteStudent", "canViewAllStudents"] },
  { label: "Attendance", keys: ["canMarkAttendance", "canViewAttendance"] },
  { label: "Fees", keys: ["canManageFees", "canViewFees"] },
  { label: "Exams", keys: ["canCreateExam", "canEnterMarks", "canViewExams"] },
  { label: "Notices", keys: ["canPostNotice", "canViewNotices", "canPostNoticeBoard"] },
  { label: "Homework", keys: ["canAssignHomework", "canViewHomework"] },
  { label: "Other", keys: ["canManageLibrary", "canDailyChallenge", "canAwardBadges"] },
];

const PERMISSION_LABELS: Record<keyof TeacherPermissions, string> = {
  canCreateStudent: "Create students",
  canEditStudent: "Edit students",
  canDeleteStudent: "Delete students",
  canViewAllStudents: "View all students",
  canMarkAttendance: "Mark attendance",
  canViewAttendance: "View attendance",
  canManageFees: "Manage fees",
  canViewFees: "View fees",
  canCreateExam: "Create exams",
  canEnterMarks: "Enter marks",
  canViewExams: "View exams",
  canPostNotice: "Post notices",
  canViewNotices: "View notices",
  canAssignHomework: "Assign homework",
  canViewHomework: "View homework",
  canPostNoticeBoard: "Post to notice board",
  canManageLibrary: "Manage library",
  canDailyChallenge: "Daily challenge",
  canAwardBadges: "Award badges",
};

interface TeacherRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  teacherId: string;
  designation?: string;
  subjects?: string[];
  classes?: string[];
  assignedClasses?: ClassOption[];
  qualification?: string;
  staffType: string;
  employmentType?: string;
  gender?: string;
  isActive: boolean;
  permissions?: TeacherPermissions;
}

interface TeachersResponse {
  success: boolean;
  count: number;
  data: TeacherRow[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  tempPassword?: string;
}

export default function TeachersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [permTeacher, setPermTeacher] = useState<TeacherRow | null>(null);
  const [permForm, setPermForm] = useState<TeacherPermissions | null>(null);
  const [permSubmitting, setPermSubmitting] = useState(false);

  const [staffFilter, setStaffFilter] = useState<"" | "teaching" | "non-teaching">("");
  const [search, setSearch] = useState("");

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<TeachersResponse>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load teachers."));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (t: TeacherRow) => {
    const token = getToken();
    if (!token) return;
    setBusyId(t._id);
    try {
      const res = await fetch(`/api/teachers/${t._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update teacher.");
      toast.success(t.isActive ? "Teacher deactivated" : "Teacher activated");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const openPermissions = (t: TeacherRow) => {
    setPermTeacher(t);
    setPermForm(t.permissions || null);
  };

  const handlePermSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!permTeacher || !permForm) return;
    const token = getToken();
    if (!token) return;
    setPermSubmitting(true);
    try {
      const res = await fetch(`/api/teachers/${permTeacher._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: permForm }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update permissions.");
      toast.success("Permissions updated");
      setPermTeacher(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setPermSubmitting(false);
    }
  };

  const handleDelete = async (t: TeacherRow) => {
    if (!confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(t._id);
    try {
      const res = await fetch(`/api/teachers/${t._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete teacher.");
      toast.success("Teacher deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const allTeachers = teachers || [];
  const counts = {
    total: allTeachers.length,
    teaching: allTeachers.filter((t) => t.staffType === "teaching").length,
    nonTeaching: allTeachers.filter((t) => t.staffType !== "teaching").length,
  };
  const filteredTeachers = allTeachers.filter((t) => {
    if (staffFilter && t.staffType !== staffFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q) && !(t.subjects || []).some((s) => s.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Staff</h1>
          <p className="text-sm text-[#64748B] mt-1">
            {counts.total} staff member{counts.total === 1 ? "" : "s"} ({counts.teaching} teaching, {counts.nonTeaching} non-teaching).
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/teachers/new")} className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]">
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {teachers && teachers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#172554]">{counts.total}</p>
                <p className="text-xs text-[#64748B]">Total Staff</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#4F46E5]">{counts.teaching}</p>
                <p className="text-xs text-[#64748B]">Teaching</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{counts.nonTeaching}</p>
                <p className="text-xs text-[#64748B]">Non-Teaching</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2">
              {([
                { key: "", label: "All Staff" },
                { key: "teaching", label: "Teaching" },
                { key: "non-teaching", label: "Non-Teaching" },
              ] as const).map((tab) => (
                <Button
                  key={tab.key}
                  variant={staffFilter === tab.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStaffFilter(tab.key)}
                  className={`gap-1.5 ${staffFilter === tab.key ? "bg-[#4F46E5] hover:bg-[#4338CA]" : ""}`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {tab.label}
                </Button>
              ))}
            </div>
            <Input placeholder="Search by name, email, subject, department..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          </div>
        </>
      )}

      {error ? null : !teachers ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : teachers.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No teachers yet. Add your first one to get started.</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No staff match your filters.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-[#F1F5F9]">
            <p className="flex-1 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Name</p>
            <p className="w-28 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Type</p>
            <p className="w-48 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Email</p>
            <p className="w-32 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Phone</p>
            <p className="hidden lg:block w-40 shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Subjects</p>
            <p className="w-[136px] shrink-0 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Actions</p>
          </div>
          {filteredTeachers.map((t) => (
            <div key={t._id} className="flex items-center gap-4 px-5 py-4 border-b border-[#F1F5F9] last:border-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-11 w-11 shrink-0 border border-[#E2E8F0]">
                  <AvatarImage src={t.photo} alt={t.name} />
                  <AvatarFallback className="bg-[#EEF2FF] text-[#4F46E5] text-sm font-semibold">
                    {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#172554] truncate">{t.name}</p>
                    {!t.isActive && (
                      <span className="shrink-0 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5 truncate">{t.qualification || t.teacherId}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 sm:hidden truncate">
                    {t.email}
                    {t.phone ? ` · ${t.phone}` : ""}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-28 shrink-0">
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    t.staffType === "teaching" ? "bg-[#EFF6FF] text-blue-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {t.staffType === "teaching" ? "Teaching" : "Non-Teaching"}
                </span>
              </div>
              <div className="hidden sm:block w-48 shrink-0">
                <p className="text-sm text-[#334155] truncate">{t.email}</p>
              </div>
              <div className="hidden sm:block w-32 shrink-0">
                <p className="text-sm text-[#334155]">{t.phone || "—"}</p>
              </div>
              <div className="hidden lg:block w-40 shrink-0">
                <p className="text-sm text-[#334155] truncate">{t.subjects && t.subjects.length > 0 ? t.subjects.join(", ") : "—"}</p>
              </div>

              <div className="flex items-center justify-end gap-1 w-[136px] shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/teachers/${t._id}/edit`)} aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openPermissions(t)} aria-label="Permissions">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleActive(t)}
                  disabled={busyId === t._id}
                  aria-label={t.isActive ? "Deactivate" : "Activate"}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(t)}
                  disabled={busyId === t._id}
                  aria-label="Delete"
                  className="hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!permTeacher} onOpenChange={(o) => { if (!o) setPermTeacher(null); }}>
        <DialogContent className="sm:max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">
              Permissions {permTeacher ? `— ${permTeacher.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {permForm && (
            <form onSubmit={handlePermSubmit} className="space-y-4 mt-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs font-medium text-[#172554]">
                        <input
                          type="checkbox"
                          checked={permForm[key]}
                          onChange={(e) => setPermForm((f) => (f ? { ...f, [key]: e.target.checked } : f))}
                        />
                        {PERMISSION_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA]" disabled={permSubmitting}>
                {permSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Permissions"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
