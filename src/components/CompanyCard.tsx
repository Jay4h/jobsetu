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
    <div className="card card-hover p-4 h-full flex flex-col">
      <div className="flex items-start gap-3">
        <img
          src={logoUrl || "/logo-placeholder.png"}
          alt={name}
          className="w-12 h-12 rounded bg-gray-100 object-cover"
        />
        <div className="min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="text-xs text-gray-500">
            {[industry, type].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-3 line-clamp-3">
        {description || "No description provided."}
      </p>

      <div className="mt-auto pt-3">
        <Link
          to={`/companies/${companyId}`}
          className="btn btn-ghost"
          title="See all jobs from this company"
        >
          View jobs
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
