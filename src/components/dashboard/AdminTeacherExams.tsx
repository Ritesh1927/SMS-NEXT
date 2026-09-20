"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Plus, Loader2, Trash2, ClipboardList, GraduationCap, BarChart3, CheckCircle2, FileText, CalendarClock, CheckSquare,
  ChevronDown, ChevronRight, Pencil, Ban, FileEdit, Layers, ShieldCheck, X, Save, Send, SendHorizonal, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

type ExamType = "unit-test" | "mid-term" | "final" | "practical" | "assignment";
type ExamStatus = "upcoming" | "ongoing" | "completed" | "cancelled";
type TermType = "midterm" | "final" | "unit" | "annual";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface SubjectsResponse {
  success: boolean;
  data: SubjectOption[];
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
  duration: number | null;
  startTime?: string;
  endTime?: string;
  examType: ExamType;
  status: ExamStatus;
  scheduledExamId: string | null;
}

interface TermRow {
  _id: string;
  title: string;
  class: string;
  section?: string;
  examType: TermType;
  startDate: string;
  endDate: string;
  description: string;
  status: ExamStatus;
  createdBy?: { name: string } | null;
  subjects?: ExamRow[];
}

interface ChangeRequestRow {
  _id: string;
  sourceType: "exam" | "scheduledExam";
  examId: string | null;
  scheduledExamId: string | null;
  requestedBy: { name: string; teacherId?: string } | null;
  reason: string;
  currentData: Record<string, unknown>;
  requestedChanges: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  adminReply: string;
  createdAt: string;
}

interface RosterEntry {
  student: { _id: string; name: string; studentId: string; rollNumber?: string };
  marksObtained: number | null;
  remarks: string;
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

interface MergedResultRow {
  student: { _id: string; name: string; studentId: string; rollNumber?: string };
  marksObtained: number | null;
  remarks: string;
  resultId: string | null;
  grade: string | null;
  isPassed: boolean | null;
  isPublished: boolean;
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

interface SubjectSlot {
  date: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM = {
  title: "",
  class: "",
  section: "",
  subject: "",
  subjects: [] as string[],
  // One date + time window per selected subject when creating (they may not
  // all fall on the same day, or the same hours) -- keyed by subject name.
  // `date` alone still drives the single shared field when editing an
  // existing (single-subject) test.
  subjectSlots: {} as Record<string, SubjectSlot>,
  date: "",
  startTime: "",
  endTime: "",
  totalMarks: "100",
  passingMarks: "33",
  examType: "unit-test" as ExamType,
};

interface TermSubjectDraft {
  subject: string;
  date: string;
  totalMarks: string;
  startTime: string;
  endTime: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcDurationMinutes(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

// Validates a set of {date, startTime, endTime} slots that may share a
// class/exam batch: every slot needs both times, end must be after start,
// and two slots landing on the same date can't overlap in time-of-day.
// Returns an error message for the given label, or null if all clear.
function findScheduleConflict(slots: { label: string; date: string; startTime: string; endTime: string }[]): string | null {
  for (const s of slots) {
    if (!s.date || !s.startTime || !s.endTime) return `Pick a date and time for ${s.label}.`;
    if (calcDurationMinutes(s.startTime, s.endTime) <= 0) return `${s.label}'s end time must be after its start time.`;
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.date === b.date && timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        return `${a.label} and ${b.label} are both on ${a.date} and their times overlap.`;
      }
    }
  }
  return null;
}

const EMPTY_TERM_FORM = {
  title: "",
  class: "",
  section: "",
  examType: "midterm" as TermType,
  startDate: "",
  endDate: "",
  description: "",
};

function isEditWindowOpen(dateIso: string) {
  const twoHoursBefore = new Date(new Date(dateIso).getTime() - 2 * 60 * 60 * 1000);
  return new Date() <= twoHoursBefore;
}

const todayISO = () => new Date().toISOString().split("T")[0];

function mergeRosterAndResults(roster: RosterEntry[], results: ResultRow[]): MergedResultRow[] {
  const byStudent = new Map(results.map((r) => [r.student._id, r]));
  return roster.map((entry) => {
    const res = byStudent.get(entry.student._id);
    return {
      student: entry.student,
      marksObtained: entry.marksObtained,
      remarks: entry.remarks,
      resultId: res?._id ?? null,
      grade: res?.grade ?? null,
      isPassed: res?.isPassed ?? null,
      isPublished: res?.isPublished ?? false,
    };
  });
}

function gradeColor(grade: string) {
  if (grade === "A+" || grade === "A") return "bg-green-100 text-green-700";
  if (grade === "B+" || grade === "B") return "bg-blue-100 text-blue-700";
  if (grade === "C" || grade === "D") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function AdminTeacherExams() {
  const { user } = useAuth();
  const isAdmin = user?.role === "schooladmin";

  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [terms, setTerms] = useState<TermRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [passPercentage, setPassPercentage] = useState(35);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create/edit single exam ("Test")
  const [open, setOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Create/edit exam term ("Exam")
  const [termOpen, setTermOpen] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [termForm, setTermForm] = useState(EMPTY_TERM_FORM);
  const [termSubjects, setTermSubjects] = useState<TermSubjectDraft[]>([{ subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }]);
  const [termSubjectOptions, setTermSubjectOptions] = useState<SubjectOption[]>([]);
  const [termSubmitting, setTermSubmitting] = useState(false);

  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

  // Cancel (exam or term)
  const [cancelTarget, setCancelTarget] = useState<{ kind: "exam" | "term"; id: string; title: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Change requests
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [requestTarget, setRequestTarget] = useState<{ kind: "exam" | "term"; id: string; title: string } | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestField, setRequestField] = useState("");
  const [requestValue, setRequestValue] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<ChangeRequestRow | null>(null);
  const [reviewReply, setReviewReply] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [activeTab, setActiveTab] = useState("tests");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  // Results tab
  const [rClass, setRClass] = useState("all");
  const [rSourceType, setRSourceType] = useState<"test" | "exam">("test");
  const [rSourceId, setRSourceId] = useState("");
  const [rLoading, setRLoading] = useState(false);
  const [rSaving, setRSaving] = useState(false);
  const [rPublishing, setRPublishing] = useState(false);
  const [rTestMeta, setRTestMeta] = useState<{ title: string; totalMarks: number; subject: string } | null>(null);
  const [rTestRows, setRTestRows] = useState<MergedResultRow[] | null>(null);
  const [rTermSubjects, setRTermSubjects] = useState<ExamRow[] | null>(null);
  const [rActiveSubjectId, setRActiveSubjectId] = useState("");
  const [rSubjectRows, setRSubjectRows] = useState<Record<string, MergedResultRow[]>>({});

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ExamRow[] }>("/exams", token)
      .then((res) => setExams(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load exams."));
    apiGet<{ success: boolean; data: TermRow[] }>("/scheduled-exams", token)
      .then((res) => setTerms(res.data))
      .catch(() => setTerms([]));
    apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
    if (isAdmin) {
      apiGet<{ success: boolean; data: ChangeRequestRow[] }>("/exam-change-requests?status=pending", token)
        .then((res) => setChangeRequests(res.data))
        .catch(() => {});
    }
  };

  useEffect(() => {
    load();
    const token = getToken();
    if (token) {
      apiGet<{ success: boolean; data: { settings?: { passPercentage?: number } } }>("/school/profile", token)
        .then((res) => { if (res.data?.settings?.passPercentage) setPassPercentage(res.data.settings.passPercentage); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever the selected class changes.
    if (!form.class) { setSubjectOptions([]); return; }
    const token = getToken();
    if (!token) return;
    const cls = classes.find((c) => c.name === form.class && c.section === form.section);
    if (!cls) { setSubjectOptions([]); return; }
    apiGet<SubjectsResponse>(`/subjects/class/${cls._id}`, token)
      .then((res) => setSubjectOptions(res.data))
      .catch(() => setSubjectOptions([]));
  }, [form.class, form.section, classes]);

  // ── Single exam ("Test") create/edit ─────────────────────────────────────
  const openAdd = () => {
    setEditingExamId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEditExam = (exam: ExamRow) => {
    setEditingExamId(exam._id);
    setForm({
      title: exam.title,
      class: exam.class,
      section: exam.section || "",
      subject: exam.subject,
      subjects: [],
      subjectSlots: {},
      date: exam.date.slice(0, 10),
      startTime: exam.startTime || "",
      endTime: exam.endTime || "",
      totalMarks: String(exam.totalMarks),
      passingMarks: String(exam.passingMarks),
      examType: exam.examType,
    });
    const cls = classes.find((c) => c.name === exam.class && c.section === (exam.section || ""));
    if (cls) {
      const token = getToken();
      if (token) {
        apiGet<SubjectsResponse>(`/subjects/class/${cls._id}`, token)
          .then((res) => setSubjectOptions(res.data))
          .catch(() => setSubjectOptions([]));
      }
    }
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const today = new Date(new Date().toDateString());
    if (editingExamId) {
      if (form.date && new Date(form.date) < today) {
        toast.error("Test date cannot be a past date.");
        return;
      }
      if (form.startTime && form.endTime && calcDurationMinutes(form.startTime, form.endTime) <= 0) {
        toast.error("End time must be after start time.");
        return;
      }
    }
    if (!editingExamId) {
      if (form.subjects.length === 0) {
        toast.error("Pick at least one subject.");
        return;
      }
      for (const name of form.subjects) {
        if (new Date(form.subjectSlots[name]?.date || "") < today) {
          toast.error(`${name}'s date cannot be in the past.`);
          return;
        }
      }
      const conflict = findScheduleConflict(
        form.subjects.map((name) => ({ label: name, ...form.subjectSlots[name] })),
      );
      if (conflict) {
        toast.error(conflict);
        return;
      }
    }
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const body = editingExamId
        ? { ...form, totalMarks: Number(form.totalMarks), passingMarks: Number(form.passingMarks) }
        : {
            ...form,
            subjects: form.subjects.map((name) => ({ name, ...form.subjectSlots[name] })),
            totalMarks: Number(form.totalMarks),
            passingMarks: Number(form.passingMarks),
          };
      const res = await fetch(editingExamId ? `/api/exams/${editingExamId}` : "/api/exams", {
        method: editingExamId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save test.");
      toast.success(editingExamId ? "Test updated" : json.message || "Test created");
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingExamId(null);
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
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete test.");
      toast.success("Test deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  // ── Exam term ("Exam") create/edit ───────────────────────────────────────
  const openAddTerm = () => {
    setEditingTermId(null);
    setTermForm(EMPTY_TERM_FORM);
    setTermSubjects([{ subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }]);
    setTermOpen(true);
  };

  const openEditTerm = async (term: TermRow) => {
    const token = getToken();
    if (!token) return;
    setEditingTermId(term._id);
    setTermForm({
      title: term.title,
      class: term.class,
      section: term.section || "",
      examType: term.examType,
      startDate: term.startDate.slice(0, 10),
      endDate: term.endDate.slice(0, 10),
      description: term.description || "",
    });
    try {
      const cls = classes.find((c) => c.name === term.class && c.section === (term.section || ""));
      if (cls) {
        const subRes = await apiGet<SubjectsResponse>(`/subjects/class/${cls._id}`, token);
        setTermSubjectOptions(subRes.data);
      }
      const res = await apiGet<{ success: boolean; data: TermRow }>(`/scheduled-exams/${term._id}`, token);
      const subs = res.data.subjects || [];
      setTermSubjects(
        subs.length > 0
          ? subs.map((s) => ({ subject: s.subject, date: s.date.slice(0, 10), totalMarks: String(s.totalMarks), startTime: s.startTime || "09:00", endTime: s.endTime || "10:00" }))
          : [{ subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }],
      );
    } catch {
      setTermSubjects([{ subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }]);
    }
    setTermOpen(true);
  };

  const addTermSubjectRow = () => setTermSubjects((rows) => [...rows, { subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }]);
  const removeTermSubjectRow = (i: number) => setTermSubjects((rows) => rows.filter((_, idx) => idx !== i));
  const updateTermSubjectRow = (i: number, patch: Partial<TermSubjectDraft>) =>
    setTermSubjects((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleTermSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validSubjects = termSubjects.filter((s) => s.subject.trim() && s.date && s.totalMarks);
    if (validSubjects.length === 0) {
      toast.error("Add at least one subject with a date and total marks.");
      return;
    }
    if (!editingTermId) {
      const today = new Date(new Date().toDateString());
      if (termForm.startDate && new Date(termForm.startDate) < today) {
        toast.error("Start date cannot be a past date.");
        return;
      }
      if (validSubjects.some((s) => new Date(s.date) < today)) {
        toast.error("Subject dates cannot be in the past.");
        return;
      }
    }
    const conflict = findScheduleConflict(validSubjects.map((s) => ({ label: s.subject.trim(), date: s.date, startTime: s.startTime, endTime: s.endTime })));
    if (conflict) {
      toast.error(conflict);
      return;
    }
    const token = getToken();
    if (!token) return;
    setTermSubmitting(true);
    try {
      const body = {
        ...termForm,
        subjects: validSubjects.map((s) => ({
          subject: s.subject.trim(),
          date: s.date,
          totalMarks: Number(s.totalMarks),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      };
      const res = await fetch(editingTermId ? `/api/scheduled-exams/${editingTermId}` : "/api/scheduled-exams", {
        method: editingTermId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save exam.");
      toast.success(editingTermId ? "Exam updated" : "Exam created");
      setTermOpen(false);
      setEditingTermId(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setTermSubmitting(false);
    }
  };

  const handleDeleteTerm = async (term: TermRow) => {
    if (!confirm(`Delete "${term.title}"? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(term._id);
    try {
      const res = await fetch(`/api/scheduled-exams/${term._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
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

  const toggleExpandTerm = async (term: TermRow) => {
    const next = new Set(expandedTerms);
    if (next.has(term._id)) {
      next.delete(term._id);
      setExpandedTerms(next);
      return;
    }
    next.add(term._id);
    setExpandedTerms(next);
    if (term.subjects) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiGet<{ success: boolean; data: TermRow }>(`/scheduled-exams/${term._id}`, token);
      setTerms((prev) => (prev ? prev.map((t) => (t._id === term._id ? { ...t, subjects: res.data.subjects } : t)) : prev));
    } catch {
      toast.error("Failed to load exam subjects.");
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const submitCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return toast.error("A cancellation reason is required.");
    const token = getToken();
    if (!token) return;
    setCancelling(true);
    try {
      const path = cancelTarget.kind === "exam" ? `/api/exams/${cancelTarget.id}/cancel` : `/api/scheduled-exams/${cancelTarget.id}/cancel`;
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to cancel.");
      toast.success("Cancelled. Affected students will see the update.");
      setCancelTarget(null);
      setCancelReason("");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setCancelling(false);
    }
  };

  // ── Change requests ───────────────────────────────────────────────────────
  const submitChangeRequest = async () => {
    if (!requestTarget || !requestReason.trim() || !requestField || !requestValue.trim()) {
      toast.error("Reason and the change you're requesting are both required.");
      return;
    }
    if (requestField.toLowerCase().includes("date") && new Date(requestValue) < new Date(new Date().toDateString())) {
      toast.error("The requested date cannot be in the past.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSubmittingRequest(true);
    try {
      const res = await fetch("/api/exam-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceType: requestTarget.kind === "exam" ? "exam" : "scheduledExam",
          sourceId: requestTarget.id,
          reason: requestReason,
          requestedChanges: { [requestField]: requestValue },
        }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit change request.");
      toast.success("Change request submitted. Waiting for admin approval.");
      setRequestTarget(null);
      setRequestReason("");
      setRequestField("");
      setRequestValue("");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const decideRequest = async (approve: boolean) => {
    if (!reviewRequest) return;
    if (!approve && !reviewReply.trim()) return toast.error("A reply is required when rejecting.");
    const token = getToken();
    if (!token) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/exam-change-requests/${reviewRequest._id}/${approve ? "approve" : "reject"}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminReply: reviewReply }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update request.");
      toast.success(approve ? "Change request approved and applied." : "Change request rejected.");
      setReviewRequest(null);
      setReviewReply("");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setReviewing(false);
    }
  };

  // ── Results tab ───────────────────────────────────────────────────────────
  const loadTestSource = async (examId: string) => {
    const token = getToken();
    if (!token) return;
    setRLoading(true);
    setRTestRows(null);
    try {
      const [rosterRes, resultsRes] = await Promise.all([
        apiGet<{ success: boolean; data: RosterEntry[]; exam: { title: string; totalMarks: number; subject: string } }>(`/exams/${examId}/roster`, token),
        apiGet<{ success: boolean; data: { results: ResultRow[] } }>(`/exams/${examId}/results`, token),
      ]);
      setRTestMeta(rosterRes.exam);
      setRTestRows(mergeRosterAndResults(rosterRes.data, resultsRes.data.results));
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to load results." });
    } finally {
      setRLoading(false);
    }
  };

  const loadTermSource = async (termId: string) => {
    const token = getToken();
    if (!token) return;
    setRLoading(true);
    setRTermSubjects(null);
    setRSubjectRows({});
    try {
      const termRes = await apiGet<{ success: boolean; data: TermRow }>(`/scheduled-exams/${termId}`, token);
      const subs = termRes.data.subjects || [];
      setRTermSubjects(subs);
      if (subs.length === 0) return;
      const pairs = await Promise.all(
        subs.map(async (s) => {
          const [rosterRes, resultsRes] = await Promise.all([
            apiGet<{ success: boolean; data: RosterEntry[] }>(`/exams/${s._id}/roster`, token),
            apiGet<{ success: boolean; data: { results: ResultRow[] } }>(`/exams/${s._id}/results`, token),
          ]);
          return [s._id, mergeRosterAndResults(rosterRes.data, resultsRes.data.results)] as const;
        }),
      );
      setRSubjectRows(Object.fromEntries(pairs));
      setRActiveSubjectId(subs[0]._id);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to load results." });
    } finally {
      setRLoading(false);
    }
  };

  useEffect(() => {
    if (!rSourceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reload whenever the selected test/exam changes.
    if (rSourceType === "test") loadTestSource(rSourceId);
    else loadTermSource(rSourceId);
  }, [rSourceId, rSourceType]);

  const updateTestRow = (studentId: string, patch: Partial<MergedResultRow>) =>
    setRTestRows((rows) => rows && rows.map((r) => (r.student._id === studentId ? { ...r, ...patch } : r)));

  const updateSubjectRow = (subjectExamId: string, studentId: string, patch: Partial<MergedResultRow>) =>
    setRSubjectRows((prev) => ({
      ...prev,
      [subjectExamId]: (prev[subjectExamId] || []).map((r) => (r.student._id === studentId ? { ...r, ...patch } : r)),
    }));

  const saveRows = async (examId: string, rows: MergedResultRow[]) => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`/api/exams/${examId}/marks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ results: rows.map((r) => ({ studentId: r.student._id, marksObtained: r.marksObtained, remarks: r.remarks })) }),
    });
    const json: ApiMessageResponse = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Failed to save marks.");
  };

  const publishResultIds = async (resultIds: string[], publish: boolean) => {
    const token = getToken();
    if (!token || resultIds.length === 0) return;
    const res = await fetch("/api/results/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resultIds, publish }),
    });
    const json: ApiMessageResponse = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Failed to update results.");
  };

  const handleSaveAllTest = async () => {
    if (!rTestRows || !rSourceId) return;
    setRSaving(true);
    try {
      await saveRows(rSourceId, rTestRows);
      toast.success("Marks saved");
      await loadTestSource(rSourceId);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setRSaving(false);
    }
  };

  const handlePublishAllTest = async (publish: boolean) => {
    if (!rTestRows || !rSourceId) return;
    const ids = rTestRows.filter((r) => r.resultId).map((r) => r.resultId as string);
    if (ids.length === 0) return toast.error("No saved results to publish yet.");
    setRPublishing(true);
    try {
      await publishResultIds(ids, publish);
      toast.success(publish ? "Results published" : "Results unpublished");
      await loadTestSource(rSourceId);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setRPublishing(false);
    }
  };

  const handleRowSaveAndPublish = async (row: MergedResultRow) => {
    if (!rSourceId || row.marksObtained === null) return;
    setBusyId(row.student._id);
    try {
      await saveRows(rSourceId, [row]);
      const token = getToken();
      if (!token) return;
      const resultsRes = await apiGet<{ success: boolean; data: { results: ResultRow[] } }>(`/exams/${rSourceId}/results`, token);
      const saved = resultsRes.data.results.find((r) => r.student._id === row.student._id);
      if (saved) await publishResultIds([saved._id], true);
      toast.success("Saved and published");
      await loadTestSource(rSourceId);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const handleRowTogglePublish = async (row: MergedResultRow) => {
    if (!row.resultId || !rSourceId) return;
    setBusyId(row.student._id);
    try {
      await publishResultIds([row.resultId], !row.isPublished);
      toast.success(row.isPublished ? "Unpublished" : "Published");
      await loadTestSource(rSourceId);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveActiveSubject = async () => {
    if (!rActiveSubjectId) return;
    const rows = rSubjectRows[rActiveSubjectId];
    if (!rows) return;
    setRSaving(true);
    try {
      await saveRows(rActiveSubjectId, rows);
      toast.success("Marks saved");
      const token = getToken();
      if (!token) return;
      const [rosterRes, resultsRes] = await Promise.all([
        apiGet<{ success: boolean; data: RosterEntry[] }>(`/exams/${rActiveSubjectId}/roster`, token),
        apiGet<{ success: boolean; data: { results: ResultRow[] } }>(`/exams/${rActiveSubjectId}/results`, token),
      ]);
      setRSubjectRows((prev) => ({ ...prev, [rActiveSubjectId]: mergeRosterAndResults(rosterRes.data, resultsRes.data.results) }));
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setRSaving(false);
    }
  };

  const handlePublishAllSubjects = async (publish: boolean) => {
    if (!rSourceId) return;
    const allIds = Object.values(rSubjectRows).flat().filter((r) => r.resultId).map((r) => r.resultId as string);
    if (allIds.length === 0) return toast.error("No saved results to publish yet.");
    setRPublishing(true);
    try {
      await publishResultIds(allIds, publish);
      toast.success(publish ? "Results published across all subjects" : "Results unpublished across all subjects");
      await loadTermSource(rSourceId);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setRPublishing(false);
    }
  };

  if (!user) return null;

  const subjects = Array.from(new Set((exams ?? []).map((e) => e.subject))).sort();
  const filteredExams = (exams ?? []).filter((exam) => {
    if (exam.scheduledExamId) return false;
    if (search && !exam.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classFilter !== "all" && exam.class !== classFilter) return false;
    if (subjectFilter !== "all" && exam.subject !== subjectFilter) return false;
    return true;
  });
  const filteredTerms = (terms ?? []).filter((term) => {
    if (search && !term.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (classFilter !== "all" && term.class !== classFilter) return false;
    return true;
  });
  const upcomingCount = (exams ?? []).filter((e) => e.status === "upcoming").length;
  const completedCount = (exams ?? []).filter((e) => e.status === "completed").length;

  const testsForResultPicker = (exams ?? []).filter(
    (e) => !e.scheduledExamId && (rClass === "all" || `${e.class}::${e.section || ""}` === rClass),
  );
  const termsForResultPicker = (terms ?? []).filter((t) => rClass === "all" || `${t.class}::${t.section || ""}` === rClass);

  return (
    <div>
      <PageHeader icon={FileText} title="Exams" subtitle="Create tests and exams, and enter and publish results." accent="violet" className="mb-6" />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {exams && exams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatFilterCard
            icon={FileText}
            color="#4F46E5"
            colorDark="#4338CA"
            value={exams.filter((e) => !e.scheduledExamId).length}
            label="Total Tests"
            active={activeTab === "tests"}
            onClick={() => setActiveTab("tests")}
          />
          <StatFilterCard
            icon={Layers}
            color="#8B5CF6"
            colorDark="#7C3AED"
            value={(terms ?? []).length}
            label="Exams"
            active={activeTab === "exams"}
            onClick={() => setActiveTab("exams")}
          />
          <StatFilterCard icon={CalendarClock} color="#0EA5E9" colorDark="#0284C7" value={upcomingCount} label="Upcoming" />
          <StatFilterCard icon={CheckSquare} color="#16A34A" colorDark="#15803D" value={completedCount} label="Completed" />
        </div>
      )}

      {isAdmin && changeRequests.length > 0 && (
        <div className="rounded-[18px] bg-amber-50 border border-amber-200 p-5 mb-5">
          <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
            <FileEdit className="h-4 w-4" /> Pending Change Requests ({changeRequests.length})
          </h3>
          <div className="space-y-2">
            {changeRequests.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 bg-card rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.sourceType === "exam" ? "Test" : "Exam"} change requested by {r.requestedBy?.name || "a teacher"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setReviewRequest(r); setReviewReply(""); }}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex mb-4">
          <TabsTrigger value="tests" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Tests</TabsTrigger>
          <TabsTrigger value="exams" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Exams</TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Results</TabsTrigger>
        </TabsList>

        {/* ── TESTS ── */}
        <TabsContent value="tests">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-foreground">All Tests</h2>
            <Button onClick={openAdd} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> New Test
            </Button>
          </div>
          {exams && exams.filter((e) => !e.scheduledExamId).length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
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

          {error ? null : !exams ? (
            <PageLoader label="Loading tests..." />
          ) : exams.filter((e) => !e.scheduledExamId).length === 0 ? (
            <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <ClipboardList className="h-6 w-6 text-muted-foreground/70 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tests yet. Create one to get started.</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-muted-foreground">No tests match your filters.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {filteredExams.map((exam) => {
                const locked = !isEditWindowOpen(exam.date);
                return (
                  <div key={exam._id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{exam.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Class {exam.class}{exam.section ? `-${exam.section}` : ""} · {exam.subject} ·{" "}
                        {new Date(exam.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {exam.totalMarks} marks
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2 ${exam.status === "cancelled" ? "bg-red-100 text-red-700" : exam.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {exam.status}
                      </span>
                      {locked && !isAdmin ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => setRequestTarget({ kind: "exam", id: exam._id, title: exam.title })} aria-label="Request change">
                          <FileEdit className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditExam(exam)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {exam.status !== "cancelled" && (
                            <Button variant="ghost" size="icon-sm" onClick={() => setCancelTarget({ kind: "exam", id: exam._id, title: exam.title })} aria-label="Cancel">
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(exam)} disabled={busyId === exam._id} aria-label="Delete" className="hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── EXAMS ── */}
        <TabsContent value="exams">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-foreground">All Exams</h2>
            <Button variant="outline" onClick={openAddTerm} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Exam
            </Button>
          </div>
          {terms && terms.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
              <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "all")}>
                <SelectTrigger className="sm:w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c.name}>Class {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!terms ? (
            <PageLoader label="Loading exams..." />
          ) : filteredTerms.length === 0 ? (
            <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <GraduationCap className="h-6 w-6 text-muted-foreground/70 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No exams yet. Create one to schedule a multi-subject exam like Mid-Terms.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {filteredTerms.map((term) => {
                const expanded = expandedTerms.has(term._id);
                const locked = !isEditWindowOpen(term.startDate);
                return (
                  <div key={term._id} className="border-b border-border last:border-0">
                    <div className="flex items-center justify-between px-5 py-4 gap-4">
                      <button type="button" onClick={() => toggleExpandTerm(term)} className="flex items-center gap-2 min-w-0 text-left">
                        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{term.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Class {term.class}{term.section ? `-${term.section}` : ""} · {term.examType} ·{" "}
                            {new Date(term.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                            {new Date(term.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2 ${term.status === "cancelled" ? "bg-red-100 text-red-700" : term.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                          {term.status}
                        </span>
                        {locked && !isAdmin ? (
                          <Button variant="ghost" size="icon-sm" onClick={() => setRequestTarget({ kind: "term", id: term._id, title: term.title })} aria-label="Request change">
                            <FileEdit className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEditTerm(term)} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {term.status !== "cancelled" && (
                              <Button variant="ghost" size="icon-sm" onClick={() => setCancelTarget({ kind: "term", id: term._id, title: term.title })} aria-label="Cancel">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteTerm(term)} disabled={busyId === term._id} aria-label="Delete" className="hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-5 pb-4">
                        {!term.subjects ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading subjects...</div>
                        ) : term.subjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No subjects scheduled.</p>
                        ) : (
                          <div className="rounded-xl border border-border overflow-hidden">
                            {term.subjects.map((sub) => (
                              <div key={sub._id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground">{sub.subject}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {new Date(sub.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    {sub.startTime && sub.endTime ? ` · ${sub.startTime}–${sub.endTime}` : ""} · {sub.totalMarks} marks
                                  </p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sub.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{sub.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── RESULTS ── */}
        <TabsContent value="results">
          <div className="rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] mb-4">
            <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Result Entry</h2>
            <p className="text-xs text-muted-foreground mb-3">Select a class and a test or exam — enter marks and publish results.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={rClass} onValueChange={(v) => { setRClass(v || "all"); setRSourceId(""); }}>
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={`${c.name}::${c.section}`}>Class {c.name}-{c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rSourceType} onValueChange={(v) => { setRSourceType((v || "test") as "test" | "exam"); setRSourceId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rSourceId} onValueChange={(v) => setRSourceId(v || "")}>
                <SelectTrigger><SelectValue placeholder={rSourceType === "test" ? "Select a test" : "Select an exam"} /></SelectTrigger>
                <SelectContent>
                  {rSourceType === "test"
                    ? testsForResultPicker.map((e) => (
                        <SelectItem key={e._id} value={e._id}>{e.title} — {e.subject}</SelectItem>
                      ))
                    : termsForResultPicker.map((t) => (
                        <SelectItem key={t._id} value={t._id}>{t.title}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!rSourceId ? (
            <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <BarChart3 className="h-6 w-6 text-muted-foreground/70 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Pick a test or exam above to enter marks and publish results.</p>
            </div>
          ) : rLoading ? (
            <PageLoader label="Loading results..." />
          ) : rSourceType === "test" ? (
            !rTestRows ? null : rTestRows.length === 0 ? (
              <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <p className="text-sm text-muted-foreground">No active students in this class.</p>
              </div>
            ) : (
              <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{rTestMeta?.title}</p>
                    <p className="text-xs text-muted-foreground">{rTestMeta?.subject} · Out of {rTestMeta?.totalMarks} · {rTestRows.length} students</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleSaveAllTest} disabled={rSaving} className="gap-1.5">
                      {rSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save All
                    </Button>
                    <Button size="sm" onClick={() => handlePublishAllTest(true)} disabled={rPublishing} className="gap-1.5 bg-primary hover:bg-primary/90">
                      {rPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />} Publish All
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePublishAllTest(false)} disabled={rPublishing} className="text-red-600 hover:text-red-700">
                      Unpublish All
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Roll</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Result</TableHead>
                      <TableHead className="text-center">Published</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rTestRows.map((row, i) => (
                      <TableRow key={row.student._id}>
                        <TableCell className="text-muted-foreground/70">{i + 1}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{row.student.name}</p>
                          <p className="text-[11px] text-muted-foreground/70">{row.student.studentId}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.student.rollNumber || "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number" min={0} max={rTestMeta?.totalMarks}
                            value={row.marksObtained ?? ""}
                            onChange={(e) => updateTestRow(row.student._id, { marksObtained: e.target.value === "" ? null : Number(e.target.value) })}
                            className="w-20 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={row.remarks} onChange={(e) => updateTestRow(row.student._id, { remarks: e.target.value })} className="w-32 h-8" />
                        </TableCell>
                        <TableCell className="text-center">
                          {row.grade ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${gradeColor(row.grade)}`}>{row.grade}</span>
                          ) : (
                            <span className="text-muted-foreground/70 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.isPassed === null ? (
                            <span className="text-muted-foreground/70 text-xs">—</span>
                          ) : row.isPassed ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Pass</span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Fail</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.resultId ? (
                            row.isPublished ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Published</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Draft</span>
                            )
                          ) : (
                            <span className="text-muted-foreground/70 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!row.resultId ? (
                            row.marksObtained !== null ? (
                              <Button size="xs" variant="outline" onClick={() => handleRowSaveAndPublish(row)} disabled={busyId === row.student._id} className="gap-1">
                                {busyId === row.student._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Save & Publish
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/70">Enter marks first</span>
                            )
                          ) : (
                            <Button size="xs" variant="outline" onClick={() => handleRowTogglePublish(row)} disabled={busyId === row.student._id} className="gap-1">
                              {busyId === row.student._id ? <Loader2 className="h-3 w-3 animate-spin" /> : row.isPublished ? <XCircle className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                              {row.isPublished ? "Unpublish" : "Publish"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : !rTermSubjects ? null : rTermSubjects.length === 0 ? (
            <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-muted-foreground">This exam has no subjects scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[18px] bg-card p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-muted-foreground">{rTermSubjects.length} subjects · {Object.values(rSubjectRows).flat().length} total entries</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveActiveSubject} disabled={rSaving} className="gap-1.5">
                    {rSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save {rTermSubjects.find((s) => s._id === rActiveSubjectId)?.subject || ""}
                  </Button>
                  <Button size="sm" onClick={() => handlePublishAllSubjects(true)} disabled={rPublishing} className="gap-1.5 bg-primary hover:bg-primary/90">
                    {rPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />} Publish All Subjects
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handlePublishAllSubjects(false)} disabled={rPublishing} className="text-red-600 hover:text-red-700">
                    Unpublish All
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {rTermSubjects.map((s) => {
                  const rows = rSubjectRows[s._id] || [];
                  const savedCount = rows.filter((r) => r.marksObtained !== null).length;
                  const allSaved = rows.length > 0 && savedCount === rows.length;
                  const activeTab = rActiveSubjectId === s._id;
                  return (
                    <button
                      key={s._id}
                      onClick={() => setRActiveSubjectId(s._id)}
                      className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        activeTab ? "bg-primary text-white" : "bg-card text-muted-foreground shadow-[0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-muted/50"
                      }`}
                    >
                      {s.subject}
                      <span className={activeTab ? "text-white/80" : "text-muted-foreground/70"}>
                        ({new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {s.totalMarks}m)
                      </span>
                      {allSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px]">{savedCount}/{rows.length}</span>}
                    </button>
                  );
                })}
              </div>

              {(rSubjectRows[rActiveSubjectId] || []).length === 0 ? (
                <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                  <p className="text-sm text-muted-foreground">No active students in this class.</p>
                </div>
              ) : (
                <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Roll</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Result</TableHead>
                        <TableHead className="text-center">Published</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rSubjectRows[rActiveSubjectId] || []).map((row, i) => (
                        <TableRow key={row.student._id}>
                          <TableCell className="text-muted-foreground/70">{i + 1}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-foreground">{row.student.name}</p>
                            <p className="text-[11px] text-muted-foreground/70">{row.student.studentId}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.student.rollNumber || "—"}</TableCell>
                          <TableCell>
                            <Input
                              type="number" min={0}
                              max={rTermSubjects.find((s) => s._id === rActiveSubjectId)?.totalMarks}
                              value={row.marksObtained ?? ""}
                              onChange={(e) => updateSubjectRow(rActiveSubjectId, row.student._id, { marksObtained: e.target.value === "" ? null : Number(e.target.value) })}
                              className="w-20 h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.remarks}
                              onChange={(e) => updateSubjectRow(rActiveSubjectId, row.student._id, { remarks: e.target.value })}
                              className="w-32 h-8"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {row.grade ? (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${gradeColor(row.grade)}`}>{row.grade}</span>
                            ) : (
                              <span className="text-muted-foreground/70 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.isPassed === null ? (
                              <span className="text-muted-foreground/70 text-xs">—</span>
                            ) : row.isPassed ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Pass</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Fail</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.resultId ? (
                              row.isPublished ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Published</span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Draft</span>
                              )
                            ) : (
                              <span className="text-muted-foreground/70 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Test */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingExamId(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="h-4.5 w-4.5" />
              </span>
              {editingExamId ? "Edit Test" : "New Test"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Basic Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Title" required>
                    <Input placeholder="e.g. Unit Test 1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className="rounded-xl" />
                  </Field>
                </div>
                <Field label="Class" required>
                  {classes.length > 0 ? (
                    <Select
                      value={form.class && form.section ? `${form.class}::${form.section}` : ""}
                      onValueChange={(v) => {
                        const cls = classes.find((c) => `${c.name}::${c.section}` === v);
                        if (cls) setForm((f) => ({ ...f, class: cls.name, section: cls.section, subject: "", subjects: [], subjectSlots: {} }));
                      }}
                    >
                      <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="Select a class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c._id} value={`${c.name}::${c.section}`}>Class {c.name}-{c.section}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: e.target.value }))} required className="rounded-xl" />
                  )}
                </Field>
                {editingExamId ? (
                  <Field label="Subject" required>
                    {subjectOptions.length > 0 ? (
                      <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v || "" }))}>
                        <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>
                          {subjectOptions.map((s) => (
                            <SelectItem key={s._id} value={s.name}>{s.name} ({s.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder={form.class ? "No subjects assigned" : "Select class first"} disabled={!form.class} required className="rounded-xl" />
                    )}
                  </Field>
                ) : (
                  <Field label="Type">
                    <Select value={form.examType} onValueChange={(v) => setForm((f) => ({ ...f, examType: (v || f.examType) as ExamType }))}>
                      <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["unit-test", "mid-term", "final", "practical", "assignment"] as ExamType[]).map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </div>

            {!editingExamId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subjects, Dates &amp; Times</p>
                  {form.subjects.length > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {form.subjects.length} selected
                    </span>
                  )}
                </div>
                {subjectOptions.length > 0 ? (
                  <div className="border border-border rounded-xl divide-y divide-border max-h-72 overflow-y-auto">
                    {subjectOptions.map((s) => {
                      const checked = form.subjects.includes(s.name);
                      const slot = form.subjectSlots[s.name];
                      const toggle = (next: boolean) =>
                        setForm((f) => {
                          if (next) {
                            return { ...f, subjects: [...f.subjects, s.name], subjectSlots: { ...f.subjectSlots, [s.name]: { date: "", startTime: "09:00", endTime: "10:00" } } };
                          }
                          const { [s.name]: _removed, ...rest } = f.subjectSlots;
                          void _removed;
                          return { ...f, subjects: f.subjects.filter((x) => x !== s.name), subjectSlots: rest };
                        });
                      const updateSlot = (patch: Partial<SubjectSlot>) =>
                        setForm((f) => ({ ...f, subjectSlots: { ...f.subjectSlots, [s.name]: { ...f.subjectSlots[s.name], ...patch } } }));
                      const validDuration = slot && slot.startTime && slot.endTime && calcDurationMinutes(slot.startTime, slot.endTime) > 0;
                      return (
                        <div key={s._id} className={`px-3 py-2.5 transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-primary" checked={checked} onChange={(e) => toggle(e.target.checked)} />
                            <span className="flex-1 min-w-0 text-sm font-medium text-foreground">
                              {s.name} <span className="text-xs text-muted-foreground font-mono font-normal">({s.code})</span>
                            </span>
                            {checked && validDuration && (
                              <span className="text-[10px] font-semibold text-primary/80">{calcDurationMinutes(slot.startTime, slot.endTime)} min</span>
                            )}
                          </label>
                          {checked && slot && (
                            <div className="mt-2.5 grid grid-cols-3 gap-2 pl-6.5">
                              <Input type="date" className="h-8 text-xs rounded-lg" min={todayISO()} value={slot.date} onChange={(e) => updateSlot({ date: e.target.value })} required />
                              <Input type="time" className="h-8 text-xs rounded-lg" value={slot.startTime} onChange={(e) => updateSlot({ startTime: e.target.value })} required />
                              <Input type="time" className="h-8 text-xs rounded-lg" value={slot.endTime} onChange={(e) => updateSlot({ endTime: e.target.value })} required />
                              {!validDuration && (
                                <p className="col-span-3 text-[11px] text-red-500 -mt-1">End time must be after start time.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">{form.class ? "No subjects assigned to this class." : "Select a class first."}</p>
                )}
                {form.subjects.length > 1 && (
                  <div className="mt-2.5 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-primary/90">
                    A separate test will be created for each of the {form.subjects.length} subjects, on its own date and time.
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {editingExamId ? "Schedule & Marking" : "Marking"}
              </p>
              <div className="space-y-3">
                {editingExamId && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date" required>
                        <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} min={todayISO()} required className="rounded-xl" />
                      </Field>
                      <Field label="Type">
                        <Select value={form.examType} onValueChange={(v) => setForm((f) => ({ ...f, examType: (v || f.examType) as ExamType }))}>
                          <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["unit-test", "mid-term", "final", "practical", "assignment"] as ExamType[]).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="From" required>
                          <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required className="rounded-lg" />
                        </Field>
                        <Field label="To" required>
                          <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} required className="rounded-lg" />
                        </Field>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {form.startTime && form.endTime && calcDurationMinutes(form.startTime, form.endTime) > 0
                          ? `Duration: ${calcDurationMinutes(form.startTime, form.endTime)} minutes`
                          : "End time must be after start time."}
                      </p>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Marks" required>
                    <Input type="number" min={1} value={form.totalMarks} onChange={(e) => {
                      const tm = e.target.value;
                      setForm((f) => ({ ...f, totalMarks: tm, passingMarks: tm ? String(Math.round(Number(tm) * passPercentage / 100)) : "" }));
                    }} required className="rounded-xl" />
                  </Field>
                  <Field label="Passing Marks" required>
                    <Input type="number" min={0} value={form.passingMarks} onChange={(e) => setForm((f) => ({ ...f, passingMarks: e.target.value }))} required className="rounded-xl" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent border-0 text-white" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingExamId ? "Save Changes" : form.subjects.length > 1 ? `Create ${form.subjects.length} Tests` : "Create Test"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Exam */}
      <Dialog open={termOpen} onOpenChange={(o) => { setTermOpen(o); if (!o) setEditingTermId(null); }}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-4.5 w-4.5" />
              </span>
              {editingTermId ? "Edit Exam" : "New Exam"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTermSubmit} className="space-y-5 mt-2">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exam Details</p>
              <div className="space-y-3">
                <Field label="Title" required>
                  <Input placeholder="e.g. Mid-Term Exams" value={termForm.title} onChange={(e) => setTermForm((f) => ({ ...f, title: e.target.value }))} required className="rounded-xl" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Class" required>
                    {classes.length > 0 ? (
                      <Select
                        value={termForm.class && termForm.section ? `${termForm.class}::${termForm.section}` : ""}
                        onValueChange={(v) => {
                          const cls = classes.find((c) => `${c.name}::${c.section}` === v);
                          if (cls) {
                            setTermForm((f) => ({ ...f, class: cls.name, section: cls.section }));
                            const token = getToken();
                            if (token) {
                              apiGet<SubjectsResponse>(`/subjects/class/${cls._id}`, token)
                                .then((res) => {
                                  setTermSubjectOptions(res.data);
                                  setTermSubjects(res.data.map((s) => ({ subject: s.name, date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" })));
                                })
                                .catch(() => { setTermSubjectOptions([]); setTermSubjects([{ subject: "", date: "", totalMarks: "100", startTime: "09:00", endTime: "10:00" }]); });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c._id} value={`${c.name}::${c.section}`}>Class {c.name}-{c.section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={termForm.class} onChange={(e) => setTermForm((f) => ({ ...f, class: e.target.value }))} required className="rounded-xl" />
                    )}
                  </Field>
                  <Field label="Type" required>
                    <Select value={termForm.examType} onValueChange={(v) => setTermForm((f) => ({ ...f, examType: (v || f.examType) as TermType }))}>
                      <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["midterm", "final", "unit", "annual"] as TermType[]).map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date" required>
                    <Input
                      type="date"
                      value={termForm.startDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate < e.target.value ? "" : f.endDate }))}
                      min={editingTermId ? undefined : todayISO()}
                      required
                      className="rounded-xl"
                    />
                  </Field>
                  <Field label="End Date" required>
                    <Input
                      type="date"
                      value={termForm.endDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))}
                      min={termForm.startDate || (editingTermId ? undefined : todayISO())}
                      required
                      className="rounded-xl"
                    />
                  </Field>
                </div>
                <Field label="Description">
                  <Textarea rows={2} value={termForm.description} onChange={(e) => setTermForm((f) => ({ ...f, description: e.target.value }))} className="rounded-xl" />
                </Field>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subjects &amp; Schedule</p>
                <Button type="button" size="sm" variant="outline" onClick={addTermSubjectRow} className="gap-1 rounded-lg"><Plus className="h-3.5 w-3.5" /> Add Subject</Button>
              </div>
              {termForm.class && termSubjectOptions.length === 0 && (
                <p className="text-xs text-amber-600 mb-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                  No subjects are assigned to Class {termForm.class}{termForm.section ? `-${termForm.section}` : ""} yet — assign some from Subject &amp; Class, or type names in below.
                </p>
              )}
              <div className="space-y-3">
                {termSubjects.map((s, i) => {
                  const selectedSubjects = new Set(termSubjects.filter((row, idx) => idx !== i && row.subject).map((row) => row.subject));
                  const validDuration = s.startTime && s.endTime && calcDurationMinutes(s.startTime, s.endTime) > 0;
                  return (
                  <div key={i} className="rounded-xl border border-border p-3 space-y-2.5 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{i + 1}</span>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTermSubjectRow(i)} disabled={termSubjects.length === 1} className="text-muted-foreground hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-[1.4fr_1fr_0.7fr] gap-2 items-end">
                      <Field label="Subject">
                        {!termForm.class ? (
                          <Input placeholder="Select a class first" value="" disabled className="rounded-lg" />
                        ) : termSubjectOptions.length > 0 ? (
                          <Select value={s.subject} onValueChange={(v) => updateTermSubjectRow(i, { subject: v || "" })}>
                            <SelectTrigger className="w-full rounded-lg"><SelectValue placeholder="Select subject" /></SelectTrigger>
                            <SelectContent>
                              {termSubjectOptions.filter((sub) => !selectedSubjects.has(sub.name) || sub.name === s.subject).map((sub) => (
                                <SelectItem key={sub._id} value={sub.name}>{sub.name} ({sub.code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input placeholder="Type a subject name" value={s.subject} onChange={(e) => updateTermSubjectRow(i, { subject: e.target.value })} className="rounded-lg" />
                        )}
                      </Field>
                      <Field label="Date">
                        <Input
                          type="date"
                          value={s.date}
                          onChange={(e) => updateTermSubjectRow(i, { date: e.target.value })}
                          min={termForm.startDate || (editingTermId ? undefined : todayISO())}
                          max={termForm.endDate || undefined}
                          className="rounded-lg"
                        />
                      </Field>
                      <Field label="Marks">
                        <Input type="number" min={1} value={s.totalMarks} onChange={(e) => updateTermSubjectRow(i, { totalMarks: e.target.value })} className="rounded-lg" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <Field label="From">
                        <Input type="time" value={s.startTime} onChange={(e) => updateTermSubjectRow(i, { startTime: e.target.value })} className="rounded-lg" />
                      </Field>
                      <Field label="To">
                        <Input type="time" value={s.endTime} onChange={(e) => updateTermSubjectRow(i, { endTime: e.target.value })} className="rounded-lg" />
                      </Field>
                    </div>
                    <p className={`text-xs ${validDuration ? "text-muted-foreground" : "text-red-500"}`}>
                      {validDuration ? `Duration: ${calcDurationMinutes(s.startTime, s.endTime)} minutes` : "End time must be after start time."}
                    </p>
                  </div>
                  );
                })}
              </div>
              {termSubjects.length > 0 && (
                <div className="mt-3 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 flex items-center justify-between text-xs text-primary/90">
                  <span>{termSubjects.length} subject{termSubjects.length > 1 ? "s" : ""} in this exam</span>
                  {termForm.startDate && termForm.endDate && (
                    <span className="font-medium">
                      {termForm.startDate === termForm.endDate
                        ? new Date(termForm.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                        : `${new Date(termForm.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(termForm.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setTermOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent border-0 text-white" disabled={termSubmitting}>
                {termSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTermId ? "Save Changes" : "Create Exam"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">Cancel {cancelTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label="Reason" required>
              <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Let students and parents know why this is cancelled." />
            </Field>
            <Button onClick={submitCancel} className="w-full bg-red-600 hover:bg-red-700" disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Cancellation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request change (teacher) */}
      <Dialog open={!!requestTarget} onOpenChange={(o) => { if (!o) { setRequestTarget(null); setRequestReason(""); setRequestField(""); setRequestValue(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">Request Change — {requestTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">This starts within 2 hours, so changes need admin approval.</p>
            <Field label="What needs to change?" required>
              <Select value={requestField} onValueChange={(v) => setRequestField(v || "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a field" /></SelectTrigger>
                <SelectContent>
                  {requestTarget?.kind === "exam" ? (
                    <>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="totalMarks">Total Marks</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="startDate">Start Date</SelectItem>
                      <SelectItem value="endDate">End Date</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="New Value" required>
              <Input
                type={requestField.toLowerCase().includes("date") ? "date" : requestField === "totalMarks" ? "number" : "text"}
                value={requestValue}
                onChange={(e) => setRequestValue(e.target.value)}
                min={requestField.toLowerCase().includes("date") ? todayISO() : undefined}
              />
            </Field>
            <Field label="Reason" required>
              <Textarea rows={3} value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Why does this need to change?" />
            </Field>
            <Button onClick={submitChangeRequest} className="w-full bg-primary hover:bg-primary/90" disabled={submittingRequest}>
              {submittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review change request (admin) */}
      <Dialog open={!!reviewRequest} onOpenChange={(o) => { if (!o) { setReviewRequest(null); setReviewReply(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Review Change Request</DialogTitle>
          </DialogHeader>
          {reviewRequest && (
            <div className="space-y-3 mt-2">
              <div className="rounded-xl bg-muted/50 border border-border p-3 text-xs space-y-1">
                <p><span className="font-semibold text-foreground">Requested by:</span> {reviewRequest.requestedBy?.name || "—"}</p>
                <p><span className="font-semibold text-foreground">Reason:</span> {reviewRequest.reason}</p>
                <p><span className="font-semibold text-foreground">Change:</span> {JSON.stringify(reviewRequest.requestedChanges)}</p>
              </div>
              <Field label="Reply">
                <Textarea rows={2} value={reviewReply} onChange={(e) => setReviewReply(e.target.value)} placeholder="Optional note to the teacher (required if rejecting)." />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5 text-red-600 hover:text-red-700" onClick={() => decideRequest(false)} disabled={reviewing}>
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
                </Button>
                <Button className="flex-1 gap-1.5 bg-primary hover:bg-primary/90" onClick={() => decideRequest(true)} disabled={reviewing}>
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & Apply"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-semibold text-foreground">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
    </div>
  );
}
