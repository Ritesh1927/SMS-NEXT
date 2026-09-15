"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X, Clock, Save, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    return <p className="text-sm text-[#64748B]">Attendance isn&apos;t available for your role.</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#172554]">Attendance</h1>
        <p className="text-sm text-[#64748B] mt-1">Mark daily attendance for a class.</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#172554]">Class</label>
          {classOptions === null ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B] h-8">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
            </div>
          ) : classOptions.length === 0 ? (
            <p className="text-sm text-[#64748B]">
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
          <label className="text-xs font-semibold text-[#172554]">Date</label>
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
        {roster && roster.length > 0 && (
          <>
            <Button variant="outline" onClick={() => markAll("present")} className="text-green-700 border-green-300 hover:bg-green-50">
              Mark All Present
            </Button>
            <Button variant="outline" onClick={() => markAll("absent")} className="text-red-700 border-red-300 hover:bg-red-50">
              Mark All Absent
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] ml-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Attendance
            </Button>
          </>
        )}
      </div>

      {roster && roster.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-[18px] bg-white p-4 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <p className="text-2xl font-bold text-green-600">{roster.filter((r) => r.status === "present").length}</p>
            <p className="text-xs text-[#64748B]">Present</p>
          </div>
          <div className="rounded-[18px] bg-white p-4 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <p className="text-2xl font-bold text-red-600">{roster.filter((r) => r.status === "absent").length}</p>
            <p className="text-xs text-[#64748B]">Absent</p>
          </div>
          <div className="rounded-[18px] bg-white p-4 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
            <p className="text-2xl font-bold text-amber-600">{roster.filter((r) => r.status === "late").length}</p>
            <p className="text-xs text-[#64748B]">Late</p>
          </div>
        </div>
      )}

      {loadingRoster && (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading roster...
        </div>
      )}

      {!loadingRoster && roster && roster.length === 0 && (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No active students in this class.</p>
        </div>
      )}

      {!loadingRoster && roster && roster.length > 0 && (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {roster.map((entry) => (
            <div
              key={entry.student._id}
              className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9] last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-[#172554]">{entry.student.name}</p>
                <p className="text-xs text-[#64748B]">Roll {entry.student.rollNumber || "—"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["present", "late", "absent"] as Status[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(entry.student._id, s)}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      entry.status === s ? STATUS_STYLES[s] : "bg-transparent text-[#94A3B8] border-[#E2E8F0]"
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

interface AttendanceRecordRow {
  _id: string;
  date: string;
  status: Status;
  class: string;
}

interface StudentAttendanceResponse {
  success: boolean;
  data: {
    records: AttendanceRecordRow[];
    summary: { total: number; present: number; absent: number; late: number; percentage: number };
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOT_STYLES: Record<Status, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-amber-500",
};

function ParentAttendance() {
  const [children, setChildren] = useState<ChildOption[] | null>(null);
  const [childId, setChildId] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<StudentAttendanceResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!childId) return;
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever child or month changes.
    setLoading(true);
    setData(null);
    apiGet<StudentAttendanceResponse>(`/attendance/student/${childId}?month=${month}&year=${year}`, token)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, month, year]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const selectedChild = children?.find((c) => c._id === childId) || null;
  const recordByDay = new Map<number, Status>();
  (data?.records || []).forEach((r) => recordByDay.set(new Date(r.date).getDate(), r.status));

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Attendance Record</h1>
          <p className="text-sm text-[#64748B] mt-1">Monthly attendance history for your child.</p>
        </div>
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
          <div className="rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] px-4 py-2 text-sm">
            <span className="font-semibold text-[#172554]">{selectedChild.name}</span>
            <span className="text-[#64748B]"> — Class {selectedChild.class}{selectedChild.section ? `-${selectedChild.section}` : ""}</span>
          </div>
        )}
      </div>

      {children === null ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">No children linked to your account yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-[16px] bg-gradient-to-br from-green-500 to-green-600 p-4 text-white">
              <p className="text-xs opacity-90">Present</p>
              <p className="text-2xl font-bold mt-1">{data?.summary.present ?? 0}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-violet-500 to-violet-600 p-4 text-white">
              <p className="text-xs opacity-90">Absent</p>
              <p className="text-2xl font-bold mt-1">{data?.summary.absent ?? 0}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white">
              <p className="text-xs opacity-90">Late</p>
              <p className="text-2xl font-bold mt-1">{data?.summary.late ?? 0}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white">
              <p className="text-xs opacity-90">Attendance</p>
              <p className="text-2xl font-bold mt-1">{data?.summary.percentage ?? 0}%</p>
            </div>
          </div>

          <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] mb-5">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-semibold text-[#172554]">{MONTH_NAMES[month - 1]} {year}</p>
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-[#64748B] py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {WEEKDAYS.map((d) => (
                    <p key={d} className="text-center text-xs font-medium text-[#94A3B8]">{d}</p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {cells.map((day, i) => {
                    const status = day ? recordByDay.get(day) : undefined;
                    return (
                      <div
                        key={i}
                        className={`h-14 rounded-lg flex flex-col items-center justify-center text-sm ${
                          day ? "bg-[#F8FAFC] text-[#172554]" : ""
                        }`}
                      >
                        {day && (
                          <>
                            <span>{day}</span>
                            {status && <span className={`h-1.5 w-1.5 rounded-full mt-1 ${DOT_STYLES[status]}`} />}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B]">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Present</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late</span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F1F5F9]">
              <CalendarCheck className="h-4 w-4 text-[#2563EB]" />
              <p className="text-sm font-semibold text-[#172554]">Daily Records</p>
            </div>
            {!data || data.records.length === 0 ? (
              <p className="text-sm text-[#64748B] px-5 py-6 text-center">No attendance records for this month.</p>
            ) : (
              data.records.map((r) => (
                <div key={r._id} className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9] last:border-0">
                  <p className="text-sm text-[#172554]">
                    {new Date(r.date).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      r.status === "present" ? "bg-green-100 text-green-700" : r.status === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
