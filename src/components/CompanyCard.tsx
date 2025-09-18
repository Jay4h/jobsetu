//src/components/CompanyCard.tsx
import { Link } from "react-router-dom";

export type CompanyCardProps = {
  companyId: number;
  name: string;
  logoUrl?: string | null;
  industry?: string | null;
  type?: string | null;
  slug?: string | null;
  description?: string | null;
};

export default function CompanyCard({
  companyId, name, logoUrl, industry, type, description,
}: CompanyCardProps) {
  return (
    <div className="card card-hover p-6 h-full flex flex-col">
      <div className="flex items-start gap-4">
        <img
          src={logoUrl || "/logo-placeholder.png"}
          alt={name}
          className="w-14 h-14 rounded-lg bg-gray-100 object-cover shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-lg truncate text-gray-900">{name}</div>
          <div className="text-sm text-gray-600 mt-1">
            {[industry, type].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </div>

      <p className="text-gray-600 mt-4 line-clamp-3 leading-relaxed">
        {description || "No description provided."}
      </p>

      <div className="mt-auto pt-4">
        <Link
          to={`/companies/${companyId}`}
          className="btn btn-ghost w-full justify-center"
          title="See all jobs from this company"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0h8" />
          </svg>
          View Jobs
        </Link>
      </div>
    </div>
  );
}

export function CompanyCardSkeleton() {
  return (
    <div className="card p-4 h-full animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
          <div className="mt-1 h-3 w-1/3 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="mt-3 h-3 w-full bg-gray-200 rounded" />
      <div className="mt-2 h-3 w-4/5 bg-gray-200 rounded" />
      <div className="mt-2 h-3 w-3/5 bg-gray-200 rounded" />
      <div className="mt-4 h-9 w-24 bg-gray-200 rounded" />
    </div>
  );
}
