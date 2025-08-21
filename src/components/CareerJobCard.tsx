import { useEffect, useState } from "react";
import api, { authStorage, onAuthChanged } from "../lib/api";

type TimelineEntry = { status: string; time: string };

export interface CareerJobCardProps {
  jobId: number;
  title: string;
  location?: string;
  company?: { name?: string; logoUrl?: string } | Record<string, any>;
  tags?: string[];
  salaryMin?: number;
  salaryMax?: number;
  experienceRequired?: number;
  isRemote?: boolean;
  isUrgent?: boolean;

  // incoming status
  isApplied?: boolean;
  isSaved?: boolean;

  // actions (used only by Applied/Saved tabs)
  onWithdraw?: (jobId: number) => void;
  onUnsave?: (jobId: number) => void;

  // callbacks for Recommendations (parent updates its lists optimistically)
  onApply?: () => void;
  onSave?: () => void;

  // Compare tab hides actions
  readOnly?: boolean;

  // NEW for Recommendations/Compare
  matchedSkills?: string[];
  matchPercentage?: number;     // 0–100, badge in the header
  showOnlyMatched?: boolean;    // if true: render matchedSkills instead of tags
  showAppliedBadge?: boolean;
  dense?: boolean;              // (optional) compact layout
  showSalary?: boolean;         // (optional) toggle salary row
}

export default function CareerJobCard({
  jobId, title, location, company, tags = [],
  salaryMin, salaryMax, experienceRequired,
  isRemote, isUrgent, isApplied, isSaved,
  onWithdraw, onUnsave, readOnly,
  matchedSkills, matchPercentage, showOnlyMatched,
  onApply, onSave,
  showAppliedBadge = true,
  dense = false,
  showSalary = true,
}: CareerJobCardProps) {
  // internal state
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(!!isSaved);
  const [applied, setApplied] = useState(!!isApplied);
  const [authed, setAuthed] = useState<boolean>(!!authStorage.getToken());

  // 🔑 Prefer props for UI truth; fall back to internal state
  const appliedNow = typeof isApplied === "boolean" ? isApplied : applied;
  const savedNow = typeof isSaved === "boolean" ? isSaved : saved;

  useEffect(() => { setSaved(!!isSaved); }, [isSaved]);
  useEffect(() => { setApplied(!!isApplied); }, [isApplied]);

  useEffect(() => onAuthChanged(() => {
    const a = !!authStorage.getToken();
    setAuthed(a);
    if (!a) { setSaved(false); setApplied(false); }
  }), []);

  // super-tolerant POST for /save and /apply
  async function postWithId(url: string, id: number) {
    let lastErr: any;
    const tries = [
      () => api.post(url, id, { headers: { "Content-Type": "application/json" } }),
      () => api.post(url, { jobId: id }),
      () => api.post(url, { JobId: id }),
      () => {
        const fd = new FormData();
        fd.append("jobId", String(id));
        fd.append("JobId", String(id));
        return api.post(url, fd, {
          transformRequest: [(data, headers) => {
            if (headers) {
              delete (headers as any)["Content-Type"];
              delete (headers as any)["content-type"];
            }
            return data as any;
          }],
        });
      },
      () => api.post(`${url}?jobId=${id}`),
    ];
    for (const go of tries) {
      try { return await go(); }
      catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  const extractMessage = (err: any): string | undefined => {
    const d = err?.data;
    if (typeof d === "string") return d;
    return d?.Message || d?.message || err?.message;
  };

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
      if (data?.isApplied) { setApplied(true); return "applied"; }
      if (data?.isSaved) { setSaved(true); return "saved"; }
    } catch { }
    return "unknown";
  }

  // sync on mount/job change when authed (state only; props still win for UI)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authed) { setApplied(false); setSaved(false); return; }
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
    if (savedNow || saving) return;
    setSaving(true);
    try {
      await postWithId("/api/jobs/save", jobId);
      setSaved(true);
      onSave?.();                 // notify parent to update its Saved list
      await refreshStatus();
    } catch (err: any) {
      const status = Number(err?.status);
      const msg = extractMessage(err) || "";
      if (status === 401 || status === 403) {
        alert("Please log in as a Job Seeker to save jobs.");
      } else if (/already\s*saved/i.test(msg)) {
        setSaved(true);
        onSave?.();
        alert("You already saved this job.");
      } else {
        alert(msg || "Couldn't save this job.");
        await refreshStatus();
      }
    } finally { setSaving(false); }
  }

  async function handleApply() {
    if (appliedNow || applying) return;
    setApplying(true);
    try {
      await postWithId("/api/jobs/apply", jobId);
      setApplied(true);
      onApply?.();                // notify parent to update its Applied list
      await refreshStatus();
    } catch (err: any) {
      const status = Number(err?.status);
      const msg = extractMessage(err) || "";
      if (status === 401 || status === 403) {
        alert("Please log in as a Job Seeker to apply.");
      } else if (/already\s*applied/i.test(msg)) {
        setApplied(true);
        onApply?.();
        alert("You already applied to this job.");
      } else if (status === 400 && !msg) {
        const inferred = await refreshStatusAndInfer();
        if (inferred === "applied") { onApply?.(); return; }
        alert("Couldn't apply to this job. Please try again.");
      } else {
        alert(msg || "Couldn't apply to this job. Please try again.");
      }
    } finally { setApplying(false); }
  }

  // timeline (Applied tab only)
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [loadingTl, setLoadingTl] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const toggleTimeline = async () => {
    if (!timelineOpen) {
      try {
        setLoadingTl(true);
        const res = await api.get(`/api/jobs/timeline/${jobId}`);
        const list = res.data?.timeline ?? res.data?.Timeline ?? (Array.isArray(res.data) ? res.data : []);
        setTimeline(Array.isArray(list) ? list : []);
      } finally { setLoadingTl(false); }
    }
    setTimelineOpen(v => !v);
  };

  const salaryText =
    salaryMin != null || salaryMax != null
      ? `Salary: ${salaryMin != null ? `₹${salaryMin.toLocaleString()}` : "—"} – ${salaryMax != null ? `₹${salaryMax.toLocaleString()}` : "—"} / yr`
      : null;

  // pick skill list
  const skillsToShow =
    (showOnlyMatched && matchedSkills && matchedSkills.length > 0)
      ? matchedSkills
      : (tags || []);

  return (
    <div className={`card ${dense ? "p-3" : "p-4"} ${dense ? "" : "h-full"} flex flex-col relative`}>
      {/* applied badge (optional per tab) */}
      {showAppliedBadge && authed && appliedNow && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 ring-1 ring-green-200">
          <span>✓</span> <span>Already applied</span>
        </span>
      )}

      {/* header */}
      <div className={`flex items-start justify-between ${dense ? "gap-2" : "gap-3"}`}>
        <div className={`flex ${dense ? "gap-2" : "gap-3"}`}>
          <img
            src={(company as any)?.logoUrl || "/logo-placeholder.png"}
            alt={(company as any)?.name || "Company"}
            className={`${dense ? "w-9 h-9" : "w-10 h-10"} rounded bg-gray-100 object-cover`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo-placeholder.png"; }}
          />
          <div>
            <div className={`font-medium leading-tight ${dense ? "text-[15px]" : ""}`}>{title}</div>
            <div className="text-xs text-gray-500">
              {(company as any)?.name ? `${(company as any).name} · ` : ""}{location || "—"}
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {/* match % pill */}
          {typeof matchPercentage === "number" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              {Math.round(matchPercentage)}% match
            </span>
          )}
          {/* Show ★ in Saved tab even if also applied */}
          {authed && savedNow && (onUnsave || !appliedNow) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
              <span>★</span> <span>Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* skills + salary */}
      <div className={dense ? "mt-1" : "mt-2"}>
        <div className={`flex flex-wrap gap-2 ${dense ? "" : "min-h-[28px]"}`}>
          {isUrgent && <span className="chip">Urgent</span>}
          {isRemote && <span className="chip">Remote</span>}
          {experienceRequired != null && <span className="chip">{experienceRequired}+ yrs</span>}
          {skillsToShow.slice(0, 8).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        {showSalary && salaryText && (
          <div className={`text-sm text-gray-700 ${dense ? "mt-1" : "mt-2"}`}>{salaryText}</div>
        )}
      </div>

      {/* actions (hidden in readOnly mode) */}
      {!readOnly && (
        <div className={`${dense ? "mt-3" : "mt-4"} flex flex-wrap items-center gap-3`}>
          {onWithdraw ? (
            <>
              <button onClick={() => onWithdraw(jobId)} className="btn btn-primary">Withdraw</button>
              <button onClick={toggleTimeline} className="btn btn-ghost">
                {timelineOpen ? "Hide timeline" : "Timeline"}
              </button>
            </>
          ) : onUnsave ? (
            <button onClick={() => onUnsave(jobId)} className="btn btn-ghost">Unsave</button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                disabled={!authed || appliedNow || applying}
                onClick={handleApply}
                title={!authed ? "Login to apply" : appliedNow ? "You have already applied" : "Apply to this job"}
              >
                {appliedNow ? "Applied" : applying ? "Applying…" : "Apply"}
              </button>
              <button
                className="btn btn-ghost"
                disabled={!authed || savedNow || saving}
                onClick={handleSave}
                title={!authed ? "Login to save" : savedNow ? "Already saved" : "Save this job"}
              >
                {savedNow ? "Saved" : saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      )}

      {/* timeline (Applied tab) */}
      {onWithdraw && timelineOpen && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 w-full">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Application timeline</h4>
            {loadingTl && <span className="text-xs text-gray-500">Loading…</span>}
          </div>
          {timeline.length > 0 ? (
            <ol className="space-y-2">
              {timeline.map((t, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-[3px] inline-block h-2 w-2 rounded-full bg-gray-400" />
                  <div className="text-[13px] text-gray-700">
                    <span className="font-medium">{t.status}</span>{" - "}
                    <span className="text-gray-600">{new Date(t.time).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-600">No timeline entries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
