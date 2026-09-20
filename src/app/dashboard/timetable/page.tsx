"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Trash2, Settings, Plus, Zap, BookOpen, Users, CalendarClock } from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SUBJECT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
];

function subjectColor(subject: string, all: string[]) {
  const idx = Math.max(0, all.indexOf(subject)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[idx];
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface SchoolPeriod {
  _id: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  periodNumber: number | null;
  order: number;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
  classTeacher?: { _id: string; name: string } | null;
}

interface TeacherOption {
  _id: string;
  name: string;
  assignedClasses?: { _id: string }[];
  primarySubject?: string;
  secondarySubject?: string;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface TTEntry {
  _id: string;
  classId: { _id: string; name: string; section: string } | null;
  teacherId: { _id: string; name: string } | null;
  day: string;
  periodNumber: number;
  subject: string;
}

interface Child {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

function currentPeriodFrom(periods: SchoolPeriod[]): number | null {
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  for (const p of periods) {
    if (!p.isBreak && p.periodNumber !== null) {
      const s = timeToMins(p.startTime);
      const e = timeToMins(p.endTime);
      if (now >= s && now < e) return p.periodNumber;
    }
  }
  return null;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "schooladmin";
  const isTeacher = user?.role === "teacher";
  const isParent = user?.role === "parent";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [entries, setEntries] = useState<TTEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [editCell, setEditCell] = useState<{ day: string; periodNumber: number; entry?: TTEntry } | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [repeatAllDays, setRepeatAllDays] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTeachers, setBusyTeachers] = useState<Record<string, string>>({});

  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newIsBreak, setNewIsBreak] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);

  const [qCount, setQCount] = useState(8);
  const [qDuration, setQDuration] = useState(40);
  const [qBreakAfter, setQBreakAfter] = useState(5);
  const [qBreakMin, setQBreakMin] = useState(10);
  const [qStart, setQStart] = useState("08:00");
  const [generating, setGenerating] = useState(false);

  const currentPeriod = useMemo(() => currentPeriodFrom(periods), [periods]);

  const grid = useMemo<Record<string, Record<number, TTEntry>>>(() => {
    const g: Record<string, Record<number, TTEntry>> = {};
    entries.forEach((e) => {
      if (!g[e.day]) g[e.day] = {};
      g[e.day][e.periodNumber] = e;
    });
    return g;
  }, [entries]);

  const uniqueSubjects = useMemo(() => [...new Set(entries.map((e) => e.subject))].sort(), [entries]);

  // Only teachers actually assigned to the selected class — either via
  // Teacher.assignedClasses or by being that class's own class teacher —
  // can be scheduled into its periods. Matches the original SMS app's
  // Timetable page filter (it does the same client-side, keyed off
  // assignedClasses); a class's classTeacher is included too so the class's
  // own teacher isn't excluded just for lacking a separate assignedClasses entry.
  const selectedClass = classes.find((c) => c._id === selectedClassId) || null;
  const classTeachers = useMemo(() => {
    if (!selectedClass) return teachers;
    return teachers.filter(
      (t) =>
        t.assignedClasses?.some((c) => c._id === selectedClass._id) ||
        selectedClass.classTeacher?._id === t._id,
    );
  }, [teachers, selectedClass]);

  // Once a period's subject is picked, narrow further to teachers whose
  // primary or secondary subject actually matches it — if that leaves
  // nobody (no assigned teacher has declared this subject), fall back to
  // the full class-assigned list rather than leaving the admin stuck with
  // only "— None —".
  const subjectMatchedTeachers = editSubject
    ? classTeachers.filter((t) => t.primarySubject === editSubject || t.secondarySubject === editSubject)
    : classTeachers;
  const usingSubjectFallback = !!editSubject && subjectMatchedTeachers.length === 0 && classTeachers.length > 0;
  const filteredTeachers = usingSubjectFallback ? classTeachers : subjectMatchedTeachers;

  const loadPeriods = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: SchoolPeriod[] }>("/periods", token)
      .then((res) => setPeriods(res.data))
      .catch(() => setPeriods([]))
      .finally(() => setPeriodsLoading(false));
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token)
      .then((res) => {
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClassId(res.data[0]._id);
      })
      .catch(() => {});
    apiGet<{ success: boolean; data: TeacherOption[] }>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const token = getToken();
    const run = async () => {
      if (!selectedClassId || !token) {
        setSubjectOptions([]);
        return;
      }
      const res = await apiGet<{ success: boolean; data: SubjectOption[] }>(`/subjects/class/${selectedClassId}`, token);
      setSubjectOptions(res.data);
    };
    run().catch(() => setSubjectOptions([]));
  }, [selectedClassId]);

  useEffect(() => {
    if (!isParent) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { children: Child[] } }>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChildId(res.data.children[0]._id);
      })
      .catch(() => {});
  }, [isParent]);

  const loadTimetable = () => {
    const token = getToken();
    const run = async () => {
      if (!token || !user) return;
      let url = "";
      if (isAdmin) {
        if (!selectedClassId) return;
        url = `/timetable/class/${selectedClassId}`;
      } else if (isTeacher) {
        url = `/timetable/teacher/${user.id}`;
      } else if (isParent) {
        if (!selectedChildId) return;
        url = `/timetable/student/${selectedChildId}`;
      } else {
        return;
      }
      const res = await apiGet<{ success: boolean; data: TTEntry[] }>(url, token);
      setEntries(res.data);
    };
    run()
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isTeacher, isParent, selectedClassId, selectedChildId, user?.id]);

  const openEditModal = (day: string, periodNumber: number) => {
    if (!isAdmin) return;
    const entry = grid[day]?.[periodNumber];
    setEditCell({ day, periodNumber, entry });
    setEditSubject(entry?.subject ?? "");
    setEditTeacherId(entry?.teacherId?._id ?? "");
    setRepeatAllDays(!entry);

    const token = getToken();
    if (!token) return;
    setBusyTeachers({});
    apiGet<{ success: boolean; data: TTEntry[] }>("/timetable/all", token)
      .then((res) => {
        const busy: Record<string, string> = {};
        res.data.forEach((e) => {
          if (e.day === day && e.periodNumber === periodNumber && e.teacherId) {
            const className = e.classId ? `${e.classId.name}-${e.classId.section}` : "another class";
            busy[e.teacherId._id] = className;
          }
        });
        setBusyTeachers(busy);
      })
      .catch(() => {});
  };

  const handleSave = async () => {
    if (!editCell || !editSubject.trim() || !selectedClassId) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const daysToSave = repeatAllDays ? DAYS : [editCell.day];
      for (const day of daysToSave) {
        await apiPost(
          "/timetable",
          {
            classId: selectedClassId,
            teacherId: editTeacherId || undefined,
            day,
            periodNumber: editCell.periodNumber,
            subject: editSubject.trim(),
          },
          token,
        );
      }
      loadTimetable();
      setEditCell(null);
      toast.success(daysToSave.length > 1 ? `Assigned to ${daysToSave.length} days.` : "Timetable saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editCell?.entry) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/timetable/${editCell.entry._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to delete.");
      setEntries((prev) => prev.filter((e) => e._id !== editCell.entry!._id));
      setEditCell(null);
      toast.success("Entry removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPeriod = async () => {
    if (!newLabel.trim() || !newStart || !newEnd) {
      toast.error("Label, start time and end time are required.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setAddingPeriod(true);
    try {
      await apiPost("/periods", { label: newLabel.trim(), startTime: newStart, endTime: newEnd, isBreak: newIsBreak }, token);
      setNewLabel("");
      setNewStart("");
      setNewEnd("");
      setNewIsBreak(false);
      loadPeriods();
      toast.success("Period added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add period.");
    } finally {
      setAddingPeriod(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/periods/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to remove.");
      loadPeriods();
      toast.success("Period removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove period.");
    }
  };

  const handleQuickGenerate = async () => {
    if (qCount < 1 || qDuration < 10) {
      toast.error("Please enter valid values.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setGenerating(true);
    try {
      const minsToTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };
      let cursor = timeToMins(qStart);
      const toCreate: { label: string; startTime: string; endTime: string; isBreak: boolean }[] = [];
      for (let i = 1; i <= qCount; i++) {
        const end = cursor + qDuration;
        toCreate.push({ label: `Period ${i}`, startTime: minsToTime(cursor), endTime: minsToTime(end), isBreak: false });
        cursor = end;
        if (i === qBreakAfter && i < qCount) {
          toCreate.push({ label: "Break", startTime: minsToTime(cursor), endTime: minsToTime(cursor + qBreakMin), isBreak: true });
          cursor += qBreakMin;
        }
      }
      for (const p of toCreate) await apiPost("/periods", p, token);
      loadPeriods();
      toast.success(`${toCreate.length} periods generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate periods.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          icon={Clock}
          title="Timetable"
          subtitle={isAdmin ? "View and manage class schedules" : isTeacher ? "Your weekly teaching schedule" : "Your child's class schedule"}
          accent="violet"
        />
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Select
                items={classes.map((c) => ({ value: c._id, label: `${c.name}${c.section ? `-${c.section}` : ""}` }))}
                value={selectedClassId}
                onValueChange={(v) => setSelectedClassId(v || "")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                      {c.section ? `-${c.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
                <Settings className="h-4 w-4" /> Manage Periods
              </Button>
            </>
          )}
          {isParent && children.length > 1 && (
            <Select
              items={children.map((c) => ({ value: c._id, label: c.name }))}
              value={selectedChildId}
              onValueChange={(v) => setSelectedChildId(v || "")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatFilterCard icon={CalendarClock} color="#4F46E5" colorDark="#4338CA" value={entries.length} label="Total Periods" />
          <StatFilterCard icon={BookOpen} color="#8B5CF6" colorDark="#7C3AED" value={uniqueSubjects.length} label="Subjects" />
          <StatFilterCard icon={Users} color="#0EA5E9" colorDark="#0284C7" value={new Set(entries.map((e) => e.teacherId?._id).filter(Boolean)).size} label="Teachers" />
          <StatFilterCard icon={Clock} color="#F59E0B" colorDark="#D97706" value={periods.length} label="Period Rows" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px] border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Time
                  </div>
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className={`p-3 text-center text-xs font-semibold uppercase tracking-wider border-b border-border ${
                      day === today ? "text-primary bg-primary/5" : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodsLoading || loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    Loading timetable…
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isAdmin ? 'No periods configured. Click "Manage Periods" to add periods.' : "No periods configured yet."}
                  </td>
                </tr>
              ) : (isAdmin && !selectedClassId) || (isParent && !selectedChildId) ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isParent ? "No child linked to your account yet." : "Select a class to view its timetable."}
                  </td>
                </tr>
              ) : (
                periods.map((period) => (
                  <tr key={period._id} className={period.isBreak ? "bg-muted/50" : "hover:bg-muted/50 transition-colors"}>
                    <td className="p-3 border-b border-border">
                      <div className="text-xs font-semibold text-foreground">{period.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {period.startTime} – {period.endTime}
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      if (period.isBreak) {
                        return (
                          <td key={day} className="p-2 border-b border-border text-center">
                            <span className="text-xs text-muted-foreground italic">{period.label}</span>
                          </td>
                        );
                      }
                      const pNum = period.periodNumber!;
                      const entry = grid[day]?.[pNum];
                      const isToday = day === today;
                      const isCurrent = isToday && pNum === currentPeriod;
                      return (
                        <td key={day} className={`p-1.5 border-b border-border ${isToday ? "bg-primary/[0.02]" : ""}`}>
                          {entry ? (
                            <div
                              onClick={() => openEditModal(day, pNum)}
                              className={`rounded-xl p-2.5 border text-center transition-all ${
                                isAdmin ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
                              } ${subjectColor(entry.subject, uniqueSubjects)} ${
                                isCurrent ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""
                              }`}
                            >
                              <p className="text-xs font-semibold leading-tight">{entry.subject}</p>
                              {entry.teacherId && <p className="text-[10px] opacity-70 mt-0.5">{entry.teacherId.name}</p>}
                              {(isTeacher || isParent) && entry.classId && (
                                <p className="text-[10px] opacity-60 mt-0.5">
                                  {entry.classId.name}
                                  {entry.classId.section ? `-${entry.classId.section}` : ""}
                                </p>
                              )}
                              {isCurrent && <span className="mt-1 inline-block text-[9px] font-bold bg-primary text-white px-1.5 py-0 rounded">NOW</span>}
                            </div>
                          ) : (
                            <div
                              onClick={() => openEditModal(day, pNum)}
                              className={`h-full min-h-[48px] flex items-center justify-center rounded-xl transition-colors ${
                                isAdmin ? "cursor-pointer hover:bg-primary/5" : ""
                              }`}
                            >
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <Dialog open={!!editCell} onOpenChange={(open) => !open && setEditCell(null)}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {editCell?.entry ? "Edit Entry" : "Add Entry"} — {editCell?.day} · Period {editCell?.periodNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>
                  Subject <span className="text-red-500">*</span>
                </Label>
                {subjectOptions.length > 0 ? (
                  <Select value={editSubject} onValueChange={(v) => setEditSubject(v || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s._id} value={s.name}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="e.g. Mathematics" maxLength={60} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Teacher (optional)</Label>
                <Select
                  items={[{ value: "__none__", label: "— None —" }, ...filteredTeachers.map((t) => ({ value: t._id, label: t.name }))]}
                  value={editTeacherId || "__none__"}
                  onValueChange={(v) => setEditTeacherId(!v || v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {filteredTeachers.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground/70">No teacher assigned to this class.</p>
                    )}
                    {filteredTeachers.map((t) => {
                      const busyClass = busyTeachers[t._id];
                      const isBusy = !!busyClass;
                      const isCurrentTeacher = editCell?.entry?.teacherId?._id === t._id;
                      const isClassTeacher = selectedClass?.classTeacher?._id === t._id;
                      return (
                        <SelectItem key={t._id} value={t._id} disabled={isBusy && !isCurrentTeacher}>
                          {t.name}
                          {isBusy && !isCurrentTeacher ? ` — Busy (${busyClass})` : isClassTeacher ? " — Class Teacher" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {usingSubjectFallback && (
                  <p className="text-xs text-muted-foreground/70">No assigned teacher has {editSubject} as a subject — showing everyone assigned to this class.</p>
                )}
              </div>
            </div>
            {editSubject && !editCell?.entry && (
              <div className="flex items-center gap-2 px-1">
                <input
                  id="repeat-days"
                  type="checkbox"
                  checked={repeatAllDays}
                  onChange={(e) => setRepeatAllDays(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="repeat-days" className="text-sm font-normal cursor-pointer">
                  Repeat on all weekdays (Mon–Sat)
                </Label>
              </div>
            )}
            <DialogFooter className="flex gap-2 sm:justify-between mt-2">
              {editCell?.entry && (
                <Button variant="destructive" size="sm" onClick={handleDeleteEntry} disabled={saving} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setEditCell(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !editSubject.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && (
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Periods</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No periods yet. Add your first period below.</p>
              ) : (
                periods.map((p) => (
                  <div
                    key={p._id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                      p.isBreak ? "bg-muted/50 border-border" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-muted-foreground w-5 shrink-0 font-mono text-center">{p.isBreak ? "—" : p.periodNumber}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.startTime} – {p.endTime}
                          {p.isBreak && <span className="ml-2 text-amber-600 italic">break</span>}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 shrink-0" onClick={() => handleDeletePeriod(p._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Quick Generate</p>
              </div>
              <p className="text-xs text-muted-foreground">Auto-create all periods with correct timings in one click.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Period Starts</Label>
                  <Input type="time" value={qStart} onChange={(e) => setQStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Number of Periods</Label>
                  <Input type="number" min={1} max={20} value={qCount} onChange={(e) => setQCount(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Period Duration (min)</Label>
                  <Input type="number" min={10} max={120} value={qDuration} onChange={(e) => setQDuration(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Break After Period</Label>
                  <Input type="number" min={0} max={qCount} value={qBreakAfter} onChange={(e) => setQBreakAfter(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Break Duration (min)</Label>
                  <Input type="number" min={0} max={60} value={qBreakMin} onChange={(e) => setQBreakMin(+e.target.value)} disabled={qBreakAfter === 0} />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={handleQuickGenerate} disabled={generating || qCount < 1}>
                <Zap className="h-4 w-4" />
                {generating ? "Generating…" : "Generate Periods"}
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Add Manually</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-label">Label</Label>
                  <Input id="p-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Period 8, Lunch, Assembly" maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-start">Start Time</Label>
                  <Input id="p-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-end">End Time</Label>
                  <Input id="p-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="p-isbreak" type="checkbox" checked={newIsBreak} onChange={(e) => setNewIsBreak(e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="p-isbreak" className="cursor-pointer text-sm font-normal">
                  This is a break / lunch (not editable in timetable)
                </Label>
              </div>
              <Button className="w-full gap-2" onClick={handleAddPeriod} disabled={addingPeriod || !newLabel.trim() || !newStart || !newEnd}>
                <Plus className="h-4 w-4" />
                {addingPeriod ? "Adding…" : "Add Period"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
