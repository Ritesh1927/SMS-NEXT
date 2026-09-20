"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight,
  KeyRound, ArrowLeft, CheckCircle, Loader2, Building2,
  ShieldCheck, Zap, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type MatchedSchool } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import loginImage from "@/assets/login-img.png";

interface SignupFormData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  name: string;
  email: string;
  password: string;
  phone: string;
}

const EMPTY_SIGNUP: SignupFormData = {
  schoolName: "", schoolAddress: "", schoolPhone: "",
  name: "", email: "", password: "", phone: "",
};

const FEATURES = [
  { icon: ShieldCheck, title: "Secure & Reliable", desc: "Your data is safe with us" },
  { icon: Zap, title: "Smart Management", desc: "Simplify and automate school operations" },
  { icon: Users, title: "Better Experience", desc: "Designed for educators, students & parents" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, loginToSchool, isAuthenticated, loading: authLoading } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [signupOpen, setSignupOpen] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [signupForm, setSignupForm] = useState<SignupFormData>(EMPTY_SIGNUP);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotConfirmPw, setForgotConfirmPw] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [matchedSchools, setMatchedSchools] = useState<MatchedSchool[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: false on the SSR pass, flips true client-side to trigger the entrance transition.
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/dashboard");
  }, [authLoading, isAuthenticated, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(identifier, password);
    setLoading(false);
    if (res.success) {
      toast.success("Welcome back!", { description: "Logged in successfully." });
      router.push("/dashboard");
    } else if (res.schools?.length) {
      setMatchedSchools(res.schools);
      setSchoolSelectorOpen(true);
    } else {
      toast.error("Login Failed", { description: res.error || "Invalid email or password." });
    }
  };

  const handleSchoolSelect = async (school: MatchedSchool) => {
    setSchoolSelectorOpen(false);
    setLoading(true);
    const res = await loginToSchool(identifier, password, school.role, school.schoolId);
    setLoading(false);
    if (res.success) {
      toast.success("Welcome back!", { description: `Logged in to ${school.schoolName}` });
      router.push("/dashboard");
    } else {
      toast.error("Login Failed", { description: res.error || "Login failed." });
    }
  };

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    try {
      await apiPost("/auth/signup", signupForm);
      setSignupEmail(signupForm.email);
      setSignupStep(2);
      toast.success("Check your email", { description: "An OTP has been sent to your email." });
    } catch (err) {
      toast.error("Signup Failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleOtpVerify = async (e: FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    try {
      await apiPost("/auth/verify-signup-otp", { email: signupEmail, otp });
      toast.success("School Registered!", { description: "You can now login with your credentials." });
      setSignupOpen(false);
      setSignupStep(1);
      setOtp("");
      setSignupForm(EMPTY_SIGNUP);
    } catch (err) {
      toast.error("Invalid OTP", { description: err instanceof Error ? err.message : "Please check and try again." });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: forgotEmail });
      setForgotStep(2);
      toast.success("OTP Sent", { description: "Check your email for the reset code." });
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Email not found." });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await apiPost("/auth/verify-reset-otp", { email: forgotEmail, otp: forgotOtp });
      setForgotStep(3);
    } catch (err) {
      toast.error("Invalid OTP", { description: err instanceof Error ? err.message : "Invalid or expired OTP." });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (forgotNewPw.length < 6) {
      toast.error("Error", { description: "Password must be at least 6 characters." });
      return;
    }
    if (forgotNewPw !== forgotConfirmPw) {
      toast.error("Error", { description: "Passwords do not match." });
      return;
    }
    setForgotLoading(true);
    try {
      await apiPost("/auth/reset-password", { email: forgotEmail, otp: forgotOtp, newPassword: forgotNewPw });
      toast.success("Password Reset!", { description: "You can now login with your new password." });
      setForgotOpen(false);
      resetForgot();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Invalid or expired OTP." });
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgot = () => {
    setForgotStep(1);
    setForgotEmail("");
    setForgotOtp("");
    setForgotNewPw("");
    setForgotConfirmPw("");
    setShowForgotPw(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row md:h-screen md:overflow-hidden overflow-x-hidden bg-muted/50">
      {/* ═══ LEFT: Form Panel ═══ */}
      <div
        className="relative w-full md:w-[54%] lg:w-[55%] flex items-center justify-center overflow-hidden px-4 py-8 sm:px-8 sm:py-10 md:px-8 md:py-6 lg:px-14 lg:py-6 xl:px-16"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateX(0)" : "translateX(-20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-accent/[0.06] blur-3xl" />

        <div className="relative w-full max-w-[440px] bg-card border border-border rounded-[22px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-24px_rgba(37,99,235,0.16)] px-6 py-6 sm:px-8 sm:py-7 lg:px-9 lg:py-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-xl font-bold text-foreground tracking-tight leading-none">EduNivo</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">School Management System</p>
              </div>
            </div>
          </div>

          <h1 className="text-[26px] sm:text-[28px] font-bold text-foreground mb-1.5">Welcome back!</h1>
          <p className="text-sm text-muted-foreground mb-5">Login to your account and continue your journey</p>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="login-identifier" className="text-xs font-semibold text-foreground">
                Email or Student ID
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-identifier"
                  type="text"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-11 h-[52px] rounded-[14px] border-border bg-card text-foreground placeholder:text-muted-foreground hover:border-border focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:border-primary transition-all duration-200"
                  required
                  maxLength={255}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 h-[52px] rounded-[14px] border-border bg-card text-foreground placeholder:text-muted-foreground hover:border-border focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:border-primary transition-all duration-200"
                  required
                  maxLength={100}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSignupOpen(true)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                Register school
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  resetForgot();
                }}
                className="text-sm font-medium text-primary hover:text-accent transition-colors duration-200 hover:underline underline-offset-4"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-[54px] rounded-[14px] font-semibold text-sm bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)] hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.5)] hover:-translate-y-px transition-all duration-200 active:translate-y-0 active:scale-[0.99] disabled:opacity-60"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Login <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* ═══ RIGHT: Visual Panel ═══ */}
      <div
        className="w-full md:w-[46%] lg:w-[45%] md:h-full relative overflow-hidden flex flex-col justify-between px-6 py-8 sm:px-8 md:px-8 md:py-6 lg:px-12 lg:py-8 bg-gradient-to-br from-primary/90 via-primary/90 to-accent/90 text-white"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateX(0)" : "translateX(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}
      >
        {/* ── Premium layered background ── */}
        <div className="pointer-events-none absolute inset-0">
          {/* fine dot-grid texture, faded toward the edges */}
          <div
            className="absolute inset-0 bg-dot-grid opacity-[0.14]"
            style={{
              maskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, black 0%, transparent 85%)",
              WebkitMaskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, black 0%, transparent 85%)",
            }}
          />
          {/* film-grain for depth */}
          <div className="absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />

          {/* breathing gradient orbs */}
          <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-blue-400/25 blur-3xl animate-orb-breathe" />
          <div
            className="absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-violet-500/30 blur-3xl animate-orb-breathe"
            style={{ animationDelay: "3s" }}
          />
          <div
            className="absolute top-1/3 left-1/2 w-72 h-72 -translate-x-1/2 rounded-full bg-fuchsia-400/15 blur-3xl animate-orb-breathe hidden sm:block"
            style={{ animationDelay: "6s" }}
          />

          {/* diagonal light sheen sweep */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-sheen-sweep" />
          </div>

          {/* top sheen + bottom vignette to ground content */}
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#241a5e]/50 to-transparent" />

          {/* hairline inner border for a premium framed edge */}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
        </div>

        <div className="relative z-10 shrink-0">
          <h2 className="text-2xl sm:text-2xl lg:text-[28px] font-semibold leading-tight tracking-tight">
            Empowering <span className="font-extrabold">Schools.</span>
            <br />
            Building <span className="font-extrabold">Futures.</span>
          </h2>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="h-1.5 w-8 rounded-full bg-white/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
          <p className="mt-2.5 text-sm text-white/70 max-w-xs leading-relaxed">
            A complete solution to manage students, teachers, classes and more — all in one place.
          </p>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 py-5 sm:py-6 lg:py-8">
          <div className="relative w-full max-w-[400px] animate-float-soft">
            <div className="pointer-events-none absolute inset-[6%] rounded-full bg-white/10 blur-3xl" />
            <Image
              src={loginImage}
              alt="Students learning together with books"
              sizes="(max-width: 767px) 68vw, (max-width: 1279px) 30vw, 400px"
              className="relative h-auto w-full drop-shadow-[0_30px_50px_rgba(15,10,50,0.45)] transition-transform duration-500 ease-out hover:scale-[1.03]"
              priority
            />
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-2 sm:p-2.5">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-white/15 flex items-center justify-center mb-1 sm:mb-1.5">
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold leading-tight">{title}</p>
              <p className="hidden sm:block text-[10px] text-white/60 leading-snug mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Forgot Password Dialog ═══ */}
      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (!open) resetForgot();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
              {forgotStep === 1 && (
                <>
                  <KeyRound className="h-5 w-5 text-primary" /> Forgot Password
                </>
              )}
              {forgotStep === 2 && (
                <>
                  <Mail className="h-5 w-5 text-primary" /> Enter OTP
                </>
              )}
              {forgotStep === 3 && (
                <>
                  <Lock className="h-5 w-5 text-primary" /> New Password
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {forgotStep === 1 && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Enter your registered email and we&apos;ll send a reset code.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="admin@school.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                    required
                    maxLength={255}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white transition-all duration-300"
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...
                  </>
                ) : (
                  "Send Reset Code"
                )}
              </Button>
            </form>
          )}

          {forgotStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{forgotEmail}</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">OTP Code</label>
                <Input
                  placeholder="000000"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center text-xl tracking-[0.3em] h-12 rounded-xl font-mono focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white transition-all duration-300"
                disabled={forgotLoading || forgotOtp.length < 6}
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setForgotStep(1)}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to email
              </button>
            </form>
          )}

          {forgotStep === 3 && (
            <form onSubmit={handleResetSubmit} className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Enter your new password below.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showForgotPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={forgotNewPw}
                    onChange={(e) => setForgotNewPw(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                    required
                    minLength={6}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotPw(!showForgotPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showForgotPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showForgotPw ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={forgotConfirmPw}
                    onChange={(e) => setForgotConfirmPw(e.target.value)}
                    className="pl-10 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                    required
                    minLength={6}
                    maxLength={100}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white transition-all duration-300"
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Resetting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" /> Reset Password
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setForgotStep(2)}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Signup Dialog ═══ */}
      <Dialog
        open={signupOpen}
        onOpenChange={(open) => {
          setSignupOpen(open);
          if (!open) {
            setSignupStep(1);
            setOtp("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">
              {signupStep === 1 ? "Register Your School" : "Verify Email"}
            </DialogTitle>
          </DialogHeader>

          {signupStep === 1 ? (
            <form onSubmit={handleSignupSubmit} className="mt-2">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">School Information</p>
                  {(
                    [
                      { label: "School Name", placeholder: "e.g. Lincoln Academy", key: "schoolName" },
                      { label: "School Address", placeholder: "Full address", key: "schoolAddress" },
                      { label: "School Phone", placeholder: "+91 98765 43210", key: "schoolPhone" },
                    ] as const
                  ).map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{f.label}</label>
                      <Input
                        placeholder={f.placeholder}
                        value={signupForm[f.key]}
                        onChange={(e) => setSignupForm((fr) => ({ ...fr, [f.key]: e.target.value }))}
                        required
                        maxLength={100}
                        className="rounded-xl h-10 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Account</p>
                  {(
                    [
                      { label: "Your Name", placeholder: "Full name", key: "name" as const },
                      { label: "Email", placeholder: "admin@school.com", key: "email" as const, type: "email" },
                      { label: "Password", placeholder: "Min. 6 characters", key: "password" as const, type: "password", min: 6 },
                      { label: "Phone", placeholder: "+91 98765 43210", key: "phone" as const },
                    ]
                  ).map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">{f.label}</label>
                      <div className="relative">
                        <Input
                          type={f.key === "password" ? (showSignupPassword ? "text" : "password") : f.type || "text"}
                          placeholder={f.placeholder}
                          value={signupForm[f.key]}
                          onChange={(e) => setSignupForm((fr) => ({ ...fr, [f.key]: e.target.value }))}
                          required
                          maxLength={f.key === "password" ? 100 : 255}
                          minLength={f.min}
                          className={`rounded-xl h-10 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary ${f.key === "password" ? "pr-10" : ""}`}
                        />
                        {f.key === "password" && (
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword((v) => !v)}
                            aria-label={showSignupPassword ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
                          >
                            {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white mt-5 transition-all duration-300"
                disabled={signupLoading}
              >
                {signupLoading ? "Registering..." : "Register School"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpVerify} className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                We sent a verification code to <span className="font-medium text-foreground">{signupEmail}</span>.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">OTP Code</label>
                <Input
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center text-xl tracking-[0.3em] h-12 rounded-xl font-mono focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white transition-all duration-300"
                disabled={signupLoading}
              >
                {signupLoading ? "Verifying..." : "Verify & Activate"}
              </Button>
              <button
                type="button"
                onClick={() => setSignupStep(1)}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to registration
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ School Selector Dialog ═══ */}
      <Dialog open={schoolSelectorOpen} onOpenChange={setSchoolSelectorOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
              <Building2 className="h-5 w-5 text-primary" /> Select School
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">Your credentials match multiple schools. Choose one to continue:</p>
          <div className="space-y-2 mt-3">
            {matchedSchools.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSchoolSelect(s)}
                className="w-full rounded-xl p-4 border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <p className="text-sm font-semibold text-foreground">{s.schoolName}</p>
                <p className="text-xs text-muted-foreground">
                  {s.role}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
