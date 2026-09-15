"use client";

import { useEffect, useState } from "react";
import {
  Users, GraduationCap, UserRound, TrendingUp, CalendarCheck, Loader2, IndianRupee,
  CalendarDays, ClipboardList, Receipt, BellRing,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
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
  title: string;
  amount: number;
  paidAmount: number;
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTIVITY_ICON: Record<ActivityItem["type"], typeof Receipt> = {
  fee: Receipt,
  student: Users,
  notice: BellRing,
};

const panelClass = "rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]";

export function SchoolAdminDashboard({ adminName, schoolName }: { adminName?: string; schoolName?: string }) {
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
    return (
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  const { stats, studentsByClass, todayAttendance, attendanceTrend, feeMonthly, classPerformance, upcomingExams, pendingFeeStudents, recentActivity } = data;
  const maxClassCount = Math.max(1, ...studentsByClass.map((c) => c.count));
  const attendanceRate =
    todayAttendance.marked > 0
      ? Math.round(((todayAttendance.present + todayAttendance.late) / todayAttendance.marked) * 100)
      : null;
  const maxTrendCount = Math.max(1, ...attendanceTrend.flatMap((d) => [d.present, d.absent]));

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-[22px] border border-[#E2E8F0] bg-gradient-to-br from-[#EEF2FF] via-[#F5F3FF] to-white">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-[#7C3AED]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#2563EB]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-bold text-[#172554]">
              {getGreeting()}, <span className="text-[#2563EB]">{adminName || "Admin"}</span>
            </h1>
            <p className="text-sm text-[#475569] mt-1.5">
              Here&apos;s what&apos;s happening at {schoolName || "your school"} today.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/80 backdrop-blur px-4 py-2.5 border border-white shadow-sm shrink-0 self-start sm:self-auto">
            <CalendarDays className="h-4 w-4 text-[#2563EB]" />
            <span className="text-sm font-semibold text-[#172554]">
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Students"
          value={String(stats.totalStudents)}
          trend={stats.newStudentsThisMonth > 0 ? `+${stats.newStudentsThisMonth} this month` : undefined}
          color="#2563EB"
          colorDark="#1D4ED8"
          icon={GraduationCap}
        />
        <StatCard
          title="Total Teachers"
          value={String(stats.totalTeachers)}
          trend={stats.newTeachersThisMonth > 0 ? `+${stats.newTeachersThisMonth} this month` : undefined}
          color="#7C3AED"
          colorDark="#6D28D9"
          icon={Users}
        />
        <StatCard
          title="Total Parents"
          value={String(stats.totalParents)}
          color="#0EA5E9"
          colorDark="#0284C7"
          icon={UserRound}
        />
        <StatCard
          title="Today's Attendance"
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          trend={
            todayAttendance.marked > 0
              ? `${todayAttendance.present + todayAttendance.late}/${todayAttendance.marked} marked present`
              : "Not marked yet"
          }
          color="#16A34A"
          colorDark="#15803D"
          icon={CalendarCheck}
        />
        <StatCard
          title="Fee Collection"
          value={`₹${stats.feeCollectedThisMonth.toLocaleString()}`}
          trend="This month"
          color="#F59E0B"
          colorDark="#D97706"
          icon={IndianRupee}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#172554]">Attendance — Last 7 Days</h2>
          </div>
          {attendanceTrend.every((d) => d.present === 0 && d.absent === 0) ? (
            <p className="text-sm text-[#64748B]">No attendance marked in the last 7 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} domain={[0, maxTrendCount]} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Area type="monotone" dataKey="present" name="Present" stroke="#16A34A" fill="#16A34A" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="h-4 w-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-[#172554]">Fee Collection — Last 6 Months</h2>
          </div>
          {feeMonthly.every((m) => m.collected === 0 && m.pending === 0) ? (
            <p className="text-sm text-[#64748B]">No fee records yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={feeMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Bar dataKey="collected" name="Collected" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#172554]">Students by Class</h2>
          </div>
          {studentsByClass.length === 0 ? (
            <p className="text-sm text-[#64748B]">No students enrolled yet.</p>
          ) : (
            <div className="space-y-3">
              {studentsByClass.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-[#475569]">{c.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED]"
                      style={{ width: `${(c.count / maxClassCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-[#172554]">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-fuchsia-600" />
            <h2 className="text-sm font-semibold text-[#172554]">Class Performance</h2>
          </div>
          {classPerformance.length === 0 ? (
            <p className="text-sm text-[#64748B]">No published results yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, "Average"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                <Bar dataKey="avg" name="Average %" fill="#C026D3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#172554]">Upcoming Exams</h2>
          </div>
          {upcomingExams.length === 0 ? (
            <p className="text-sm text-[#64748B]">No upcoming exams scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingExams.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#172554] truncate">{e.title}</p>
                    <p className="text-xs text-[#64748B]">{e.class}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#2563EB] shrink-0">
                    {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-[#172554]">Pending Fees</h2>
          </div>
          {pendingFeeStudents.length === 0 ? (
            <p className="text-sm text-[#64748B]">No pending fees. Everyone&apos;s paid up.</p>
          ) : (
            <div className="space-y-2.5">
              {pendingFeeStudents.map((f) => (
                <div key={f._id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#172554] truncate">{f.student?.name || "Unknown student"}</p>
                    <p className="text-xs text-[#64748B]">{f.title}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 shrink-0">
                    ₹{(f.amount - f.paidAmount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={panelClass}>
        <div className="flex items-center gap-2 mb-4">
          <BellRing className="h-4 w-4 text-[#7C3AED]" />
          <h2 className="text-sm font-semibold text-[#172554]">Recent Activity</h2>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-[#64748B]">Nothing new yet.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.type];
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-[#F1F5F9] flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-[#475569]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#172554]">{a.text}</p>
                  </div>
                  <span className="text-xs text-[#94A3B8] shrink-0">{timeAgo(a.time)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
