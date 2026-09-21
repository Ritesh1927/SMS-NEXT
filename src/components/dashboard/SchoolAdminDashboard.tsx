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
import { statusPillClass } from "@/lib/statusStyles";
import { PageLoader } from "@/components/PageLoader";

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
  date: string;
  class: string;
}

interface PendingFeeStudent {
  _id: string;
  pendingAmount: number;
  count: number;
  dueDate: string | null;
  student: { name: string; class: string; section: string } | null;
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
  pendingFeeStudents: PendingFeeStudent[];
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

  const { stats, studentsByClass, todayAttendance, attendanceTrend, feeMonthly, classPerformance, upcomingExams, pendingFeeStudents, recentActivity } = data;
  const attendanceRate =
    todayAttendance.marked > 0
      ? Math.round(((todayAttendance.present + todayAttendance.late) / todayAttendance.marked) * 100)
      : null;
  const hasClassPerformance = classPerformance.some((c) => c.avg > 0);

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
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`₹${Number(v).toLocaleString()}`, ""]} />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass-panel">
            <h3 className="text-base font-semibold text-foreground mb-4">Class Performance</h3>
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

          <div className="glass-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Pending Fees</h3>
              <span className={statusPillClass("warning")}>{pendingFeeStudents.length} pending</span>
            </div>
            {pendingFeeStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending fees. Everyone&apos;s paid up.</p>
            ) : (
              <div className="space-y-2">
                {pendingFeeStudents.map((f) => (
                  <div key={f._id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold bg-primary/10 text-primary border border-border">
                        {(f.student?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.student?.name || "Unknown student"}</p>
                        <p className="text-xs text-muted-foreground truncate">{f.count > 1 ? `${f.count} fees pending` : "1 fee pending"}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-destructive shrink-0">₹{f.pendingAmount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="glass-panel">
            <h3 className="text-base font-semibold text-foreground mb-4">Upcoming Exams</h3>
            {upcomingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming exams scheduled.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingExams.map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted hover:bg-border transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.class}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0">
                      {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <SchoolCalendar />
          </div>
        </div>

        {studentsByClass.length > 0 && (
          <div className="glass-panel mt-4">
            <h3 className="text-base font-semibold text-foreground mb-4">Students by Class</h3>
            <div className="space-y-3">
              {studentsByClass.map((c) => {
                const max = Math.max(1, ...studentsByClass.map((x) => x.count));
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{c.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(c.count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right text-xs font-semibold text-foreground">{c.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .glass-panel {
          background: white;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.09), 0 2px 4px rgba(15, 23, 42, 0.06), 0 16px 32px -14px rgba(79, 70, 229, 0.15);
        }
      `}</style>
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
          <div className="divide-y divide-border">
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

// sms-next has no Event/Calendar model yet (a real school-events feature is
// separate scope from matching the original's dashboard *look*), so this
// mirrors the original's own empty state exactly rather than fabricating
// event data.
function UpcomingEvents() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px]" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
      <DashboardSectionHeader
        icon={CalendarDays}
        title="Upcoming Events"
        subtitle="Stay updated with important events"
        accent="purple"
        variant="dark"
        decoration={<HeaderDotGridGlyph />}
      />
      <div className="flex flex-1 flex-col bg-card p-6 sm:p-7">
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No Upcoming Events</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">New events will appear here once scheduled.</p>
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Same rationale as UpcomingEvents: a real month-grid calendar, just with no
// events wired up yet since there's no Event backend — matches the
// original's own empty ("No upcoming events") state honestly.
function SchoolCalendar() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">School Calendar</h3>
      </div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => changeMonth(-1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[month]} {year}</p>
        <button type="button" onClick={() => changeMonth(1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Next month">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <p key={d} className="text-center text-[11px] font-medium text-muted-foreground/70">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`h-9 rounded-lg flex items-center justify-center text-sm ${
              day ? (isToday(day) ? "bg-primary text-white font-semibold" : "text-foreground hover:bg-muted") : ""
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center py-2">No upcoming events.</p>
    </div>
  );
}
