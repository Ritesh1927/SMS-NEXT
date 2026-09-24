"use client";

import { useEffect, useState } from "react";
import { Users, Layers, BookOpen, CalendarCheck, ClipboardList, TrendingUp, IndianRupee } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatCard } from "@/components/StatCard";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { DashboardHero } from "./DashboardHero";
import { EmptyStateCompact } from "@/components/EmptyState";
import { statusPillClass, type StatusTone } from "@/lib/statusStyles";
import { PageLoader } from "@/components/PageLoader";

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

const panelClass = "rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]";

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

  const { teacher, stats, classBreakdown, weeklyTrend, weeklyTrendMonth, classPerformance } = data;

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

      {fees && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Total Collected"
            value={`₹${fees.summary.totalPaid.toLocaleString("en-IN")}`}
            trend={fees.summary.paidCount ? `${fees.summary.paidCount} students paid` : "No payments yet"}
            color="#22C55E"
            colorDark="#16A34A"
            icon={IndianRupee}
          />
          <StatCard
            title="Pending Dues"
            value={`₹${fees.summary.totalPending.toLocaleString("en-IN")}`}
            trend={fees.summary.pendingCount ? `${fees.summary.pendingCount} students pending` : "All clear"}
            color="#F59E0B"
            colorDark="#D97706"
            icon={IndianRupee}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">
              Weekly Attendance Trend{weeklyTrendMonth ? ` — ${weeklyTrendMonth}` : ""}
            </h2>
          </div>
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
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-fuchsia-600" />
            <h2 className="text-sm font-semibold text-foreground">Class Performance Average</h2>
          </div>
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
        </div>
      </div>

      {teacher.subjects.length > 0 && (
        <div className={panelClass}>
          <h2 className="text-sm font-semibold text-foreground mb-2">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {teacher.subjects.map((s) => (
              <span key={s} className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={panelClass}>
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> My Classes
        </h2>
        {classBreakdown.length === 0 ? (
          <EmptyStateCompact message="No classes assigned yet. Ask your school admin to assign classes on your profile." />
        ) : (
          <div className="space-y-3">
            {classBreakdown.map((c) => (
              <div key={c.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.studentCount} students</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {fees && fees.data.length > 0 && (
        <div className={panelClass}>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary" /> Student Fee Details
          </h2>
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
        </div>
      )}
    </div>
  );
}
