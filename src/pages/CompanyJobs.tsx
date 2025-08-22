// src/pages/CompanyJobs.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import JobCard, { JobCardSkeleton } from "../components/JobCard";

export function toAbsoluteMedia(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
  const cleanBase = String(base).replace(/\/+$/, "");
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

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

type CompanyHeader = { name: string; logoUrl?: string | null };

export default function CompanyJobs() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = Number(companyId);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 12;

  // ✅ Always render header from canonical companies list
  const [companyHeader, setCompanyHeader] = useState<CompanyHeader>({
    name: "Company",
    logoUrl: "",
  });
  const [headerLoading, setHeaderLoading] = useState(true);

  // ----- Header fetch (companies list → find by id) -----
// ----- Header fetch (use companies/search; no approved filter) -----
useEffect(() => {
  if (!id) return;
  let mounted = true;
  (async () => {
    setHeaderLoading(true);
    try {
      const resp = await api.get("/api/jobs/companies/search", {
        params: { query: "", page: 1, limit: 1000 }, // includes approved + unapproved
      });
      const arr: any[] = resp?.data?.results ?? resp?.data ?? [];
      const found = arr.find((c) => {
        const cid = c.CompanyId ?? c.companyId ?? c.id ?? c.Id;
        return Number(cid) === id;
      });
      if (mounted && found) {
        // This endpoint already returns absolute logoUrl via ToAbsoluteLogoUrl()
        setCompanyHeader({
          name: found.name ?? found.Name ?? "Company",
          logoUrl: found.logoUrl ?? found.LogoUrl ?? "",
        });
      }
    } finally {
      if (mounted) setHeaderLoading(false);
    }
  })();
  return () => { mounted = false; };
}, [id]);
  

  // ----- Jobs fetch (by-company) -----
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const res = await api.get(`/api/jobs/by-company/${id}`, {
          params: { page, limit },
        });

        if (!mounted) return;

        const list: any[] = Array.isArray(res?.data?.results)
          ? res.data.results
          : Array.isArray(res?.data)
          ? res.data
          : [];

        setJobs(list.map(mapApiJob));
        setTotal(Number(res?.data?.total ?? list.length));
      } catch {
        if (!mounted) return;
        setJobs([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total]
  );

  const logoSrc =
    (companyHeader.logoUrl && toAbsoluteMedia(companyHeader.logoUrl)) ||
    "/logo-placeholder.png";

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
      {/* ✅ ALWAYS show company header from companies list */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src={logoSrc}
          alt={companyHeader.name || "Company"}
          className="w-10 h-10 rounded bg-gray-100 object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.src.endsWith("/logo-placeholder.png")) {
              img.src = "/logo-placeholder.png";
            }
          }}
        />
        <h1 className="text-xl font-semibold">
          {headerLoading ? "Loading..." : `${companyHeader.name || "Company"} · Jobs`}
        </h1>
      </div>

      {/* Jobs list */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
          : jobs.length === 0
          ? <EmptyState />
          : jobs.map((j) => (
              <JobCard
                key={j.jobId}
                {...j}
                onApply={() => {}}
                onWithdraw={() => {}}
                onUnsave={() => {}}
              />
            ))}
      </div>

      {/* Pagination */}
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
  );
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-16">
      <div className="text-lg font-medium">No jobs found for this company</div>
      <p className="text-gray-600 text-sm mt-1">
        Check back later or explore other companies.
      </p>
    </div>
  );
}

function mapApiJob(r: any): Job {
  // /api/jobs/by-company returns company = { Name, LogoUrl } and LogoUrl is already absolute (server helper)
  const c = r.company || {};
  return {
    jobId: r.JobId ?? r.jobId,
    title: r.Title ?? r.title ?? "Untitled",
    location: r.Location ?? r.location,
    company: {
      name: c.Name ?? c.name ?? "",
      logoUrl: c.LogoUrl ?? c.logoUrl ?? "",
    },
    tags: r.tags ?? r.Tags ?? [],
    experienceRequired: r.ExperienceRequired ?? r.experienceRequired,
    salaryMin: r.SalaryMin ?? r.salaryMin,
    salaryMax: r.SalaryMax ?? r.salaryMax,
    isRemote: r.IsRemote ?? r.isRemote,
    isUrgent: r.IsUrgent ?? r.isUrgent,
    isSaved: (r.isSaved ?? r.IsSaved) ?? false,
    isApplied: (r.isApplied ?? r.IsApplied) ?? false,
  };
}
