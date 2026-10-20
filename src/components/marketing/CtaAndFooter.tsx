"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight, Building2, CheckCircle2, ChevronDown, Clock, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, User, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND, FOOTER_COLUMNS } from "./content";
import { Reveal } from "./motion";
import { Logo } from "./SiteHeader";

const STUDENT_RANGES = ["Under 300", "300 – 1,000", "1,000 – 3,000", "3,000+"] as const;

type DemoForm = { schoolName: string; contactPerson: string; phone: string; email: string; city: string; students: string; website: string };
const EMPTY: DemoForm = { schoolName: "", contactPerson: "", phone: "", email: "", city: "", students: "", website: "" };

async function postLead(body: Record<string, string>) {
  const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Something went wrong. Please try again.");
}

function validate(f: DemoForm): Partial<Record<keyof DemoForm, string>> {
  const e: Partial<Record<keyof DemoForm, string>> = {};
  if (f.schoolName.trim().length < 2) e.schoolName = "Please enter your school name.";
  if (f.contactPerson.trim().length < 2) e.contactPerson = "Please enter your name.";
  if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(f.phone.trim())) e.phone = "Enter a valid 10-digit mobile number.";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.city.trim().length < 2) e.city = "Please enter your city.";
  if (!f.students) e.students = "Choose the number of students.";
  return e;
}

/** Full-width gradient CTA with the demo request form. */
export function DemoCta() {
  const [form, setForm] = useState<DemoForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof DemoForm, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (k: keyof DemoForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const found = validate(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`demo-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      await postLead({ kind: "demo", ...form });
      setStatus("sent");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  return (
    <section id="contact" className="relative scroll-mt-16 overflow-hidden bg-[linear-gradient(135deg,#2E2A8F_0%,var(--primary)_40%,var(--accent)_100%)] py-24 text-white sm:py-28">
      <span id="pricing" className="absolute -top-16" aria-hidden />
      {/* Decoration */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-accent/35 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [mask-image:linear-gradient(180deg,black,transparent)] [background-size:24px_24px]" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 min-[400px]:px-5 sm:px-8 lg:grid-cols-[1fr_1.15fr]">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/25 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Free, no-obligation demo
          </span>
          <h2 className="mt-5 font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight sm:text-[46px]">Ready to Digitize Your School?</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/85">
            Book a free personalized demo and discover how {BRAND.name} can simplify your school&apos;s operations. We&apos;ll also share
            transparent pricing tailored to your school&apos;s size.
          </p>
          <ul className="mt-8 space-y-3.5 text-[15px] text-white/90">
            {[
              { icon: Clock, text: "30-minute live walkthrough with an expert" },
              { icon: ShieldCheck, text: "Your data stays private, no spam, ever" },
              { icon: Users, text: "Setup, data import & training included" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[26px] bg-white p-5 text-foreground min-[400px]:p-6 shadow-[0_40px_80px_-30px_rgba(22,18,80,0.6)] ring-1 ring-white/50 sm:p-8">
            {status === "sent" ? (
              <div className="flex flex-col items-center py-10 text-center animate-in fade-in-0 zoom-in-95">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success ring-8 ring-success/[0.06]">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h3 className="mt-5 font-heading text-[22px] font-bold">Thank you, {form.contactPerson.split(" ")[0]}!</h3>
                <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
                  Your demo request for <b className="text-foreground">{form.schoolName}</b> is in. Our team will call you within one working day.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h3 className="font-heading text-[20px] font-bold">Request a free demo</h3>
                <p className="mt-1 text-[14px] text-muted-foreground">Takes less than a minute.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field id="demo-schoolName" label="School name" icon={Building2} error={errors.schoolName}>
                    <input id="demo-schoolName" value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} autoComplete="organization" placeholder="e.g. Sunrise Public School" />
                  </Field>
                  <Field id="demo-contactPerson" label="Contact person" icon={User} error={errors.contactPerson}>
                    <input id="demo-contactPerson" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} autoComplete="name" placeholder="Your full name" />
                  </Field>
                  <Field id="demo-phone" label="Mobile number" icon={Phone} error={errors.phone}>
                    <input id="demo-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 15))} autoComplete="tel" placeholder="98765 43210" />
                  </Field>
                  <Field id="demo-email" label="Email" icon={Mail} error={errors.email}>
                    <input id="demo-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="you@school.edu.in" />
                  </Field>
                  <Field id="demo-city" label="City" icon={MapPin} error={errors.city}>
                    <input id="demo-city" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" placeholder="e.g. Pune" />
                  </Field>
                  <Field id="demo-students" label="Number of students" icon={Users} error={errors.students} select>
                    <select id="demo-students" value={form.students} onChange={(e) => set("students", e.target.value)}>
                      <option value="" disabled>Select a range</option>
                      {STUDENT_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  {/* Honeypot: hidden from people, filled by bots. */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} className="hidden" aria-hidden />
                </div>
                {serverError && <p role="alert" className="mt-4 rounded-xl bg-destructive/8 px-4 py-3 text-[14px] text-destructive ring-1 ring-destructive/50">{serverError}</p>}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="group/btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,var(--primary),var(--accent)_45%,var(--primary))] bg-[length:200%_100%] px-6 py-4 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-10px_rgba(80,72,229,0.7)] transition-all duration-500 hover:bg-[position:100%_0] disabled:opacity-70"
                >
                  {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
                  {status === "sending" ? "Sending…" : "Request Free Demo"}
                  {status !== "sending" && <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover/btn:translate-x-0.5" />}
                </button>
                <p className="mt-3 text-center text-[12px] text-muted-foreground">By submitting, you agree to be contacted about {BRAND.name}.</p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({ id, label, icon: Icon, error, children, select }: { id: string; label: string; icon: typeof User; error?: string; children: ReactNode; select?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/80">
        {label} <span className="text-destructive" aria-hidden>*</span>
      </label>
      <div
        className={cn(
          "relative flex items-center rounded-xl bg-[#F8F8FE] ring-1 transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-primary",
          error ? "ring-destructive" : "ring-foreground/10",
          "[&_input]:h-12 [&_input]:w-full [&_input]:bg-transparent [&_input]:pr-3 [&_input]:pl-10 [&_input]:text-[15px] [&_input]:text-foreground [&_input]:outline-none [&_input]:placeholder:text-muted-foreground/70",
          "[&_select]:h-12 [&_select]:w-full [&_select]:cursor-pointer [&_select]:appearance-none [&_select]:bg-transparent [&_select]:pr-9 [&_select]:pl-10 [&_select]:text-[15px] [&_select]:text-foreground [&_select]:outline-none",
        )}
        aria-invalid={!!error}
      >
        <Icon className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-muted-foreground/70" />
        {children}
        {select && <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground/70" />}
      </div>
      {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}

// ---- Footer ---------------------------------------------------------------

const SOCIALS: { label: string; href: string; path: string }[] = [
  { label: "Facebook", href: "#", path: "M14 9h3V5.5h-3c-2.5 0-4 1.6-4 4V12H7.5v3.5H10V22h3.5v-6.5H16l.5-3.5h-3V9.8c0-.5.3-.8.5-.8Z" },
  { label: "Instagram", href: "#", path: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM17 6.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" },
  { label: "LinkedIn", href: "#", path: "M5 8.5h3V19H5V8.5Zm1.5-4.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM10 8.5h2.9v1.5c.5-.9 1.6-1.8 3.3-1.8 3.4 0 3.8 2.2 3.8 5V19h-3v-5c0-1.2 0-2.7-1.7-2.7S13 12.6 13 13.9V19h-3V8.5Z" },
  { label: "YouTube", href: "#", path: "M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" },
  { label: "X", href: "#", path: "M17.5 3h3l-6.6 7.6L21.6 21h-6l-4.7-6.1L5.5 21h-3l7-8.1L2.4 3h6.1l4.3 5.6L17.5 3Zm-1 16.2h1.7L7.6 4.7H5.8l10.7 14.5Z" },
];

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setState("sending");
    try {
      await postLead({ kind: "newsletter", email });
      setState("done");
      setMessage("You're subscribed. Thank you!");
      setEmail("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Couldn't subscribe.");
    }
  };

  return (
    <footer className="relative overflow-hidden bg-[#11182C] text-white">
      <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-primary/30 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 pt-16 pb-8 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-white/65">
              The smart, all-in-one ERP that helps Indian schools run admissions, academics, fees and communication from one place.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-white/75">
              <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-accent" /> <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="hover:text-white">{BRAND.phone}</a></li>
              <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-accent" /> <a href={`mailto:${BRAND.email}`} className="hover:text-white">{BRAND.email}</a></li>
              <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-accent" /> {BRAND.address}</li>
            </ul>
            <ul className="mt-6 flex gap-2.5" aria-label="Social media">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} aria-label={s.label} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] text-white/75 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-white">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden><path d={s.path} /></svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="font-heading text-[14px] font-bold tracking-wide text-white">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") ? (
                        <Link href={l.href} className="text-[14px] text-white/60 transition-colors hover:text-white">{l.label}</Link>
                      ) : (
                        <a href={l.href} className="text-[14px] text-white/60 transition-colors hover:text-white">{l.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-14 flex flex-col gap-5 rounded-[22px] bg-white/[0.05] p-6 ring-1 ring-white/10 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-heading text-[18px] font-bold">Stay in the loop</p>
            <p className="mt-1 text-[14px] text-white/60">Product updates and tips for school leaders. Once a month, no spam.</p>
          </div>
          <form onSubmit={subscribe} noValidate className="w-full md:max-w-md">
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input
                id="newsletter-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state === "error") setState("idle");
                }}
                placeholder="you@school.edu.in"
                className="h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 text-[15px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-primary"
              />
              <button type="submit" disabled={state === "sending"} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 text-[14.5px] font-bold text-white shadow-lg shadow-primary/30 transition hover:opacity-90 disabled:opacity-70">
                {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
              </button>
            </div>
            {message && state !== "idle" && state !== "sending" && (
              <p role="status" className={cn("mt-2 text-[13px]", state === "done" ? "text-[#4ADE80]" : "text-destructive/40")}>{message}</p>
            )}
          </form>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <p className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#4ADE80]" /> Secure, cloud-hosted school management</p>
        </div>
      </div>
    </footer>
  );
}
