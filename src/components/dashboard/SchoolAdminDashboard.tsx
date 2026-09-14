"use client";

import { useEffect, useState } from "react";
import { Users, GraduationCap, UserRound, TrendingUp, CalendarCheck, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  newStudentsThisMonth: number;
  newTeachersThisMonth: number;
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

interface DashboardData {
  stats: DashboardStats;
  studentsByClass: { name: string; count: number }[];
  todayAttendance: TodayAttendance;
  attendanceTrend: AttendanceTrendDay[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export function SchoolAdminDashboard({ schoolName }: { schoolName?: string }) {
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

  const { stats, studentsByClass, todayAttendance, attendanceTrend } = data;
  const maxClassCount = Math.max(1, ...studentsByClass.map((c) => c.count));
  const attendanceRate =
    todayAttendance.marked > 0
      ? Math.round(((todayAttendance.present + todayAttendance.late) / todayAttendance.marked) * 100)
      : null;
  const maxTrendCount = Math.max(1, ...attendanceTrend.flatMap((d) => [d.present, d.absent]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554]">
          {schoolName ? `${schoolName} Dashboard` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Here&apos;s what&apos;s happening at your school.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]">
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

        <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="h-4 w-4 text-[#16A34A]" />
            <h2 className="text-sm font-semibold text-[#172554]">Attendance — Last 7 Days</h2>
          </div>
          {attendanceTrend.every((d) => d.present === 0 && d.absent === 0) ? (
            <p className="text-sm text-[#64748B]">No attendance marked in the last 7 days.</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-28">
              {attendanceTrend.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 h-20">
                    <div
                      className="w-2.5 rounded-t-sm bg-[#16A34A]"
                      style={{ height: `${(d.present / maxTrendCount) * 100}%` }}
                      title={`${d.present} present`}
                    />
                    <div
                      className="w-2.5 rounded-t-sm bg-[#EF4444]"
                      style={{ height: `${(d.absent / maxTrendCount) * 100}%` }}
                      title={`${d.absent} absent`}
                    />
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
