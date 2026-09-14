"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X, Clock, Save } from "lucide-react";
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
    if (classId) loadRoster();
  }, [classId, date, loadRoster]);

  const setStatus = (studentId: string, status: Status) => {
    setRoster((r) => r && r.map((entry) => (entry.student._id === studentId ? { ...entry, status } : entry)));
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
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Attendance
          </Button>
        )}
      </div>

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
