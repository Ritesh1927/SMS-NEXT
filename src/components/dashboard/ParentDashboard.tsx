"use client";

import { useEffect, useState } from "react";
import { Loader2, GraduationCap, Hash, CalendarCheck, Award, Wallet, CreditCard, BookOpen, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { loadRazorpayScript, openRazorpayCheckout, type RazorpayOrderResponse } from "@/lib/razorpay-client";
import { DashboardHero } from "./DashboardHero";
import { PageLoader } from "@/components/PageLoader";

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
    return <PageLoader label="Loading dashboard..." />;
  }

  const { children } = data;

  return (
    <div className="space-y-6">
      <DashboardHero
        name={data.parent.name}
        subtitle={
          children.length === 0
            ? "No children linked to your account yet."
            : `Here's how ${children.length === 1 ? children[0].name : `your ${children.length} children`} ${children.length === 1 ? "is" : "are"} doing today.`
        }
      />

      {children.length === 0 ? (
        <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-muted-foreground">Contact your school admin if this seems wrong.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children.map((child) => (
            <div
              key={child._id}
              className="rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                  {child.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={child.photo} alt={child.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold">{child.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{child.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Hash className="h-3 w-3" /> {child.studentId}
                  </p>
                </div>
                {!child.isActive && (
                  <span className="ml-auto text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                Class {child.class}
                {child.section ? `-${child.section}` : ""} · Roll {child.rollNumber || "—"}
              </div>
              {child.admissionNo && (
                <p className="mt-1 text-xs text-muted-foreground/70">Admission No: {child.admissionNo}</p>
              )}
              <ChildAttendance studentId={child._id} />
              <ChildResults studentId={child._id} />
              <ChildUpcomingExams studentClass={child.class} studentSection={child.section} />
              <ChildFees studentId={child._id} childName={child.name} />
              <ChildHomework studentId={child._id} />
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
      <span className="text-muted-foreground/70">this month</span>
    </div>
  );
}

interface ResultRow {
  exam?: { title: string; subject: string } | null;
  marksObtained: number;
  totalMarks: number;
  grade: string;
  isAbsent: boolean;
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
        <span className="text-muted-foreground/70">across {data.results.length} result{data.results.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {data.results.slice(0, 3).map((r, i) => (
          <p key={i} className="text-[11px] text-muted-foreground">
            {r.exam?.subject || r.exam?.title || "Exam"}: {r.isAbsent ? "Absent" : `${r.marksObtained}/${r.totalMarks} (${r.grade})`}
          </p>
        ))}
      </div>
    </div>
  );
}

interface ExamRow {
  _id: string;
  title: string;
  subject: string;
  date: string;
  class: string;
  section: string;
  status: string;
}

interface ExamsResponse {
  success: boolean;
  data: ExamRow[];
}

function ChildUpcomingExams({ studentClass, studentSection }: { studentClass: string; studentSection?: string }) {
  const [exams, setExams] = useState<ExamRow[] | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ExamsResponse>(`/exams?class=${encodeURIComponent(studentClass)}`, token)
      .then((res) => {
        const now = Date.now();
        const upcoming = res.data
          .filter((e) => (!e.section || e.section === studentSection) && new Date(e.date).getTime() >= now && e.status !== "cancelled")
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 3);
        setExams(upcoming);
      })
      .catch(() => {});
  }, [studentClass, studentSection]);

  if (!exams || exams.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <ClipboardList className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-primary">{exams.length} upcoming exam{exams.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {exams.map((e) => (
          <p key={e._id} className="text-[11px] text-muted-foreground">
            {e.subject}: {e.title} — {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        ))}
      </div>
    </div>
  );
}

interface FeeMonthStatus {
  month: string;
  paid: boolean;
  amount: number;
  paidAmount: number;
  lateFee: number;
  concession: number;
}

interface FeeHeadStatus {
  _id: string;
  title: string;
  frequency: string;
  months: FeeMonthStatus[];
}

interface FeeStatusResponse {
  success: boolean;
  data: { feeHeads: FeeHeadStatus[] };
}

interface PendingLine {
  key: string;
  feeStructureId: string;
  title: string;
  month: string;
  amount: number;
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

interface PayMultiResponse {
  success: boolean;
  message?: string;
  data: { payments: { _id: string }[] };
}

function ChildFees({ studentId, childName }: { studentId: string; childName: string }) {
  const [feeHeads, setFeeHeads] = useState<FeeHeadStatus[] | null>(null);
  const [payingKey, setPayingKey] = useState<string | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<FeeStatusResponse>(`/fees/student-status/${studentId}`, token)
      .then((res) => setFeeHeads(res.data.feeHeads))
      .catch(() => {});
  };

  useEffect(load, [studentId]);

  const pendingLines: PendingLine[] = (feeHeads || []).flatMap((fh) =>
    fh.months
      .filter((m) => !m.paid)
      .map((m) => ({ key: `${fh._id}|${m.month}`, feeStructureId: fh._id, title: fh.title, month: m.month, amount: m.amount })),
  );
  const paid = (feeHeads || []).reduce((s, fh) => s + fh.months.filter((m) => m.paid).reduce((s2, m) => s2 + (m.paidAmount || 0), 0), 0);
  const pending = pendingLines.reduce((s, l) => s + l.amount, 0);
  const total = paid + pending;

  const handlePay = async (line: PendingLine) => {
    const token = getToken();
    if (!token) return;
    setPayingKey(line.key);
    try {
      const payRes = await apiPost<PayMultiResponse>(
        "/fees/pay-multi",
        { studentId, items: [{ feeStructureId: line.feeStructureId, months: [line.month] }], paymentMode: "online" },
        token,
      );
      const feePaymentId = payRes.data.payments[0]?._id;
      if (!feePaymentId) throw new Error("Payment record not created.");

      await loadRazorpayScript();

      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ feePaymentId, amount: line.amount }),
      });
      const orderJson: RazorpayOrderResponse & { message?: string } = await orderRes.json();
      if (!orderRes.ok || !orderJson.success) throw new Error(orderJson.message || "Failed to start payment.");

      const { orderId, amount, currency, keyId } = orderJson.data;

      const rzp = openRazorpayCheckout({
        key: keyId,
        amount: Math.round(amount * 100),
        currency,
        name: childName,
        description: line.title,
        order_id: orderId,
        theme: { color: "#4F46E5" },
        prefill: { name: childName },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...response, feePaymentId }),
            });
            const verifyJson: ApiMessageResponse = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) throw new Error(verifyJson.message || "Verification failed.");
            toast.success("Payment successful!");
            load();
          } catch (err) {
            toast.error("Payment verification failed", { description: err instanceof Error ? err.message : "Contact the school." });
          } finally {
            setPayingKey(null);
          }
        },
      });
      rzp.on("payment.failed", (response) => {
        toast.error("Payment failed", { description: response.error?.description || "Please try again." });
        setPayingKey(null);
      });
      rzp.open();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to start payment." });
      setPayingKey(null);
    }
  };

  if (!feeHeads || total === 0) return null;

  const color = pending === 0 ? "text-green-600" : "text-amber-600";

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <Wallet className={`h-3.5 w-3.5 ${color}`} />
        <span className={`font-semibold ${color}`}>
          {pending === 0 ? "Fully paid" : `₹${pending.toLocaleString()} pending`}
        </span>
        <span className="text-muted-foreground/70">of ₹{total.toLocaleString()}</span>
      </div>
      {pendingLines.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {pendingLines.map((l) => (
            <div key={l.key} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {l.title} — ₹{l.amount.toLocaleString()}
              </span>
              <Button
                size="xs"
                onClick={() => handlePay(l)}
                disabled={payingKey === l.key}
                className="gap-1 bg-primary hover:bg-primary/90 text-[10px] h-6"
              >
                {payingKey === l.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                Pay
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface HomeworkItem {
  _id: string;
  title: string;
  subject: string;
  dueDate: string;
  submission: { status: "submitted" | "late" | "graded"; marks: number | null } | null;
}

interface HomeworkResponse {
  success: boolean;
  data: HomeworkItem[];
}

function ChildHomework({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<HomeworkResponse>(`/homework/student/${studentId}`, token)
      .then((res) => setItems(res.data))
      .catch(() => {});
  };

  useEffect(load, [studentId]);

  const handleSubmit = async (hw: HomeworkItem) => {
    const token = getToken();
    if (!token) return;
    setSubmittingId(hw._id);
    try {
      const res = await fetch(`/api/homework/${hw._id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit.");
      toast.success(json.message || "Submitted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to submit." });
    } finally {
      setSubmittingId(null);
    }
  };

  if (!items || items.length === 0) return null;
  const pending = items.filter((h) => !h.submission);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <BookOpen className={`h-3.5 w-3.5 ${pending.length === 0 ? "text-green-600" : "text-amber-600"}`} />
        <span className={`font-semibold ${pending.length === 0 ? "text-green-600" : "text-amber-600"}`}>
          {pending.length === 0 ? "All homework submitted" : `${pending.length} homework pending`}
        </span>
      </div>
      {pending.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {pending.slice(0, 3).map((hw) => (
            <div key={hw._id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground truncate">
                {hw.subject}: {hw.title} — due {new Date(hw.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <Button
                size="xs"
                onClick={() => handleSubmit(hw)}
                disabled={submittingId === hw._id}
                className="gap-1 bg-primary hover:bg-primary/90 text-[10px] h-6 shrink-0"
              >
                {submittingId === hw._id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Done"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
