"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import {
  DollarSign, AlertCircle, Clock, Plus, Pencil, Trash2, Settings, LayoutDashboard,
  CreditCard, FileText, Tag, RefreshCw, Loader2, X, Users, Wallet, Calendar, CalendarDays,
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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
import { PageLoader } from "@/components/PageLoader";
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
interface AnalyticsMonth { month: string; collected: number; pending: number; total?: number }
interface ClassWiseChart { class: string; collected: number; pending?: number; students?: number; pendingStudents?: number }
interface TopStudentRow { studentId: string; name: string; class: string; pending: number; months: number }
interface AnalyticsResponse {
  success: boolean; data: AnalyticsMonth[]; classWise: ClassWiseChart[];
  summary: {
    totalCollected: number; totalPending: number; totalLateFees: number; totalConcessions: number;
    expected?: number; overdue?: number; upcoming?: number; thisMonthCollected?: number;
    totalCollectedFee?: number; thisMonthCollectedFee?: number;
    pendingStudents?: number; feesAssignedStudents?: number; collectedPct?: number; pendingPct?: number;
  };
  topStudents?: TopStudentRow[];
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
// Title comparison used by the duplicate guards — same trimmed,
// case-insensitive rule the API enforces (409 on collision).
const normTitle = (t: string) => t.trim().toLowerCase();

// Tooltip for the Fee Collection Overview chart — the series are per
// fee-month (not per paidDate), so it reads as: this month's total fee,
// how much of it is settled, and what's left. "Fee for month" = the
// month's full assigned fee regardless of payment status.
function FeeChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { payload?: { collected?: number; due?: number; upcoming?: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const fee = (row.collected || 0) + (row.due || 0) + (row.upcoming || 0);
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-sm shadow-[0_8px_24px_-8px_rgba(15,23,42,0.25)]">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">Fee for month: <span className="font-semibold text-foreground">{fmt(fee)}</span></p>
      <p className="text-[#16A34A]">Paid: <span className="font-semibold">{fmt(row.collected || 0)}</span></p>
      <p className="text-[#F59E0B]">Pending: <span className="font-semibold">{fmt(row.due || 0)}</span></p>
      {(row.upcoming || 0) > 0 && <p className="text-[#2563EB]">Upcoming: <span className="font-semibold">{fmt(row.upcoming || 0)}</span></p>}
    </div>
  );
}

const ALL_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "structure", label: "Fee Structure", icon: Settings },
  { id: "collect", label: "Collect Fee", icon: CreditCard, permission: "canManageFees" },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "concessions", label: "Concessions", icon: Tag },
];

type BatchFeeRow = { title: string; amount: string; frequency: Frequency; dueDate: string; description: string };
const EMPTY_BATCH_ROW: BatchFeeRow = { title: "", amount: "", frequency: "monthly", dueDate: "", description: "" };

// One-click starters for the create dialog — admin still types the amount.
const FEE_PRESETS: { title: string; frequency: Frequency }[] = [
  { title: "Tuition Fee", frequency: "monthly" },
  { title: "Transport Fee", frequency: "monthly" },
  { title: "Admission Fee", frequency: "one-time" },
  { title: "Examination Fee", frequency: "yearly" },
  { title: "Lab Fee", frequency: "yearly" },
  { title: "Activity Fee", frequency: "yearly" },
];

function resolveDefaultDueDate() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "Nov 2026 – Mar 2027" style window for the Upcoming card: from the month
// after today (or the FY start, whichever is later) to the FY's last month.
function upcomingWindowLabel(fyVal: string, sessionStart: string) {
  if (!fyVal) return "";
  const fyStartYear = parseInt(fyVal.slice(0, 4), 10);
  if (!fyStartYear) return "";
  let startIdx = MONTHS_FULL.indexOf(sessionStart);
  if (startIdx < 0) startIdx = 3;
  const fyEndIdx = (startIdx + 11) % 12;
  const fyEndYear = fyEndIdx < startIdx ? fyStartYear + 1 : fyStartYear;
  const now = new Date();
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const fyStart = new Date(fyStartYear, startIdx, 1);
  const from = nextStart > fyStart ? nextStart : fyStart;
  if (from > new Date(fyEndYear, fyEndIdx + 1, 0)) return "None left in this FY";
  return `${MONTHS_SHORT[from.getMonth()]} ${from.getFullYear()} – ${MONTHS_SHORT[fyEndIdx]} ${fyEndYear}`;
}

// "Apr 2026 – Mar 2027" — the full current-session window shown on the
// header badge (same session math as upcomingWindowLabel, both ends fixed).
function sessionWindowLabel(fyVal: string, sessionStart: string) {
  if (!fyVal) return "";
  const fyStartYear = parseInt(fyVal.slice(0, 4), 10);
  if (!fyStartYear) return "";
  let startIdx = MONTHS_FULL.indexOf(sessionStart);
  if (startIdx < 0) startIdx = 3;
  const fyEndIdx = (startIdx + 11) % 12;
  const fyEndYear = fyEndIdx < startIdx ? fyStartYear + 1 : fyStartYear;
  return `${MONTHS_SHORT[startIdx]} ${fyStartYear} – ${MONTHS_SHORT[fyEndIdx]} ${fyEndYear}`;
}

// Excel-style month windows, both ends inclusive:
//   pending  = session start → current month
//   overdue  = session start → month before current
//   upcoming = month after current → session end
// Each returns "Apr 2026 – Oct 2026" (or "" when the range is empty).
function pendingWindowLabel(fyVal: string, sessionStart: string) {
  if (!fyVal) return "";
  const fyStartYear = parseInt(fyVal.slice(0, 4), 10);
  if (!fyStartYear) return "";
  let startIdx = MONTHS_FULL.indexOf(sessionStart);
  if (startIdx < 0) startIdx = 3;
  const now = new Date();
  const fyStart = new Date(fyStartYear, startIdx, 1);
  const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = nowMonth > fyStart ? fyStart : nowMonth;
  if (from > nowMonth) return "";
  return `${MONTHS_SHORT[from.getMonth()]} ${from.getFullYear()} – ${MONTHS_SHORT[nowMonth.getMonth()]} ${nowMonth.getFullYear()}`;
}

// Priority bucket for a class on the Fees dashboard — pending share of the
// class's total (collected + pending) exposure, matching the reference's
// High >20% / Medium 10–20% / Low <10% / Cleared 0% tiles.
type ClassBucket = "high" | "medium" | "low" | "cleared";
function classBucket(c: ClassWiseChart): ClassBucket {
  const pending = c.pending || 0;
  const denom = (c.collected || 0) + pending;
  if (denom === 0 || pending === 0) return "cleared";
  const pct = (pending / denom) * 100;
  return pct > 20 ? "high" : pct > 10 ? "medium" : "low";
}

const PRIO_TILES = [
  { key: "high", title: "High Priority", color: "#DC2626", cond: "> 20% pending", icon: AlertTriangle,
    bg: "bg-red-50/70 dark:bg-red-500/10", border: "border-red-100 dark:border-red-500/20",
    chip: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" },
  { key: "medium", title: "Medium Priority", color: "#F59E0B", cond: "10% – 20% pending", icon: AlertCircle,
    bg: "bg-amber-50/70 dark:bg-amber-500/10", border: "border-amber-100 dark:border-amber-500/20",
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" },
  { key: "low", title: "Low Priority", color: "#16A34A", cond: "< 10% pending", icon: Clock,
    bg: "bg-green-50/70 dark:bg-green-500/10", border: "border-green-100 dark:border-green-500/20",
    chip: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400" },
  { key: "cleared", title: "No Pending Dues", color: "#0EA5E9", cond: "0% pending", icon: CheckCircle2,
    bg: "bg-sky-50/70 dark:bg-sky-500/10", border: "border-sky-100 dark:border-sky-500/20",
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400" },
] as const;

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
  // Current session for the Dashboard tab (e.g. "2026-2027") — fixed to the
  // session containing today, derived from settings.sessionStartMonth on
  // first load. No picker: the dashboard only ever shows the current session.
  const [fy, setFy] = useState("");
  const [sessionStart, setSessionStart] = useState("April");
  const [prioFilter, setPrioFilter] = useState<ClassBucket | "all">("all");
  const fyRef = useRef("");

  const [structClass, setStructClass] = useState("");
  // Classes targeted by the Create Fee Heads dialog (batch mode) — fee
  // structures are stored per standard name, so this is a set of names.
  const [structClasses, setStructClasses] = useState<Set<string>>(new Set());
  const [structModal, setStructModal] = useState<{ open: boolean; editing: StructureRow | null }>({ open: false, editing: null });
  const [structForm, setStructForm] = useState({ title: "", amount: "", frequency: "monthly" as Frequency, dueDate: "", description: "" });
  const [structSaving, setStructSaving] = useState(false);
  const [batchFees, setBatchFees] = useState<BatchFeeRow[]>([EMPTY_BATCH_ROW]);
  const [batchMode, setBatchMode] = useState(false);
  const [pendingDeleteStructure, setPendingDeleteStructure] = useState<StructureRow | null>(null);

  const [conModal, setConModal] = useState<{ open: boolean; editing: ConcessionRow | null }>({ open: false, editing: null });
  const [conClassFilter, setConClassFilter] = useState("all");
  const [conForm, setConForm] = useState({
    studentId: "", feeStructureId: "", type: "Custom" as ConcessionType, value: "", isPct: true,
    description: "", duration: "recurring" as ConcessionDuration, validUntil: "",
  });
  const [conSaving, setConSaving] = useState(false);
  const [pendingDeleteCon, setPendingDeleteCon] = useState<ConcessionRow | null>(null);

  const loadAnalytics = useCallback(async (fyVal: string) => {
    const token = getToken();
    if (!token || !fyVal) return;
    const res = await apiGet<AnalyticsResponse>(`/fees/analytics?fy=${fyVal}`, token).catch(() => null);
    setAnalytics(res);
  }, []);

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [clsR, stuR, strR, branding] = await Promise.all([
        apiGet<ClassesResponse>("/classes", token).catch(() => ({ success: true, data: [] as ClassOption[] })),
        apiGet<StudentsResponse>("/students", token).catch(() => ({ success: true, data: [] as StudentOption[] })),
        apiGet<StructuresResponse>("/fees/structures", token).catch(() => ({ success: true, data: [] as StructureRow[] })),
        apiGet<{ success: boolean; data: { settings?: { sessionStartMonth?: string } } }>("/school/branding", token).catch(() => null),
      ]);
      setClasses(clsR.data);
      setStructClass((prev) => prev || clsR.data[0]?.name || "");
      setStudents([...stuR.data].sort((a, b) => a.name.localeCompare(b.name)));
      setStructures([...strR.data].sort((a, b) => a.title.localeCompare(b.title)));

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

      // The Dashboard always shows the session today falls into (current FY
      // only) — no picker. Analytics loads for that session via the [fy] effect.
      setSessionStart(startMonth);
      const sIdx = startIdx >= 0 ? startIdx : 3;
      const curStartYear = now.getMonth() >= sIdx ? startYear : startYear - 1;
      setFy((prev) => prev || `${curStartYear}-${curStartYear + 1}`);
      // A manual refresh re-runs loadAll but not the [fy] effect, so
      // re-fetch analytics here too when a FY is already selected.
      if (fyRef.current) loadAnalytics(fyRef.current);
    } catch {
      toast.error("Failed to load fee data");
    } finally {
      setLoading(false);
    }
  }, [canManage, loadAnalytics]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: initial data load on mount.
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!fy) return;
    fyRef.current = fy;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: FY picker triggers the dashboard data load.
    loadAnalytics(fy);
  }, [fy, loadAnalytics]);

  const sum = analytics?.summary;
  const totalPending = sum?.totalPending ?? 0;
  // "Collected" is the fee component only (excludes late fees) so the stat
  // cards satisfy: Total Fee = Collected + Pending Dues + Upcoming Dues +
  // Late Fees Collected. Server sends totalCollected (cash incl late) and
  // totalCollectedFee (fee component); fall back to the subtraction.
  const totalCollected = sum?.totalCollectedFee ?? (sum ? sum.totalCollected - (sum.totalLateFees || 0) : 0);
  const expected = sum?.expected ?? (sum ? sum.totalCollected + totalPending : totalPending);
  const dash = {
    totalYear: totalCollected,
    thisMonth: sum?.thisMonthCollectedFee ?? (sum ? sum.thisMonthCollected ?? 0 : 0),
    totalPending,
    expected,
    overdue: sum?.overdue ?? 0,
    upcoming: sum?.upcoming ?? 0,
    totalLateFees: sum?.totalLateFees ?? 0,
    totalConcessions: sum?.totalConcessions ?? 0,
    pendingStudents: sum?.pendingStudents ?? 0,
    collectedPct: expected > 0 ? Math.round((totalCollected / expected) * 100) : 0,
    pendingPct: expected > 0 ? Math.round((totalPending / expected) * 100) : 0,
    classWise: analytics?.classWise ?? [],
    topStudents: analytics?.topStudents ?? [],
  };
  // Pending Students denominator = students who actually have fees this
  // session (classes with fee structures), NOT school-wide headcount —
  // otherwise "4 / 50" misleads when only some classes are fee-assigned.
  const feeAssignedStudents = sum?.feesAssignedStudents ?? students.length;
  const pendingStuPct = feeAssignedStudents > 0 ? Math.round((dash.pendingStudents / feeAssignedStudents) * 100) : 0;

  // ---- Dashboard-tab derivations (cheap; computed every render) ----
  const classRows = [...dash.classWise].sort((a, b) =>
    a.class.localeCompare(b.class, undefined, { numeric: true, sensitivity: "base" }),
  );
  const bucketInfo: Record<ClassBucket, { count: number; pending: number }> = {
    high: { count: 0, pending: 0 },
    medium: { count: 0, pending: 0 },
    low: { count: 0, pending: 0 },
    cleared: { count: 0, pending: 0 },
  };
  for (const c of dash.classWise) {
    if (c.students === 0) continue;
    const b = classBucket(c);
    bucketInfo[b].count += 1;
    bucketInfo[b].pending += c.pending || 0;
  }
  const visibleClasses =
    prioFilter === "all" ? classRows : classRows.filter((c) => c.students !== 0 && classBucket(c) === prioFilter);
  const topClasses = [...dash.classWise]
    .filter((c) => (c.pending || 0) > 0)
    .sort((a, b) => (b.pending || 0) - (a.pending || 0))
    .slice(0, 5);
  const donutBase = dash.totalYear + dash.totalPending;
  const donutPct = donutBase > 0 ? Math.round((dash.totalYear / donutBase) * 100) : 0;
  const monthNowLabel = new Date().toLocaleString("en", { month: "short", year: "numeric" });

  // Chart series: per fee-month view where each bar maps 1:1 to a stat
  // card — green = amounts settled against that month's fees (any payment
  // date), orange = that month's unpaid dues, blue = not-yet-started
  // months' dues (Upcoming). The API returns collected/pending per fee
  // month; this split only separates pending into due-till-now vs
  // upcoming for colouring.
  const chartMonths = (() => {
    if (!analytics) return [];
    let sIdx = MONTHS_FULL.indexOf(sessionStart);
    if (sIdx < 0) sIdx = 3;
    const fyStartYear = parseInt(fy.slice(0, 4), 10) || new Date().getFullYear();
    const now = new Date();
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return analytics.data.map((m) => {
      const idx = MONTHS_SHORT.indexOf(m.month);
      // Session months before the FY start label (Jan–Mar for an
      // April-start FY) belong to the following calendar year.
      const year = idx >= 0 && idx < sIdx ? fyStartYear + 1 : fyStartYear;
      const key = `${year}-${String(idx + 1).padStart(2, "0")}`;
      const isUpcoming = idx >= 0 && key > nowKey;
      return {
        month: m.month,
        collected: m.collected,
        due: isUpcoming ? 0 : m.pending,
        upcoming: isUpcoming ? m.pending : 0,
      };
    });
  })();

  const openAddStruct = () => {
    setBatchFees([EMPTY_BATCH_ROW]);
    setBatchMode(true);
    setStructClasses(new Set(structClass ? [structClass] : []));
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
  const toggleStructClass = (name: string) =>
    setStructClasses((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const addPresetRow = (p: { title: string; frequency: Frequency }) =>
    setBatchFees((prev) => {
      if (prev.some((f) => f.title.trim().toLowerCase() === p.title.toLowerCase())) return prev;
      const blank = (f: BatchFeeRow) => !f.title.trim() && !f.amount && !f.description && !f.dueDate;
      return [...prev.filter((f) => !blank(f)), { title: p.title, amount: "", frequency: p.frequency, dueDate: "", description: "" }];
    });

  const saveStruct = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (batchMode && !structModal.editing) {
      if (structClasses.size === 0) {
        toast.error("Select at least one class");
        return;
      }
      const validFees = batchFees.filter((f) => f.title.trim() && f.amount);
      if (validFees.length === 0) {
        toast.error("Add at least one fee head with title and amount");
        return;
      }
      for (const f of validFees) {
        if ((f.frequency === "yearly" || f.frequency === "one-time" || f.frequency === "quarterly") && !f.dueDate) {
          toast.error(`Due date required for "${f.title}" (${f.frequency})`);
          return;
        }
      }
      // Duplicate guards — instant feedback before any network call; the API
      // enforces the same rule (409) as a backstop for stale state. Blocked
      // outright (nothing skipped) so the result is always predictable.
      const seenTitles = new Set<string>();
      for (const f of validFees) {
        const key = normTitle(f.title);
        if (seenTitles.has(key)) {
          toast.error(`Duplicate fee head in the list: "${f.title.trim()}" appears twice.`);
          return;
        }
        seenTitles.add(key);
        const hits = [...structClasses]
          .filter((cls) => structures.some((s) => s.class === cls && normTitle(s.title) === key))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (hits.length > 0) {
          toast.error(`"${f.title.trim()}" already exists for Class ${hits.join(", ")} — edit or delete it instead.`);
          return;
        }
      }
      setStructSaving(true);
      try {
        const feesPayload = validFees.map((f) => ({
          title: f.title.trim(), amount: Number(f.amount), frequency: f.frequency,
          dueDate: f.dueDate || resolveDefaultDueDate(), description: f.description,
        }));
        // One batch POST per selected class — the endpoint is per-class, so
        // multi-class create is a small client-side loop, no API change.
        const created: StructureRow[] = [];
        for (const cls of structClasses) {
          const res = await fetch("/api/fees/structures/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ class: cls, academicYear, fees: feesPayload }),
          });
          const json: { success: boolean; message?: string; data?: StructureRow[] } = await res.json();
          if (!res.ok || !json.success) throw new Error(json.message || `Failed to save for class ${cls}`);
          created.push(...(json.data || []));
        }
        setStructures((prev) => [...created, ...prev]);
        toast.success(`${validFees.length} fee head(s) created for ${structClasses.size} class${structClasses.size === 1 ? "" : "es"}`);
        setStructModal({ open: false, editing: null });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setStructSaving(false);
      }
      return;
    }

    if (!structClass) {
      toast.error("Please select a class");
      return;
    }

    if (!structForm.title.trim() || !structForm.amount) {
      toast.error("Title and amount are required");
      return;
    }
    const needsDueDate = structForm.frequency === "yearly" || structForm.frequency === "one-time" || structForm.frequency === "quarterly";
    if (needsDueDate && !structForm.dueDate) {
      toast.error("Due date is required for yearly / one-time / quarterly fees");
      return;
    }
    // Duplicate guard — same rule as batch; the API enforces it too (409).
    if (structModal.editing) {
      const editing = structModal.editing;
      if (
        structures.some(
          (s) => s.class === editing.class && s._id !== editing._id && normTitle(s.title) === normTitle(structForm.title),
        )
      ) {
        toast.error(`"${structForm.title.trim()}" already exists for Class ${editing.class} — edit or delete it instead.`);
        return;
      }
    } else if (structures.some((s) => s.class === structClass && normTitle(s.title) === normTitle(structForm.title))) {
      toast.error(`"${structForm.title.trim()}" already exists for Class ${structClass} — edit or delete it instead.`);
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
    setConClassFilter("all");
    setConForm({ studentId: students[0]?._id || "", feeStructureId: "", type: "Custom", value: "", isPct: true, description: "", duration: "recurring", validUntil: "" });
    setConModal({ open: true, editing: null });
  };
  const openEditCon = (c: ConcessionRow) => {
    const stu = students.find((s) => s._id === c.student?._id);
    setConClassFilter(stu ? `${stu.class}-${stu.section || ""}` : "all");
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
    if (conForm.duration === "until-date" && !conForm.validUntil) {
      toast.error("Valid Until date is required for \"Until a date\" duration");
      return;
    }
    if (conForm.isPct && Number(conForm.value) > 100) {
      toast.error("Percent discount cannot exceed 100%");
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
  const uniqueStructClassNames = [...new Set(classes.map((c) => c.name))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Live "already exists" hints under the Title field(s) — same rule as the
  // save guard, updating as the title is typed and classes are toggled.
  const classesWithHead = (title: string, candidates: string[], excludeId?: string) => {
    const t = normTitle(title);
    if (!t) return [];
    return candidates
      .filter((cls) => structures.some((s) => s.class === cls && s._id !== excludeId && normTitle(s.title) === t))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };
  const structFormDupHits = structForm.title.trim()
    ? classesWithHead(structForm.title, [structModal.editing ? structModal.editing.class : structClass], structModal.editing?._id)
    : [];
  const structFormDup = structFormDupHits.length > 0 ? `Already exists for Class ${structFormDupHits.join(", ")}` : "";
  const batchDupHints = batchFees.map((f) => {
    const hits = classesWithHead(f.title, [...structClasses]);
    return hits.length > 0 ? `Already exists for Class ${hits.join(", ")}` : "";
  });
  const batchRepeated = batchFees.map((f, i) => {
    const t = normTitle(f.title);
    return !!t && batchFees.some((g, j) => j !== i && normTitle(g.title) === t);
  });
  const conStudentOptions = students.filter((s) => conClassFilter === "all" || `${s.class}-${s.section || ""}` === conClassFilter);
  const selectedConStudent = students.find((s) => s._id === conForm.studentId);
  const conFeeStructureOptions = structures.filter((s) => s.class === selectedConStudent?.class);

  if (loading) {
    return <PageLoader label="Loading fees..." />;
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

      {/* max-lg:* only ever applies below the 1024px mobile/tablet cutoff
          (see AGENTS/CLAUDE notes: desktop must stay pixel-identical) -- it
          turns the flex-wrap pill row, which wrapped onto two cramped lines
          on a phone, into a horizontally scrollable single row instead, the
          same fix as the shared Tabs primitive. */}
      <div className="inline-flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/60 p-1.5 text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] max-lg:w-full max-lg:flex-nowrap max-lg:justify-start max-lg:overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-300 [&_svg]:transition-transform [&_svg]:duration-300 max-lg:shrink-0 ${
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
          {/* Header: title + FY selector + today's date */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_8px_18px_-6px_rgba(79,70,229,0.6)]">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Fees Dashboard</h2>
                <p className="text-sm text-muted-foreground">Track fee collection, pending dues and upcoming fees at a glance.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Session: {sessionWindowLabel(fy, sessionStart)}
              </div>
              <div className="hidden h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground sm:flex">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Stat row 1 — core session amounts (identity: Total
              Fee = Collected + Pending + Upcoming + Late Fees).
              "Total Students" card removed: its count lives in the
              Pending Students denominator. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatFilterCard icon={Users} color="#8B5CF6" colorDark="#7C3AED" value={`${dash.pendingStudents} / ${feeAssignedStudents}`} label="Pending Students" sublabel={`${pendingStuPct}% · of students with fees assigned`} />
            <StatFilterCard icon={Wallet} color="#0EA5E9" colorDark="#0284C7" value={fmt(dash.expected)} label="Total Fee (This Session)" sublabel={`${sessionWindowLabel(fy, sessionStart)} · = Collected + Pending + Upcoming + Late`} />
            <StatFilterCard icon={CalendarDays} color="#0891B2" colorDark="#0E7490" value={fmt(dash.thisMonth)} label="Collected This Month" sublabel={`Fee received (excl. late) · ${monthNowLabel}`} />
            <StatFilterCard icon={AlertCircle} color="#F59E0B" colorDark="#D97706" value={fmt(dash.totalPending)} label="Pending Dues" sublabel={`Due till now · ${pendingWindowLabel(fy, sessionStart)}`} />
          </div>

          {/* Stat row 2 — upcoming, remaining collected (fee only), adjustments.
              Overdue card removed on request: it nests inside Pending Dues
              (start→last month ⊂ start→now). */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatFilterCard icon={CalendarClock} color="#2563EB" colorDark="#1D4ED8" value={fmt(dash.upcoming)} label="Upcoming Dues" sublabel={`Next month → session end · ${upcomingWindowLabel(fy, sessionStart)}`} />
            <StatFilterCard icon={DollarSign} color="#16A34A" colorDark="#15803D" value={fmt(dash.totalYear)} label="Collected" sublabel={`Fee received (excl. late) · ${dash.collectedPct}% of total fee`} />
            <StatFilterCard icon={Clock} color="#EA580C" colorDark="#C2410C" value={fmt(dash.totalLateFees)} label="Late Fees Collected" sublabel="Charged on late payments" />
            <StatFilterCard icon={Tag} color="#0D9488" colorDark="#0F766E" value={fmt(dash.totalConcessions)} label="Concessions Given" sublabel="Waived on fees" />
          </div>

          {/* Overview chart + overall donut */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <h3 className="text-base font-semibold text-foreground">Fee Collection Overview</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#16A34A]" />Collected</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F59E0B]" />Pending (due till now)</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#93C5FD]" />Upcoming</span>
                </div>
              </div>
              <div className="p-4">
                {!analytics || analytics.data.every((a) => a.collected === 0 && a.pending === 0) ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartMonths}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                      <Tooltip formatter={(v, name) => [fmt(Number(v)), name]} contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12 }} />
                      <Bar dataKey="collected" fill="#16A34A" radius={[4, 4, 0, 0]} name="Collected" />
                      <Bar dataKey="due" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Pending" />
                      <Bar dataKey="upcoming" fill="#93C5FD" radius={[4, 4, 0, 0]} name="Upcoming" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="border-b border-border p-4"><h3 className="text-base font-semibold text-foreground">Fees Status (Overall)</h3></div>
              <div className="p-4">
                {donutBase === 0 ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Collected", value: dash.totalYear },
                              { name: "Pending", value: dash.totalPending },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={85}
                            paddingAngle={2}
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                          >
                            <Cell fill="#16A34A" />
                            <Cell fill="#F59E0B" />
                          </Pie>
                      <Tooltip content={<FeeChartTooltip />} cursor={{ fill: "rgba(15,23,42,0.05)" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{donutPct}%</span>
                        <span className="text-xs text-muted-foreground">Collected</span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />Collected</span>
                        <span className="font-medium text-foreground">{fmt(dash.totalYear)} <span className="text-muted-foreground">({donutPct}%)</span></span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />Pending</span>
                        <span className="font-medium text-foreground">{fmt(dash.totalPending)} <span className="text-muted-foreground">({100 - donutPct}%)</span></span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Class-wise table + pending priority tiles */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-base font-semibold text-foreground">Fee Collection by Class</h3>
                <button type="button" onClick={() => setTab("reports")} className="text-sm font-medium text-primary hover:underline">View All</button>
              </div>
              <div className="p-4">
                {visibleClasses.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    {dash.classWise.length === 0 ? "No data yet" : "No classes match this filter"}
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-2 pb-2.5 font-medium">Class</th>
                          <th className="px-2 pb-2.5 font-medium">Students</th>
                          <th className="px-2 pb-2.5 font-medium">Collected</th>
                          <th className="px-2 pb-2.5 font-medium">Pending</th>
                          <th className="w-[170px] px-2 pb-2.5 font-medium">% Collected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleClasses.map((c) => {
                          const denom = (c.collected || 0) + (c.pending || 0);
                          const pct = denom > 0 ? Math.round(((c.collected || 0) / denom) * 100) : 0;
                          return (
                            <tr key={c.class} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40">
                              <td className="px-2 py-2.5">
                                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{c.class}</span>
                              </td>
                              <td className="px-2 py-2.5 text-muted-foreground">{c.students ?? "—"}</td>
                              <td className="px-2 py-2.5 font-medium text-foreground">{fmt(c.collected)}</td>
                              <td className="px-2 py-2.5 font-medium" style={(c.pending || 0) > 0 ? { color: "#F59E0B" } : undefined}>{fmt(c.pending || 0)}</td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full" style={{ width: `${denom > 0 ? Math.max(pct, 2) : 0}%`, background: "linear-gradient(90deg,#16A34A,#0D9488)" }} />
                                  </div>
                                  <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
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
            </div>

            <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
              <div className="border-b border-border p-4"><h3 className="text-base font-semibold text-foreground">Pending Fee Summary</h3></div>
              <div className="space-y-3 p-4">
                {PRIO_TILES.map((t) => {
                  const info = bucketInfo[t.key];
                  const active = prioFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setPrioFilter((p) => (p === t.key ? "all" : t.key))}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 ${t.bg} ${t.border}`}
                      style={active ? { boxShadow: `0 0 0 1.5px ${t.color}` } : undefined}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
                        <t.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold" style={{ color: t.color }}>{t.title}</span>
                        <span className="block text-sm font-bold text-foreground">{info.count} {info.count === 1 ? "Class" : "Classes"} · {fmt(info.pending)}</span>
                        <span className="block text-[11px] text-muted-foreground">({t.cond})</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top defaulters — "Top 5 Pending Students" card removed on request */}
          <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <div className="border-b border-border p-4"><h3 className="text-base font-semibold text-foreground">Top 5 Classes by Pending Amount</h3></div>
            <div className="p-4">
              {topClasses.length === 0 ? (
                <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">No pending dues 🎉</div>
              ) : (
                <div className="space-y-3">
                  {topClasses.map((c, i) => {
                    const denom = (c.collected || 0) + (c.pending || 0);
                    const pendingPct = denom > 0 ? Math.round(((c.pending || 0) / denom) * 100) : 0;
                    return (
                      <div key={c.class} className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: i === 0 ? "#FEE2E2" : i === 1 ? "#FFEDD5" : "#E2E8F0",
                            color: i === 0 ? "#DC2626" : i === 1 ? "#F59E0B" : "#475569",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span className="w-16 shrink-0 text-sm font-semibold text-foreground">{c.class}</span>
                        <span className="hidden w-20 shrink-0 text-xs text-muted-foreground sm:block">{c.students ?? 0} students</span>
                        <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">{c.pendingStudents ?? 0} pending</span>
                        <span className="w-24 shrink-0 text-sm font-semibold" style={{ color: "#F59E0B" }}>{fmt(c.pending || 0)}</span>
                        <div className="h-2 min-w-[50px] flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(pendingPct, 2)}%`,
                              background: pendingPct > 20 ? "#DC2626" : pendingPct > 10 ? "#F59E0B" : "#16A34A",
                            }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{pendingPct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <Field label="Apply to Classes" required>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setStructClasses(structClasses.size === uniqueStructClassNames.length && uniqueStructClassNames.length > 0 ? new Set() : new Set(uniqueStructClassNames))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${structClasses.size === uniqueStructClassNames.length && uniqueStructClassNames.length > 0 ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                  >
                    All Classes
                  </button>
                  {uniqueStructClassNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleStructClass(name)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${structClasses.has(name) ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                    >
                      Class {name}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Academic Year">
              <Input value={academicYear} disabled placeholder="Auto-filled from settings" className="bg-muted" />
            </Field>

            {batchMode && !structModal.editing ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Quick add:</span>
                  {FEE_PRESETS.map((p) => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => addPresetRow(p)}
                      disabled={batchFees.some((f) => f.title.trim().toLowerCase() === p.title.toLowerCase())}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
                    >
                      <Plus className="h-3 w-3" /> {p.title}
                    </button>
                  ))}
                </div>
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
                        {(batchRepeated[idx] || batchDupHints[idx]) && (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                            {batchRepeated[idx] ? "Repeated in this list" : batchDupHints[idx]}
                          </p>
                        )}
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
                      <Field label="Due Date" required={f.frequency === "quarterly"}>
                        <Input type="date" value={f.dueDate} onChange={(e) => updateBatchRow(idx, "dueDate", e.target.value)} />
                        {f.frequency === "monthly" && (
                          <p className="text-xs text-muted-foreground">Day of month used each month · late fee counted from this day</p>
                        )}
                        {f.frequency === "quarterly" && <p className="text-xs text-muted-foreground">1st quarter due · then every 3 months</p>}
                      </Field>
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
                  {structFormDup && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      {structFormDup}
                    </p>
                  )}
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
                  <Field label="Due Date" required={structForm.frequency === "quarterly"}>
                    <Input type="date" value={structForm.dueDate} onChange={(e) => setStructForm((f) => ({ ...f, dueDate: e.target.value }))} />
                    {structForm.frequency === "monthly" && (
                      <p className="text-xs text-muted-foreground">Day of month used each month · late fee counted from this day</p>
                    )}
                    {structForm.frequency === "quarterly" && <p className="text-xs text-muted-foreground">1st quarter due · then every 3 months</p>}
                  </Field>
                </div>
                <Field label="Description (optional)">
                  <Input value={structForm.description} onChange={(e) => setStructForm((f) => ({ ...f, description: e.target.value }))} placeholder="Notes..." />
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={structSaving}>
                {structSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : structModal.editing ? "Update" : batchMode ? `Create ${validBatchCount} Fee Head(s) for ${structClasses.size} Class(es)` : "Create Fee Head"}
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
            <Field label="Class" required>
              <Select value={conClassFilter} onValueChange={(v) => {
                const next = v || "all";
                setConClassFilter(next);
                setConForm((f) => {
                  if (!f.studentId) return f;
                  const stillVisible = students.some((s) => s._id === f.studentId && (next === "all" || `${s.class}-${s.section || ""}` === next));
                  return stillVisible ? f : { ...f, studentId: "", feeStructureId: "" };
                });
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c._id} value={`${c.name}-${c.section || ""}`}>Class {c.name}{c.section ? `-${c.section}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Student" required>
              <Select value={conForm.studentId} onValueChange={(v) => setConForm((f) => ({ ...f, studentId: v || f.studentId, feeStructureId: "" }))} disabled={!!conModal.editing}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {conStudentOptions.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} (Class {s.class}{s.section ? "-" + s.section : ""})</SelectItem>)}
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
                <Input type="number" min={0} max={conForm.isPct ? 100 : undefined} placeholder={conForm.isPct ? "e.g. 20" : "e.g. 500"} value={conForm.value} onChange={(e) => setConForm((f) => ({ ...f, value: e.target.value }))} required />
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
