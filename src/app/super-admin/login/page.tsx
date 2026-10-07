"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BarChart3, CheckCircle, GraduationCap, LifeBuoy, Loader2, Lock, Mail, School, ShieldCheck, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/api";
import { setSuperAdminAuth, type SuperAdminUser } from "@/lib/superAdminAuth";

interface VerifyOtpResponse {
  token: string;
  user: SuperAdminUser;
}

const inputClass =
  "h-12 rounded-xl border-white/10 bg-white/[0.06] pl-10 text-white placeholder:text-white/35 focus-visible:border-primary focus-visible:ring-primary/30 dark:bg-white/[0.06]";
const labelClass = "text-[11.5px] font-semibold tracking-wider text-white/60 uppercase";

// Super Admin sign-in: email + password, then a one-time code (same two
// requests as before -- /superadmin/login then /superadmin/verify-otp).
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/superadmin/login", { email, password });
      setStep(2);
      toast.success("OTP Sent", { description: "Check your email for the verification code." });
    } catch (err) {
      toast.error("Login Failed", { description: err instanceof Error ? err.message : "Login failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost<VerifyOtpResponse>("/superadmin/verify-otp", { email, otp });
      setSuperAdminAuth(res.token, res.user);
      toast.success("Welcome!", { description: "Logged in as Super Admin." });
      router.push("/super-admin");
    } catch (err) {
      toast.error("Verification Failed", { description: err instanceof Error ? err.message : "OTP verification failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#0b1020] text-white lg:grid-cols-[1.1fr_1fr]">
      {/* Ambient light */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-primary/30 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[520px] w-[520px] rounded-full bg-accent/25 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)] [background-size:32px_32px]" />

      {/* Brand panel (desktop) */}
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <p className="font-heading text-xl font-bold tracking-tight">EduNivo</p>
            <p className="text-[12px] text-white/50">Super Admin Console</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="font-heading text-4xl leading-tight font-bold tracking-tight">
            Run every school on the platform from one place.
          </h2>
          <ul className="mt-8 space-y-4 text-[14px] text-white/75">
            {[
              { icon: School, text: "Register schools, manage plans and renew licenses" },
              { icon: BarChart3, text: "Platform-wide KPIs, trends and license health" },
              { icon: LifeBuoy, text: "Bug reports and tickets from every role" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-[12px] text-white/40">
          <ShieldCheck className="h-4 w-4" /> Two-step verification protects every sign-in.
        </p>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <p className="font-heading text-2xl font-bold tracking-tight">EduNivo</p>
              <p className="-mt-0.5 text-[11px] text-white/50">Super Admin Console</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] p-7 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:p-9">
            {/* Step indicator */}
            <ol className="mb-7 flex items-center gap-2 text-[12px] font-semibold" aria-label="Sign-in steps">
              {["Credentials", "Verification"].map((label, i) => {
                const n = (i + 1) as 1 | 2;
                const done = step > n;
                const current = step === n;
                return (
                  <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px]", done ? "bg-success text-white" : current ? "bg-primary text-white" : "bg-white/10 text-white/50")}>
                      {done ? <CheckCircle className="h-3.5 w-3.5" /> : n}
                    </span>
                    <span className={current ? "text-white" : "text-white/50"}>{label}</span>
                    {i === 0 && <span className={cn("h-px flex-1", step > 1 ? "bg-success/60" : "bg-white/15")} aria-hidden />}
                  </li>
                );
              })}
            </ol>

            {step === 1 ? (
              <div className="animate-in duration-300 fade-in-0 slide-in-from-right-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="mt-1 mb-7 text-[14px] text-white/55">Sign in to the Super Admin console.</p>
                <form onSubmit={handleStep1} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="sa-email" className={labelClass}>Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <Input id="sa-email" type="email" autoComplete="email" placeholder="superadmin@edunivo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="sa-password" className={labelClass}>Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <Input
                        id="sa-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={cn(inputClass, "pr-11")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-[14px] font-semibold text-white shadow-lg shadow-primary/30 hover:opacity-95">
                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    {loading ? "Verifying..." : "Continue"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="animate-in duration-300 fade-in-0 slide-in-from-right-2">
                <button type="button" onClick={() => setStep(1)} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/85">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="font-heading text-2xl font-bold tracking-tight">Verify it&apos;s you</h1>
                <p className="mt-1 mb-7 text-[14px] text-white/55">
                  Enter the 6-digit code sent to <span className="font-medium text-white/85">{email}</span>
                </p>
                <form onSubmit={handleStep2} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="sa-otp" className={labelClass}>Verification code</label>
                    <Input
                      id="sa-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className={cn(inputClass, "h-14 pl-3 text-center font-mono text-2xl tracking-[0.5em]")}
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-[14px] font-semibold text-white shadow-lg shadow-primary/30 hover:opacity-95">
                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[12px] text-white/35">Service Provider Access.</p>
        </div>
      </section>
    </div>
  );
}
