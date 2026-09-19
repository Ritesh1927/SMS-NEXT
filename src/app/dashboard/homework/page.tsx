"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil, ClipboardCheck, BookOpen, CheckCircle2, Upload, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";

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
  attachmentUrl?: string;
  attachmentName?: string;
  assignedBy?: { _id: string; name: string } | null;
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

export default function HomeworkPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [homework, setHomework] = useState<HomeworkRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gradingHw, setGradingHw] = useState<HomeworkRow | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [savingGradeFor, setSavingGradeFor] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "expired">("");
  // Snapshot once on mount rather than calling Date.now() during render (impure).
  const [now] = useState(() => Date.now());

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
    if (user?.role === "parent") return;
    load();
  }, [user?.role]);

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

  if (user.role === "parent") {
    return <ParentHomework />;
  }

  const filteredHomework = (homework || []).filter((hw) => {
    if (search) {
      const q = search.toLowerCase();
      if (!hw.title.toLowerCase().includes(q) && !hw.subject.toLowerCase().includes(q)) return false;
    }
    if (classFilter && hw.class !== classFilter) return false;
    if (statusFilter) {
      const isExpired = new Date(hw.dueDate).getTime() < now;
      if (statusFilter === "expired" && !isExpired) return false;
      if (statusFilter === "active" && isExpired) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        icon={BookOpen}
        title="Homework"
        subtitle={`${(homework || []).length} assignment${(homework || []).length === 1 ? "" : "s"} total.`}
        accent="violet"
        actions={
          <Button onClick={() => router.push("/dashboard/homework/new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Assignment
          </Button>
        }
        className="mb-6"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {homework && homework.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Search by title or subject..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c.name}>Class {c.name}-{c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v || "") as typeof statusFilter)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {error ? null : !homework ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : homework.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <BookOpen className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
          <p className="text-sm text-[#64748B]">No homework assigned yet.</p>
        </div>
      ) : filteredHomework.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No homework matches your filters.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {filteredHomework.map((hw) => (
            <div key={hw._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#172554]">{hw.title}</p>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      new Date(hw.dueDate).getTime() < now ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {new Date(hw.dueDate).getTime() < now ? "Expired" : "Active"}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Class {hw.class}
                  {hw.section ? `-${hw.section}` : ""} · {hw.subject} · Due{" "}
                  {new Date(hw.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                  {hw.submissions.length}/{hw.totalStudents} submitted
                </p>
                {hw.totalStudents > 0 && (
                  <div className="w-full max-w-xs h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]"
                      style={{ width: `${Math.min(100, (hw.submissions.length / hw.totalStudents) * 100)}%` }}
                    />
                  </div>
                )}
                {hw.attachmentUrl && (
                  <a
                    href={hw.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#4F46E5] hover:underline mt-2"
                  >
                    <Paperclip className="h-3 w-3" /> {hw.attachmentName || "Attachment"}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => openGrading(hw)} aria-label="Submissions">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                </Button>
                {(user?.role === "schooladmin" || hw.assignedBy?._id === user?.id) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/homework/${hw._id}/edit`)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
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
                          className="bg-[#4F46E5] hover:bg-[#4338CA]"
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

interface ChildOption {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

interface ParentDashboardResponse {
  success: boolean;
  data: { children: ChildOption[] };
}

interface ChildHomeworkItem {
  _id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  maxMarks: number | null;
  assignedBy?: { name: string } | null;
  attachmentUrl?: string;
  attachmentName?: string;
  submission: { status: "submitted" | "late" | "graded"; marks: number | null; feedback: string; submittedAt: string } | null;
}

interface ChildHomeworkResponse {
  success: boolean;
  data: ChildHomeworkItem[];
}

function ParentHomework() {
  const [children, setChildren] = useState<ChildOption[] | null>(null);
  const [childId, setChildId] = useState("");
  const [items, setItems] = useState<ChildHomeworkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentDashboardResponse>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setChildId(res.data.children[0]._id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load children."));
  }, []);

  const load = () => {
    if (!childId) return;
    const token = getToken();
    if (!token) return;
    apiGet<ChildHomeworkResponse>(`/homework/student/${childId}`, token)
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load homework."));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever the selected child changes.
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const handleSubmit = async (hw: ChildHomeworkItem) => {
    const token = getToken();
    if (!token) return;
    setSubmittingId(hw._id);
    try {
      const res = await fetch(`/api/homework/${hw._id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: childId }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit.");
      toast.success(json.message || "Submitted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmittingId(null);
    }
  };

  const selectedChild = children?.find((c) => c._id === childId) || null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <PageHeader icon={BookOpen} title="Homework" subtitle="Assignments for your child." accent="violet" />
        {children && children.length > 1 && (
          <Select value={childId} onValueChange={(v) => setChildId(v || "")}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select a child" /></SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name} — Class {c.class}{c.section ? `-${c.section}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedChild && children && children.length === 1 && (
          <div className="rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] px-4 py-2 text-sm">
            <span className="font-semibold text-[#172554]">{selectedChild.name}</span>
            <span className="text-[#64748B]"> — Class {selectedChild.class}{selectedChild.section ? `-${selectedChild.section}` : ""}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {error ? null : children === null || (childId && !items) ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No children linked to your account yet.</p>
        </div>
      ) : !items || items.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <BookOpen className="h-6 w-6 text-[#94A3B8] mx-auto mb-2" />
          <p className="text-sm text-[#64748B]">No homework assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((hw) => {
            const isExpired = new Date(hw.dueDate).getTime() < now;
            return (
              <div key={hw._id} className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#172554]">{hw.title}</p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isExpired ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {isExpired ? "Expired" : "Active"}
                      </span>
                      {hw.submission && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            hw.submission.status === "graded" ? "bg-blue-100 text-blue-700" : hw.submission.status === "late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {hw.submission.status === "graded" ? "Graded" : hw.submission.status === "late" ? "Submitted late" : "Submitted"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {hw.subject} · Due {new Date(hw.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {hw.maxMarks ? ` · ${hw.maxMarks} marks` : ""}
                      {hw.assignedBy ? ` · Assigned by ${hw.assignedBy.name}` : ""}
                    </p>
                    {hw.description && <p className="text-sm text-[#475569] mt-2">{hw.description}</p>}
                    {hw.attachmentUrl && (
                      <a
                        href={hw.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#4F46E5] hover:underline mt-2"
                      >
                        <Paperclip className="h-3 w-3" /> {hw.attachmentName || "Attachment"}
                      </a>
                    )}
                    {hw.submission?.status === "graded" && (
                      <p className="text-xs text-[#4F46E5] font-semibold mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Scored {hw.submission.marks}{hw.maxMarks ? ` / ${hw.maxMarks}` : ""}
                        {hw.submission.feedback ? ` — ${hw.submission.feedback}` : ""}
                      </p>
                    )}
                  </div>
                  {!hw.submission && (
                    <Button
                      size="sm"
                      onClick={() => handleSubmit(hw)}
                      disabled={submittingId === hw._id}
                      className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] shrink-0"
                    >
                      {submittingId === hw._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Mark Submitted
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
