"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Trash2, ClipboardCheck, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface Submission {
  student: { _id: string; name: string; studentId: string } | string;
  submittedAt: string;
  note: string;
  status: "submitted" | "late" | "graded";
  marks: number | null;
  feedback: string;
}

interface HomeworkRow {
  _id: string;
  title: string;
  description: string;
  subject: string;
  class: string;
  section?: string;
  dueDate: string;
  maxMarks: number | null;
  submissions: Submission[];
  totalStudents: number;
}

interface HomeworkResponse {
  success: boolean;
  data: HomeworkRow[];
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const EMPTY_FORM = { title: "", description: "", subject: "", class: "", section: "", dueDate: "", maxMarks: "" };

export default function HomeworkPage() {
  const { user } = useAuth();
  const [homework, setHomework] = useState<HomeworkRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gradingHw, setGradingHw] = useState<HomeworkRow | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [savingGradeFor, setSavingGradeFor] = useState<string | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<HomeworkResponse>("/homework", token)
      .then((res) => setHomework(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load homework."));
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, maxMarks: form.maxMarks ? Number(form.maxMarks) : null }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to assign homework.");
      toast.success("Homework assigned");
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (hw: HomeworkRow) => {
    if (!confirm(`Delete "${hw.title}"? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(hw._id);
    try {
      const res = await fetch(`/api/homework/${hw._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete homework.");
      toast.success("Homework deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const openGrading = (hw: HomeworkRow) => {
    setGradingHw(hw);
    const drafts: Record<string, { marks: string; feedback: string }> = {};
    for (const s of hw.submissions) {
      const sid = typeof s.student === "string" ? s.student : s.student._id;
      drafts[sid] = { marks: s.marks !== null ? String(s.marks) : "", feedback: s.feedback || "" };
    }
    setGradeDrafts(drafts);
  };

  const saveGrade = async (studentId: string) => {
    if (!gradingHw) return;
    const token = getToken();
    if (!token) return;
    const draft = gradeDrafts[studentId];
    setSavingGradeFor(studentId);
    try {
      const res = await fetch(`/api/homework/${gradingHw._id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId, marks: draft.marks ? Number(draft.marks) : null, feedback: draft.feedback }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save grade.");
      toast.success("Grade saved");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSavingGradeFor(null);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Homework</h1>
          <p className="text-sm text-[#64748B] mt-1">Assign homework and grade submissions.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
          <Plus className="h-4 w-4" /> Assign Homework
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!homework ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : homework.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <BookOpen className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
          <p className="text-sm text-[#64748B]">No homework assigned yet.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {homework.map((hw) => (
            <div key={hw._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#172554]">{hw.title}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Class {hw.class}
                  {hw.section ? `-${hw.section}` : ""} · {hw.subject} · Due{" "}
                  {new Date(hw.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                  {hw.submissions.length}/{hw.totalStudents} submitted
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => openGrading(hw)} aria-label="Submissions">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(hw)}
                  disabled={busyId === hw._id}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">Assign Homework</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Description" required>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required rows={3} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Subject" required>
                <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required />
              </Field>
              <Field label="Class" required>
                {classes.length > 0 ? (
                  <Select
                    value={form.class && form.section ? `${form.class}::${form.section}` : ""}
                    onValueChange={(v) => {
                      const cls = classes.find((c) => `${c.name}::${c.section}` === v);
                      if (cls) setForm((f) => ({ ...f, class: cls.name, section: cls.section }));
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c._id} value={`${c.name}::${c.section}`}>Class {c.name}-{c.section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: e.target.value }))} required />
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date" required>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required />
              </Field>
              <Field label="Max Marks">
                <Input type="number" min={0} value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))} />
              </Field>
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign Homework"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gradingHw} onOpenChange={(o) => { if (!o) setGradingHw(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">
              Submissions {gradingHw ? `— ${gradingHw.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          {gradingHw && (
            <div className="space-y-3 mt-2">
              {gradingHw.submissions.length === 0 ? (
                <p className="text-sm text-[#64748B]">No submissions yet.</p>
              ) : (
                gradingHw.submissions.map((s) => {
                  const student = typeof s.student === "string" ? { _id: s.student, name: "Unknown" } : s.student;
                  const draft = gradeDrafts[student._id] || { marks: "", feedback: "" };
                  return (
                    <div key={student._id} className="rounded-xl border border-[#F1F5F9] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#172554]">{student.name}</p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            s.status === "graded" ? "bg-green-100 text-green-700" : s.status === "late" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      {s.note && <p className="text-xs text-[#64748B]">{s.note}</p>}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder={`Marks${gradingHw.maxMarks ? ` / ${gradingHw.maxMarks}` : ""}`}
                          value={draft.marks}
                          onChange={(e) => setGradeDrafts((d) => ({ ...d, [student._id]: { ...draft, marks: e.target.value } }))}
                          className="w-28"
                        />
                        <Input
                          placeholder="Feedback"
                          value={draft.feedback}
                          onChange={(e) => setGradeDrafts((d) => ({ ...d, [student._id]: { ...draft, feedback: e.target.value } }))}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveGrade(student._id)}
                          disabled={savingGradeFor === student._id}
                          className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                        >
                          {savingGradeFor === student._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
