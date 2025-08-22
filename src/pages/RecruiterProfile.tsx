import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

type ApiResp = {
  hasCompany: boolean;
  recruiter?: {
    fullName: string;
    email: string;
    phone?: string;
    isVerified?: boolean;
    isApproved?: boolean;
  };
  company?: {
    name: string;
    website?: string;
    logo?: string;
    logoUrl?: string;
    description?: string;
    industry?: string;
    type?: string;
    slug?: string;
    isApproved?: boolean;
  };
  jobStats?: {
    totalJobs: number;
    activeJobs: number;
    expiredJobs: number;
    pendingJobs?: number;
  };
};

// Make any media path absolute using your API base URL
function toAbsoluteMedia(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path; // already absolute
const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
  const cleanBase = String(base).replace(/\/+$/, "");
  const cleanPath = ("/" + String(path)).replace(/\/+/, "/");
  return cleanBase + cleanPath;
}

export default function RecruiterProfile() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    api
      .get("/api/recruiter/profile")
      .then((r) => setData(r.data as ApiResp))
      .catch((e) => {
        if (e?.response?.status === 404 && e?.response?.data?.hasCompany === false) {
          setData({ hasCompany: false });
          return;
        }
        setErr(e?.response?.data ?? e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">Loading…</div>;
  if (err)
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10 text-red-600">
        {String(err)}
      </div>
    );

  if (data && data.hasCompany === false) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        <h1 className="text-2xl font-semibold mb-2">Recruiter Profile</h1>
        <p className="text-gray-600">
          You haven’t created a company profile yet.
        </p>
        <Link
          to="/onboarding/recruiter"
          className="mt-4 inline-block px-4 py-2 rounded-xl bg-black text-white"
        >
          Create Company
        </Link>
      </div>
    );
  }

  const company = data?.company!;
  const rec = data?.recruiter!;
  const stats =
    data?.jobStats ?? { totalJobs: 0, activeJobs: 0, expiredJobs: 0, pendingJobs: 0 };

  const rawLogo = company.logoUrl || company.logo || "";
  const logoSrc = toAbsoluteMedia(rawLogo);

  const initials =
    (company.name || "C")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  // Safely derive hostname for website
  let websiteHost = "";
  if (company.website) {
    try {
      websiteHost = new URL(company.website).hostname.replace(/^www\./, "");
    } catch {
      websiteHost = company.website;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
      {/* top header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {logoSrc && imgOk ? (
            <img
              src={logoSrc}
              alt={`${company.name} logo`}
              className="w-16 h-16 rounded-lg border object-cover"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg border bg-gray-100 grid place-items-center text-gray-600 font-semibold">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-gray-600">
              {company.industry || "IT"} • {company.type || "Private"}
            </p>
            <div className="text-xs mt-1 space-x-2">
              {rec?.isVerified ? (
                <span className="text-green-600">✅ Verified</span>
              ) : (
                <span className="text-gray-500">Not verified</span>
              )}
              {company.isApproved ? (
                <span className="text-blue-600">• Approved</span>
              ) : (
                <span className="text-gray-500">• Pending approval</span>
              )}
              {websiteHost && (
                <a
                  className="text-blue-600 hover:underline ml-2"
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {websiteHost}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Edit button */}
        <div className="shrink-0">
          <Link
            to="/recruiter/profile/edit"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Jobs" value={stats.totalJobs} />
        <StatCard label="Active" value={stats.activeJobs} />
        <StatCard label="Expired" value={stats.expiredJobs} />
      </div>

      {/* about + contacts */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">About Company</h2>
        <p className="text-gray-700 mb-5">
          {company.description || "No description provided."}
        </p>

        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-medium">Recruiter:</span>{" "}
            {rec?.fullName ?? "—"}
          </p>
          <p>
            <span className="font-medium">Email:</span> {rec?.email ?? "—"}
          </p>
          <p>
            <span className="font-medium">Phone:</span> {rec?.phone ?? "—"}
          </p>
          {company.slug && (
            <p className="text-xs text-gray-500">
              Public company page: <code>/companies/{company.slug}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-4 text-center">
      <div className="text-2xl font-semibold">{value ?? 0}</div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}
