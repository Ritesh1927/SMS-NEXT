"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: showing the loading state for the preview fetch this dialog open kicks off.
    setLoading(true);
    apiGet<PreviewResponse>(`/classes/${classId}/promotion-preview`, token)
      .then((res) => {
        const { suggestion, students } = res.data;
        const graduate = suggestion.type === "graduate";
        setIsGraduating(graduate);
        setRows(
          students.map((s) => ({
            studentId: s.id,
            name: s.name,
            rollNumber: s.rollNumber,
            included: true,
            toClass: graduate ? "" : suggestion.class,
            toSection: graduate ? "" : suggestion.section,
          })),
        );
        if (!graduate) {
          setBatchClass(suggestion.class);
          setBatchSection(suggestion.section);
        }
      })
      .catch((err) => toast.error("Failed to load class roster.", { description: err instanceof Error ? err.message : undefined }))
      .finally(() => setLoading(false));
  }, [open, classId, token]);

  const applyToAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, toClass: batchClass, toSection: batchSection })));
  };

  const updateRow = (studentId: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r)));
  };

  const submit = async () => {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) {
      toast.error("No students selected.");
      return;
    }
    if (!isGraduating && included.some((r) => !r.toClass.trim())) {
      toast.error("Every promoted student needs a target class.");
      return;
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
              <div className="flex items-end gap-2 rounded-lg border border-border px-3 py-2.5">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Apply to all: class</Label>
                  <Input value={batchClass} onChange={(e) => setBatchClass(e.target.value)} className="h-8" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">section</Label>
                  <Input value={batchSection} onChange={(e) => setBatchSection(e.target.value)} className="h-8" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyToAll}>Apply to all</Button>
              </div>
            )}

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.studentId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
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
                      <Input
                        value={r.toClass}
                        onChange={(e) => updateRow(r.studentId, { toClass: e.target.value })}
                        disabled={!r.included}
                        className="h-8 w-16 text-center"
                        placeholder="Class"
                      />
                      <Input
                        value={r.toSection}
                        onChange={(e) => updateRow(r.studentId, { toSection: e.target.value })}
                        disabled={!r.included}
                        className="h-8 w-16 text-center"
                        placeholder="Sec"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={loading || rows.length === 0 || submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGraduating ? "Confirm Graduation" : "Confirm Promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
