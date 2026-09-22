"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RowResult {
  row: number;
  name: string;
  status: "created" | "failed";
  message?: string;
}

interface ImportResponse {
  success: boolean;
  message?: string;
  data?: { createdCount: number; failedCount: number; results: RowResult[] };
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityLabel: string;
  /** API path under /api, e.g. "/students/bulk-import" */
  importPath: string;
  /** API path under /api for the template download, e.g. "/students/bulk-import/template" */
  templatePath: string;
  templateFilename: string;
  /** Called once after the dialog closes with at least one successful row, so the caller can refresh its list. */
  onImported: () => void;
}

// Shared upload-and-review flow for both Students and Staff bulk import:
// download a template, pick the filled-in file, upload it, then show a
// per-row created/failed summary so a handful of bad rows don't force the
// admin to figure out which ones from a single generic error message.
export function BulkImportDialog({ open, onOpenChange, title, entityLabel, importPath, templatePath, templateFilename, onImported }: BulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ createdCount: number; failedCount: number; results: RowResult[] } | null>(null);
  const importedAnyRef = useRef(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    importedAnyRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (!o && importedAnyRef.current) onImported();
    if (!o) reset();
    onOpenChange(o);
  };

  const downloadTemplate = async () => {
    const token = getToken();
    if (!token) return;
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`/api${templatePath}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to download template.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = templateFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to download template." });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File is too large — must be under 5 MB.");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    const token = getToken();
    if (!token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api${importPath}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json: ImportResponse = await res.json();
      if (!res.ok || !json.success || !json.data) throw new Error(json.message || "Upload failed.");
      setResult(json.data);
      if (json.data.createdCount > 0) importedAnyRef.current = true;
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  const failedRows = result?.results.filter((r) => r.status === "failed") || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">{title}</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Download the template, fill in one row per {entityLabel}, then upload it here. Fields marked with an asterisk in the
              template are required.
            </p>

            <Button type="button" variant="outline" className="w-full gap-2" onClick={downloadTemplate} disabled={downloadingTemplate}>
              {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Template
            </Button>

            <div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 py-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="icon-chip h-10 w-10 bg-primary/10 text-primary shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file ? file.name : "Choose the filled-in template"}</p>
                  <p className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : ".xlsx, .xls, or .csv — up to 500 rows"}</p>
                </div>
              </button>
            </div>

            <Button type="button" className="w-full bg-primary hover:bg-primary/90 gap-2" disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload & Create"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div
              className={`flex items-center gap-3 rounded-xl p-4 border ${
                result.failedCount === 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              {result.failedCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {result.createdCount} {entityLabel}
                  {result.createdCount === 1 ? "" : "s"} created
                  {result.failedCount > 0 ? `, ${result.failedCount} failed` : ""}
                </p>
                {result.createdCount > 0 && <p className="text-muted-foreground">Credentials were emailed to each new parent/staff account.</p>}
              </div>
            </div>

            {failedRows.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rows that failed</p>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {failedRows.map((r, i) => (
                    <div key={i} className="px-3 py-2 flex items-start gap-2">
                      <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">Row {r.row}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-destructive">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={reset}>
                <X className="h-4 w-4" /> Upload Another File
              </Button>
              <Button type="button" className="flex-1 bg-primary hover:bg-primary/90" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
