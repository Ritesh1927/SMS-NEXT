"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Save, Camera, School, X, UserRound, UserCog, Briefcase, FileBadge, Landmark, Siren, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PageLoader } from "@/components/PageLoader";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
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

interface TeacherDetail {
  name: string;
  email: string;
  phone: string;
  qualification: string;
  experience: string;
  designation: string;
  staffType: string;
  department: string;
  subjects: string[];
  primarySubject: string;
  secondarySubject: string;
  gender: string;
  dateOfBirth: string | null;
  address: string;
  bloodGroup: string;
  joiningDate: string | null;
  salary: number | string;
  employmentType: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelation: string;
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  specialization: string;
  previousExperience: string;
  assignedClasses?: ClassOption[];
  photo: string;
}

interface TeacherResponse {
  success: boolean;
  data: TeacherDetail;
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  tempPassword?: string;
}

const EMPTY_FORM = {
  name: "", email: "", phone: "", qualification: "", experience: "", designation: "Teacher",
  staffType: "teaching", department: "",
  subjects: "",
  primarySubject: "", secondarySubject: "",
  gender: "male", dateOfBirth: "", address: "", bloodGroup: "",
  joiningDate: "", salary: "", employmentType: "full-time",
  emergencyContact: "", emergencyPhone: "", emergencyRelation: "",
  aadhaarNumber: "", panNumber: "",
  bankName: "", accountNumber: "", ifscCode: "",
  specialization: "", previousExperience: "",
};

const todayISO = () => new Date().toISOString().split("T")[0];

export function TeacherForm({ teacherId }: { teacherId?: string }) {
  const router = useRouter();
  const isEdit = !!teacherId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClassOptions(res.data))
      .catch(() => toast.error("Could not load classes."))
      .finally(() => setClassLoading(false));
    apiGet<SubjectsResponse>("/subjects", token)
      .then((res) => setSubjectOptions(res.data))
      .catch(() => toast.error("Could not load subjects."));
  }, []);

  useEffect(() => {
    if (!isEdit || !teacherId) return;
    const token = getToken();
    if (!token) return;
    apiGet<TeacherResponse>(`/teachers/${teacherId}`, token)
      .then((res) => {
        const t = res.data;
        setForm({
          name: t.name || "", email: t.email || "", phone: t.phone || "",
          qualification: t.qualification || "", experience: t.experience || "",
          designation: t.designation || "Teacher",
          staffType: t.staffType || "teaching", department: t.department || "",
          subjects: (t.subjects || []).join(", "),
          primarySubject: t.primarySubject || "",
          secondarySubject: t.secondarySubject || "",
          gender: t.gender || "male",
          dateOfBirth: t.dateOfBirth ? t.dateOfBirth.slice(0, 10) : "",
          address: t.address || "", bloodGroup: t.bloodGroup || "",
          joiningDate: t.joiningDate ? t.joiningDate.slice(0, 10) : "",
          salary: t.salary != null ? String(t.salary) : "", employmentType: t.employmentType || "full-time",
          emergencyContact: t.emergencyContact || "", emergencyPhone: t.emergencyPhone || "",
          emergencyRelation: t.emergencyRelation || "",
          aadhaarNumber: t.aadhaarNumber || "", panNumber: t.panNumber || "",
          bankName: t.bankName || "", accountNumber: t.accountNumber || "",
          ifscCode: t.ifscCode || "",
          specialization: t.specialization || "", previousExperience: t.previousExperience || "",
        });
        setSelectedClassIds((t.assignedClasses || []).map((c) => c._id));
        setPhotoPreview(t.photo || "");
      })
      .catch(() => toast.error("Failed to load teacher."))
      .finally(() => setLoading(false));
  }, [teacherId, isEdit]);

  const update = (key: keyof typeof EMPTY_FORM, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const toggleClass = (cid: string) => {
    setSelectedClassIds((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));
  };

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

    if (isEdit && teacherId) {
      const token = getToken();
      if (!token) return;
      setUploadingPhoto(true);
      try {
        const fd = new FormData();
        fd.append("photo", file);
        const res = await fetch(`/api/teachers/${teacherId}/photo`, {
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
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.email.trim()) return toast.error("Email is required.");
    if (form.staffType === "teaching" && !form.primarySubject) return toast.error("Primary subject is required.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return toast.error("Invalid email format.");
    if (form.phone && !/^\d{10}$/.test(form.phone)) return toast.error("Phone must be exactly 10 digits.");
    if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date()) return toast.error("Date of birth cannot be in the future.");
    if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber)) return toast.error("Aadhaar must be exactly 12 digits.");
    if (form.emergencyPhone && !/^\d{10}$/.test(form.emergencyPhone)) return toast.error("Emergency phone must be exactly 10 digits.");
    if (!isEdit && form.joiningDate && new Date(form.joiningDate) < new Date(new Date().toDateString())) return toast.error("Joining date cannot be a past date.");
    if (form.accountNumber && (form.accountNumber.length < 9 || form.accountNumber.length > 18)) {
      return toast.error("Account number should be 9-18 digits.");
    }
    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      return toast.error("Invalid IFSC code format (e.g. SBIN0001234).");
    }

    const bankFieldsFilled = [form.bankName, form.accountNumber, form.ifscCode].filter(Boolean).length;
    if (bankFieldsFilled > 0 && bankFieldsFilled < 3) {
      return toast.error("Fill in all bank details (name, account number, IFSC) or leave them all blank.");
    }

    const emergencyFieldsFilled = [form.emergencyContact, form.emergencyPhone, form.emergencyRelation].filter(Boolean).length;
    if (emergencyFieldsFilled > 0 && emergencyFieldsFilled < 3) {
      return toast.error("Fill in all emergency contact details or leave them all blank.");
    }

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        designation: form.staffType === "teaching" ? "Teacher" : (form.designation || "Staff"),
        subjects: form.staffType === "teaching" && form.subjects ? form.subjects.split(",").map((s) => s.trim()).filter(Boolean) : [],
        primarySubject: form.staffType === "teaching" ? form.primarySubject : "",
        secondarySubject: form.staffType === "teaching" ? form.secondarySubject : "",
        salary: form.salary ? Number(form.salary) : 0,
        classIds: form.staffType === "teaching" ? selectedClassIds : [],
      };
      if (isEdit && teacherId) {
        const res = await fetch(`/api/teachers/${teacherId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const json: ApiMessageResponse = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save teacher.");
        toast.success("Teacher updated.");
      } else {
        const res = await fetch("/api/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const json: ApiMessageResponse & { data?: { _id: string } } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save teacher.");
        toast.success("Staff added.", { description: `Temporary password: ${json.tempPassword} (also emailed).` });
        const newId = json.data?._id;
        if (photoFile && newId) {
          try {
            const fd = new FormData();
            fd.append("photo", photoFile);
            await fetch(`/api/teachers/${newId}/photo`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: fd,
            });
          } catch {
            toast.error("Staff created, but the photo upload failed — you can add it from Edit.");
          }
        }
      }
      router.push("/dashboard/teachers");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to save teacher." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader label="Loading..." />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground -ml-2" onClick={() => router.push("/dashboard/teachers")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? "Edit Staff" : "Add New Staff"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Staff Type" icon={UserCog}>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => !isEdit && update("staffType", "teaching")}
              disabled={isEdit}
              className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                form.staffType === "teaching"
                  ? "border-primary bg-primary/10 text-primary"
                  : isEdit
                  ? "border-border bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              Teaching Staff
            </button>
            <button
              type="button"
              onClick={() => !isEdit && update("staffType", "non-teaching")}
              disabled={isEdit}
              className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                form.staffType === "non-teaching"
                  ? "border-primary bg-primary/10 text-primary"
                  : isEdit
                  ? "border-border bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              Non-Teaching Staff
            </button>
          </div>
          {isEdit && <p className="text-xs text-muted-foreground mt-2">Staff type cannot be changed after creation.</p>}
          {form.staffType === "non-teaching" && (
            <div className="mt-4 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Department</label>
              <Select
                value={form.department}
                onValueChange={(v) => {
                  const dept = v || "";
                  update("department", dept);
                  const deptJobMap: Record<string, string> = {
                    Administration: "Administrator",
                    Accounts: "Accountant",
                    Library: "Librarian",
                    Lab: "Lab Assistant",
                    Office: "Office Staff",
                    Transport: "Transport Incharge",
                    Canteen: "Canteen Staff",
                    Security: "Security Guard",
                    Other: "Staff",
                  };
                  update("designation", deptJobMap[dept] || "");
                }}
                disabled={isEdit}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {["Administration", "Accounts", "Library", "Lab", "Office", "Transport", "Canteen", "Security", "Other"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Section>

        <Section title="Basic Information" icon={UserRound}>
          <div className="flex items-center gap-4 mb-5">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={photoPreview} alt={form.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {form.name ? form.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                aria-label="Change photo"
              >
                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoSelect} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Profile Photo</p>
              <p className="text-xs text-muted-foreground">{isEdit ? "Click the camera icon to change it." : "Optional — click the camera icon to add one."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Staff name" maxLength={100} required />
            </Field>
            <Field label="Email" required>
              <Input
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="staff@email.com"
                type="email"
                maxLength={255}
                required
                disabled={isEdit}
                className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
              />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Phone" inputMode="numeric" maxLength={10} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => update("gender", v || form.gender)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of Birth">
              <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} max={todayISO()} />
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
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Address" maxLength={200} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Employment Details" icon={Briefcase}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job Title">
              <Input value={form.designation} placeholder="Job title" maxLength={50} disabled className="opacity-60 cursor-not-allowed" />
            </Field>
            <Field label="Qualification">
              <Input value={form.qualification} onChange={(e) => update("qualification", e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))} placeholder="e.g. BSc, MSc, B.Ed" maxLength={100} />
            </Field>
            <Field label="Experience">
              <Input value={form.experience} onChange={(e) => update("experience", e.target.value)} placeholder="e.g. 5 years" maxLength={20} />
            </Field>
            <Field label="Specialization">
              <Input value={form.specialization} onChange={(e) => update("specialization", e.target.value)} placeholder="e.g. Mathematics, Science" maxLength={100} />
            </Field>
            <Field label="Joining Date">
              <Input
                type="date"
                value={form.joiningDate}
                onChange={(e) => update("joiningDate", e.target.value)}
                min={todayISO()}
                disabled={isEdit}
                className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
              />
            </Field>
            <Field label="Salary (₹)">
              <Input value={form.salary} onChange={(e) => update("salary", e.target.value.replace(/\D/g, ""))} placeholder="Monthly salary" inputMode="numeric" />
            </Field>
            <Field label="Employment Type">
              <Select value={form.employmentType} onValueChange={(v) => update("employmentType", v || form.employmentType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Previous Organization">
              <Input value={form.previousExperience} onChange={(e) => update("previousExperience", e.target.value)} placeholder="Previous organization name" maxLength={200} />
            </Field>
          </div>
        </Section>

        {form.staffType === "teaching" && (
          <Section title="Classes & Subject" icon={School}>
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
              <School className="h-4 w-4 text-primary" /> Assign Classes
            </label>
            {classLoading ? (
              <p className="text-xs text-muted-foreground">Loading classes...</p>
            ) : classOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No classes found. Create classes first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {classOptions.map((c) => {
                  const selected = selectedClassIds.includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleClass(c._id)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selected ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {c.name}-{c.section}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedClassIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{selectedClassIds.length} class{selectedClassIds.length > 1 ? "es" : ""} selected</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <Field label="Primary Subject" required>
                <Select value={form.primarySubject} onValueChange={(v) => update("primarySubject", v || "")}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used to suggest this teacher first for matching periods on the Timetable.</p>
              </Field>
              <Field label="Secondary Subject">
                <Select value={form.secondarySubject || "__none__"} onValueChange={(v) => update("secondarySubject", !v || v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {subjectOptions.filter((s) => s.name !== form.primarySubject).map((s) => (
                      <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>
        )}

        <Section title="Documents" icon={FileBadge}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Aadhaar Number">
              <Input value={form.aadhaarNumber} onChange={(e) => update("aadhaarNumber", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12-digit Aadhaar" inputMode="numeric" maxLength={12} />
            </Field>
            <Field label="PAN Number">
              <Input value={form.panNumber} onChange={(e) => update("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
            </Field>
          </div>
        </Section>

        <Section title="Bank Details" icon={Landmark}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Bank Name">
              <Input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} placeholder="Bank name" maxLength={100} />
            </Field>
            <Field label="Account Number">
              <Input value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="Account number" inputMode="numeric" maxLength={20} />
            </Field>
            <Field label="IFSC Code">
              <Input value={form.ifscCode} onChange={(e) => update("ifscCode", e.target.value.toUpperCase())} placeholder="SBIN0001234" maxLength={11} />
            </Field>
          </div>
        </Section>

        <Section title="Emergency Contact" icon={Siren}>
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
                  {["Spouse", "Father", "Mother", "Sibling", "Friend", "Other"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/teachers")}>Cancel</Button>
          <Button type="submit" disabled={saving} className="gap-2 bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : isEdit ? "Update Staff" : "Add Staff"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="card-premium p-6">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2.5 pb-3.5 border-b border-border">
        {Icon && (
          <div className="icon-chip h-8 w-8 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
