"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { setSuperAdminAuth, type SuperAdminUser } from "@/lib/superAdminAuth";

interface VerifyOtpResponse {
  token: string;
  user: SuperAdminUser;
}

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
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white tracking-tight">EduNivo</span>
            <p className="text-[11px] text-white/50 -mt-0.5">Super Admin Panel</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">
          {step === 1 ? (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Super Admin Login</h1>
              <p className="text-sm text-white/50 mb-6">Enter your credentials to continue</p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      type="email"
                      placeholder="superadmin@edunivo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/20"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white shadow-lg shadow-primary/20 transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  {loading ? "Verifying..." : "Continue"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setStep(1)} className="text-white/40 hover:text-white/80 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-white">Verify OTP</h1>
              </div>
              <p className="text-sm text-white/50 mb-6">
                Enter the 6-digit code sent to <span className="text-white/70">{email}</span>
              </p>
              <form onSubmit={handleStep2} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">OTP Code</label>
                  <div className="relative">
                    <CheckCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pl-10 h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/20 tracking-[8px] text-center text-lg"
                      maxLength={6}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 border-0 text-white shadow-lg shadow-primary/20 transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6">Service Provider Access.</p>
      </div>
    </div>
  );
}
