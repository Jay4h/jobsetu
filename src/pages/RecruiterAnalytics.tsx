import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

type BreakdownRow = { label: string; count: number };
type DailyRow = { date: string; count: number };
type TopJob = {
  jobId?: number; JobId?: number;
  title?: string; Title?: string;
  applicants?: number; Applicants?: number; ApplicantCount?: number;
};

export default function RecruiterAnalytics() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get("/api/recruiter/analytics");
        if (!alive) return;
        setData(r.data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.response?.data ?? e?.message ?? "Failed to load analytics.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // format numbers; keep 0–2 decimals for averages
  const n = (x: any, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }) =>
    new Intl.NumberFormat(undefined, opts).format(Number(x ?? 0));

  const totalJobs = data?.totalJobs ?? data?.TotalJobs ?? 0;
  const activeJobs = data?.activeJobs ?? data?.ActiveJobs ?? 0;
  const expiredJobs = data?.expiredJobs ?? data?.ExpiredJobs ?? 0;
  const totalApplicants = data?.totalApplicants ?? data?.TotalApplicants ?? 0;
  const avgApplicantsPerJob = data?.avgApplicantsPerJob ?? data?.AvgApplicantsPerJob ?? 0;

  const breakdownRows: BreakdownRow[] = useMemo(() => {
    const raw: any[] = data?.statusBreakdown ?? data?.StatusBreakdown ?? [];
    return (Array.isArray(raw) ? raw : [])
      .map(r => ({
        label: (r.Status ?? r.status ?? "Unknown").toString(),
        count: Number(r.Count ?? r.count ?? 0),
      }))
      .filter(x => x.label);
  }, [data]);

  const daily: DailyRow[] = useMemo(() => {
    const raw: any[] = data?.dailyApplications ?? data?.DailyApplications ?? [];
    return (Array.isArray(raw) ? raw : []).map(r => ({
      date: (r.Date ?? r.date ?? "").toString(),
      count: Number(r.Count ?? r.count ?? 0),
    }));
  }, [data]);

  const topJobs: TopJob[] = Array.isArray(data?.topJobs ?? data?.TopJobs)
    ? (data.topJobs ?? data.TopJobs)
    : [];

  const maxDaily = Math.max(1, ...daily.map(x => x.count));

  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;
  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid sm:grid-cols-5 gap-3">
        <Card k="Total Jobs" v={n(totalJobs)} />
        <Card k="Active" v={n(activeJobs)} />
        <Card k="Expired" v={n(expiredJobs)} />
        <Card k="Total Applicants" v={n(totalApplicants)} />
        <Card k="Avg applicants / job" v={n(avgApplicantsPerJob)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Status breakdown */}
        <div className="rounded-2xl border p-4">
          <div className="font-semibold mb-3">Status breakdown</div>
          {breakdownRows.length === 0 ? (
            <div className="text-sm text-gray-600">No data.</div>
          ) : (
            <ul className="space-y-2">
              {breakdownRows.map((row, i) => (
                <li key={`${row.label}-${i}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{row.label}</span>
                    <span className="font-medium">{n(row.count, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded mt-1 overflow-hidden">
                    <div
                      className="h-2 bg-blue-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (row.count / Math.max(1, Math.max(...breakdownRows.map(b => b.count)))) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Daily applications */}
        <div className="rounded-2xl border p-4">
          <div className="font-semibold mb-3">Daily applications (last 7 days)</div>
          {daily.length === 0 ? (
            <div className="text-sm text-gray-600">No data.</div>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {daily.map((d, i) => {
                const h = (d.count / maxDaily) * 100;
                return (
                  <div key={`${d.date}-${i}`} className="flex flex-col items-center gap-1">
                    <div
                      className="w-6 bg-emerald-500 rounded"
                      style={{ height: `${Math.max(6, h)}%` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <div className="text-[10px] text-gray-600">{formatShortDate(d.date)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top jobs */}
        <div className="rounded-2xl border p-4">
          <div className="font-semibold mb-3">Top jobs by applicants</div>
          {topJobs.length === 0 ? (
            <div className="text-sm text-gray-600">No applications yet.</div>
          ) : (
            <ol className="space-y-2 text-sm">
              {topJobs.map((j, i) => (
                <li key={(j.jobId ?? j.JobId ?? i).toString()} className="flex items-center justify-between">
                  <span className="truncate">{j.title ?? j.Title ?? `Job #${j.jobId ?? j.JobId}`}</span>
                  <span className="font-medium">
                    {n(j.applicants ?? j.Applicants ?? j.ApplicantCount ?? 0, { maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ k, v }: { k: string; v: any }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-gray-500">{k}</div>
      <div className="text-2xl font-semibold">{v}</div>
    </div>
  );
}

function formatShortDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}
