"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Trash2, Settings, Plus, Zap, BookOpen, Users, Coffee, CalendarDays, Layers } from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// A validated categorical palette (fixed hue order, chosen so adjacent hues
// stay distinguishable under color-vision deficiency) instead of an ad hoc
// pick of Tailwind pastels -- see the dataviz skill's reference palette.
// Every chip's fill/border/text below is derived from the same one hex via
// color-mix, so a subject's whole chip reads as one coordinated color
// instead of three separately-chosen shades.
const SUBJECT_HUES = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#e87ba4", // magenta
  "#4a3aa7", // violet
  "#008300", // green
  "#e34948", // red
  "#eda100", // yellow
];

function subjectColor(subject: string, all: string[]) {
  const idx = Math.max(0, all.indexOf(subject)) % SUBJECT_HUES.length;
  const hue = SUBJECT_HUES[idx];
  return {
    dot: hue,
    style: {
      backgroundColor: `color-mix(in srgb, ${hue} 10%, white)`,
      borderColor: `color-mix(in srgb, ${hue} 32%, white)`,
      color: `color-mix(in srgb, ${hue} 72%, black)`,
    } as const,
  };
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// "13:20" -> "1:20" -- 12-hour, no leading zero, matches how times are
// entered/edited elsewhere on this page (24-hour) while reading naturally here.
function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hour12 = (h || 0) % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")}`;
}

// Quick Generate's count/duration/break fields use type="text" + this pair
// instead of type="number" -- a native number input's spin arrows change
// the value on a stray scroll/trackpad gesture while filling the form out.
// Digit-only (strips a leading zero too), since these are all whole numbers.
// Pairs with numberFieldValue below: rendering a cleared field's value as
// literal "0" instead of "" is what makes the next keystroke land after it
// ("04" instead of "4") rather than replacing it.
function parseIntInput(raw: string): number {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits === "" ? 0 : Number(digits);
}
function numberFieldValue(n: number): string {
  return n === 0 ? "" : String(n);
}

// Shared by the single-standard and bulk/group Quick Generate flows.
function buildGeneratedPeriods(start: string, count: number, duration: number, breakAfter: number, breakMin: number, standard?: string) {
  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  let cursor = timeToMins(start);
  const list: { label: string; startTime: string; endTime: string; isBreak: boolean; standard?: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const end = cursor + duration;
    list.push({ label: `Period ${i}`, startTime: minsToTime(cursor), endTime: minsToTime(end), isBreak: false, standard });
    cursor = end;
    if (i === breakAfter && i < count) {
      list.push({ label: "Break", startTime: minsToTime(cursor), endTime: minsToTime(cursor + breakMin), isBreak: true, standard });
      cursor += breakMin;
    }
  }
  return list;
}

interface SchoolPeriod {
  _id: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  periodNumber: number | null;
  order: number;
  standard: string | null;
}

// Sentinel for the Manage Periods standard selector -- Select values must be
// non-empty strings, so the school-wide default list (standard: null on the
// wire) needs its own stand-in value.
const DEFAULT_STANDARD = "__default__";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
  classTeacher?: { _id: string; name: string } | null;
}

// Teachers relevant to one specific class (its class teacher + anyone with
// it in assignedClasses) -- returned scoped by /api/timetable/class/[id]
// itself, not the full admin-only staff roster.
interface TeacherOption {
  _id: string;
  name: string;
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
  const [selectedClassId, setSelectedClassId] = useState(""); // admin's class picker
  const [classTeacherOptions, setClassTeacherOptions] = useState<TeacherOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  // A teacher who is a class teacher gets a toggle between their aggregate
  // cross-class teaching schedule (today's only view) and their own class's
  // full, editable timetable.
  const [teacherView, setTeacherView] = useState<"schedule" | "class">("schedule");
  const [teacherSelectedClassId, setTeacherSelectedClassId] = useState("");

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [editCell, setEditCell] = useState<{ day: string; periodNumber: number; entry?: TTEntry } | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
  const [saving, setSaving] = useState(false);
  const [busyTeachers, setBusyTeachers] = useState<Record<string, string>>({});

  // Manage Periods (admin-only) -- "Per Standard" picks one standard (or the
  // school default) to edit directly; "Bulk / Group" applies one freshly
  // generated structure to several standards at once.
  const [periodsMode, setPeriodsMode] = useState<"standard" | "bulk">("standard");
  const [manageStandard, setManageStandard] = useState(DEFAULT_STANDARD);
  const [managePeriods, setManagePeriods] = useState<SchoolPeriod[]>([]);
  const [managePeriodsLoading, setManagePeriodsLoading] = useState(false);
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

  const [bulkStandards, setBulkStandards] = useState<Set<string>>(new Set());
  const [bulkQStart, setBulkQStart] = useState("08:00");
  const [bulkQCount, setBulkQCount] = useState(8);
  const [bulkQDuration, setBulkQDuration] = useState(40);
  const [bulkQBreakAfter, setBulkQBreakAfter] = useState(5);
  const [bulkQBreakMin, setBulkQBreakMin] = useState(10);
  const [bulkGenerating, setBulkGenerating] = useState(false);

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

  // Classes this teacher is the class teacher of -- gates and populates the
  // My Schedule / My Class toggle.
  const myOwnClasses = useMemo(() => {
    if (!isTeacher || !user) return [];
    return classes.filter((c) => c.classTeacher?._id === user.id);
  }, [isTeacher, user, classes]);

  // The one class whose grid is currently shown/editable: admin's picked
  // class, or a teacher's own class while in "My Class" view. Empty for a
  // teacher in "My Schedule" view and for parent/student (they use
  // children/selectedChildId instead).
  const activeClassId = isAdmin ? selectedClassId : isTeacher && teacherView === "class" ? teacherSelectedClassId : "";
  const activeClass = classes.find((c) => c._id === activeClassId) || null;
  const canEditGrid = isAdmin || (isTeacher && teacherView === "class" && !!activeClassId);

  // Only teachers actually relevant to the active class (already scoped
  // server-side by /api/timetable/class/[id]) can be scheduled into its
  // periods.
  const subjectMatchedTeachers = editSubject
    ? classTeacherOptions.filter((t) => t.primarySubject === editSubject || t.secondarySubject === editSubject)
    : classTeacherOptions;
  const usingSubjectFallback = !!editSubject && subjectMatchedTeachers.length === 0 && classTeacherOptions.length > 0;
  const filteredTeachers = usingSubjectFallback ? classTeacherOptions : subjectMatchedTeachers;

  // Which standard's period structure the main grid should render against.
  const effectiveStandard: string | null = isParent
    ? children.find((c) => c._id === selectedChildId)?.class || null
    : activeClass?.name || null;

  const loadPeriods = (standard: string | null) => {
    const token = getToken();
    if (!token) return;
    const url = standard ? `/periods?standard=${encodeURIComponent(standard)}` : "/periods";
    apiGet<{ success: boolean; data: SchoolPeriod[] }>(url, token)
      .then((res) => setPeriods(res.data))
      .catch(() => setPeriods([]))
      .finally(() => setPeriodsLoading(false));
  };

  const loadManagePeriods = (standard: string) => {
    const token = getToken();
    if (!token) return;
    setManagePeriodsLoading(true);
    const url = standard === DEFAULT_STANDARD ? "/periods" : `/periods?standard=${encodeURIComponent(standard)}`;
    apiGet<{ success: boolean; data: SchoolPeriod[] }>(url, token)
      .then((res) => setManagePeriods(res.data))
      .catch(() => setManagePeriods([]))
      .finally(() => setManagePeriodsLoading(false));
  };

  // Refreshes both the Manage Periods tab's own list and the main grid's --
  // cheap to do unconditionally, and avoids tracking whether they happen to
  // be the same standard right now.
  const refreshAfterPeriodChange = () => {
    loadManagePeriods(manageStandard);
    loadPeriods(effectiveStandard);
  };

  useEffect(() => {
    loadPeriods(effectiveStandard);
  }, [effectiveStandard]);

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: refetch whenever the Manage Periods standard selector changes.
    loadManagePeriods(manageStandard);
  }, [isAdmin, manageStandard]);

  useEffect(() => {
    // Admin needs the full class list to pick one; a teacher needs it too,
    // to work out which class(es) they're the class teacher of for "My Class".
    if (!isAdmin && !isTeacher) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token)
      .then((res) => {
        setClasses(res.data);
        if (isAdmin && res.data.length > 0) setSelectedClassId(res.data[0]._id);
      })
      .catch(() => {});
  }, [isAdmin, isTeacher]);

  useEffect(() => {
    if (isTeacher && !teacherSelectedClassId && myOwnClasses.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: default to the teacher's own class once it's known.
      setTeacherSelectedClassId(myOwnClasses[0]._id);
    }
  }, [isTeacher, myOwnClasses, teacherSelectedClassId]);

  useEffect(() => {
    const token = getToken();
    const run = async () => {
      if (!activeClassId || !token) {
        setSubjectOptions([]);
        return;
      }
      const res = await apiGet<{ success: boolean; data: SubjectOption[] }>(`/subjects/class/${activeClassId}`, token);
      setSubjectOptions(res.data);
    };
    run().catch(() => setSubjectOptions([]));
  }, [activeClassId]);

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

  // `showLoader` distinguishes a real navigation (class/child switch, first
  // mount -- show the full loader) from the silent refetch after saving one
  // cell (grid stays on screen; only that cell's data actually changed).
  const loadTimetable = (showLoader = true) => {
    if (showLoader) setLoading(true);
    const token = getToken();
    const run = async () => {
      if (!token || !user) return;
      if (activeClassId) {
        const res = await apiGet<{ success: boolean; data: TTEntry[]; classTeachers?: TeacherOption[] }>(`/timetable/class/${activeClassId}`, token);
        setEntries(res.data);
        setClassTeacherOptions(res.classTeachers || []);
        return;
      }
      if (isTeacher) {
        const res = await apiGet<{ success: boolean; data: TTEntry[] }>(`/timetable/teacher/${user.id}`, token);
        setEntries(res.data);
        setClassTeacherOptions([]);
        return;
      }
      if (isParent) {
        if (!selectedChildId) return;
        const res = await apiGet<{ success: boolean; data: TTEntry[] }>(`/timetable/student/${selectedChildId}`, token);
        setEntries(res.data);
        return;
      }
    };
    run()
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this must flip the full loader back on for a real class/child switch, not just the first mount.
    loadTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isTeacher, isParent, activeClassId, selectedChildId, user?.id]);

  const openEditModal = (day: string, periodNumber: number) => {
    if (!canEditGrid) return;
    const entry = grid[day]?.[periodNumber];
    setEditCell({ day, periodNumber, entry });
    setEditSubject(entry?.subject ?? "");
    setEditTeacherId(entry?.teacherId?._id ?? "");
    // Editing an existing entry only ever touches that one day; a brand new
    // entry starts with every day checked so the editor unchecks the ones
    // that don't apply, instead of an all-or-one toggle.
    setSelectedDays(entry ? [day] : [...DAYS]);

    // The cross-school busy-teacher pre-check stays admin-only -- it reveals
    // every other class's schedule, which a class teacher shouldn't see.
    // The hard conflict guard in POST /api/timetable still applies either way.
    if (!isAdmin) return;
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
    if (!editCell || !editSubject.trim() || !activeClassId || selectedDays.length === 0) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const daysToSave = selectedDays;
      for (const day of daysToSave) {
        await apiPost(
          "/timetable",
          {
            classId: activeClassId,
            teacherId: editTeacherId || undefined,
            day,
            periodNumber: editCell.periodNumber,
            subject: editSubject.trim(),
          },
          token,
        );
      }
      loadTimetable(false);
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
      const standard = manageStandard === DEFAULT_STANDARD ? undefined : manageStandard;
      await apiPost("/periods", { label: newLabel.trim(), startTime: newStart, endTime: newEnd, isBreak: newIsBreak, standard }, token);
      setNewLabel("");
      setNewStart("");
      setNewEnd("");
      setNewIsBreak(false);
      refreshAfterPeriodChange();
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
      refreshAfterPeriodChange();
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
      const standard = manageStandard === DEFAULT_STANDARD ? undefined : manageStandard;
      const toCreate = buildGeneratedPeriods(qStart, qCount, qDuration, qBreakAfter, qBreakMin, standard);
      for (const p of toCreate) await apiPost("/periods", p, token);
      refreshAfterPeriodChange();
      toast.success(`${toCreate.length} periods generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate periods.");
    } finally {
      setGenerating(false);
    }
  };

  // Bulk/group mode: define one structure once, apply it to every selected
  // standard -- a full replace per standard (clears that standard's own
  // existing custom periods first, never the school default list) since the
  // whole point is "this group now uses this one structure."
  const handleBulkGenerate = async () => {
    if (bulkStandards.size === 0) {
      toast.error("Select at least one standard.");
      return;
    }
    if (bulkQCount < 1 || bulkQDuration < 10) {
      toast.error("Please enter valid values.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setBulkGenerating(true);
    try {
      let totalCreated = 0;
      for (const standard of bulkStandards) {
        const existing = await apiGet<{ success: boolean; data: SchoolPeriod[] }>(`/periods?standard=${encodeURIComponent(standard)}`, token);
        const ownPeriods = existing.data.filter((p) => p.standard === standard);
        for (const p of ownPeriods) {
          await fetch(`/api/periods/${p._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        }
        const toCreate = buildGeneratedPeriods(bulkQStart, bulkQCount, bulkQDuration, bulkQBreakAfter, bulkQBreakMin, standard);
        for (const p of toCreate) await apiPost("/periods", p, token);
        totalCreated += toCreate.length;
      }
      refreshAfterPeriodChange();
      toast.success(`Applied to ${bulkStandards.size} standard${bulkStandards.size === 1 ? "" : "s"} (${totalCreated} periods total).`);
      setBulkStandards(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate periods.");
    } finally {
      setBulkGenerating(false);
    }
  };

  const allStandardNames = [...new Set(classes.map((c) => c.name))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const headerRow = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <PageHeader
        icon={Clock}
        title="Timetable"
        subtitle={
          isAdmin
            ? "View and manage class schedules"
            : isTeacher
              ? teacherView === "class"
                ? `Class ${activeClass?.name ?? ""}${activeClass?.section ? `-${activeClass.section}` : ""} timetable`
                : "Your weekly teaching schedule"
              : "Your child's class schedule"
        }
        accent="violet"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && (
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
        )}
        {isTeacher && myOwnClasses.length > 0 && (
          <>
            <div className="inline-flex rounded-full border border-border p-0.5 bg-muted/40 shrink-0">
              <button
                type="button"
                onClick={() => setTeacherView("schedule")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  teacherView === "schedule" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Schedule
              </button>
              <button
                type="button"
                onClick={() => setTeacherView("class")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  teacherView === "class" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Class
              </button>
            </div>
            {teacherView === "class" && myOwnClasses.length > 1 && (
              <Select
                items={myOwnClasses.map((c) => ({ value: c._id, label: `${c.name}-${c.section}` }))}
                value={teacherSelectedClassId}
                onValueChange={(v) => setTeacherSelectedClassId(v || "")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {myOwnClasses.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}-{c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        {isParent && children.length > 1 && (
          <Select
            items={children.map((c) => ({ value: c._id, label: c.name }))}
            value={selectedChildId}
            onValueChange={(v) => setSelectedChildId(v || "")}
          >
            <SelectTrigger className="w-auto min-w-[180px] max-w-full">
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
  );

  const gridSection = (
    <>
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatFilterCard icon={BookOpen} color="#8B5CF6" colorDark="#7C3AED" value={uniqueSubjects.length} label="Subjects" />
          <StatFilterCard icon={Users} color="#0EA5E9" colorDark="#0284C7" value={new Set(entries.map((e) => e.teacherId?._id).filter(Boolean)).size} label="Teachers" />
          <StatFilterCard icon={Clock} color="#F59E0B" colorDark="#D97706" value={periods.filter((p) => !p.isBreak).length} label="Periods" />
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-b from-muted/90 to-muted/40">
                <th className="sticky left-0 z-10 bg-muted/90 p-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[150px] border-b-2 border-border">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Time
                  </div>
                </th>
                {DAYS.map((day) => {
                  const isToday = day === today;
                  return (
                    <th
                      key={day}
                      className={`p-3.5 text-center text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                        isToday ? "text-primary border-primary bg-primary/10" : "text-muted-foreground border-border"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{day.slice(0, 3)}</span>
                        {isToday && (
                          <span className="flex items-center gap-1 text-[9px] font-bold normal-case tracking-normal text-primary">
                            <CalendarDays className="h-2.5 w-2.5" /> Today
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {periodsLoading || loading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <PageLoader label="Loading timetable..." />
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isAdmin ? 'No periods configured. Use the "Manage Periods" tab to add periods.' : "No periods configured yet."}
                  </td>
                </tr>
              ) : (isAdmin && !selectedClassId) || (isParent && !selectedChildId) || (isTeacher && teacherView === "class" && !teacherSelectedClassId) ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isParent ? "No child linked to your account yet." : "Select a class to view its timetable."}
                  </td>
                </tr>
              ) : (
                periods.map((period, periodIdx) => {
                  const rowBg = period.isBreak ? "bg-amber-50/50" : periodIdx % 2 === 1 ? "bg-muted/[0.15] hover:bg-muted/40" : "hover:bg-muted/40";
                  return (
                    <tr key={period._id} className={`${rowBg} transition-colors group`}>
                      <td
                        className={`sticky left-0 z-10 p-3 border-b border-border ${
                          period.isBreak ? "bg-amber-50/50" : periodIdx % 2 === 1 ? "bg-muted/[0.15] group-hover:bg-muted/40" : "bg-card group-hover:bg-muted/40"
                        } transition-colors`}
                      >
                        <div className="flex items-center gap-2.5">
                          {period.isBreak ? (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                              <Coffee className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                                period.periodNumber === currentPeriod ? "bg-primary text-white shadow-sm shadow-primary/40" : "bg-primary/10 text-primary"
                              }`}
                            >
                              {period.periodNumber}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{period.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatTime(period.startTime)} – {formatTime(period.endTime)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {period.isBreak ? (
                        <td colSpan={DAYS.length} className="p-2 border-b border-border">
                          <div className="flex items-center justify-center gap-2 py-1 text-amber-700">
                            <Coffee className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">{period.label} · every day</span>
                          </div>
                        </td>
                      ) : (
                        DAYS.map((day) => {
                          const pNum = period.periodNumber!;
                          const entry = grid[day]?.[pNum];
                          const isToday = day === today;
                          const isCurrent = isToday && pNum === currentPeriod;
                          const subj = entry ? subjectColor(entry.subject, uniqueSubjects) : null;
                          return (
                            <td key={day} className={`p-2 border-b border-border ${isToday ? "bg-primary/[0.06]" : ""}`}>
                              {entry && subj ? (
                                <div
                                  onClick={() => openEditModal(day, pNum)}
                                  style={subj.style}
                                  className={`relative rounded-xl border text-center transition-all overflow-hidden ${
                                    canEditGrid ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : "cursor-default shadow-sm"
                                  } ${isCurrent ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""}`}
                                >
                                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: subj.dot }} />
                                  <div className="p-2.5 pt-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <BookOpen className="h-3 w-3 shrink-0 opacity-70" style={{ color: subj.dot }} />
                                      <p className="text-xs font-bold leading-tight">{entry.subject}</p>
                                    </div>
                                    {entry.teacherId?.name && (
                                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                        <span
                                          style={{ backgroundColor: subj.style.color }}
                                          className="flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] font-bold text-white shrink-0 shadow-sm"
                                        >
                                          {initials(entry.teacherId.name)}
                                        </span>
                                        <p className="text-[10.5px] font-medium opacity-80 truncate">{entry.teacherId.name}</p>
                                      </div>
                                    )}
                                    {((isTeacher && teacherView === "schedule") || isParent) && entry.classId && (
                                      <p className="text-[10px] opacity-60 mt-0.5">
                                        {entry.classId.name}
                                        {entry.classId.section ? `-${entry.classId.section}` : ""}
                                      </p>
                                    )}
                                    {isCurrent && (
                                      <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                        <span className="h-1 w-1 rounded-full bg-white animate-pulse" /> NOW
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => openEditModal(day, pNum)}
                                  className={`group/cell h-full min-h-[56px] flex items-center justify-center rounded-xl border border-dashed transition-colors ${
                                    canEditGrid ? "cursor-pointer border-border hover:border-primary/50 hover:bg-primary/[0.04]" : "border-border/30"
                                  }`}
                                >
                                  {canEditGrid ? (
                                    <Plus className="h-4 w-4 text-muted-foreground/40 group-hover/cell:text-primary/70 group-hover/cell:scale-110 transition-all" />
                                  ) : (
                                    <span className="text-muted-foreground/30 text-xs">—</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const managePeriodsSection = (
    <>
      <div className="inline-flex rounded-full border border-border p-0.5 bg-muted/40">
        <button
          type="button"
          onClick={() => setPeriodsMode("standard")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            periodsMode === "standard" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-3.5 w-3.5" /> Per Standard
        </button>
        <button
          type="button"
          onClick={() => setPeriodsMode("bulk")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            periodsMode === "bulk" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Bulk / Group
        </button>
      </div>

      {periodsMode === "standard" ? (
        <div className="card-premium p-5 space-y-5 max-w-xl">
          <div className="space-y-1.5">
            <Label>Standard</Label>
            <Select
              items={[
                { value: DEFAULT_STANDARD, label: "School Default" },
                ...allStandardNames.map((name) => ({ value: name, label: `Class ${name}` })),
              ]}
              value={manageStandard}
              onValueChange={(v) => v && setManageStandard(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_STANDARD}>School Default</SelectItem>
                {allStandardNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    Class {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {manageStandard !== DEFAULT_STANDARD && managePeriods.length > 0 && managePeriods[0].standard === null && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Using the school&apos;s default periods — add or edit one below to start customizing Class {manageStandard}.
              </p>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {managePeriodsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
            ) : managePeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No periods yet. Add your first period below.</p>
            ) : (
              managePeriods.map((p) => (
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
                        {formatTime(p.startTime)} – {formatTime(p.endTime)}
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
                <Input type="text" inputMode="numeric" value={numberFieldValue(qCount)} onChange={(e) => setQCount(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Period Duration (min)</Label>
                <Input type="text" inputMode="numeric" value={numberFieldValue(qDuration)} onChange={(e) => setQDuration(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Break After Period</Label>
                <Input type="text" inputMode="numeric" placeholder="0" value={numberFieldValue(qBreakAfter)} onChange={(e) => setQBreakAfter(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Break Duration (min)</Label>
                <Input type="text" inputMode="numeric" value={numberFieldValue(qBreakMin)} onChange={(e) => setQBreakMin(parseIntInput(e.target.value))} disabled={qBreakAfter === 0} />
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
        </div>
      ) : (
        <div className="card-premium p-5 space-y-5 max-w-2xl">
          <p className="text-xs text-muted-foreground">
            Define one period structure and apply it to several standards at once — e.g. one structure for all of Pre-Primary, or for Primary
            1 through 5. This replaces each selected standard&apos;s own custom periods (never the school default list).
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Standards</Label>
              <span className="text-xs text-muted-foreground">{bulkStandards.size} selected</span>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
              {allStandardNames.map((name) => (
                <label key={name} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${bulkStandards.has(name) ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={bulkStandards.has(name)}
                    onChange={(e) => {
                      setBulkStandards((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(name);
                        else next.delete(name);
                        return next;
                      });
                    }}
                  />
                  <p className="text-sm font-medium text-foreground">Class {name}</p>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Structure for this group</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Period Starts</Label>
                <Input type="time" value={bulkQStart} onChange={(e) => setBulkQStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Number of Periods</Label>
                <Input type="text" inputMode="numeric" value={numberFieldValue(bulkQCount)} onChange={(e) => setBulkQCount(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Period Duration (min)</Label>
                <Input type="text" inputMode="numeric" value={numberFieldValue(bulkQDuration)} onChange={(e) => setBulkQDuration(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Break After Period</Label>
                <Input type="text" inputMode="numeric" placeholder="0" value={numberFieldValue(bulkQBreakAfter)} onChange={(e) => setBulkQBreakAfter(parseIntInput(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Break Duration (min)</Label>
                <Input type="text" inputMode="numeric" value={numberFieldValue(bulkQBreakMin)} onChange={(e) => setBulkQBreakMin(parseIntInput(e.target.value))} disabled={bulkQBreakAfter === 0} />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={handleBulkGenerate} disabled={bulkGenerating || bulkStandards.size === 0 || bulkQCount < 1}>
              <Zap className="h-4 w-4" />
              {bulkGenerating ? "Applying…" : `Apply to ${bulkStandards.size || 0} standard${bulkStandards.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <Tabs defaultValue="timetable" className="space-y-6">
          <TabsList>
            <TabsTrigger value="timetable" className="gap-1.5">
              <Clock className="h-4 w-4" /> Timetable
            </TabsTrigger>
            <TabsTrigger value="manage-periods" className="gap-1.5">
              <Settings className="h-4 w-4" /> Manage Periods
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timetable" className="space-y-6">
            {headerRow}
            {gridSection}
          </TabsContent>
          <TabsContent value="manage-periods" className="space-y-4">
            {managePeriodsSection}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {headerRow}
          {gridSection}
        </>
      )}

      {(isAdmin || myOwnClasses.length > 0) && (
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
                    <SelectTrigger className="w-full">
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
                  <SelectTrigger className="w-full">
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
                      const isClassTeacher = activeClass?.classTeacher?._id === t._id;
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
            {editSubject && (
              <div className="space-y-1.5 px-1">
                <Label className="text-sm font-normal">Apply to these days</Label>
                <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                  {DAYS.map((day) => {
                    const checked = selectedDays.includes(day);
                    return (
                      <label key={day} htmlFor={`day-${day}`} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          id={`day-${day}`}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedDays((prev) => (e.target.checked ? [...prev, day] : prev.filter((d) => d !== day)))
                          }
                          className="h-4 w-4"
                        />
                        {day.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
                {selectedDays.length === 0 && <p className="text-xs text-destructive">Select at least one day.</p>}
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
                <Button onClick={handleSave} disabled={saving || !editSubject.trim() || selectedDays.length === 0}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
