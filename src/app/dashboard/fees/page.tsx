"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Trash2, DollarSign, Pencil, Tag, TrendingUp, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { loadRazorpayScript, openRazorpayCheckout, type RazorpayOrderResponse } from "@/lib/razorpay-client";
import { CreditCard, Receipt, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Frequency = "monthly" | "quarterly" | "yearly" | "one-time";
type FeeStatus = "paid" | "pending" | "partial" | "overdue";
type PaymentMode = "cash" | "online" | "cheque" | "dd";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface StructureRow {
  _id: string;
  class: string;
  title: string;
  amount: number;
  dueDate: string;
  frequency: Frequency;
}

interface PaymentRow {
  _id: string;
  student: { _id: string; name: string; studentId: string; class: string; section?: string } | null;
  title: string;
  amount: number;
  paidAmount: number;
  status: FeeStatus;
  dueDate?: string;
  receiptNo?: string | null;
}

type ConcessionType = "Sibling" | "Merit" | "SC/ST" | "Staff Ward" | "Custom";
type ConcessionDuration = "recurring" | "one-time" | "until-date";

interface ConcessionRow {
  _id: string;
  student: { _id: string; name: string; studentId: string; class: string; section?: string } | null;
  feeStructure: { _id: string; title: string; class: string; amount: number } | null;
  type: ConcessionType;
  value: number;
  isPct: boolean;
  description: string;
  duration: ConcessionDuration;
  validUntil: string | null;
}

interface ConcessionsResponse {
  success: boolean;
  data: ConcessionRow[];
}

interface StudentOption {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

interface StudentsResponse {
  success: boolean;
  data: StudentOption[];
}

const CONCESSION_TYPES: ConcessionType[] = ["Sibling", "Merit", "SC/ST", "Staff Ward", "Custom"];

interface AnalyticsMonth {
  month: string;
  collected: number;
  pending: number;
}

interface ClassWiseRow {
  class: string;
  collected: number;
}

interface AnalyticsResponse {
  success: boolean;
  data: AnalyticsMonth[];
  classWise: ClassWiseRow[];
  summary: { totalCollected: number; totalPending: number };
}

interface StructuresResponse {
  success: boolean;
  data: StructureRow[];
}

interface PaymentsResponse {
  success: boolean;
  data: PaymentRow[];
  summary: { totalCollected: number; totalPending: number };
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const STATUS_STYLES: Record<FeeStatus, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-slate-100 text-slate-600",
  partial: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
};

const EMPTY_STRUCTURE_FORM = { class: "", title: "", amount: "", dueDate: "", frequency: "monthly" as Frequency, description: "" };

export default function FeesPage() {
  const { user } = useAuth();
  const [structures, setStructures] = useState<StructureRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [structureOpen, setStructureOpen] = useState(false);
  const [structureForm, setStructureForm] = useState(EMPTY_STRUCTURE_FORM);
  const [structureSubmitting, setStructureSubmitting] = useState(false);

  const [collectPayment, setCollectPayment] = useState<PaymentRow | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [collecting, setCollecting] = useState(false);

  const [concessions, setConcessions] = useState<ConcessionRow[] | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [conOpen, setConOpen] = useState(false);
  const [editingCon, setEditingCon] = useState<ConcessionRow | null>(null);
  const [conForm, setConForm] = useState({
    studentId: "", feeStructureId: "", type: "Custom" as ConcessionType, value: "", isPct: true,
    description: "", duration: "recurring" as ConcessionDuration, validUntil: "",
  });
  const [conSubmitting, setConSubmitting] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<StructuresResponse>("/fees/structures", token)
      .then((res) => setStructures(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load fee structures."));
    apiGet<PaymentsResponse>("/fees/payments", token)
      .then((res) => setPayments(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payments."));
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
    apiGet<ConcessionsResponse>("/fees/concessions", token)
      .then((res) => setConcessions(res.data))
      .catch(() => {});
    apiGet<StudentsResponse>("/students", token)
      .then((res) => setStudents(res.data))
      .catch(() => {});
    apiGet<AnalyticsResponse>("/fees/analytics", token)
      .then(setAnalytics)
      .catch(() => {});
  };

  useEffect(() => {
    if (user?.role === "parent") return;
    load();
  }, [user?.role]);

  const openAddConcession = () => {
    setEditingCon(null);
    setConForm({ studentId: "", feeStructureId: "", type: "Custom", value: "", isPct: true, description: "", duration: "recurring", validUntil: "" });
    setConOpen(true);
  };

  const openEditConcession = (c: ConcessionRow) => {
    setEditingCon(c);
    setConForm({
      studentId: c.student?._id || "",
      feeStructureId: c.feeStructure?._id || "",
      type: c.type,
      value: String(c.value),
      isPct: c.isPct,
      description: c.description,
      duration: c.duration,
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
    });
    setConOpen(true);
  };

  const handleConcessionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setConSubmitting(true);
    try {
      const body = {
        student: conForm.studentId,
        feeStructure: conForm.feeStructureId || null,
        type: conForm.type,
        value: Number(conForm.value),
        isPct: conForm.isPct,
        description: conForm.description,
        duration: conForm.duration,
        validUntil: conForm.validUntil || null,
      };
      const res = await fetch(editingCon ? `/api/fees/concessions/${editingCon._id}` : "/api/fees/concessions", {
        method: editingCon ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save concession.");
      toast.success(editingCon ? "Concession updated" : "Concession added");
      setConOpen(false);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setConSubmitting(false);
    }
  };

  const handleDeleteConcession = async (c: ConcessionRow) => {
    if (!confirm(`Delete this concession for ${c.student?.name || "student"}?`)) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/fees/concessions/${c._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete concession.");
      toast.success("Concession deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const selectedConStudent = students.find((s) => s._id === conForm.studentId);
  const conFeeStructureOptions = structures?.filter((s) => s.class === selectedConStudent?.class) || [];

  const handleStructureSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setStructureSubmitting(true);
    try {
      const res = await fetch("/api/fees/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...structureForm, amount: Number(structureForm.amount) }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to create fee structure.");
      toast.success(json.message || "Fee structure created");
      setStructureOpen(false);
      setStructureForm(EMPTY_STRUCTURE_FORM);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setStructureSubmitting(false);
    }
  };

  const handleDeleteStructure = async (s: StructureRow) => {
    if (!confirm(`Delete "${s.title}"? Existing payment records are kept.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(s._id);
    try {
      const res = await fetch(`/api/fees/structures/${s._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete fee structure.");
      toast.success("Fee structure deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const openCollect = (p: PaymentRow) => {
    setCollectPayment(p);
    setPaidAmount(String(p.amount - p.paidAmount));
    setPaymentMode("cash");
  };

  const handleCollect = async (e: FormEvent) => {
    e.preventDefault();
    if (!collectPayment) return;
    const token = getToken();
    if (!token) return;
    const total = collectPayment.amount;
    const newPaid = collectPayment.paidAmount + Number(paidAmount);
    const status: FeeStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "pending";
    setCollecting(true);
    try {
      const res = await fetch(`/api/fees/payments/${collectPayment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, paidAmount: newPaid, paymentMode }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to record payment.");
      toast.success("Payment recorded");
      setCollectPayment(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setCollecting(false);
    }
  };

  const handleDeletePayment = async (p: PaymentRow) => {
    if (!confirm(`Delete this payment record for ${p.student?.name || "student"}?`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(p._id);
    try {
      const res = await fetch(`/api/fees/payments/${p._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete payment.");
      toast.success("Payment deleted");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  if (user.role === "parent") {
    return <ParentFees />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Fees</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage fee structures and collect payments.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-xs text-[#64748B]">Total Collected (Year)</p>
              <p className="text-xl font-bold text-green-600">₹{(analytics?.summary.totalCollected ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">FY {new Date().getFullYear()}</p>
            </div>
            <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-xs text-[#64748B]">This Month</p>
              <p className="text-xl font-bold text-[#2563EB]">₹{(analytics?.data[new Date().getMonth()]?.collected ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{analytics?.data[new Date().getMonth()]?.month ?? ""}</p>
            </div>
            <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-xs text-[#64748B]">Pending Dues</p>
              <p className="text-xl font-bold text-amber-600">₹{(analytics?.summary.totalPending ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Across all students</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-[#7C3AED]" />
                <h2 className="text-sm font-semibold text-[#172554]">Monthly Collection Trend</h2>
              </div>
              {!analytics || analytics.data.every((a) => a.collected === 0 && a.pending === 0) ? (
                <p className="text-sm text-[#64748B] text-center py-10">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                    <Bar dataKey="collected" name="Collected" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="#33C6E7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-[#172554]">Class-wise Collection</h2>
              </div>
              {!analytics || analytics.classWise.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-10">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.classWise}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="class" tick={{ fill: "#64748B", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, "Collected"]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                    <Bar dataKey="collected" name="Collected" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {!payments ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-[#64748B]">No fee payments yet. Create a fee structure to get started.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172554]">{p.student?.name || "Unknown student"}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {p.title} · ₹{p.paidAmount}/{p.amount}
                      {p.student ? ` · Class ${p.student.class}${p.student.section ? "-" + p.student.section : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                    {p.status !== "paid" && (
                      <Button variant="outline" size="sm" onClick={() => openCollect(p)} className="gap-1">
                        <DollarSign className="h-3.5 w-3.5" /> Collect
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeletePayment(p)}
                      disabled={busyId === p._id}
                      aria-label="Delete"
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="structures" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setStructureOpen(true)} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4" /> New Fee Structure
            </Button>
          </div>
          {!structures ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : structures.length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-[#64748B]">No fee structures yet.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {structures.map((s) => (
                <div key={s._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172554]">{s.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Class {s.class} · ₹{s.amount} · {s.frequency} · Due {new Date(s.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteStructure(s)}
                    disabled={busyId === s._id}
                    aria-label="Delete"
                    className="hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concessions" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#64748B]">Apply % or flat discounts per student per fee head.</p>
            <Button onClick={openAddConcession} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Plus className="h-4 w-4" /> Add Concession
            </Button>
          </div>
          {!concessions ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : concessions.length === 0 ? (
            <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <p className="text-sm text-[#64748B]">No concessions configured yet.</p>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              {concessions.map((c) => {
                const durationLabel =
                  c.duration === "one-time" ? "One-time" : c.duration === "until-date" ? `Until ${c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}` : "Recurring";
                return (
                  <div key={c._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#172554]">{c.student?.name || "Unknown student"}</p>
                        <span className="text-[10px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded-full">{c.type}</span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {c.feeStructure?.title || "All fee structures"}
                        {c.student ? ` · Class ${c.student.class}${c.student.section ? "-" + c.student.section : ""}` : ""}
                        {" · "}{durationLabel}
                        {c.description ? ` · ${c.description}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-green-600">{c.isPct ? `${c.value}%` : `₹${c.value}`}</span>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditConcession(c)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteConcession(c)}
                        aria-label="Delete"
                        className="hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">New Fee Structure</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStructureSubmit} className="space-y-3 mt-2">
            <Field label="Class" required>
              {classes.length > 0 ? (
                <Select value={structureForm.class} onValueChange={(v) => setStructureForm((f) => ({ ...f, class: v || f.class }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c.name}>Class {c.name}-{c.section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={structureForm.class} onChange={(e) => setStructureForm((f) => ({ ...f, class: e.target.value }))} required />
              )}
            </Field>
            <Field label="Title" required>
              <Input placeholder="Tuition Fee" value={structureForm.title} onChange={(e) => setStructureForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" required>
                <Input type="number" min={1} value={structureForm.amount} onChange={(e) => setStructureForm((f) => ({ ...f, amount: e.target.value }))} required />
              </Field>
              <Field label="Frequency">
                <Select value={structureForm.frequency} onValueChange={(v) => setStructureForm((f) => ({ ...f, frequency: (v || f.frequency) as Frequency }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["monthly", "quarterly", "yearly", "one-time"] as Frequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Due Date">
              <Input type="date" value={structureForm.dueDate} onChange={(e) => setStructureForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </Field>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={structureSubmitting}>
              {structureSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Fee Structure"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!collectPayment} onOpenChange={(o) => { if (!o) setCollectPayment(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">
              Collect Payment {collectPayment ? `— ${collectPayment.student?.name || ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          {collectPayment && (
            <form onSubmit={handleCollect} className="space-y-3 mt-2">
              <p className="text-xs text-[#64748B]">
                {collectPayment.title} · Already paid ₹{collectPayment.paidAmount} of ₹{collectPayment.amount}
              </p>
              <Field label="Amount to collect now" required>
                <Input
                  type="number"
                  min={0}
                  max={collectPayment.amount - collectPayment.paidAmount}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </Field>
              <Field label="Payment Mode">
                <Select value={paymentMode} onValueChange={(v) => setPaymentMode((v || paymentMode) as PaymentMode)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["cash", "online", "cheque", "dd"] as PaymentMode[]).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={collecting}>
                {collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={conOpen} onOpenChange={setConOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554] flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#2563EB]" /> {editingCon ? "Edit Concession" : "Add Concession"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConcessionSubmit} className="space-y-3 mt-2">
            <Field label="Student" required>
              <Select
                value={conForm.studentId}
                onValueChange={(v) => setConForm((f) => ({ ...f, studentId: v || f.studentId, feeStructureId: "" }))}
                disabled={!!editingCon}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} (Class {s.class}{s.section ? "-" + s.section : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fee Structure (optional — leave blank for all)">
              <Select value={conForm.feeStructureId} onValueChange={(v) => setConForm((f) => ({ ...f, feeStructureId: v || "" }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All fee structures" /></SelectTrigger>
                <SelectContent>
                  {conFeeStructureOptions.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.title} (₹{s.amount})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Concession Type">
              <Select value={conForm.type} onValueChange={(v) => setConForm((f) => ({ ...f, type: (v || f.type) as ConcessionType }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONCESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value" required>
                <Input type="number" min={0} placeholder="e.g. 20 or 500" value={conForm.value} onChange={(e) => setConForm((f) => ({ ...f, value: e.target.value }))} required />
              </Field>
              <Field label="Discount Type">
                <div className="flex gap-2">
                  {[{ l: "Percent (%)", v: true }, { l: "Flat (₹)", v: false }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => setConForm((f) => ({ ...f, isPct: opt.v }))}
                      className={`flex-1 h-10 rounded-lg border text-xs font-medium transition-all ${conForm.isPct === opt.v ? "bg-[#2563EB] text-white border-transparent" : "border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB]"}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Description (optional)">
              <Input placeholder="Reason for concession…" value={conForm.description} onChange={(e) => setConForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration">
                <Select value={conForm.duration} onValueChange={(v) => setConForm((f) => ({ ...f, duration: (v || f.duration) as ConcessionDuration, validUntil: "" }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Every month (recurring)</SelectItem>
                    <SelectItem value="one-time">One-time only</SelectItem>
                    <SelectItem value="until-date">Until a date</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {conForm.duration === "until-date" && (
                <Field label="Valid Until">
                  <Input type="date" value={conForm.validUntil} onChange={(e) => setConForm((f) => ({ ...f, validUntil: e.target.value }))} />
                </Field>
              )}
            </div>
            <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]" disabled={conSubmitting || !conForm.studentId}>
              {conSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCon ? "Update Concession" : "Add Concession"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[#172554]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

interface ChildOption {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

interface ParentDashboardResponse {
  success: boolean;
  data: { children: ChildOption[] };
}

interface ChildFeeLine {
  _id: string;
  title: string;
  month: string | null;
  amount: number;
  paidAmount: number;
  status: FeeStatus;
  dueDate: string | null;
  receiptNo: string | null;
  feeStructure: { title: string; amount: number; frequency: Frequency } | null;
}

interface ChildFeesResponse {
  success: boolean;
  data: { fees: ChildFeeLine[]; summary: { paid: number; pending: number; total: number } };
}

interface ApiMsgResponse {
  success: boolean;
  message?: string;
}

const FEE_TILE_STYLES: Record<FeeStatus, string> = {
  paid: "border-green-300 bg-green-50 text-green-700",
  pending: "border-[#E2E8F0] text-[#64748B]",
  partial: "border-amber-300 bg-amber-50 text-amber-700",
  overdue: "border-red-300 bg-red-50 text-red-700",
};

function ParentFees() {
  const [children, setChildren] = useState<ChildOption[] | null>(null);
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");
  const [data, setData] = useState<ChildFeesResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "history">("details");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentDashboardResponse>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) {
          setChildId(res.data.children[0]._id);
          setChildName(res.data.children[0].name);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load children."));
  }, []);

  const load = () => {
    if (!childId) return;
    const token = getToken();
    if (!token) return;
    apiGet<ChildFeesResponse>(`/fees/student/${childId}`, token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load fees."));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever the selected child changes.
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const handlePay = async (fee: ChildFeeLine) => {
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
            const verifyJson: ApiMsgResponse = await verifyRes.json();
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

  const selectedChild = children?.find((c) => c._id === childId) || null;

  const groups = new Map<string, ChildFeeLine[]>();
  (data?.fees || []).forEach((f) => {
    const key = f.feeStructure?.title || f.title;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  });

  const paidHistory = (data?.fees || []).filter((f) => f.status === "paid").sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Fee Details</h1>
          <p className="text-sm text-[#64748B] mt-1">View and pay fees for your child.</p>
        </div>
        {children && children.length > 1 && (
          <Select
            value={childId}
            onValueChange={(v) => {
              setChildId(v || "");
              setChildName(children.find((c) => c._id === v)?.name || "");
            }}
          >
            <SelectTrigger className="w-56"><SelectValue placeholder="Select a child" /></SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name} — Class {c.class}{c.section ? `-${c.section}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedChild && children && children.length === 1 && (
          <div className="rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] px-4 py-2 text-sm">
            <span className="font-semibold text-[#172554]">{selectedChild.name}</span>
            <span className="text-[#64748B]"> — Class {selectedChild.class}{selectedChild.section ? `-${selectedChild.section}` : ""}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {children === null || (childId && !data) ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No children linked to your account yet.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setTab("details")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === "details" ? "bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] text-[#172554]" : "text-[#64748B]"
              }`}
            >
              Fee Details
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === "history" ? "bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] text-[#172554]" : "text-[#64748B]"
              }`}
            >
              Payment History
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-[16px] bg-gradient-to-br from-green-500 to-green-600 p-4 text-white">
              <p className="text-xs opacity-90">Total Paid</p>
              <p className="text-xl font-bold mt-1">₹{(data?.summary.paid ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white">
              <p className="text-xs opacity-90">Pending</p>
              <p className="text-xl font-bold mt-1">₹{(data?.summary.pending ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-violet-500 to-violet-600 p-4 text-white">
              <p className="text-xs opacity-90">Total Fee</p>
              <p className="text-xl font-bold mt-1">₹{(data?.summary.total ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {tab === "details" ? (
            groups.size === 0 ? (
              <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
                <p className="text-sm text-[#64748B]">No fees have been set up for your child yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(groups.entries()).map(([title, lines]) => {
                  const paidCount = lines.filter((l) => l.status === "paid").length;
                  const structure = lines[0].feeStructure;
                  return (
                    <div key={title} className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                        <p className="text-sm font-semibold text-[#172554]">{title}</p>
                        <div className="flex items-center gap-2">
                          {structure && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                              ₹{structure.amount.toLocaleString()}{structure.frequency !== "one-time" ? `/${structure.frequency === "monthly" ? "month" : structure.frequency}` : ""}
                            </span>
                          )}
                          {lines.length > 1 && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                              {structure?.frequency || "one-time"}
                            </span>
                          )}
                        </div>
                      </div>
                      {lines.length > 1 && (
                        <p className="px-5 pt-3 text-xs text-[#64748B]">
                          {paidCount} paid · {lines.length - paidCount} pending
                        </p>
                      )}
                      <div className="p-5 flex flex-wrap gap-2">
                        {lines.map((l) => (
                          <div key={l._id} className={`rounded-xl border px-4 py-2.5 min-w-[110px] text-center ${FEE_TILE_STYLES[l.status]}`}>
                            <p className="text-xs font-medium">{l.month || l.title}</p>
                            {l.status === "paid" ? (
                              <p className="text-xs font-semibold mt-1 flex items-center justify-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Paid
                              </p>
                            ) : (
                              <>
                                <p className="text-xs mt-1">₹{(l.amount - l.paidAmount).toLocaleString()}</p>
                                <Button
                                  size="xs"
                                  onClick={() => handlePay(l)}
                                  disabled={payingId === l._id}
                                  className="gap-1 mt-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[10px] h-6 w-full"
                                >
                                  {payingId === l._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                                  Pay
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F1F5F9]">
                <Receipt className="h-4 w-4 text-[#2563EB]" />
                <p className="text-sm font-semibold text-[#172554]">Payment History</p>
              </div>
              {paidHistory.length === 0 ? (
                <p className="text-sm text-[#64748B] px-5 py-6 text-center">No payments recorded yet.</p>
              ) : (
                paidHistory.map((f) => (
                  <div key={f._id} className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9] last:border-0">
                    <div>
                      <p className="text-sm text-[#172554]">{f.title}{f.month ? ` — ${f.month}` : ""}</p>
                      {f.receiptNo && <p className="text-xs text-[#94A3B8] mt-0.5">Receipt: {f.receiptNo}</p>}
                    </div>
                    <p className="text-sm font-semibold text-green-600">₹{f.paidAmount.toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
