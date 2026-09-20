"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CreditCard, Check, Loader2, IndianRupee, Download, Eye, CheckCircle2, Receipt, Calendar,
} from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { downloadReceipt, previewReceipt, generateReceiptNumber, type ReceiptData } from "@/lib/receipt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/PageLoader";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem } from "@/components/ui/combobox";

type PaymentMode = "cash" | "online" | "cheque" | "dd";

interface FeeHeadMonth {
  month: string;
  paid: boolean;
  amount: number;
  paidAmount: number;
  lateFee: number;
  concession: number;
  paymentId?: string | null;
  receiptNo?: string | null;
  paidDate?: string | null;
  paymentMode?: string | null;
}

interface FeeHead {
  _id: string;
  title: string;
  amount: number;
  frequency: string;
  dueDate: string;
  concession: { type: string; value: number; isPct: boolean } | null;
  months: FeeHeadMonth[];
}

interface StudentOption {
  _id: string;
  name: string;
  class: string;
  section: string;
  studentId: string;
  isActive?: boolean;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface HistoryItem {
  _id: string;
  title: string;
  month: string | null;
  amount: number;
  lateFee: number;
  concession: number;
  paidAmount: number;
  receiptNo: string | null;
}

interface HistoryGroup {
  paymentDate: string | null;
  paymentMode: string;
  totalAmount: number;
  receiptNo: string;
  itemCount: number;
  items: HistoryItem[];
}

interface StudentsResponse {
  success: boolean;
  data: StudentOption[];
}
interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}
interface FeeStatusResponse {
  success: boolean;
  data: { feeHeads: FeeHead[] };
}
interface HistoryResponse {
  success: boolean;
  data: { history: HistoryGroup[] };
}
interface BrandingResponse {
  success: boolean;
  data: {
    schoolName?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    schoolEmail?: string;
    logo?: string;
    themeColor?: string;
    secondaryColor?: string;
  };
}
interface PayMultiResponse {
  success: boolean;
  message?: string;
  data: { summary: { count: number } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}

function getMonthLabelHistory(month: string | null) {
  if (month === "one-time") return "One-Time";
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || "";
  const [y, m] = month.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

async function fetchBranding(token: string) {
  const res = await apiGet<BrandingResponse>("/school/branding", token).catch(() => null);
  return res?.data || {};
}

export default function CollectFeeTab() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [studentQuery, setStudentQuery] = useState("");
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [remarks, setRemarks] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Record<string, Record<string, boolean>>>({});
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<HistoryGroup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("collect");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<StudentsResponse>("/students", token)
      .then((res) => setStudents(res.data.filter((s) => s.isActive !== false)))
      .catch(() => {});
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStudent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset when the selected student is cleared.
      setFeeHeads([]);
      setSelectedMonths({});
      return;
    }
    const token = getToken();
    if (!token) return;
    setLoading(true);
    apiGet<FeeStatusResponse>(`/fees/student-status/${selectedStudent}`, token)
      .then((res) => {
        const heads = res.data.feeHeads || [];
        setFeeHeads(heads);
        const init: Record<string, Record<string, boolean>> = {};
        heads.forEach((h) => { init[h._id] = {}; });
        setSelectedMonths(init);
      })
      .catch(() => toast.error("Failed to load fee data"))
      .finally(() => setLoading(false));
  }, [selectedStudent]);

  const fetchPaymentHistory = () => {
    if (!selectedStudent) return;
    const token = getToken();
    if (!token) return;
    setLoadingHistory(true);
    apiGet<HistoryResponse>(`/fees/history/${selectedStudent}`, token)
      .then((res) => setPaymentHistory(res.data.history || []))
      .catch(() => setPaymentHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  const buildGroupReceipt = async (group: HistoryGroup): Promise<ReceiptData | null> => {
    const token = getToken();
    if (!token) return null;
    const studentData = students.find((s) => s._id === selectedStudent);
    const branding = await fetchBranding(token);
    return {
      school: branding,
      studentName: studentData?.name || "", studentClass: studentData?.class || "", studentSection: studentData?.section,
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
    setSelectedMonths((prev) => {
      const current = prev[feeHeadId] || {};
      const fh = feeHeads.find((f) => f._id === feeHeadId);
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

  const toggleAllMonths = (feeHeadId: string) => {
    const fh = feeHeads.find((f) => f._id === feeHeadId);
    if (!fh) return;
    const sorted = [...fh.months].sort((a, b) => a.month.localeCompare(b.month));
    const firstUnpaidIdx = sorted.findIndex((m) => !m.paid);
    if (firstUnpaidIdx < 0) return;
    const current = selectedMonths[feeHeadId] || {};
    const allSelected = sorted.slice(firstUnpaidIdx).every((m) => m.paid || current[m.month]);
    const newSelection: Record<string, boolean> = {};
    if (!allSelected) {
      sorted.slice(firstUnpaidIdx).forEach((m) => { if (!m.paid) newSelection[m.month] = true; });
    }
    setSelectedMonths((prev) => ({ ...prev, [feeHeadId]: newSelection }));
  };

  const summary = useMemo(() => {
    return feeHeads.reduce(
      (acc, fh) => {
        const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
        if (selected.length === 0) return acc;

        let baseAmount = 0;
        let concessionTotal = 0;
        let lateFeeTotal = 0;
        let label = "";

        if (fh.frequency === "one-time") {
          if (selected.includes("one-time")) {
            const monthData = fh.months.find((m) => m.month === "one-time");
            if (monthData && !monthData.paid) {
              baseAmount = fh.amount;
              label = fh.title;
              if (monthData.concession > 0) concessionTotal = monthData.concession;
              if (monthData.lateFee > 0) lateFeeTotal = monthData.lateFee;
            }
          }
        } else {
          label = fh.title;
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
        if (baseAmount > 0) {
          acc.lines.push({ label, amount: baseAmount, lateFee: lateFeeTotal, concession: concessionTotal, total: itemTotal });
        }

        return {
          baseAmount: acc.baseAmount + baseAmount,
          lateFee: acc.lateFee + lateFeeTotal,
          concession: acc.concession + concessionTotal,
          total: acc.total + itemTotal,
          itemCount: acc.itemCount + selected.length,
          lines: acc.lines,
        };
      },
      { baseAmount: 0, lateFee: 0, concession: 0, total: 0, itemCount: 0, lines: [] as { label: string; amount: number; lateFee: number; concession: number; total: number }[] },
    );
  }, [feeHeads, selectedMonths]);

  const handlePay = async () => {
    const items: { feeStructureId: string; months: string[] }[] = [];
    for (const fh of feeHeads) {
      const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
      if (selected.length > 0) items.push({ feeStructureId: fh._id, months: selected });
    }
    if (items.length === 0) {
      toast.error("Select at least one month to pay");
      return;
    }

    const token = getToken();
    if (!token) return;
    setPaying(true);
    try {
      const res = await apiPost<PayMultiResponse>("/fees/pay-multi", { studentId: selectedStudent, items, paymentMode, remarks }, token);
      toast.success(`Payment recorded! ${res.data.summary.count} month(s) paid.`);

      const feeHeadTotals: { feeHead: string; month: string; amount: number; lateFee: number; concession: number; total: number }[] = [];
      for (const fh of feeHeads) {
        const selected = Object.entries(selectedMonths[fh._id] || {}).filter(([, v]) => v).map(([k]) => k);
        for (const m of selected) {
          const monthData = fh.months.find((x) => x.month === m);
          feeHeadTotals.push({
            feeHead: fh.title, month: m, amount: fh.amount,
            lateFee: monthData?.lateFee || 0, concession: monthData?.concession || 0,
            total: monthData?.paidAmount || fh.amount + (monthData?.lateFee || 0) - (monthData?.concession || 0),
          });
        }
      }

      const studentData = students.find((s) => s._id === selectedStudent);
      const branding = await fetchBranding(token);
      setReceiptData({
        school: branding,
        studentName: studentData?.name || "", studentClass: studentData?.class || "", studentSection: studentData?.section,
        receiptNumber: generateReceiptNumber(),
        paymentDate: new Date().toLocaleDateString("en-IN"),
        paymentMode, feeHeadTotals,
        grandTotal: feeHeadTotals.reduce((sum, f) => sum + f.total, 0),
      });

      const statusRes = await apiGet<FeeStatusResponse>(`/fees/student-status/${selectedStudent}`, token);
      setFeeHeads(statusRes.data.feeHeads || []);
      setSelectedMonths({});
      setRemarks("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const filteredStudents = students.filter((s) => classFilter === "all" || `${s.class}-${s.section}` === classFilter);
  const selectedStudentData = students.find((s) => s._id === selectedStudent);
  const getStudentLabel = (s: StudentOption) => `${s.name} — Class ${s.class}-${s.section}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Collect Fee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "all")}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={`${c.name}-${c.section}`}>Class {c.name}-{c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Combobox<StudentOption | null>
              items={filteredStudents}
              value={selectedStudentData || null}
              onValueChange={(v) => {
                setSelectedStudent(v?._id || "");
                setActiveTab("collect");
              }}
              itemToStringLabel={(s) => (s ? getStudentLabel(s) : "")}
              isItemEqualToValue={(a, b) => a?._id === b?._id}
              inputValue={studentQuery}
              onInputValueChange={(v) => setStudentQuery(v)}
            >
              <ComboboxInputGroup className="w-72">
                <ComboboxInput placeholder="Search student by name or ID..." />
              </ComboboxInputGroup>
              <ComboboxContent>
                <ComboboxEmpty>No student found.</ComboboxEmpty>
                {filteredStudents.map((s) => (
                  <ComboboxItem key={s._id} value={s}>
                    <Check className={`size-4 ${selectedStudent === s._id ? "opacity-100" : "opacity-0"}`} />
                    {getStudentLabel(s)}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </div>
        </CardContent>
      </Card>

      {selectedStudent && (
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "history") fetchPaymentHistory(); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="collect" className="gap-2"><CreditCard className="h-4 w-4" /> Collect Fee</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><Receipt className="h-4 w-4" /> Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="collect" className="space-y-6">
            {loading && <PageLoader label="Loading fee structure..." />}

            {!loading && feeHeads.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No fee structures defined for this student&apos;s class.</CardContent></Card>
            )}

            {!loading && feeHeads.map((fh) => {
              const paidMonths = fh.months.filter((m) => m.paid).map((m) => m.month);
              const unpaidMonths = fh.months.filter((m) => !m.paid);
              const sorted = [...fh.months].sort((a, b) => a.month.localeCompare(b.month));
              const firstUnpaidIdx = sorted.findIndex((m) => !m.paid);
              const isLocked = (month: string) => {
                if (firstUnpaidIdx < 0) return false;
                const idx = sorted.findIndex((m) => m.month === month);
                if (sorted[idx]?.paid) return false;
                if (idx === firstUnpaidIdx) return false;
                for (let i = firstUnpaidIdx; i < idx; i++) {
                  if (!sorted[i].paid && !selectedMonths[fh._id]?.[sorted[i].month]) return true;
                }
                return false;
              };
              return (
                <Card key={fh._id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base font-semibold">{fh.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">₹{fh.amount}{fh.frequency === "one-time" ? "" : "/month"}</Badge>
                        <Badge variant={fh.frequency === "one-time" ? "secondary" : "default"}>{fh.frequency}</Badge>
                        {fh.concession && (
                          <Badge className="bg-green-100 text-green-700 border-0">
                            {fh.concession.isPct ? `${fh.concession.value}% off` : `₹${fh.concession.value} off`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fh.frequency === "one-time" ? (() => {
                      const isPaid = fh.months[0]?.paid;
                      return (
                        <div className={`flex items-center justify-between p-3 rounded-lg border ${isPaid ? "bg-green-50 border-green-200" : "border-border"}`}>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isPaid || !!selectedMonths[fh._id]?.["one-time"]}
                              onChange={() => !isPaid && toggleMonth(fh._id, "one-time")}
                              disabled={isPaid}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <div>
                              <p className="text-sm font-medium">{fh.title}</p>
                              <p className="text-xs text-muted-foreground">{isPaid ? "Paid" : "One-time payment"}</p>
                            </div>
                          </div>
                          {isPaid ? <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge> : <span className="text-sm font-semibold">₹{fh.amount}</span>}
                        </div>
                      );
                    })() : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm text-muted-foreground">{paidMonths.length} paid · {unpaidMonths.length} pending</p>
                          <Button variant="ghost" size="sm" onClick={() => toggleAllMonths(fh._id)}>
                            {unpaidMonths.every((m) => selectedMonths[fh._id]?.[m.month]) ? "Deselect All" : "Select All Pending"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {sorted.map((m) => {
                            const locked = !m.paid && isLocked(m.month);
                            return (
                              <button
                                key={m.month}
                                type="button"
                                onClick={() => !m.paid && !locked && toggleMonth(fh._id, m.month)}
                                disabled={m.paid || locked}
                                className={`p-2 rounded-lg border text-center text-xs transition-all ${
                                  m.paid
                                    ? "bg-green-50 border-green-200 text-green-700 cursor-not-allowed"
                                    : locked
                                      ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                                      : selectedMonths[fh._id]?.[m.month]
                                        ? "bg-primary/10 border-primary text-primary font-semibold"
                                        : "border-border hover:border-primary/50 text-muted-foreground"
                                }`}
                              >
                                <p className="font-medium">{getMonthLabel(m.month)}</p>
                                {m.paid ? <Check className="h-3 w-3 mx-auto mt-1 text-green-600" /> : locked ? <p className="mt-0.5 text-[10px]">🔒 Pay prev</p> : <p className="mt-0.5">₹{m.amount}</p>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {summary.itemCount > 0 && (
              <Card className="border-primary/20">
                <CardContent className="p-5">
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
                              <div className="flex justify-between gap-8 text-destructive text-xs">
                                <span className="pl-2">Late Fee</span><span>+₹{line.lateFee.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                            {line.concession > 0 && (
                              <div className="flex justify-between gap-8 text-green-600 text-xs">
                                <span className="pl-2">Concession</span><span>-₹{line.concession.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {summary.concession > 0 && (
                          <div className="flex justify-between gap-8 text-green-600">
                            <span>Total Concession</span><span className="font-medium">-₹{summary.concession.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {summary.lateFee > 0 && (
                          <div className="flex justify-between gap-8 text-destructive">
                            <span>Total Late Fee</span><span className="font-medium">+₹{summary.lateFee.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-8 border-t border-border pt-1 mt-1">
                          <span className="font-semibold">Total</span>
                          <span className="font-bold text-lg">₹{summary.total.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <div className="flex gap-2">
                        <Select value={paymentMode} onValueChange={(v) => setPaymentMode((v || paymentMode) as PaymentMode)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="dd">DD</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-40" />
                      </div>
                      <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={handlePay} disabled={paying || summary.itemCount === 0}>
                        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                        {paying ? "Processing..." : `Pay ₹${summary.total.toLocaleString("en-IN")}`}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {loadingHistory ? (
              <PageLoader compact label="Loading payment history..." />
            ) : paymentHistory.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No payments found for this student.</p>
                </CardContent>
              </Card>
            ) : (
              paymentHistory.map((group, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardContent className="p-5">
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
                              {item.title} ({getMonthLabelHistory(item.month)}) — <span className="font-medium text-foreground">₹{(item.paidAmount || item.amount).toLocaleString("en-IN")}</span>
                              {item.lateFee > 0 && <span className="text-destructive text-xs"> (+₹{item.lateFee} late)</span>}
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
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!receiptData} onOpenChange={(o) => { if (!o) { setReceiptData(null); setReceiptPreview(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Payment Recorded</DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Receipt ready. Download or preview it below.</p>
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2">
                {receiptData.feeHeadTotals.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-800">{item.feeHead} ({item.month === "one-time" ? "One-Time" : item.month})</span>
                      <span className="font-medium text-green-800">₹{item.amount.toLocaleString("en-IN")}</span>
                    </div>
                    {(item.lateFee ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-red-600 pl-4"><span>Late Fee</span><span>+₹{(item.lateFee ?? 0).toLocaleString("en-IN")}</span></div>
                    )}
                    {(item.concession ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-green-600 pl-4"><span>Concession</span><span>-₹{(item.concession ?? 0).toLocaleString("en-IN")}</span></div>
                    )}
                  </div>
                ))}
                <div className="border-t border-green-200 pt-2 flex justify-between font-bold text-green-900">
                  <span>Total</span><span>₹{receiptData.grandTotal.toLocaleString("en-IN")}</span>
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
