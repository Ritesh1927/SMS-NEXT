"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Mail, Phone, Pencil, Trash2, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  tempPassword?: string;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  designation: "",
  subjects: "",
  classes: "",
  classIds: [] as string[],
  qualification: "",
  employmentType: "full-time",
  gender: "male",
};

export default function TeachersPage() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [permTeacher, setPermTeacher] = useState<TeacherRow | null>(null);
  const [permForm, setPermForm] = useState<TeacherPermissions | null>(null);
  const [permSubmitting, setPermSubmitting] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<TeachersResponse>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load teachers."));
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (t: TeacherRow) => {
    setEditingId(t._id);
    setForm({
      name: t.name,
      email: t.email,
      phone: t.phone || "",
      designation: t.designation || "",
      subjects: (t.subjects || []).join(", "),
      classes: (t.classes || []).join(", "),
      classIds: (t.assignedClasses || []).map((c) => c._id),
      qualification: t.qualification || "",
      employmentType: t.employmentType || "full-time",
      gender: t.gender || "male",
    });
    setOpen(true);
  };

  const toggleClassId = (id: string) => {
    setForm((f) => ({
      ...f,
      classIds: f.classIds.includes(id) ? f.classIds.filter((c) => c !== id) : [...f.classIds, id],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    const subjects = form.subjects.split(",").map((s) => s.trim()).filter(Boolean);
    // classIds (real Class records) take priority; the free-text classes
    // field is only sent when no classes exist yet to pick from.
    const classLabels =
      classes.length === 0 ? form.classes.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const classPayload = classLabels ? { classes: classLabels } : { classIds: form.classIds };
    try {
      if (editingId) {
        const res = await fetch(`/api/teachers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name, phone: form.phone, designation: form.designation, subjects,
            ...classPayload,
            qualification: form.qualification, employmentType: form.employmentType, gender: form.gender,
          }),
        });
        const json: ApiMessageResponse = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to update teacher.");
        toast.success("Teacher updated");
      } else {
        const res = await fetch("/api/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, subjects, ...classPayload }),
        });
        const json: ApiMessageResponse = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to create teacher.");
        toast.success("Teacher added", { description: `Temporary password: ${json.tempPassword} (also emailed).` });
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Teachers</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage teaching and non-teaching staff.</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
          <Plus className="h-4 w-4" /> Add Teacher
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!teachers ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : teachers.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No teachers yet. Add your first one to get started.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {teachers.map((t) => (
            <div key={t._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#172554]">{t.name}</p>
                  {!t.isActive && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {t.teacherId} · {t.designation || (t.staffType === "teaching" ? "Teacher" : "Staff")}
                  {t.subjects && t.subjects.length > 0 ? ` · ${t.subjects.join(", ")}` : ""}
                  {t.classes && t.classes.length > 0 ? ` · Classes: ${t.classes.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B] shrink-0">
                <span className="hidden sm:flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {t.email}
                </span>
                {t.phone && (
                  <span className="hidden md:flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {t.phone}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} aria-label="Edit">
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
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">{editingId ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  disabled={!!editingId}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Designation">
                <Input
                  placeholder="Teacher"
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Subjects (comma-separated)">
              <Input
                placeholder="Math, Science"
                value={form.subjects}
                onChange={(e) => setForm((f) => ({ ...f, subjects: e.target.value }))}
              />
            </Field>
            {classes.length > 0 ? (
              <Field label="Assigned Classes">
                <div className="flex flex-wrap gap-2 rounded-lg border border-input p-2">
                  {classes.map((c) => {
                    const active = form.classIds.includes(c._id);
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => toggleClassId(c._id)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-[#2563EB] text-white border-[#2563EB]"
                            : "bg-transparent text-[#64748B] border-[#E2E8F0] hover:border-[#2563EB]"
                        }`}
                      >
                        {c.name}-{c.section}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : (
              <Field label="Assigned Classes (comma-separated, e.g. 5-A, 6-B)">
                <Input
                  placeholder="5-A, 6-B"
                  value={form.classes}
                  onChange={(e) => setForm((f) => ({ ...f, classes: e.target.value }))}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender">
                <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v || f.gender }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Employment Type">
                <Select value={form.employmentType} onValueChange={(v) => setForm((f) => ({ ...f, employmentType: v || f.employmentType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save Changes" : "Add Teacher"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={permSubmitting}>
                {permSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Permissions"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[#172554]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
