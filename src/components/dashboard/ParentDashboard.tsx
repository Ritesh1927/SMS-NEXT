"use client";

import { useEffect, useState } from "react";
import { Loader2, GraduationCap, Hash, CalendarCheck, Award, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { loadRazorpayScript, openRazorpayCheckout, type RazorpayOrderResponse } from "@/lib/razorpay-client";

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
              <ChildFees studentId={child._id} childName={child.name} />
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

interface FeeLine {
  _id: string;
  title: string;
  amount: number;
  paidAmount: number;
  status: "paid" | "pending" | "partial" | "overdue";
}

interface FeesResponse {
  success: boolean;
  data: { fees: FeeLine[]; summary: { paid: number; pending: number; total: number } };
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

function ChildFees({ studentId, childName }: { studentId: string; childName: string }) {
  const [fees, setFees] = useState<FeeLine[] | null>(null);
  const [summary, setSummary] = useState<{ paid: number; pending: number; total: number } | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<FeesResponse>(`/fees/student/${studentId}`, token)
      .then((res) => {
        setFees(res.data.fees);
        setSummary(res.data.summary);
      })
      .catch(() => {});
  };

  useEffect(load, [studentId]);

  const handlePay = async (fee: FeeLine) => {
    const token = getToken();
    if (!token) return;
    setPayingId(fee._id);
    try {
      await loadRazorpayScript();

      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ feePaymentId: fee._id, amount: fee.amount - fee.paidAmount }),
      });
      const orderJson: RazorpayOrderResponse & { message?: string } = await orderRes.json();
      if (!orderRes.ok || !orderJson.success) throw new Error(orderJson.message || "Failed to start payment.");

      const { orderId, amount, currency, keyId } = orderJson.data;

      const rzp = openRazorpayCheckout({
        key: keyId,
        amount: Math.round(amount * 100),
        currency,
        name: childName,
        description: fee.title,
        order_id: orderId,
        theme: { color: "#2563EB" },
        prefill: { name: childName },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...response, feePaymentId: fee._id }),
            });
            const verifyJson: ApiMessageResponse = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) throw new Error(verifyJson.message || "Verification failed.");
            toast.success("Payment successful!");
            load();
          } catch (err) {
            toast.error("Payment verification failed", { description: err instanceof Error ? err.message : "Contact the school." });
          } finally {
            setPayingId(null);
          }
        },
      });
      rzp.on("payment.failed", (response) => {
        toast.error("Payment failed", { description: response.error?.description || "Please try again." });
        setPayingId(null);
      });
      rzp.open();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to start payment." });
      setPayingId(null);
    }
  };

  if (!summary || summary.total === 0) return null;

  const color = summary.pending === 0 ? "text-green-600" : "text-amber-600";
  const pendingFees = (fees || []).filter((f) => f.status !== "paid");

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <Wallet className={`h-3.5 w-3.5 ${color}`} />
        <span className={`font-semibold ${color}`}>
          {summary.pending === 0 ? "Fully paid" : `₹${summary.pending.toLocaleString()} pending`}
        </span>
        <span className="text-[#94A3B8]">of ₹{summary.total.toLocaleString()}</span>
      </div>
      {pendingFees.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {pendingFees.map((f) => (
            <div key={f._id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#64748B]">
                {f.title} — ₹{(f.amount - f.paidAmount).toLocaleString()}
              </span>
              <Button
                size="xs"
                onClick={() => handlePay(f)}
                disabled={payingId === f._id}
                className="gap-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-[10px] h-6"
              >
                {payingId === f._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                Pay
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
