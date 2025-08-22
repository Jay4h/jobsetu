import { useEffect, useState } from "react";
import api, { authStorage, onAuthChanged, getRoleFromToken } from "../lib/api";
import { openAuth } from "../lib/authGate";
export type JobCardProps = {
  jobId: number;
  title: string;
  location?: string;
  company?: { name?: string; logoUrl?: string };
  tags?: string[];
  salaryMin?: number;
  salaryMax?: number;
  experienceRequired?: number;
  isRemote?: boolean;
  isUrgent?: boolean;
  isSaved?: boolean;
  isApplied?: boolean;
  onApply: () => void; // Add this
  onWithdraw: () => void; // Add this
  onUnsave: () => void; // Add this
};

export default function JobCard(props: JobCardProps) {
  const {
    jobId, title, location, company, tags = [],
    salaryMin, salaryMax, experienceRequired,
    isRemote, isUrgent, isSaved, isApplied,
  } = props;

  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(!!isSaved);
  const [applied, setApplied] = useState(!!isApplied);

  const [authed, setAuthed] = useState<boolean>(!!authStorage.getToken());
  const [role, setRole] = useState<"JobSeeker" | "Recruiter" | null>(getRoleFromToken());

  useEffect(() => { setSaved(!!isSaved); }, [isSaved]);
  useEffect(() => { setApplied(!!isApplied); }, [isApplied]);

  // watch auth changes
  useEffect(() => {
    return onAuthChanged(() => {
      const a = !!authStorage.getToken();
      setAuthed(a);
      setRole(getRoleFromToken());
      if (!a) {
        setSaved(false);
        setApplied(false);
      }
    });
  }, []);

  /** Try sending raw number first, then { jobId } if API expects JSON object */
  async function postWithId(url: string, id: number) {
    try {
      return await api.post(url, id, { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
      // e is normalized by the interceptor: { status, message, data }
      if ([400, 415, 422].includes(Number(e?.status))) {
        return await api.post(url, { jobId: id });
      }
      throw e;
    }
  }

  function extractMessage(err: any): string | undefined {
    // normalized error
    if (!err) return undefined;
    const d = err.data;
    if (typeof d === "string") return d;
    return d?.Message || d?.message || err.message;
  }
  function requireAuth(): boolean {
    if (!authed) {
      openAuth("login");                        // ✅ open login popup
      return false;
    }
    return true;
  }
  // Only Job Seekers can apply/save
  function requireJobSeeker(action: "apply" | "save"): boolean {
    if (!requireAuth()) return false;
    const r = role || getRoleFromToken();
    if (r !== "JobSeeker") {
      alert(`You're signed in as a Recruiter. Only Job Seekers can ${action}.`);
      return false;
    }
    return true;
  }

  async function refreshStatus() {
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      if (typeof data?.isApplied === "boolean") setApplied(!!data.isApplied);
      if (typeof data?.isSaved === "boolean") setSaved(!!data.isSaved);
    } catch { }
  }

  async function refreshStatusAndInfer(): Promise<"applied" | "saved" | "unknown"> {
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      if (typeof data?.isApplied === "boolean" && data.isApplied) {
        setApplied(true);
        return "applied";
      }
      if (typeof data?.isSaved === "boolean" && data.isSaved) {
        setSaved(true);
        return "saved";
      }
    } catch { }
    return "unknown";
  }

  // 🔄 NEW: always sync real status from server when authed and when jobId changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authed) {
        setApplied(false);
        setSaved(false);
        return;
      }
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        if (cancelled) return;
        if (typeof data?.isApplied === "boolean") setApplied(!!data.isApplied);
        if (typeof data?.isSaved === "boolean") setSaved(!!data.isSaved);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [authed, jobId]);

  async function handleSave() {
    if (!requireJobSeeker("save")) return;
    if (saved || saving) return;
    setSaving(true);
    try {
      await postWithId("/api/jobs/save", jobId);
      setSaved(true);
      await refreshStatus(); // ensure backend truth
    } catch (err: any) {
      const status = Number(err?.status);
      const msg = extractMessage(err) || "";

      if (status === 401 || status === 403) {
        alert("Please log in as a Job Seeker to save jobs.");
      } else if (/already\s*saved/i.test(msg)) {
        setSaved(true);
        alert("You already saved this job.");
      } else {
        alert(msg || "Couldn't save this job.");
        await refreshStatus();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    if (!requireJobSeeker("apply")) return;
    if (applied || applying) return;
    setApplying(true);
    try {
      await postWithId("/api/jobs/apply", jobId);
      setApplied(true);
      await refreshStatus(); // ensure backend truth
    } catch (err: any) {
      const status = Number(err?.status);
      const msg = extractMessage(err) || "";

      if (status === 401 || status === 403) {
        alert("Please log in as a Job Seeker to apply.");
      } else if (/already\s*applied/i.test(msg)) {
        setApplied(true);
        alert("You already applied to this job.");
      } else if (status === 400 && !msg) {
        const inferred = await refreshStatusAndInfer();
        if (inferred !== "unknown") return;
        alert("Couldn't apply to this job. Please try again.");
      } else {
        alert(msg || "Couldn't apply to this job. Please try again.");
      }
    } finally {
      setApplying(false);
    }
  }

  const salaryText =
    salaryMin != null || salaryMax != null
      ? `Salary: ${salaryMin != null ? `₹${salaryMin.toLocaleString()}` : "—"} – ${salaryMax != null ? `₹${salaryMax.toLocaleString()}` : "—"} / yr`
      : null;

  return (
    <div className="card p-4 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <img
            src={company?.logoUrl || "/logo-placeholder.png"}
            alt={company?.name || "Company"}
            className="w-10 h-10 rounded bg-gray-100 object-cover"
          />
          <div>
            <div className="font-medium leading-tight">{title}</div>
            <div className="text-xs text-gray-500">
              {company?.name ? `${company.name} · ` : ""}{location || "—"}
            </div>
          </div>
        </div>

        {/* status pills only when logged in */}
        <div className="flex gap-2 shrink-0">
          {authed && applied && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 ring-1 ring-green-200" title="You already applied to this job">
              <span>✓</span> <span>Already applied</span>
            </span>
          )}
          {authed && !applied && saved && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200" title="This job is in your saved list">
              <span>★</span> <span>Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* TAGS + SALARY */}
      <div className="mt-2">
        <div className="flex flex-wrap gap-2 min-h-[28px]">
          {isUrgent && <span className="chip">Urgent</span>}
          {isRemote && <span className="chip">Remote</span>}
          {experienceRequired != null && <span className="chip">{experienceRequired}+ yrs</span>}
          {tags.slice(0, 6).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        {salaryText && <div className="mt-2 text-sm text-gray-700">{salaryText}</div>}
      </div>

      {/* ACTIONS */}
      <div className="mt-auto pt-3 flex gap-2">
        <button
          className="btn btn-primary"
          disabled={applied || applying}              // was: !authed || applied || applying
          onClick={handleApply}
          title={
            !authed
              ? "Login to apply"
              : role === "Recruiter"
                ? "Recruiters can’t apply"
                : applied
                  ? "You have already applied"
                  : "Apply to this job"
          }    
        >
          {applied ? "Applied" : applying ? "Applying…" : "Apply"}
        </button>
        <button
          className="btn btn-ghost"
          disabled={saved || saving}                  // was: !authed || saved || saving
          onClick={handleSave}
          title={
            !authed
              ? "Login to save"
              : role === "Recruiter"
                ? "Recruiters can’t save jobs"
                : applied
                  ? "Already saved"
                  : "Save this job"
          }        >
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* Skeleton unchanged */
export function JobCardSkeleton() {
  return (
    <div className="card p-4 h-full flex flex-col animate-pulse">
      <div className="h-4 w-3/4 bg-gray-200 rounded" />
      <div className="mt-2 h-3 w-1/2 bg-gray-200 rounded" />
      <div className="mt-2 flex gap-2">
        <div className="h-6 w-14 bg-gray-200 rounded" />
        <div className="h-6 w-14 bg-gray-200 rounded" />
        <div className="h-6 w-14 bg-gray-200 rounded" />
      </div>
      <div className="mt-auto pt-3 h-9 w-24 bg-gray-200 rounded" />
    </div>
  );
}
