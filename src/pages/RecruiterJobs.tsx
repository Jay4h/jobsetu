// src/pages/RecruiterJobs.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";

type JobRow = {
  jobId: number;
  title: string;
  location?: string;
  status?: string;           // "Open", "Closed", "Deleted", etc.
  applicationCount?: number;
  expiryDate?: string | null; // <-- used for auto-expiry indicator
  createdAt?: string | null;
};

function pick<T>(v: any, keys: string[], fallback?: T): T {
  for (const k of keys) if (v?.[k] !== undefined) return v[k];
  return fallback as T;
}

// simple badge helper for expiry
function expiryBadge(expiry?: string | null) {
  if (!expiry) return null;
  const end = new Date(expiry);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return { text: "Expired", cls: "bg-red-50 text-red-700 ring-red-200" };

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const text = days > 0 ? `Ends in ${days}d` : hours > 0 ? `Ends in ${hours}h` : "Ends soon";
  return { text, cls: "bg-amber-50 text-amber-700 ring-amber-200" };
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// DELETE helper
async function deleteJob(jobId: number, onAfter?: () => void) {
  if (!jobId) return toast.error("Invalid job id");
  const ok = window.confirm(
    "Delete this job? Applicants and history remain, but the job will be hidden."
  );
  if (!ok) return;
  try {
    await api.delete(`/api/recruiter/delete-job/${jobId}`, { params: { force: true } });
    toast.success("Job deleted");
    onAfter?.();
  } catch (e: any) {
    toast.error(e?.response?.data?.message || e?.message || "Delete failed");
  }
}

function normalizeJobs(payload: any): JobRow[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.results ?? payload?.jobs ?? payload?.Jobs ?? payload?.data ?? payload?.Data ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((j: any) => ({
      jobId:            pick<number>(j, ["jobId", "JobId"], 0),
      title:            pick<string>(j, ["title", "Title"], "Untitled"),
      location:         pick<string>(j, ["location", "Location"]),
      status:           pick<string>(j, ["status", "Status"]),
      applicationCount: pick<number>(j, ["applicationCount", "ApplicationCount"], 0),
      expiryDate:       pick<string | null>(j, ["expiryDate", "ExpiryDate"], null),
      createdAt:        pick<string | null>(j, ["createdAt", "CreatedAt"], null),
    }))
    .filter((j) => j.jobId)
    .filter((j) => (j.status || "").toLowerCase() !== "deleted");
}

export default function RecruiterJobs() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const loadJobs = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get("/api/recruiter/jobs", { params: { page: 1, limit: 50 } });
      setRows(normalizeJobs(r.data));
    } catch (e: any) {
      setErr(e?.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return !term ? rows : rows.filter(r => r.title.toLowerCase().includes(term));
  }, [rows, q]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 w-72"
            placeholder="Search job title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Link to="/recruiter/post" className="px-4 py-2 rounded-xl bg-black text-white">
            + Post Job
          </Link>
        </div>
      </div>

      {rows.length === 0 && <div className="text-gray-500">No jobs yet.</div>}

      <div className="grid gap-3">
        {filtered.map((j) => {
          const exp = expiryBadge(j.expiryDate);
          const isExpired = exp?.text === "Expired";
          const state = (j.status || "Open").toLowerCase();
          const openState =
            isExpired ? "Expired" : state === "closed" ? "Closed" : "Open";
          const stateCls =
            isExpired ? "bg-red-50 text-red-700 ring-red-200"
            : state === "closed" ? "bg-gray-50 text-gray-700 ring-gray-200"
            : "bg-green-50 text-green-700 ring-green-200";

          return (
            <div key={j.jobId} className="border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{j.title}</div>
                  <span className={`chip ${stateCls}`}>{openState}</span>
                  {exp && <span className={`chip ${exp.cls}`}>{exp.text}</span>}
                </div>
                <div className="text-sm text-gray-500">
                  {j.location ?? "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Posted: {fmtDate(j.createdAt)} • Expires: {fmtDate(j.expiryDate)} • Applicants: {j.applicationCount ?? 0}
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  className="px-3 py-1.5 rounded-xl border"
                  to={`/recruiter/jobs/${j.jobId}/applicants`}
                >
                  Applicants
                </Link>
                <Link className="px-3 py-1.5 rounded-xl border" to={`/recruiter/jobs/${j.jobId}/edit`}>
                  Edit
                </Link>
                <Link className="px-3 py-1.5 rounded-xl border" to={`/recruiter/jobs/${j.jobId}/saved`}>
                  Saved
                </Link>
                <button
                  onClick={() => deleteJob(j.jobId, loadJobs)}
                  className="px-3 py-1.5 rounded-xl border text-rose-700 border-rose-200 hover:bg-rose-50"
                  title="Delete job"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
