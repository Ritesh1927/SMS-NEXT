"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GraduationCap, Briefcase, CalendarCheck, IndianRupee,
  CalendarDays, FileText, Bell, CreditCard,
  UserPlus, Inbox, ArrowRight, ArrowUpRight,
  BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { DashboardSectionHeader, HeaderActionPill, HeaderBarsGlyph, HeaderWaveGlyph, HeaderPulseGlyph, HeaderDotGridGlyph } from "./DashboardSectionHeader";
import { DashboardHero } from "./DashboardHero";
import { PageLoader } from "@/components/PageLoader";
import { SchoolCalendar } from "./SchoolCalendarWidget";
import { type CalendarData } from "@/lib/holidays";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalNonTeachingStaff: number;
  newStudentsThisMonth: number;
  newTeachersThisMonth: number;
  feeCollectedThisMonth: number;
}

interface TodayAttendance {
  present: number;
  absent: number;
  late: number;
  marked: number;
}

interface AttendanceTrendDay {
  day: string;
  present: number;
  absent: number;
}

interface FeeMonth {
  month: string;
  collected: number;
  pending: number;
}

interface ClassPerf {
  name: string;
  avg: number;
}

interface UpcomingExam {
  title: string;
  class: string;
  dates: string[]; // unique ISO dates, sorted ascending
  subjects: string[];
  scheduledExamId: string | null; // set when the row came from an exam term
  examId: string; // representative subject-slot id (drill-down target)
}

interface PendingFeeClass {
  name: string;
  students: number;
  amount: number;
}

interface ActivityItem {
  type: "fee" | "student" | "notice";
  text: string;
  time: string;
}

interface DashboardData {
  stats: DashboardStats;
  studentsByClass: { name: string; count: number }[];
  todayAttendance: TodayAttendance;
  attendanceTrend: AttendanceTrendDay[];
  feeMonthly: FeeMonth[];
  classPerformance: ClassPerf[];
  upcomingExams: UpcomingExam[];
  pendingFeeByClass: PendingFeeClass[];
  recentActivity: ActivityItem[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #CDD3DD",
  borderRadius: 12,
  color: "#0F172A",
  fontSize: 13,
  boxShadow: "0 8px 24px -8px rgba(15,23,42,0.15)",
};

// Classes-page palette — the same color→colorDark pairs the Classes page
// cards use in their 135deg badges, cycled per bar so the chart matches
// the Classes page exactly.
const CLASS_BAR_GRADIENTS: [string, string][] = [
  ["#4F46E5", "#4338CA"],
  ["#0EA5E9", "#0284C7"],
  ["#8B5CF6", "#7C3AED"],
  ["#16A34A", "#15803D"],
  ["#F59E0B", "#D97706"],
  ["#EC4899", "#DB2777"],
];

// Dues bars for the Pending Fees card — assigned to classes by amount rank
// (worst class red, then orange/amber/...) even though rows display in
// class-ascending order, so the biggest concentration still reads red like
// the reference design.
const DUE_BAR_COLORS = ["#DC2626", "#EA580C", "#F59E0B", "#2563EB", "#7C3AED", "#059669"];

// Compact rupee for the dues rows/pill: ₹2.7L / ₹32.0k / ₹850
const fmtRupees = (v: number): string => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v}`;
};

// Exam row dates: same month collapses to "Oct 8, 9", otherwise each date
// keeps its month — "Oct 8, Nov 2".
const fmtExamDates = (dates: string[]): string => {
  const parts = dates.map((d) => new Date(d));
  const first = parts[0];
  const sameMonth = parts.every((d) => d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear());
  if (sameMonth) {
    return `${first.toLocaleDateString("en-US", { month: "short" })} ${parts.map((d) => d.getDate()).join(", ")}`;
  }
  return parts.map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ");
};

export function SchoolAdminDashboard({ adminName, schoolName }: { adminName?: string; schoolName?: string }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<DashboardResponse>("/dashboard/schooladmin", token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return <PageLoader label="Loading dashboard..." />;
  }

  const { stats, studentsByClass, todayAttendance, attendanceTrend, feeMonthly, classPerformance, upcomingExams, pendingFeeByClass, recentActivity } = data;
  const attendanceRate =
    todayAttendance.marked > 0
      ? Math.round(((todayAttendance.present + todayAttendance.late) / todayAttendance.marked) * 100)
      : null;
  const hasClassPerformance = classPerformance.some((c) => c.avg > 0);

  // Pending Fees card: bar fill is each class's amount vs the worst class,
  // pill shows the school-wide outstanding total. Rows arrive class-
  // ascending from the API; colours are by amount rank so the worst class
  // stays red regardless of where it sits in the list.
  const maxDue = Math.max(1, ...pendingFeeByClass.map((c) => c.amount));
  const totalDue = pendingFeeByClass.reduce((sum, c) => sum + c.amount, 0);
  const dueColorByClass = new Map<string, string>();
  [...pendingFeeByClass]
    .sort((a, b) => b.amount - a.amount)
    .forEach((c, i) => dueColorByClass.set(c.name, DUE_BAR_COLORS[i % DUE_BAR_COLORS.length]));

  const STAT_CARDS: {
    title: string;
    value: string;
    trend?: string;
    color: string;
    colorDark: string;
    icon: typeof Users;
    footerIcon: typeof Users;
    footerLabel: string;
    link: string;
    decoration: React.ReactNode;
  }[] = [
    {
      title: "Total Students",
      value: String(stats.totalStudents),
      trend: stats.newStudentsThisMonth > 0 ? `+${stats.newStudentsThisMonth} this month` : undefined,
      color: "#3B82F6",
      colorDark: "#2563EB",
      icon: GraduationCap,
      footerIcon: Users,
      footerLabel: "Active Enrollments",
      link: "/dashboard/students",
      decoration: <WaveDoodle color="#3B82F6" />,
    },
    {
      title: "Total Teachers",
      value: String(stats.totalTeachers),
      trend: stats.newTeachersThisMonth > 0 ? `+${stats.newTeachersThisMonth} this month` : undefined,
      color: "#8B5CF6",
      colorDark: "#7C3AED",
      icon: Users,
      footerIcon: GraduationCap,
      footerLabel: "Teaching Staff",
      link: "/dashboard/teachers",
      decoration: <MiniBars color="#8B5CF6" />,
    },
    {
      title: "Total Non-Teaching Staff",
      value: String(stats.totalNonTeachingStaff),
      color: "#0EA5E9",
      colorDark: "#0284C7",
      icon: Briefcase,
      footerIcon: Briefcase,
      footerLabel: "Support Staff",
      link: "/dashboard/teachers",
      decoration: <MiniBars color="#0EA5E9" />,
    },
    {
      title: "Today's Attendance",
      value: attendanceRate !== null ? `${attendanceRate}%` : "—",
      trend:
        todayAttendance.marked > 0
          ? `${todayAttendance.present + todayAttendance.late}/${todayAttendance.marked} marked present`
          : undefined,
      color: "#F59E0B",
      colorDark: "#D97706",
      icon: CalendarCheck,
      footerIcon: CalendarCheck,
      footerLabel: "Student Attendance",
      link: "/dashboard/attendance",
      decoration: <RingProgress percent={attendanceRate ?? 0} color="#F59E0B" />,
    },
    {
      title: "Fee Collection",
      value: `₹${stats.feeCollectedThisMonth.toLocaleString()}`,
      trend: "This month",
      color: "#10B981",
      colorDark: "#059669",
      icon: IndianRupee,
      footerIcon: IndianRupee,
      footerLabel: "Total Collected",
      link: "/dashboard/fees",
      decoration: <MiniBars color="#10B981" />,
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardHero
        name={adminName || "Admin"}
        subtitle={`Here's what's happening at ${schoolName || "your school"} today.`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
        {STAT_CARDS.map((s) => (
          <AdminStatCard key={s.title} {...s} onNavigate={() => router.push(s.link)} />
        ))}
      </div>

      {/* Analytics Overview */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Analytics Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={Users}
              title="Attendance Overview"
              subtitle="Track attendance trends for the current week"
              accent="blue"
              variant="dark"
              badge="Live"
              decoration={<HeaderWaveGlyph />}
              rightAction={
                <HeaderActionPill variant="dark">
                  <CalendarDays className="h-3.5 w-3.5 text-white/80" />
                  This Week
                </HeaderActionPill>
              }
            />
            <div className="bg-card p-6">
              {attendanceTrend.every((d) => d.present === 0 && d.absent === 0) ? (
                <p className="text-sm text-muted-foreground py-16 text-center">No attendance marked in the last 7 days.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={attendanceTrend} margin={{ left: -16 }}>
                    <defs>
                      <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="day" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#4F46E5" fill="url(#attendGrad)" strokeWidth={2.5} activeDot={{ r: 5, fill: "#4F46E5", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={IndianRupee}
              title="Fee Collection"
              subtitle="Track fee collection and revenue"
              accent="green"
              variant="dark"
              badge="Updated"
              decoration={<HeaderBarsGlyph />}
              rightAction={
                <HeaderActionPill variant="dark">
                  <CalendarDays className="h-3.5 w-3.5 text-white/80" />
                  Last 6 Months
                </HeaderActionPill>
              }
            />
            <div className="bg-card p-6">
              {feeMonthly.every((m) => m.collected === 0 && m.pending === 0) ? (
                <p className="text-sm text-muted-foreground py-16 text-center">No fee records yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={feeMonthly} margin={{ left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, name) => [`₹${Number(v).toLocaleString()}`, name]} />
                    <Bar dataKey="collected" name="Collected" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="pending" name="Pending" fill="#C7D2FE" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activities + upcoming events */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-5 items-stretch">
        <RecentActivities items={recentActivity} />
        <UpcomingEvents />
      </div>

      {/* More Insights */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">More Insights</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <div className="lg:col-span-2 overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={BarChart3}
              title="Class Performance"
              subtitle="Average score by class, from published results"
              accent="purple"
              variant="dark"
              decoration={<HeaderBarsGlyph />}
            />
            <div className="bg-card p-6">
              {hasClassPerformance ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={classPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Avg Score"]} />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {classPerformance.map((_, i) => (
                        <Cell key={i} fill={["#7C3AED", "#33C6E7", "#4A7DFF", "#A78BFA", "#34D399"][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyPanel icon={BarChart3} title="No Performance Data Yet" subtitle="Class averages will appear here once exam results are recorded." />
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={IndianRupee}
              title="Pending Fees"
              subtitle="Outstanding balances by class"
              accent="orange"
              variant="dark"
              decoration={<HeaderPulseGlyph />}
              rightAction={
                <HeaderActionPill variant="dark">
                  <IndianRupee className="h-3.5 w-3.5 text-white/80" />
                  {fmtRupees(totalDue)}
                </HeaderActionPill>
              }
            />
            <div className="flex-1 bg-card p-6">
              {pendingFeeByClass.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending fees. Everyone&apos;s paid up.</p>
              ) : (
                <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
                  {pendingFeeByClass.map((c) => {
                    const color = dueColorByClass.get(c.name) ?? DUE_BAR_COLORS[0];
                    const pct = Math.max(2, Math.round((c.amount / maxDue) * 100));
                    return (
                      <div key={c.name}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold" style={{ color }}>{fmtRupees(c.amount)}</p>
                            <p className="text-[11px] text-muted-foreground">{c.students} student{c.students !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-stretch">
          <div className="flex flex-col overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={FileText}
              title="Upcoming Exams"
              subtitle="Next scheduled tests"
              accent="blue"
              variant="dark"
              decoration={<HeaderDotGridGlyph />}
              rightAction={
                <HeaderActionPill variant="dark">
                  <FileText className="h-3.5 w-3.5 text-white/80" />
                  {upcomingExams.length}
                </HeaderActionPill>
              }
            />
            <div className="flex-1 bg-card p-6">
              {upcomingExams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming exams scheduled.</p>
              ) : (
                <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
                  {upcomingExams.map((e) => (
                    <button
                      key={e.examId}
                      type="button"
                      onClick={() =>
                        router.push(
                          e.scheduledExamId
                            ? `/dashboard/exams?tab=exams&term=${e.scheduledExamId}`
                            : `/dashboard/exams?tab=tests&exam=${e.examId}`,
                        )
                      }
                      title="View details"
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted p-3 text-left transition-colors hover:bg-border"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.class}
                            {e.subjects.length > 1 ? ` · ${e.subjects.length} subjects` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-primary shrink-0">{fmtExamDates(e.dates)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <SchoolCalendar />
          </div>
        </div>

        {studentsByClass.length > 0 && (
          <div className="overflow-hidden rounded-[20px] mt-4" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <DashboardSectionHeader
              icon={GraduationCap}
              title="Students by Class"
              subtitle="Enrollment distribution across classes"
              accent="blue"
              variant="dark"
              decoration={<HeaderBarsGlyph />}
            />
            <div className="bg-card p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={studentsByClass} margin={{ top: 16, left: -16, right: 8 }}>
                  <defs>
                    {/* One 135deg gradient per palette pair — same look as the Classes page badges. */}
                    {CLASS_BAR_GRADIENTS.map(([top, bottom], i) => (
                      <linearGradient key={i} id={`clsBar${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={top} />
                        <stop offset="100%" stopColor={bottom} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} interval={0} angle={studentsByClass.length > 8 ? -30 : 0} textAnchor={studentsByClass.length > 8 ? "end" : "middle"} height={studentsByClass.length > 8 ? 56 : 30} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} Students`, "Count"]} />
                  <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]} maxBarSize={48} label={{ position: "top", fill: "#334155", fontSize: 12, fontWeight: 600 }}>
                    {studentsByClass.map((_, i) => (
                      <Cell key={i} fill={`url(#clsBar${i % CLASS_BAR_GRADIENTS.length})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, subtitle }: { icon: typeof BarChart3; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-10 text-center" style={{ height: 280 }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{subtitle}</p>
    </div>
  );
}

function WaveDoodle({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 160 44" className="h-11 w-full" preserveAspectRatio="none">
      <path d="M0 30 Q 20 12, 40 26 T 80 24 T 120 28 T 160 16 V44 H0 Z" fill={color} opacity={0.12} />
      <circle cx="120" cy="26" r="5" fill={color} opacity={0.22} />
      <circle cx="134" cy="21" r="3" fill={color} opacity={0.22} />
    </svg>
  );
}

function MiniBars({ color }: { color: string }) {
  const heights = [28, 42, 34, 56, 46, 68];
  return (
    <div className="ml-auto flex h-12 items-end gap-1.5">
      {heights.map((h, i) => (
        <div key={i} className="w-2.5 rounded-t-md" style={{ height: `${h}%`, backgroundColor: color, opacity: 0.16 + i * 0.02 }} />
      ))}
    </div>
  );
}

function RingProgress({ percent, color }: { percent: number; color: string }) {
  const size = 68;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(percent, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ml-auto shrink-0" style={{ filter: `drop-shadow(0 2px 6px ${color}40)` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="#0F172A">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function AdminStatCard({
  title, value, trend, color, colorDark, icon: Icon, footerIcon: FooterIcon, footerLabel, decoration, onNavigate,
}: {
  title: string; value: string; trend?: string; color: string; colorDark: string; icon: typeof Users;
  footerIcon: typeof Users; footerLabel: string; link: string; decoration: React.ReactNode; onNavigate: () => void;
}) {
  return (
    <div
      className="group relative grid h-full grid-rows-[48px_auto_auto_1fr_auto] gap-4 overflow-hidden rounded-[18px] bg-card p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-1"
      style={{ "--accent": color } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-sm shadow-black/10" style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})` }}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
          <Icon className="relative h-5 w-5 text-white" />
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:bg-[var(--accent)] group-hover:text-white cursor-pointer"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-[32px] font-bold leading-none text-foreground">{value}</p>
      </div>

      <div className="flex items-center gap-1.5">
        {trend ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">{trend}</span>
        ) : (
          <span className="text-[13px] text-muted-foreground">No data yet</span>
        )}
      </div>

      <div className="flex items-center">{decoration}</div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FooterIcon className="h-3.5 w-3.5" />
          {footerLabel}
        </span>
        <button type="button" onClick={onNavigate} className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer" style={{ color }}>
          View Details
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

const ACTIVITY_CONFIG: Record<ActivityItem["type"], { icon: typeof Bell; from: string; to: string; label: string }> = {
  student: { icon: UserPlus, from: "#4F46E5", to: "#6366F1", label: "New Admission" },
  fee: { icon: CreditCard, from: "#22C55E", to: "#16A34A", label: "Payment Update" },
  notice: { icon: Bell, from: "#8B5CF6", to: "#7C3AED", label: "Notice Published" },
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function RecentActivities({ items }: { items: ActivityItem[] }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
      <DashboardSectionHeader
        icon={FileText}
        title="Recent Activities"
        subtitle="Latest updates from your institution"
        accent="blue"
        variant="dark"
        decoration={<HeaderPulseGlyph />}
      />
      <div className="flex flex-1 flex-col bg-card p-6 sm:p-7">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted mb-3">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          </div>
        ) : (
          <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
            {items.map((item, i) => {
              const { icon: Icon, from, to, label } = ACTIVITY_CONFIG[item.type] ?? ACTIVITY_CONFIG.notice;
              return (
                <div key={i} className="group/item flex items-center gap-4 rounded-xl px-2 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 4px 14px -2px ${from}59` }}>
                    <Icon className="h-[18px] w-[18px] text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-foreground leading-snug truncate">{item.text}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">{timeAgo(item.time)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface UpcomingEntry {
  date: string;
  name: string;
  type: "holiday" | "event";
}

interface UpcomingGroup {
  key: UpcomingEntry["type"];
  label: string;
  items: UpcomingEntry[];
}

const UPCOMING_DOT: Record<UpcomingEntry["type"], string> = {
  event: "bg-sky-500",
  holiday: "bg-violet-500",
};

// Holidays come from the same /school/holidays endpoint SchoolCalendar
// already uses (it also returns events despite the route's name -- see
// that route's own comment), scoped to the current month and only from
// today onward (today's holiday shows, it disappears tomorrow). Events
// are any future date. Everything is rendered in labelled groups with a
// title built from whichever groups are present, and there is no entry
// cap -- all matching items are listed.
function UpcomingEvents() {
  const [groups, setGroups] = useState<UpcomingGroup[] | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const byDate = (a: UpcomingEntry, b: UpcomingEntry) => a.date.localeCompare(b.date);

    apiGet<{ success: boolean; data: CalendarData }>("/school/holidays", token)
      .then((res) => {
        const toTime = (d: string) => new Date(d).getTime();
        const holidays: UpcomingEntry[] = res.data.dates
          .filter((h) => {
            const t = toTime(String(h.date));
            return t >= today.getTime() && t < firstOfNextMonth.getTime();
          })
          .map((h) => ({ date: String(h.date), name: h.name, type: "holiday" as const }));
        const events: UpcomingEntry[] = res.data.events
          .filter((e) => toTime(String(e.date)) >= today.getTime())
          .map((e) => ({ date: String(e.date), name: e.name, type: "event" as const }));

        setGroups(
          [
            { key: "holiday" as const, label: "Holidays", items: holidays.sort(byDate) },
            { key: "event" as const, label: "Events", items: events.sort(byDate) },
          ].filter((g) => g.items.length > 0),
        );
      })
      .catch(() => setGroups([]));
  }, []);

  const labels = groups?.map((g) => g.label) ?? [];
  const title =
    labels.length === 0
      ? "Upcoming"
      : labels.length === 1
        ? `Upcoming ${labels[0]}`
        : `Upcoming ${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
      <DashboardSectionHeader
        icon={CalendarDays}
        title={title}
        subtitle="Stay updated with important dates"
        accent="purple"
        variant="dark"
        decoration={<HeaderDotGridGlyph />}
      />
      <div className="flex flex-1 flex-col bg-card p-6 sm:p-7">
        {!groups || groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Nothing Upcoming</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Holidays and events will appear here once scheduled.</p>
          </div>
        ) : (
          <div className="flex max-h-[360px] flex-col gap-5 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${UPCOMING_DOT[g.key]}`} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                  <span className="text-xs text-muted-foreground">({g.items.length})</span>
                </div>
                <div className="divide-y divide-border">
                  {g.items.map((e, i) => (
                    <div key={`${e.type}-${e.date}-${i}`} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${UPCOMING_DOT[e.type]}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(e.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

