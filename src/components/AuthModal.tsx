// src/components/AuthModal.tsx
import { useEffect, useState } from "react";
import api, { authStorage, normalizeApiError } from "../lib/api";

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
    setErr(null); setLoading(true);
    try {
      const body = { email: email.trim().toLowerCase(), password: password.trim() };
      const { data } = await api.post("/api/auth/login", body);
      // accept both camelCase or PascalCase responses
      const token = data?.token || data?.Token || data?.accessToken;
      if (token) authStorage.setToken(token);
      // persist metadata if present (optional)
      if (data?.fullName || data?.role) {
        localStorage.setItem("jobsetu_user", JSON.stringify({ fullName: data.fullName, role: data.role }));
      }
      onClose();
      window.location.reload();
    } catch (e) {
      setErr(normalizeApiError(e).message || "Login failed");
    } finally { setLoading(false); }
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
        IsGdprAccepted: gdpr        // ✅ keep this
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
      await api.post("/api/auth/verify-otp", { email: email.trim().toLowerCase(), otp: otp.trim() });
      onClose();
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
      await api.post("/api/auth/verify-forgot-password-otp", { email: email.trim().toLowerCase(), otp: otp.trim() });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* overlay (block closing while loading) */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => { if (!loading) onClose(); }}
      />

      {/* dialog */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-lg p-5 animate-in fade-in zoom-in-95">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            {is.login && "Login"}
            {is.reg1 && "Create account"}
            {is.reg2 && "Verify email"}
            {is.fog1 && "Forgot password"}
            {is.fog2 && "Verify OTP"}
            {is.fog3 && "Reset password"}
          </h2>
          <button
            aria-label="Close"
            onClick={() => { if (!loading) onClose(); }}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
          >×</button>
        </div>

        {/* tabs */}
        <div className="inline-flex rounded-xl border border-gray-200 p-1 mb-4">
          <button
            className={`px-3 h-9 rounded-lg text-sm ${view.tab === "login" ? "bg-gray-100 font-medium" : "text-gray-700"}`}
            onClick={() => !loading && setView({ tab: "login" })}
          >Login</button>
          <button
            className={`px-3 h-9 rounded-lg text-sm ${view.tab === "register" ? "bg-gray-100 font-medium" : "text-gray-700"}`}
            onClick={() => !loading && setView({ tab: "register", step: 1 })}
          >Register</button>
          <button
            className={`px-3 h-9 rounded-lg text-sm ${view.tab === "forgot" ? "bg-gray-100 font-medium" : "text-gray-700"}`}
            onClick={() => !loading && setView({ tab: "forgot", step: 1 })}
          >Forgot</button>
        </div>

        {/* error */}
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        {/* forms */}
        {is.login && (
          <form onSubmit={handleLogin} className="space-y-3">
            <input className="input w-full" type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="input w-full" type="password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Please wait…" : "Login"}
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
