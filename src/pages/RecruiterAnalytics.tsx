// src/pages/RecruiterAnalytics.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

/* recharts */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
} from "recharts";

/* ---------- Types ---------- */
type BreakdownRow = { label: string; count: number };
type DailyRow = { date: string; count: number };
type TopJob = {
  jobId?: number; JobId?: number;
  title?: string; Title?: string;
  applicants?: number; Applicants?: number; ApplicantCount?: number;
};

type JobOpt = { jobId: number; title: string };
type SkillAgg = { name: string; matchPct: number };

export default function RecruiterAnalytics() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* -------- Skill Match (per job) -------- */
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [selJobId, setSelJobId] = useState<number | "">("");
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillErr, setSkillErr] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillAgg[]>([]);
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");
  const [topN, setTopN] = useState<number>(8);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);


  /* ---------- Load summary analytics ---------- */
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

  /* ---------- Load jobs for dropdown ---------- */
  useEffect(() => {
    api
      .get("/api/recruiter/jobs", { meta: { ignoreGlobal401: true } as any })
      .then(({ data }) => {
        const raw = Array.isArray(data?.jobs)
          ? data.jobs
          : Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [];
        const normalized: JobOpt[] = raw
          .map((j: any) => ({
            jobId: j.JobId ?? j.jobId,
            title: j.Title ?? j.title ?? `Job ${j.JobId ?? j.jobId}`,
          }))
          .filter((j: JobOpt) => !!j.jobId);

        setJobs(normalized);
        if (!selJobId && normalized.length) setSelJobId(normalized[0].jobId);
      })
      .catch(() => setJobs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Helpers to convert backend payloads ---------- */
  function toAggregated(resp: any): SkillAgg[] {
    // Preferred aggregated array from backend
    if (Array.isArray(resp?.skills) && resp.skills.length > 0) {
      return resp.skills
        .map((s: any) => ({
          name: s.name ?? s.Skill ?? "Unknown",
          matchPct: Number(s.matchPct ?? s.MatchPct ?? 0),
        }))
        .sort((a: any, b: any) => b.matchPct - a.matchPct);
    }

    // Fallback: compute from public endpoint structure
    const required: string[] = (resp?.requiredSkills ?? [])
      .map((x: any) => String(x ?? "").toLowerCase().trim())
      .filter(Boolean);
    const result = Array.isArray(resp?.result) ? resp.result : [];
    const total = Math.max(1, result.length);
    const anyHasSkills = result.some(
      (r: any) => Array.isArray(r?.Skills) || typeof r?.Skills === "string"
    );
    if (!anyHasSkills || required.length === 0) return [];

    const norm = (r: any) => {
      if (Array.isArray(r?.Skills))
        return r.Skills.map((s: any) => String(s).toLowerCase().trim()).filter(Boolean);
      return String(r?.Skills ?? "")
        .toLowerCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const agg = required.map((rs) => {
      const count = result.reduce(
        (acc: number, r: any) => acc + (norm(r).includes(rs) ? 1 : 0),
        0
      );
      return { name: rs, matchPct: +((count * 100) / total).toFixed(1) };
    });

    return agg.sort((a, b) => b.matchPct - a.matchPct);
  }

  /* ---------- Fetch skill-match for selected job ---------- */
  useEffect(() => {
    if (!selJobId) return;
    setSkillLoading(true);
    setSkillErr(null);

    api
      .get(`/api/recruiter/skill-match-graph/${selJobId}`)
      .then((r) => setSkills(toAggregated(r.data)))
      .catch((e) =>
        setSkillErr(e?.response?.data?.message || e.message || "Failed to load skill match")
      )
      .finally(() => setSkillLoading(false));
  }, [selJobId]);

  /* ---------- Summary cards ---------- */
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
      .map((r) => ({
        label: (r.Status ?? r.status ?? "Unknown").toString(),
        count: Number(r.Count ?? r.count ?? 0),
      }))
      .filter((x) => x.label);
  }, [data]);

  const daily: DailyRow[] = useMemo(() => {
    const raw: any[] = data?.dailyApplications ?? data?.DailyApplications ?? [];
    return (Array.isArray(raw) ? raw : []).map((r) => ({
      date: (r.Date ?? r.date ?? "").toString(),
      count: Number(r.Count ?? r.count ?? 0),
    }));
  }, [data]);

  const topJobs: TopJob[] = Array.isArray(data?.topJobs ?? data?.TopJobs)
    ? (data.topJobs ?? data.TopJobs)
    : [];

  const maxDaily = Math.max(1, ...daily.map((x) => x.count));

  /* ---------- Skill chart helpers ---------- */
  const thresholdColor = (pct: number) =>
    pct < 50 ? "#ef4444" : pct < 75 ? "#f59e0b" : "#22c55e";
  // keep this where it is
  const fullData = (skills || [])
    .slice(0, Math.max(1, topN))
    .map((s) => ({ skill: s.name, match: Math.max(0, Math.min(100, s.matchPct)) }));

  // ⬇️ ADD right below fullData

  const maxMatchVal = Math.max(0, ...fullData.map(d => Number(d.match || 0)));
  const yMax = Math.min(100, Math.max(40, Math.ceil((maxMatchVal + 10) / 10) * 10));

  const headroom = maxMatchVal >= 100 ? 5 : 0;
  const yMaxDisplay = Math.min(110, yMax + headroom);
  const yTicks = [0, 25, 50, 75, 100].filter(v => v <= yMaxDisplay);
  if (!yTicks.includes(yMaxDisplay)) yTicks.push(yMaxDisplay);

  const avgMatch = useMemo(() => {
    if (!fullData.length) return 0;
    const v = fullData.reduce((s, d) => s + (d.match || 0), 0) / fullData.length;
    return Math.round(v);
  }, [fullData]);

  const radarData = useMemo(
    () => fullData.map((d) => ({ ...d, avg: avgMatch })),
    [fullData, avgMatch]
  );

  /* ---------- Early returns AFTER hooks ---------- */
  if (err) return <div className="p-6 text-red-600">{String(err)}</div>;
  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-5 gap-3">
        <Card k="TOTAL JOBS" v={n(totalJobs)} />
        <Card k="ACTIVE" v={n(activeJobs)} />
        <Card k="EXPIRED" v={n(expiredJobs)} />
        <Card k="TOTAL APPLICANTS" v={n(totalApplicants)} />
        <Card k="AVG APPLICANTS / JOB" v={n(avgApplicantsPerJob)} />
      </div>

      {/* Row: Breakdown / Daily / Top jobs */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Status breakdown">
          {breakdownRows.length === 0 ? (
            <EmptyText>No data.</EmptyText>
          ) : (
            <ul className="space-y-2">
              {breakdownRows.map((row, i) => (
                <li key={`${row.label}-${i}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700">{row.label}</span>
                    <span className="font-medium">
                      {n(row.count, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded mt-1 overflow-hidden">
                    <div
                      className="h-1.5 bg-blue-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (row.count /
                              Math.max(1, Math.max(...breakdownRows.map((b) => b.count)))) *
                            100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Daily applications (last 7 days)">
          {daily.length === 0 ? (
            <EmptyText>No data.</EmptyText>
          ) : (
            <div className="flex items-end gap-1.5 h-24">
              {daily.map((d, i) => {
                const h = (d.count / maxDaily) * 100;
                return (
                  <div key={`${d.date}-${i}`} className="flex flex-col items-center gap-1">
                    <div
                      className="w-4 rounded-md"
                      style={{ backgroundColor: "#10b981", height: `${Math.max(6, h)}%` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <div className="text-[10px] text-gray-500">{formatShortDate(d.date)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Top jobs by applicants">
          {topJobs.length === 0 ? (
            <EmptyText>No applications yet.</EmptyText>
          ) : (
            <ol className="space-y-2 text-sm">
              {topJobs.map((j, i) => (
                <li
                  key={(j.jobId ?? j.JobId ?? i).toString()}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">
                    {j.title ?? j.Title ?? `Job #${j.jobId ?? j.JobId}`}
                  </span>
                  <span className="font-medium">
                    {n(j.applicants ?? j.Applicants ?? j.ApplicantCount ?? 0, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* Skill Match % */}
      {/* Skill Match % (same width as the small panels) */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div
          className="rounded-xl border overflow-hidden bg-white"
          style={{ minHeight: 300 }}   // +32px taller
        >
          {/* Header / Toolbar (compact) */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b">
            <div className="font-medium text-sm">Skill Match % (per job)</div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-[11px] text-gray-500">Top</label>
              <select className="h-6 px-2 rounded-md border text-xs" value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}>
                {[6, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              <div className="inline-flex rounded-md border p-0.5">
                <button
                  className={`h-6 px-2 text-xs rounded ${chartType === "bar" ? "bg-gray-900 text-white" : "text-gray-700"}`}
                  onClick={() => setChartType("bar")}
                >Bar</button>
                <button
                  className={`h-6 px-2 text-xs rounded ${chartType === "radar" ? "bg-gray-900 text-white" : "text-gray-700"}`}
                  onClick={() => setChartType("radar")}
                >Radar</button>
              </div>

              <select
                className="h-6 px-2 rounded-md border text-xs min-w-[200px]"
                value={selJobId === "" ? "" : String(selJobId)}
                onChange={(e) => setSelJobId(e.target.value ? Number(e.target.value) : "")}
                disabled={jobs.length === 0}
              >
                {jobs.length === 0 ? <option value="">No jobs found</option> :
                  jobs.map(j => <option key={j.jobId} value={j.jobId}>{j.title}</option>)}
              </select>
            </div>
          </div>

          {/* Body */}
          <div className="px-3 py-2">
            {skillLoading && <div className="text-sm text-gray-500">Loading…</div>}
            {skillErr && <div className="text-sm text-red-600">{skillErr}</div>}
            {!skillLoading && !skillErr && fullData.length === 0 && (
              <div className="text-sm text-gray-500">No skill match data for this job.</div>
            )}

            {!skillLoading && !skillErr && fullData.length > 0 && (
              <div className="w-full" style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart
                      data={fullData}
                      margin={{ top: 24, right: 8, bottom: 12, left: 0 }}   // more top room
                      barCategoryGap={6}
                      barGap={1}
                    >
                      <CartesianGrid vertical={false} stroke="#eef2f7" />
                      <XAxis
                        dataKey="skill"
                        tickLine={false}
                        axisLine={false}
                        height={32}
                        tick={<TruncTick />}
                        padding={{ left: 2, right: 2 }}
                      />
                      <YAxis
                        domain={[0, yMaxDisplay]}          // ← use yMaxDisplay
                        ticks={yTicks}                     // ← use the new ticks
                        tick={{ fontSize: 9, fill: "#6b7280" }}
                        tickFormatter={(v) => `${v}%`}
                        tickLine={false}
                        axisLine={false}
                        width={26}
                      />

                      {yMaxDisplay >= 50 && <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" />}
                      {yMaxDisplay >= 75 && <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="3 3" />}

                      <ReferenceLine
                        y={Math.min(avgMatch, yMaxDisplay)}    // clamp to display max
                        stroke="#0ea5e9"
                        strokeDasharray="4 4"
                        label={{ value: `Avg ${avgMatch}%`, position: "right", fill: "#0ea5e9", fontSize: 10 }}
                      />
                      <Tooltip content={<RichSkillTooltip />} />

                      <Bar dataKey="match" radius={[6, 6, 0, 0]} barSize={24} isAnimationActive animationDuration={350}>
                        {fullData.map((d, i) => {
                          const base = thresholdColor(d.match);
                          const fill = activeIndex === null ? base : activeIndex === i ? base : "#e5e7eb";
                          return <Cell key={i} fill={fill} cursor="pointer" />;
                        })}
                        <LabelList dataKey="match" content={<BarValueLabel />} />   {/* ← custom label */}
                      </Bar>
                    </BarChart>
                  ) : (
                    <RadarChart data={radarData} outerRadius="60%">
                      <PolarGrid stroke="#eef2f7" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 8 }} />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 8 }}
                      />
                      <Tooltip content={<RichSkillTooltip />} />
                      <Radar name="Match" dataKey="match" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.55} />
                      <Radar name="Average" dataKey="avg" stroke="#0ea5e9" fillOpacity={0} strokeDasharray="4 4" />
                    </RadarChart>
                  )}
                </ResponsiveContainer>

              </div>
            )}

            <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#ef4444" }} />
                &lt; 50%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#f59e0b" }} />
                50–74%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#22c55e" }} />
                ≥ 75%
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ---------- Small atoms ---------- */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="font-medium text-sm mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Card({ k, v }: { k: string; v: any }) {
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{k}</div>
      <div className="text-xl font-semibold mt-0.5">{v}</div>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-500">{children}</div>;
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/* Truncated tick with hover title */
function TruncTick(props: any) {
  const { x, y, payload } = props;
  const label: string = payload?.value ?? "";
  const short = label.length > 12 ? label.slice(0, 11).trim() + "…" : label;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={10} textAnchor="end" transform="rotate(-30)" fontSize={12} fill="#6b7280">
        <title>{label}</title>
        {short}
      </text>
    </g>
  );
}

/* Rich tooltip */
function RichSkillTooltip({ active, label, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = Math.round(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border bg-white px-2.5 py-1.5 shadow-sm text-xs">
      <div className="font-medium">{label}</div>
      <div className="text-gray-700">
        Match: <span className="font-semibold">{v}%</span>
      </div>
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
function BarValueLabel(props: any) {
  const { x = 0, y = 0, width = 0, value } = props;
  const v = Math.round(Number(value ?? 0));
  const cx = x + width / 2;

  // default: draw a little above the bar
  let cy = y - 6;

  // if bar touches the top, draw inside the bar so it doesn't clip
  if (v >= 100 && cy < 10) cy = y + 12;

  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={10}
      fontWeight={600}
      fill="#111827"
    >
      {v}%
    </text>
  );
}
