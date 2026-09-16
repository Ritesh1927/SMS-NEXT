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

type ExamType = "unit-test" | "mid-term" | "final" | "practical" | "assignment";
type ExamStatus = "upcoming" | "ongoing" | "completed" | "cancelled";
type TermType = "midterm" | "final" | "unit" | "annual";

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
  duration: number | null;
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

interface TermSubjectDraft {
  subject: string;
  date: string;
  totalMarks: string;
  duration: string;
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
  const [termSubjects, setTermSubjects] = useState<TermSubjectDraft[]>([{ subject: "", date: "", totalMarks: "100", duration: "60" }]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      date: exam.date.slice(0, 10),
      totalMarks: String(exam.totalMarks),
      passingMarks: String(exam.passingMarks),
      examType: exam.examType,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const body = { ...form, totalMarks: Number(form.totalMarks), passingMarks: Number(form.passingMarks) };
      const res = await fetch(editingExamId ? `/api/exams/${editingExamId}` : "/api/exams", {
        method: editingExamId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save test.");
      toast.success(editingExamId ? "Test updated" : "Test created");
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
    setTermSubjects([{ subject: "", date: "", totalMarks: "100", duration: "60" }]);
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
      const res = await apiGet<{ success: boolean; data: TermRow }>(`/scheduled-exams/${term._id}`, token);
      const subs = res.data.subjects || [];
      setTermSubjects(
        subs.length > 0
          ? subs.map((s) => ({ subject: s.subject, date: s.date.slice(0, 10), totalMarks: String(s.totalMarks), duration: String(s.duration ?? 60) }))
          : [{ subject: "", date: "", totalMarks: "100", duration: "60" }],
      );
    } catch {
      setTermSubjects([{ subject: "", date: "", totalMarks: "100", duration: "60" }]);
    }
    setTermOpen(true);
  };

  const addTermSubjectRow = () => setTermSubjects((rows) => [...rows, { subject: "", date: "", totalMarks: "100", duration: "60" }]);
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
          duration: Number(s.duration) || 60,
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#172554]">Exams</h1>
        <p className="text-sm text-[#64748B] mt-1">Create tests and exams, and enter and publish results.</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {exams && exams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard icon={<FileText className="h-4 w-4" />} label="Total Tests" value={exams.filter((e) => !e.scheduledExamId).length} />
          <StatCard icon={<Layers className="h-4 w-4" />} label="Exams" value={(terms ?? []).length} />
          <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Upcoming" value={upcomingCount} />
          <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Completed" value={completedCount} />
        </div>
      )}

      {isAdmin && changeRequests.length > 0 && (
        <div className="rounded-[18px] bg-amber-50 border border-amber-200 p-5 mb-5">
          <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
            <FileEdit className="h-4 w-4" /> Pending Change Requests ({changeRequests.length})
          </h3>
          <div className="space-y-2">
            {changeRequests.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#172554] truncate">
                    {r.sourceType === "exam" ? "Test" : "Exam"} change requested by {r.requestedBy?.name || "a teacher"}
                  </p>
                  <p className="text-xs text-[#64748B] truncate">{r.reason}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setReviewRequest(r); setReviewReply(""); }}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="tests">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex mb-4">
          <TabsTrigger value="tests" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Tests</TabsTrigger>
          <TabsTrigger value="exams" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Exams</TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Results</TabsTrigger>
        </TabsList>

        {/* ── TESTS ── */}
        <TabsContent value="tests">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-[#172554]">All Tests</h2>
            <Button onClick={openAdd} size="sm" className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]">
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
            <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : exams.filter((e) => !e.scheduledExamId).length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <ClipboardList className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm text-[#64748B]">No tests yet. Create one to get started.</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-[#64748B]">No tests match your filters.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {filteredExams.map((exam) => {
                const locked = !isEditWindowOpen(exam.date);
                return (
                  <div key={exam._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#172554]">{exam.title}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">
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
            <h2 className="text-sm font-bold text-[#172554]">All Exams</h2>
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
            <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : filteredTerms.length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <GraduationCap className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm text-[#64748B]">No exams yet. Create one to schedule a multi-subject exam like Mid-Terms.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {filteredTerms.map((term) => {
                const expanded = expandedTerms.has(term._id);
                const locked = !isEditWindowOpen(term.startDate);
                return (
                  <div key={term._id} className="border-b border-[#F1F5F9] last:border-0">
                    <div className="flex items-center justify-between px-5 py-4 gap-4">
                      <button type="button" onClick={() => toggleExpandTerm(term)} className="flex items-center gap-2 min-w-0 text-left">
                        {expanded ? <ChevronDown className="h-4 w-4 text-[#64748B] shrink-0" /> : <ChevronRight className="h-4 w-4 text-[#64748B] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#172554] truncate">{term.title}</p>
                          <p className="text-xs text-[#64748B] mt-0.5">
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
                          <div className="flex items-center gap-2 text-xs text-[#64748B] py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading subjects...</div>
                        ) : term.subjects.length === 0 ? (
                          <p className="text-xs text-[#64748B] py-2">No subjects scheduled.</p>
                        ) : (
                          <div className="rounded-xl border border-[#F1F5F9] overflow-hidden">
                            {term.subjects.map((sub) => (
                              <div key={sub._id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#F1F5F9] last:border-0 gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#172554]">{sub.subject}</p>
                                  <p className="text-[11px] text-[#64748B]">
                                    {new Date(sub.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {sub.totalMarks} marks
                                    {sub.duration ? ` · ${sub.duration} min` : ""}
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
          <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] mb-4">
            <h2 className="text-sm font-bold text-[#172554] mb-1 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#4F46E5]" /> Result Entry</h2>
            <p className="text-xs text-[#64748B] mb-3">Select a class and a test or exam — enter marks and publish results.</p>
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
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <BarChart3 className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm text-[#64748B]">Pick a test or exam above to enter marks and publish results.</p>
            </div>
          ) : rLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : rSourceType === "test" ? (
            !rTestRows ? null : rTestRows.length === 0 ? (
              <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <p className="text-sm text-[#64748B]">No active students in this class.</p>
              </div>
            ) : (
              <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-[#172554]">{rTestMeta?.title}</p>
                    <p className="text-xs text-[#64748B]">{rTestMeta?.subject} · Out of {rTestMeta?.totalMarks} · {rTestRows.length} students</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleSaveAllTest} disabled={rSaving} className="gap-1.5">
                      {rSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save All
                    </Button>
                    <Button size="sm" onClick={() => handlePublishAllTest(true)} disabled={rPublishing} className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]">
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
                        <TableCell className="text-[#94A3B8]">{i + 1}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-[#172554]">{row.student.name}</p>
                          <p className="text-[11px] text-[#94A3B8]">{row.student.studentId}</p>
                        </TableCell>
                        <TableCell className="text-sm text-[#64748B]">{row.student.rollNumber || "—"}</TableCell>
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
                            <span className="text-[#94A3B8] text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.isPassed === null ? (
                            <span className="text-[#94A3B8] text-xs">—</span>
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
                            <span className="text-[#94A3B8] text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!row.resultId ? (
                            row.marksObtained !== null ? (
                              <Button size="xs" variant="outline" onClick={() => handleRowSaveAndPublish(row)} disabled={busyId === row.student._id} className="gap-1">
                                {busyId === row.student._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Save & Publish
                              </Button>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8]">Enter marks first</span>
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
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-[#64748B]">This exam has no subjects scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-[#64748B]">{rTermSubjects.length} subjects · {Object.values(rSubjectRows).flat().length} total entries</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveActiveSubject} disabled={rSaving} className="gap-1.5">
                    {rSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save {rTermSubjects.find((s) => s._id === rActiveSubjectId)?.subject || ""}
                  </Button>
                  <Button size="sm" onClick={() => handlePublishAllSubjects(true)} disabled={rPublishing} className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]">
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
                        activeTab ? "bg-[#4F46E5] text-white" : "bg-white text-[#64748B] shadow-[0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {s.subject}
                      <span className={activeTab ? "text-white/80" : "text-[#94A3B8]"}>
                        ({new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {s.totalMarks}m)
                      </span>
                      {allSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px]">{savedCount}/{rows.length}</span>}
                    </button>
                  );
                })}
              </div>

              {(rSubjectRows[rActiveSubjectId] || []).length === 0 ? (
                <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                  <p className="text-sm text-[#64748B]">No active students in this class.</p>
                </div>
              ) : (
                <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
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
                          <TableCell className="text-[#94A3B8]">{i + 1}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-[#172554]">{row.student.name}</p>
                            <p className="text-[11px] text-[#94A3B8]">{row.student.studentId}</p>
                          </TableCell>
                          <TableCell className="text-sm text-[#64748B]">{row.student.rollNumber || "—"}</TableCell>
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
                              <span className="text-[#94A3B8] text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.isPassed === null ? (
                              <span className="text-[#94A3B8] text-xs">—</span>
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
                              <span className="text-[#94A3B8] text-xs">—</span>
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
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">{editingExamId ? "Edit Test" : "New Test"}</DialogTitle>
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
            <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingExamId ? "Save Changes" : "Create Test"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Exam */}
      <Dialog open={termOpen} onOpenChange={(o) => { setTermOpen(o); if (!o) setEditingTermId(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">{editingTermId ? "Edit Exam" : "New Exam"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTermSubmit} className="space-y-3 mt-2">
            <Field label="Title" required>
              <Input placeholder="e.g. Mid-Term Exams" value={termForm.title} onChange={(e) => setTermForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" required>
                {classes.length > 0 ? (
                  <Select
                    value={termForm.class && termForm.section ? `${termForm.class}::${termForm.section}` : ""}
                    onValueChange={(v) => {
                      const cls = classes.find((c) => `${c.name}::${c.section}` === v);
                      if (cls) setTermForm((f) => ({ ...f, class: cls.name, section: cls.section }));
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
                  <Input value={termForm.class} onChange={(e) => setTermForm((f) => ({ ...f, class: e.target.value }))} required />
                )}
              </Field>
              <Field label="Type" required>
                <Select value={termForm.examType} onValueChange={(v) => setTermForm((f) => ({ ...f, examType: (v || f.examType) as TermType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                <Input type="date" value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} required />
              </Field>
              <Field label="End Date" required>
                <Input type="date" value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={termForm.description} onChange={(e) => setTermForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#172554]">Subjects</label>
                <Button type="button" size="sm" variant="outline" onClick={addTermSubjectRow} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Subject</Button>
              </div>
              <div className="space-y-2">
                {termSubjects.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] gap-2 items-end">
                    <Field label={i === 0 ? "Subject" : undefined}>
                      <Input placeholder="Mathematics" value={s.subject} onChange={(e) => updateTermSubjectRow(i, { subject: e.target.value })} />
                    </Field>
                    <Field label={i === 0 ? "Date" : undefined}>
                      <Input type="date" value={s.date} onChange={(e) => updateTermSubjectRow(i, { date: e.target.value })} />
                    </Field>
                    <Field label={i === 0 ? "Marks" : undefined}>
                      <Input type="number" min={1} value={s.totalMarks} onChange={(e) => updateTermSubjectRow(i, { totalMarks: e.target.value })} />
                    </Field>
                    <Field label={i === 0 ? "Mins" : undefined}>
                      <Input type="number" min={1} value={s.duration} onChange={(e) => updateTermSubjectRow(i, { duration: e.target.value })} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTermSubjectRow(i)} disabled={termSubjects.length === 1} className="mb-0.5">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA]" disabled={termSubmitting}>
              {termSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTermId ? "Save Changes" : "Create Exam"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">Cancel {cancelTarget?.title}</DialogTitle>
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
            <DialogTitle className="text-lg text-[#172554]">Request Change — {requestTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-[#64748B]">This starts within 2 hours, so changes need admin approval.</p>
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
              />
            </Field>
            <Field label="Reason" required>
              <Textarea rows={3} value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Why does this need to change?" />
            </Field>
            <Button onClick={submitChangeRequest} className="w-full bg-[#4F46E5] hover:bg-[#4338CA]" disabled={submittingRequest}>
              {submittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review change request (admin) */}
      <Dialog open={!!reviewRequest} onOpenChange={(o) => { if (!o) { setReviewRequest(null); setReviewReply(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554] flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#4F46E5]" /> Review Change Request</DialogTitle>
          </DialogHeader>
          {reviewRequest && (
            <div className="space-y-3 mt-2">
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs space-y-1">
                <p><span className="font-semibold text-[#172554]">Requested by:</span> {reviewRequest.requestedBy?.name || "—"}</p>
                <p><span className="font-semibold text-[#172554]">Reason:</span> {reviewRequest.reason}</p>
                <p><span className="font-semibold text-[#172554]">Change:</span> {JSON.stringify(reviewRequest.requestedChanges)}</p>
              </div>
              <Field label="Reply">
                <Textarea rows={2} value={reviewReply} onChange={(e) => setReviewReply(e.target.value)} placeholder="Optional note to the teacher (required if rejecting)." />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5 text-red-600 hover:text-red-700" onClick={() => decideRequest(false)} disabled={reviewing}>
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
                </Button>
                <Button className="flex-1 gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]" onClick={() => decideRequest(true)} disabled={reviewing}>
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-lg font-bold text-[#172554] leading-none">{value}</p>
        <p className="text-xs text-[#64748B] mt-1">{label}</p>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-semibold text-[#172554]">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
    </div>
  );
}
