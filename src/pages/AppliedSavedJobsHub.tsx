// src/pages/AppliedSavedJobsHub.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import CareerJobCard from "../components/CareerJobCard";

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
};

const BASE =
  (api as any)?.defaults?.baseURL?.replace(/\/+$/, "") ||
  "https://localhost:44380";
const SKILL_POST = "/api/resume/skill-test";
const SKILL_HISTORY = "/api/resume/skill-test-history";
const buildLogoUrl = (raw?: string) => {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${BASE}${v}`;
  if (/^uploads\//i.test(v)) return `${BASE}/${v}`;
  return `${BASE}/Uploads/Logos/${v}`;
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
    (isObj && (c.name ?? c.Name)) ??
    j.companyName ?? j.CompanyName ??
    (typeof c === "string" ? c : undefined);

  const logoRaw =
    (isObj && (c.logoUrl ?? c.LogoUrl ?? c.logo ?? c.Logo)) ??
    j.companyLogoUrl ?? j.companyLogo ?? j.CompanyLogo ?? j.LogoUrl;

  const company = { name: companyName, logoUrl: buildLogoUrl(logoRaw) };

  return { jobId: id, title, location, company, tags, salaryMin, salaryMax };
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
  certificateUrl?: string;
};

function normalizeSkillTest(r: any): SkillTest {
  return {
    id: Number(r.id ?? r.Id ?? r.testId ?? r.TestId ?? Math.random() * 1e9),
    skill: r.skill ?? r.Skill ?? r.technology ?? r.Technology ?? "—",
    score: Number(r.score ?? r.Score ?? 0),
    provider: r.provider ?? r.Provider,
    durationMin: Number(r.durationMin ?? r.DurationMin ?? r.duration ?? r.Duration ?? 0) || undefined,
    takenAt: r.takenAt ?? r.TakenAt ?? r.date ?? r.Date,  // ✅ supports your 'date'
    remarks: r.remarks ?? r.Remarks ?? r.notes ?? r.Notes,
    certificateUrl: undefined, // backend doesn't send it (fine)
  };
}


/* ---------- Skill Test Module (Submit + History) ---------- */
function SkillTestModule({
  history,
  onRefresh,
}: {
  history: SkillTest[];
  onRefresh: () => void;
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
    setSaving(true);
    try {
      if (file) {
        // multipart
        const fd = new FormData();
        fd.append("skill", skill);
        fd.append("score", String(score));
        if (provider) fd.append("provider", provider);
        if (durationMin !== "") fd.append("durationMin", String(durationMin));
        if (takenAt) fd.append("takenAt", takenAt);
        if (remarks) fd.append("remarks", remarks);
        fd.append("certificate", file);
        await api.post(SKILL_POST, fd);             // ✅ use your POST endpoint
      } else {
        // JSON
        const payload = {
          skill,
          score: Number(score),
          provider: provider || undefined,
          durationMin: durationMin === "" ? undefined : Number(durationMin),
          takenAt: takenAt || undefined,
          remarks: remarks || undefined,
        };
        await api.post(SKILL_POST, payload, {       // ✅ use your POST endpoint
          headers: { "Content-Type": "application/json" },
        });
      }

      alert("Skill test saved!");
      reset();
      onRefresh();
      setSubTab("history");
    } catch (e) {
      console.error("Skill test submit failed:", e);
      alert("Could not save skill test.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("submit")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${subTab === "submit"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
        >
          Submit Result
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${subTab === "history"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
        >
          History
        </button>
      </div>

      {subTab === "submit" ? (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Skill / Technology</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="e.g. React, .NET, SQL"
              />
            </div>
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
            <div>
              <label className="block text-sm text-gray-700 mb-1">Provider (optional)</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. HackerRank"
              />
            </div>
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
            <div>
              <label className="block text-sm text-gray-700 mb-1">Taken on (optional)</label>
              <input
                type="date"
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </div>
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
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Certificate / Proof (optional)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
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
                  <td className="px-4 py-4 text-gray-600" colSpan={7}>
                    No skill tests submitted yet.
                  </td>
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
                    <td className="px-4 py-3">{r.takenAt ? new Date(r.takenAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{r.durationMin != null ? `${r.durationMin} min` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.certificateUrl ? (
                        <a href={r.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          View
                        </a>
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

export default function AppliedSavedJobsHub() {
  const [activeTab, setActiveTab] = useState<
    "applied" | "saved" | "recommended" | "skilltest" | "compare"
  >("applied");

  const [appliedJobs, setAppliedJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Skill Test history
  const [skillHistory, setSkillHistory] = useState<SkillTest[]>([]);

  // compare
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<any>(null);

  // flags for Recommendations/Compare
  const savedSet = useMemo(() => new Set(savedJobs.map(j => j.jobId)), [savedJobs]);
  const appliedSet = useMemo(() => new Set(appliedJobs.map(j => j.jobId)), [appliedJobs]);

  /* ---------- Fetch per tab ---------- */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        if (activeTab === "applied") {
          const res = await api.get("/api/user/applied-jobs", { params: { page: 1, limit: 10 } });
          const list: ApiJob[] = res.data?.appliedJobs ?? res.data?.AppliedJobs ?? (Array.isArray(res.data) ? res.data : []);
          const norm = list.map(normalizeJob);
          if (!cancelled) setAppliedJobs(norm);
        } else if (activeTab === "saved") {
          const res = await api.get("/api/user/saved-jobs", { params: { page: 1, limit: 10 } });
          const list: ApiJob[] = res.data?.savedJobs ?? res.data?.SavedJobs ?? (Array.isArray(res.data) ? res.data : []);
          const norm = list.map(normalizeJob);
          if (!cancelled) setSavedJobs(norm);
        } else if (activeTab === "recommended") {
          const res = await api.get("/api/jobs/recommended", { params: { page: 1, limit: 10 } });
          const list: ApiJob[] = Array.isArray(res.data) ? res.data : (res.data?.recommended ?? res.data?.Recommended ?? []);
          const norm = list.map(normalizeJob);
          if (!cancelled) setRecommended(norm);
        } else if (activeTab === "skilltest") {
          const res = await api.get(SKILL_HISTORY, { params: { page: 1, limit: 50 } }); // ✅ use your GET endpoint
          const list: any[] =
            Array.isArray(res.data) ? res.data :
              res.data?.tests ?? res.data?.Tests ??   // ✅ your shape
              res.data?.history ?? res.data?.History ??
              res.data?.results ?? res.data?.data ?? [];
          const norm = (Array.isArray(list) ? list : []).map(normalizeSkillTest);
          if (!cancelled) setSkillHistory(norm);
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

  /* ---------- Actions for applied/saved ---------- */
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
      setSavedJobs(prev => prev.filter(j => j.jobId !== jobId));
      setCompareIds(prev => prev.filter(id => id !== jobId));
    } catch (e) {
      console.error("Unsave failed", e);
      alert("Could not unsave this job.");
    }
  };

  /* ---------- Compare helpers ---------- */
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
      setCompareResult(res.data);
    } catch (e) {
      console.error("Compare failed", e);
      alert("Could not compare selected jobs.");
    }
  };

  /* ---------- UI helpers ---------- */
  const tabButton = (
    id: "applied" | "saved" | "recommended" | "skilltest" | "compare",
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

  /* ---------- Tab content ---------- */
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
                isSaved={savedSet.has(job.jobId)}
                isApplied={appliedSet.has(job.jobId)}
                showAppliedBadge={false}
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
              const res = await api.get(SKILL_HISTORY, { params: { page: 1, limit: 50 } }); // ✅ your GET endpoint
              const list: any[] =
                Array.isArray(res.data) ? res.data :
                  res.data?.tests ?? res.data?.Tests ??  // ✅ your shape
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

        {compareResult && (
          <div className="mt-6">
            <h3 className="font-semibold text-lg mb-2">Comparison</h3>
            {/* Replace with your table UI if you added it earlier */}
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
              {JSON.stringify(compareResult, null, 2)}
            </pre>
          </div>
        )}

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
                      <path d="M16.707 5.293a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3A1 1 0 1 1 6.293 9.293L8.5 11.5l6.543-6.543a1 1 0 0 1 1.664.336Z" />
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
      </div>

      {content}
    </div>
  );
}
