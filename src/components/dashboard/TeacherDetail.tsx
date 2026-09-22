"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, UserRound, Briefcase, School, FileBadge, Landmark, Siren } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PageLoader } from "@/components/PageLoader";
import { DetailSection, DetailRow } from "@/components/dashboard/DetailView";
import { statusPillClass } from "@/lib/statusStyles";

interface TeacherDetailData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  teacherId: string;
  isActive: boolean;
  staffType: string;
  department: string;
  designation: string;
  subjects: string[];
  primarySubject: string;
  secondarySubject: string;
  qualification: string;
  experience: string;
  gender: string;
  dateOfBirth: string | null;
  address: string;
  bloodGroup: string;
  joiningDate: string | null;
  salary: number;
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
  assignedClasses?: { _id: string; name: string; section: string }[];
}

interface TeacherResponse {
  success: boolean;
  data: TeacherDetailData;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : undefined;
}

export function TeacherDetail({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<TeacherResponse>(`/teachers/${teacherId}`, token)
      .then((res) => setTeacher(res.data))
      .catch(() => toast.error("Failed to load staff member."))
      .finally(() => setLoading(false));
  }, [teacherId]);

  if (loading) return <PageLoader label="Loading..." />;
  if (!teacher) return <p className="text-sm text-muted-foreground">Staff member not found.</p>;

  const isTeaching = teacher.staffType === "teaching";
  const bankFilled = teacher.bankName || teacher.accountNumber || teacher.ifscCode;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground -ml-2" onClick={() => router.push("/dashboard/teachers")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Staff Details</h1>
        </div>
        <Button onClick={() => router.push(`/dashboard/teachers/${teacherId}/edit`)} className="gap-2 bg-primary hover:bg-primary/90">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="card-premium p-6 flex items-center gap-5">
        <Avatar className="h-20 w-20 border-2 border-border shrink-0">
          <AvatarImage src={teacher.photo} alt={teacher.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {teacher.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{teacher.name}</h2>
            <span className={statusPillClass(teacher.isActive ? "success" : "destructive")}>{teacher.isActive ? "Active" : "Inactive"}</span>
            <span className={statusPillClass(isTeaching ? "info" : "warning")}>{isTeaching ? "Teaching" : "Non-Teaching"}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {teacher.teacherId} · {teacher.designation || (isTeaching ? "Teacher" : "Staff")}
            {teacher.qualification ? ` · ${teacher.qualification}` : ""}
          </p>
        </div>
      </div>

      <DetailSection title="Basic Information" icon={UserRound}>
        <DetailRow label="Email" value={teacher.email} />
        <DetailRow label="Phone" value={teacher.phone} />
        <DetailRow label="Gender" value={teacher.gender ? teacher.gender[0].toUpperCase() + teacher.gender.slice(1) : undefined} />
        <DetailRow label="Date of Birth" value={fmtDate(teacher.dateOfBirth)} />
        <DetailRow label="Blood Group" value={teacher.bloodGroup} />
        <DetailRow label="Address" value={teacher.address} full />
      </DetailSection>

      <DetailSection title="Employment Details" icon={Briefcase}>
        <DetailRow label="Staff Type" value={isTeaching ? "Teaching" : "Non-Teaching"} />
        <DetailRow label="Designation" value={teacher.designation} />
        {!isTeaching && <DetailRow label="Department" value={teacher.department} />}
        <DetailRow label="Employment Type" value={teacher.employmentType} />
        <DetailRow label="Joining Date" value={fmtDate(teacher.joiningDate)} />
        <DetailRow label="Qualification" value={teacher.qualification} />
        <DetailRow label="Experience" value={teacher.experience} />
        <DetailRow label="Salary" value={teacher.salary ? `₹${teacher.salary.toLocaleString()}` : undefined} />
      </DetailSection>

      {isTeaching && (
        <DetailSection title="Teaching Details" icon={School}>
          <DetailRow label="Primary Subject" value={teacher.primarySubject} />
          <DetailRow label="Secondary Subject" value={teacher.secondarySubject} />
          <DetailRow label="Other Subjects" value={teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects.join(", ") : undefined} full />
          <DetailRow
            label="Assigned Classes"
            value={teacher.assignedClasses && teacher.assignedClasses.length > 0 ? teacher.assignedClasses.map((c) => `${c.name}-${c.section}`).join(", ") : undefined}
            full
          />
          <DetailRow label="Specialization" value={teacher.specialization} full />
          <DetailRow label="Previous Experience" value={teacher.previousExperience} full />
        </DetailSection>
      )}

      <DetailSection title="Documents" icon={FileBadge}>
        <DetailRow label="Aadhaar Number" value={teacher.aadhaarNumber} />
        <DetailRow label="PAN Number" value={teacher.panNumber} />
      </DetailSection>

      {bankFilled && (
        <DetailSection title="Bank Details" icon={Landmark}>
          <DetailRow label="Bank Name" value={teacher.bankName} />
          <DetailRow label="Account Number" value={teacher.accountNumber} />
          <DetailRow label="IFSC Code" value={teacher.ifscCode} />
        </DetailSection>
      )}

      <DetailSection title="Emergency Contact" icon={Siren}>
        <DetailRow label="Contact Name" value={teacher.emergencyContact} />
        <DetailRow label="Contact Phone" value={teacher.emergencyPhone} />
        <DetailRow label="Relationship" value={teacher.emergencyRelation} />
      </DetailSection>
    </div>
  );
}
