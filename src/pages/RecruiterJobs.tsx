// src/pages/RecruiterJobs.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-toastify";

type JobRow = {
  jobId: number;
  title: string;
  location?: string;
  status?: string;
  applicationCount?: number;
};

function pick<T>(v: any, keys: string[], fallback?: T): T {
  for (const k of keys) if (v?.[k] !== undefined) return v[k];
  return fallback as T;
}

// DELETE helper (already had it; kept as-is)
async function deleteJob(jobId: number, onAfter?: () => void) {
  if (!jobId) return toast.error("Invalid job id");
  const ok = window.confirm(
    "Delete this job? Applicants and history remain, but the job will be hidden."
  );
  if (!ok) return;
  try {
    await api.delete(`/api/recruiter/delete-job/${jobId}`, { params: { force: true } });
    toast.success("Job deleted");
    onAfter?.(); // reload the list
  } catch (e: any) {
    toast.error(e?.response?.data?.message || e?.message || "Delete failed");
  }
}

function normalizeJobs(payload: any): JobRow[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.jobs ?? payload?.Jobs ?? payload?.data ?? payload?.Data ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((j: any) => ({
      jobId: pick<number>(j, ["jobId", "JobId"], 0),
      title: pick<string>(j, ["title", "Title"], "Untitled"),
      location: pick<string>(j, ["location", "Location"]),
      status: pick<string>(j, ["status", "Status"]),
      applicationCount: pick<number>(j, ["applicationCount", "ApplicationCount"], 0),
    }))
    .filter((j) => j.jobId)
    // optional: hide soft-deleted rows
    .filter((j) => (j.status || "").toLowerCase() !== "deleted");
}

export default function RecruiterJobs() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <Link to="/recruiter/post" className="px-4 py-2 rounded-xl bg-black text-white">
          + Post Job
        </Link>
      </div>

      {rows.length === 0 && <div className="text-gray-500">No jobs yet.</div>}

      <div className="grid gap-3">
        {rows.map((j) => (
          <div key={j.jobId} className="border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{j.title}</div>
              <div className="text-sm text-gray-500">{j.location ?? "—"}</div>
              <div className="text-xs text-gray-500 mt-1">
                Status: {j.status ?? "Open"} • Applicants: {j.applicationCount ?? 0}
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

              {/* NEW: Delete */}
              <button
                onClick={() => deleteJob(j.jobId, loadJobs)}
                className="px-3 py-1.5 rounded-xl border text-rose-700 border-rose-200 hover:bg-rose-50"
                title="Delete job"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
