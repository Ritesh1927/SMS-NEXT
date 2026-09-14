"use client";

import { useEffect, useState } from "react";
import { Users, Layers, Loader2, BookOpen } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

interface TeacherDashboardData {
  teacher: {
    name: string;
    teacherId: string;
    designation?: string;
    subjects: string[];
    staffType: string;
  };
  stats: { classCount: number; totalStudents: number };
  classBreakdown: { label: string; studentCount: number }[];
}

interface TeacherDashboardResponse {
  success: boolean;
  data: TeacherDashboardData;
}

export function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<TeacherDashboardResponse>("/dashboard/teacher", token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  const { teacher, stats, classBreakdown } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554]">Welcome, {teacher.name}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {teacher.teacherId} · {teacher.designation || (teacher.staffType === "teaching" ? "Teacher" : "Staff")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Assigned Classes" value={String(stats.classCount)} color="#2563EB" colorDark="#1D4ED8" icon={Layers} />
        <StatCard title="My Students" value={String(stats.totalStudents)} color="#7C3AED" colorDark="#6D28D9" icon={Users} />
        <StatCard
          title="Subjects"
          value={teacher.subjects.length > 0 ? String(teacher.subjects.length) : "0"}
          color="#0EA5E9"
          colorDark="#0284C7"
          icon={BookOpen}
        />
      </div>

      {teacher.subjects.length > 0 && (
        <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <h2 className="text-sm font-semibold text-[#172554] mb-2">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {teacher.subjects.map((s) => (
              <span key={s} className="text-xs font-medium text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]">
        <h2 className="text-sm font-semibold text-[#172554] mb-4">My Classes</h2>
        {classBreakdown.length === 0 ? (
          <p className="text-sm text-[#64748B]">
            No classes assigned yet. Ask your school admin to assign classes on your profile.
          </p>
        ) : (
          <div className="space-y-3">
            {classBreakdown.map((c) => (
              <div key={c.label} className="flex items-center justify-between border-b border-[#F1F5F9] pb-2 last:border-0">
                <span className="text-sm font-medium text-[#172554]">{c.label}</span>
                <span className="text-xs text-[#64748B]">{c.studentCount} students</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
