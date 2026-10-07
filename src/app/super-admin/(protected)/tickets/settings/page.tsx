"use client";

import { useEffect, useState } from "react";
import { Archive, Check, Film, HardDriveUpload, ImageIcon, Info, Loader2, Play, Save, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import { RETENTION_OPTIONS } from "@/lib/bugReports/constants";
import { formatDateTime, ticketFetch } from "@/lib/bugReports/client";
import { TicketPanel } from "@/components/bugs/InfoGrid";
import { TicketsAdminShell } from "@/components/bugs/admin/TicketsAdminShell";

interface Settings {
  retentionDays: number;
  maxImageMB: number;
  maxVideoMB: number;
  lastCleanupAt: string | null;
}

// Super Admin: Ticket Retention Settings + upload limits.
export default function TicketSettingsPage() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    ticketFetch<{ data: Settings }>(getSuperAdminToken, "/superadmin/tickets/settings")
      .then((r) => {
        setSaved(r.data);
        setForm(r.data);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't load settings."));
  }, []);

  const dirty = form && saved && (form.retentionDays !== saved.retentionDays || form.maxImageMB !== saved.maxImageMB || form.maxVideoMB !== saved.maxVideoMB);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await ticketFetch(getSuperAdminToken, "/superadmin/tickets/settings", {
        method: "PUT",
        body: { retentionDays: form.retentionDays, maxImageMB: form.maxImageMB, maxVideoMB: form.maxVideoMB },
      });
      setSaved(form);
      toast.success("Ticket settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const runSweep = async () => {
    setSweeping(true);
    try {
      const r = await ticketFetch<{ message: string }>(getSuperAdminToken, "/superadmin/tickets/settings", { method: "POST" });
      toast.success(r.message);
      setSaved((s) => (s ? { ...s, lastCleanupAt: new Date().toISOString() } : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed.");
    } finally {
      setSweeping(false);
    }
  };

  return (
    <TicketsAdminShell>
      {!form ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <TicketPanel title="Ticket retention" icon={Timer}>
              <p className="mb-4 text-[13px] text-muted-foreground">
                Archive finished tickets (resolved, closed, rejected, duplicate, cannot reproduce) this long after they were closed.
                Archived tickets leave the active queue but stay in the <b>Solved Archive</b>, so past fixes remain searchable.
                You can delete archived tickets permanently from their detail page.
              </p>
              <div role="radiogroup" aria-label="Archive resolved tickets after" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {RETENTION_OPTIONS.map((o) => {
                  const active = form.retentionDays === o.days;
                  return (
                    <button
                      key={o.days}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setForm({ ...form, retentionDays: o.days })}
                      className={cn(
                        "relative flex flex-col items-start rounded-xl px-3.5 py-3 text-left ring-1 transition-all",
                        active ? "bg-primary/[0.07] ring-2 ring-primary" : "bg-card ring-border hover:ring-primary/40",
                      )}
                    >
                      <span className="font-heading text-[15px] font-bold text-foreground">{o.label}</span>
                      <span className="text-[11px] text-muted-foreground">{o.days ? "after closing" : "keep everything active"}</span>
                      {active && (
                        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </TicketPanel>

            <TicketPanel title="Attachment size limits" icon={HardDriveUpload}>
              <p className="mb-4 text-[13px] text-muted-foreground">
                Maximum size per file in bug reports and replies. Checked before upload and verified again on the server.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <SizeInput label="Images (JPG, PNG, WebP)" icon={ImageIcon} value={form.maxImageMB} max={50} onChange={(v) => setForm({ ...form, maxImageMB: v })} />
                <SizeInput label="Videos (MP4, MOV, WebM)" icon={Film} value={form.maxVideoMB} max={500} onChange={(v) => setForm({ ...form, maxVideoMB: v })} />
              </div>
            </TicketPanel>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-xl" disabled={!dirty || saving} onClick={() => setForm(saved)}>Discard</Button>
              <Button className="rounded-xl bg-gradient-to-r from-primary to-accent font-semibold" disabled={!dirty || saving} onClick={save}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save settings
              </Button>
            </div>
          </div>

          <aside className="space-y-5">
            <TicketPanel title="Cleanup" icon={Archive}>
              <p className="text-[13px] text-muted-foreground">
                Archiving runs automatically (at most once an hour) whenever the ticket dashboard is opened. You can also run it now.
              </p>
              <p className="mt-3 text-[12px] text-muted-foreground">
                Last run: <span className="font-semibold text-foreground">{saved?.lastCleanupAt ? formatDateTime(saved.lastCleanupAt) : "never"}</span>
              </p>
              <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={runSweep} disabled={sweeping || dirty === true}>
                {sweeping ? <Loader2 className="animate-spin" /> : <Play />} Run cleanup now
              </Button>
              {dirty && <p className="mt-2 text-[11.5px] text-warning">Save your changes first.</p>}
            </TicketPanel>
            <div className="flex gap-2.5 rounded-2xl bg-info/[0.07] p-4 text-[12.5px] text-foreground ring-1 ring-info/20">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <p>Support emails go to <b>SUPPORT_EMAIL</b> if it&apos;s set in the server environment, otherwise to the sending account (<b>EMAIL_USER</b>).</p>
            </div>
          </aside>
        </div>
      )}
    </TicketsAdminShell>
  );
}

function SizeInput({ label, icon: Icon, value, max, onChange }: { label: string; icon: typeof ImageIcon; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {label}</span>
      <div className="relative">
        <Input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))))}
          className="h-11 rounded-xl pr-12 tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[12px] font-semibold text-muted-foreground">MB</span>
      </div>
      <span className="text-[11px] text-muted-foreground">1 – {max} MB</span>
    </label>
  );
}
