"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, AlertCircle, Clock, Plus, Pencil, Trash2, Settings, LayoutDashboard,
  CreditCard, FileText, Tag, RefreshCw, Loader2, X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatFilterCard } from "@/components/StatFilterCard";
import CollectFeeTab from "./CollectFeeTab";
import ReportsTab from "./ReportsTab";

type Frequency = "monthly" | "quarterly" | "yearly" | "one-time";
type ConcessionType = "Sibling" | "Merit" | "SC/ST" | "Staff Ward" | "Custom";
type ConcessionDuration = "recurring" | "one-time" | "until-date";

interface ClassOption { _id: string; name: string; section: string }
interface StudentOption { _id: string; name: string; class: string; section: string; studentId: string }
interface StructureRow {
  _id: string; class: string; title: string; amount: number; dueDate: string;
  frequency: Frequency; description: string; academicYear: string;
}
interface ConcessionRow {
  _id: string;
  student: { _id: string; name: string; studentId: string; class: string; section?: string } | null;
  feeStructure: { _id: string; title: string; class: string; amount: number } | null;
  type: ConcessionType; value: number; isPct: boolean; description: string;
  duration: ConcessionDuration; validUntil: string | null;
}
interface AnalyticsMonth { month: string; collected: number; pending: number }
interface ClassWiseChart { class: string; collected: number }
interface AnalyticsResponse {
  success: boolean; data: AnalyticsMonth[]; classWise: ClassWiseChart[];
  summary: { totalCollected: number; totalPending: number; totalLateFees: number };
}
interface StructuresResponse { success: boolean; data: StructureRow[] }
interface ClassesResponse { success: boolean; data: ClassOption[] }
interface StudentsResponse { success: boolean; data: StudentOption[] }
interface ConcessionsResponse { success: boolean; data: ConcessionRow[] }
interface ApiMessageResponse { success: boolean; message?: string }

const FREQ_OPTS: Frequency[] = ["monthly", "quarterly", "yearly", "one-time"];
const CON_TYPES: ConcessionType[] = ["Sibling", "Merit", "SC/ST", "Staff Ward", "Custom"];
const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

const ALL_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "structure", label: "Fee Structure", icon: Settings },
  { id: "collect", label: "Collect Fee", icon: CreditCard, permission: "canManageFees" },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "concessions", label: "Concessions", icon: Tag },
];

type BatchFeeRow = { title: string; amount: string; frequency: Frequency; dueDate: string; description: string };
const EMPTY_BATCH_ROW: BatchFeeRow = { title: "", amount: "", frequency: "monthly", dueDate: "", description: "" };

function resolveDefaultDueDate() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export default function AdminFeesPage() {
  const { user } = useAuth();
  const permissions = user?.permissions as { canManageFees?: boolean } | undefined;
  const canManage = user?.role !== "teacher" || !!permissions?.canManageFees;
  const TABS = ALL_TABS.filter((t) => !t.permission || canManage);

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [concessions, setConcessions] = useState<ConcessionRow[]>([]);
  const [academicYear, setAcademicYear] = useState("");

  const [structClass, setStructClass] = useState("");
  const [structModal, setStructModal] = useState<{ open: boolean; editing: StructureRow | null }>({ open: false, editing: null });
  const [structForm, setStructForm] = useState({ title: "", amount: "", frequency: "monthly" as Frequency, dueDate: "", description: "" });
  const [structSaving, setStructSaving] = useState(false);
  const [batchFees, setBatchFees] = useState<BatchFeeRow[]>([EMPTY_BATCH_ROW]);
  const [batchMode, setBatchMode] = useState(false);
  const [pendingDeleteStructure, setPendingDeleteStructure] = useState<StructureRow | null>(null);

  const [conModal, setConModal] = useState<{ open: boolean; editing: ConcessionRow | null }>({ open: false, editing: null });
  const [conForm, setConForm] = useState({
    studentId: "", feeStructureId: "", type: "Custom" as ConcessionType, value: "", isPct: true,
    description: "", duration: "recurring" as ConcessionDuration, validUntil: "",
  });
  const [conSaving, setConSaving] = useState(false);
  const [pendingDeleteCon, setPendingDeleteCon] = useState<ConcessionRow | null>(null);

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [clsR, stuR, strR, anaR, branding] = await Promise.all([
        apiGet<ClassesResponse>("/classes", token).catch(() => ({ success: true, data: [] as ClassOption[] })),
        apiGet<StudentsResponse>("/students", token).catch(() => ({ success: true, data: [] as StudentOption[] })),
        apiGet<StructuresResponse>("/fees/structures", token).catch(() => ({ success: true, data: [] as StructureRow[] })),
        apiGet<AnalyticsResponse>("/fees/analytics", token).catch(() => null),
        apiGet<{ success: boolean; data: { settings?: { sessionStartMonth?: string } } }>("/school/branding", token).catch(() => null),
      ]);
      setClasses(clsR.data);
      setStructClass((prev) => prev || clsR.data[0]?.name || "");
      setStudents(stuR.data);
      setStructures(strR.data);
      setAnalytics(anaR);

      if (canManage) {
        const conR = await apiGet<ConcessionsResponse>("/fees/concessions", token).catch(() => ({ success: true, data: [] as ConcessionRow[] }));
        setConcessions(conR.data);
      }

      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const startMonth = branding?.data.settings?.sessionStartMonth || "April";
      const startIdx = MONTHS.indexOf(startMonth);
      const now = new Date();
      const startYear = now.getFullYear();
      const endMonthIdx = (startIdx + 11) % 12;
      const endYear = endMonthIdx < startIdx ? startYear + 1 : startYear;
      setAcademicYear(`${startYear}-${endYear}`);
    } catch {
      toast.error("Failed to load fee data");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    loadAll();
  }, [loadAll]);

  const dash = {
    totalYear: analytics?.summary.totalCollected ?? 0,
    thisMonth: analytics?.data[new Date().getMonth()]?.collected ?? 0,
    totalPending: analytics?.summary.totalPending ?? 0,
    totalLateFees: analytics?.summary.totalLateFees ?? 0,
    classWise: analytics?.classWise ?? [],
  };

  const openAddStruct = () => {
    setBatchFees([EMPTY_BATCH_ROW]);
    setBatchMode(true);
    setStructModal({ open: true, editing: null });
  };
  const openEditStruct = (s: StructureRow) => {
    setStructForm({ title: s.title, amount: String(s.amount), frequency: s.frequency, dueDate: s.dueDate?.slice(0, 10) || "", description: s.description });
    setBatchMode(false);
    setStructModal({ open: true, editing: s });
  };
  const addBatchRow = () => setBatchFees((prev) => [...prev, EMPTY_BATCH_ROW]);
  const removeBatchRow = (idx: number) => setBatchFees((prev) => prev.filter((_, i) => i !== idx));
  const updateBatchRow = (idx: number, key: keyof BatchFeeRow, value: string) =>
    setBatchFees((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));

  const saveStruct = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    if (!structClass) {
      toast.error("Please select a class");
      return;
    }

    if (batchMode && !structModal.editing) {
      const validFees = batchFees.filter((f) => f.title.trim() && f.amount);
      if (validFees.length === 0) {
        toast.error("Add at least one fee head with title and amount");
        return;
      }
      for (const f of validFees) {
        if ((f.frequency === "yearly" || f.frequency === "one-time") && !f.dueDate) {
          toast.error(`Due date required for "${f.title}" (yearly/one-time)`);
          return;
        }
      }
      setStructSaving(true);
      try {
        const feesPayload = validFees.map((f) => ({
          title: f.title.trim(), amount: Number(f.amount), frequency: f.frequency,
          dueDate: f.dueDate || resolveDefaultDueDate(), description: f.description,
        }));
        const res = await fetch("/api/fees/structures/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ class: structClass, academicYear, fees: feesPayload }),
        });
        const json: { success: boolean; message?: string; data?: StructureRow[] } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
        setStructures((prev) => [...(json.data || []), ...prev]);
        toast.success(`${validFees.length} fee head(s) created for class ${structClass}`);
        setStructModal({ open: false, editing: null });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setStructSaving(false);
      }
      return;
    }

    if (!structForm.title.trim() || !structForm.amount) {
      toast.error("Title and amount are required");
      return;
    }
    const needsDueDate = structForm.frequency === "yearly" || structForm.frequency === "one-time";
    if (needsDueDate && !structForm.dueDate) {
      toast.error("Due date is required for yearly / one-time fees");
      return;
    }
    setStructSaving(true);
    try {
      const body = {
        class: structClass, title: structForm.title.trim(), amount: Number(structForm.amount),
        dueDate: structForm.dueDate || resolveDefaultDueDate(), frequency: structForm.frequency,
        description: structForm.description, academicYear,
      };
      if (structModal.editing) {
        const res = await fetch(`/api/fees/structures/${structModal.editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const json: { success: boolean; message?: string; data?: StructureRow } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
        setStructures((prev) => prev.map((s) => (s._id === structModal.editing!._id ? json.data! : s)));
        toast.success("Fee structure updated");
      } else {
        const res = await fetch("/api/fees/structures", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const json: { success: boolean; message?: string; data?: StructureRow } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
        setStructures((prev) => [json.data!, ...prev]);
        toast.success("Fee structure created");
      }
      setStructModal({ open: false, editing: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setStructSaving(false);
    }
  };

  const handleDeleteStructure = async (s: StructureRow) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/fees/structures/${s._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete");
      setStructures((prev) => prev.filter((x) => x._id !== s._id));
      toast.success("Fee structure deleted");
      setPendingDeleteStructure(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const openAddCon = () => {
    setConForm({ studentId: students[0]?._id || "", feeStructureId: "", type: "Custom", value: "", isPct: true, description: "", duration: "recurring", validUntil: "" });
    setConModal({ open: true, editing: null });
  };
  const openEditCon = (c: ConcessionRow) => {
    setConForm({
      studentId: c.student?._id || "", feeStructureId: c.feeStructure?._id || "", type: c.type, value: String(c.value),
      isPct: c.isPct, description: c.description, duration: c.duration, validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
    });
    setConModal({ open: true, editing: c });
  };
  const saveCon = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !conForm.studentId || !conForm.value) {
      toast.error("Student and value required");
      return;
    }
    setConSaving(true);
    try {
      const body = {
        student: conForm.studentId, feeStructure: conForm.feeStructureId || null, type: conForm.type,
        value: Number(conForm.value), isPct: conForm.isPct, description: conForm.description,
        duration: conForm.duration, validUntil: conForm.duration === "until-date" ? conForm.validUntil : null,
      };
      const res = await fetch(conModal.editing ? `/api/fees/concessions/${conModal.editing._id}` : "/api/fees/concessions", {
        method: conModal.editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json: { success: boolean; message?: string; data?: ConcessionRow } = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      if (conModal.editing) {
        setConcessions((prev) => prev.map((c) => (c._id === conModal.editing!._id ? json.data! : c)));
        toast.success("Concession updated");
      } else {
        setConcessions((prev) => [json.data!, ...prev]);
        toast.success("Concession added");
      }
      setConModal({ open: false, editing: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setConSaving(false);
    }
  };
  const handleDeleteCon = async (c: ConcessionRow) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/fees/concessions/${c._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed");
      setConcessions((prev) => prev.filter((x) => x._id !== c._id));
      toast.success("Concession removed");
      setPendingDeleteCon(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const validBatchCount = batchFees.filter((f) => f.title.trim() && f.amount).length;
  const selectedConStudent = students.find((s) => s._id === conForm.studentId);
  const conFeeStructureOptions = structures.filter((s) => s.class === selectedConStudent?.class);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fee Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Class-wise fee structure, collection &amp; reports.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={loadAll}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="inline-flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/60 p-1.5 text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-300 [&_svg]:transition-transform [&_svg]:duration-300 ${
              tab === t.id
                ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_4px_14px_-2px_rgba(79,70,229,0.45)] [&_svg]:scale-110"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}
          >
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatFilterCard icon={DollarSign} color="#F59E0B" colorDark="#D97706" value={fmt(dash.totalYear)} label="Total Collected (Year)" sublabel={`FY ${new Date().getFullYear()}`} />
            <StatFilterCard icon={TrendingUp} color="#0EA5E9" colorDark="#0284C7" value={fmt(dash.thisMonth)} label="This Month" sublabel={new Date().toLocaleString("en", { month: "short" })} />
            <StatFilterCard icon={AlertCircle} color="#4F46E5" colorDark="#4338CA" value={fmt(dash.totalPending)} label="Pending Dues" sublabel="Across all students" />
            {dash.totalLateFees > 0 && (
              <StatFilterCard icon={Clock} color="#DC2626" colorDark="#B91C1C" value={fmt(dash.totalLateFees)} label="Late Fees Collected" sublabel="From overdue payments" />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="p-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Monthly Collection Trend</h3></div>
              <div className="p-4">
                {!analytics || analytics.data.every((a) => a.collected === 0 && a.pending === 0) ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                      <Tooltip formatter={(v) => [fmt(Number(v)), ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12 }} />
                      <Bar dataKey="collected" fill="#7C3AED" radius={[6, 6, 0, 0]} name="Collected" />
                      <Bar dataKey="pending" fill="#33C6E7" radius={[6, 6, 0, 0]} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="p-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Class-wise Collection</h3></div>
              <div className="p-4">
                {dash.classWise.every((c) => c.collected === 0) ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dash.classWise}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="class" tick={{ fill: "#64748B", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                      <Tooltip formatter={(v) => [fmt(Number(v)), ""]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12 }} />
                      <Bar dataKey="collected" fill="#A78BFA" radius={[6, 6, 0, 0]} name="Collected" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "structure" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {classes.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setStructClass(c.name)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${structClass === c.name ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                >
                  {c.name}{c.section ? `-${c.section}` : ""}
                </button>
              ))}
            </div>
            {canManage && (
              <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5 ml-auto" onClick={openAddStruct}>
                <Plus className="h-4 w-4" /> Add Fee Head
              </Button>
            )}
          </div>

          <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">{structClass || "Select a class"} — Fee Heads</h3>
            </div>
            {structures.filter((s) => s.class === structClass).length === 0 ? (
              <EmptyState icon={DollarSign} message={structClass ? "No fee heads for this class. Click 'Add Fee Head' to create one." : "Select a class first."} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-border bg-muted/50">
                      {["Title", "Amount", "Frequency", "Due Date", "Academic Year", "Actions"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {structures.filter((s) => s.class === structClass).map((s) => (
                        <tr key={s._id} className="border-b border-border hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{s.title}</td>
                          <td className="px-4 py-3 text-sm text-primary font-semibold">{fmt(s.amount)}</td>
                          <td className="px-4 py-3"><Badge variant="secondary" className="text-xs capitalize">{s.frequency}</Badge></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{fmtDate(s.dueDate)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{s.academicYear || "—"}</td>
                          <td className="px-4 py-3">
                            {canManage && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon-sm" onClick={() => openEditStruct(s)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => setPendingDeleteStructure(s)} aria-label="Delete" className="hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-border text-right text-sm">
                  <span className="text-muted-foreground">Total structures: </span>
                  <span className="font-semibold">{structures.filter((s) => s.class === structClass).length}</span>
                  <span className="mx-3 text-muted-foreground/70">|</span>
                  <span className="text-muted-foreground">Sum of amounts: </span>
                  <span className="font-semibold text-primary">{fmt(structures.filter((s) => s.class === structClass).reduce((sum, s) => sum + s.amount, 0))}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "collect" && canManage && <CollectFeeTab />}

      {tab === "reports" && <ReportsTab classes={classes} students={students} />}

      {tab === "concessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Concession / Discount Management</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Apply % or flat discounts per student per fee head.</p>
            </div>
            <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={openAddCon}>
              <Plus className="h-4 w-4" /> Add Concession
            </Button>
          </div>
          {concessions.length === 0 ? (
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <EmptyState icon={Tag} message="No concessions configured yet." />
            </div>
          ) : (
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/50">
                  {["Student", "Class", "Fee Structure", "Type", "Discount", "Duration", "Description", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {concessions.map((c) => {
                    const durationLabel = c.duration === "one-time" ? "One-time" : c.duration === "until-date" ? `Until ${c.validUntil ? new Date(c.validUntil).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "—"}` : "Recurring";
                    return (
                      <tr key={c._id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{c.student?.name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.student?.class || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.feeStructure?.title || "All Structures"}</td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{c.type}</Badge></td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{c.isPct ? `${c.value}%` : fmt(c.value)}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{durationLabel}</Badge></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.description || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEditCon(c)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setPendingDeleteCon(c)} aria-label="Delete" className="hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={structModal.open} onOpenChange={(o) => { if (!o) setStructModal({ open: false, editing: null }); }}>
        <DialogContent className={`${batchMode ? "sm:max-w-2xl" : "sm:max-w-lg"} rounded-2xl max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">{structModal.editing ? "Edit Fee Head" : "Create Fee Heads"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveStruct} className="space-y-4 mt-2">
            {!structModal.editing && (
              <Field label="Class">
                <Select value={structClass} onValueChange={(v) => setStructClass(v || structClass)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c._id} value={c.name}>{c.name}{c.section ? `-${c.section}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Academic Year">
              <Input value={academicYear} disabled placeholder="Auto-filled from settings" className="bg-muted" />
            </Field>

            {batchMode && !structModal.editing ? (
              <>
                {batchFees.map((f, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-4 space-y-3 relative">
                    {batchFees.length > 1 && (
                      <button type="button" onClick={() => removeBatchRow(idx)} className="absolute top-2 right-2 text-muted-foreground/70 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Title" required>
                        <Input value={f.title} onChange={(e) => updateBatchRow(idx, "title", e.target.value)} placeholder="e.g. Tuition Fee" />
                      </Field>
                      <Field label="Amount (₹)" required>
                        <Input type="number" value={f.amount} onChange={(e) => updateBatchRow(idx, "amount", e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="Frequency">
                        <Select value={f.frequency} onValueChange={(v) => updateBatchRow(idx, "frequency", v || f.frequency)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{FREQ_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      {(f.frequency === "yearly" || f.frequency === "one-time") && (
                        <Field label="Due Date">
                          <Input type="date" value={f.dueDate} onChange={(e) => updateBatchRow(idx, "dueDate", e.target.value)} />
                        </Field>
                      )}
                    </div>
                    <Field label="Description (optional)">
                      <Input value={f.description} onChange={(e) => updateBatchRow(idx, "description", e.target.value)} placeholder="Notes..." />
                    </Field>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addBatchRow}>
                  <Plus className="h-3.5 w-3.5" /> Add Another Fee Head
                </Button>
              </>
            ) : (
              <>
                <Field label="Title" required>
                  <Input value={structForm.title} onChange={(e) => setStructForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Tuition Fee" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₹)" required>
                    <Input type="number" value={structForm.amount} onChange={(e) => setStructForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Frequency">
                    <Select value={structForm.frequency} onValueChange={(v) => setStructForm((f) => ({ ...f, frequency: (v || f.frequency) as Frequency }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{FREQ_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  {(structForm.frequency === "yearly" || structForm.frequency === "one-time") && (
                    <Field label="Due Date">
                      <Input type="date" value={structForm.dueDate} onChange={(e) => setStructForm((f) => ({ ...f, dueDate: e.target.value }))} />
                    </Field>
                  )}
                </div>
                <Field label="Description (optional)">
                  <Input value={structForm.description} onChange={(e) => setStructForm((f) => ({ ...f, description: e.target.value }))} placeholder="Notes..." />
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={structSaving}>
                {structSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : structModal.editing ? "Update" : batchMode ? `Create ${validBatchCount} Fee Head(s)` : "Create Fee Head"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setStructModal({ open: false, editing: null })}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={conModal.open} onOpenChange={(o) => { if (!o) setConModal({ open: false, editing: null }); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> {conModal.editing ? "Edit Concession" : "Add Concession"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCon} className="space-y-3 mt-2">
            <Field label="Student" required>
              <Select value={conForm.studentId} onValueChange={(v) => setConForm((f) => ({ ...f, studentId: v || f.studentId, feeStructureId: "" }))} disabled={!!conModal.editing}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} (Class {s.class}{s.section ? "-" + s.section : ""})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fee Structure (optional — leave blank for all)">
              <Select value={conForm.feeStructureId} onValueChange={(v) => setConForm((f) => ({ ...f, feeStructureId: v || "" }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All fee structures" /></SelectTrigger>
                <SelectContent>
                  {conFeeStructureOptions.map((s) => <SelectItem key={s._id} value={s._id}>{s.title} ({fmt(s.amount)})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Concession Type">
              <Select value={conForm.type} onValueChange={(v) => setConForm((f) => ({ ...f, type: (v || f.type) as ConcessionType }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CON_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
                      key={opt.l} type="button" onClick={() => setConForm((f) => ({ ...f, isPct: opt.v }))}
                      className={`flex-1 h-10 rounded-lg border text-xs font-medium transition-all ${conForm.isPct === opt.v ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary"}`}
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
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={conSaving || !conForm.studentId}>
              {conSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : conModal.editing ? "Update Concession" : "Add Concession"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteStructure}
        onOpenChange={(o) => { if (!o) setPendingDeleteStructure(null); }}
        title="Delete fee structure?"
        description={pendingDeleteStructure ? `"${pendingDeleteStructure.title}" will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteStructure && handleDeleteStructure(pendingDeleteStructure)}
      />
      <ConfirmDialog
        open={!!pendingDeleteCon}
        onOpenChange={(o) => { if (!o) setPendingDeleteCon(null); }}
        title="Remove concession?"
        description={pendingDeleteCon ? `The concession for "${pendingDeleteCon.student?.name || "this student"}" will be removed.` : undefined}
        confirmLabel="Remove"
        onConfirm={() => pendingDeleteCon && handleDeleteCon(pendingDeleteCon)}
      />
    </div>
  );
}


function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  );
}
