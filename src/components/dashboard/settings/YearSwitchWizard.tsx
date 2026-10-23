"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost } from "@/lib/api";

interface YearSwitchPreview {
  currentYear: string;
  nextYear: string;
  attendanceRecords: number;
  studentsWithAttendance: number;
  studentsAffected: number;
  tests: number;
  testResults: number;
  homework: number;
  studyMaterials: number;
  notices: number;
}

interface YearSwitchResult {
  previousYear: string;
  currentYear: string;
  attendanceRecordsCompacted: number;
  attendanceSummariesWritten: number;
  testsDeleted: number;
  testResultsDeleted: number;
  homeworkDeleted: number;
  studyMaterialsDeleted: number;
  noticesDeleted: number;
  studentsReset: number;
}

type Step = 1 | 2 | 3 | 4;

export function YearSwitchWizard({ token, currentYear, onSwitched }: { token: string; currentYear: string; onSwitched: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [preview, setPreview] = useState<YearSwitchPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [classTeacherAllowed, setClassTeacherAllowed] = useState(false);
  const [powerRoleAllowed, setPowerRoleAllowed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<YearSwitchResult | null>(null);

  const reset = () => {
    setStep(1);
    setPreview(null);
    setClassTeacherAllowed(false);
    setPowerRoleAllowed(false);
    setConfirmText("");
    setResult(null);
  };

  const openWizard = () => {
    reset();
    setOpen(true);
  };

  const goToConsequences = () => {
    setStep(2);
    setLoadingPreview(true);
    apiGet<{ success: boolean; data: YearSwitchPreview }>("/school/year-switch", token)
      .then((res) => setPreview(res.data))
      .catch((err) => toast.error("Failed to load consequences.", { description: err instanceof Error ? err.message : undefined }))
      .finally(() => setLoadingPreview(false));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; data: YearSwitchResult }>(
        "/school/year-switch",
        { confirmationText: confirmText, classTeacherPromotionAllowed: classTeacherAllowed, powerRoleTeacherPromotionAllowed: powerRoleAllowed },
        token,
      );
      setResult(res.data);
      setStep(4);
      onSwitched();
    } catch (err) {
      toast.error("Could not switch the educational year.", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const close = (next: boolean) => {
    if (submitting) return;
    setOpen(next);
  };

  return (
    <>
      <Button type="button" variant="outline" className="gap-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700" onClick={openWizard}>
        <ArrowRightLeft className="h-4 w-4" />
        Switch Educational Year
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md">
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Switch Educational Year?</DialogTitle>
                <DialogDescription>
                  You&apos;re about to end <strong className="text-foreground">{currentYear}</strong> and move to the next educational year. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="button" onClick={goToConsequences}>Yes, I&apos;m sure</Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Here&apos;s what will happen</DialogTitle>
                <DialogDescription>This permanently deletes data for {currentYear}. Review before continuing.</DialogDescription>
              </DialogHeader>
              {loadingPreview || !preview ? (
                <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <ul className="space-y-2 text-sm text-foreground py-1">
                  <li>• Attendance for {preview.studentsWithAttendance} student(s) ({preview.attendanceRecords} daily record(s)) will be compacted into one yearly percentage per student — no daily/monthly detail is kept after this.</li>
                  <li>• {preview.tests} test(s) and their {preview.testResults} result(s) will be permanently deleted. (Exam Terms are kept, year-scoped.)</li>
                  <li>• {preview.homework} homework post(s), {preview.studyMaterials} study material(s) and {preview.notices} notice(s) will be permanently deleted.</li>
                  <li>• The leaderboard resets to zero for all {preview.studentsAffected} student(s).</li>
                  <li>• Fee data for {currentYear} is kept and stays browsable, just no longer shown by default.</li>
                </ul>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="button" variant="destructive" disabled={loadingPreview || !preview} onClick={() => setStep(3)}>I Agree</Button>
              </DialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <DialogHeader>
                <DialogTitle>Final step</DialogTitle>
                <DialogDescription>Choose who else can promote students afterward, then confirm.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Class teachers</p>
                    <p className="text-xs text-muted-foreground">Allow class teachers to promote students of their own class.</p>
                  </div>
                  <Switch checked={classTeacherAllowed} onCheckedChange={setClassTeacherAllowed} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Power Role teachers</p>
                    <p className="text-xs text-muted-foreground">Allow teachers with the promotion power to promote students of their scoped classes.</p>
                  </div>
                  <Switch checked={powerRoleAllowed} onCheckedChange={setPowerRoleAllowed} />
                </div>
                <div className="space-y-1.5 pt-1">
                  <Label>Type &quot;{currentYear}&quot; to confirm</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={currentYear} autoFocus />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
                <Button type="button" variant="destructive" disabled={confirmText !== currentYear || submitting} onClick={submit} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Education Year/Term
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 4 && result && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Switched to {result.currentYear}</DialogTitle>
                <DialogDescription>{result.previousYear} has been archived.</DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-sm text-foreground py-1">
                <li>• {result.attendanceSummariesWritten} student attendance summary(ies) saved; {result.attendanceRecordsCompacted} daily record(s) compacted.</li>
                <li>• {result.testsDeleted} test(s) and {result.testResultsDeleted} result(s) deleted.</li>
                <li>• {result.homeworkDeleted} homework, {result.studyMaterialsDeleted} study material(s), {result.noticesDeleted} notice(s) deleted.</li>
                <li>• Leaderboard reset for {result.studentsReset} student(s).</li>
              </ul>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
