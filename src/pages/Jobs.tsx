import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { onAuthChanged, authStorage } from "../lib/api";
import FilterPanel, { type Filters } from "../components/FilterPanel";
import JobCard, { JobCardSkeleton } from "../components/JobCard";

type Job = {
  jobId: number;
  title: string;
  location?: string;
  company?: { name?: string; logoUrl?: string };
  tags?: string[];
  experienceRequired?: number;
  salaryMin?: number;
  salaryMax?: number;
  isRemote?: boolean;
  isUrgent?: boolean;
  isSaved?: boolean;
  isApplied?: boolean;
};

type Options = {
  locations: string[];
  departments: string[];
  roleCategories: string[];
  industries: string[];
  companyTypes: string[];
  educations: string[];
  durations: string[];
  experienceLevels: string[];
  businessTypes: string[];
  postedBy: string[];
  topCompanies: string[];
};

export default function Jobs() {
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => parseFilters(params));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState<number>(Number(params.get("page") || 1));
  const pageSize = 12;

  // 🔔 bump on auth change to refetch; also clear flags instantly on logout
  const [authRev, setAuthRev] = useState(0);
  useEffect(() => {
    return onAuthChanged(() => {
      const authed = !!authStorage.getToken();

      if (!authed) {
        setJobs(prev => prev.map(j => ({ ...j, isApplied: false, isSaved: false })));
      }
      setAuthRev(x => x + 1);
    });
  }, []);

  const [options, setOptions] = useState<Options>({
    locations: [],
    departments: [],
    roleCategories: [],
    industries: [],
    companyTypes: [],
    educations: [],
    durations: [],
    experienceLevels: [],
    businessTypes: [],
    postedBy: [],
    topCompanies: [],
  });

  // fetch available options once (ONLY /api/jobs/filters)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await api.get("/api/jobs/filters");
        if (!mounted || !Array.isArray(data)) return;

        const mapKey: Record<string, keyof Options> = {
          Location: "locations",
          Department: "departments",
          RoleCategory: "roleCategories",
          Industry: "industries",
          CompanyType: "companyTypes",
          Education: "educations",
          Duration: "durations",
          ExperienceLevel: "experienceLevels",
          BusinessType: "businessTypes",
          PostedBy: "postedBy",
          TopCompany: "topCompanies",
        };

        const acc: Options = {
          locations: [],
          departments: [],
          roleCategories: [],
          industries: [],
          companyTypes: [],
          educations: [],
          durations: [],
          experienceLevels: [],
          businessTypes: [],
          postedBy: [],
          topCompanies: [],
        };

        (data as any[]).forEach((row) => {
          const key = mapKey[row?.type];
          if (key) acc[key] = Array.isArray(row?.options) ? row.options : [];
        });

        setOptions(acc);
      } catch (err) {
        console.warn("[jobs] failed to load /api/jobs/filters", err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // ---- required handlers for JobCard ----
  const handleApply = async (jobId: number) => {
    try {
      await api.post(`/api/jobs/apply/${jobId}`);
      setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, isApplied: true, isSaved: false } : j));
    } catch (e) {
      console.warn("[jobs] apply failed", e);
    }
  };

  const handleWithdraw = async (jobId: number) => {
    try {
      await api.post(`/api/jobs/withdraw/${jobId}`);
      setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, isApplied: false } : j));
    } catch (e) {
      console.warn("[jobs] withdraw failed", e);
    }
  };

  const handleUnsave = async (jobId: number) => {
    try {
      await api.post(`/api/jobs/unsave/${jobId}`);
      setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, isSaved: false } : j));
    } catch (e) {
      console.warn("[jobs] unsave failed", e);
    }
  };
  // --------------------------------------

  // SINGLE EFFECT that covers all fetch cases
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    setParams(stringifyParams({ ...filters, page }), { replace: true });

    const single = pickSingleFilter(filters);

    (async () => {
      try {
        if (single?.type && single?.value && !filters.q) {
          const { data } = await api.get("/api/jobs/filter", {
            params: { type: single.type, value: single.value, page, limit: pageSize },
          });
          if (!mounted) return;
          const list: any[] = Array.isArray(data?.results) ? data.results : [];
          setJobs(list.map(mapApiJob));
          setTotal(Number(data?.total ?? list.length));
          return;
        }

        if (filters.q && filters.q.trim()) {
          const { data } = await api.get("/api/jobs/search", {
            params: { query: filters.q.trim(), page, limit: pageSize },
          });
          if (!mounted) return;
          const list: any[] = Array.isArray(data?.results) ? data.results : [];
          setJobs(list.map(mapApiJob));
          setTotal(Number(data?.total ?? list.length));
          return;
        }

        const { data } = await api.get("/api/jobs/advanced-filter", {
          params: {
            range: filters.postedWithin || "last30days",
            industry: (filters.industry || [])[0],
            location: filters.location || undefined,
            workMode: filters.workMode && filters.workMode !== "Any" ? filters.workMode : undefined,
            minExp: filters.expMin ?? 0,
            maxExp: filters.expMax ?? 50,
            page,
            limit: pageSize,
          },
        });

        if (!mounted) return;
        const list: any[] = Array.isArray(data?.results) ? data.results : [];
        setJobs(list.map(mapApiJob));
        setTotal(Number(data?.total ?? list.length));
      } catch (err) {
        if (!mounted) return;
        console.warn("[jobs] fetch failed", err);
        setJobs([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [filters, page, setParams, authRev]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8 grid lg:grid-cols-12 gap-6">
      {/* FILTERS */}
      <div className="lg:col-span-3">
        <FilterPanel
          value={filters}
          options={options}
          onChange={(next) => setFilters(next)}
          onApply={() => setPage(1)}
          onClear={() => {
            setFilters({});
            setPage(1);
          }}
          onSaveSearch={() => {}}
          savedSearches={[]}
          onLoadSaved={() => {}}
        />
      </div>

      {/* RESULTS */}
      <div className="lg:col-span-9">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            {loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {chipsFromFilters(filters).map((c) => (
            <button
              key={c.key + String(c.value)}
              className="chip hover:bg-gray-100"
              onClick={() => setFilters(c.remove(filters))}
              title="Remove"
            >
              {c.label}
              <span className="ml-1">×</span>
            </button>
          ))}
          {chipsFromFilters(filters).length > 0 && (
            <button className="chip" onClick={() => setFilters({})}>
              Clear
            </button>
          )}
        </div>

        {/* items-stretch => equal-height cards, buttons align */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
            : jobs.length === 0
              ? <EmptyState />
              : jobs.map((j) => (
                  <JobCard
                    key={j.jobId}
                    jobId={j.jobId}
                    title={j.title}
                    location={j.location}
                    company={j.company}
                    tags={j.tags}
                    salaryMin={j.salaryMin}
                    salaryMax={j.salaryMax}
                    isUrgent={j.isUrgent}
                    isSaved={j.isSaved}
                    isApplied={j.isApplied}
                    onApply={() => handleApply(j.jobId)}
                    onWithdraw={() => handleWithdraw(j.jobId)}
                    onUnsave={() => handleUnsave(j.jobId)}
                  />
                ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            className="btn btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <div className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </div>
          <button
            className="btn btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */
function EmptyState() {
  return (
    <div className="col-span-full text-center py-16">
      <div className="text-lg font-medium">No jobs found</div>
      <p className="text-gray-600 text-sm mt-1">
        Try changing filters or searching a different keyword.
      </p>
    </div>
  );
}

/* ---------- helpers ---------- */
function parseFilters(sp: URLSearchParams): Filters {
  const arr = (v?: string | null) =>
    v ? v.split(",").map(s => s.trim()).filter(Boolean) : undefined;

  const bool = (v?: string | null) =>
    v == null ? undefined : v === "true" ? true : v === "false" ? false : undefined;

  return {
    q: sp.get("q") || undefined,
    location: sp.get("location") || undefined,
    workMode: (sp.get("workMode") as Filters["workMode"]) || undefined,
    expMin: sp.get("expMin") ? Number(sp.get("expMin")) : undefined,
    expMax: sp.get("expMax") ? Number(sp.get("expMax")) : undefined,
    salaryMin: sp.get("salaryMin") ? Number(sp.get("salaryMin")) : undefined,
    salaryMax: sp.get("salaryMax") ? Number(sp.get("salaryMax")) : undefined,
    urgent: bool(sp.get("urgent")),
    department: arr(sp.get("department")),
    roleCategory: arr(sp.get("roleCategory")),
    industry: arr(sp.get("industry")),
    companyType: arr(sp.get("companyType")),
    education: arr(sp.get("education")),
    duration: arr(sp.get("duration")),
    experienceLevel: arr(sp.get("experienceLevel")),
    businessType: arr(sp.get("businessType")),
    postedBy: arr(sp.get("postedBy")),
    topCompanies: arr(sp.get("topCompanies")),
    postedWithin: (sp.get("postedWithin") as Filters["postedWithin"]) || undefined,
    sort: (sp.get("sort") as Filters["sort"]) || "relevance",
  };
}

// tolerant mapper for various backend shapes/casing
function mapApiJob(r: any): Job {
  const company = r.company || {};
  return {
    jobId: r.JobId ?? r.jobId,
    title: r.Title ?? r.title ?? "Untitled",
    location: r.Location ?? r.location,
    company: {
      name: r.CompanyName ?? company.name ?? company.Name,
      logoUrl: r.LogoUrl ?? company.logoUrl ?? company.LogoUrl,
    },
    tags: r.Tags
      ? (Array.isArray(r.Tags) ? r.Tags : String(r.Tags).split(",").map((t: string) => t.trim()))
      : (r.tags ?? []),
    experienceRequired: r.ExperienceRequired ?? r.experienceRequired,
    salaryMin: r.SalaryMin ?? r.salaryMin,
    salaryMax: r.SalaryMax ?? r.salaryMax,
    isRemote: r.IsRemote ?? r.isRemote,
    isUrgent: r.IsUrgent ?? r.isUrgent,
    isSaved: (r.isSaved ?? r.IsSaved) ?? false,
    isApplied: (r.isApplied ?? r.IsApplied) ?? false,
  };
}

/** backend’s single “filter by one type/value” endpoint */
function pickSingleFilter(f: Filters): { type?: string; value?: string } {
  if (f.industry?.length) return { type: "Industry", value: f.industry[0] };
  if (f.department?.length) return { type: "Department", value: f.department[0] };
  if (f.roleCategory?.length) return { type: "RoleCategory", value: f.roleCategory[0] };
  if (f.companyType?.length) return { type: "CompanyType", value: f.companyType[0] };
  if (f.experienceLevel?.length) return { type: "ExperienceLevel", value: f.experienceLevel[0] };
  if (f.businessType?.length) return { type: "BusinessType", value: f.businessType[0] };
  if (f.education?.length) return { type: "Education", value: f.education[0] };
  if (f.duration?.length) return { type: "Duration", value: f.duration[0] };
  if (f.postedBy?.length) return { type: "PostedBy", value: f.postedBy[0] };
  if (f.topCompanies?.length) return { type: "TopCompany", value: f.topCompanies[0] };
  return {};
}

function stringifyParams(obj: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  return sp;
}

function chipsFromFilters(f: Filters) {
  type Chip = {
    key: keyof Filters | string;
    value: any;
    label: string;
    remove: (x: Filters) => Filters;
  };
  const chips: Chip[] = [];

  if (f.q) chips.push({ key: "q", value: f.q, label: `Keyword: ${f.q}`, remove: (x) => ({ ...x, q: undefined }) });
  if (f.location) chips.push({ key: "location", value: f.location, label: `Location: ${f.location}`, remove: (x) => ({ ...x, location: undefined }) });
  if (f.workMode && f.workMode !== "Any") chips.push({ key: "workMode", value: f.workMode, label: `Mode: ${f.workMode}`, remove: (x) => ({ ...x, workMode: "Any" as Filters["workMode"] }) });
  if (f.urgent) chips.push({ key: "urgent", value: true, label: "Urgent only", remove: (x) => ({ ...x, urgent: undefined }) });

  const arr = <K extends keyof Filters>(key: K, title: string) => {
    (f[key] as string[] | undefined || []).forEach((v) => {
      chips.push({
        key: String(key),
        value: v,
        label: `${title}: ${v}`,
        remove: (x) => ({
          ...x,
          [key]: ((x[key] as string[]) || []).filter((s) => s !== v)
        } as Filters),
      });
    });
  };

  arr("department", "Dept");
  arr("roleCategory", "Role");
  arr("industry", "Industry");
  arr("companyType", "Company type");
  arr("education", "Education");
  arr("duration", "Duration");
  arr("experienceLevel", "Level");
  arr("businessType", "Business");
  arr("postedBy", "Posted by");
  arr("topCompanies", "Company");

  if (f.postedWithin && f.postedWithin !== "any") {
    const map: Record<string, string> = { "1d": "1d", "3d": "3d", "7d": "7d", "30d": "30d" };
    chips.push({
      key: "postedWithin",
      value: f.postedWithin,
      label: `Posted: ${map[f.postedWithin] || f.postedWithin}`,
      remove: (x) => ({ ...x, postedWithin: undefined }),
    });
  }

  return chips;
}
