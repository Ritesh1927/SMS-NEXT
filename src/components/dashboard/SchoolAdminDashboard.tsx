"use client";

import { useEffect, useState } from "react";
import { Users, GraduationCap, UserRound, TrendingUp, Loader2 } from "lucide-react";
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

interface DashboardData {
  stats: DashboardStats;
  studentsByClass: { name: string; count: number }[];
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

  const { stats, studentsByClass } = data;
  const maxClassCount = Math.max(1, ...studentsByClass.map((c) => c.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554]">
          {schoolName ? `${schoolName} Dashboard` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Here&apos;s what&apos;s happening at your school.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>

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
    </div>
  );
}
