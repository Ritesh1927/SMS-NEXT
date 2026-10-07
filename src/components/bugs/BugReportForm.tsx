"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Copy, History, Lightbulb, ListChecks, Loader2, MapPin, RefreshCw, School, Send, User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getToken as getSchoolToken, useAuth } from "@/contexts/AuthContext";
import { getSuperAdminToken, getSuperAdminUser } from "@/lib/superAdminAuth";
import {
  FIELD_LIMITS, ROLE_LABELS, TICKET_CATEGORIES, TICKET_PRIORITIES, categoryLabel, type TicketCategory, type TicketPriority,
} from "@/lib/bugReports/constants";
import {
  collectClientContext, describeRoute, safeReturnPath, ticketFetch, timeAgo, type ClientContext, type UploadedAttachment,
} from "@/lib/bugReports/client";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bugReports/events";
import type { SimilarTicket, TicketConfig } from "@/lib/bugReports/types";
import { AttachmentPicker } from "./AttachmentPicker";
import { InfoGrid, TicketPanel } from "./InfoGrid";

export type ReportTrack = "school" | "superadmin";

/** Where the report page lives for each auth track. */
export const REPORT_PAGE: Record<ReportTrack, string> = {
  school: "/dashboard/report-bug",
  superadmin: "/super-admin/report-bug",
};

const TRACK = {
  school: {
    getToken: getSchoolToken,
    home: "/dashboard",
    myReports: "/dashboard/my-bugs",
    ticketHref: (id: string) => `/dashboard/my-bugs/${id}`,
  },
  superadmin: {
    getToken: getSuperAdminToken,
    home: "/super-admin",
    myReports: "/super-admin/tickets",
    ticketHref: (id: string) => `/super-admin/tickets/${id}`,
  },
} as const;

// Upload limits rarely change; share one fetch for the session.
let configPromise: Promise<TicketConfig> | null = null;
function loadConfig(getToken: () => string | null): Promise<TicketConfig> {
  configPromise ??= ticketFetch<{ data: TicketConfig }>(getToken, "/bug-reports/config")
    .then((r) => r.data)
    .catch((err) => {
      configPromise = null;
      throw err;
    });
  return configPromise;
}

/**
 * Shared look for the single-line controls (title, category, priority) so
 * they line up: same height, border, radius and background. The Select
 * trigger pins its height with data-[size=default]:h-8, which a plain h-11
 * can't override, hence the explicit data-size variant.
 */
const FIELD_CONTROL = "h-11 data-[size=default]:h-11 rounded-xl border border-input bg-card shadow-xs dark:bg-input/30";

const PRIORITY_TONES: Record<TicketPriority, string> = {
  low: "data-[active=true]:bg-muted data-[active=true]:text-foreground data-[active=true]:ring-border",
  medium: "data-[active=true]:bg-info/12 data-[active=true]:text-info data-[active=true]:ring-info/35",
  high: "data-[active=true]:bg-warning/15 data-[active=true]:text-[color-mix(in_oklch,var(--warning),black_30%)] data-[active=true]:ring-warning/40 dark:data-[active=true]:text-warning",
  critical: "data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive data-[active=true]:ring-destructive/35",
};

type FieldErrors = Partial<Record<"title" | "description" | "category" | "attachments", string>>;

/**
 * The Report a Bug form as a full page. `?from=/path` (set by the floating
 * button) is the page the problem happened on -- that, not this page, is
 * what gets recorded as the ticket's URL/module. Must be rendered inside a
 * <Suspense> boundary (useSearchParams).
 */
export function BugReportForm({ track }: { track: ReportTrack }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { getToken, home, myReports, ticketHref } = TRACK[track];
  const fromPath = safeReturnPath(searchParams.get("from"));
  const returnTo = fromPath ?? home;

  const [superAdmin] = useState(() => (track === "superadmin" ? getSuperAdminUser() : null));
  const identity = useMemo(
    () =>
      track === "school"
        ? user && { name: user.name, role: user.role as string, schoolName: user.schoolName }
        : superAdmin && { name: superAdmin.name, role: "superadmin", schoolName: undefined },
    [track, user, superAdmin],
  );

  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [context, setContext] = useState<ClientContext | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ _id: string; ticketNumber: string } | null>(null);
  const [similar, setSimilar] = useState<SimilarTicket[]>([]);
  const [formKey, setFormKey] = useState(0);

  const fetchConfig = useCallback(() => {
    setConfigError(null);
    loadConfig(getToken)
      .then(setConfig)
      .catch((err) => setConfigError(err instanceof Error ? err.message : "Couldn't load the form."));
  }, [getToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only context (UA, screen) can only be read after mount
    setContext(collectClientContext(fromPath ?? undefined));
    fetchConfig();
  }, [fromPath, fetchConfig]);

  // "Has this been solved already?" -- debounced search of solved tickets.
  const similarQuery = !created && title.trim().length >= 4 ? title.trim() : "";
  useEffect(() => {
    if (!similarQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      ticketFetch<{ data: SimilarTicket[] }>(getToken, `/bug-reports/similar?q=${encodeURIComponent(similarQuery)}`, { signal: controller.signal })
        .then((r) => setSimilar(r.data))
        .catch(() => {});
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [similarQuery, getToken]);

  const onAttachmentsChange = useCallback((files: UploadedAttachment[]) => {
    setAttachments(files);
    if (files.length) setErrors((e) => ({ ...e, attachments: undefined }));
  }, []);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setPriority("medium");
    setAttachments([]);
    setErrors({});
    setSubmitError(null);
    setCreated(null);
    setSimilar([]);
    setFormKey((k) => k + 1);
    document.getElementById("bug-title")?.focus();
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (title.trim().length < FIELD_LIMITS.title.min) next.title = `Give the problem a short title (at least ${FIELD_LIMITS.title.min} characters).`;
    if (description.trim().length < FIELD_LIMITS.description.min) next.description = `Describe what happened (at least ${FIELD_LIMITS.description.min} characters).`;
    if (!category) next.category = "Choose a category.";
    if (!attachments.length) next.attachments = "Attach at least one screenshot or screen recording.";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    const firstInvalid = (["title", "category", "description", "attachments"] as const).find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(`bug-${firstInvalid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`bug-${firstInvalid}`)?.focus({ preventScroll: true });
      return;
    }
    setSubmitting(true);
    try {
      const res = await ticketFetch<{ data: { _id: string; ticketNumber: string } }>(getToken, "/bug-reports", {
        method: "POST",
        body: {
          title,
          description,
          category,
          priority,
          // Fresh device snapshot, but always for the page the bug happened on.
          context: collectClientContext(fromPath ?? undefined),
          attachments: attachments.map(({ publicId, kind, name }) => ({ publicId, kind, name })),
        },
      });
      setCreated(res.data);
      window.dispatchEvent(new Event(BUG_REPORTS_CHANGED_EVENT));
      document.getElementById("bug-report-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit your report.");
    } finally {
      setSubmitting(false);
    }
  };

  // The only identity shown to the reporter: their name and school.
  const reportingAs = identity
    ? [
        { label: identity.role === "student" ? "Student name" : identity.role === "teacher" ? "Teacher name" : "Your name", value: identity.name, icon: User },
        { label: "School", value: identity.role === "superadmin" ? "EduNivo (System Administrator)" : identity.schoolName || "—", icon: School },
      ]
    : [];

  if (!identity) {
    return <Skeleton className="h-[520px] w-full rounded-2xl" />;
  }

  if (created) {
    return (
      <SuccessCard
        ticketNumber={created.ticketNumber}
        viewHref={ticketHref(created._id)}
        returnTo={returnTo}
        returnLabel={fromPath ? "Back to where I was" : "Back to dashboard"}
        onAnother={reset}
      />
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} noValidate className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ---- Main column ---- */}
      <div className="min-w-0 space-y-5">
        <FormSection step={1} title="What went wrong?" description="A clear title and a few details help us fix it faster.">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="bug-title">Problem title <Required /></Label>
                <Counter value={title.length} max={FIELD_LIMITS.title.max} />
              </div>
              <Input
                id="bug-title"
                value={title}
                maxLength={FIELD_LIMITS.title.max}
                placeholder="e.g. Attendance doesn't save for Class 5-B"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "bug-title-error" : undefined}
                autoComplete="off"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
                }}
                className={cn(FIELD_CONTROL, "px-3.5 text-[15px] md:text-sm")}
              />
              <FieldError id="bug-title-error" message={errors.title} />
            </div>

            {similarQuery && similar.length > 0 && <SimilarIssues items={similar} />}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bug-category">Category <Required /></Label>
                <Select
                  items={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                  value={category || null}
                  onValueChange={(v) => {
                    setCategory((v || "") as TicketCategory);
                    setErrors((x) => ({ ...x, category: undefined }));
                  }}
                >
                  <SelectTrigger id="bug-category" aria-invalid={Boolean(errors.category)} className={cn(FIELD_CONTROL, "w-full px-3.5 text-[15px] md:text-sm")}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.category} />
              </div>

              <div className="space-y-1.5">
                <Label id="bug-priority-label">Priority</Label>
                <div
                  role="radiogroup"
                  aria-labelledby="bug-priority-label"
                  onKeyDown={(e) => {
                    // Arrow keys move between options, like a native radio group.
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                    e.preventDefault();
                    const values = TICKET_PRIORITIES.map((p) => p.value);
                    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
                    const next = values[(values.indexOf(priority) + step + values.length) % values.length];
                    setPriority(next);
                    (e.currentTarget.querySelector(`[data-value="${next}"]`) as HTMLButtonElement | null)?.focus();
                  }}
                  className={cn(FIELD_CONTROL, "grid grid-cols-4 gap-1 p-1")}
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={priority === p.value}
                      tabIndex={priority === p.value ? 0 : -1}
                      data-value={p.value}
                      data-active={priority === p.value}
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        "min-w-0 rounded-lg px-1 text-[13px] font-semibold text-muted-foreground ring-inset transition-all outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:ring-1",
                        PRIORITY_TONES[p.value],
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="bug-description">Problem description <Required /></Label>
                <Counter value={description.length} max={FIELD_LIMITS.description.max} />
              </div>
              <Textarea
                id="bug-description"
                value={description}
                maxLength={FIELD_LIMITS.description.max}
                rows={7}
                placeholder={"What were you trying to do?\nWhat happened instead?\nSteps to reproduce, if you know them."}
                aria-invalid={Boolean(errors.description)}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors((x) => ({ ...x, description: undefined }));
                }}
                className="min-h-40 rounded-xl text-[15px] md:text-sm"
              />
              <FieldError message={errors.description} />
            </div>
          </div>
        </FormSection>

        <FormSection
          step={2}
          title="Show us the problem"
          description="Add at least one screenshot or screen recording. You can also paste a screenshot with Ctrl+V."
        >
          <div id="bug-attachments" tabIndex={-1} className="outline-none">
            {configError ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-destructive/40 px-4 py-8 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-[13px] text-foreground">{configError}</p>
                <Button type="button" variant="outline" size="sm" onClick={fetchConfig}><RefreshCw /> Try again</Button>
              </div>
            ) : config ? (
              <AttachmentPicker
                getToken={getToken}
                maxImageMB={config.maxImageMB}
                maxVideoMB={config.maxVideoMB}
                onChange={onAttachmentsChange}
                onBusyChange={setUploading}
                disabled={!config.uploadsEnabled || submitting}
                invalid={Boolean(errors.attachments)}
              />
            ) : (
              <Skeleton className="h-36 w-full rounded-2xl" />
            )}
            <div className="mt-1.5"><FieldError message={errors.attachments} /></div>
            {config && !config.uploadsEnabled && (
              <p className="mt-2 text-[12px] text-destructive">File uploads aren&apos;t configured on this server, so reports can&apos;t be sent yet.</p>
            )}
          </div>
        </FormSection>

        <FormSection step={3} title="Where it happened" description="Filled in automatically from the page you came from.">
          <div className="space-y-1.5">
            <Label htmlFor="bug-url">Current page URL <Required /></Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="bug-url"
                value={context?.pageUrl ?? ""}
                readOnly
                aria-readonly
                className="h-11 cursor-default truncate rounded-xl bg-muted/60 pl-9 font-mono text-[12.5px] text-muted-foreground"
              />
            </div>
            {context && (
              <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
                Module <span className="rounded-md bg-secondary px-1.5 py-0.5 font-semibold text-secondary-foreground">{context.module}</span>
                Page <span className="rounded-md bg-secondary px-1.5 py-0.5 font-semibold text-secondary-foreground">{context.pageName}</span>
              </p>
            )}
          </div>
        </FormSection>

        {submitError && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* One row on every screen size: equal halves on phones, apart on wider screens. */}
        <div className="flex items-center gap-2.5 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-xl sm:flex-none sm:border-transparent sm:bg-transparent sm:shadow-none sm:hover:bg-muted"
            onClick={() => router.push(returnTo)}
            disabled={submitting}
          >
            <ArrowLeft className="max-sm:hidden" /> Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={submitting || uploading || !config?.uploadsEnabled}
            className="h-11 flex-1 rounded-xl bg-gradient-to-r from-primary to-accent px-4 font-semibold shadow-lg shadow-primary/30 hover:opacity-95 sm:flex-none sm:px-8"
          >
            {submitting || uploading ? <Loader2 className="animate-spin" /> : <Send />}
            {submitting ? "Submitting…" : uploading ? "Uploading files…" : "Submit report"}
          </Button>
        </div>
      </div>

      {/* ---- Sidebar: right column on desktop; above the form on phones/tablets (order-first). ---- */}
      <aside className="order-first space-y-4 lg:sticky lg:top-2 lg:order-none lg:space-y-5">
        <TicketPanel
          title="Reporting as"
          icon={User}
          action={<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{ROLE_LABELS[identity.role] || identity.role}</span>}
        >
          <InfoGrid items={reportingAs} columns={1} className="grid-cols-2 lg:grid-cols-1" />
        </TicketPanel>

        <TicketPanel title="Tips for a great report" icon={ListChecks}>
          <ul className="space-y-2.5 text-[12.5px] text-muted-foreground">
            {[
              "Say what you expected and what actually happened.",
              "List the steps: what you clicked, in which order.",
              "Include the class, student or date involved, if any.",
              "A screen recording is the fastest way for us to reproduce it.",
            ].map((tip) => (
              <li key={tip} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {tip}
              </li>
            ))}
          </ul>
          <Link href={myReports} className="mt-4 inline-flex text-[12.5px] font-semibold text-primary hover:underline">
            View my previous reports →
          </Link>
        </TicketPanel>
      </aside>
    </form>
  );
}

/**
 * Compact app-style header for phones/tablets: back button, title and a
 * "My reports" shortcut in one row (desktop uses the regular PageHeader).
 * Back goes to the page the report was started from. Uses useSearchParams,
 * so render it inside a <Suspense> boundary.
 */
export function MobileReportHeader({ track, subtitle }: { track: ReportTrack; subtitle: string }) {
  const fromPath = safeReturnPath(useSearchParams().get("from"));
  const { home, myReports } = TRACK[track];
  const target = fromPath ?? home;
  const backLabel = target === home ? "Back to Dashboard" : `Back to ${describeRoute(target.split(/[?#]/)[0]).module}`;

  return (
    <div className="flex items-center gap-3 lg:hidden">
      <Link
        href={target}
        aria-label={backLabel}
        title={backLabel}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border/70 transition active:scale-95 active:bg-muted"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-[19px] leading-tight font-bold text-foreground">Report a Bug</h1>
        <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        href={myReports}
        aria-label="My reports"
        title="My reports"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border/70 transition active:scale-95 active:bg-muted"
      >
        <History className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}

function FormSection({ step, title, description, children }: { step: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(80,72,229,0.18)] ring-1 ring-border/70 sm:p-6 dark:ring-white/10">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-heading text-[13px] font-bold text-white shadow-md shadow-primary/25">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[16px] leading-tight font-bold text-foreground">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const Required = () => <span className="text-destructive" aria-hidden>*</span>;

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn("text-[11px] tabular-nums", value > max * 0.9 ? "text-warning" : "text-muted-foreground")}>
      {value}/{max}
    </span>
  );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-[12px] text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

function SimilarIssues({ items }: { items: SimilarTicket[] }) {
  return (
    <div className="rounded-2xl bg-success/[0.06] p-3.5 ring-1 ring-success/20 animate-in fade-in-0 slide-in-from-top-1">
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
        <Lightbulb className="h-4 w-4 shrink-0 text-success" />
        Similar issues already solved. Check if one of these fixes it.
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((s) => (
          <li key={s._id} className="rounded-xl bg-card/80 px-3 py-2 ring-1 ring-border/60">
            <p className="text-[12.5px] font-semibold text-foreground">{s.title}</p>
            <p className="text-[11px] text-muted-foreground">{categoryLabel(s.category)}{s.resolvedAt ? ` · solved ${timeAgo(s.resolvedAt)}` : ""}</p>
            <p className="mt-1 line-clamp-3 text-[12px] text-foreground/80">{s.resolution}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuccessCard({
  ticketNumber, viewHref, returnTo, returnLabel, onAnother,
}: {
  ticketNumber: string;
  viewHref: string;
  returnTo: string;
  returnLabel: string;
  onAnother: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-card px-5 py-10 text-center shadow-[0_24px_60px_-28px_rgba(80,72,229,0.4)] ring-1 ring-border/70 animate-in fade-in-0 zoom-in-95 sm:px-10 sm:py-12">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success ring-8 ring-success/[0.06]">
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <h2 className="mt-5 font-heading text-xl font-bold text-foreground sm:text-2xl">Thanks! Your report is in.</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted-foreground">
        Our support team has been notified. You&apos;ll get updates in My Reported Bugs and by email as it progresses.
      </p>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(ticketNumber).then(() => toast.success("Ticket number copied"), () => {})}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary/[0.07] px-4 py-2.5 font-mono text-[15px] font-bold tracking-wide text-primary ring-1 ring-primary/20 transition hover:bg-primary/10"
        aria-label={`Copy ticket number ${ticketNumber}`}
      >
        {ticketNumber}
        <Copy className="h-4 w-4 opacity-70" />
      </button>
      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        <Button variant="ghost" size="lg" className="rounded-xl" nativeButton={false} render={<Link href={returnTo} />}>
          <ArrowLeft /> {returnLabel}
        </Button>
        <Button variant="outline" size="lg" className="rounded-xl" onClick={onAnother}>
          Report another
        </Button>
        <Button size="lg" nativeButton={false} className="rounded-xl bg-gradient-to-r from-primary to-accent font-semibold" render={<Link href={viewHref} />}>
          View my report
        </Button>
      </div>
    </section>
  );
}
