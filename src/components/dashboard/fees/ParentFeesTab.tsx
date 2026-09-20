"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard, Loader2, CheckCircle2, Wallet, IndianRupee, Download, Eye, Receipt, Calendar,
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

interface RawMonth {
  month: string; paid: boolean; amount: number; paidAmount: number; lateFee: number; concession: number;
  paymentId?: string | null; receiptNo?: string | null; paidDate?: string | null; paymentMode?: string | null;
}
interface RawFeeHead {
  _id: string; title: string; amount: number; frequency: string;
  concession: { type: string; value: number; isPct: boolean } | null;
  months: RawMonth[];
}
interface FeeHead {
  _id: string; title: string; amount: number; frequency: string;
  months: RawMonth[];
}
interface ChildFees {
  studentId: string;
  studentName: string;
  studentClass: string;
  section: string;
  feeHeads: FeeHead[];
  summary: { paid: number; pending: number; total: number; totalLateFee: number; totalConcession: number };
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

const SELECTED_CHILD_KEY = "sms_next_parent_selectedChild";

export default function ParentFeesTab() {
  const [children, setChildren] = useState<ChildFees[]>([]);
  const [selectedChild, setSelectedChild] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Record<string, Record<string, boolean>>>({});
  const [payModal, setPayModal] = useState<{ open: boolean; items: { feeHead: FeeHead; months: string[] }[]; total: number } | null>(null);
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
            const rawHeads = feeRes.data.feeHeads || [];

            let totalPaid = 0, totalPending = 0, total = 0, totalLateFee = 0, totalConcession = 0;
            const feeHeads: FeeHead[] = rawHeads.map((h) => {
              const paidMonths = h.months.filter((m) => m.paid);
              const unpaidMonths = h.months.filter((m) => !m.paid);
              const headPaid = paidMonths.reduce((s, m) => s + (m.paidAmount || m.amount), 0);
              const headPending = unpaidMonths.reduce((s, m) => s + m.amount, 0);
              h.months.forEach((m) => {
                if (m.lateFee > 0) totalLateFee += m.lateFee;
                if (m.concession > 0) totalConcession += m.concession;
              });
              totalPaid += headPaid;
              totalPending += headPending;
              total += headPaid + headPending;
              return { _id: h._id, title: h.title, amount: h.amount, frequency: h.frequency, months: h.months };
            });

            return {
              studentId: k._id, studentName: k.name, studentClass: k.class, section: k.section || "",
              feeHeads, summary: { paid: totalPaid, pending: totalPending, total, totalLateFee, totalConcession },
            };
          } catch {
            return {
              studentId: k._id, studentName: k.name, studentClass: k.class, section: k.section || "",
              feeHeads: [], summary: { paid: 0, pending: 0, total: 0, totalLateFee: 0, totalConcession: 0 },
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

  const toggleMonth = (feeHeadId: string, month: string) => {
    setSelectedMonths((prev) => ({
      ...prev,
      [feeHeadId]: { ...(prev[feeHeadId] || {}), [month]: !prev[feeHeadId]?.[month] },
    }));
  };

  const toggleAllPending = (feeHeadId: string, months: { month: string; paid: boolean }[]) => {
    const unpaid = months.filter((m) => !m.paid);
    const allSelected = unpaid.every((m) => selectedMonths[feeHeadId]?.[m.month]);
    const newSel: Record<string, boolean> = {};
    if (!allSelected) unpaid.forEach((m) => { newSel[m.month] = true; });
    setSelectedMonths((prev) => ({ ...prev, [feeHeadId]: newSel }));
  };

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
        lines: [...acc.lines, ...(baseAmount > 0 ? [{ label: fh.title, amount: baseAmount, lateFee: lateFeeTotal, concession: concessionTotal, total: itemTotal }] : [])],
        baseAmount: acc.baseAmount + baseAmount,
        lateFee: acc.lateFee + lateFeeTotal,
        concession: acc.concession + concessionTotal,
        total: acc.total + itemTotal,
        itemCount: acc.itemCount + selected.length,
      };
    },
    { lines: [] as { label: string; amount: number; lateFee: number; concession: number; total: number }[], baseAmount: 0, lateFee: 0, concession: 0, total: 0, itemCount: 0 },
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
      const orderRes = await apiPost<RazorpayOrderResponse>("/payments/create-order", { feePaymentId: paymentIds[0], amount: summary.total }, token);
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
                  feeHead: fh.title, month: m.month, amount: fh.amount,
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
              const receiptItems = justPaid.length > 0 ? justPaid : paidMonths.slice(-Object.keys(selectedMonths).length);
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
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" /> Loading fee details...
      </div>
    );
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
        <Tabs defaultValue="fees" className="space-y-6" onValueChange={(v) => { if (v === "history") fetchPaymentHistory(); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="fees" className="gap-2"><CreditCard className="h-4 w-4" /> Fee Details</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><Receipt className="h-4 w-4" /> Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="fees" className="space-y-6">
            {child.feeHeads.length === 0 ? (
              <div className="rounded-[18px] bg-card py-16 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <Wallet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No fee structures found for your child&apos;s class.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatCard label="Total Paid" value={child.summary.paid} gradient="from-green-500 to-green-600" />
                  <StatCard label="Pending" value={child.summary.pending} gradient="from-orange-500 to-orange-600" />
                  <StatCard label="Total Fee" value={child.summary.total} gradient="from-blue-500 to-blue-600" />
                  <StatCard label="Late Fees" value={child.summary.totalLateFee} gradient="from-red-500 to-red-600" />
                  <StatCard label="Concession" value={child.summary.totalConcession} gradient="from-green-500 to-emerald-600" prefix="-" />
                </div>

                {child.feeHeads.map((fh) => {
                  const paidMonths = fh.months.filter((m) => m.paid);
                  const unpaidMonths = fh.months.filter((m) => !m.paid);
                  return (
                    <div key={fh._id} className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">{fh.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">₹{fh.amount}{fh.frequency === "one-time" || fh.frequency === "yearly" ? "" : "/month"}</Badge>
                          <Badge variant={fh.frequency === "one-time" || fh.frequency === "yearly" ? "secondary" : "default"}>{fh.frequency}</Badge>
                        </div>
                      </div>
                      <div className="p-5">
                        {fh.frequency === "one-time" || fh.frequency === "yearly" ? (() => {
                          const singleMonth = fh.months[0];
                          const isPaid = singleMonth?.paid;
                          const monthKey = singleMonth?.month || "one-time";
                          const isSelected = !!selectedMonths[fh._id]?.[monthKey];
                          const label = fh.frequency === "one-time" ? "One-time payment" : "Annual payment";
                          return (
                            <button
                              type="button"
                              disabled={isPaid}
                              onClick={() => !isPaid && toggleMonth(fh._id, monthKey)}
                              className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${isPaid ? "bg-green-50 border-green-200 cursor-not-allowed" : isSelected ? "bg-primary/10 border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/50 cursor-pointer"}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-4 w-4 rounded flex items-center justify-center ${isPaid ? "bg-green-500" : isSelected ? "bg-primary" : "border border-gray-300"}`}>
                                  {(isPaid || isSelected) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{fh.title}</p>
                                  <p className="text-xs text-muted-foreground">{isPaid ? "Paid" : label}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">₹{fh.amount}</span>
                                {isPaid ? <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge> : isSelected ? <Badge className="bg-primary/10 text-primary border-0">Selected</Badge> : null}
                              </div>
                            </button>
                          );
                        })() : (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm text-muted-foreground">{paidMonths.length} paid · {unpaidMonths.length} pending</p>
                              {unpaidMonths.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => toggleAllPending(fh._id, fh.months)}>
                                  {unpaidMonths.every((m) => selectedMonths[fh._id]?.[m.month]) ? "Deselect All" : "Select All Pending"}
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                              {fh.months.map((m) => (
                                <button
                                  key={m.month}
                                  type="button"
                                  onClick={() => !m.paid && toggleMonth(fh._id, m.month)}
                                  disabled={m.paid}
                                  className={`p-2 rounded-lg border text-center text-xs transition-all ${m.paid ? "bg-green-50 border-green-200 text-green-700 cursor-not-allowed" : selectedMonths[fh._id]?.[m.month] ? "bg-primary/10 border-primary text-primary font-semibold" : "border-border hover:border-primary/50 text-muted-foreground"}`}
                                >
                                  <p className="font-medium">{getMonthLabel(m.month)}</p>
                                  {m.paid ? <CheckCircle2 className="h-3 w-3 mx-auto mt-1 text-green-600" /> : (
                                    <div className="mt-0.5 space-y-0.5">
                                      {m.concession > 0 ? <p className="text-green-600">₹{fh.amount - m.concession}</p> : <p>₹{m.amount}</p>}
                                      {m.lateFee > 0 && <p className="text-red-600 text-[10px]">+₹{m.lateFee} late</p>}
                                      {m.concession > 0 && <p className="text-green-600 text-[10px]">-₹{m.concession} concession</p>}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {summary.itemCount > 0 && (
                  <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] border border-primary/20 p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold mb-2">Payment Summary</h3>
                        <div className="space-y-1 text-sm">
                          {summary.lines.map((line, i) => (
                            <div key={i}>
                              <div className="flex justify-between gap-8">
                                <span className="text-muted-foreground">{line.label}</span>
                                <span className="font-medium">₹{line.amount.toLocaleString("en-IN")}</span>
                              </div>
                              {line.lateFee > 0 && (
                                <div className="flex justify-between gap-8 text-red-600 text-xs"><span className="pl-2">Late Fee</span><span>+₹{line.lateFee.toLocaleString("en-IN")}</span></div>
                              )}
                              {line.concession > 0 && (
                                <div className="flex justify-between gap-8 text-green-600 text-xs"><span className="pl-2">Concession</span><span>-₹{line.concession.toLocaleString("en-IN")}</span></div>
                              )}
                            </div>
                          ))}
                          {summary.concession > 0 && (
                            <div className="flex justify-between gap-8 text-green-600"><span>Total Concession</span><span className="font-medium">-₹{summary.concession.toLocaleString("en-IN")}</span></div>
                          )}
                          {summary.lateFee > 0 && (
                            <div className="flex justify-between gap-8 text-red-600"><span>Total Late Fee</span><span className="font-medium">+₹{summary.lateFee.toLocaleString("en-IN")}</span></div>
                          )}
                          <div className="flex justify-between gap-8 border-t border-border pt-1 mt-1">
                            <span className="font-semibold">Total</span><span className="font-bold text-lg">₹{summary.total.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        className="bg-primary hover:bg-primary/90 gap-2 h-11 px-8"
                        onClick={() => {
                          const items: { feeHead: FeeHead; months: string[] }[] = [];
                          for (const fh of child.feeHeads || []) {
                            const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
                            if (selected.length > 0) items.push({ feeHead: fh, months: selected });
                          }
                          setPayModal({ open: true, items, total: summary.total });
                        }}
                        disabled={paying || summary.itemCount === 0}
                      >
                        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                        Pay ₹{summary.total.toLocaleString("en-IN")} via Razorpay
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading payment history...
              </div>
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
                {payModal.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.feeHead.title} ({item.months.map((m) => getMonthLabel(m)).join(", ")})</span>
                    <span className="font-medium">₹{item.months.reduce((s) => s + item.feeHead.amount, 0).toLocaleString("en-IN")}</span>
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
                      <span className="text-green-800">{item.feeHead} ({item.month === "one-time" ? "One-Time" : item.month})</span>
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

function StatCard({ label, value, gradient, prefix = "" }: { label: string; value: number; gradient: string; prefix?: string }) {
  return (
    <div className="rounded-[16px] overflow-hidden shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
      <div className={`bg-gradient-to-br ${gradient} p-4 text-white relative`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-medium opacity-90">{label}</p>
          <p className="text-xl font-bold mt-1">{prefix}₹{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
