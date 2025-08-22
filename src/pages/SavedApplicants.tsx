import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

function normalize(payload: any) {
  const raw = Array.isArray(payload) ? payload : (payload?.applicants ?? payload?.Applicants ?? []);
  if (!Array.isArray(raw)) return [];
  return raw.map((a: any) => ({
    id: a.applicationId ?? a.ApplicationId ?? a.id ?? a.Id,
    fullName: a.applicant?.fullName ?? a.FullName ?? a.applicantName ?? "Applicant",
    email: a.applicant?.email ?? a.Email ?? a.applicantEmail ?? "",
    resumeUrl: a.resumeUrl ?? a.ResumeUrl,
  }));
}

export default function SavedApplicants() {
  const { jobId } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/api/recruiter/saved-applicants/${jobId}`)
      .then(r => setRows(normalize(r.data)))
      .catch(e => setErr(e?.response?.data ?? e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-bold">Saved Applicants</h1>
      {rows.map(a => (
        <div key={a.id} className="border rounded-2xl p-4">
          <div className="font-semibold">{a.fullName}</div>
          <div className="text-sm text-gray-500">{a.email}</div>
          {a.resumeUrl && <a className="text-blue-600 text-sm" href={a.resumeUrl} target="_blank" rel="noreferrer">View Resume</a>}
        </div>
      ))}
      {rows.length === 0 && <div className="text-gray-500">None saved.</div>}
    </div>
  );
}
