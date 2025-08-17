import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
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

export default function CompanyJobs() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = Number(companyId);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 12;

  const [companyHeader, setCompanyHeader] = useState<{ name?: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/api/jobs/by-company/${id}`, { params: { page, limit } });
        if (!mounted) return;
        const list: any[] = Array.isArray(data?.results) ? data.results : [];
        setJobs(list.map(mapApiJob));
        setTotal(Number(data?.total ?? list.length));

        // Make a simple header from first job’s company if present
        const first = list[0]?.company;
        if (first) setCompanyHeader({ name: first.Name ?? first.name, logoUrl: first.LogoUrl ?? first.logoUrl });
      } catch {
        if (!mounted) return;
        setJobs([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
      <div className="flex items-center gap-3">
        <img
          src={companyHeader?.logoUrl || "/logo-placeholder.png"}
          alt={companyHeader?.name || "Company"}
          className="w-10 h-10 rounded bg-gray-100 object-cover"
        />
        <h1 className="text-xl font-semibold">
          {companyHeader?.name || "Company"} · Jobs
        </h1>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
          : jobs.length === 0
            ? <EmptyState />
            : jobs.map((j) => <JobCard key={j.jobId} {...j} />)}
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
  const company = r.company || {};
  return {
    jobId: r.JobId ?? r.jobId,
    title: r.Title ?? r.title ?? "Untitled",
    location: r.Location ?? r.location,
    company: {
      name: company.Name ?? company.name,
      logoUrl: company.LogoUrl ?? company.logoUrl,
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
