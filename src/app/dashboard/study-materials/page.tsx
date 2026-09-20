"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Search, Download, FileText, File, Plus, Eye, Loader2, Trash2, Upload, X, BookMarked, Users } from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { StatFilterCard } from "@/components/StatFilterCard";

type MaterialType = "notes" | "paper" | "worksheet";

interface Material {
  _id: string;
  title: string;
  description: string;
  subject: string;
  class: string;
  section: string;
  type: MaterialType;
  fileUrl: string;
  fileName: string;
  uploaderName: string;
  uploaderModel: "Teacher" | "Admin";
  uploadedBy?: { _id: string } | null;
  downloads: number;
  createdAt: string;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface Child {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

const TYPE_ICON: Record<MaterialType, typeof FileText> = { notes: BookMarked, paper: File, worksheet: BookOpen };
const TYPE_COLOR: Record<MaterialType, string> = {
  notes: "bg-blue-50 text-blue-700 border-blue-200",
  paper: "bg-amber-50 text-amber-700 border-amber-200",
  worksheet: "bg-green-50 text-green-700 border-green-200",
};

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function StudyMaterialsPage() {
  const { user } = useAuth();
  const isUploader = user?.role === "schooladmin" || user?.role === "teacher";
  const isParent = user?.role === "parent";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MaterialType>("all");

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: "", description: "", subject: "", classId: "", type: "notes" as MaterialType });

  const fetchMaterials = () => {
    const token = getToken();
    if (!token) return;
    const run = async () => {
      if (isParent) {
        if (!selectedChildId) {
          setMaterials([]);
          return;
        }
        const res = await apiGet<{ success: boolean; data: Material[] }>(`/study-materials/student/${selectedChildId}`, token);
        setMaterials(res.data);
      } else {
        const res = await apiGet<{ success: boolean; data: Material[] }>("/study-materials", token);
        setMaterials(res.data);
      }
    };
    run()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load materials."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, selectedChildId]);

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

  useEffect(() => {
    const token = getToken();
    const run = async () => {
      if (!form.classId || !token) {
        setSubjectOptions([]);
        return;
      }
      const res = await apiGet<{ success: boolean; data: SubjectOption[] }>(`/subjects/class/${form.classId}`, token);
      setSubjectOptions(res.data);
    };
    run().catch(() => setSubjectOptions([]));
  }, [form.classId]);

  const openModal = () => {
    setShowModal(true);
    const token = getToken();
    if (!token) return;
    setClassesLoading(true);
    apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => toast.error("Failed to load classes."))
      .finally(() => setClassesLoading(false));
  };

  const resetModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setForm({ title: "", description: "", subject: "", classId: "", type: "notes" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!form.title.trim() || !form.subject.trim() || !form.classId) {
      toast.error("Title, subject and class are required.");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select a file.");
      return;
    }
    const selectedClass = classes.find((c) => c._id === form.classId);
    if (!selectedClass) {
      toast.error("Invalid class selected.");
      return;
    }

    const token = getToken();
    if (!token) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("subject", form.subject.trim());
      fd.append("class", selectedClass.name);
      fd.append("section", selectedClass.section || "");
      fd.append("type", form.type);

      const res = await fetch("/api/study-materials", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Upload failed.");

      toast.success("Material uploaded.");
      resetModal();
      fetchMaterials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (mat: Material) => {
    const token = getToken();
    if (!token) return;
    fetch(`/api/study-materials/${mat._id}/download`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } })
      .then(() => setMaterials((prev) => prev.map((m) => (m._id === mat._id ? { ...m, downloads: m.downloads + 1 } : m))))
      .catch(() => {});
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/study-materials/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Delete failed.");
      setMaterials((prev) => prev.filter((m) => m._id !== id));
      toast.success("Material deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = m.title.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || m.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookMarked}
        title="Study Materials"
        subtitle={`${materials.length} resource${materials.length !== 1 ? "s" : ""} available.`}
        accent="violet"
        actions={
          <>
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
            {isUploader && (
              <Button className="gap-2" onClick={openModal}>
                <Plus className="h-4 w-4" /> Upload Material
              </Button>
            )}
          </>
        }
      />

      {materials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatFilterCard
            icon={BookMarked}
            color="#4F46E5"
            colorDark="#4338CA"
            value={materials.length}
            label="Total Materials"
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          <StatFilterCard
            icon={BookMarked}
            color="#0EA5E9"
            colorDark="#0284C7"
            value={materials.filter((m) => m.type === "notes").length}
            label="Notes"
            active={typeFilter === "notes"}
            onClick={() => setTypeFilter(typeFilter === "notes" ? "all" : "notes")}
          />
          <StatFilterCard
            icon={File}
            color="#F59E0B"
            colorDark="#D97706"
            value={materials.filter((m) => m.type === "paper").length}
            label="Past Papers"
            active={typeFilter === "paper"}
            onClick={() => setTypeFilter(typeFilter === "paper" ? "all" : "paper")}
          />
          <StatFilterCard
            icon={BookOpen}
            color="#16A34A"
            colorDark="#15803D"
            value={materials.filter((m) => m.type === "worksheet").length}
            label="Worksheets"
            active={typeFilter === "worksheet"}
            onClick={() => setTypeFilter(typeFilter === "worksheet" ? "all" : "worksheet")}
          />
        </div>
      )}

      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by title or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <PageLoader label="Loading study materials..." />
      ) : isParent && !selectedChildId ? (
        <EmptyState icon={Users} message="No child linked to your account yet." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No materials found." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mat) => {
            const Icon = TYPE_ICON[mat.type] || FileText;
            const canDelete = isUploader && (user?.role === "schooladmin" || mat.uploadedBy?._id === user?.id);
            return (
              <Card key={mat._id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate" title={mat.title}>
                        {mat.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {mat.uploaderName} · {mat.uploaderModel === "Admin" ? "Admin" : "Teacher"}
                      </p>
                    </div>
                    {canDelete && (
                      <button onClick={() => handleDelete(mat._id)} className="text-muted-foreground hover:text-red-600 transition-colors shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {mat.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{mat.description}</p>}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TYPE_COLOR[mat.type] || ""}`}>{mat.type}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground/90 font-medium">{mat.subject}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground font-medium">
                      Class {mat.class}
                      {mat.section ? `-${mat.section}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{fmtDate(mat.createdAt)}</span>
                    <span>{mat.downloads} downloads</span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <a
                      href={mat.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1 gap-1 text-xs" })}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </a>
                    <a
                      href={mat.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleDownload(mat)}
                      className={buttonVariants({ size: "sm", className: "flex-1 gap-1 text-xs" })}
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isUploader && (
        <Dialog
          open={showModal}
          onOpenChange={(o) => {
            if (!o) resetModal();
          }}
        >
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> Upload Study Material
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Chapter 5 - Quadratic Equations Notes"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Class <span className="text-red-500">*</span>
                </Label>
                {classesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </div>
                ) : classes.length === 0 ? (
                  <div className="text-xs text-red-600 h-9 flex items-center">No classes available to you.</div>
                ) : (
                  <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v || "", subject: "" }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          Class {c.name}
                          {c.section ? `-${c.section}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Subject <span className="text-red-500">*</span>
                </Label>
                {subjectOptions.length > 0 ? (
                  <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v || "" }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject…" />
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
                  <Input placeholder="e.g. Mathematics" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} maxLength={60} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Material Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: (v || "notes") as MaterialType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notes">Notes</SelectItem>
                    <SelectItem value="paper">Past Paper</SelectItem>
                    <SelectItem value="worksheet">Worksheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Brief description of this material…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-[70px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  File <span className="text-red-500">*</span>
                </Label>
                {selectedFile ? (
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/50">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-all"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, PPT, XLS up to 20 MB</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetModal} disabled={uploading}>
                Cancel
              </Button>
              <Button className="gap-2" onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
