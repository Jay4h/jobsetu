import { useEffect, useState } from "react";
import api from "../lib/api";

export default function RecruiterAnalytics() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/recruiter/analytics")
      .then(r => setData(r.data))
      .catch(e => setErr(e?.response?.data ?? e.message));
  }, []);

  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;
  if (!data) return <div className="p-6">Loading…</div>;

  const totalJobs = data.totalJobs ?? data.TotalJobs ?? 0;
  const activeJobs = data.activeJobs ?? data.ActiveJobs ?? 0;
  const expiredJobs = data.expiredJobs ?? data.ExpiredJobs ?? 0;
  const totalApplicants = data.totalApplicants ?? data.TotalApplicants ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid sm:grid-cols-4 gap-3">
        <Card k="Total Jobs" v={totalJobs} />
        <Card k="Active" v={activeJobs} />
        <Card k="Expired" v={expiredJobs} />
        <Card k="Total Applicants" v={totalApplicants} />
      </div>
    </div>
  );
}
function Card({k, v}:{k:string; v:any}) {
  return <div className="rounded-2xl border p-4"><div className="text-sm text-gray-500">{k}</div><div className="text-2xl font-semibold">{v}</div></div>;
}
