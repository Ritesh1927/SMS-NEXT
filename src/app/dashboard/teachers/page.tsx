"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeacherRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  teacherId: string;
  designation?: string;
  subjects?: string[];
  staffType: string;
  isActive: boolean;
}

interface TeachersResponse {
  success: boolean;
  count: number;
  data: TeacherRow[];
}

interface CreateTeacherResponse {
  success: boolean;
  message: string;
  tempPassword: string;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  designation: "",
  subjects: "",
  qualification: "",
  employmentType: "full-time",
  gender: "male",
};

export default function TeachersPage() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<TeachersResponse>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load teachers."));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          subjects: form.subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const json: CreateTeacherResponse & { message?: string } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to create teacher.");
      toast.success("Teacher added", { description: `Temporary password: ${json.tempPassword} (also emailed).` });
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to create teacher." });
    } finally {
      setSubmitting(false);
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
        <Button onClick={() => setOpen(true)} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
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
            <div key={t._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0">
              <div>
                <p className="text-sm font-semibold text-[#172554]">{t.name}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {t.teacherId} · {t.designation || (t.staffType === "teaching" ? "Teacher" : "Staff")}
                  {t.subjects && t.subjects.length > 0 ? ` · ${t.subjects.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {t.email}
                </span>
                {t.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {t.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">Add Teacher</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Teacher"}
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
