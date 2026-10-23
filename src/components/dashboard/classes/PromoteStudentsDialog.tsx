"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, GraduationCap, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";

interface PreviewResponse {
  success: boolean;
  data: {
    fromClass: string;
    fromSection: string;
    suggestion: { type: "promote"; class: string; section: string; needsSectionChoice: boolean } | { type: "graduate" };
    students: { id: string; name: string; rollNumber: string }[];
  };
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface Row {
  studentId: string;
  name: string;
  rollNumber: string;
  included: boolean;
  toClass: string;
  toSection: string;
}

export function PromoteStudentsDialog({
  classId,
  fromLabel,
  token,
  open,
  onOpenChange,
  onDone,
}: {
  classId: string;
  fromLabel: string;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isGraduating, setIsGraduating] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [batchClass, setBatchClass] = useState("");
  const [batchSection, setBatchSection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Every real Class document -- the only source of truth for which
  // class/section pairs a student can actually be promoted into. Picking a
  // class/section that doesn't exist here would silently create students
  // with no real classroom behind them, so both pickers are constrained to
  // this list rather than free text.
  const [allClasses, setAllClasses] = useState<ClassOption[] | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: showing the loading state for the preview fetch this dialog open kicks off.
    setLoading(true);
    Promise.all([
      apiGet<PreviewResponse>(`/classes/${classId}/promotion-preview`, token),
      apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token),
    ])
      .then(([previewRes, classesRes]) => {
        const { suggestion, students } = previewRes.data;
        const graduate = suggestion.type === "graduate";
        setIsGraduating(graduate);
        setAllClasses(classesRes.data);
        // The suggestion's section is only a guess -- fall back to the
        // target class's one real section if there's exactly one, or leave
        // it for the admin to pick if there's several (or none yet).
        const realSections = graduate ? [] : classesRes.data.filter((c) => c.name === suggestion.class).map((c) => c.section);
        const validSuggestedSection = !graduate && realSections.includes(suggestion.section)
          ? suggestion.section
          : realSections.length === 1
            ? realSections[0]
            : "";
        setRows(
          students.map((s) => ({
            studentId: s.id,
            name: s.name,
            rollNumber: s.rollNumber,
            included: true,
            toClass: graduate ? "" : suggestion.class,
            toSection: graduate ? "" : validSuggestedSection,
          })),
        );
        if (!graduate) {
          setBatchClass(suggestion.class);
          setBatchSection(validSuggestedSection);
        }
      })
      .catch((err) => toast.error("Failed to load class roster.", { description: err instanceof Error ? err.message : undefined }))
      .finally(() => setLoading(false));
  }, [open, classId, token]);

  const classNames = Array.from(new Set((allClasses || []).map((c) => c.name))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  const sectionsForClass = (className: string) =>
    (allClasses || []).filter((c) => c.name === className).map((c) => c.section).sort();

  const applyToAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, toClass: batchClass, toSection: batchSection })));
  };

  const updateRow = (studentId: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r)));
  };

  // Changing a row's target class resets its section -- the old section
  // almost certainly doesn't belong to the new class.
  const setRowClass = (studentId: string, toClass: string) => {
    const sections = sectionsForClass(toClass);
    updateRow(studentId, { toClass, toSection: sections.length === 1 ? sections[0] : "" });
  };
  const setBatchClassValue = (cls: string) => {
    setBatchClass(cls);
    const sections = sectionsForClass(cls);
    setBatchSection(sections.length === 1 ? sections[0] : "");
  };

  const submit = async () => {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) {
      toast.error("No students selected.");
      return;
    }
    if (!isGraduating) {
      if (included.some((r) => !r.toClass.trim() || !r.toSection.trim())) {
        toast.error("Every promoted student needs a target class and section.");
        return;
      }
      const invalid = included.find((r) => !sectionsForClass(r.toClass).includes(r.toSection));
      if (invalid) {
        const missing = sectionsForClass(invalid.toClass).length === 0;
        toast.error(
          missing ? `Class ${invalid.toClass} hasn't been created yet.` : `Class ${invalid.toClass} has no section ${invalid.toSection}.`,
          { description: missing ? "Add it from the Classes page first." : "Pick one of its real sections instead." },
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      const students = rows.map((r) =>
        !r.included
          ? { studentId: r.studentId, action: "exclude" as const }
          : isGraduating
            ? { studentId: r.studentId, action: "graduate" as const }
            : { studentId: r.studentId, action: "promote" as const, toClass: r.toClass.trim(), toSection: r.toSection.trim() },
      );
      const res = await apiPost<{ success: boolean; message: string }>(`/classes/${classId}/promote`, { students }, token);
      toast.success(res.message || "Students promoted.");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error("Could not promote students.", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const batchSections = sectionsForClass(batchClass);
  const batchClassMissing = !!batchClass && batchSections.length === 0;
  const anyIncludedRowInvalid =
    !isGraduating && rows.some((r) => r.included && (!r.toClass || !r.toSection || !sectionsForClass(r.toClass).includes(r.toSection)));

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Promote {fromLabel}
          </DialogTitle>
          <DialogDescription>
            {isGraduating
              ? "Every student below will graduate and be marked inactive. Uncheck anyone who shouldn't."
              : "Review and adjust each student's next class before confirming. Nothing is applied until you confirm."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No active students in this class.</p>
        ) : (
          <div className="space-y-3">
            {!isGraduating && (
              <div className="rounded-lg border border-border px-3 py-2.5 space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Apply to all: class</Label>
                    <Select value={batchClass} onValueChange={(v) => setBatchClassValue(v || batchClass)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Class" /></SelectTrigger>
                      <SelectContent>
                        {classNames.map((c) => (
                          <SelectItem key={c} value={c}>Class {c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">section</Label>
                    <Select value={batchSection} onValueChange={(v) => setBatchSection(v || batchSection)} disabled={batchSections.length === 0}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Section" /></SelectTrigger>
                      <SelectContent>
                        {batchSections.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={applyToAll} disabled={!batchClass || !batchSection}>
                    Apply to all
                  </Button>
                </div>
                {batchClassMissing && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Class {batchClass} hasn&apos;t been created yet. Add it from the Classes page first.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rows.map((r) => {
                const rowSections = sectionsForClass(r.toClass);
                const rowClassMissing = !isGraduating && !!r.toClass && rowSections.length === 0;
                return (
                  <div key={r.studentId} className="rounded-lg border border-border px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={r.included}
                        onChange={(e) => updateRow(r.studentId, { included: e.target.checked })}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">Roll {r.rollNumber || "—"}</p>
                      </div>
                      {isGraduating ? (
                        <span className="text-xs font-semibold text-emerald-600 shrink-0">Graduating</span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Select value={r.toClass} onValueChange={(v) => setRowClass(r.studentId, v || r.toClass)} disabled={!r.included}>
                            <SelectTrigger className="h-8 w-20"><SelectValue placeholder="Class" /></SelectTrigger>
                            <SelectContent>
                              {classNames.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={r.toSection}
                            onValueChange={(v) => updateRow(r.studentId, { toSection: v || r.toSection })}
                            disabled={!r.included || rowSections.length === 0}
                          >
                            <SelectTrigger className="h-8 w-20"><SelectValue placeholder="Sec" /></SelectTrigger>
                            <SelectContent>
                              {rowSections.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {rowClassMissing && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 pl-6">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Class {r.toClass} hasn&apos;t been created yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            type="button"
            onClick={submit}
            disabled={loading || rows.length === 0 || submitting || anyIncludedRowInvalid}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGraduating ? "Confirm Graduation" : "Confirm Promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
