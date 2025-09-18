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
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${view.tab === "login"
                ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]"
                : "text-gray-600 hover:text-gray-800"
              }`}
            onClick={() => { if (!loading) { setErr(null); setView({ tab: "login" }); } }}
          >
            Login
          </button>
          <button
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${view.tab === "register"
                ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]"
                : "text-gray-600 hover:text-gray-800"
              }`}
            onClick={() => { if (!loading) { setErr(null); setView({ tab: "register", step: 1 }); } }}
          >
            Register
          </button>
          <button
            className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${view.tab === "forgot"
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

        {/* Enhanced forms with modern styling */}
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
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Full Name</label>
                <input
                  className="input w-full"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                <input
                  className="input w-full"
                  inputMode="tel"
                  pattern="[0-9]{7,15}"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  title="7–15 digits"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <input
                className="input w-full"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <input
                className="input w-full"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Enhanced Role selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">I want to join as</label>
              <div className="segment">
                <button type="button" onClick={() => setRole("JobSeeker")}
                  className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${role === "JobSeeker"
                      ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]"
                      : "text-gray-600 hover:text-gray-800"
                    }`}>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Job Seeker
                  </div>
                </button>
                <button type="button" onClick={() => setRole("Recruiter")}
                  className={`px-4 h-11 rounded-xl text-sm font-semibold transition-all duration-300 ${role === "Recruiter"
                      ? "bg-white shadow-lg text-gray-900 transform translate-y-[-1px]"
                      : "text-gray-600 hover:text-gray-800"
                    }`}>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Recruiter
                  </div>
                </button>
              </div>
            </div>

            {/* Enhanced GDPR */}
            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={gdpr}
                onChange={(e) => setGdpr(e.target.checked)}
                required
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I agree to the <span className="link">Terms of Service</span> and <span className="link">Privacy Policy</span>, including GDPR compliance.
              </span>
            </label>

            <button className="btn btn-primary w-full btn-lg glow" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating account...
                </div>
              ) : "Create Account"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              We'll send a verification code to your email address.
            </p>
          </form>
        )}

        {is.reg2 && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Check your email</h3>
              <p className="text-sm text-gray-600 mt-1">We sent a verification code to <strong>{email}</strong></p>
            </div>
            <form onSubmit={handleRegisterOtp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Verification Code</label>
                <input
                  className="input w-full text-center text-lg font-mono tracking-widest"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <button className="btn btn-primary w-full btn-lg" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                  </div>
                ) : "Verify Email"}
              </button>
            </form>
          </div>
        )}

        {is.fog1 && (
          <form onSubmit={handleForgotStart} className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Forgot your password?</h3>
                <p className="text-sm text-gray-600">Enter your email and we'll send you a reset code.</p>
              </div>
            </div>
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
            <button className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending...
                </div>
              ) : "Send Reset Code"}
            </button>
          </form>
        )}

        {is.fog2 && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Enter reset code</h3>
              <p className="text-sm text-gray-600 mt-1">We sent a code to <strong>{email}</strong></p>
            </div>
            <form onSubmit={handleForgotOtp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Reset Code</label>
                <input
                  className="input w-full text-center text-lg font-mono tracking-widest"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <button className="btn btn-primary w-full btn-lg" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                  </div>
                ) : "Verify Code"}
              </button>
            </form>
          </div>
        )}

        {is.fog3 && (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 mx-auto bg-success-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create new password</h3>
                <p className="text-sm text-gray-600">Enter a strong password for your account.</p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">New Password</label>
              <input
                className="input w-full"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Updating...
                </div>
              ) : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
