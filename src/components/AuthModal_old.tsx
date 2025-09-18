// src/components/AuthModal.tsx
import { useEffect, useState } from "react";
import api, { authStorage, normalizeApiError } from "../lib/api";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  startTab?: "login" | "register" | "forgot";
};

type View =
  | { tab: "login" }
  | { tab: "register"; step: 1 | 2 } // 1=details, 2=otp
  | { tab: "forgot"; step: 1 | 2 | 3 }; // 1=email, 2=otp, 3=new password

export default function AuthModal({ open, onClose, startTab = "login" }: Props) {
  const [view, setView] = useState<View>(
    ({ tab: startTab, ...(startTab === "register" ? { step: 1 } : startTab === "forgot" ? { step: 1 } : {}) } as View)
  );

  // shared fields
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const navigate = useNavigate();

  // register fields
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"JobSeeker" | "Recruiter">("JobSeeker");
  const [gdpr, setGdpr] = useState(false);

  // reset everything when opened / tab changes
  useEffect(() => {
    if (!open) return;
    setView(({ tab: startTab, ...(startTab === "register" ? { step: 1 } : startTab === "forgot" ? { step: 1 } : {}) } as View));
    setEmail(""); setFullName(""); setPassword(""); setOtp("");
    setPhone(""); setRole("JobSeeker"); setGdpr(false);
    setErr(null); setLoading(false);
  }, [open, startTab]);

  // close on Esc
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape" && !loading) onClose(); }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose, loading]);

  if (!open) return null;

  /* -------------------- handlers -------------------- */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setLoading(true);

    try {
      const body = { email: email.trim().toLowerCase(), password: password.trim() };
      const { data } = await api.post("/api/auth/login", body);

      // token
      const token = data?.token || data?.Token || data?.accessToken;
      if (token) authStorage.setToken(token);

      // save basic user for navbar etc.
      const u = {
        userId: data?.userId ?? data?.user?.userId,
        fullName: data?.fullName ?? data?.user?.fullName,
        role: data?.role ?? data?.user?.role,
      };
      localStorage.setItem("jobsetu_user", JSON.stringify(u));

      // route by role + profile existence
      if (u?.role === "Recruiter") {
        try {
          const r = await api.get("/api/recruiter/profile/exists", { suppressUnauthorized: true });
          const exists = !!r?.data?.exists;
          onClose();
          navigate(exists ? "/recruiter/profile" : "/onboarding/recruiter", { replace: true });
          return;
        } catch { /* ignore and fall back */ }
      } else {
        try {
          const r = await api.get("/api/user/profile/exists", { suppressUnauthorized: true });
          const exists = !!r?.data?.exists;
          onClose();
          navigate(exists ? "/profile" : "/onboarding/seeker", { replace: true });
          return;
        } catch { /* ignore and fall back */ }
      }

      // fallback
      onClose();
      window.location.reload();
    } catch (e) {
      setErr(normalizeApiError(e).message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    try {
      await api.post("/api/auth/register", {
        FullName: fullName.trim(),
        Email: email.trim().toLowerCase(),
        Phone: phone.trim(),
        Password: password.trim(),
        Role: role,                 // "JobSeeker" | "Recruiter"
        IsGdprAccepted: gdpr
      });
      setView({ tab: "register", step: 2 }); // go to OTP input
    } catch (e) {
      setErr(normalizeApiError(e).message || "Registration failed");
    } finally { setLoading(false); }
  }

  async function handleRegisterOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    try {
      // PascalCase keys to match server DTOs cleanly (binder is case-insensitive, but this is clearer)
      await api.post("/api/auth/verify-otp", { Email: email.trim().toLowerCase(), OTP: otp.trim() });
      // move to login tab after successful verification
      setView({ tab: "login" });
    } catch (e) {
      setErr(normalizeApiError(e).message || "OTP verification failed");
    } finally { setLoading(false); }
  }

  async function handleForgotStart(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      setView({ tab: "forgot", step: 2 });
    } catch (e) {
      setErr(normalizeApiError(e).message || "Failed to start reset");
    } finally { setLoading(false); }
  }

  async function handleForgotOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    try {
      await api.post("/api/auth/verify-forgot-password-otp", { Email: email.trim().toLowerCase(), OTP: otp.trim() });
      setView({ tab: "forgot", step: 3 });
    } catch (e) {
      setErr(normalizeApiError(e).message || "Invalid OTP");
    } finally { setLoading(false); }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null); setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { email: email.trim().toLowerCase(), newPassword: password.trim() });
      onClose();
    } catch (e) {
      setErr(normalizeApiError(e).message || "Reset failed");
    } finally { setLoading(false); }
  }

  const is = {
    login: view.tab === "login",
    reg1: view.tab === "register" && view.step === 1,
    reg2: view.tab === "register" && view.step === 2,
    fog1: view.tab === "forgot" && view.step === 1,
    fog2: view.tab === "forgot" && view.step === 2,
    fog3: view.tab === "forgot" && view.step === 3,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" role="dialog" aria-modal="true">
      {/* Enhanced overlay with subtle animation */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/30 via-primary-900/20 to-black/40"
        onClick={() => { if (!loading) onClose(); }}
      />

      {/* Enhanced dialog with modern styling */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-premium p-8 animate-in fade-in zoom-in-95 border border-white/20">
        {/* Enhanced header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-title">
            {is.login && "Welcome Back"}
            {is.reg1 && "Join JobSetu"}
            {is.reg2 && "Verify Email"}
            {is.fog1 && "Reset Password"}
            {is.fog2 && "Enter Code"}
            {is.fog3 && "New Password"}
          </h2>
          <button
            aria-label="Close"
            onClick={() => { if (!loading) onClose(); }}
            className="h-10 w-10 inline-flex items-center justify-center rounded-2xl hover:bg-gray-100 transition-all duration-200 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Enhanced tabs with modern segmented control */}
        <div className="segment mb-6">
          <button
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${
              view.tab === "login" 
                ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]" 
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => { if (!loading) { setErr(null); setView({ tab: "login" }); } }}
          >
            Login
          </button>
          <button
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${
              view.tab === "register" 
                ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]" 
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => { if (!loading) { setErr(null); setView({ tab: "register", step: 1 }); } }}
          >
            Register
          </button>
          <button
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${
              view.tab === "forgot" 
                ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]" 
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => { if (!loading) { setErr(null); setView({ tab: "forgot", step: 1 }); } }}
          >
            Forgot
          </button>
        </div>

        {/* Enhanced error display */}
        {err && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-700 font-medium">{err}</span>
            </div>
          </div>
        )}

        {/* forms */}
        {is.login && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <input 
                className="input w-full" 
                type="email" 
                placeholder="Enter your email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <input 
                className="input w-full" 
                type="password" 
                placeholder="Enter your password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary w-full btn-lg glow" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : "Sign In"}
            </button>
          </form>
        )}

        {is.reg1 && (
          <form onSubmit={handleRegister} className="space-y-3">
            <input className="input w-full" placeholder="Full name"
              value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <input className="input w-full" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input w-full" inputMode="tel" pattern="[0-9]{7,15}"
              placeholder="Phone (digits only)" value={phone}
              onChange={(e) => setPhone(e.target.value)} required title="7–15 digits" />
            <input className="input w-full" type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />

            {/* Role selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Role</label>
              <div className="inline-flex rounded-xl border border-gray-200 p-1">
                <button type="button" onClick={() => setRole("JobSeeker")}
                  className={`px-3 h-9 rounded-lg text-sm ${role === "JobSeeker" ? "bg-gray-100 font-medium" : "text-gray-700"}`}>
                  Job Seeker
                </button>
                <button type="button" onClick={() => setRole("Recruiter")}
                  className={`px-3 h-9 rounded-lg text-sm ${role === "Recruiter" ? "bg-gray-100 font-medium" : "text-gray-700"}`}>
                  Recruiter
                </button>
              </div>
            </div>

            {/* GDPR */}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="rounded border-gray-300"
                checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} required />
              I agree to GDPR/Privacy Policy.
            </label>

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Please wait…" : "Continue"}
            </button>
            <p className="text-xs text-gray-600 text-center">
              We’ll send an OTP to verify your email.
            </p>
          </form>
        )}

        {is.reg2 && (
          <form onSubmit={handleRegisterOtp} className="space-y-3">
            <input className="input w-full" inputMode="numeric" maxLength={6}
              placeholder="Enter OTP" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} required />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {is.fog1 && (
          <form onSubmit={handleForgotStart} className="space-y-3">
            <input className="input w-full" type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Please wait…" : "Send OTP"}
            </button>
          </form>
        )}

        {is.fog2 && (
          <form onSubmit={handleForgotOtp} className="space-y-3">
            <input className="input w-full" inputMode="numeric" maxLength={6}
              placeholder="Enter OTP" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} required />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
          </form>
        )}

        {is.fog3 && (
          <form onSubmit={handleReset} className="space-y-3">
            <input className="input w-full" type="password" placeholder="New password"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Please wait…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
