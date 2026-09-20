"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3, Users, CalendarCheck, DollarSign, Download, FileText,
  GraduationCap, TrendingUp, Loader2, BookOpen, AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState, EmptyStateCompact } from "@/components/EmptyState";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";

type Tab = "overview" | "attendance" | "exams" | "finance";

interface ClassDoc {
  _id: string;
  name: string;
  section: string;
}

interface ExamDoc {
  _id: string;
  title: string;
  subject: string;
  class: string;
  section: string;
  status: string;
}

interface ResultDoc {
  student: { _id: string; name: string; studentId: string; rollNumber: string } | null;
  marksObtained: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
}

interface PendingFee {
  student: { name: string; class: string } | null;
  title: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = [2024, 2025, 2026];

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "exams", label: "Exam Results", icon: GraduationCap },
  { id: "finance", label: "Finance", icon: DollarSign },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "schooladmin";
  const [tab, setTab] = useState<Tab>("overview");

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [stats, setStats] = useState<{ totalStudents: number; totalTeachers: number } | null>(null);
  const [feeSummary, setFeeSummary] = useState<{ totalCollected: number; totalPending: number } | null>(null);
  const [feeMonthly, setFeeMonthly] = useState<{ month: string; collected: number; pending: number }[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [attClassId, setAttClassId] = useState("all");
  const [attData, setAttData] = useState<{ class: string; rate: number; present: number; total: number }[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  const [exams, setExams] = useState<ExamDoc[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [examResults, setExamResults] = useState<{ results: ResultDoc[]; summary: { total: number; passed: number; failed: number; avgPercentage: number } } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const [pendingFees, setPendingFees] = useState<PendingFee[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const run = async () => {
      const [classesRes, statsRes, analyticsRes] = await Promise.allSettled([
        apiGet<{ success: boolean; data: ClassDoc[] }>("/classes", token),
        isAdmin ? apiGet<{ success: boolean; data: { stats: { totalStudents: number; totalTeachers: number } } }>("/dashboard/schooladmin", token) : Promise.resolve(null),
        isAdmin ? apiGet<{ success: boolean; data: { month: string; collected: number; pending: number }[]; summary: { totalCollected: number; totalPending: number } }>("/fees/analytics", token) : Promise.resolve(null),
      ]);
      if (classesRes.status === "fulfilled") setClasses(classesRes.value.data);
      if (statsRes.status === "fulfilled" && statsRes.value) setStats(statsRes.value.data.stats);
      if (analyticsRes.status === "fulfilled" && analyticsRes.value) {
        setFeeMonthly(analyticsRes.value.data);
        setFeeSummary(analyticsRes.value.summary);
      }
    };
    run()
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, [isAdmin]);

  const loadAttendance = () => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams({ month: String(attMonth), year: String(attYear) });
    if (attClassId !== "all") params.set("classId", attClassId);
    apiGet<{ success: boolean; data: { class: string; rate: number; present: number; total: number }[] }>(`/attendance/monthly?${params}`, token)
      .then((res) => setAttData(res.data))
      .catch(() => toast.error("Failed to load attendance data."))
      .finally(() => setLoadingAtt(false));
  };

  useEffect(() => {
    if (tab === "attendance") loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "exams" || exams.length > 0) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ExamDoc[] }>("/exams", token)
      .then((res) => setExams(res.data))
      .catch(() => toast.error("Failed to load exams."));
  }, [tab, exams.length]);

  useEffect(() => {
    if (!selectedExam) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { results: ResultDoc[]; summary: { total: number; passed: number; failed: number; avgPercentage: number } } }>(`/exams/${selectedExam}/results`, token)
      .then((res) => setExamResults(res.data))
      .catch(() => toast.error("Failed to load exam results."))
      .finally(() => setLoadingResults(false));
  }, [selectedExam]);

  useEffect(() => {
    if (tab !== "finance") return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: PendingFee[] }>("/fees/payments?status=pending", token)
      .then((res) => setPendingFees(res.data))
      .catch(() => {})
      .finally(() => setLoadingPending(false));
  }, [tab]);

  if (user && user.role !== "schooladmin" && user.role !== "teacher") {
    return <p className="text-sm text-muted-foreground">Reports are not available for your role.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Reports" subtitle="Live data across attendance, exams and finances." accent="fuchsia" />

      <div className="inline-flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/60 p-1.5 text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              tab === t.id
                ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_4px_14px_-2px_rgba(79,70,229,0.45)]"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {loadingInit ? (
            <PageLoader label="Loading overview..." />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatFilterCard icon={Users} color="#4F46E5" colorDark="#4338CA" value={stats?.totalStudents ?? "—"} label="Total Students" />
                <StatFilterCard icon={BookOpen} color="#0EA5E9" colorDark="#0284C7" value={stats?.totalTeachers ?? "—"} label="Total Teachers" />
                <StatFilterCard icon={DollarSign} color="#16A34A" colorDark="#15803D" value={feeSummary ? `₹${(feeSummary.totalCollected / 1000).toFixed(1)}k` : "—"} label="Total Collected" />
                <StatFilterCard icon={AlertCircle} color="#F59E0B" colorDark="#D97706" value={feeSummary ? `₹${(feeSummary.totalPending / 1000).toFixed(1)}k` : "—"} label="Fee Pending" />
              </div>

              {feeMonthly.filter((d) => d.collected > 0 || d.pending > 0).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" /> Monthly Fee Overview
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => downloadCSV(["Month", "Collected", "Pending"], feeMonthly.map((d) => [d.month, d.collected, d.pending]), "fee-overview.csv")}
                      >
                        <Download className="h-3 w-3" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={feeMonthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                        <Legend />
                        <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {classes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Classes ({classes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {classes.map((c) => (
                        <span key={c._id} className="text-sm px-3 py-1 rounded-full bg-muted text-foreground/90">
                          {c.name}-{c.section}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Month</p>
              <Select
                items={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                value={String(attMonth)}
                onValueChange={(v) => setAttMonth(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Year</p>
              <Select value={String(attYear)} onValueChange={(v) => setAttYear(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Class</p>
              <Select
                items={[{ value: "all", label: "All Classes" }, ...classes.map((c) => ({ value: c._id, label: `${c.name}-${c.section}` }))]}
                value={attClassId}
                onValueChange={(v) => setAttClassId(v || "all")}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}-{c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={loadAttendance} disabled={loadingAtt}>
              {loadingAtt ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              Generate
            </Button>
            {attData.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 ml-auto"
                onClick={() => downloadCSV(["Class", "Rate (%)", "Present", "Total"], attData.map((d) => [d.class, d.rate, d.present, d.total]), `attendance-${MONTHS[attMonth - 1]}-${attYear}.csv`)}
              >
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            )}
          </div>

          {loadingAtt ? (
            <PageLoader label="Loading attendance..." />
          ) : attData.length === 0 ? (
            <EmptyState icon={CalendarCheck} message={`No attendance data for ${MONTHS[attMonth - 1]} ${attYear}.`} />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Attendance by Class — {MONTHS[attMonth - 1]} {attYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="class" tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                      <Bar dataKey="rate" name="Attendance %" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Class-wise Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {attData.map((d) => (
                      <div key={d.class} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.class}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.present} present out of {d.total} total
                          </p>
                        </div>
                        <span className={statusPillClass(d.rate >= 90 ? "success" : d.rate >= 75 ? "warning" : "destructive")}>
                          {d.rate}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "exams" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px] space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Select Exam</p>
              <Select value={selectedExam} onValueChange={(v) => setSelectedExam(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exam to view results" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.title} — {e.class}
                      {e.section ? `-${e.section}` : ""} ({e.subject}) [{e.status}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {examResults && !loadingResults && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  downloadCSV(
                    ["Name", "Student ID", "Roll No", "Marks", "Percentage", "Grade", "Status"],
                    examResults.results.map((r) => [r.student?.name || "—", r.student?.studentId || "—", r.student?.rollNumber || "—", r.marksObtained, r.percentage, r.grade, r.isPassed ? "Pass" : "Fail"]),
                    "exam-results.csv",
                  )
                }
              >
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            )}
          </div>

          {!selectedExam && (
            <EmptyState icon={GraduationCap} message="Select an exam above to view results and grade distribution." />
          )}

          {loadingResults && <PageLoader label="Loading results..." />}

          {examResults && !loadingResults && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatFilterCard icon={GraduationCap} color="#4F46E5" colorDark="#4338CA" value={examResults.summary.total} label="Total Students" />
                <StatFilterCard icon={TrendingUp} color="#16A34A" colorDark="#15803D" value={examResults.summary.passed} label="Passed" />
                <StatFilterCard icon={AlertCircle} color="#DC2626" colorDark="#B91C1C" value={examResults.summary.failed} label="Failed" />
                <StatFilterCard icon={BarChart3} color="#8B5CF6" colorDark="#7C3AED" value={`${examResults.summary.avgPercentage}%`} label="Average Score" />
              </div>

              {(() => {
                const gc: Record<string, number> = {};
                examResults.results.forEach((r) => {
                  gc[r.grade] = (gc[r.grade] || 0) + 1;
                });
                const gradeData = Object.entries(gc)
                  .map(([grade, count]) => ({ grade, count }))
                  .sort((a, b) => a.grade.localeCompare(b.grade));
                return gradeData.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" /> Grade Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={gradeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="grade" tick={{ fill: "#64748B", fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                          <Bar dataKey="count" name="Students" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Student Results ({examResults.results.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          {["#", "Student", "Roll No", "Marks", "Percentage", "Grade", "Status"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {examResults.results.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/50">
                            <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-foreground">{r.student?.name || "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{r.student?.rollNumber || "—"}</td>
                            <td className="px-4 py-2.5 text-foreground">{r.marksObtained}</td>
                            <td className="px-4 py-2.5 font-medium text-foreground">{r.percentage}%</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/90">{r.grade}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={statusPillClass(r.isPassed ? "success" : "destructive")}>{r.isPassed ? "Pass" : "Fail"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {examResults.results.length === 0 && <EmptyStateCompact message="No results entered for this exam yet." />}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "finance" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatFilterCard
              icon={DollarSign}
              color="#16A34A"
              colorDark="#15803D"
              value={feeSummary ? `₹${feeSummary.totalCollected.toLocaleString()}` : "—"}
              label="Total Collected (This Year)"
            />
            <StatFilterCard
              icon={AlertCircle}
              color="#F59E0B"
              colorDark="#D97706"
              value={feeSummary ? `₹${feeSummary.totalPending.toLocaleString()}` : "—"}
              label="Total Pending"
            />
            <StatFilterCard
              icon={TrendingUp}
              color="#0EA5E9"
              colorDark="#0284C7"
              value={
                feeSummary && feeSummary.totalCollected + feeSummary.totalPending > 0
                  ? `${Math.round((feeSummary.totalCollected / (feeSummary.totalCollected + feeSummary.totalPending)) * 100)}%`
                  : "—"
              }
              label="Collection Rate"
            />
          </div>

          {feeMonthly.filter((d) => d.collected > 0 || d.pending > 0).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Monthly Collection vs Pending
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => downloadCSV(["Month", "Collected", "Pending"], feeMonthly.map((d) => [d.month, d.collected, d.pending]), "monthly-finance.csv")}
                  >
                    <Download className="h-3 w-3" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={feeMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Pending Fee Records {pendingFees.length > 0 && `(${pendingFees.length})`}</CardTitle>
                {pendingFees.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      downloadCSV(
                        ["Student", "Class", "Fee Title", "Amount", "Paid", "Balance", "Due Date", "Status"],
                        pendingFees.map((f) => [f.student?.name || "—", f.student?.class || "—", f.title, f.amount, f.paidAmount, f.amount - f.paidAmount, f.dueDate?.slice(0, 10) || "—", f.status]),
                        "pending-fees.csv",
                      )
                    }
                  >
                    <Download className="h-3 w-3" /> Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPending ? (
                <PageLoader label="Loading pending fees..." />
              ) : pendingFees.length === 0 ? (
                <EmptyStateCompact message="No pending fees." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {["Student", "Class", "Fee Title", "Total", "Paid", "Balance", "Due Date", "Status"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendingFees.slice(0, 25).map((f, i) => (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="px-4 py-2.5 font-medium text-foreground">{f.student?.name || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{f.student?.class || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{f.title}</td>
                          <td className="px-4 py-2.5 text-foreground">₹{f.amount?.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-green-700">₹{f.paidAmount?.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-red-600 font-medium">₹{(f.amount - f.paidAmount)?.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{f.dueDate?.slice(0, 10) || "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`${statusPillClass(f.status === "overdue" ? "destructive" : "warning")} capitalize`}>{f.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pendingFees.length > 25 && <p className="text-xs text-center text-muted-foreground py-3 border-t border-border">Showing 25 of {pendingFees.length} records. Export CSV for the full list.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
