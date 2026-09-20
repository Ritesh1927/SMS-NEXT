"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, Loader2 } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Status = "present" | "absent" | "late";

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

// Shared month-calendar + summary cards + daily-records view for one
// student's attendance history. Used by the parent's own Attendance page
// and by the admin/teacher "Student Lookup" tab -- same data shape either
// way (GET /api/attendance/student/[id]), just a different caller.
export function StudentAttendanceCalendar({ studentId }: { studentId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<StudentAttendanceResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever student or month changes.
    setLoading(true);
    setData(null);
    apiGet<StudentAttendanceResponse>(`/attendance/student/${studentId}?month=${month}&year=${year}`, token)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId, month, year]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const recordByDay = new Map<number, Status>();
  (data?.records || []).forEach((r) => recordByDay.set(new Date(r.date).getDate(), r.status));

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
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

      <div className="rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] mb-5">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[month - 1]} {year}</p>
          <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map((d) => (
                <p key={d} className="text-center text-xs font-medium text-muted-foreground/70">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((day, i) => {
                const status = day ? recordByDay.get(day) : undefined;
                return (
                  <div
                    key={i}
                    className={`h-14 rounded-lg flex flex-col items-center justify-center text-sm ${day ? "bg-muted/50 text-foreground" : ""}`}
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
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late</span>
            </div>
          </>
        )}
      </div>

      <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Daily Records</p>
        </div>
        {!data || data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-6 text-center">No attendance records for this month.</p>
        ) : (
          data.records.map((r) => (
            <div key={r._id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
              <p className="text-sm text-foreground">
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
    </div>
  );
}
