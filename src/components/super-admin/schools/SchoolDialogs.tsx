"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Building2, Calendar, Check, CheckCircle2, Copy, Crown, KeyRound, Loader2, Pencil, School, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate, formatINR, saRequest, type PlanRecord, type SchoolRecord } from "@/lib/superAdminApi";
import { PRIMARY_CTA } from "../ui";

// Register / Edit / Renew dialogs for the Schools module. Each sends the
// exact request the old dashboard sent (same endpoint, method and body);
// only the presentation changed (stepper, sections, inline validation).

// Strips non-digits and any leading zeros (keeping a lone "0") so typing
// into a field that starts at 0 replaces it instead of prefixing "0".
function parseCountInput(raw: string): number {
  const digitsOnly = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digitsOnly === "" ? 0 : Number(digitsOnly);
}
// A count bound to a number that defaults to 0 shows blank while at 0.
function countInputValue(n: number): string {
  return n === 0 ? "" : String(n);
}

const fieldClass = "h-11 rounded-xl";

function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label} {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? <p role="alert" className="text-[12px] text-destructive">{error}</p> : hint ? <p className="text-[11.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DialogHero({ icon: Icon, title, description, tone = "primary" }: { icon: typeof School; title: string; description?: string; tone?: "primary" | "success" }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 px-6 pt-6 pb-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md", tone === "success" ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-green-600/25" : "bg-gradient-to-br from-primary to-accent shadow-primary/25")}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 pr-6">
        <DialogTitle className="font-heading text-[17px] font-bold text-foreground">{title}</DialogTitle>
        {description && <DialogDescription className="mt-0.5 text-[12.5px]">{description}</DialogDescription>}
      </div>
    </div>
  );
}

const dialogShell = "gap-0 overflow-hidden p-0 shadow-[0_40px_90px_-30px_rgba(37,30,140,0.45)] ring-1 ring-border/60 max-lg:pb-0";

// ---- Register (multi-step) ------------------------------------------------------

const STEPS = [
  { id: "plan", label: "Plan", icon: Crown },
  { id: "school", label: "School", icon: Building2 },
  { id: "admin", label: "Admin", icon: UserRound },
  { id: "license", label: "License", icon: Calendar },
] as const;

const EMPTY_CREATE = { name: "", address: "", phone: "", email: "", adminName: "", adminEmail: "", adminPhone: "", startDate: "", endDate: "", extraUsers: 0 };

export function RegisterSchoolDialog({
  open, onOpenChange, plans, onCreated, initialPlanId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PlanRecord[];
  onCreated: () => void;
  /** Pre-select a plan and start at the School step ("Register with this plan"). */
  initialPlanId?: string | null;
}) {
  const activePlans = plans.filter((p) => p.isActive);
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ code: string; password: string } | null>(null);

  // Fresh form every time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const preset = initialPlanId ? activePlans.find((p) => p._id === initialPlanId) ?? null : null;
      setStep(preset ? 1 : 0);
      setPlan(preset);
      setForm(EMPTY_CREATE);
      setErrors({});
      setCreated(null);
    }
  }

  const set = (key: keyof typeof EMPTY_CREATE, value: string | number) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  // Same arithmetic as before the redesign.
  const months = (() => {
    if (!form.startDate || !form.endDate) return 0;
    const diffMs = new Date(form.endDate).getTime() - new Date(form.startDate).getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)) || 1;
  })();
  const totalAmount = months * (form.extraUsers || 0) * (plan?.pricePerUser || 0);
  const totalUsers = (plan?.includedUsers || 0) + (form.extraUsers || 0);

  const validateStep = (index: number): boolean => {
    const next: Record<string, string> = {};
    if (index === 0 && !plan) next.plan = "Choose a plan to continue.";
    if (index === 1 && !form.name.trim()) next.name = "School name is required.";
    if (index === 2) {
      if (!form.adminName.trim()) next.adminName = "Admin name is required.";
      // Required-only, exactly as the original form (no extra format rule).
      if (!form.adminEmail.trim()) next.adminEmail = "Admin email is required.";
    }
    if (index === 3) {
      if (!form.startDate) next.startDate = "Start date is required.";
      if (!form.endDate) next.endDate = "End date is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => validateStep(step) && setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    if (!validateStep(3)) return;
    setCreating(true);
    try {
      const payload = {
        ...form,
        planId: plan?._id,
        planName: plan?.name,
        months,
        totalAmount,
        totalUsers,
        includedUsers: plan?.includedUsers || 0,
        pricePerUser: plan?.pricePerUser || 0,
      };
      const json = await saRequest("/superadmin/schools", { method: "POST", body: payload });
      setCreated({ code: json.data.code, password: json.data.generatedPassword });
      toast.success("School Created!", { description: `${form.name} has been registered.` });
      onCreated();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShell, "max-h-[92vh] overflow-y-auto sm:max-w-2xl")}>
        <DialogHero icon={School} title="Register New School" description={created ? "Registration complete" : `Step ${step + 1} of ${STEPS.length} · ${STEPS[step].label}`} />

        {created ? (
          <div className="space-y-5 px-6 py-6">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success ring-8 ring-success/[0.06]">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="mt-3 font-heading text-lg font-bold">School Created Successfully!</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Share these credentials with the school admin. The password can&apos;t be recovered.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CredentialTile label="School code" value={created.code} />
              <CredentialTile label="Admin password" value={created.password} />
            </div>
            <Button className={cn(PRIMARY_CTA, "h-11 w-full")} onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} noValidate>
            {/* Stepper */}
            <ol className="flex items-center gap-2 px-6 pt-5" aria-label="Registration steps">
              {STEPS.map((s, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <li key={s.id} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ring-1 transition-colors",
                        done ? "bg-success text-white ring-success" : current ? "bg-primary text-primary-foreground ring-primary" : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </span>
                    <span className={cn("hidden text-[12.5px] font-semibold sm:inline", current ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                    {i < STEPS.length - 1 && <span className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} aria-hidden />}
                  </li>
                );
              })}
            </ol>

            <div className="min-h-[300px] px-6 py-5">
              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">Choose the subscription plan for this school.</p>
                  {activePlans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                      <Crown className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-[13px] font-semibold">No active plans yet</p>
                      <Link href="/super-admin/plans" onClick={() => onOpenChange(false)} className="mt-1 inline-block text-[12.5px] font-semibold text-primary hover:underline">
                        Create a plan in Subscription Plans →
                      </Link>
                    </div>
                  ) : (
                    <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
                      {activePlans.map((p) => {
                        const selected = plan?._id === p._id;
                        return (
                          <button
                            key={p._id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              setPlan(p);
                              setErrors({});
                            }}
                            className={cn(
                              "relative rounded-2xl p-4 text-left ring-1 transition-all",
                              selected ? "bg-primary/[0.06] ring-2 ring-primary" : "bg-card ring-border hover:ring-primary/40",
                            )}
                          >
                            {selected && <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"><Check className="h-3 w-3" /></span>}
                            <span className="flex items-center gap-2 font-heading text-[15px] font-bold">
                              <Crown className="h-4 w-4 text-primary" /> {p.name}
                            </span>
                            <span className="mt-2 block text-[12.5px] text-muted-foreground">{formatINR(p.pricePerUser)}/user/month</span>
                            <span className="block text-[12.5px] text-muted-foreground">{p.includedUsers} free users · {p.features.length} features</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.plan && <p role="alert" className="text-[12px] text-destructive">{errors.plan}</p>}
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="School name" required error={errors.name} className="sm:col-span-2">
                    <Input autoFocus placeholder="e.g. Delhi Public School" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} className={fieldClass} />
                  </Field>
                  <Field label="Phone">
                    <Input inputMode="tel" placeholder="9876543210" value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} className={fieldClass} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" placeholder="school@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input placeholder="Full address" value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admin name" required error={errors.adminName}>
                    <Input autoFocus placeholder="Full name" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} aria-invalid={!!errors.adminName} className={fieldClass} />
                  </Field>
                  <Field label="Admin phone">
                    <Input inputMode="tel" placeholder="9876543210" value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} className={fieldClass} />
                  </Field>
                  <Field label="Admin email" required error={errors.adminEmail} hint="Login credentials are sent here." className="sm:col-span-2">
                    <Input type="email" placeholder="admin@email.com" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} aria-invalid={!!errors.adminEmail} className={fieldClass} />
                  </Field>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="License start date" required error={errors.startDate}>
                      <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!errors.startDate} className={fieldClass} />
                    </Field>
                    <Field label="License end date" required error={errors.endDate}>
                      <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!errors.endDate} className={fieldClass} />
                    </Field>
                    <Field label={`Extra users (beyond ${plan?.includedUsers || 0} free)`}>
                      <Input inputMode="numeric" pattern="[0-9]*" placeholder="0" value={countInputValue(form.extraUsers)} onChange={(e) => set("extraUsers", parseCountInput(e.target.value))} className={fieldClass} />
                    </Field>
                    <div className="rounded-xl bg-muted/60 px-4 py-2.5 ring-1 ring-border/60">
                      <p className="text-[11.5px] font-medium text-muted-foreground">Total users</p>
                      <p className="font-heading text-xl font-bold tabular-nums">{totalUsers}</p>
                      <p className="text-[11px] text-muted-foreground">{plan?.includedUsers || 0} free + {form.extraUsers || 0} extra</p>
                    </div>
                  </div>

                  {/* Review */}
                  <div className="rounded-2xl bg-primary/[0.04] p-4 ring-1 ring-primary/15">
                    <p className="text-[11px] font-bold tracking-wider text-primary uppercase">Review</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                      <dt className="text-muted-foreground">Plan</dt><dd className="text-right font-semibold">{plan?.name}</dd>
                      <dt className="text-muted-foreground">School</dt><dd className="truncate text-right font-semibold">{form.name}</dd>
                      <dt className="text-muted-foreground">Admin</dt><dd className="truncate text-right font-semibold">{form.adminEmail}</dd>
                      <dt className="text-muted-foreground">Duration</dt><dd className="text-right font-semibold">{months} month{months !== 1 ? "s" : ""}</dd>
                      {form.extraUsers > 0 && (
                        <>
                          <dt className="text-muted-foreground">Extra users × price</dt>
                          <dd className="text-right font-semibold">{form.extraUsers} × {formatINR(plan?.pricePerUser || 0)}</dd>
                        </>
                      )}
                      <dt className="border-t border-primary/15 pt-1.5 font-semibold">Total amount</dt>
                      <dd className="border-t border-primary/15 pt-1.5 text-right font-heading text-lg font-bold text-primary">{formatINR(totalAmount)}</dd>
                    </dl>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-6 py-4 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {step === 0 ? (
                <Button type="button" variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
              ) : (
                <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="submit" className={cn(PRIMARY_CTA, "h-11 px-6")} disabled={step === 0 && activePlans.length === 0}>
                  Continue <ArrowRight />
                </Button>
              ) : (
                <Button type="submit" className={cn(PRIMARY_CTA, "h-11 px-6")} disabled={creating}>
                  {creating ? <Loader2 className="animate-spin" /> : <Check />}
                  {creating ? "Creating…" : "Register School"}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialTile({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`), () => {})}
      className="group/cred rounded-xl bg-muted/60 px-4 py-3 text-left ring-1 ring-border/60 transition hover:ring-primary/40"
      aria-label={`Copy ${label}`}
    >
      <span className="flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
        {label} <Copy className="h-3.5 w-3.5 opacity-60 group-hover/cred:opacity-100" />
      </span>
      <span className="mt-0.5 block font-mono text-[15px] font-bold break-all text-foreground">{value}</span>
    </button>
  );
}

// ---- Edit ---------------------------------------------------------------------------

export function EditSchoolDialog({ school, onClose, onSaved }: { school: SchoolRecord | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", adminName: "", adminPhone: "" });
  const [saving, setSaving] = useState(false);
  const [prevSchool, setPrevSchool] = useState<SchoolRecord | null>(null);
  if (school !== prevSchool) {
    setPrevSchool(school);
    if (school) setForm({ name: school.name, address: school.address, phone: school.phone, email: school.email, adminName: school.adminName, adminPhone: school.adminPhone });
  }

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    try {
      await saRequest(`/superadmin/schools/${school._id}`, { method: "PUT", body: form });
      toast.success("Updated", { description: "School details updated." });
      onClose();
      onSaved();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!school} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(dialogShell, "sm:max-w-lg")}>
        <DialogHero icon={Pencil} title="Edit School" description={school ? `${school.name} · ${school.code}` : undefined} />
        <form onSubmit={handleEdit}>
          <div className="space-y-5 px-6 py-5">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">School</legend>
              <Field label="School name">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={fieldClass} /></Field>
                <Field label="Email"><Input value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldClass} /></Field>
              </div>
              <Field label="Address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} /></Field>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Admin</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Admin name"><Input value={form.adminName} onChange={(e) => set("adminName", e.target.value)} className={fieldClass} /></Field>
                <Field label="Admin phone"><Input value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} className={fieldClass} /></Field>
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-4 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className={cn(PRIMARY_CTA, "h-10 px-6")}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Renew ----------------------------------------------------------------------------

export function RenewLicenseDialog({ school, onClose, onRenewed }: { school: SchoolRecord | null; onClose: () => void; onRenewed: () => void }) {
  const [form, setForm] = useState({ endDate: "", extraUsers: 0 });
  const [saving, setSaving] = useState(false);
  const [prevSchool, setPrevSchool] = useState<SchoolRecord | null>(null);
  if (school !== prevSchool) {
    setPrevSchool(school);
    if (school) {
      const lastEnd = school.license?.endDate ? school.license.endDate.split("T")[0] : new Date().toISOString().split("T")[0];
      setForm({ endDate: lastEnd, extraUsers: school.license?.extraUsers || 0 });
    }
  }

  const handleRenew = async () => {
    if (!school) return;
    if (!form.endDate) {
      toast.error("Required", { description: "New end date is required." });
      return;
    }
    setSaving(true);
    try {
      // Same arithmetic and payload as before the redesign.
      const startDate = school.license?.endDate || new Date().toISOString().split("T")[0];
      const diffMs = new Date(form.endDate).getTime() - new Date(startDate).getTime();
      const months = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
      const newExtra = form.extraUsers;
      const pricePerUser = school.license?.pricePerUser || 0;
      const includedUsers = school.license?.includedUsers || 0;
      const totalAmount = months * newExtra * pricePerUser;
      const totalUsers = includedUsers + newExtra;
      await saRequest(`/superadmin/schools/${school._id}`, {
        method: "PUT",
        body: { license: { endDate: form.endDate, extraUsers: newExtra, totalUsers, months, totalAmount, status: "active" } },
      });
      toast.success("License Renewed", { description: `License extended to ${form.endDate}.` });
      onClose();
      onRenewed();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed." });
    } finally {
      setSaving(false);
    }
  };

  const extendsBy =
    school?.license?.endDate && form.endDate
      ? Math.max(0, Math.ceil((new Date(form.endDate).getTime() - new Date(school.license.endDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : null;

  return (
    <Dialog open={!!school} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(dialogShell, "sm:max-w-md")}>
        <DialogHero icon={KeyRound} title="Renew License" description={school?.name} tone="success" />
        {school && (
          <>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-[12.5px] ring-1 ring-border/60">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-right font-semibold">{school.license?.planName || "None"}</span>
                <span className="text-muted-foreground">Current expiry</span>
                <span className="text-right font-semibold">{formatDate(school.license?.endDate)}</span>
              </div>
              <Field label="New expiry date">
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={fieldClass} />
              </Field>
              <Field label={`Extra users (currently ${school.license?.extraUsers || 0})`}>
                <Input inputMode="numeric" pattern="[0-9]*" placeholder="0" value={countInputValue(form.extraUsers)} onChange={(e) => setForm((f) => ({ ...f, extraUsers: parseCountInput(e.target.value) }))} className={fieldClass} />
              </Field>
              <div className="flex items-center justify-between rounded-xl bg-success/[0.07] px-4 py-3 text-[13px] ring-1 ring-success/20">
                <span>
                  Total users <b className="tabular-nums">{(school.license?.includedUsers || 0) + form.extraUsers}</b>
                </span>
                {extendsBy !== null && <span className="text-muted-foreground">Extends by <b className="text-foreground">{extendsBy}</b> month(s)</span>}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-4 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
              <Button onClick={handleRenew} disabled={saving} className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 font-semibold text-white shadow-md shadow-green-600/25 hover:opacity-95">
                {saving ? <Loader2 className="animate-spin" /> : <Calendar />} Renew
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
