//src/components/JobCard.tsx
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
    await api.post("/api/jobs/save", jobId, { headers: { "Content-Type": "application/json" } });
    setSaved(true);
    await refreshStatus();
  } catch (err: any) {
    const status = Number(err?.status);
    const msg = extractMessage(err) || "";
    if (status === 401 || status === 403) alert("Please log in as a Job Seeker to save jobs.");
    else if (/already\s*saved/i.test(msg)) { setSaved(true); alert("You already saved this job."); }
    else { alert(msg || "Couldn't save this job."); await refreshStatus(); }
  } finally { setSaving(false); }
}


// Apply -> always send object
async function handleApply() {
  if (!requireJobSeeker("apply")) return;
  if (applied || applying) return;
  setApplying(true);
  try {
    const res = await api.post("/api/jobs/apply", { jobId }, { headers: { "Content-Type": "application/json" } });
    const d = res?.data || {};

    if (d.needResume) { alert(d.message || "Please upload your resume before applying."); setApplied(false); return; }
    if (d.autoRejected) { alert(d.message || "Application auto-rejected."); setApplied(false); return; }
    if (d.alreadyApplied) { setApplied(true); alert(d.message || "Already applied."); return; }
    if (d.applied) setApplied(true);

    await refreshStatus();
  } catch (err: any) {
    const status = Number(err?.status);
    const msg = extractMessage(err) || "";
    if (status === 401 || status === 403) alert("Please log in as a Job Seeker to apply.");
    else { alert(msg || "Couldn't apply to this job."); await refreshStatus(); }
  } finally { setApplying(false); }
}



  const salaryText =
    salaryMin != null || salaryMax != null
      ? `Salary: ${salaryMin != null ? `₹${salaryMin.toLocaleString()}` : "—"} – ${salaryMax != null ? `₹${salaryMax.toLocaleString()}` : "—"} / yr`
      : null;

  return (
    <div className="card card-hover p-6 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <img
            src={company?.logoUrl || "/logo-placeholder.png"}
            alt={company?.name || "Company"}
            className="w-12 h-12 rounded-lg bg-gray-100 object-cover shadow-sm"
          />
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight text-gray-900 mb-1">{title}</div>
            <div className="text-sm text-gray-600">
              {company?.name ? `${company.name} · ` : ""}{location || "—"}
            </div>
          </div>
        </div>

        {/* status pills only when logged in */}
        <div className="flex gap-2 shrink-0">
          {authed && applied && (
            <span className="badge badge-success" title="You already applied to this job">
              <span>✓</span> <span>Applied</span>
            </span>
          )}
          {authed && !applied && saved && (
            <span className="badge badge-primary" title="This job is in your saved list">
              <span>★</span> <span>Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* TAGS + SALARY */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {isUrgent && <span className="badge badge-accent">Urgent</span>}
          {isRemote && <span className="badge badge-primary">Remote</span>}
          {experienceRequired != null && <span className="chip">{experienceRequired}+ yrs</span>}
          {tags.slice(0, 6).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        {salaryText && <div className="mt-3 text-sm font-semibold text-gray-800">{salaryText}</div>}
      </div>

      {/* ACTIONS */}
      <div className="mt-auto pt-4 flex gap-3">
        <button
          className="btn btn-primary flex-1"
          disabled={applied || applying}              // was: !authed || applied || applying
          onClick={handleApply}
          title={
            !authed
              ? "Login to apply"
              : role === "Recruiter"
                ? "Recruiters can't apply"
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
                ? "Recruiters can't save jobs"
                : applied
                  ? "Already saved"
                  : "Save this job"
          }        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
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

