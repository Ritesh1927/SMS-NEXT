"use client";

import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3, Users, CalendarCheck, DollarSign, Download, FileText,
  GraduationCap, TrendingUp, Loader2, BookOpen, AlertCircle, Filter,
  CheckCircle2, XCircle, Clock, IndianRupee, Wallet, Tag, AlertTriangle,
  Search, ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { generateSessionMonths } from "@/lib/feeEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState, EmptyStateCompact } from "@/components/EmptyState";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { AttendanceRegister, type RegisterData } from "@/components/dashboard/AttendanceRegister";

type Tab = "overview" | "attendance" | "exams" | "finance";

interface ClassDoc {
  _id: string;
  name: string;
  section: string;
  studentCount?: number;
}

// One row of GET /attendance/yearly (classId omitted → school-wide).
interface AttMonthRow {
  month: number;
  rate: number;
  present: number;
  total: number;
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

interface FinanceStats {
  totalStudents: number;
  totalFee: number;
  collected: number;
  pending: number;
  collectionRate: number;
  fullyPaid: number;
  unpaid: number;
  lateFees: number;
  concessions: number;
}

interface FinanceHead {
  title: string;
  frequency: string;
  dueThisMonth: boolean;
  totalFee: number;
  paid: number;
  pending: number;
  lateFee: number;
  concession: number;
  dueDate: string | null;
  status: "paid" | "unpaid" | "not-due";
}

interface FinanceRow {
  _id: string;
  name: string;
  rollNumber: string;
  totalFee: number;
  paid: number;
  pending: number;
  lateFee: number;
  concession: number;
  dueDate: string | null;
  status: "paid" | "unpaid";
  heads: FinanceHead[];
}

interface FinanceData {
  className: string;
  stats: FinanceStats;
  rows: FinanceRow[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = [2024, 2025, 2026];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS_FULL[Number(m) - 1] || key} ${y}`;
};

const fmtDue = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
};

const freqLabel = (f: string) => (f === "one-time" ? "One-time" : f.charAt(0).toUpperCase() + f.slice(1));

// The academic year the given session start month puts "today" in — for an
// April session in Oct 2026 that's "2026-2027" (Apr 2026 – Mar 2027).
const currentAcademicYear = (sessionStartMonth: string) => {
  const now = new Date();
  const startIdx = MONTHS_FULL.indexOf(sessionStartMonth);
  const idx = startIdx >= 0 ? startIdx : 3;
  const startYear = now.getMonth() >= idx ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

const academicYearOptions = (sessionStartMonth: string) => {
  const start = Number(currentAcademicYear(sessionStartMonth).slice(0, 4));
  return [`${start - 2}-${start - 1}`, `${start - 1}-${start}`, `${start}-${start + 1}`, `${start + 1}-${start + 2}`];
};

const feeRateTone = (pct: number) => (pct >= 90 ? "success" : pct >= 75 ? "warning" : "destructive");

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
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalTeachers: number;
    newStudentsThisMonth?: number;
    newTeachersThisMonth?: number;
  } | null>(null);
  // Overview-only fee analytics (year totals + monthly collection chart +
  // class-wise collected/pending for the class snapshot table).
  const [feeSummary, setFeeSummary] = useState<{
    totalCollected: number;
    totalPending: number;
    totalLateFees?: number;
    totalConcessions?: number;
  } | null>(null);
  const [feeMonthly, setFeeMonthly] = useState<{ month: string; collected: number; pending: number }[]>([]);
  const [feeClassWise, setFeeClassWise] = useState<{ class: string; collected: number }[]>([]);
  const [feePendingByClass, setFeePendingByClass] = useState<{ class: string; pending: number }[]>([]);
  // School-wide attendance per month for the current year (attendance trend).
  const [attYearly, setAttYearly] = useState<AttMonthRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  // No "All Classes" option — always a specific class. Empty until /classes
  // resolves, then defaulted to the first (Class 1) by the init effect.
  const [attClassId, setAttClassId] = useState("");
  const [attRegister, setAttRegister] = useState<RegisterData | null>(null);
  // Snapshot of the month/year the last Apply actually loaded — the selects
  // can be moved without applying, and the view must not relabel old data
  // with the new selection.
  const [attApplied, setAttApplied] = useState({ month: attMonth, year: attYear });
  // Starts true: the tab's first paint happens before the auto-load effect
  // runs, and there is no chart fallback to show in the meantime.
  const [loadingAtt, setLoadingAtt] = useState(true);

  const [exams, setExams] = useState<ExamDoc[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [examResults, setExamResults] = useState<{ results: ResultDoc[]; summary: { total: number; passed: number; failed: number; avgPercentage: number } } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Finance report: academic year + month + class for the selected month.
  // The AY/month defaults are resolved from the school's session settings
  // when the tab first opens; the class defaults to the first class (Class 1)
  // from the shared /classes load, same as Attendance.
  const [finAY, setFinAY] = useState("");
  const [finMonth, setFinMonth] = useState("");
  const [finClassId, setFinClassId] = useState("");
  const [finMeta, setFinMeta] = useState<{ sessionStartMonth: string } | null>(null);
  const [finData, setFinData] = useState<FinanceData | null>(null);
  // Snapshot of the AY/month the last Apply actually loaded — the selects can
  // be moved without applying, and the view must not relabel old data.
  const [finApplied, setFinApplied] = useState({ ay: "", month: "" });
  const [loadingFin, setLoadingFin] = useState(true);
  // Client-side student-name search over the loaded rows — classes can hold
  // 100+ students, so the table filters as you type. Cleared on each load.
  const [finSearch, setFinSearch] = useState("");
  // Drill-down: student rows expanded to their per-fee-head breakdown.
  // Cleared on each load (new class / month starts collapsed).
  const [finOpen, setFinOpen] = useState<Set<string>>(new Set());

  const toggleFinOpen = (id: string) =>
    setFinOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const run = async () => {
      const [classesRes, statsRes, analyticsRes, attYearlyRes] = await Promise.allSettled([
        apiGet<{ success: boolean; data: ClassDoc[] }>("/classes", token),
        isAdmin ? apiGet<{ success: boolean; data: { stats: { totalStudents: number; totalTeachers: number; newStudentsThisMonth?: number; newTeachersThisMonth?: number } } }>("/dashboard/schooladmin", token) : Promise.resolve(null),
        isAdmin
          ? apiGet<{
              success: boolean;
              data: { month: string; collected: number; pending: number }[];
              classWise: { class: string; collected: number }[];
              pendingByClass: { class: string; pending: number }[];
              summary: { totalCollected: number; totalPending: number; totalLateFees: number; totalConcessions: number };
            }>("/fees/analytics", token)
          : Promise.resolve(null),
        // School-wide attendance trend for the current year (both roles —
        // /attendance/yearly allows teachers too).
        apiGet<{ success: boolean; data: AttMonthRow[] }>(`/attendance/yearly?year=${new Date().getFullYear()}`, token),
      ]);
      if (classesRes.status === "fulfilled") {
        const list = classesRes.value.data;
        setClasses(list);
        // Default both filtered reports (Attendance + Finance) to the first
        // class (Class 1) so the tabs show data immediately.
        setAttClassId((prev) => prev || list[0]?._id || "");
        setFinClassId((prev) => prev || list[0]?._id || "");
        if (list.length === 0) setLoadingAtt(false);
      } else {
        setLoadingAtt(false);
      }
      if (statsRes.status === "fulfilled" && statsRes.value) setStats(statsRes.value.data.stats);
      if (analyticsRes.status === "fulfilled" && analyticsRes.value) {
        setFeeMonthly(analyticsRes.value.data);
        setFeeSummary(analyticsRes.value.summary);
        setFeeClassWise(analyticsRes.value.classWise || []);
        setFeePendingByClass(analyticsRes.value.pendingByClass || []);
      }
      if (attYearlyRes.status === "fulfilled") setAttYearly(attYearlyRes.value.data);
    };
    run()
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, [isAdmin]);

  const loadAttendance = () => {
    const token = getToken();
    if (!token || !attClassId) return;
    setLoadingAtt(true);
    setAttApplied({ month: attMonth, year: attYear });
    // Always the full month register (students × days pivot) for the picked class.
    apiGet<{ success: boolean; data: RegisterData }>(
      `/attendance/register?classId=${attClassId}&month=${attMonth}&year=${attYear}`,
      token,
    )
      .then((res) => setAttRegister(res.data))
      .catch(() => {
        setAttRegister(null);
        toast.error("Failed to load attendance register.");
      })
      .finally(() => setLoadingAtt(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: showing the loading state for the data load this tab switch / class pick kicks off.
    if (tab === "attendance" && attClassId) loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, attClassId]);

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

  const loadFinance = () => {
    const token = getToken();
    if (!token || !finClassId || !finAY || !finMonth) return;
    setLoadingFin(true);
    setFinApplied({ ay: finAY, month: finMonth });
    setFinSearch("");
    setFinOpen(new Set());
    apiGet<{ success: boolean; data: FinanceData }>(
      `/fees/reports/finance?month=${finMonth}&classId=${finClassId}&academicYear=${finAY}`,
      token,
    )
      .then((res) => setFinData(res.data))
      .catch(() => {
        setFinData(null);
        toast.error("Failed to load fee report.");
      })
      .finally(() => setLoadingFin(false));
  };

  // Switching academic year keeps the same calendar month (Sep 2026 ->
  // Sep 2025) since each year's 12 session months contain every month once.
  const handleFinAYChange = (ay: string) => {
    setFinAY(ay);
    if (!finMonth) return;
    const months = generateSessionMonths(finMeta?.sessionStartMonth || "April", Number(ay.slice(0, 4)));
    const same = months.find((m) => m.slice(5) === finMonth.slice(5));
    if (same && same !== finMonth) setFinMonth(same);
  };

  // Finance tab first open: resolve the school's session settings so the
  // academic-year / month selects can be built and defaulted (AY = the one
  // today falls in, month = the current month).
  useEffect(() => {
    if (tab !== "finance" || finMeta) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { settings?: { sessionStartMonth?: string } } }>("/school/branding", token)
      .catch(() => null)
      .then((res) => {
        const startMonth = res?.data?.settings?.sessionStartMonth || "April";
        const ay = currentAcademicYear(startMonth);
        const months = generateSessionMonths(startMonth, Number(ay.slice(0, 4)));
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setFinMeta({ sessionStartMonth: startMonth });
        setFinAY((prev) => prev || ay);
        setFinMonth((prev) => prev || (months.includes(todayKey) ? todayKey : months[0] || todayKey));
      });
  }, [tab, finMeta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: showing the loading state for the data load this tab open / class pick kicks off.
    if (tab === "finance" && finMeta && finClassId && finAY && finMonth) loadFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, finMeta, finClassId]);

  const sessionStart = finMeta?.sessionStartMonth || "April";
  const finYears = academicYearOptions(sessionStart);
  const finMonths = generateSessionMonths(sessionStart, Number((finAY || currentAcademicYear(sessionStart)).slice(0, 4)));
  const finClassPct = (n: number) => (finData && finData.stats.totalStudents > 0 ? Math.round((n / finData.stats.totalStudents) * 100) : 0);

  // Rows shown by the table / CSV / footer: the full set, or the name match.
  // Footer totals are computed from the displayed rows so they always agree
  // with what's on screen (the stat cards above stay class-wide).
  const finQuery = finSearch.trim().toLowerCase();
  const finRows = !finData ? [] : finQuery ? finData.rows.filter((r) => r.name.toLowerCase().includes(finQuery)) : finData.rows;
  const finTotals = finRows.reduce(
    (a, r) => ({
      fee: a.fee + r.totalFee,
      paid: a.paid + r.paid,
      pending: a.pending + r.pending,
      late: a.late + r.lateFee,
      con: a.con + r.concession,
    }),
    { fee: 0, paid: 0, pending: 0, late: 0, con: 0 },
  );
  const finRate = finTotals.fee > 0 ? Math.round((finTotals.paid / finTotals.fee) * 10000) / 100 : 0;

  // ---- Overview (management view) derivations ----
  // Collection rate = YTD collected ÷ (collected + outstanding dues).
  const collRate =
    feeSummary && feeSummary.totalCollected + feeSummary.totalPending > 0
      ? Math.round((feeSummary.totalCollected / (feeSummary.totalCollected + feeSummary.totalPending)) * 10000) / 100
      : null;
  // School-wide attendance YTD — overall rate from raw present/total counts
  // (the per-month `rate` is rounded to an integer by the API) and the rows
  // for the trend chart (only months that actually have marked records).
  const attMonths = attYearly.filter((m) => m.total > 0);
  const attTotals = attMonths.reduce((a, m) => ({ present: a.present + m.present, total: a.total + m.total }), { present: 0, total: 0 });
  const attRate = attTotals.total > 0 ? Math.round((attTotals.present / attTotals.total) * 10000) / 100 : null;
  const attTrend = attMonths.map((m) => ({ month: MONTHS[m.month - 1] || String(m.month), rate: m.rate }));
  const feeChartOn = feeMonthly.some((d) => d.collected > 0 || d.pending > 0);
  // Class snapshot: one row per class NAME with its sections merged —
  // /fees/analytics groups collected/pending by class name only, so separate
  // section rows would repeat the same bucket and double-count the totals.
  const classSnapshot = (() => {
    const byName = new Map<string, { name: string; sections: string[]; students: number }>();
    for (const c of classes) {
      const g = byName.get(c.name) || { name: c.name, sections: [], students: 0 };
      if (!g.sections.includes(c.section)) g.sections.push(c.section);
      g.students += c.studentCount ?? 0;
      byName.set(c.name, g);
    }
    return [...byName.values()]
      .map((g) => {
        const collected = feeClassWise.find((x) => x.class === g.name)?.collected ?? 0;
        const pending = feePendingByClass.find((x) => x.class === g.name)?.pending ?? 0;
        const due = collected + pending;
        return { ...g, collected, pending, rate: due > 0 ? Math.round((collected / due) * 10000) / 100 : null };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  })();
  const classTotals = classSnapshot.reduce(
    (a, r) => ({ students: a.students + r.students, collected: a.collected + r.collected, pending: a.pending + r.pending }),
    { students: 0, collected: 0, pending: 0 },
  );
  const classTotalsRate =
    classTotals.collected + classTotals.pending > 0
      ? Math.round((classTotals.collected / (classTotals.collected + classTotals.pending)) * 10000) / 100
      : null;

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
                <StatFilterCard
                  icon={Users}
                  color="#4F46E5"
                  colorDark="#4338CA"
                  value={stats?.totalStudents ?? "—"}
                  label="Total Students"
                  sublabel={stats ? `+${stats.newStudentsThisMonth ?? 0} this month` : undefined}
                />
                <StatFilterCard
                  icon={BookOpen}
                  color="#0EA5E9"
                  colorDark="#0284C7"
                  value={stats?.totalTeachers ?? "—"}
                  label="Total Teachers"
                  sublabel={stats ? `+${stats.newTeachersThisMonth ?? 0} this month` : undefined}
                />
                <StatFilterCard
                  icon={DollarSign}
                  color="#16A34A"
                  colorDark="#15803D"
                  value={feeSummary ? `₹${(feeSummary.totalCollected / 1000).toFixed(1)}k` : "—"}
                  label="Total Collected"
                  sublabel="Collected this year"
                />
                <StatFilterCard
                  icon={AlertCircle}
                  color="#F59E0B"
                  colorDark="#D97706"
                  value={feeSummary ? `₹${(feeSummary.totalPending / 1000).toFixed(1)}k` : "—"}
                  label="Fee Pending"
                  sublabel="Outstanding dues"
                />
                <StatFilterCard
                  icon={TrendingUp}
                  color="#8B5CF6"
                  colorDark="#7C3AED"
                  value={collRate !== null ? `${collRate.toFixed(2)}%` : "—"}
                  label="Collection Rate"
                  sublabel="Collected ÷ total due"
                />
                <StatFilterCard
                  icon={Clock}
                  color="#EF4444"
                  colorDark="#DC2626"
                  value={feeSummary ? inr(feeSummary.totalLateFees ?? 0) : "—"}
                  label="Total Late Fees"
                  sublabel="Charged this year"
                />
                <StatFilterCard
                  icon={Tag}
                  color="#14B8A6"
                  colorDark="#0D9488"
                  value={feeSummary ? inr(feeSummary.totalConcessions ?? 0) : "—"}
                  label="Total Concessions"
                  sublabel="Waived this year"
                />
                <StatFilterCard
                  icon={CalendarCheck}
                  color="#6366F1"
                  colorDark="#4F46E5"
                  value={attRate !== null ? `${attRate.toFixed(1)}%` : "—"}
                  label="Attendance YTD"
                  sublabel="Present ÷ marked"
                />
              </div>

              {(feeChartOn || attTrend.length > 0) && (
                <div className={`grid gap-6 ${feeChartOn && attTrend.length > 0 ? "lg:grid-cols-2" : ""}`}>
                  {feeChartOn && (
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

                  {attTrend.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-primary" /> Attendance Trend (YTD)
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => downloadCSV(["Month", "Attendance %", "Present", "Marked"], attMonths.map((m) => [MONTHS[m.month - 1] || m.month, m.rate, m.present, m.total]), "attendance-trend.csv")}
                          >
                            <Download className="h-3 w-3" /> Export
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={attTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                            <Bar dataKey="rate" name="Attendance" fill="#6366F1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {classSnapshot.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Class Snapshot ({classSnapshot.length} classes)
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          downloadCSV(
                            ["Class", "Sections", "Students", "Collected", "Pending", "Collection Rate"],
                            classSnapshot.map((r) => [
                              `Class ${r.name}`,
                              r.sections.join("/"),
                              r.students,
                              r.collected,
                              r.pending,
                              r.rate !== null ? `${r.rate}%` : "",
                            ]),
                            "class-snapshot.csv",
                          )
                        }
                      >
                        <Download className="h-3 w-3" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="border-b border-border/70 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Class</th>
                            <th className="border-b border-border/70 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Sections</th>
                            <th className="border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Students</th>
                            <th className="border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Collected</th>
                            <th className="border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Pending</th>
                            <th className="border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Collection Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classSnapshot.map((r) => (
                            <tr key={r.name} className="border-b border-border/50 hover:bg-muted/40">
                              <td className="px-3 py-2.5 font-medium">Class {r.name}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{r.sections.join(", ")}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.students}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{feeSummary ? inr(r.collected) : "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-red-600">{feeSummary ? inr(r.pending) : "—"}</td>
                              <td className="px-3 py-2.5 text-right">
                                {feeSummary && r.rate !== null ? (
                                  <span className={statusPillClass(feeRateTone(r.rate))}>{r.rate.toFixed(2)}%</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-semibold">
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5 text-left">Total</td>
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5" />
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5 text-right tabular-nums">{classTotals.students}</td>
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5 text-right tabular-nums">{feeSummary ? inr(classTotals.collected) : "—"}</td>
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5 text-right tabular-nums">{feeSummary ? inr(classTotals.pending) : "—"}</td>
                            <td className="border-t border-border/60 bg-muted px-3 py-2.5 text-right">
                              {feeSummary && classTotalsRate !== null ? (
                                <span className={statusPillClass(feeRateTone(classTotalsRate))}>{classTotalsRate.toFixed(2)}%</span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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
                items={classes.map((c) => ({ value: c._id, label: `${c.name}-${c.section}` }))}
                value={attClassId}
                onValueChange={(v) => setAttClassId(v || "")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}-{c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={loadAttendance} disabled={loadingAtt}>
              {loadingAtt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              Apply Filter
            </Button>
          </div>

          {loadingAtt ? (
            <PageLoader label="Loading attendance..." />
          ) : !attClassId ? (
            <EmptyState icon={CalendarCheck} message="No classes found." />
          ) : attRegister ? (
            <AttendanceRegister data={attRegister} month={attApplied.month} year={attApplied.year} />
          ) : (
            <EmptyState icon={CalendarCheck} message={`No attendance data for ${MONTHS[attApplied.month - 1]} ${attApplied.year}.`} />
          )}
        </div>
      )}

      {tab === "exams" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px] space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Select Exam</p>
              <Select value={selectedExam} onValueChange={(v) => setSelectedExam(v || "")}>
                <SelectTrigger className="w-full">
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
          {/* Filters — same rhythm as Attendance: class reloads on change,
              academic year / month wait for Apply (AY keeps the month). */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Academic Year</p>
              <Select
                items={finYears.map((ay) => ({ value: ay, label: ay.replace("-", "–") }))}
                value={finAY}
                onValueChange={(v) => v && handleFinAYChange(v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {finYears.map((ay) => (
                    <SelectItem key={ay} value={ay}>
                      {ay.replace("-", "–")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Month</p>
              <Select
                items={finMonths.map((m) => ({ value: m, label: monthLabel(m) }))}
                value={finMonth}
                onValueChange={(v) => v && setFinMonth(v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {finMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Class</p>
              <Select
                items={classes.map((c) => ({ value: c._id, label: `Class ${c.name}-${c.section}` }))}
                value={finClassId}
                onValueChange={(v) => setFinClassId(v || "")}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      Class {c.name}-{c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={loadFinance} disabled={loadingFin || !finMeta || !finClassId}>
              {loadingFin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              Apply Filter
            </Button>
            {finRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 ml-auto"
                onClick={() => {
                  downloadCSV(
                    ["#", "Student", "Roll No", "Total Fee", "Paid", "Pending", "Late Fee", "Concession", "Due Date", "Payment Status"],
                    finRows.map((r, i) => [
                      i + 1,
                      r.name,
                      r.rollNumber || "—",
                      r.totalFee,
                      r.paid,
                      r.pending,
                      r.lateFee,
                      r.concession,
                      r.dueDate ? fmtDue(r.dueDate) : "—",
                      r.status === "paid" ? "Paid" : "Unpaid",
                    ]),
                    `fee-report-${finApplied.month}-${finApplied.ay}.csv`,
                  );
                }}
              >
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            )}
          </div>

          {!finMeta || loadingInit || (finClassId && loadingFin) ? (
            <PageLoader label="Loading fee report..." />
          ) : !finClassId ? (
            <EmptyState icon={DollarSign} message="No classes found." />
          ) : !finData ? (
            <EmptyState
              icon={DollarSign}
              message={`No fee data for ${monthLabel(finApplied.month || finMonth)} · AY ${(finApplied.ay || finAY).replace("-", "–")}.`}
            />
          ) : finData.rows.length === 0 ? (
            <EmptyState icon={Users} message={`No students found in ${finData.className}.`} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatFilterCard
                  icon={Users}
                  color="#4F46E5"
                  colorDark="#4338CA"
                  value={finData.stats.totalStudents}
                  label="Total Students"
                  sublabel={`Enrolled in ${finData.className}`}
                />
                <StatFilterCard
                  icon={IndianRupee}
                  color="#7C3AED"
                  colorDark="#6D28D9"
                  value={inr(finData.stats.totalFee)}
                  label="Total Fee"
                  sublabel="Payable this month"
                />
                <StatFilterCard
                  icon={Wallet}
                  color="#16A34A"
                  colorDark="#15803D"
                  value={inr(finData.stats.collected)}
                  label="Total Collected"
                  sublabel="Received this month"
                />
                <StatFilterCard
                  icon={Clock}
                  color="#F59E0B"
                  colorDark="#D97706"
                  value={inr(finData.stats.pending)}
                  label="Total Pending"
                  sublabel="Outstanding dues"
                />
                <StatFilterCard
                  icon={TrendingUp}
                  color="#0EA5E9"
                  colorDark="#0284C7"
                  value={`${finData.stats.collectionRate.toFixed(2)}%`}
                  label="Collection Rate"
                  sublabel="Collected ÷ Total Fee"
                />
                <StatFilterCard
                  icon={CheckCircle2}
                  color="#10B981"
                  colorDark="#059669"
                  value={finData.stats.fullyPaid}
                  label="Fully Paid"
                  sublabel={`${finClassPct(finData.stats.fullyPaid)}% of class`}
                />
                <StatFilterCard
                  icon={XCircle}
                  color="#EF4444"
                  colorDark="#DC2626"
                  value={finData.stats.unpaid}
                  label="Unpaid"
                  sublabel={`${finClassPct(finData.stats.unpaid)}% of class`}
                />
                <StatFilterCard
                  icon={AlertTriangle}
                  color="#F97316"
                  colorDark="#EA580C"
                  value={inr(finData.stats.lateFees)}
                  label="Total Late Fee"
                  sublabel="Charged & projected"
                />
                <StatFilterCard
                  icon={Tag}
                  color="#14B8A6"
                  colorDark="#0D9488"
                  value={inr(finData.stats.concessions)}
                  label="Total Concessions"
                  sublabel="Waived this month"
                />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Fee Report — {finData.className}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {monthLabel(finApplied.month)} · Academic Year {finApplied.ay.replace("-", "–")}
                      </p>
                    </div>
                    <div className="relative ml-auto">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={finSearch}
                        onChange={(e) => setFinSearch(e.target.value)}
                        placeholder="Search student…"
                        aria-label="Search student by name"
                        className="h-9 w-56 pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    {/* table-fixed + explicit widths keep the sticky #/Student
                        offsets exact (40 + 192 = 232) while the money columns
                        stay right-aligned without squeezing Roll No. */}
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: 1000 }}>
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-20 w-10 bg-card border-b border-border/70 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                            #
                          </th>
                          <th className="sticky left-10 z-20 w-48 bg-card border-b border-r border-border/70 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                            Student
                          </th>
                          <th className="w-20 bg-card border-b border-border/70 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                            Roll No
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                            Total Fee
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                            Paid
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                            Pending
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                            Late Fee
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                            Concession
                          </th>
                          <th className="w-24 bg-card border-b border-border/70 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                            Due Date
                          </th>
                          <th className="w-28 bg-card border-b border-border/70 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                            Payment Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {finRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                              No students match “{finSearch.trim()}”.
                            </td>
                          </tr>
                        ) : (
                          finRows.map((r, i) => (
                            <Fragment key={r._id}>
                              <tr className="group">
                                <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 border-b border-border/50 px-3 py-2 text-center text-muted-foreground">
                                  {i + 1}
                                </td>
                                <td className="sticky left-10 z-10 bg-card group-hover:bg-muted/40 border-b border-r border-border/50 px-3 py-2 font-medium text-foreground">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleFinOpen(r._id)}
                                      aria-expanded={finOpen.has(r._id)}
                                      aria-label={`${finOpen.has(r._id) ? "Collapse" : "Show"} fee heads for ${r.name}`}
                                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                      <ChevronRight className={`h-4 w-4 transition-transform ${finOpen.has(r._id) ? "rotate-90" : ""}`} />
                                    </button>
                                    <span className="truncate">{r.name}</span>
                                  </div>
                                </td>
                                <td className="border-b border-border/50 px-3 py-2 font-mono text-xs text-muted-foreground">{r.rollNumber || "—"}</td>
                                <td className="border-b border-border/50 px-3 py-2 text-right tabular-nums">{inr(r.totalFee)}</td>
                                <td className="border-b border-border/50 px-3 py-2 text-right tabular-nums text-green-700">{inr(r.paid)}</td>
                                <td
                                  className={`border-b border-border/50 px-3 py-2 text-right tabular-nums ${
                                    r.pending > 0 ? "font-semibold text-red-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {inr(r.pending)}
                                </td>
                                <td
                                  className={`border-b border-border/50 px-3 py-2 text-right tabular-nums ${
                                    r.lateFee > 0 ? "text-red-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {inr(r.lateFee)}
                                </td>
                                <td
                                  className={`border-b border-border/50 px-3 py-2 text-right tabular-nums ${
                                    r.concession > 0 ? "text-green-700" : "text-muted-foreground"
                                  }`}
                                >
                                  {inr(r.concession)}
                                </td>
                                <td className="border-b border-border/50 px-3 py-2 text-center text-muted-foreground">
                                  {r.dueDate ? fmtDue(r.dueDate) : "—"}
                                </td>
                                <td className="border-b border-border/50 px-3 py-2 text-center">
                                  <span className={statusPillClass(r.status === "paid" ? "success" : "destructive")}>
                                    {r.status === "paid" ? "Paid" : "Unpaid"}
                                  </span>
                                </td>
                              </tr>
                              {finOpen.has(r._id) && (
                                <tr>
                                  <td colSpan={10} className="border-b border-border/50 bg-muted/40 px-3 py-3">
                                    <div className="pl-10 pr-4">
                                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                                        Fee heads — {r.name} · {monthLabel(finApplied.month)}
                                      </p>
                                      {r.heads.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No fee obligations for this month.</p>
                                      ) : (
                                        <table className="w-full border-separate border-spacing-0 text-xs">
                                          <thead>
                                            <tr>
                                              <th className="w-56 py-1.5 pr-3 text-left font-semibold text-muted-foreground">Fee Head</th>
                                              <th className="w-24 py-1.5 pr-3 text-left font-semibold text-muted-foreground">Type</th>
                                              <th className="py-1.5 pr-3 text-right font-semibold text-muted-foreground">Total</th>
                                              <th className="py-1.5 pr-3 text-right font-semibold text-muted-foreground">Paid</th>
                                              <th className="py-1.5 pr-3 text-right font-semibold text-muted-foreground">Pending</th>
                                              <th className="py-1.5 pr-3 text-right font-semibold text-muted-foreground">Late Fee</th>
                                              <th className="py-1.5 pr-3 text-right font-semibold text-muted-foreground">Concession</th>
                                              <th className="w-24 py-1.5 pr-3 text-center font-semibold text-muted-foreground">Due Date</th>
                                              <th className="w-28 py-1.5 text-center font-semibold text-muted-foreground">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {r.heads.map((h, hi) => (
                                              <tr key={`${r._id}-h-${hi}`} className="border-t border-border/40">
                                                <td className="py-1.5 pr-3 font-medium text-foreground">{h.title}</td>
                                                <td className="py-1.5 pr-3 text-muted-foreground">{freqLabel(h.frequency)}</td>
                                                <td className="py-1.5 pr-3 text-right tabular-nums">{h.dueThisMonth ? inr(h.totalFee) : "—"}</td>
                                                <td className="py-1.5 pr-3 text-right tabular-nums text-green-700">
                                                  {h.dueThisMonth ? inr(h.paid) : "—"}
                                                </td>
                                                <td
                                                  className={`py-1.5 pr-3 text-right tabular-nums ${
                                                    h.dueThisMonth && h.pending > 0 ? "font-semibold text-red-600" : "text-muted-foreground"
                                                  }`}
                                                >
                                                  {h.dueThisMonth ? inr(h.pending) : "—"}
                                                </td>
                                                <td
                                                  className={`py-1.5 pr-3 text-right tabular-nums ${
                                                    h.lateFee > 0 ? "text-red-600" : "text-muted-foreground"
                                                  }`}
                                                >
                                                  {h.dueThisMonth ? inr(h.lateFee) : "—"}
                                                </td>
                                                <td
                                                  className={`py-1.5 pr-3 text-right tabular-nums ${
                                                    h.concession > 0 ? "text-green-700" : "text-muted-foreground"
                                                  }`}
                                                >
                                                  {h.dueThisMonth ? inr(h.concession) : "—"}
                                                </td>
                                                <td className="py-1.5 pr-3 text-center text-muted-foreground">
                                                  {h.dueThisMonth && h.dueDate ? fmtDue(h.dueDate) : "—"}
                                                </td>
                                                <td className="py-1.5 text-center">
                                                  {h.status === "not-due" ? (
                                                    <span className="text-muted-foreground">Not due</span>
                                                  ) : (
                                                    <span className={statusPillClass(h.status === "paid" ? "success" : "destructive")}>
                                                      {h.status === "paid" ? "Paid" : "Unpaid"}
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                      {finRows.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold">
                            <td colSpan={2} className="sticky left-0 z-10 bg-muted border-t border-border/60 px-3 py-2.5 text-left">
                              Total · {finRows.length}
                              {finQuery ? ` of ${finData.rows.length}` : ""} students
                            </td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5" />
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-right tabular-nums">{inr(finTotals.fee)}</td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-right tabular-nums">{inr(finTotals.paid)}</td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-right tabular-nums">{inr(finTotals.pending)}</td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-right tabular-nums text-red-600">{inr(finTotals.late)}</td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-right tabular-nums text-green-700">{inr(finTotals.con)}</td>
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5" />
                            <td className="bg-muted border-t border-border/60 px-3 py-2.5 text-center">
                              <span className={statusPillClass(feeRateTone(finRate))}>{finRate.toFixed(2)}%</span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
