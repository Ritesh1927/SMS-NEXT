"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Trash2, ClipboardList, BarChart3, CheckCircle2, FileText, CalendarClock, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExamType = "unit-test" | "mid-term" | "final" | "practical" | "assignment";
type ExamStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ExamRow {
  _id: string;
  title: string;
  class: string;
  section?: string;
  subject: string;
  date: string;
  totalMarks: number;
  passingMarks: number;
  examType: ExamType;
  status: ExamStatus;
}

interface ExamsResponse {
  success: boolean;
  data: ExamRow[];
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

interface RosterEntry {
  student: { _id: string; name: string; studentId: string; rollNumber?: string };
  marksObtained: number | null;
  remarks: string;
}

interface RosterResponse {
  success: boolean;
  data: RosterEntry[];
  exam: { title: string; totalMarks: number; subject: string };
}

interface ResultRow {
  _id: string;
  student: { _id: string; name: string; studentId: string; rollNumber?: string };
  marksObtained: number;
  totalMarks: number;
  grade: string;
  percentage: number;
  isPassed: boolean;
  isPublished: boolean;
}

interface ResultsResponse {
  success: boolean;
  data: { results: ResultRow[]; summary: { total: number; passed: number; failed: number; avgPercentage: number } };
}

const EMPTY_FORM = {
  title: "",
  class: "",
  section: "",
  subject: "",
  date: "",
  totalMarks: "100",
  passingMarks: "33",
  examType: "unit-test" as ExamType,
};

export default function ExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [marksExam, setMarksExam] = useState<ExamRow | null>(null);
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);

  const [resultsExam, setResultsExam] = useState<ExamRow | null>(null);
  const [results, setResults] = useState<ResultsResponse["data"] | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<ExamsResponse>("/exams", token)
      .then((res) => setExams(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load exams."));
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
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          totalMarks: Number(form.totalMarks),
          passingMarks: Number(form.passingMarks),
        }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to create exam.");
      toast.success("Exam created");
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (exam: ExamRow) => {
    if (!confirm(`Delete "${exam.title}"? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(exam._id);
    try {
      const res = await fetch(`/api/exams/${exam._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete exam.");
      toast.success("Exam deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const openMarks = (exam: ExamRow) => {
    setMarksExam(exam);
    setRoster(null);
    const token = getToken();
    if (!token) return;
    apiGet<RosterResponse>(`/exams/${exam._id}/roster`, token)
      .then((res) => setRoster(res.data))
      .catch((err) => toast.error("Error", { description: err instanceof Error ? err.message : "Failed to load roster." }));
  };

  const setMark = (studentId: string, marksObtained: string) => {
    setRoster((r) =>
      r &&
      r.map((entry) =>
        entry.student._id === studentId
          ? { ...entry, marksObtained: marksObtained === "" ? null : Number(marksObtained) }
          : entry,
      ),
    );
  };

  const saveMarks = async () => {
    const token = getToken();
    if (!token || !roster || !marksExam) return;
    setSavingMarks(true);
    try {
      const res = await fetch(`/api/exams/${marksExam._id}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          results: roster.map((r) => ({ studentId: r.student._id, marksObtained: r.marksObtained, remarks: r.remarks })),
        }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save marks.");
      toast.success("Marks saved");
      setMarksExam(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSavingMarks(false);
    }
  };

  const openResults = (exam: ExamRow) => {
    setResultsExam(exam);
    setResults(null);
    const token = getToken();
    if (!token) return;
    apiGet<ResultsResponse>(`/exams/${exam._id}/results`, token)
      .then((res) => setResults(res.data))
      .catch((err) => toast.error("Error", { description: err instanceof Error ? err.message : "Failed to load results." }));
  };

  const togglePublish = async (publish: boolean) => {
    const token = getToken();
    if (!token || !results) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/results/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resultIds: results.results.map((r) => r._id), publish }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update results.");
      toast.success(publish ? "Results published" : "Results unpublished");
      if (resultsExam) openResults(resultsExam);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setPublishing(false);
    }
  };

  if (!user) return null;

  const subjects = Array.from(new Set((exams ?? []).map((e) => e.subject))).sort();
  const filteredExams = (exams ?? []).filter((exam) => {
    if (search && !exam.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classFilter !== "all" && exam.class !== classFilter) return false;
    if (subjectFilter !== "all" && exam.subject !== subjectFilter) return false;
    return true;
  });
  const upcomingCount = (exams ?? []).filter((e) => e.status === "upcoming").length;
  const completedCount = (exams ?? []).filter((e) => e.status === "completed").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Exams</h1>
          <p className="text-sm text-[#64748B] mt-1">Create exams, enter marks, and publish results.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
          <Plus className="h-4 w-4" /> New Exam
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {exams && exams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <StatCard icon={<FileText className="h-4 w-4" />} label="Total Exams" value={exams.length} />
          <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Upcoming" value={upcomingCount} />
          <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Completed" value={completedCount} />
        </div>
      )}

      {exams && exams.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "all")}>
            <SelectTrigger className="sm:w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c.name}>Class {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v || "all")}>
            <SelectTrigger className="sm:w-40"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!exams ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No exams yet. Create your first one to get started.</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No exams match your filters.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {filteredExams.map((exam) => (
            <div key={exam._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#172554]">{exam.title}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Class {exam.class}
                  {exam.section ? `-${exam.section}` : ""} · {exam.subject} ·{" "}
                  {new Date(exam.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                  {exam.totalMarks} marks
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2 ${
                    exam.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {exam.status}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => openMarks(exam)} aria-label="Enter marks">
                  <ClipboardList className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openResults(exam)} aria-label="View results">
                  <BarChart3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(exam)}
                  disabled={busyId === exam._id}
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
            <DialogTitle className="text-lg text-[#172554]">New Exam</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="Subject" required>
                <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
              </Field>
              <Field label="Type">
                <Select value={form.examType} onValueChange={(v) => setForm((f) => ({ ...f, examType: (v || f.examType) as ExamType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["unit-test", "mid-term", "final", "practical", "assignment"] as ExamType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Marks" required>
                <Input type="number" min={1} value={form.totalMarks} onChange={(e) => setForm((f) => ({ ...f, totalMarks: e.target.value }))} required />
              </Field>
              <Field label="Passing Marks" required>
                <Input type="number" min={0} value={form.passingMarks} onChange={(e) => setForm((f) => ({ ...f, passingMarks: e.target.value }))} required />
              </Field>
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Exam"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!marksExam} onOpenChange={(o) => { if (!o) setMarksExam(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">
              Enter Marks {marksExam ? `— ${marksExam.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          {!roster ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B] py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading roster...
            </div>
          ) : roster.length === 0 ? (
            <p className="text-sm text-[#64748B] py-4">No active students in this class.</p>
          ) : (
            <div className="space-y-3 mt-2">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {roster.map((entry) => (
                  <div key={entry.student._id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#172554] truncate">{entry.student.name}</p>
                      <p className="text-xs text-[#94A3B8]">Roll {entry.student.rollNumber || "—"}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={marksExam?.totalMarks}
                      placeholder={`/ ${marksExam?.totalMarks ?? ""}`}
                      value={entry.marksObtained ?? ""}
                      onChange={(e) => setMark(entry.student._id, e.target.value)}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={saveMarks} className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={savingMarks}>
                {savingMarks ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Marks"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resultsExam} onOpenChange={(o) => { if (!o) setResultsExam(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">
              Results {resultsExam ? `— ${resultsExam.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          {!results ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B] py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading results...
            </div>
          ) : results.results.length === 0 ? (
            <p className="text-sm text-[#64748B] py-4">No marks entered yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span>{results.summary.total} entered</span>
                <span className="text-green-600">{results.summary.passed} passed</span>
                <span className="text-red-600">{results.summary.failed} failed</span>
                <span>Avg {results.summary.avgPercentage}%</span>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {results.results.map((r) => (
                  <div key={r._id} className="flex items-center justify-between text-sm">
                    <span className="text-[#172554]">{r.student.name}</span>
                    <span className={r.isPassed ? "text-green-600" : "text-red-600"}>
                      {r.marksObtained}/{r.totalMarks} · {r.grade}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => togglePublish(!results.results[0]?.isPublished)}
                className="w-full gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]"
                disabled={publishing}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {results.results[0]?.isPublished ? "Unpublish Results" : "Publish Results"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-[#172554] leading-none">{value}</p>
        <p className="text-xs text-[#64748B] mt-1">{label}</p>
      </div>
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
