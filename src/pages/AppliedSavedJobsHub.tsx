// src/pages/AppliedSavedJobsHub.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import CareerJobCard from "../components/CareerJobCard";

/* ---------- Helpers ---------- */
const BASE =
  (api as any)?.defaults?.baseURL?.replace(/\/+$/, "") ||
  "https://localhost:44380";
const SKILL_POST = "/api/resume/skill-test";
const SKILL_HISTORY = "/api/resume/skill-test-history";
/* NEW: AI resume tips endpoint */
const RESUME_TIPS = "/api/resume/design-tips";
const STATUS_BADGE: Record<string, string> = {
  Applied: "bg-gray-100 text-gray-700",
  Shortlisted: "bg-sky-100 text-sky-700",
  Interview: "bg-amber-100 text-amber-800",
  Offered: "bg-emerald-100 text-emerald-700",
  Hired: "bg-emerald-600 text-white",
  "On Hold": "bg-purple-100 text-purple-700",
  Rejected: "bg-rose-100 text-rose-700",
};
function buildLogoUrl(raw?: string) {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${BASE}${v}`;
  if (/^uploads\//i.test(v)) return `${BASE}/${v}`;
  return `${BASE}/Uploads/Logos/${v}`;
}
function getAxiosMessage(e: any, fallback = "Something went wrong.") {
  return e?.response?.data?.message || e?.message || fallback;
}
// Formats dd-MM-yyyy. If input is "YYYY-MM-DD", avoid timezone shift.
function formatDateDDMMYYYY(v?: string | Date | null) {
  if (!v) return "—";
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } else {
    const d = v;
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
}

/* ---------- Job API type (tolerant) ---------- */
type ApiJob = {
  jobId?: number; JobId?: number;
  title?: string; Title?: string;
  location?: string; Location?: string;
  tags?: string[] | string; Tags?: string[] | string;
  salaryMin?: number; SalaryMin?: number;
  salaryMax?: number; SalaryMax?: number;
  company?:
  | { name?: string; Name?: string; logoUrl?: string; LogoUrl?: string; logo?: string; Logo?: string }
  | string;
  CompanyName?: string;
  companyName?: string;
  CompanyLogo?: string;
  companyLogo?: string;
  companyLogoUrl?: string;
  LogoUrl?: string;

  matchPercentage?: number; MatchPercentage?: number;
  matchedSkills?: string[]; MatchedSkills?: string[];
};

function normalizeJob(j: ApiJob) {
  const id = (j as any).jobId ?? (j as any).JobId!;
  const title = (j as any).title ?? (j as any).Title ?? "";
  const location = (j as any).location ?? (j as any).Location ?? "";
  const salaryMin = (j as any).salaryMin ?? (j as any).SalaryMin;
  const salaryMax = (j as any).salaryMax ?? (j as any).SalaryMax;

  const rawTags = (j as any).tags ?? (j as any).Tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? rawTags.split(",").map(s => s.trim()).filter(Boolean)
      : [];

  const c = (j as any).company;
  const isObj = c && typeof c === "object";
  const companyName =
    (isObj && ((c as any).name ?? (c as any).Name)) ??
    (j as any).companyName ?? (j as any).CompanyName ??
    (typeof c === "string" ? c : undefined);

  const logoRaw =
    (isObj && ((c as any).logoUrl ?? (c as any).LogoUrl ?? (c as any).logo ?? (c as any).Logo)) ??
    (j as any).companyLogoUrl ?? (j as any).companyLogo ?? (j as any).CompanyLogo ?? (j as any).LogoUrl;

  const company = { name: companyName, logoUrl: buildLogoUrl(logoRaw) };

  const mpRaw =
    (j as any).matchPercentage ??
    (j as any).MatchPercentage ??
    (j as any).matchScore ??
    (j as any).MatchScore;
  const matchPercentage =
    typeof mpRaw === "number" ? mpRaw : mpRaw != null ? Number(mpRaw) : undefined;

  const matchedSkills = (j as any).matchedSkills ?? (j as any).MatchedSkills;
  const isApplied = (j as any).isApplied ?? (j as any).IsApplied;
  const isSaved = (j as any).isSaved ?? (j as any).IsSaved;
  return { jobId: id, title, location, company, tags, salaryMin, salaryMax, matchPercentage, matchedSkills, isApplied, isSaved };
}

/* ---------- Skill Test types & helpers ---------- */
type SkillTest = {
  id: number;
  skill: string;
  score: number;               // 0..100
  provider?: string;
  durationMin?: number;
  takenAt?: string;            // ISO
  remarks?: string;
  certificateUrl?: string;     // backend returns this
};

function normalizeSkillTest(r: any): SkillTest {
  return {
    id: Number(r.id ?? r.Id ?? r.testId ?? r.TestId ?? Math.random() * 1e9),
    skill: r.skill ?? r.Skill ?? r.technology ?? r.Technology ?? "—",
    score: Number(r.score ?? r.Score ?? 0),
    provider: r.provider ?? r.Provider,
    durationMin:
      Number(r.durationMin ?? r.DurationMin ?? r.duration ?? r.Duration ?? 0) || undefined,
    takenAt: r.takenAt ?? r.TakenAt ?? r.date ?? r.Date,
    remarks: r.remarks ?? r.Remarks ?? r.notes ?? r.Notes,
    certificateUrl: r.certificateUrl ?? r.CertificateUrl,
  };
}
type ApplicationEvent = {
  status: string;
  note?: string | null;        // we’ll store public feedback here
  at?: string | null;
  by?: string | null;          // optional (recruiter name)
};

function normalizeStatus(v: any) {
  return (
    v?.currentStatus ??
    v?.CurrentStatus ??
    v?.status ??
    v?.Status ??
    "Applied"
  );
}

/* ---------- Skill Test Module (Submit + History) ---------- */
function SkillTestModule({
  history,
  onRefresh,
}: {
  history: SkillTest[];
  onRefresh: () => Promise<void> | void;
}) {
  const [subTab, setSubTab] = useState<"submit" | "history">("submit");
  const [saving, setSaving] = useState(false);

  // form state
  const [skill, setSkill] = useState("");
  const [score, setScore] = useState<number | "">("");
  const [provider, setProvider] = useState("");
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [takenAt, setTakenAt] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setSkill("");
    setScore("");
    setProvider("");
    setDurationMin("");
    setTakenAt("");
    setRemarks("");
    setFile(null);
  };

  async function submit() {
    if (!skill || score === "" || Number(score) < 0 || Number(score) > 100) {
      alert("Please enter a skill and a score between 0 and 100.");
      return;
    }
    if (!file) {
      alert("Please upload a certificate/proof file (.pdf, .png, .jpg, .jpeg, .webp).");
      return;
    }

    setSaving(true);
    try {
      // Build multipart body (field name for the file MUST be "certificate")
      const fd = new FormData();
      fd.append("skill", skill);                  // names your backend already accepts
      fd.append("score", String(score));
      if (provider) fd.append("provider", provider);
      if (durationMin !== "") fd.append("durationMin", String(durationMin));
      if (takenAt) fd.append("takenAt", takenAt);   // <input type="date"> gives YYYY-MM-DD
      if (remarks) fd.append("remarks", remarks);
      fd.append("certificate", file);

      // CRITICAL: do NOT set Content-Type here; let the browser add the boundary.
      await api.post(SKILL_POST, fd, {
        transformRequest: [(data, headers) => {
          if (headers) {
            delete (headers as any)["Content-Type"];
            delete (headers as any)["content-type"];
          }
          return data as any;
        }],
      });

      alert("Skill test saved!");
      reset();
      setSubTab("history");
      await onRefresh();
    } catch (e) {
     console.error("Compare failed:", e);
  alert(getAxiosMessage(e, "Could not compare selected jobs."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("submit")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${subTab === "submit" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
        >
          Submit Result
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${subTab === "history" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
        >
          History
        </button>
      </div>

      {subTab === "submit" ? (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white max-w-2xl">
          {/* ...unchanged form... */}
          {/* (keeping your existing fields exactly as-is) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* fields kept exactly the same */}
            {/* Skill */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Skill / Technology</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="e.g. React, .NET, SQL"
              />
            </div>
            {/* Score */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Score (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={score}
                onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            {/* Provider */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Provider (optional)</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. HackerRank"
              />
            </div>
            {/* Duration */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Duration (min, optional)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            {/* Taken on */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Taken on (optional)</label>
              <input
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </div>
            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Remarks (optional)</label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any notes…"
              />
            </div>
            {/* File */}
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Certificate / Proof (required)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Accepts: .pdf, .png, .jpg, .jpeg, .webp (max 10 MB)
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              disabled={saving}
              onClick={submit}
              className={`px-5 py-2 rounded-md ${saving ? "bg-gray-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {saving ? "Saving…" : "Submit"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-x-auto">
          {/* history table unchanged */}
          <table className="min-w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Skill</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Taken on</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Certificate</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {history.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-600" colSpan={7}>No skill tests submitted yet.</td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.skill}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="font-medium">{Math.round(r.score)}%</span>
                        <span className="h-2 w-24 rounded bg-gray-200 overflow-hidden">
                          <span
                            className={`block h-2 ${r.score >= 75 ? "bg-emerald-500" : r.score >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(100, Math.max(0, r.score))}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.provider || "—"}</td>
                    <td className="px-4 py-3">{formatDateDDMMYYYY(r.takenAt || null)}</td>
                    <td className="px-4 py-3">{r.durationMin != null ? `${r.durationMin} min` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.certificateUrl ? (
                        <a
                          href={r.certificateUrl.startsWith("/") ? `${BASE}${r.certificateUrl}` : r.certificateUrl}
                          target="_blank" rel="noreferrer" className="text-blue-600 hover:underline"
                        >View</a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">{r.remarks || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* =================================================================== */
/* ======================  NEW: Tips Dashboard  ====================== */

type ResumeTip = { section?: string; advice?: string; priority?: string | null };
type ResumeTipsPayload = {
  score?: number;
  keywords?: string[];
  tips?: ResumeTip[];
};

function ResumeTipsDashboard({
  data,
  loading,
  error,
}: {
  data: ResumeTipsPayload | null;
  loading: boolean;
  error?: string | null;
}) {
  if (loading) return <p>Loading tips…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  const score = Math.max(0, Math.min(100, Number(data?.score ?? 0)));
  const keywords = data?.keywords ?? [];
  const tips = Array.isArray(data?.tips) ? data!.tips! : [];

  // group tips by section
  const bySection = tips.reduce<Record<string, ResumeTip[]>>((acc, t) => {
    const key = (t.section && String(t.section).trim()) || "General";
    (acc[key] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Score */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Resume Design Tips Dashboard (via AI)</h3>
          <div className="min-w-[220px]">
            <div className="text-sm text-gray-600 mb-1">Overall Resume Score</div>
            <div className="h-3 w-full rounded bg-gray-200 overflow-hidden">
              <div
                className={`${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : "bg-amber-500"} h-3`}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="text-right text-sm font-medium mt-1">{score}%</div>
          </div>
        </div>
        {/* Keywords */}
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">Suggested/Missing Keywords</div>
          {keywords.length ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k, i) => (
                <span key={i} className="chip">{k}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No keyword suggestions right now.</div>
          )}
        </div>
      </div>

      {/* Tips grouped by section */}
      <div className="grid md:grid-cols-2 gap-4">
        {Object.keys(bySection).length === 0 ? (
          <div className="text-gray-600">No tips available.</div>
        ) : (
          Object.entries(bySection).map(([section, list]) => (
            <div key={section} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="font-semibold mb-2">{section}</div>
              <ul className="list-disc pl-5 space-y-2">
                {list.map((t, idx) => (
                  <li key={idx} className="text-sm text-gray-700">
                    {t.advice || "—"}
                    {t.priority ? (
                      <span className="ml-2 inline-block text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 align-middle">
                        {t.priority}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =================================================================== */

export default function AppliedSavedJobsHub() {
  const [activeTab, setActiveTab] = useState<
    "applied" | "saved" | "recommended" | "skilltest" | "compare" | "tips" | "status"
  >("applied");

  const [appliedJobs, setAppliedJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [skillHistory, setSkillHistory] = useState<SkillTest[]>([]);

  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<any[] | null>(null);

  const savedSet = useMemo(() => new Set(savedJobs.map(j => j.jobId)), [savedJobs]);
  const appliedSet = useMemo(() => new Set(appliedJobs.map(j => j.jobId)), [appliedJobs]);

  /* NEW: AI tips state */
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsData, setTipsData] = useState<ResumeTipsPayload | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [appliedWithStatus, setAppliedWithStatus] = useState<any[]>([]);
  const [timelines, setTimelines] = useState<Record<number, ApplicationEvent[]>>({});
  const [tlLoadingId, setTlLoadingId] = useState<number | null>(null);
  const [tlErrorId, setTlErrorId] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        if (activeTab === "applied") {
          const res = await api.get("/api/user/applied-jobs", { params: { page: 1, limit: 10 } });
          const list: ApiJob[] =
            res.data?.appliedJobs ?? res.data?.AppliedJobs ?? (Array.isArray(res.data) ? res.data : []);
          // attach status FIRST, then filter
          const norm = list.map((j) => ({ ...normalizeJob(j), currentStatus: normalizeStatus(j) }));
          if (!cancelled) setAppliedJobs(norm.filter(j => j.currentStatus !== "Rejected"));
        }
        else if (activeTab === "saved") {
          const res = await api.get("/api/user/saved-jobs", { params: { page: 1, limit: 10 } });
          const list: ApiJob[] =
            res.data?.savedJobs ?? res.data?.SavedJobs ?? (Array.isArray(res.data) ? res.data : []);
          const norm = list.map(normalizeJob);
          if (!cancelled) setSavedJobs(norm);

        } else if (activeTab === "recommended") {
          const [rec, sv, ap] = await Promise.all([
            api.get("/api/jobs/recommended", { params: { page: 1, limit: 10 } }),
            api.get("/api/user/saved-jobs", { params: { page: 1, limit: 100 } }),
            api.get("/api/user/applied-jobs", { params: { page: 1, limit: 100 } }),
          ]);

          const recList: ApiJob[] = Array.isArray(rec.data)
            ? rec.data
            : (rec.data?.recommended ?? rec.data?.Recommended ?? []);
          const normRec = recList.map(normalizeJob);

          const savedList: ApiJob[] =
            sv.data?.savedJobs ?? sv.data?.SavedJobs ?? (Array.isArray(sv.data) ? sv.data : []);
          const appliedList: ApiJob[] =
            ap.data?.appliedJobs ?? ap.data?.AppliedJobs ?? (Array.isArray(ap.data) ? ap.data : []);

          if (!cancelled) {
            setRecommended(normRec);
            setSavedJobs(savedList.map(normalizeJob));
            // 👇 attach status + drop rejected so badges don’t show “applied” for auto-rejects
            const appliedNorm = appliedList.map((j) => ({ ...normalizeJob(j), currentStatus: normalizeStatus(j) }));
            setAppliedJobs(appliedNorm.filter(j => j.currentStatus !== "Rejected"));
          }

        } else if (activeTab === "skilltest") {
          const res = await api.get(SKILL_HISTORY, { params: { page: 1, limit: 50 } });
          const list: any[] = Array.isArray(res.data)
            ? res.data
            : (res.data?.tests ?? res.data?.Tests ?? res.data?.history ?? res.data?.History ?? res.data?.results ?? res.data?.data ?? []);
          const norm = (Array.isArray(list) ? list : []).map(normalizeSkillTest);
          if (!cancelled) setSkillHistory(norm);

        } else if (activeTab === "tips") {
          setTipsLoading(true);
          setTipsError(null);
          try {
            const res = await api.get(RESUME_TIPS);
            if (!cancelled) setTipsData(res.data || {});
          } catch (e: any) {
            console.error("AI resume tips failed:", e);
            const msg =
              e?.response?.data?.message ||
              e?.message ||
              "Could not load resume tips.";
            if (!cancelled) setTipsError(msg);
          } finally {
            if (!cancelled) setTipsLoading(false);
          }

        } else if (activeTab === "status") {
          const res = await api.get("/api/user/applied-jobs", { params: { page: 1, limit: 100 } });
          const list: any[] =
            res.data?.appliedJobs ?? res.data?.AppliedJobs ?? (Array.isArray(res.data) ? res.data : []);
          const norm = list.map((j) => {
            const base = normalizeJob(j);
            return { ...base, currentStatus: normalizeStatus(j) };
          });
          if (!cancelled) setAppliedWithStatus(norm);
        }

      } catch (e) {
        console.error("CareerHub load failed:", e);
        if (!cancelled) {
          if (activeTab === "applied") setAppliedJobs([]);
          else if (activeTab === "saved") setSavedJobs([]);
          else if (activeTab === "recommended") setRecommended([]);
          else if (activeTab === "skilltest") setSkillHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [activeTab]);

  async function loadTimeline(jobId: number) {
    if (!jobId) return;
    // cache hit?
    if (timelines[jobId]) return;
    setTlLoadingId(jobId);
    setTlErrorId(null);
    try {
      const r = await api.get(`/api/jobs/timeline/${jobId}`);
      const arr: any[] = Array.isArray(r.data) ? r.data
        : (r.data?.timeline ?? r.data?.Timeline ?? r.data?.items ?? []);

      const events: ApplicationEvent[] = (arr || []).map((x: any) => {
        const status = x.status ?? x.Status ?? "";
        const feedback = x.feedback ?? x.Feedback ?? x.publicFeedback ?? null;
        const note = x.note ?? x.Note ?? x.Remarks ?? feedback ?? null;  // << use feedback
        const at =
          x.atUtc ?? x.AtUtc ??                 // << ISO 8601 from backend
          x.at ?? x.At ??
          x.time ?? x.Time ??
          x.createdAt ?? x.CreatedAt ?? null;
        const by =
          x.byRecruiterName ?? x.ByRecruiterName ??
          x.by ?? x.By ?? null;

        return { status, note, at, by };
      });
      setTimelines((m) => ({ ...m, [jobId]: events }));
    } catch (e) {
      console.error("timeline failed", e);
      setTlErrorId(jobId);
    } finally {
      setTlLoadingId(null);
    }
  }

  const handleWithdraw = async (jobId: number) => {
    try {
      await api.delete(`/api/jobs/withdraw/${jobId}`);
      setAppliedJobs(prev => prev.filter(j => j.jobId !== jobId));
      setCompareIds(prev => prev.filter(id => id !== jobId));
    } catch (e) {
      console.error("Withdraw failed", e);
      alert("Could not withdraw this application.");
    }
  };

  const handleUnsave = async (jobId: number) => {
    try {
      await api.delete(`/api/jobs/unsave/${jobId}`);
    } catch (e) {
      console.error("Unsave failed", e);
      alert("Could not unsave this job.");
    } finally {
      setSavedJobs(prev => prev.filter(j => j.jobId !== jobId));
      setCompareIds(prev => prev.filter(id => id !== jobId));
    }
  };
  // Optimistic APPLY from Recommendations: no network here (card already posted)
  const handleApplyFromRec = (job: any) => {
    setAppliedJobs((prev) => prev.some((j) => j.jobId === job.jobId) ? prev : [job, ...prev]);
  };

  // Optimistic SAVE from Recommendations: no network here (card already posted)
  const handleSaveFromRec = (job: any) => {
    setSavedJobs((prev) => prev.some((j) => j.jobId === job.jobId) ? prev : [job, ...prev]);
  };

  const allJobsForCompare = useMemo(() => {
    const byId = new Map<number, any>();
    for (const j of [...appliedJobs, ...savedJobs, ...recommended]) {
      if (j?.jobId != null && !byId.has(j.jobId)) byId.set(j.jobId, j);
    }
    return Array.from(byId.values());
  }, [appliedJobs, savedJobs, recommended]);



  const toggleCompare = (jobId: number) => {
    setCompareIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
  };

  const canCompare = compareIds.length >= 2 && compareIds.length <= 4;

  const submitCompare = async () => {
    if (!canCompare) return;
    try {
      const res = await api.post("/api/jobs/compare", compareIds);
      const rows: any[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setCompareResult(rows);
    } catch (e) {
      console.error("Compare failed", e);
      alert("Could not compare selected jobs.");
    }
  };

  function renderCompareTable(rows: any[]) {
    const cols = rows.map((r: any) => ({
      id: r.JobId ?? r.jobId ?? r.id ?? Math.random(),
      title: r.Title ?? r.title ?? "—",
      company: r.Company ?? r.company ?? r.companyName ?? "—",
      location: r.Location ?? r.location ?? "—",
      salary:
        r.Salary ??
        (r.SalaryMin && r.SalaryMax ? `${r.SalaryMin} – ${r.SalaryMax}` : "—"),
      skills: Array.isArray(r.Skills) ? r.Skills : (typeof r.Skills === "string" ? r.Skills.split(",").map((x: string) => x.trim()) : []),
      remote: (typeof r.Remote === "boolean" ? r.Remote : (r.IsRemote ?? false)) ? "Yes" : "No",
      match: r.MatchScore ?? r.matchScore ?? r.matchPercentage ?? r.MatchPercentage ?? null,
      postedAt: r.PostedAt ?? r.postedAt ?? null,
    }));

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm mt-6">
        <table className="min-w-full border-collapse bg-white text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Field</th>
              {cols.map(c => (
                <th key={c.id} className="px-4 py-3 text-left font-semibold">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-3 font-medium">Company</td>
              {cols.map(c => <td key={c.id} className="px-4 py-3">{c.company}</td>)}
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium">Location</td>
              {cols.map(c => <td key={c.id} className="px-4 py-3">{c.location}</td>)}
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium">Salary</td>
              {cols.map(c => <td key={c.id} className="px-4 py-3">{c.salary}</td>)}
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium">Skills</td>
              {cols.map(c => (
                <td key={c.id} className="px-4 py-3">
                  {c.skills && c.skills.length ? (
                    <div className="flex flex-wrap gap-1">
                      {c.skills.slice(0, 8).map((s: string, i: number) => (
                        <span key={i} className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 8 && (
                        <span className="text-xs text-gray-500 ml-1">+{c.skills.length - 8} more</span>
                      )}
                    </div>
                  ) : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium">Remote</td>
              {cols.map(c => <td key={c.id} className="px-4 py-3">{c.remote}</td>)}
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium">Match Score</td>
              {cols.map(c => (
                <td key={c.id} className="px-4 py-3">
                  {c.match != null ? (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span>{Math.round(c.match)}%</span>
                      <span className="h-2 w-16 rounded bg-gray-200 overflow-hidden" aria-label="match meter">
                        <span
                          className={[
                            "block h-2",
                            c.match >= 75 ? "bg-emerald-500" : c.match >= 50 ? "bg-blue-500" : "bg-amber-500"
                          ].join(" ")}
                          style={{ width: `${Math.max(0, Math.min(100, Number(c.match)))}%` }}
                        />
                      </span>
                    </span>
                  ) : "—"}
                </td>
              ))}
            </tr>
            {cols.some(c => c.postedAt) && (
              <tr>
                <td className="px-4 py-3 font-medium">Posted</td>
                {cols.map(c => (
                  <td key={c.id} className="px-4 py-3">
                    {c.postedAt ? formatDateDDMMYYYY(c.postedAt) : "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const tabButton = (
    id: "applied" | "saved" | "recommended" | "skilltest" | "compare" | "tips" | "status",
    label: string
  ) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-5 py-2 rounded-full text-sm font-medium transition ${activeTab === id ? "bg-blue-600 text-white shadow-sm" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
    >
      {label}
    </button>
  );

  const content = useMemo(() => {
    if (loading) return <p>Loading...</p>;

    if (activeTab === "applied") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {appliedJobs.length ? (
            appliedJobs.map(job => (
              <CareerJobCard
                key={job.jobId}
                jobId={job.jobId}
                title={job.title}
                location={job.location}
                company={job.company}
                tags={job.tags}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                isApplied
                onWithdraw={() => handleWithdraw(job.jobId)}
                showTimeline={false}
              />
            ))
          ) : (
            <p className="text-gray-600">No applied jobs found.</p>
          )}
        </div>
      );
    }

    if (activeTab === "saved") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {savedJobs.length ? (
            savedJobs.map(job => (
              <CareerJobCard
                key={job.jobId}
                jobId={job.jobId}
                title={job.title}
                location={job.location}
                company={job.company}
                tags={job.tags}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                isSaved
                showAppliedBadge={false}
                onUnsave={() => handleUnsave(job.jobId)}
              />
            ))
          ) : (
            <p className="text-gray-600">No saved jobs found.</p>
          )}
        </div>
      );
    }

    if (activeTab === "recommended") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {recommended.length ? (
            recommended.map(job => (
              <CareerJobCard
                key={job.jobId}
                jobId={job.jobId}
                title={job.title}
                location={job.location}
                company={job.company}
                tags={job.tags}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                isSaved={job.isSaved ?? savedSet.has(job.jobId)}
                isApplied={job.isApplied ?? appliedSet.has(job.jobId)}
                showAppliedBadge={false}
                matchPercentage={job.matchPercentage}
                onApply={() => handleApplyFromRec(job)}
                onSave={() => handleSaveFromRec(job)}
              />
            ))
          ) : (
            <p className="text-gray-600">No recommendations yet.</p>
          )}
        </div>
      );
    }

    if (activeTab === "skilltest") {
      return (
        <SkillTestModule
          history={skillHistory}
          onRefresh={async () => {
            try {
              const res = await api.get(SKILL_HISTORY, { params: { page: 1, limit: 50 } });
              const list: any[] =
                Array.isArray(res.data) ? res.data :
                  res.data?.tests ?? res.data?.Tests ??
                  res.data?.history ?? res.data?.History ??
                  res.data?.results ?? res.data?.data ?? [];
              setSkillHistory((Array.isArray(list) ? list : []).map(normalizeSkillTest));
            } catch (e) {
              console.error("Skill test refresh failed:", e);
              setSkillHistory([]);
            }
          }}
        />
      );
    }

    if (activeTab === "tips") {
      return <ResumeTipsDashboard data={tipsData} loading={tipsLoading} error={tipsError} />;
    }
    if (activeTab === "status") {
      // group by status
      const groups = appliedWithStatus.reduce<Record<string, any[]>>((acc, j) => {
        const key = (j.currentStatus || "Applied").toString();
        (acc[key] ||= []).push(j);
        return acc;
      }, {});

      const order = ["Applied", "Shortlisted", "Interview", "Offered", "Hired", "On Hold", "Rejected"];
      const sorted = [
        ...order.filter(s => groups[s]?.length),
        ...Object.keys(groups).filter(s => !order.includes(s)),
      ];

      return (
        <div className="space-y-8">
          {sorted.length === 0 ? (
            <p className="text-gray-600">No applications yet.</p>
          ) : (
            sorted.map(st => (
              <div key={st}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg font-semibold">{st}</span>
                  <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    {groups[st].length}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {groups[st].map((job) => {
                    const tl = timelines[job.jobId];
                    const isLoading = tlLoadingId === job.jobId;
                    const hasErr = tlErrorId === job.jobId;

                    return (
                      <div key={job.jobId} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{job.title}</div>
                            <div className="text-sm text-gray-600 truncate">
                              {(job.company?.name || "—")} • {job.location}
                            </div>
                          </div>
                          <span className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-medium
  ${STATUS_BADGE[job.currentStatus] ?? "bg-gray-100 text-gray-700"}`}>
                            {job.currentStatus || "Applied"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() =>
                              tl
                                ? setTimelines((m) => {
                                  const { [job.jobId]: _, ...rest } = m; // delete key
                                  return rest;
                                })
                                : loadTimeline(job.jobId)
                            } className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50"
                          >
                            {tl ? "Hide timeline" : isLoading ? "Loading…" : "View timeline"}
                          </button>
                          <button
                            onClick={() => handleWithdraw(job.jobId)}
                            className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black"
                          >
                            Withdraw
                          </button>
                        </div>

                        {hasErr && <div className="mt-3 text-sm text-red-600">Could not load timeline.</div>}

                        {tl && (
                          <ol className="mt-4 space-y-3 border-t pt-3">
                            {tl.length === 0 ? (
                              <li className="text-sm text-gray-600">No status history yet.</li>
                            ) : (
                              tl.map((ev, i) => (
                                <li key={i} className="text-sm">
                                  <div className="flex items-start gap-3">
                                    <span className="mt-[2px] h-2 w-2 rounded-full bg-gray-400" />
                                    <div>
                                      <div className="font-medium">{ev.status}</div>
                                      <div className="text-gray-600">
                                        {ev.at ? formatDateDDMMYYYY(ev.at) : "—"}
                                        {ev.by ? <span className="ml-2 text-xs text-gray-500">by {ev.by}</span> : null}
                                      </div>
                                      {ev.note && <div className="text-gray-700">{ev.note}</div>}
                                    </div>
                                  </div>
                                </li>
                              ))
                            )}
                          </ol>
                        )}

                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    // Compare
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-600">
            Select 2–4 jobs to compare.
          </p>
          <button
            disabled={!canCompare}
            className={`px-5 py-2 rounded-md ${canCompare ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
            onClick={submitCompare}
          >
            Compare Now ({compareIds.length} selected)
          </button>
        </div>

        {Array.isArray(compareResult) && compareResult.length > 0 && renderCompareTable(compareResult)}

        <div className="grid gap-6 md:grid-cols-2 mt-6">
          {allJobsForCompare.map((job) => {
            const selected = compareIds.includes(job.jobId);
            return (
              <div
                key={job.jobId}
                role="button"
                aria-pressed={selected}
                tabIndex={0}
                onClick={() => toggleCompare(job.jobId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCompare(job.jobId);
                  }
                }}
                className={`relative overflow-visible rounded-2xl border bg-white transition cursor-pointer select-none
                  ${selected
                    ? "border-blue-200 ring-2 ring-blue-500 shadow-md"
                    : "border-gray-200 hover:shadow-sm hover:ring-1 hover:ring-gray-200"}`}
              >
                {selected && (
                  <span
                    className="absolute -top-3 -left-3 z-20 inline-flex h-7 w-7 items-center justify-center
                               rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white"
                    aria-hidden="true"
                    title="Selected"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M16.707 5.293a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3A 1 1 0 1 1 6.293 9.293L8.5 11.5l6.543-6.543a1 1 0 0 1 1.664.336Z" />
                    </svg>
                  </span>
                )}

                <CareerJobCard
                  jobId={job.jobId}
                  title={job.title}
                  location={job.location}
                  company={job.company}
                  tags={job.tags}
                  salaryMin={job.salaryMin}
                  salaryMax={job.salaryMax}
                  readOnly
                  dense
                  showSalary={false}
                  showAppliedBadge={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [
    activeTab,
    loading,
    appliedJobs,
    savedJobs,
    recommended,
    skillHistory,
    compareIds,
    canCompare,
    compareResult,
    allJobsForCompare,
    savedSet,
    appliedSet,
    tipsData, tipsLoading, tipsError,
    appliedWithStatus, timelines, tlLoadingId, tlErrorId   // ← add these
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Career Hub</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        {tabButton("applied", "Applied Jobs")}
        {tabButton("saved", "Saved Jobs")}
        {tabButton("recommended", "Recommendations")}
        {tabButton("skilltest", "Skill Test")}
        {tabButton("compare", "Compare")}
        {tabButton("tips", "Resume Design Tips (AI)")}
        {tabButton("status", "Applications")}

      </div>

      {content}
    </div>
  );
}
