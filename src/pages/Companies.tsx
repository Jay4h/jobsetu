//src/pages/Companies.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import CompanyCard, { CompanyCardSkeleton } from "../components/CompanyCard";

type Company = {
  companyId: number;
  name: string;
  logoUrl?: string | null;
  industry?: string | null;
  type?: string | null;
  slug?: string | null;
  description?: string | null;
};

type Options = {
  industries: string[];
  companyTypes: string[];
};

export default function Companies() {
  // search + filters
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [industry, setIndustry] = useState<string>("");
  const [companyType, setCompanyType] = useState<string>("");
  const [approved, setApproved] = useState<"any" | "true" | "false">("any"); // 👈 default to ANY

  // options
  const [opts, setOpts] = useState<Options>({ industries: [], companyTypes: [] });

  // results
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  // input ref
  const inputRef = useRef<HTMLInputElement>(null);

  // load Industry & CompanyType options
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/jobs/filters");
        if (!mounted || !Array.isArray(data)) return;

        const mapKey: Record<string, keyof Options> = {
          Industry: "industries",
          CompanyType: "companyTypes",
        };

        const acc: Options = { industries: [], companyTypes: [] };

        (data as any[]).forEach((row) => {
          const key = mapKey[row?.type];
          if (key) acc[key] = Array.isArray(row?.options) ? row.options : [];
        });

        setOpts(acc);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // debounce typing
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // fetch companies (supports empty query)
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const params: any = { query: debounced, page, limit };
        if (industry) params.industry = industry;
        if (companyType) params.type = companyType;
        if (approved !== "any") params.approved = approved === "true";

        const { data } = await api.get("/api/jobs/companies/search", { params });

        if (!mounted) return;
        const list: any[] = Array.isArray(data?.results) ? data.results : [];
        setCompanies(
          list.map((c) => ({
            companyId: c.CompanyId ?? c.companyId,
            name: c.name ?? c.Name ?? "Company",
            logoUrl: c.logoUrl ?? c.LogoUrl,
            industry: c.Industry ?? c.industry,
            type: c.Type ?? c.type,
            slug: c.Slug ?? c.slug,
            description: c.Description ?? c.description,
          }))
        );
        setTotal(Number(data?.total ?? list.length));
      } catch {
        if (!mounted) return;
        setCompanies([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [debounced, page, industry, companyType, approved]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total]
  );

  const runSearchNow = () => {
    inputRef.current?.focus();
    setPage(1);
    setDebounced(q.trim());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearchNow();
    }
  };

  const canSearch = q.trim().length > 0;

  // chips for active filters
  const chips = [
    industry && { key: "industry", label: `Industry: ${industry}`, remove: () => { setIndustry(""); setPage(1); } },
    companyType && { key: "type", label: `Type: ${companyType}`, remove: () => { setCompanyType(""); setPage(1); } },
    approved !== "any" && { key: "approved", label: `Approved: ${approved === "true" ? "Yes" : "No"}`, remove: () => { setApproved("any"); setPage(1); } },
    debounced && { key: "q", label: `Keyword: ${debounced}`, remove: () => { setQ(""); setDebounced(""); setPage(1); } },
  ].filter(Boolean) as { key: string; label: string; remove: () => void }[];

  const showHintShowAll =
    !loading && total === 0 && approved === "true";

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
      <h1 className="text-xl font-semibold">Companies</h1>

      {/* controls */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            onKeyDown={onKeyDown}
            placeholder="Search companies by name, industry, type…"
            className="input w-full sm:w-[480px]"
            aria-label="Search companies"
          />
          <button
            className="btn btn-ghost"
            onClick={runSearchNow}
            disabled={!canSearch}
            title={canSearch ? "Search companies" : "Type to search"}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
            className="select"
            title="Filter by Industry"
          >
            <option value="">All industries</option>
            {opts.industries.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select
            value={companyType}
            onChange={(e) => { setCompanyType(e.target.value); setPage(1); }}
            className="select"
            title="Filter by Company Type"
          >
            <option value="">All company types</option>
            {opts.companyTypes.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select
            value={approved}
            onChange={(e) => { setApproved(e.target.value as any); setPage(1); }}
            className="select"
            title="Show approved/unapproved"
          >
            <option value="any">Approved or not</option>
            <option value="true">Approved only</option>
            <option value="false">Unapproved only</option>
          </select>

          <button
            className="btn btn-ghost"
            onClick={() => { setIndustry(""); setCompanyType(""); setApproved("any"); setQ(""); setDebounced(""); setPage(1); }}
          >
            Clear all
          </button>
        </div>

        {/* chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.key} className="chip hover:bg-gray-100" onClick={c.remove} title="Remove">
                {c.label}
                <span className="ml-1">×</span>
              </button>
            ))}
          </div>
        )}

        {/* summary / helpful hint */}
        <div className="text-sm text-gray-600">
          {loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}
          {showHintShowAll && (
            <button
              className="ml-3 link"
              onClick={() => setApproved("any")}
              title="Include unapproved companies"
            >
              Show unapproved too
            </button>
          )}
        </div>
      </div>

      {/* results */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CompanyCardSkeleton key={i} />)
          : companies.length === 0
            ? <EmptyState typed={!!debounced || !!industry || !!companyType || approved !== "any"} />
            : companies.map((c) => <CompanyCard key={c.companyId} {...c} />)}
      </div>

      {/* pagination */}
      {companies.length > 0 && (
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
      )}
    </div>
  );
}

function EmptyState({ typed }: { typed: boolean }) {
  return (
    <div className="col-span-full text-center py-16">
      <div className="text-lg font-medium">
        {typed ? "No companies match your filters" : "No companies yet"}
      </div>
      <p className="text-gray-600 text-sm mt-1">
        Try changing filters or searching a different keyword.
      </p>
    </div>
  );
}
