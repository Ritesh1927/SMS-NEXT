"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Power, Building2, GraduationCap, Briefcase, Users, Search, X, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BulkImportDialog } from "@/components/dashboard/BulkImportDialog";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface TeacherRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  teacherId: string;
  designation?: string;
  subjects?: string[];
  classes?: string[];
  assignedClasses?: ClassOption[];
  qualification?: string;
  staffType: string;
  employmentType?: string;
  gender?: string;
  isActive: boolean;
}

interface TeachersResponse {
  success: boolean;
  count: number;
  data: TeacherRow[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  tempPassword?: string;
}

export default function TeachersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [staffFilter, setStaffFilter] = useState<"" | "teaching" | "non-teaching">("");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TeacherRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<TeachersResponse>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load teachers."));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (t: TeacherRow) => {
    const token = getToken();
    if (!token) return;
    setBusyId(t._id);
    try {
      const res = await fetch(`/api/teachers/${t._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update teacher.");
      toast.success(t.isActive ? "Teacher deactivated" : "Teacher activated");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const t = pendingDelete;
    const token = getToken();
    if (!token) return;
    setBusyId(t._id);
    try {
      const res = await fetch(`/api/teachers/${t._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete teacher.");
      toast.success("Teacher deleted");
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const allTeachers = teachers || [];
  const counts = {
    total: allTeachers.length,
    teaching: allTeachers.filter((t) => t.staffType === "teaching").length,
    nonTeaching: allTeachers.filter((t) => t.staffType !== "teaching").length,
  };
  const filteredTeachers = allTeachers.filter((t) => {
    if (staffFilter && t.staffType !== staffFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q) && !(t.subjects || []).some((s) => s.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        title="Staff"
        subtitle={`${counts.total} staff member${counts.total === 1 ? "" : "s"} (${counts.teaching} teaching, ${counts.nonTeaching} non-teaching).`}
        accent="blue"
        actions={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <Button onClick={() => router.push("/dashboard/teachers/new")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Staff
            </Button>
          </>
        }
        className="mb-6"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {teachers && teachers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatFilterCard
              icon={Building2}
              color="#4F46E5"
              colorDark="#4338CA"
              value={counts.total}
              label="Total Staff"
              active={staffFilter === ""}
              onClick={() => setStaffFilter("")}
            />
            <StatFilterCard
              icon={GraduationCap}
              color="#8B5CF6"
              colorDark="#7C3AED"
              value={counts.teaching}
              label="Teaching"
              sublabel={counts.total > 0 ? `${Math.round((counts.teaching / counts.total) * 100)}% of staff` : undefined}
              active={staffFilter === "teaching"}
              onClick={() => setStaffFilter(staffFilter === "teaching" ? "" : "teaching")}
            />
            <StatFilterCard
              icon={Briefcase}
              color="#F59E0B"
              colorDark="#D97706"
              value={counts.nonTeaching}
              label="Non-Teaching"
              sublabel={counts.total > 0 ? `${Math.round((counts.nonTeaching / counts.total) * 100)}% of staff` : undefined}
              active={staffFilter === "non-teaching"}
              onClick={() => setStaffFilter(staffFilter === "non-teaching" ? "" : "non-teaching")}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative sm:max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, email, subject, department..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {staffFilter !== "" && (
              <button
                type="button"
                onClick={() => setStaffFilter("")}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15 transition-colors"
              >
                {staffFilter === "teaching" ? "Teaching only" : "Non-Teaching only"}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {error ? null : !teachers ? (
        <PageLoader label="Loading staff..." />
      ) : teachers.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No teachers yet. Add your first one to get started." />
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No staff match your filters." />
        </div>
      ) : (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-border">
            <p className="flex-1 max-w-sm text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Name</p>
            <p className="w-28 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Type</p>
            <p className="w-48 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Email</p>
            <p className="w-32 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Phone</p>
            <p className="hidden lg:block w-40 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Subjects</p>
            <p className="w-[136px] shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider text-right ml-auto">Actions</p>
          </div>
          {filteredTeachers.map((t) => (
            <div key={t._id} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3 flex-1 max-w-sm min-w-0">
                <Avatar className="h-11 w-11 shrink-0 border border-border">
                  <AvatarImage src={t.photo} alt={t.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    {!t.isActive && (
                      <span className={`shrink-0 ${statusPillClass("destructive")}`}>Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.qualification || t.teacherId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 sm:hidden truncate">
                    {t.email}
                    {t.phone ? ` · ${t.phone}` : ""}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-28 shrink-0">
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    t.staffType === "teaching" ? "bg-info/10 text-blue-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {t.staffType === "teaching" ? "Teaching" : "Non-Teaching"}
                </span>
              </div>
              <div className="hidden sm:block w-48 shrink-0">
                <p className="text-sm text-foreground/90 truncate">{t.email}</p>
              </div>
              <div className="hidden sm:block w-32 shrink-0">
                <p className="text-sm text-foreground/90">{t.phone || "—"}</p>
              </div>
              <div className="hidden lg:block w-40 shrink-0">
                <p className="text-sm text-foreground/90 truncate">{t.subjects && t.subjects.length > 0 ? t.subjects.join(", ") : "—"}</p>
              </div>

              <div className="flex items-center justify-end gap-1 w-[136px] shrink-0 ml-auto">
                <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/teachers/${t._id}`)} aria-label="View" title="View this staff member's full details">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/teachers/${t._id}/edit`)} aria-label="Edit" title="Edit this staff member's details">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleActive(t)}
                  disabled={busyId === t._id}
                  aria-label={t.isActive ? "Deactivate" : "Activate"}
                  title={t.isActive ? "Deactivate this staff member's account" : "Reactivate this staff member's account"}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPendingDelete(t)}
                  disabled={busyId === t._id}
                  aria-label="Delete"
                  title="Delete this staff member permanently"
                  className="hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "Teacher"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={busyId === pendingDelete?._id}
        onConfirm={confirmDelete}
      />

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Upload Staff"
        entityLabel="staff member"
        importPath="/teachers/bulk-import"
        templatePath="/teachers/bulk-import/template"
        templateFilename="staff_bulk_upload_template.xlsx"
        onImported={load}
      />
    </div>
  );
}
