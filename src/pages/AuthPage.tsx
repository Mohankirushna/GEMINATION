import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Building2,
  UserCircle,
  ArrowRight,
  Chrome,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types";
import GlassCard from "../components/GlassCard";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, setDemoRole, isConfigured } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("end_user");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          setError("Please enter your full name.");
          setLoading(false);
          return;
        }
        await signUp(email, password, displayName, role);
      }
      // Navigate based on selected role
      setTimeout(() => {
        navigate(role === "financial_institution" ? "/bank" : "/user");
      }, 100);
    } catch (err: any) {
      const msg = err?.message ?? "Authentication failed";
      // Map Firebase errors to friendly messages
      if (msg.includes("Firebase not configured")) {
        // Should not happen anymore, but handle gracefully
        setError("Service temporarily unavailable. Please use Demo Access below.");
      } else if (msg.includes("auth/email-already-in-use"))
        setError("This email is already registered. Try logging in.");
      else if (msg.includes("auth/invalid-credential"))
        setError("Invalid email or password.");
      else if (msg.includes("auth/weak-password"))
        setError("Password must be at least 6 characters.");
      else if (msg.includes("auth/invalid-email"))
        setError("Please enter a valid email address.");
      else if (msg.includes("auth/user-not-found"))
        setError("No account found with this email.");
      else if (msg.includes("auth/too-many-requests"))
        setError("Too many attempts. Please try again later.");
      else setError(msg);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle(role);
      navigate(role === "financial_institution" ? "/bank" : "/user");
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed");
    }
    setLoading(false);
  };

  const handleDemoLogin = (demoRole: UserRole) => {
    setDemoRole(demoRole);
    navigate(demoRole === "financial_institution" ? "/bank" : "/user");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-radial bg-grid relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-amber-500/8 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Shield className="h-8 w-8 text-[#0a0e1a]" />
              </div>
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#0a0e1a] pulse-dot" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">SurakshaFlow</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {mode === "login"
              ? "Sign in to your intelligence dashboard"
              : "Create your secure account"}
          </p>
        </div>

        {/* Auth Card */}
        <GlassCard hover={false} className="p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-all",
                mode === "login"
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-all",
                mode === "signup"
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/15 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="auth-input pl-10"
                    required={mode === "signup"}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input pl-10 pr-10"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("end_user")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    role === "end_user"
                      ? "border-emerald-500/30 bg-emerald-500/8"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
                  )}
                >
                  <UserCircle
                    className={cn(
                      "h-5 w-5 mb-1.5",
                      role === "end_user"
                        ? "text-emerald-400"
                        : "text-slate-500",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      role === "end_user"
                        ? "text-emerald-300"
                        : "text-slate-400",
                    )}
                  >
                    End User
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("financial_institution")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    role === "financial_institution"
                      ? "border-cyan-500/30 bg-cyan-500/8"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
                  )}
                >
                  <Building2
                    className={cn(
                      "h-5 w-5 mb-1.5",
                      role === "financial_institution"
                        ? "text-cyan-400"
                        : "text-slate-500",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      role === "financial_institution"
                        ? "text-cyan-300"
                        : "text-slate-400",
                    )}
                  >
                    Institution
                  </span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          {isConfigured && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Google Sign In */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="btn-ghost w-full flex items-center justify-center gap-2.5 py-2.5 disabled:opacity-50"
              >
                <Chrome className="h-4 w-4 text-slate-400" />
                <span className="text-sm">Continue with Google</span>
              </button>
            </>
          )}
        </GlassCard>

        {/* Demo Access */}
        <GlassCard hover={false} className="p-4">
          <p className="text-[11px] text-slate-500 text-center mb-3">
            Quick demo access — no account needed
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoLogin("financial_institution")}
              className="btn-ghost text-xs py-2.5 flex items-center justify-center gap-2 hover:border-cyan-500/20 hover:text-cyan-400"
            >
              <Building2 className="h-3.5 w-3.5" />
              Bank Demo
            </button>
            <button
              onClick={() => handleDemoLogin("end_user")}
              className="btn-ghost text-xs py-2.5 flex items-center justify-center gap-2 hover:border-emerald-500/20 hover:text-emerald-400"
            >
              <UserCircle className="h-3.5 w-3.5" />
              User Demo
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
