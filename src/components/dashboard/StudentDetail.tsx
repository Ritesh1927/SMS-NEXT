"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, UserRound, GraduationCap, Users, CalendarClock, FileBadge, Siren, Tags, CalendarCheck, IndianRupee, FileText } from "lucide-react";
import { toast } from "sonner";
import { getToken, useAuth } from "@/contexts/AuthContext";
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

interface LedgerMonth {
  status: "paid" | "pending" | "upcoming";
  paidAmount: number;
  balance: number;
}

interface LedgerFeeHead {
  months: LedgerMonth[];
}

interface LedgerResponse {
  success: boolean;
  data: LedgerFeeHead[];
}

interface FeeHistoryItem {
  title: string;
  month: string | null;
}

interface FeeHistoryGroup {
  paymentDate: string | null;
  paymentMode: string;
  totalAmount: number;
  items: FeeHistoryItem[];
}

interface FeeHistoryResponse {
  success: boolean;
  data: { history: FeeHistoryGroup[] };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthLabel(month: string | null) {
  if (!month) return "";
  if (month === "one-time") return "One-Time";
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : undefined;
}

// Same paid/pending/upcoming split the Student Ledger report uses — a month
// is only "pending" once its due date has actually arrived (this month or
// earlier); anything further out is "upcoming", not money owed yet.
function summarizeLedger(feeHeads: LedgerFeeHead[]) {
  let totalPaid = 0;
  let totalPending = 0;
  let totalUpcoming = 0;
  for (const fh of feeHeads) {
    for (const m of fh.months) {
      if (m.status === "paid") totalPaid += m.paidAmount;
      else if (m.status === "pending") totalPending += m.balance;
      else totalUpcoming += m.balance;
    }
  }
  return { totalFees: totalPaid + totalPending + totalUpcoming, totalPaid, totalPending, totalUpcoming };
}

function StudentFeeUpdates({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<{ totalFees: number; totalPaid: number; totalPending: number; totalUpcoming: number } | null>(null);
  const [history, setHistory] = useState<FeeHistoryGroup[]>([]);
  const [hasFeeStructure, setHasFeeStructure] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      apiGet<LedgerResponse>(`/fees/reports/student-ledger/${studentId}`, token),
      apiGet<FeeHistoryResponse>(`/fees/history/${studentId}`, token),
    ])
      .then(([ledgerRes, historyRes]) => {
        const feeHeads = ledgerRes.data || [];
        setHasFeeStructure(feeHeads.length > 0);
        setSummary(summarizeLedger(feeHeads));
        setHistory(historyRes.data.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <PageLoader compact label="Loading fee details..." />;

  if (!hasFeeStructure) {
    return <p className="text-sm text-muted-foreground text-center py-4">No fee structure defined for this class yet.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-lg font-bold text-foreground">₹{(summary?.totalFees || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Fees</p>
        </div>
        <div className="rounded-xl bg-green-50 p-4 text-center">
          <p className="text-lg font-bold text-green-700">₹{(summary?.totalPaid || 0).toLocaleString()}</p>
          <p className="text-xs text-green-700/80 mt-0.5">Paid</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${(summary?.totalPending || 0) > 0 ? "bg-red-50" : "bg-green-50"}`}>
          <p className={`text-lg font-bold ${(summary?.totalPending || 0) > 0 ? "text-red-700" : "text-green-700"}`}>
            ₹{(summary?.totalPending || 0).toLocaleString()}
          </p>
          <p className={`text-xs mt-0.5 ${(summary?.totalPending || 0) > 0 ? "text-red-700/80" : "text-green-700/80"}`}>Pending</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4 text-center">
          <p className="text-lg font-bold text-amber-700">₹{(summary?.totalUpcoming || 0).toLocaleString()}</p>
          <p className="text-xs text-amber-700/80 mt-0.5">Upcoming</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Payments</p>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {history.map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {g.paymentDate ? new Date(g.paymentDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  <span className="text-xs text-muted-foreground font-normal ml-2 capitalize">{g.paymentMode}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {g.items.map((it) => `${it.title} (${getMonthLabel(it.month)})`).join(", ")}
                </p>
              </div>
              <span className="text-sm font-semibold text-green-700 shrink-0">₹{g.totalAmount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

interface ExamResultRow {
  _id: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
  isAbsent: boolean;
  isPublished: boolean;
  exam: { subject: string } | null;
}

interface ExamGroup {
  groupId: string;
  title: string;
  date: string;
  isTerm: boolean;
  rows: ExamResultRow[];
}

interface ResultsResponse {
  success: boolean;
  data: { groups: ExamGroup[]; averagePercentage: number };
}

function StudentExamPerformance({ studentId }: { studentId: string }) {
  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [averagePercentage, setAveragePercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ResultsResponse>(`/results/student/${studentId}`, token)
      .then((res) => {
        setGroups(res.data.groups || []);
        setAveragePercentage(res.data.averagePercentage || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <PageLoader compact label="Loading exam results..." />;

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No exam results yet.</p>;
  }

  const allRows = groups.flatMap((g) => g.rows);
  const attempted = allRows.filter((r) => !r.isAbsent);
  const passCount = attempted.filter((r) => r.isPassed).length;
  const passRate = attempted.length > 0 ? Math.round((passCount / attempted.length) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-lg font-bold text-foreground">{averagePercentage}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Average Score</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-lg font-bold text-foreground">{groups.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Exams Taken</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${passRate >= 50 ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`text-lg font-bold ${passRate >= 50 ? "text-green-700" : "text-red-700"}`}>{passRate}%</p>
          <p className={`text-xs mt-0.5 ${passRate >= 50 ? "text-green-700/80" : "text-red-700/80"}`}>Pass Rate</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Exams</p>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.groupId} className="p-3 rounded-xl bg-muted/40">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-foreground truncate">{g.title}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(g.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.rows.map((r) => (
                <span
                  key={r._id}
                  className={`text-[11px] font-medium px-2 py-1 rounded-full ${
                    r.isAbsent
                      ? "bg-muted text-muted-foreground"
                      : r.isPassed
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.exam?.subject || "Subject"}: {r.isAbsent ? "Absent" : `${r.marksObtained}/${r.totalMarks} (${r.grade})`}
                  {!r.isPublished && " · Draft"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { user } = useAuth();
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
        {user?.role !== "teacher" && (
          <Button onClick={() => router.push(`/dashboard/students/${studentId}/edit`)} className="gap-2 bg-primary hover:bg-primary/90">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
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
            <IndianRupee className="h-4 w-4" />
          </div>
          Fee Updates
        </h3>
        <StudentFeeUpdates studentId={studentId} />
      </div>

      <div className="card-premium p-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2.5 pb-3.5 border-b border-border">
          <div className="icon-chip h-8 w-8 bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          Exam Performance
        </h3>
        <StudentExamPerformance studentId={studentId} />
      </div>

      <div className="card-premium p-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2.5 pb-3.5 border-b border-border">
          <div className="icon-chip h-8 w-8 bg-primary/10 text-primary">
            <CalendarCheck className="h-4 w-4" />
          </div>
          Attendance
        </h3>
        <StudentAttendanceCalendar studentId={studentId} showDailyRecords={false} />
      </div>
    </div>
  );
}
