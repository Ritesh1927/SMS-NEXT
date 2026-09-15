"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Trash2, DollarSign, Pencil, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
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
  const [summary, setSummary] = useState<{ totalCollected: number; totalPending: number } | null>(null);
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

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<StructuresResponse>("/fees/structures", token)
      .then((res) => setStructures(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load fee structures."));
    apiGet<PaymentsResponse>("/fees/payments", token)
      .then((res) => {
        setPayments(res.data);
        setSummary(res.summary);
      })
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
  };

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Fees</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage fee structures and collect payments.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <p className="text-xs text-[#64748B]">Total Collected</p>
            <p className="text-xl font-bold text-green-600">₹{summary.totalCollected.toLocaleString()}</p>
          </div>
          <div className="rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <p className="text-xs text-[#64748B]">Total Pending</p>
            <p className="text-xl font-bold text-amber-600">₹{summary.totalPending.toLocaleString()}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
        </TabsList>

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
