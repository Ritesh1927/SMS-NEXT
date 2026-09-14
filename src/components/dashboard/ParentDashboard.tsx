"use client";

import { useEffect, useState } from "react";
import { Loader2, GraduationCap, Hash, CalendarCheck, Award, Wallet } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

interface Child {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  photo?: string;
  isActive: boolean;
}

interface ParentDashboardData {
  parent: { name: string; email: string; phone?: string; relation: string };
  children: Child[];
}

interface ParentDashboardResponse {
  success: boolean;
  data: ParentDashboardData;
}

export function ParentDashboard() {
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentDashboardResponse>("/dashboard/parent", token)
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

  const { children } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554]">Welcome, {data.parent.name}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {children.length === 0
            ? "No children linked to your account yet."
            : `You have ${children.length} ${children.length === 1 ? "child" : "children"} linked to your account.`}
        </p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">Contact your school admin if this seems wrong.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children.map((child) => (
            <div
              key={child._id}
              className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center overflow-hidden">
                  {child.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={child.photo} alt={child.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold">{child.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#172554]">{child.name}</p>
                  <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                    <Hash className="h-3 w-3" /> {child.studentId}
                  </p>
                </div>
                {!child.isActive && (
                  <span className="ml-auto text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-[#475569] border-t border-[#F1F5F9] pt-3">
                <GraduationCap className="h-3.5 w-3.5 text-[#2563EB]" />
                Class {child.class}
                {child.section ? `-${child.section}` : ""} · Roll {child.rollNumber || "—"}
              </div>
              {child.admissionNo && (
                <p className="mt-1 text-xs text-[#94A3B8]">Admission No: {child.admissionNo}</p>
              )}
              <ChildAttendance studentId={child._id} />
              <ChildResults studentId={child._id} />
              <ChildFees studentId={child._id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AttendanceSummaryResponse {
  success: boolean;
  data: { summary: { total: number; percentage: number } };
}

function ChildAttendance({ studentId }: { studentId: string }) {
  const [percentage, setPercentage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const now = new Date();
    apiGet<AttendanceSummaryResponse>(
      `/attendance/student/${studentId}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      token,
    )
      .then((res) => {
        setPercentage(res.data.summary.percentage);
        setTotal(res.data.summary.total);
      })
      .catch(() => {});
  }, [studentId]);

  if (percentage === null || total === 0) return null;

  const color = percentage >= 90 ? "text-green-600" : percentage >= 75 ? "text-amber-600" : "text-red-600";

  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs">
      <CalendarCheck className={`h-3.5 w-3.5 ${color}`} />
      <span className={`font-semibold ${color}`}>{percentage}% attendance</span>
      <span className="text-[#94A3B8]">this month</span>
    </div>
  );
}

interface ResultRow {
  exam?: { title: string; subject: string } | null;
  marksObtained: number;
  totalMarks: number;
  grade: string;
}

interface ResultsSummaryResponse {
  success: boolean;
  data: { results: ResultRow[]; averagePercentage: number };
}

function ChildResults({ studentId }: { studentId: string }) {
  const [data, setData] = useState<{ results: ResultRow[]; averagePercentage: number } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ResultsSummaryResponse>(`/results/student/${studentId}`, token)
      .then((res) => setData(res.data))
      .catch(() => {});
  }, [studentId]);

  if (!data || data.results.length === 0) return null;

  const color = data.averagePercentage >= 75 ? "text-green-600" : data.averagePercentage >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <Award className={`h-3.5 w-3.5 ${color}`} />
        <span className={`font-semibold ${color}`}>{data.averagePercentage}% average</span>
        <span className="text-[#94A3B8]">across {data.results.length} result{data.results.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {data.results.slice(0, 3).map((r, i) => (
          <p key={i} className="text-[11px] text-[#64748B]">
            {r.exam?.subject || r.exam?.title || "Exam"}: {r.marksObtained}/{r.totalMarks} ({r.grade})
          </p>
        ))}
      </div>
    </div>
  );
}

interface FeesSummaryResponse {
  success: boolean;
  data: { summary: { paid: number; pending: number; total: number } };
}

function ChildFees({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<{ paid: number; pending: number; total: number } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<FeesSummaryResponse>(`/fees/student/${studentId}`, token)
      .then((res) => setSummary(res.data.summary))
      .catch(() => {});
  }, [studentId]);

  if (!summary || summary.total === 0) return null;

  const color = summary.pending === 0 ? "text-green-600" : "text-amber-600";

  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs">
      <Wallet className={`h-3.5 w-3.5 ${color}`} />
      <span className={`font-semibold ${color}`}>
        {summary.pending === 0 ? "Fully paid" : `₹${summary.pending.toLocaleString()} pending`}
      </span>
      <span className="text-[#94A3B8]">of ₹{summary.total.toLocaleString()}</span>
    </div>
  );
}
