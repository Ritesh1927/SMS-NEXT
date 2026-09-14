"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Loader2, Pencil, Trash2, Users, Home, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassRow {
  _id: string;
  name: string;
  section: string;
  room?: string;
  assignedSubjects?: { _id: string; name: string; code: string }[];
  studentCount: number;
  classTeacher?: { _id: string; name: string; teacherId: string } | null;
}

interface TeacherOption {
  _id: string;
  name: string;
  teacherId: string;
}

interface ClassesResponse {
  success: boolean;
  count: number;
  data: ClassRow[];
}

interface TeachersResponse {
  success: boolean;
  data: TeacherOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const NO_TEACHER = "__none__";

const EMPTY_FORM = { name: "", section: "", room: "", classTeacher: NO_TEACHER };

export default function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load classes."));
    apiGet<TeachersResponse>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (c: ClassRow) => {
    setEditingId(c._id);
    setForm({
      name: c.name,
      section: c.section,
      room: c.room || "",
      classTeacher: c.classTeacher?._id || NO_TEACHER,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    const body = {
      name: form.name,
      section: form.section,
      room: form.room,
      classTeacher: form.classTeacher === NO_TEACHER ? null : form.classTeacher,
    };
    try {
      const res = await fetch(editingId ? `/api/classes/${editingId}` : "/api/classes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save class.");
      toast.success(editingId ? "Class updated" : "Class created");
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

  const handleDelete = async (c: ClassRow) => {
    if (!confirm(`Delete Class ${c.name}-${c.section}? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(c._id);
    try {
      const res = await fetch(`/api/classes/${c._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete class.");
      toast.success("Class deleted");
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
          <h1 className="text-2xl font-bold text-[#172554]">Classes</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage class sections and assign class teachers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/subjects" className={buttonVariants({ variant: "outline", className: "gap-1.5" })}>
            <BookOpen className="h-4 w-4" /> Subject &amp; Class Assignment
          </Link>
          <Button onClick={openAdd} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
            <Plus className="h-4 w-4" /> Add Class
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!classes ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No classes yet. Add your first one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => (
            <div key={c._id} className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#172554]">Class {c.name}-{c.section}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {c.classTeacher ? `${c.classTeacher.name} (${c.classTeacher.teacherId})` : "No class teacher assigned"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(c)}
                    disabled={busyId === c._id}
                    aria-label="Delete"
                    className="hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#64748B] border-t border-[#F1F5F9] pt-3">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.studentCount} students</span>
                {c.room && <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {c.room}</span>}
              </div>
              {c.assignedSubjects && c.assignedSubjects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.assignedSubjects.map((s) => (
                    <span key={s._id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] font-medium">
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">{editingId ? "Edit Class" : "Add Class"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class Name" required>
                <Input placeholder="5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Section" required>
                <Input placeholder="A" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Room">
              <Input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
            </Field>
            <Field label="Class Teacher">
              <Select value={form.classTeacher} onValueChange={(v) => setForm((f) => ({ ...f, classTeacher: v || NO_TEACHER }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER}>None</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name} ({t.teacherId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save Changes" : "Add Class"}
            </Button>
          </form>
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
