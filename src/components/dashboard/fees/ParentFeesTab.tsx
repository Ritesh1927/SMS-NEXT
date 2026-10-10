"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard, Loader2, CheckCircle2, Wallet, IndianRupee, Download, Eye, Receipt, Calendar,
  CalendarDays, FileText, ChevronDown, DollarSign, AlertCircle, CalendarClock, Clock, Tag,
  LayoutDashboard, AlertTriangle,
} from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { loadRazorpayScript, openRazorpayCheckout, type RazorpayOrderResponse, type RazorpayCheckoutResult } from "@/lib/razorpay-client";
import { downloadReceipt, previewReceipt, generateReceiptNumber, type ReceiptData } from "@/lib/receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/PageLoader";
import { StatFilterCard } from "@/components/StatFilterCard";

interface RawMonth {
  month: string; paid: boolean; upcoming: boolean; amount: number; paidAmount: number; lateFee: number; concession: number;
  dueDate?: string | null;
  paymentId?: string | null; receiptNo?: string | null; paidDate?: string | null; paymentMode?: string | null;
}
interface RawFeeHead {
  _id: string; title: string; amount: number; frequency: string;
  concession: { type: string; value: number; isPct: boolean } | null;
  months: RawMonth[];
}
interface FeeHead {
  _id: string; title: string; amount: number; frequency: string;
  concession: { type: string; value: number; isPct: boolean } | null;
  months: RawMonth[];
}
interface PayLine {
  label: string; months: string[]; amount: number; lateFee: number; concession: number; total: number;
}
interface ChildFees {
  studentId: string;
  studentName: string;
  studentClass: string;
  section: string;
  feeHeads: FeeHead[];
  summary: { paid: number; pending: number; upcoming: number; total: number; totalLateFee: number; totalConcession: number };
}

interface ChildOption { _id: string; name: string; class: string; section?: string }
interface ParentDashboardResponse { success: boolean; data: { children: ChildOption[] } }
interface FeeStatusResponse { success: boolean; data: { feeHeads: RawFeeHead[] } }
interface HistoryItem {
  _id: string; title: string; month: string | null; amount: number; lateFee: number; concession: number; paidAmount: number; receiptNo: string | null;
}
interface HistoryGroup {
  paymentDate: string | null; paymentMode: string; totalAmount: number; receiptNo: string; itemCount: number; items: HistoryItem[];
}
interface HistoryResponse { success: boolean; data: { history: HistoryGroup[] } }
interface PayMultiResponse { success: boolean; data: { payments: { _id: string }[] } }
interface BrandingResponse {
  success: boolean;
  data: { schoolName?: string; schoolAddress?: string; schoolPhone?: string; schoolEmail?: string; logo?: string; themeColor?: string; secondaryColor?: string };
}

function getMonthLabel(month: string) {
  if (month === "one-time") return "One-time";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

function fmtDue(dueDate?: string | null) {
  if (!dueDate) return "";
  return new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

function headCounts(fh: FeeHead) {
  const unpaid = fh.months.filter((m) => !m.paid);
  return {
    paid: fh.months.length - unpaid.length,
    pending: unpaid.filter((m) => !m.upcoming).length,
    upcoming: unpaid.filter((m) => m.upcoming).length,
  };
}

// Design-only metadata for the Fee Categories selector (icon, chip colour,
// price unit, helper copy) — no fee logic lives here. Mirrors the admin
// CollectFeeTab FREQ_META so both sides look identical.
const FREQ_META: Record<string, { icon: typeof CalendarDays; chip: string; unit: string; desc: string }> = {
  monthly: {
    icon: CalendarDays,
    chip: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    unit: "/month",
    desc: "Recurring monthly fee for the academic session",
  },
  quarterly: {
    icon: FileText,
    chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    unit: "/quarter",
    desc: "Charged every 3 months across the session",
  },
  yearly: {
    icon: Wallet,
    chip: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
    unit: "/year",
    desc: "Annual fee for the academic session",
  },
  "one-time": {
    icon: IndianRupee,
    chip: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400",
    unit: "",
    desc: "One-time payment for this student",
  },
};

const SELECTED_CHILD_KEY = "sms_next_parent_selectedChild";

export default function ParentFeesTab() {
  const [children, setChildren] = useState<ChildFees[]>([]);
  const [selectedChild, setSelectedChild] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Record<string, Record<string, boolean>>>({});
  const [activeHeadId, setActiveHeadId] = useState("");
  const [payModal, setPayModal] = useState<{ open: boolean; lines: PayLine[]; total: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<HistoryGroup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchFees = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const dashRes = await apiGet<ParentDashboardResponse>("/dashboard/parent", token);
      const kids = dashRes.data.children || [];
      const results = await Promise.all(
        kids.map(async (k): Promise<ChildFees> => {
          try {
            const feeRes = await apiGet<FeeStatusResponse>(`/fees/student-status/${k._id}`, token);
            const rawHeads = [...(feeRes.data.feeHeads || [])].sort((a, b) => a.title.localeCompare(b.title));

            let totalPaid = 0, totalPending = 0, totalUpcoming = 0, total = 0, totalLateFee = 0, totalConcession = 0;
            const feeHeads: FeeHead[] = rawHeads.map((h) => {
              const paidMonths = h.months.filter((m) => m.paid);
              const pendingMonths = h.months.filter((m) => !m.paid && !m.upcoming);
              const upcomingMonths = h.months.filter((m) => !m.paid && m.upcoming);
              const headPaid = paidMonths.reduce((s, m) => s + (m.paidAmount || m.amount), 0);
              const headPending = pendingMonths.reduce((s, m) => s + Math.max(0, m.amount - (m.concession || 0)), 0);
              const headUpcoming = upcomingMonths.reduce((s, m) => s + Math.max(0, m.amount - (m.concession || 0)), 0);
              h.months.forEach((m) => {
                if (m.lateFee > 0) totalLateFee += m.lateFee;
                if (m.concession > 0) totalConcession += m.concession;
              });
              totalPaid += headPaid;
              totalPending += headPending;
              totalUpcoming += headUpcoming;
              total += headPaid + headPending + headUpcoming;
              return { _id: h._id, title: h.title, amount: h.amount, frequency: h.frequency, concession: h.concession || null, months: h.months };
            });

            return {
              studentId: k._id, studentName: k.name, studentClass: k.class, section: k.section || "",
              feeHeads, summary: { paid: totalPaid, pending: totalPending, upcoming: totalUpcoming, total, totalLateFee, totalConcession },
            };
          } catch {
            return {
              studentId: k._id, studentName: k.name, studentClass: k.class, section: k.section || "",
              feeHeads: [], summary: { paid: 0, pending: 0, upcoming: 0, total: 0, totalLateFee: 0, totalConcession: 0 },
            };
          }
        }),
      );
      setChildren(results);

      const init: Record<string, Record<string, boolean>> = {};
      results.forEach((r) => r.feeHeads.forEach((h) => { init[h._id] = {}; }));
      setSelectedMonths(init);

      const saved = typeof window !== "undefined" ? Number(localStorage.getItem(SELECTED_CHILD_KEY) || 0) : 0;
      setSelectedChild(Number.isFinite(saved) && saved < results.length ? saved : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fee data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    fetchFees();
  }, []);

  const child = children[selectedChild];
  const activeHead = child?.feeHeads.find((fh) => fh._id === activeHeadId) || child?.feeHeads[0];

  const fetchPaymentHistory = () => {
    if (!child) return;
    const token = getToken();
    if (!token) return;
    setLoadingHistory(true);
    apiGet<HistoryResponse>(`/fees/history/${child.studentId}`, token)
      .then((res) => setPaymentHistory(res.data.history || []))
      .catch(() => setPaymentHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  const fetchBranding = async (token: string) => {
    const res = await apiGet<BrandingResponse>("/school/branding", token).catch(() => null);
    return res?.data || {};
  };

  const buildGroupReceipt = async (group: HistoryGroup): Promise<ReceiptData | null> => {
    if (!child) return null;
    const token = getToken();
    if (!token) return null;
    const branding = await fetchBranding(token);
    return {
      school: branding,
      studentName: child.studentName, studentClass: child.studentClass, studentSection: child.section,
      receiptNumber: group.receiptNo || generateReceiptNumber(),
      paymentDate: group.paymentDate ? new Date(group.paymentDate).toLocaleDateString("en-IN") : "",
      paymentMode: group.paymentMode || "cash",
      feeHeadTotals: group.items.map((item) => ({
        feeHead: item.title, month: item.month || "one-time",
        amount: (item.amount || 0) - (item.lateFee || 0) + (item.concession || 0),
        lateFee: item.lateFee, concession: item.concession, total: item.paidAmount || item.amount,
      })),
      grandTotal: group.totalAmount,
    };
  };

  // Past, current, and future months are all payable -- "upcoming" is
  // informational only. The one real constraint is order: a month can't be
  // selected while an earlier unpaid month in the same fee head is neither
  // paid nor also selected in this pass.
  const toggleMonth = (feeHeadId: string, month: string) => {
    setSelectedMonths((prev) => {
      const current = prev[feeHeadId] || {};
      const fh = child?.feeHeads.find((f) => f._id === feeHeadId);
      if (!fh) return prev;
      const sorted = [...fh.months].sort((a, b) => a.month.localeCompare(b.month));
      const firstUnpaidIdx = sorted.findIndex((m) => !m.paid);
      if (firstUnpaidIdx < 0) return prev;
      const newSel = { ...current, [month]: !current[month] };
      for (let i = firstUnpaidIdx; i < sorted.length; i++) {
        const m = sorted[i];
        if (m.paid) continue;
        if (newSel[m.month]) {
          for (let j = firstUnpaidIdx; j < i; j++) {
            const pm = sorted[j];
            if (!pm.paid && !newSel[pm.month]) return prev;
          }
        } else {
          for (let k = i + 1; k < sorted.length; k++) {
            if (newSel[sorted[k].month]) return prev;
          }
          break;
        }
      }
      return { ...prev, [feeHeadId]: newSel };
    });
  };

  const toggleAllPending = (feeHeadId: string, months: { month: string; paid: boolean }[]) => {
    const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
    const firstUnpaidIdx = sorted.findIndex((m) => !m.paid);
    if (firstUnpaidIdx < 0) return;
    const current = selectedMonths[feeHeadId] || {};
    const allSelected = sorted.slice(firstUnpaidIdx).every((m) => m.paid || current[m.month]);
    const newSelection: Record<string, boolean> = {};
    if (!allSelected) sorted.slice(firstUnpaidIdx).forEach((m) => { if (!m.paid) newSelection[m.month] = true; });
    setSelectedMonths((prev) => ({ ...prev, [feeHeadId]: newSelection }));
  };

  const clearSelection = () => setSelectedMonths({});

  const summary = (child?.feeHeads || []).reduce(
    (acc, fh) => {
      const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
      if (selected.length === 0) return acc;

      let baseAmount = 0;
      let concessionTotal = 0;
      let lateFeeTotal = 0;

      if (fh.frequency === "one-time") {
        if (selected.includes("one-time")) {
          const monthData = fh.months.find((m) => m.month === "one-time");
          if (monthData && !monthData.paid) {
            baseAmount = fh.amount;
            if (monthData.concession > 0) concessionTotal = monthData.concession;
            if (monthData.lateFee > 0) lateFeeTotal = monthData.lateFee;
          }
        }
      } else {
        for (const month of selected) {
          const monthData = fh.months.find((m) => m.month === month);
          if (monthData && !monthData.paid) {
            baseAmount += fh.amount;
            if (monthData.concession > 0) concessionTotal += monthData.concession;
            if (monthData.lateFee > 0) lateFeeTotal += monthData.lateFee;
          }
        }
      }

      const itemTotal = baseAmount + lateFeeTotal - concessionTotal;
      return {
        lines: [...acc.lines, ...(baseAmount > 0 ? [{ label: fh.title, months: selected, amount: baseAmount, lateFee: lateFeeTotal, concession: concessionTotal, total: itemTotal }] : [])],
        baseAmount: acc.baseAmount + baseAmount,
        lateFee: acc.lateFee + lateFeeTotal,
        concession: acc.concession + concessionTotal,
        total: acc.total + itemTotal,
        itemCount: acc.itemCount + selected.length,
      };
    },
    { lines: [] as PayLine[], baseAmount: 0, lateFee: 0, concession: 0, total: 0, itemCount: 0 },
  );

  const handlePay = async () => {
    if (!child || summary.total <= 0) return;
    const token = getToken();
    if (!token) return;

    const items: { feeStructureId: string; months: string[] }[] = [];
    for (const fh of child.feeHeads || []) {
      const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
      if (selected.length > 0) items.push({ feeStructureId: fh._id, months: selected });
    }
    if (items.length === 0) return;

    setPaying(true);
    try {
      const payRes = await apiPost<PayMultiResponse>("/fees/pay-multi", { studentId: child.studentId, items, paymentMode: "online" }, token);
      const paymentIds = payRes.data.payments.map((p) => p._id);
      if (paymentIds.length === 0) throw new Error("Payment records not created");

      await loadRazorpayScript();
      const orderRes = await apiPost<RazorpayOrderResponse>("/payments/create-order", { feePaymentIds: paymentIds }, token);
      const { orderId, amount, currency, keyId } = orderRes.data;

      const rzp = openRazorpayCheckout({
        key: keyId,
        amount: Math.round(amount * 100),
        currency,
        name: child.studentName || "School Fee Payment",
        description: `Fee payment for ${child.studentName}`,
        order_id: orderId,
        theme: { color: "#4F46E5" },
        prefill: { name: child.studentName || "" },
        handler: async (response: RazorpayCheckoutResult) => {
          try {
            for (const pid of paymentIds) {
              await apiPost("/payments/verify", { ...response, feePaymentId: pid }, token);
            }
            toast.success("Payment successful!");
            setPayModal(null);
            setSelectedMonths({});

            try {
              const [branding, feeRes2] = await Promise.all([
                fetchBranding(token),
                apiGet<FeeStatusResponse>(`/fees/student-status/${child.studentId}`, token),
              ]);
              const paidMonths = (feeRes2.data.feeHeads || []).flatMap((fh) =>
                (fh.months || []).filter((m) => m.paid).map((m) => ({
                  feeHead: fh.title, month: m.month, amount: m.amount,
                  paidAmount: m.paidAmount || fh.amount, lateFee: m.lateFee || 0, concession: m.concession || 0,
                })),
              );
              const justPaid = paidMonths.filter((p) => {
                for (const fh of child.feeHeads) {
                  const sel = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
                  if (sel.includes(p.month) && p.feeHead === fh.title) return true;
                }
                return false;
              });
              const selectedMonthCount = child.feeHeads.reduce(
                (n, fh) => n + Object.values(selectedMonths[fh._id] || {}).filter(Boolean).length,
                0,
              );
              const receiptItems = justPaid.length > 0 ? justPaid : paidMonths.slice(-Math.max(1, selectedMonthCount));
              setReceiptData({
                school: branding,
                studentName: child.studentName, studentClass: child.studentClass, studentSection: child.section,
                receiptNumber: generateReceiptNumber(),
                paymentDate: new Date().toLocaleDateString("en-IN"),
                paymentMode: "Online (Razorpay)",
                feeHeadTotals: receiptItems.map((p) => ({
                  feeHead: p.feeHead, month: p.month, amount: (p.amount || 0) - (p.lateFee || 0) + (p.concession || 0),
                  lateFee: p.lateFee, concession: p.concession, total: p.paidAmount || p.amount,
                })),
                grandTotal: receiptItems.reduce((s, p) => s + (p.paidAmount || p.amount), 0),
              });
            } catch {
              // receipt is best-effort; the payment itself already succeeded
            }

            setLoading(true);
            await fetchFees();
          } catch {
            toast.error("Payment verification failed. Contact school.");
          } finally {
            setPaying(false);
          }
        },
      });
      rzp.on("payment.failed", (response) => {
        toast.error(response.error?.description || "Payment failed. Try again.");
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start payment.");
      setPaying(false);
    }
  };

  if (loading) {
    return <PageLoader label="Loading fee details..." />;
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fee Details</h1>
          <p className="text-sm text-muted-foreground mt-1">View and pay fees for your child.</p>
        </div>
        {children.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap">
            {children.map((c, i) => (
              <button
                key={c.studentId}
                type="button"
                onClick={() => {
                  setSelectedChild(i);
                  if (typeof window !== "undefined") localStorage.setItem(SELECTED_CHILD_KEY, String(i));
                  setSelectedMonths({});
                  setActiveHeadId("");
                }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${i === selectedChild ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {c.studentName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{c.studentName}</p>
                  <p className="text-xs text-muted-foreground">Class {c.studentClass}{c.section ? `-${c.section}` : ""}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!child ? (
        <div className="rounded-[18px] bg-card py-16 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <Wallet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No children linked to your account yet.</p>
        </div>
      ) : (
        <Tabs defaultValue="dashboard" className="space-y-6" onValueChange={(v) => { if (v === "history") fetchPaymentHistory(); }}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="fees" className="gap-2"><CreditCard className="h-4 w-4" /> Fee Details</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><Receipt className="h-4 w-4" /> Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {(() => {
              const allMonths = child.feeHeads.flatMap((fh) => fh.months);
              const now = new Date();
              const monthNowLabel = now.toLocaleString("en", { month: "short", year: "numeric" });
              const monthKeys = allMonths.filter((m) => m.month !== "one-time").map((m) => m.month).sort();
              const sessionLabel = monthKeys.length ? `${getMonthLabel(monthKeys[0])} – ${getMonthLabel(monthKeys[monthKeys.length - 1])}` : "";
              const dueKeys = allMonths.filter((m) => !m.paid && !m.upcoming && m.month !== "one-time").map((m) => m.month).sort();
              const pendingLabel = dueKeys.length ? `${getMonthLabel(dueKeys[0])} – ${getMonthLabel(dueKeys[dueKeys.length - 1])}` : "";
              const upKeys = allMonths.filter((m) => !m.paid && m.upcoming).map((m) => m.month).sort();
              const upcomingLabel = upKeys.length ? `${getMonthLabel(upKeys[0])} – ${getMonthLabel(upKeys[upKeys.length - 1])}` : "";
              const paidPct = child.summary.total > 0 ? Math.round((child.summary.paid / child.summary.total) * 100) : 0;
              const paidThisMonth = allMonths
                .filter((m) => m.paid && m.paidDate && new Date(m.paidDate).getMonth() === now.getMonth() && new Date(m.paidDate).getFullYear() === now.getFullYear())
                .reduce((s, m) => s + (m.paidAmount || 0), 0);
              const dueMonths = allMonths.filter((m) => !m.paid && !m.upcoming).sort((a, b) => a.month.localeCompare(b.month));
              const nextDue = dueMonths[0];
              const nextDueAmount = nextDue ? Math.max(0, nextDue.amount - (nextDue.concession || 0)) : 0;
              const nextDueLabel = !nextDue
                ? "No pending dues · all clear"
                : nextDue.dueDate
                  ? new Date(nextDue.dueDate) < now
                    ? `Overdue since ${fmtDue(nextDue.dueDate)} · ${getMonthLabel(nextDue.month)}`
                    : `Due ${fmtDue(nextDue.dueDate)} · ${getMonthLabel(nextDue.month)}`
                  : `${getMonthLabel(nextDue.month)} · payable now`;
              return (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatFilterCard icon={Wallet} color="#0EA5E9" colorDark="#0284C7" value={fmt(child.summary.total)} label="Total Fee (This Session)" sublabel={`${sessionLabel ? `${sessionLabel} · ` : ""}= Total Paid + Pending + Upcoming`} />
                    <StatFilterCard icon={DollarSign} color="#16A34A" colorDark="#15803D" value={fmt(child.summary.paid)} label="Total Paid" sublabel={`Paid so far · ${paidPct}% of total fee`} />
                    <StatFilterCard icon={AlertCircle} color="#F59E0B" colorDark="#D97706" value={fmt(child.summary.pending)} label="Pending Dues" sublabel={`Due till now${pendingLabel ? ` · ${pendingLabel}` : ""}`} />
                    <StatFilterCard icon={CalendarClock} color="#2563EB" colorDark="#1D4ED8" value={fmt(child.summary.upcoming)} label="Upcoming Dues" sublabel={`Next month → session end${upcomingLabel ? ` · ${upcomingLabel}` : ""}`} />
                    <StatFilterCard icon={Clock} color="#EA580C" colorDark="#C2410C" value={fmt(child.summary.totalLateFee)} label="Late Fees" sublabel="Accrued so far · inside Paid + Pending" />
                    <StatFilterCard icon={Tag} color="#0D9488" colorDark="#0F766E" value={fmt(child.summary.totalConcession)} label="Concessions" sublabel="Waived on fees · already deducted" />
                    <StatFilterCard icon={CalendarDays} color="#0891B2" colorDark="#0E7490" value={fmt(paidThisMonth)} label="Paid This Month" sublabel={`Fee paid · ${monthNowLabel}`} />
                    <StatFilterCard icon={AlertTriangle} color="#DC2626" colorDark="#B91C1C" value={fmt(nextDueAmount)} label="Next Due" sublabel={nextDueLabel} />
                  </div>
                  {child.feeHeads.length === 0 && (
                    <div className="rounded-[18px] bg-card py-16 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                      <Wallet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground">No fee structures found for your child&apos;s class.</p>
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="fees" className="space-y-6">
            {child.feeHeads.length === 0 ? (
              <div className="rounded-[18px] bg-card py-16 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <Wallet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No fee structures found for your child&apos;s class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                  {/* Left: fee category selector + active head panel */}
                  <div className="space-y-4 lg:col-span-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Fee Categories</h3>
                      <p className="text-xs text-muted-foreground">Select a fee category and choose the months to pay.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {child.feeHeads.map((fh) => {
                        const fc = headCounts(fh);
                        const fm = FREQ_META[fh.frequency] || FREQ_META.monthly;
                        const FI = fm.icon;
                        const isActive = fh._id === activeHead?._id;
                        return (
                          <button
                            key={fh._id}
                            type="button"
                            onClick={() => setActiveHeadId(fh._id)}
                            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                              isActive
                                ? "border-primary bg-primary/5 shadow-[0_2px_10px_-4px_rgba(79,70,229,0.35)]"
                                : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fm.chip}`}>
                              <FI className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className={`block truncate text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{fh.title}</span>
                              <span className="block text-xs text-muted-foreground">{fc.pending} pending · {fc.upcoming} upcoming</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active head — expanded panel */}
                    {activeHead && (() => {
                      const fc = headCounts(activeHead);
                      const meta = FREQ_META[activeHead.frequency] || FREQ_META.monthly;
                      const ActiveIcon = meta.icon;
                      const sorted = [...activeHead.months].sort((a, b) => a.month.localeCompare(b.month));
                      const firstUnpaidIdx = sorted.findIndex((m) => !m.paid);
                      const isLocked = (month: string) => {
                        if (firstUnpaidIdx < 0) return false;
                        const idx = sorted.findIndex((m) => m.month === month);
                        if (sorted[idx]?.paid) return false;
                        if (idx === firstUnpaidIdx) return false;
                        for (let i = firstUnpaidIdx; i < idx; i++) {
                          if (!sorted[i].paid && !selectedMonths[activeHead._id]?.[sorted[i].month]) return true;
                        }
                        return false;
                      };
                      const unpaidActive = activeHead.months.filter((m) => !m.paid);
                      return (
                        <div className="overflow-hidden rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}>
                                <ActiveIcon className="h-5 w-5" />
                              </span>
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-semibold text-foreground">{activeHead.title}</h3>
                                <p className="truncate text-xs text-muted-foreground">{meta.desc}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">₹{activeHead.amount}{meta.unit}</Badge>
                              <Badge variant={activeHead.frequency === "one-time" ? "secondary" : "default"}>{activeHead.frequency}</Badge>
                              {activeHead.concession && (
                                <Badge className="border-0 bg-green-100 text-green-700">
                                  {activeHead.concession.isPct ? `${activeHead.concession.value}% off` : `₹${activeHead.concession.value} off`}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="p-4">
                            {activeHead.frequency === "one-time" || activeHead.frequency === "yearly" ? (() => {
                              const singleMonth = activeHead.months[0];
                              const isPaid = singleMonth?.paid;
                              const isUpcoming = !isPaid && !!singleMonth?.upcoming;
                              const monthKey = singleMonth?.month || "one-time";
                              const isSelected = !!selectedMonths[activeHead._id]?.[monthKey];
                              const label = activeHead.frequency === "one-time" ? "One-time payment" : "Annual payment";
                              return (
                                <button
                                  type="button"
                                  disabled={isPaid}
                                  onClick={() => toggleMonth(activeHead._id, monthKey)}
                                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${isPaid ? "bg-green-50 border-green-200 cursor-not-allowed" : isSelected ? "bg-primary/10 border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/50 cursor-pointer"}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded flex items-center justify-center ${isPaid ? "bg-green-500" : isSelected ? "bg-primary" : "border border-gray-300"}`}>
                                      {(isPaid || isSelected) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">{activeHead.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {isPaid
                                          ? "Paid"
                                          : isUpcoming
                                            ? "Not yet due, payable in advance"
                                            : singleMonth?.dueDate
                                              ? `${label} · Due ${fmtDue(singleMonth.dueDate)}`
                                              : label}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">₹{isPaid ? activeHead.amount : Math.max(0, (singleMonth?.amount ?? activeHead.amount) - (singleMonth?.concession || 0))}</span>
                                    {isPaid ? <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge> : isUpcoming && !isSelected ? <Badge className="bg-blue-50 text-blue-500 border-0">Upcoming</Badge> : isSelected ? <Badge className="bg-primary/10 text-primary border-0">Selected</Badge> : null}
                                  </div>
                                </button>
                              );
                            })() : (
                              <div>
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{fc.pending} Pending</span>
                                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />{fc.upcoming} Upcoming</span>
                                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />{fc.paid} Paid</span>
                                  </div>
                                  {unpaidActive.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => toggleAllPending(activeHead._id, activeHead.months)}>
                                      {unpaidActive.every((m) => selectedMonths[activeHead._id]?.[m.month]) ? "Deselect All" : "Select All Pending"}
                                    </Button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                                  {sorted.map((m) => {
                                    const locked = !m.paid && isLocked(m.month);
                                    const selected = !!selectedMonths[activeHead._id]?.[m.month];
                                    return (
                                      <button
                                        key={m.month}
                                        type="button"
                                        onClick={() => !m.paid && !locked && toggleMonth(activeHead._id, m.month)}
                                        disabled={m.paid || locked}
                                        title={
                                          locked
                                            ? "Pay the earlier month(s) first."
                                            : !m.paid && m.dueDate
                                              ? `Due ${fmtDue(m.dueDate)}${m.upcoming ? " — this fee period hasn't started yet, but it can still be paid in advance" : ""}`
                                              : undefined
                                        }
                                        className={`p-2 rounded-lg border text-center text-xs transition-all ${m.paid ? "bg-green-50 border-green-200 text-green-700 cursor-not-allowed" : locked ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" : selected ? "bg-primary/10 border-primary text-primary font-semibold" : m.upcoming ? "bg-blue-50/50 border-blue-100 text-blue-500 hover:border-primary/50" : "border-border hover:border-primary/50 text-muted-foreground"}`}
                                      >
                                        <p className="font-medium">{getMonthLabel(m.month)}</p>
                                        {m.paid ? (
                                          <CheckCircle2 className="h-3 w-3 mx-auto mt-1 text-green-600" />
                                        ) : locked ? (
                                          <p className="mt-0.5 text-[10px]">🔒 Pay prev</p>
                                        ) : (
                                          <div className="mt-0.5 space-y-0.5">
                                            <p>₹{Math.max(0, m.amount - m.lateFee - (m.concession || 0))}</p>
                                            {m.lateFee > 0 && <p className="text-red-600 text-[10px]">+₹{m.lateFee} late</p>}
                                            {m.upcoming && !selected && <p className="text-[10px] text-blue-400">Upcoming</p>}
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Collapsed rows for every other head — click to switch */}
                    {child.feeHeads.filter((fh) => fh._id !== activeHead?._id).map((fh) => {
                      const fc = headCounts(fh);
                      const fm = FREQ_META[fh.frequency] || FREQ_META.monthly;
                      const FI = fm.icon;
                      return (
                        <button
                          key={fh._id}
                          type="button"
                          onClick={() => setActiveHeadId(fh._id)}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fm.chip}`}>
                              <FI className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">{fh.title}</span>
                              <span className="block text-xs text-muted-foreground">{fc.pending} pending · {fc.upcoming} upcoming</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline">₹{fh.amount}{fm.unit}</Badge>
                            <Badge variant={fh.frequency === "one-time" || fh.frequency === "yearly" ? "secondary" : "default"}>{fh.frequency}</Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: sticky selected-payment panel (mirrors admin) */}
                  <div className="lg:sticky lg:top-4">
                    <div className="overflow-hidden rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CreditCard className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">Selected Payment</h3>
                            <p className="text-xs text-muted-foreground">
                              {summary.itemCount > 0
                                ? `${summary.itemCount} item${summary.itemCount > 1 ? "s" : ""} selected`
                                : "Nothing selected yet"}
                            </p>
                          </div>
                        </div>
                        {summary.itemCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearSelection}>Clear All</Button>
                        )}
                      </div>

                      <div className="space-y-4 p-4">
                        {summary.itemCount === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center">
                            <Wallet className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">Select months from a fee category to build the payment.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {summary.lines.map((line, i) => (
                              <div key={i} className="rounded-lg border border-border/70 bg-muted/30 p-3">
                                <div className="flex justify-between gap-4 text-sm">
                                  <span className="truncate font-medium text-foreground">{line.label}</span>
                                  <span className="shrink-0 font-semibold">₹{line.total.toLocaleString("en-IN")}</span>
                                </div>
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{line.months.map((mm) => getMonthLabel(mm)).join(", ")}</p>
                                {line.lateFee > 0 && (
                                  <div className="flex justify-between gap-4 text-xs text-red-600">
                                    <span className="pl-2">Late Fee</span><span>+₹{line.lateFee.toLocaleString("en-IN")}</span>
                                  </div>
                                )}
                                {line.concession > 0 && (
                                  <div className="flex justify-between gap-4 text-xs text-green-600">
                                    <span className="pl-2">Concession</span><span>-₹{line.concession.toLocaleString("en-IN")}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Base Amount</span>
                            <span className="font-medium">₹{summary.baseAmount.toLocaleString("en-IN")}</span>
                          </div>
                          {summary.lateFee > 0 && (
                            <div className="flex justify-between gap-4 text-red-600">
                              <span>+ Late Fee</span><span className="font-medium">+₹{summary.lateFee.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {summary.concession > 0 && (
                            <div className="flex justify-between gap-4 text-green-600">
                              <span>− Concession</span><span className="font-medium">-₹{summary.concession.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4 border-t border-border pt-1.5">
                            <span className="font-semibold">Total</span>
                            <span className="text-lg font-bold">₹{summary.total.toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Button
                            className="w-full bg-primary hover:bg-primary/90 gap-2"
                            onClick={() => {
                              setPayModal({ open: true, lines: summary.lines, total: summary.total });
                            }}
                            disabled={paying || summary.itemCount === 0}
                          >
                            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                            {paying ? "Processing..." : `Pay ₹${summary.total.toLocaleString("en-IN")} via Razorpay`}
                          </Button>
                          <p className="text-center text-xs text-muted-foreground">Online payment via Razorpay — full amount only</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {loadingHistory ? (
              <PageLoader compact label="Loading payment history..." />
            ) : paymentHistory.length === 0 ? (
              <div className="rounded-[18px] bg-card py-16 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No payments found.</p>
              </div>
            ) : (
              paymentHistory.map((group, idx) => (
                <div key={idx} className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">
                          {group.paymentDate ? new Date(group.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                        <Badge variant="outline" className="capitalize">{group.paymentMode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{group.itemCount} item{group.itemCount > 1 ? "s" : ""} paid</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-2">
                        {group.items.map((item, i) => (
                          <span key={i} className="text-muted-foreground">
                            {item.title} ({item.month === "one-time" ? "One-Time" : getMonthLabel(item.month || "")}) — <span className="font-medium text-foreground">₹{(item.paidAmount || item.amount).toLocaleString("en-IN")}</span>
                            {item.lateFee > 0 && <span className="text-red-600 text-xs"> (+₹{item.lateFee} late)</span>}
                            {item.concession > 0 && <span className="text-green-600 text-xs"> (-₹{item.concession})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-foreground">₹{group.totalAmount.toLocaleString("en-IN")}</span>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => { const r = await buildGroupReceipt(group); if (r) setReceiptPreview(previewReceipt(r)); }}>
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={async () => { const r = await buildGroupReceipt(group); if (r) downloadReceipt(r); }}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!payModal} onOpenChange={(o) => { if (!o) setPayModal(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Pay Fee Online</DialogTitle>
          </DialogHeader>
          {payModal && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                {payModal.lines.map((line, i) => (
                  <div key={i} className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{line.label} ({line.months.map((m) => getMonthLabel(m)).join(", ")})</span>
                    <span className="shrink-0 font-medium">₹{line.total.toLocaleString("en-IN")}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total</span><span>₹{payModal.total.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Online payment via Razorpay — full amount only</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={handlePay} disabled={paying}>
              {paying ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : <>Pay ₹{payModal?.total.toLocaleString("en-IN") || "0"} via Razorpay</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptData} onOpenChange={(o) => { if (!o) { setReceiptData(null); setReceiptPreview(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Payment Successful</DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Your payment has been recorded. You can download or preview the receipt below.</p>
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2">
                {receiptData.feeHeadTotals.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-800">{item.feeHead} ({item.month === "one-time" ? "One-Time" : getMonthLabel(item.month || "")})</span>
                      <span className="font-medium text-green-800">₹{item.amount.toLocaleString("en-IN")}</span>
                    </div>
                    {(item.lateFee ?? 0) > 0 && <div className="flex justify-between text-xs text-red-600 pl-4"><span>Late Fee</span><span>+₹{(item.lateFee ?? 0).toLocaleString("en-IN")}</span></div>}
                    {(item.concession ?? 0) > 0 && <div className="flex justify-between text-xs text-green-600 pl-4"><span>Concession</span><span>-₹{(item.concession ?? 0).toLocaleString("en-IN")}</span></div>}
                  </div>
                ))}
                <div className="border-t border-green-200 pt-2 flex justify-between font-bold text-green-900">
                  <span>Total Paid</span><span>₹{receiptData.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setReceiptData(null); setReceiptPreview(null); }}>Close</Button>
            <Button variant="outline" className="gap-2" onClick={() => { if (receiptData) setReceiptPreview(previewReceipt(receiptData)); }}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={() => { if (receiptData) downloadReceipt(receiptData); }}>
              <Download className="h-4 w-4" /> Download Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptPreview} onOpenChange={(o) => { if (!o) setReceiptPreview(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2"><DialogTitle>Receipt Preview</DialogTitle></DialogHeader>
          {receiptPreview && <iframe src={receiptPreview} className="w-full h-[70vh] border-0" title="Receipt Preview" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
