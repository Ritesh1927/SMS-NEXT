"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StudentRow {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  parent?: { name: string; email: string; phone?: string } | null;
}

interface StudentsResponse {
  success: boolean;
  count: number;
  data: StudentRow[];
}

interface CreateStudentResponse {
  success: boolean;
  message?: string;
  parentTempPassword?: string | null;
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  studentClass: "",
  section: "",
  rollNumber: "",
  dateOfBirth: "",
  gender: "male",
  admissionDate: "",
  parentName: "",
  motherName: "",
  parentPhone: "",
  motherPhone: "",
  parentEmail: "",
  parentRelation: "father",
};

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<StudentsResponse>("/students", token)
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load students."));
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
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json: CreateStudentResponse & { message?: string } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to create student.");
      toast.success("Student added", {
        description: json.parentTempPassword
          ? `Parent account created. Temporary password: ${json.parentTempPassword} (also emailed).`
          : "Linked to existing parent account.",
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to create student." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Students</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage student admissions and records.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
          <Plus className="h-4 w-4" /> Add Student
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!students ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No students yet. Add your first admission to get started.</p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {students.map((s) => (
            <div key={s._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0">
              <div>
                <p className="text-sm font-semibold text-[#172554]">{s.name}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {s.studentId} · Class {s.class}
                  {s.section ? `-${s.section}` : ""} · Roll {s.rollNumber || "—"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <User className="h-3.5 w-3.5" /> {s.parent?.name || "No parent linked"}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">Add Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-2">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Student Details</p>
                <Field label="Full Name" required>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Class" required>
                    <Input value={form.studentClass} onChange={(e) => setForm((f) => ({ ...f, studentClass: e.target.value }))} required />
                  </Field>
                  <Field label="Section">
                    <Input value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Roll Number" required>
                    <Input value={form.rollNumber} onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))} required />
                  </Field>
                  <Field label="Phone (10 digits)" required>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required maxLength={10} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date of Birth" required>
                    <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} required />
                  </Field>
                  <Field label="Admission Date" required>
                    <Input type="date" value={form.admissionDate} onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))} required />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Parent / Guardian</p>
                <Field label="Father's Name" required>
                  <Input value={form.parentName} onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))} required />
                </Field>
                <Field label="Mother's Name" required>
                  <Input value={form.motherName} onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))} required />
                </Field>
                <Field label="Parent Email" required>
                  <Input type="email" value={form.parentEmail} onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Parent Phone" required>
                    <Input value={form.parentPhone} onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))} required maxLength={10} />
                  </Field>
                  <Field label="Mother's Phone">
                    <Input value={form.motherPhone} onChange={(e) => setForm((f) => ({ ...f, motherPhone: e.target.value }))} maxLength={10} />
                  </Field>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full mt-5 bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Student"}
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
