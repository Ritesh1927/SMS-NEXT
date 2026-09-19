"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Camera } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface StudentDetail {
  name: string;
  class: string;
  section: string;
  rollNumber: string;
  phone: string;
  parent: { name: string; motherName?: string; motherPhone?: string; email: string; phone?: string; occupation?: string; motherOccupation?: string } | null;
  address: string;
  dateOfBirth: string | null;
  gender: string;
  bloodGroup: string;
  admissionDate: string | null;
  admissionNo: string;
  previousSchool: string;
  aadhaarNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelation: string;
  religion: string;
  category: string;
  photo: string;
}

interface StudentResponse {
  success: boolean;
  data: StudentDetail;
}

interface ParentLookupResponse {
  success: boolean;
  found: boolean;
  data?: {
    name: string; motherName: string; motherPhone: string; phone: string; relation: string;
    occupation: string; motherOccupation: string;
    address: string; emergencyContact: string; emergencyPhone: string; emergencyRelation: string;
    religion: string; category: string;
  };
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  parentTempPassword?: string | null;
}

const EMPTY_FORM = {
  name: "", studentClass: "", section: "", rollNumber: "",
  phone: "", parentName: "", motherName: "", motherPhone: "", parentEmail: "", parentPhone: "",
  fatherOccupation: "", motherOccupation: "",
  address: "", dateOfBirth: "", gender: "male", bloodGroup: "",
  admissionDate: "", admissionNo: "", previousSchool: "", aadhaarNumber: "",
  emergencyContact: "", emergencyPhone: "", emergencyRelation: "",
  religion: "", category: "",
};

const todayISO = () => new Date().toISOString().split("T")[0];

export function StudentForm({ studentId }: { studentId?: string }) {
  const router = useRouter();
  const isEdit = !!studentId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const lastCheckedParentEmail = useRef<string | null>(null);
  const [checkingParentEmail, setCheckingParentEmail] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClassOptions(res.data))
      .catch(() => toast.error("Could not load classes."))
      .finally(() => setClassLoading(false));
  }, []);

  useEffect(() => {
    if (!isEdit || !studentId) return;
    const token = getToken();
    if (!token) return;
    apiGet<StudentResponse>(`/students/${studentId}`, token)
      .then((res) => {
        const s = res.data;
        setForm({
          name: s.name || "", studentClass: s.class || "", section: s.section || "",
          rollNumber: s.rollNumber || "", phone: s.phone || "",
          parentName: s.parent?.name || "", motherName: s.parent?.motherName || "",
          motherPhone: s.parent?.motherPhone || "",
          parentEmail: s.parent?.email || "",
          parentPhone: s.parent?.phone || "", address: s.address || "",
          fatherOccupation: s.parent?.occupation || "", motherOccupation: s.parent?.motherOccupation || "",
          dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : "",
          gender: s.gender || "male", bloodGroup: s.bloodGroup || "",
          admissionDate: s.admissionDate ? s.admissionDate.slice(0, 10) : "",
          admissionNo: s.admissionNo || "", previousSchool: s.previousSchool || "",
          aadhaarNumber: s.aadhaarNumber || "",
          emergencyContact: s.emergencyContact || "", emergencyPhone: s.emergencyPhone || "",
          emergencyRelation: s.emergencyRelation || "",
          religion: s.religion || "", category: s.category || "",
        });
        setPhotoPreview(s.photo || "");
      })
      .catch(() => toast.error("Failed to load student."))
      .finally(() => setLoading(false));
  }, [studentId, isEdit]);

  const update = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const classSelectValue = form.studentClass ? `${form.studentClass}::${form.section}` : "";

  const handleClassChange = (key: string | null) => {
    const cls = classOptions.find((c) => `${c.name}::${c.section}` === key);
    if (cls) {
      update("studentClass", cls.name);
      update("section", cls.section);
    }
  };

  // If this email already belongs to a parent in the school (e.g. admitting
  // a second child), pull in their details instead of making the admin
  // retype them — and instead of risking a second Parent record, since
  // parent email is how they log in and must stay unique per school.
  const handleParentEmailBlur = async () => {
    if (isEdit) return;
    const email = form.parentEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || lastCheckedParentEmail.current === email.toLowerCase()) return;
    lastCheckedParentEmail.current = email.toLowerCase();

    const token = getToken();
    if (!token) return;
    setCheckingParentEmail(true);
    try {
      const res = await apiGet<ParentLookupResponse>(`/parents/lookup?email=${encodeURIComponent(email)}`, token);
      if (res.found && res.data) {
        const d = res.data;
        setForm((f) => ({
          ...f,
          parentName: d.name || f.parentName,
          motherName: d.motherName || f.motherName,
          motherPhone: d.motherPhone || f.motherPhone,
          parentPhone: d.phone || f.parentPhone,
          fatherOccupation: d.occupation || f.fatherOccupation,
          motherOccupation: d.motherOccupation || f.motherOccupation,
          address: d.address || f.address,
          emergencyContact: d.emergencyContact || f.emergencyContact,
          emergencyPhone: d.emergencyPhone || f.emergencyPhone,
          emergencyRelation: d.emergencyRelation || f.emergencyRelation,
          religion: d.religion || f.religion,
          category: d.category || f.category,
        }));
        toast.success("Existing parent found", { description: "Filled in their household details — you can still edit anything before saving." });
      }
    } catch {
      // Silent — a failed lookup shouldn't block the admin from typing the rest of the form.
    } finally {
      setCheckingParentEmail(false);
    }
  };

  // For an existing student the photo uploads immediately (independent of
  // the rest of the form); for a new one there's no id yet, so the file is
  // just held and uploaded right after creation succeeds in handleSubmit.
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    if (isEdit && studentId) {
      const token = getToken();
      if (!token) return;
      setUploadingPhoto(true);
      try {
        const fd = new FormData();
        fd.append("photo", file);
        const res = await fetch(`/api/students/${studentId}/photo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json: ApiMessageResponse & { data?: { photo: string } } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to upload photo.");
        if (json.data?.photo) setPhotoPreview(json.data.photo);
        toast.success("Photo updated.");
      } catch (err) {
        toast.error("Error", { description: err instanceof Error ? err.message : "Failed to upload photo." });
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Student name is required.");
    if (!form.dateOfBirth) return toast.error("Date of birth is required.");
    if (!form.studentClass) return toast.error("Please select a class.");
    if (!form.rollNumber.trim()) return toast.error("Roll number is required.");
    if (!form.parentName.trim()) return toast.error("Father's name is required.");
    if (!form.motherName.trim()) return toast.error("Mother's name is required.");
    if (!form.parentPhone) return toast.error("Parent phone is required.");
    if (!form.parentEmail.trim()) return toast.error("Parent email is required.");
    if (!form.admissionDate) return toast.error("Admission date is required.");
    if (new Date(form.admissionDate) > new Date()) return toast.error("Admission date cannot be a future date.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.parentEmail)) return toast.error("Invalid parent email format.");
    if (form.phone && !/^\d{10}$/.test(form.phone)) return toast.error("Student phone must be exactly 10 digits.");
    if (!/^\d{10}$/.test(form.parentPhone)) return toast.error("Parent phone must be exactly 10 digits.");
    if (new Date(form.dateOfBirth) > new Date()) return toast.error("Date of birth cannot be in the future.");
    if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber)) return toast.error("Aadhaar must be exactly 12 digits.");
    if (form.emergencyPhone && !/^\d{10}$/.test(form.emergencyPhone)) return toast.error("Emergency phone must be exactly 10 digits.");

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      if (isEdit && studentId) {
        const res = await fetch(`/api/students/${studentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, class: form.studentClass }),
        });
        const json: ApiMessageResponse = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save student.");
        toast.success("Student updated.");
      } else {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        const json: ApiMessageResponse & { data?: { _id: string } } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save student.");
        toast.success("Student added.", {
          description: json.parentTempPassword
            ? `Parent account created. Temporary password: ${json.parentTempPassword} (also emailed).`
            : "Linked to existing parent account.",
        });
        const newId = json.data?._id;
        if (photoFile && newId) {
          try {
            const fd = new FormData();
            fd.append("photo", photoFile);
            await fetch(`/api/students/${newId}/photo`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: fd,
            });
          } catch {
            toast.error("Student created, but the photo upload failed — you can add it from Edit.");
          }
        }
      }
      router.push("/dashboard/students");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to save student." });
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="gap-2 text-[#64748B] hover:text-[#172554] -ml-2" onClick={() => router.push("/dashboard/students")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-[#172554]">{isEdit ? "Edit Student" : "Add New Student"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Basic Information">
          <div className="flex items-center gap-4 mb-5">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border-2 border-[#E2E8F0]">
                <AvatarImage src={photoPreview} alt={form.name} />
                <AvatarFallback className="bg-[#EEF2FF] text-[#4F46E5] text-lg font-semibold">
                  {form.name ? form.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shadow-md hover:bg-[#4338CA] transition-colors disabled:opacity-60"
                aria-label="Change photo"
              >
                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoSelect} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#172554]">Profile Photo</p>
              <p className="text-xs text-[#64748B]">{isEdit ? "Click the camera icon to change it." : "Optional — click the camera icon to add one."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Student name" maxLength={100} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Phone" inputMode="numeric" maxLength={10} />
            </Field>
            <Field label="Gender" required>
              <Select value={form.gender} onValueChange={(v) => update("gender", v || form.gender)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of Birth" required>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} max={todayISO()} required />
            </Field>
            <Field label="Blood Group">
              <Select value={form.bloodGroup} onValueChange={(v) => update("bloodGroup", v || "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email" required>
              <div className="relative">
                <Input
                  value={form.parentEmail}
                  onChange={(e) => update("parentEmail", e.target.value)}
                  onBlur={handleParentEmailBlur}
                  placeholder="parent@email.com"
                  type="email"
                  maxLength={255}
                  required
                />
                {checkingParentEmail && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#94A3B8]" />
                )}
              </div>
              {!isEdit && (
                <p className="text-xs text-[#64748B]">Already a parent here? Enter their email to link this as a sibling.</p>
              )}
            </Field>
          </div>
        </Section>

        <Section title="Class Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-[#172554]">Class <span className="text-red-500">*</span></label>
              <Select value={classSelectValue} onValueChange={handleClassChange} disabled={classLoading}>
                <SelectTrigger className="w-full"><SelectValue placeholder={classLoading ? "Loading classes..." : "Select class"} /></SelectTrigger>
                <SelectContent>
                  {classOptions.length === 0 && !classLoading && <SelectItem value="__none__" disabled>No classes found.</SelectItem>}
                  {classOptions.map((c) => (
                    <SelectItem key={c._id} value={`${c.name}::${c.section}`}>Class {c.name} - {c.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Roll Number" required>
              <Input value={form.rollNumber} onChange={(e) => update("rollNumber", e.target.value)} placeholder="Roll number" maxLength={20} required />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Address" maxLength={200} />
            </Field>
          </div>
        </Section>

        <Section title="Parent / Guardian">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Father Name" required>
              <Input value={form.parentName} onChange={(e) => update("parentName", e.target.value)} placeholder="Father's name" maxLength={100} required />
            </Field>
            <Field label="Father Mobile No" required>
              <Input value={form.parentPhone} onChange={(e) => update("parentPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Father's phone" inputMode="numeric" maxLength={10} required />
            </Field>
            <Field label="Father Occupation">
              <Input value={form.fatherOccupation} onChange={(e) => update("fatherOccupation", e.target.value)} placeholder="Father's occupation" maxLength={100} />
            </Field>
            <Field label="Mother Name" required>
              <Input value={form.motherName} onChange={(e) => update("motherName", e.target.value)} placeholder="Mother's name" maxLength={100} required />
            </Field>
            <Field label="Mother Mobile No">
              <Input value={form.motherPhone} onChange={(e) => update("motherPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mother's phone" inputMode="numeric" maxLength={10} />
            </Field>
            <Field label="Mother Occupation">
              <Input value={form.motherOccupation} onChange={(e) => update("motherOccupation", e.target.value)} placeholder="Mother's occupation" maxLength={100} />
            </Field>
          </div>
        </Section>

        <Section title="Admission Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Admission Date" required>
              <Input
                type="date"
                value={form.admissionDate}
                onChange={(e) => update("admissionDate", e.target.value)}
                disabled={isEdit}
                className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
                required
                max={todayISO()}
              />
              {isEdit && <p className="text-xs text-[#64748B] mt-1">Admission date cannot be changed after creation.</p>}
            </Field>
            <Field label="Admission No">
              <Input value={form.admissionNo} placeholder="Auto-generated on save" disabled maxLength={30} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Previous School">
                <Input value={form.previousSchool} onChange={(e) => update("previousSchool", e.target.value)} placeholder="Previous school name" maxLength={100} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Documents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Aadhaar Number">
              <Input value={form.aadhaarNumber} onChange={(e) => update("aadhaarNumber", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12-digit Aadhaar" inputMode="numeric" maxLength={12} />
            </Field>
          </div>
        </Section>

        <Section title="Emergency Contact">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Contact Name">
              <Input value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} placeholder="Contact name" maxLength={100} />
            </Field>
            <Field label="Contact Phone">
              <Input value={form.emergencyPhone} onChange={(e) => update("emergencyPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Phone" inputMode="numeric" maxLength={10} />
            </Field>
            <Field label="Relationship">
              <Select value={form.emergencyRelation} onValueChange={(v) => update("emergencyRelation", v || "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["Father", "Mother", "Guardian", "Uncle", "Aunt", "Sibling", "Other"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Category">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Religion">
              <Select value={form.religion} onValueChange={(v) => update("religion", v || "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => update("category", v || "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["General", "OBC", "SC", "ST", "EWS", "Other"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/students")}>Cancel</Button>
          <Button type="submit" disabled={saving || classLoading || !form.studentClass} className="gap-2 bg-[#4F46E5] hover:bg-[#4338CA]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : isEdit ? "Update Student" : "Add Student"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-white p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(79,70,229,0.15)]">
      <h3 className="text-sm font-bold text-[#172554] mb-4">{title}</h3>
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
