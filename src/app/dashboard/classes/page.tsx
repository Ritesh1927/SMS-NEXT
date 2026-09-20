"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Loader2, Pencil, Trash2, Users, Home, BookOpen, Search, School, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatFilterCard } from "@/components/StatFilterCard";
import { statusPillClass } from "@/lib/statusStyles";
import { PageLoader } from "@/components/PageLoader";

const CARD_PALETTE = [
  { color: "#4F46E5", colorDark: "#4338CA" },
  { color: "#0EA5E9", colorDark: "#0284C7" },
  { color: "#8B5CF6", colorDark: "#7C3AED" },
  { color: "#16A34A", colorDark: "#15803D" },
  { color: "#F59E0B", colorDark: "#D97706" },
  { color: "#EC4899", colorDark: "#DB2777" },
];

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
  const [search, setSearch] = useState("");
  const [noTeacherFilter, setNoTeacherFilter] = useState(false);

  const isTeacher = user?.role === "teacher";

  const assignedTeacherIds = new Set(
    (classes || [])
      .filter((c) => c.classTeacher && c._id !== editingId)
      .map((c) => c.classTeacher!._id),
  );
  const availableTeachers = teachers.filter((t) => !assignedTeacherIds.has(t._id));

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load classes."));
    // Only schooladmin can assign a class teacher, so only schooladmin
    // needs the teacher-picker list this powers.
    if (!isTeacher) {
      apiGet<TeachersResponse>("/teachers", token)
        .then((res) => setTeachers(res.data))
        .catch(() => {});
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

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

  const allClasses = classes || [];
  const totalStudents = allClasses.reduce((sum, c) => sum + c.studentCount, 0);
  const withoutTeacher = allClasses.filter((c) => !c.classTeacher).length;

  const filteredClasses = allClasses.filter((c) => {
    if (noTeacherFilter && c.classTeacher) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.section.toLowerCase().includes(q) ||
      (c.classTeacher?.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        icon={School}
        title="Classes"
        subtitle={isTeacher ? "Your assigned classes." : "Manage class sections and assign class teachers."}
        accent="blue"
        actions={
          !isTeacher && (
            <>
              <Link href="/dashboard/subjects" className={buttonVariants({ variant: "outline", className: "gap-1.5" })}>
                <BookOpen className="h-4 w-4" /> Subject &amp; Class Assignment
              </Link>
              <Button onClick={openAdd} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Class
              </Button>
            </>
          )
        }
        className="mb-6"
      />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {classes && classes.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatFilterCard icon={School} color="#4F46E5" colorDark="#4338CA" value={allClasses.length} label="Total Classes" />
            <StatFilterCard icon={Users} color="#0EA5E9" colorDark="#0284C7" value={totalStudents} label="Total Students" sublabel="Across all classes" />
            <StatFilterCard
              icon={UserX}
              color="#DC2626"
              colorDark="#B91C1C"
              value={withoutTeacher}
              label="Without Class Teacher"
              sublabel={withoutTeacher === 0 ? "All classes covered" : "Needs assignment"}
              active={noTeacherFilter}
              onClick={!isTeacher ? () => setNoTeacherFilter((v) => !v) : undefined}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search classes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {noTeacherFilter && (
              <button
                type="button"
                onClick={() => setNoTeacherFilter(false)}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15 transition-colors"
              >
                Without teacher only
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {error ? null : !classes ? (
        <PageLoader label="Loading classes..." />
      ) : classes.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-sm border border-border">
          <EmptyState icon={School} message="No classes yet. Add your first one to get started." />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-sm border border-border">
          <EmptyState icon={Search} message="No classes match your search." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((c, i) => {
            const palette = CARD_PALETTE[i % CARD_PALETTE.length];
            return (
              <div
                key={c._id}
                className="group relative overflow-hidden rounded-2xl bg-card p-5 border border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_-16px_rgba(15,23,42,0.2)]"
              >
                <School
                  className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rotate-[-12deg] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
                  style={{ color: palette.color, opacity: 0.06 }}
                />
                <div className="relative flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-heading font-bold text-sm text-white transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `linear-gradient(135deg, ${palette.color}, ${palette.colorDark})`, boxShadow: `0 8px 18px -6px ${palette.color}80` }}
                    >
                      {c.name}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Class {c.name}-{c.section}</p>
                      {c.classTeacher ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{c.classTeacher.name} ({c.classTeacher.teacherId})</p>
                      ) : (
                        <span className={`inline-flex mt-1 ${statusPillClass("warning")}`}>No class teacher</span>
                      )}
                    </div>
                  </div>
                  {!isTeacher && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(c)}
                        disabled={busyId === c._id}
                        aria-label="Delete"
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="relative mt-3 flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.studentCount} students</span>
                  {c.room && <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {c.room}</span>}
                </div>
                {c.assignedSubjects && c.assignedSubjects.length > 0 && (
                  <div className="relative mt-2 flex flex-wrap gap-1.5">
                    {c.assignedSubjects.map((s) => (
                      <span key={s._id} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ background: `linear-gradient(90deg, ${palette.color}, ${palette.colorDark})`, transformOrigin: "left" }}
                />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">{editingId ? "Edit Class" : "Add Class"}</DialogTitle>
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
              <Select
                value={form.classTeacher}
                onValueChange={(v) => setForm((f) => ({ ...f, classTeacher: v || NO_TEACHER }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER}>None</SelectItem>
                  {availableTeachers.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name} ({t.teacherId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" className="w-full" disabled={submitting}>
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
      <label className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
