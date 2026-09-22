"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, UserRound, GraduationCap, Users, CalendarClock, FileBadge, Siren, Tags, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PageLoader } from "@/components/PageLoader";
import { DetailSection, DetailRow } from "@/components/dashboard/DetailView";
import { StudentAttendanceCalendar } from "@/components/dashboard/StudentAttendanceCalendar";
import { statusPillClass } from "@/lib/statusStyles";

interface StudentDetailData {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section: string;
  rollNumber: string;
  phone: string;
  photo: string;
  isActive: boolean;
  parent: {
    name: string;
    motherName?: string;
    motherPhone?: string;
    email: string;
    phone?: string;
    relation?: string;
    occupation?: string;
    motherOccupation?: string;
  } | null;
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
}

interface StudentResponse {
  success: boolean;
  data: StudentDetailData;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : undefined;
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<StudentResponse>(`/students/${studentId}`, token)
      .then((res) => setStudent(res.data))
      .catch(() => toast.error("Failed to load student."))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <PageLoader label="Loading..." />;
  if (!student) return <p className="text-sm text-muted-foreground">Student not found.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground -ml-2" onClick={() => router.push("/dashboard/students")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Student Details</h1>
        </div>
        <Button onClick={() => router.push(`/dashboard/students/${studentId}/edit`)} className="gap-2 bg-primary hover:bg-primary/90">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="card-premium p-6 flex items-center gap-5">
        <Avatar className="h-20 w-20 border-2 border-border shrink-0">
          <AvatarImage src={student.photo} alt={student.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {student.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{student.name}</h2>
            <span className={statusPillClass(student.isActive ? "success" : "destructive")}>{student.isActive ? "Active" : "Inactive"}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {student.studentId} · Class {student.class}
            {student.section ? `-${student.section}` : ""} · Roll {student.rollNumber || "—"}
          </p>
        </div>
      </div>

      <DetailSection title="Basic Information" icon={UserRound}>
        <DetailRow label="Full Name" value={student.name} />
        <DetailRow label="Phone" value={student.phone} />
        <DetailRow label="Gender" value={student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : undefined} />
        <DetailRow label="Date of Birth" value={fmtDate(student.dateOfBirth)} />
        <DetailRow label="Blood Group" value={student.bloodGroup} />
        <DetailRow label="Address" value={student.address} full />
      </DetailSection>

      <DetailSection title="Class Details" icon={GraduationCap}>
        <DetailRow label="Class" value={student.section ? `Class ${student.class} - ${student.section}` : `Class ${student.class}`} />
        <DetailRow label="Roll Number" value={student.rollNumber} />
      </DetailSection>

      <DetailSection title="Parent / Guardian" icon={Users}>
        <DetailRow label="Father Name" value={student.parent?.name} />
        <DetailRow label="Father Phone" value={student.parent?.phone} />
        <DetailRow label="Father Occupation" value={student.parent?.occupation} />
        <DetailRow label="Mother Name" value={student.parent?.motherName} />
        <DetailRow label="Mother Phone" value={student.parent?.motherPhone} />
        <DetailRow label="Mother Occupation" value={student.parent?.motherOccupation} />
        <DetailRow label="Parent Email" value={student.parent?.email} full />
      </DetailSection>

      <DetailSection title="Admission Details" icon={CalendarClock}>
        <DetailRow label="Admission Date" value={fmtDate(student.admissionDate)} />
        <DetailRow label="Admission No" value={student.admissionNo} />
        <DetailRow label="Previous School" value={student.previousSchool} full />
      </DetailSection>

      <DetailSection title="Documents" icon={FileBadge}>
        <DetailRow label="Aadhaar Number" value={student.aadhaarNumber} />
      </DetailSection>

      <DetailSection title="Emergency Contact" icon={Siren}>
        <DetailRow label="Contact Name" value={student.emergencyContact} />
        <DetailRow label="Contact Phone" value={student.emergencyPhone} />
        <DetailRow label="Relationship" value={student.emergencyRelation} />
      </DetailSection>

      <DetailSection title="Category" icon={Tags}>
        <DetailRow label="Religion" value={student.religion} />
        <DetailRow label="Category" value={student.category} />
      </DetailSection>

      <div className="card-premium p-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2.5 pb-3.5 border-b border-border">
          <div className="icon-chip h-8 w-8 bg-primary/10 text-primary">
            <CalendarCheck className="h-4 w-4" />
          </div>
          Attendance
        </h3>
        <StudentAttendanceCalendar studentId={studentId} />
      </div>
    </div>
  );
}
