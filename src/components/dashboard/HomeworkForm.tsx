"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, BookOpen, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface SubjectsResponse {
  success: boolean;
  data: SubjectOption[];
}

interface HomeworkDetail {
  title: string;
  description: string;
  subject: string;
  class: string;
  section: string;
  dueDate: string;
  maxMarks: number | null;
  attachmentUrl: string;
  attachmentName: string;
}

interface HomeworkResponse {
  success: boolean;
  data: HomeworkDetail;
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const EMPTY_FORM = { title: "", description: "", dueDate: "", maxMarks: "" };

const todayISO = () => new Date().toISOString().split("T")[0];

export function HomeworkForm({ homeworkId }: { homeworkId?: string }) {
  const router = useRouter();
  const isEdit = !!homeworkId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ url: string; name: string } | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClassOptions(res.data))
      .catch(() => toast.error("Could not load classes."))
      .finally(() => setClassLoading(false));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!selectedClassId || !token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset subject options whenever the selected class changes.
      setSubjectOptions([]);
      return;
    }
    setSubjectLoading(true);
    apiGet<SubjectsResponse>(`/subjects/class/${selectedClassId}`, token)
      .then((res) => setSubjectOptions(res.data))
      .catch(() => setSubjectOptions([]))
      .finally(() => setSubjectLoading(false));
  }, [selectedClassId]);

  useEffect(() => {
    if (!isEdit || !homeworkId) return;
    const token = getToken();
    if (!token) return;
    apiGet<HomeworkResponse>(`/homework/${homeworkId}`, token)
      .then((res) => {
        const hw = res.data;
        setForm({
          title: hw.title || "",
          description: hw.description || "",
          dueDate: hw.dueDate ? hw.dueDate.slice(0, 10) : "",
          maxMarks: hw.maxMarks != null ? String(hw.maxMarks) : "",
        });
        setSelectedSubject(hw.subject || "");
        const match = classOptions.find((c) => c.name === hw.class && c.section === (hw.section || ""));
        if (match) setSelectedClassId(match._id);
        if (hw.attachmentUrl) setExistingAttachment({ url: hw.attachmentUrl, name: hw.attachmentName || "Attachment" });
      })
      .catch(() => toast.error("Failed to load homework."))
      .finally(() => setLoading(false));
    // classOptions loads independently; once it's ready the class match above
    // re-runs because this effect also depends on it.
  }, [homeworkId, isEdit, classOptions]);

  const update = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const selectedClass = classOptions.find((c) => c._id === selectedClassId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return toast.error("Please select a class.");
    if (!selectedSubject.trim()) return toast.error("Please select or enter a subject.");
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.description.trim()) return toast.error("Instructions are required.");
    if (!form.dueDate) return toast.error("Due date is required.");
    if (!selectedClass) return;

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("subject", selectedSubject.trim());
      fd.append("class", selectedClass.name);
      fd.append("section", selectedClass.section);
      fd.append("dueDate", form.dueDate);
      if (form.maxMarks) fd.append("maxMarks", form.maxMarks);
      if (selectedFile) fd.append("file", selectedFile);
      if (isEdit && removeAttachment && !selectedFile) fd.append("removeAttachment", "true");

      const res = await fetch(isEdit ? `/api/homework/${homeworkId}` : "/api/homework", {
        method: isEdit ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save homework.");
      toast.success(isEdit ? "Homework updated." : "Homework assigned.");
      router.push("/dashboard/homework");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to save homework." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="gap-2 text-[#64748B] hover:text-[#172554] -ml-2" onClick={() => router.push("/dashboard/homework")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-[#172554]">{isEdit ? "Edit Homework" : "New Homework Assignment"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Assignment Details" icon={<BookOpen className="h-4 w-4 text-[#4F46E5]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Class" required>
              {classLoading ? (
                <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-slate-50 text-sm text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : classOptions.length === 0 ? (
                <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-red-50 text-sm text-red-600">
                  No classes found.
                </div>
              ) : (
                <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v || "")}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {classOptions.map((c) => (
                      <SelectItem key={c._id} value={c._id}>Class {c.name} - {c.section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            {selectedClassId && (
              <Field label="Subject" required>
                {subjectLoading ? (
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-slate-50 text-sm text-[#64748B]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : subjectOptions.length > 0 ? (
                  <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v || "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s._id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} placeholder="Type subject name" maxLength={100} />
                )}
              </Field>
            )}
          </div>
        </Section>

        {selectedClassId && (
          <Section title="Homework Details">
            <div className="space-y-4">
              <Field label="Title" required>
                <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Chapter 5 - Exercise 2" maxLength={200} />
              </Field>
              <Field label="Instructions" required>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe the homework task in detail..." rows={5} maxLength={1000} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Due Date" required>
                  <Input type="date" value={form.dueDate} min={todayISO()} onChange={(e) => update("dueDate", e.target.value)} />
                </Field>
                <Field label="Max Marks">
                  <Input type="number" value={form.maxMarks} onChange={(e) => update("maxMarks", e.target.value)} placeholder="Optional" min={1} max={1000} />
                </Field>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#172554]">Attachment (optional)</label>
                {existingAttachment && !removeAttachment && !selectedFile ? (
                  <div className="flex items-center gap-2 p-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                    <FileText className="h-4 w-4 text-[#4F46E5] shrink-0" />
                    <a href={existingAttachment.url} target="_blank" rel="noreferrer" className="text-sm flex-1 truncate text-[#4F46E5] hover:underline">
                      {existingAttachment.name}
                    </a>
                    <button type="button" onClick={() => setRemoveAttachment(true)}>
                      <X className="h-4 w-4 text-[#64748B] hover:text-red-600" />
                    </button>
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center gap-2 p-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                    <FileText className="h-4 w-4 text-[#4F46E5] shrink-0" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <button type="button" onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                      <X className="h-4 w-4 text-[#64748B] hover:text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center cursor-pointer hover:border-[#4F46E5]/40 hover:bg-[#F8FAFC] transition-all"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-[#94A3B8]" />
                    <p className="text-sm text-[#64748B]">Click to attach a document or sheet</p>
                    <p className="text-xs text-[#94A3B8] mt-1">PDF, DOC, PPT, XLS up to 20 MB</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 20 * 1024 * 1024) {
                      toast.error("File must be under 20 MB.");
                      return;
                    }
                    setSelectedFile(f || null);
                    setRemoveAttachment(false);
                  }}
                />
              </div>
            </div>
          </Section>
        )}

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/homework")}>Cancel</Button>
          <Button type="submit" disabled={saving || classLoading || classOptions.length === 0 || !selectedClassId} className="gap-2 bg-[#4F46E5] hover:bg-[#4338CA]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : isEdit ? "Update Homework" : "Assign Homework"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-white p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(79,70,229,0.15)]">
      <h3 className="text-sm font-bold text-[#172554] mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#172554]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
