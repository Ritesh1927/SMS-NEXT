"use client";

import { useEffect, useState } from "react";
import { Users, Layers, BookOpen, CalendarCheck, ClipboardList, TrendingUp, IndianRupee, CalendarDays, Bell, ChevronRight } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatCard } from "@/components/StatCard";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { DashboardHero } from "./DashboardHero";
import { EmptyStateCompact } from "@/components/EmptyState";
import { statusPillClass, type StatusTone } from "@/lib/statusStyles";
import { PageLoader } from "@/components/PageLoader";
import { SchoolCalendar } from "./SchoolCalendarWidget";
import Link from "next/link";
import {
  DashboardSectionHeader,
  HeaderActionPill,
  HeaderBarsGlyph,
  HeaderWaveGlyph,
  HeaderPulseGlyph,
  HeaderDotGridGlyph,
} from "./DashboardSectionHeader";

interface TodayPeriod {
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  classLabel: string;
  status: "done" | "ongoing" | "upcoming";
}

interface ClassSummaryRow {
  classId: string;
  label: string;
  total: number;
  present: number;
  absent: number;
  pct: number | null;
}

interface ActivityItem {
  type: "attendance" | "homework" | "notice";
  text: string;
  time: string;
}

interface TeacherDashboardData {
  teacher: {
    name: string;
    teacherId: string;
    designation?: string;
    subjects: string[];
    staffType: string;
  };
  stats: {
    classCount: number;
    totalStudents: number;
    todayAttendancePct: number | null;
    pendingHomework: number;
  };
  classBreakdown: { label: string; studentCount: number }[];
  weeklyTrendMonth: string;
  weeklyTrend: { week: string; label: string; rate: number }[];
  classPerformance: { name: string; avg: number }[];
  todaySchedule: TodayPeriod[];
  classSummary: ClassSummaryRow[];
  recentActivity: ActivityItem[];
}

interface TeacherDashboardResponse {
  success: boolean;
  data: TeacherDashboardData;
}

interface FeeRow {
  _id: string;
  name: string;
  class: string;
  section: string;
  rollNumber: string;
  totalDue: number;
  totalPaid: number;
  pendingAmount: number;
  feeStatus: "clear" | "pending" | "partial" | "paid";
}

interface FeeSummaryResponse {
  success: boolean;
  data: FeeRow[];
  summary: { totalDue: number; totalPaid: number; totalPending: number; paidCount: number; pendingCount: number };
}

const FEE_STATUS_TONE: Record<FeeRow["feeStatus"], StatusTone> = {
  paid: "success",
  clear: "success",
  partial: "info",
  pending: "warning",
};

// Region card matching the admin dashboard's colourful look: dark gradient
// header banner (DashboardSectionHeader variant="dark") flush on top of the
// card body — same border/shadow/rounded container the admin analytics cards
// use.
function RegionCard({
  icon,
  title,
  subtitle,
  accent,
  decoration,
  rightAction,
  children,
  className = "",
}: {
  icon: typeof Bell;
  title: string;
  subtitle?: string;
  accent?: "blue" | "green" | "purple" | "orange";
  decoration?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card overflow-hidden rounded-[20px] ${className}`}
      style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}
    >
      <DashboardSectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        accent={accent}
        variant="dark"
        decoration={decoration}
        rightAction={rightAction}
      />
      <div className="bg-card p-6">{children}</div>
    </div>
  );
}

const SCHEDULE_STATUS: Record<TodayPeriod["status"], { label: string; tone: StatusTone }> = {
  ongoing: { label: "Ongoing", tone: "success" },
  upcoming: { label: "Upcoming", tone: "info" },
  done: { label: "Finished", tone: "neutral" },
};

const ACTIVITY_CONFIG: Record<ActivityItem["type"], { icon: typeof Bell; from: string; to: string; label: string }> = {
  attendance: { icon: CalendarCheck, from: "#16A34A", to: "#059669", label: "Attendance Marked" },
  homework: { icon: ClipboardList, from: "#F59E0B", to: "#D97706", label: "Homework Assigned" },
  notice: { icon: Bell, from: "#8B5CF6", to: "#7C3AED", label: "Notice Published" },
};

// Ref-style "My Classes" list: each row gets a tinted class chip (1A, 2A,
// …) cycling through a small palette, like the reference dashboard.
const CLASS_CHIP_COLORS = [
  { bg: "#EEF4FF", fg: "#4F46E5" },
  { bg: "#F0F9FF", fg: "#0284C7" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#FFFBEB", fg: "#D97706" },
  { bg: "#F5F3FF", fg: "#7C3AED" },
];

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

const pctTone = (pct: number): StatusTone => (pct >= 90 ? "success" : pct >= 75 ? "warning" : "destructive");

export function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fees, setFees] = useState<FeeSummaryResponse | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<TeacherDashboardResponse>("/dashboard/teacher", token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."));
    apiGet<FeeSummaryResponse>("/teachers/my-students/fees", token)
      .then(setFees)
      .catch(() => {});
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (!data) {
    return <PageLoader label="Loading dashboard..." />;
  }

  const { teacher, stats, classBreakdown, weeklyTrend, weeklyTrendMonth, classPerformance, todaySchedule, classSummary, recentActivity } = data;
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <DashboardHero
        name={teacher.name}
        subtitle={`${teacher.teacherId} · ${teacher.designation || (teacher.staffType === "teaching" ? "Teacher" : "Staff")}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Classes" value={String(stats.classCount)} color="#4F46E5" colorDark="#4338CA" icon={Layers} />
        <StatCard title="Total Students" value={String(stats.totalStudents)} color="#8B5CF6" colorDark="#7C3AED" icon={Users} />
        <StatCard
          title="Today's Attendance"
          value={stats.todayAttendancePct != null ? `${stats.todayAttendancePct}%` : "—"}
          trend={stats.todayAttendancePct != null ? undefined : "Not marked yet"}
          color="#16A34A"
          colorDark="#15803D"
          icon={CalendarCheck}
        />
        <StatCard
          title="Assignments Pending"
          value={String(stats.pendingHomework)}
          trend={stats.pendingHomework === 0 ? "All done" : undefined}
          color="#F59E0B"
          colorDark="#D97706"
          icon={ClipboardList}
        />
      </div>

      {/* Weekly trend (wide) + today's schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <RegionCard
          className="lg:col-span-2"
          icon={TrendingUp}
          title="Weekly Attendance Trend"
          subtitle={weeklyTrendMonth ? `${weeklyTrendMonth} · attendance across your classes` : "Attendance across your classes"}
          accent="blue"
          decoration={<HeaderWaveGlyph />}
        >
          {weeklyTrend.length === 0 ? (
            <EmptyStateCompact message="No attendance data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Line type="monotone" dataKey="rate" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: "#8B5CF6" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </RegionCard>

        <RegionCard
          icon={CalendarDays}
          title="Today's Schedule"
          subtitle={todayLabel}
          accent="green"
          decoration={<HeaderDotGridGlyph />}
          rightAction={
            <HeaderActionPill variant="dark">
              <Link href="/dashboard/timetable" className="flex items-center gap-1 text-white/90 hover:text-white">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </HeaderActionPill>
          }
        >
          {todaySchedule.length === 0 ? (
            <EmptyStateCompact message="No classes scheduled today." />
          ) : (
            <div className="space-y-2.5">
              {todaySchedule.map((e) => {
                const s = SCHEDULE_STATUS[e.status];
                return (
                  <div key={`${e.periodNumber}-${e.classLabel}`} className="flex items-center gap-3 rounded-xl border border-border p-2.5 transition-colors hover:bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {e.periodNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.classLabel} <span className="text-muted-foreground">·</span> {e.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : `Period ${e.periodNumber}`}
                      </p>
                    </div>
                    <span className={statusPillClass(s.tone)}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </RegionCard>
      </div>

      {/* My classes + performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <RegionCard icon={BookOpen} title="My Classes" subtitle={`${classBreakdown.length} classes assigned to you`} accent="purple" decoration={<HeaderPulseGlyph />}>
          {classBreakdown.length === 0 ? (
            <EmptyStateCompact message="No classes assigned yet. Ask your school admin to assign classes on your profile." />
          ) : (
            <div className="space-y-3">
              {classBreakdown.map((c, i) => {
                const chip = CLASS_CHIP_COLORS[i % CLASS_CHIP_COLORS.length];
                const short = c.label.replace(/^Class\s+/i, "").replace(/-/g, "");
                return (
                  <Link
                    key={c.label}
                    href="/dashboard/classes"
                    className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      style={{ background: chip.bg, color: chip.fg }}
                    >
                      {short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.studentCount} students</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </RegionCard>

        <RegionCard
          icon={ClipboardList}
          title="Class Performance Average"
          subtitle="Published exam average per class"
          accent="orange"
          decoration={<HeaderBarsGlyph />}
        >
          {classPerformance.length === 0 ? (
            <EmptyStateCompact message="No result data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}%`, "Average"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Bar dataKey="avg" fill="#33C6E7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </RegionCard>
      </div>

      {/* Recent activities + class summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <RegionCard icon={Bell} title="Recent Activities" subtitle="Your latest updates" accent="blue" decoration={<HeaderPulseGlyph />}>
          {recentActivity.length === 0 ? (
            <EmptyStateCompact message="No recent activity yet." />
          ) : (
            <div className="divide-y divide-border">
              {recentActivity.map((item, i) => {
                const cfg = ACTIVITY_CONFIG[item.type];
                return (
                  <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})` }}
                    >
                      <cfg.icon className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.text}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {timeAgo(item.time)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </RegionCard>

        <RegionCard
          icon={Users}
          title="Student Performance"
          subtitle="Class summary · today's attendance"
          accent="green"
          decoration={<HeaderBarsGlyph />}
        >
          {classSummary.length === 0 ? (
            <EmptyStateCompact message="No classes found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium text-muted-foreground">Class</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Total Students</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Present</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Absent</th>
                    <th className="p-2 text-right font-medium text-muted-foreground">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.map((row) => (
                    <tr key={row.classId} className="border-b border-border last:border-0">
                      <td className="p-2 font-medium text-foreground">{row.label}</td>
                      <td className="p-2 text-right tabular-nums text-muted-foreground">{row.total}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-green-600">{row.present}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-red-600">{row.absent}</td>
                      <td className="p-2 text-right">
                        {row.pct != null ? (
                          <span className={statusPillClass(pctTone(row.pct))}>{row.pct}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RegionCard>
      </div>

      {/* Subjects + school calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {teacher.subjects.length > 0 && (
          <RegionCard icon={Layers} title="Subjects" subtitle="Subjects you teach" accent="purple" decoration={<HeaderWaveGlyph />}>
            <div className="flex flex-wrap gap-2">
              {teacher.subjects.map((s) => (
                <span key={s} className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </RegionCard>
        )}

        <SchoolCalendar />
      </div>

      {fees && fees.data.length > 0 && (
        <RegionCard icon={IndianRupee} title="Student Fee Details" subtitle="Fee status across your students" accent="green" decoration={<HeaderBarsGlyph />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Student</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Class</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Total Due</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Pending</th>
                  <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.data.map((s) => (
                  <tr key={s._id} className="border-b border-border last:border-0">
                    <td className="p-2">
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground/70">{s.rollNumber}</p>
                    </td>
                    <td className="p-2 text-muted-foreground">{s.class}-{s.section}</td>
                    <td className="p-2 text-right font-mono text-foreground">₹{s.totalDue.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-mono text-green-600">₹{s.totalPaid.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-mono text-amber-600">₹{Math.max(0, s.pendingAmount).toLocaleString("en-IN")}</td>
                    <td className="p-2 text-center">
                      <span className={statusPillClass(FEE_STATUS_TONE[s.feeStatus])}>{s.feeStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RegionCard>
      )}
    </div>
  );
}
