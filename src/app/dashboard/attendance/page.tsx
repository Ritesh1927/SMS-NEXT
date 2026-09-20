"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Check, X, Clock, Save, ChevronLeft, ChevronRight, CalendarCheck,
  ClipboardCheck, Users, Search, BarChart3, UserSearch, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatFilterCard } from "@/components/StatFilterCard";
import { StudentAttendanceCalendar } from "@/components/dashboard/StudentAttendanceCalendar";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Status = "present" | "absent" | "late";

interface ClassOption {
  _id: string;
  label: string;
}

interface RosterEntry {
  student: { _id: string; name: string; rollNumber?: string; photo?: string };
  status: Status | null;
}

interface ClassesResponse {
  success: boolean;
  data: { _id: string; name: string; section: string }[];
}

interface TeacherDashboardResponse {
  success: boolean;
  data: { classBreakdown: { classId?: string; label: string }[] };
}

interface RosterResponse {
  success: boolean;
  data: RosterEntry[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const STATUS_STYLES: Record<Status, string> = {
  present: "bg-green-100 text-green-700 border-green-300",
  absent: "bg-red-100 text-red-700 border-red-300",
  late: "bg-amber-100 text-amber-700 border-amber-300",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [classOptions, setClassOptions] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;
    if (user.role === "schooladmin") {
      apiGet<ClassesResponse>("/classes", token)
        .then((res) => setClassOptions(res.data.map((c) => ({ _id: c._id, label: `${c.name}-${c.section}` }))))
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load classes."));
    } else if (user.role === "teacher") {
      apiGet<TeacherDashboardResponse>("/dashboard/teacher", token)
        .then((res) =>
          setClassOptions(
            res.data.classBreakdown.filter((c) => c.classId).map((c) => ({ _id: c.classId as string, label: c.label })),
          ),
        )
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load classes."));
    }
  }, [user]);

  const loadRoster = useCallback(() => {
    const token = getToken();
    if (!token || !classId) return;
    setLoadingRoster(true);
    setRoster(null);
    apiGet<RosterResponse>(`/attendance/class/${classId}?date=${date}`, token)
      .then((res) => setRoster(res.data.map((r) => ({ ...r, status: r.status || "present" }))))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load roster."))
      .finally(() => setLoadingRoster(false));
  }, [classId, date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch the roster whenever class or date changes.
    if (classId) loadRoster();
  }, [classId, date, loadRoster]);

  const setStatus = (studentId: string, status: Status) => {
    setRoster((r) => r && r.map((entry) => (entry.student._id === studentId ? { ...entry, status } : entry)));
  };

  const markAll = (status: Status) => {
    setRoster((r) => r && r.map((entry) => ({ ...entry, status })));
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token || !roster || !classId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          classId,
          date,
          attendance: roster.map((r) => ({ studentId: r.student._id, status: r.status })),
        }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save attendance.");
      toast.success("Attendance saved", { description: json.message });
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (user.role === "parent") {
    return <ParentAttendance />;
  }

  if (user.role !== "schooladmin" && user.role !== "teacher") {
    return <p className="text-sm text-muted-foreground">Attendance isn&apos;t available for your role.</p>;
  }

  return (
    <div>
      <PageHeader icon={ClipboardCheck} title="Attendance" subtitle="Mark daily attendance and review attendance trends." accent="amber" className="mb-6" />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mark" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" /> Mark Attendance
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Class &amp; School Stats
          </TabsTrigger>
          <TabsTrigger value="lookup" className="gap-1.5">
            <UserSearch className="h-4 w-4" /> Student Lookup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-6">
          <div className="rounded-2xl bg-card border border-border shadow-sm p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Class</label>
                {error ? null : classOptions === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                  </div>
                ) : classOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground h-10 flex items-center">
                    {user.role === "teacher" ? "No classes assigned to you yet." : "No classes created yet."}
                  </p>
                ) : (
                  <Select value={classId} onValueChange={(v) => setClassId(v || "")}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {classOptions.map((c) => (
                        <SelectItem key={c._id} value={c._id}>Class {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Date</label>
                <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-40" />
              </div>
              {roster && roster.length > 0 && (
                <>
                  <Button variant="outline" onClick={() => markAll("present")} className="text-success border-success/30 hover:bg-success/10">
                    Mark All Present
                  </Button>
                  <Button variant="outline" onClick={() => markAll("absent")} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    Mark All Absent
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="gap-1.5 ml-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Attendance
                  </Button>
                </>
              )}
            </div>
          </div>

          {!classId && (
            <div className="rounded-2xl bg-card border border-border shadow-sm">
              <EmptyState icon={Users} message="Select a class above to mark or review attendance." />
            </div>
          )}

          {roster && roster.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-card p-4 text-center border border-border shadow-sm">
                <p className="text-2xl font-bold text-success">{roster.filter((r) => r.status === "present").length}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div className="rounded-2xl bg-card p-4 text-center border border-border shadow-sm">
                <p className="text-2xl font-bold text-destructive">{roster.filter((r) => r.status === "absent").length}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
              <div className="rounded-2xl bg-card p-4 text-center border border-border shadow-sm">
                <p className="text-2xl font-bold text-warning">{roster.filter((r) => r.status === "late").length}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </div>
          )}

          {loadingRoster && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading roster...
            </div>
          )}

          {!loadingRoster && roster && roster.length === 0 && (
            <div className="rounded-2xl bg-card border border-border shadow-sm">
              <EmptyState icon={Users} message="No active students in this class." />
            </div>
          )}

          {!loadingRoster && roster && roster.length > 0 && (
            <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
              {roster.map((entry) => (
                <div
                  key={entry.student._id}
                  className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.student.name}</p>
                    <p className="text-xs text-muted-foreground">Roll {entry.student.rollNumber || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(["present", "late", "absent"] as Status[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(entry.student._id, s)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          entry.status === s ? STATUS_STYLES[s] : "bg-transparent text-muted-foreground border-border"
                        }`}
                      >
                        {s === "present" && <Check className="h-3 w-3" />}
                        {s === "absent" && <X className="h-3 w-3" />}
                        {s === "late" && <Clock className="h-3 w-3" />}
                        {s[0].toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <ClassStats classOptions={classOptions || []} />
        </TabsContent>

        <TabsContent value="lookup">
          <StudentLookup />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ClassMonthlyRow {
  class: string;
  rate: number;
  present: number;
  total: number;
}

interface MonthlyResponse {
  success: boolean;
  data: ClassMonthlyRow[];
}

interface YearlyRow {
  month: number;
  rate: number;
  present: number;
  total: number;
}

interface YearlyResponse {
  success: boolean;
  data: YearlyRow[];
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ClassStats({ classOptions }: { classOptions: ClassOption[] }) {
  const now = new Date();
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [statsClassId, setStatsClassId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState<ClassMonthlyRow[] | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever scope/period/date changes.
    setLoading(true);
    if (period === "monthly") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever scope/period/date changes.
      setMonthlyData(null);
      const qs = statsClassId ? `month=${month}&year=${year}&classId=${statsClassId}` : `month=${month}&year=${year}`;
      apiGet<MonthlyResponse>(`/attendance/monthly?${qs}`, token)
        .then((res) => setMonthlyData(res.data))
        .catch(() => setMonthlyData([]))
        .finally(() => setLoading(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever scope/period/date changes.
      setYearlyData(null);
      const qs = statsClassId ? `year=${year}&classId=${statsClassId}` : `year=${year}`;
      apiGet<YearlyResponse>(`/attendance/yearly?${qs}`, token)
        .then((res) => setYearlyData(res.data))
        .catch(() => setYearlyData([]))
        .finally(() => setLoading(false));
    }
  }, [period, statsClassId, month, year]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const scopeLabel = statsClassId ? `Class ${classOptions.find((c) => c._id === statsClassId)?.label || ""}` : "All Classes";

  const monthlyTotal = (monthlyData || []).reduce((sum, r) => sum + r.total, 0);
  const monthlyPresent = (monthlyData || []).reduce((sum, r) => sum + r.present, 0);
  const monthlyRate = monthlyTotal > 0 ? Math.round((monthlyPresent / monthlyTotal) * 100) : 0;
  const singleClassRow = statsClassId ? monthlyData?.[0] : undefined;

  const yearlyTotal = (yearlyData || []).reduce((sum, r) => sum + r.total, 0);
  const yearlyPresent = (yearlyData || []).reduce((sum, r) => sum + r.present, 0);
  const yearlyRate = yearlyTotal > 0 ? Math.round((yearlyPresent / yearlyTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card border border-border shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Scope</label>
            <Select value={statsClassId} onValueChange={(v) => setStatsClassId(v || "")}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Classes</SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c._id} value={c._id}>Class {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Period</label>
            <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/30">
              <button
                type="button"
                onClick={() => setPeriod("monthly")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${period === "monthly" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriod("yearly")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${period === "yearly" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => (period === "monthly" ? changeMonth(-1) : setYear((y) => y - 1))} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground w-32 text-center">
              {period === "monthly" ? `${MONTH_NAMES[month - 1]} ${year}` : year}
            </p>
            <Button variant="ghost" size="icon-sm" onClick={() => (period === "monthly" ? changeMonth(1) : setYear((y) => y + 1))} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : period === "monthly" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatFilterCard
              icon={CalendarCheck}
              color="#4F46E5"
              colorDark="#4338CA"
              value={`${statsClassId ? singleClassRow?.rate ?? 0 : monthlyRate}%`}
              label="Attendance Rate"
              sublabel={scopeLabel}
            />
            <StatFilterCard
              icon={Users}
              color="#16A34A"
              colorDark="#15803D"
              value={statsClassId ? singleClassRow?.present ?? 0 : monthlyPresent}
              label="Present Markings"
              sublabel={`${MONTH_NAMES[month - 1]} ${year}`}
            />
            <StatFilterCard
              icon={ClipboardCheck}
              color="#0EA5E9"
              colorDark="#0284C7"
              value={statsClassId ? singleClassRow?.total ?? 0 : monthlyTotal}
              label="Total Markings"
              sublabel="Present + Absent + Late"
            />
          </div>

          {!statsClassId && (
            <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Per-Class Breakdown</p>
              </div>
              {(monthlyData || []).length === 0 ? (
                <EmptyState icon={BarChart3} message="No attendance marked for this month yet." />
              ) : (
                (monthlyData || []).map((row) => (
                  <div key={row.class} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0">
                    <p className="text-sm font-medium text-foreground w-24 shrink-0">Class {row.class}</p>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.rate >= 90 ? "bg-success" : row.rate >= 75 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${row.rate}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-12 text-right shrink-0">{row.rate}%</span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatFilterCard icon={TrendingUp} color="#4F46E5" colorDark="#4338CA" value={`${yearlyRate}%`} label="Yearly Attendance Rate" sublabel={scopeLabel} />
            <StatFilterCard icon={Users} color="#16A34A" colorDark="#15803D" value={yearlyPresent} label="Total Present Markings" sublabel={`${year} · ${yearlyTotal} total markings`} />
          </div>

          <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Monthly Trend — {year}</p>
            {(yearlyData || []).every((m) => m.total === 0) ? (
              <EmptyState icon={BarChart3} message="No attendance marked for this year yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={(yearlyData || []).map((m) => ({ ...m, label: MONTH_SHORT[m.month - 1] }))} margin={{ left: -16 }}>
                  <defs>
                    <linearGradient id="yearlyAttendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                  <Area type="monotone" dataKey="rate" name="Attendance" stroke="#4F46E5" fill="url(#yearlyAttendGrad)" strokeWidth={2.5} activeDot={{ r: 5, fill: "#4F46E5", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface LookupStudentRow {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
}

interface LookupStudentsResponse {
  success: boolean;
  data: LookupStudentRow[];
}

function StudentLookup() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const [students, setStudents] = useState<LookupStudentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LookupStudentRow | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<LookupStudentsResponse>(isTeacher ? "/teachers/my-students" : "/students", token)
      .then((res) => setStudents(res.data))
      .catch(() => setStudents([]));
  }, [isTeacher]);

  const filtered = (students || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || (s.rollNumber || "").toLowerCase().includes(q);
  });

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to search
        </button>
        <div className="rounded-2xl bg-card border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
            {selected.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              Class {selected.class}{selected.section ? `-${selected.section}` : ""} · Roll {selected.rollNumber || "—"}
            </p>
          </div>
        </div>
        <StudentAttendanceCalendar studentId={selected._id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or roll number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {students === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border shadow-sm">
          <EmptyState icon={UserSearch} message="No students match your search." />
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => setSelected(s)}
              className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Class {s.class}{s.section ? `-${s.section}` : ""} · Roll {s.rollNumber || "—"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
          ))}
        </div>
      )}
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

function ParentAttendance() {
  const [children, setChildren] = useState<ChildOption[] | null>(null);
  const [childId, setChildId] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentDashboardResponse>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setChildId(res.data.children[0]._id);
      })
      .catch(() => setChildren([]));
  }, []);

  const selectedChild = children?.find((c) => c._id === childId) || null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <PageHeader icon={CalendarCheck} title="Attendance Record" subtitle="Monthly attendance history for your child." accent="amber" />
        {children && children.length > 1 && (
          <Select value={childId} onValueChange={(v) => setChildId(v || "")}>
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
          <div className="rounded-full bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] px-4 py-2 text-sm">
            <span className="font-semibold text-foreground">{selectedChild.name}</span>
            <span className="text-muted-foreground"> — Class {selectedChild.class}{selectedChild.section ? `-${selectedChild.section}` : ""}</span>
          </div>
        )}
      </div>

      {children === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-muted-foreground">No children linked to your account yet.</p>
        </div>
      ) : (
        childId && <StudentAttendanceCalendar studentId={childId} />
      )}
    </div>
  );
}
