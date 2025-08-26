//RecruiterProfile.tsx
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

/* ---------- GDPR: minimal types (added) ---------- */
type ConsentItem = {
  consentId: number;
  userId: number;
  isAccepted: boolean;
  consentDate: string;   // ISO string
  consentType?: string;
  version?: string;
  ipAddress?: string;
  userAgent?: string;
  isCurrent?: boolean;
};

type ConsentResp = {
  total: number;
  current?: ConsentItem | null;
  items: ConsentItem[];
};
// --------------------------------------------------

// Make any media path absolute using your API base URL
function toAbsoluteMedia(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
  const cleanBase = String(base).replace(/\/+$/, "");
  const cleanPath = ("/" + String(path)).replace(/\/+/, "/");
  return cleanBase + cleanPath;
}
function fmtDate(dt?: string) {
  if (!dt) return "—";
  const s = String(dt);
  // handle ASP.NET /Date(1692960000000)/ and ISO strings
  const m = s.match(/\/Date\((\d+)\)\//);
  const d = m ? new Date(Number(m[1])) : new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function RecruiterProfile() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgOk, setImgOk] = useState(true);

  /* ---------- GDPR: state (added) ---------- */
  const [consents, setConsents] = useState<ConsentResp | null>(null);
  const [consentsErr, setConsentsErr] = useState<string | null>(null);
  const [consentsLoading, setConsentsLoading] = useState<boolean>(true);
  // ------------------------------------------

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

/* ---------- GDPR: fetch logs (fixed mapping) ---------- */
useEffect(() => {
  setConsentsLoading(true);

  api
    .get("/api/recruiter/consents", { suppressUnauthorized: true })
    .then((r) => {
      const raw = r.data || {};

      const items: ConsentItem[] = (raw.items || []).map((x: any) => ({
        consentId: x.ConsentId,
        userId: x.UserId,
        isAccepted: !!x.IsAccepted,
        consentDate: x.ConsentDate,      // string or /Date(...)/ is fine; fmtDate handles both
        consentType: x.ConsentType,
        version: x.Version,
        ipAddress: x.IpAddress,
        userAgent: x.UserAgent,
        isCurrent: !!x.IsCurrent,
      }));

      const currentRaw = raw.current || null;
      const current: ConsentItem | null = currentRaw
        ? {
            consentId: currentRaw.ConsentId,
            userId: currentRaw.UserId,
            isAccepted: !!currentRaw.IsAccepted,
            consentDate: currentRaw.ConsentDate,
            consentType: currentRaw.ConsentType,
            version: currentRaw.Version,
            ipAddress: currentRaw.IpAddress,
            userAgent: currentRaw.UserAgent,
            isCurrent: !!currentRaw.IsCurrent,
          }
        : null;

      setConsents({
        total: typeof raw.total === "number" ? raw.total : items.length,
        current,
        items,
      });
    })
    .catch((e) => setConsentsErr(e.message || "Failed to load consents"))
    .finally(() => setConsentsLoading(false));
}, []);

  // -----------------------------------------------

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

      {/* ---------- GDPR: Consent Log UI (added) ---------- */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">GDPR Consent Logs</h2>
          {consents?.total != null && (
            <span className="text-sm text-gray-500">Total: {consents.total}</span>
          )}
        </div>

        {consentsLoading && <div>Loading consent logs…</div>}
        {consentsErr && <div className="text-red-600 text-sm">{consentsErr}</div>}

        {!consentsLoading && !consentsErr && consents?.items?.length === 0 && (
          <div className="text-gray-600 text-sm">No consent records found.</div>
        )}

        {!consentsLoading && !consentsErr && !!consents?.items?.length && (
          <>
            {consents.current && (
              <div className="mb-4 rounded-lg border bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Current Consent</span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700 border border-green-200">
                    Active
                  </span>
                </div>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>
                    <span className="font-medium">Type:</span>{" "}
                    {consents.current.consentType || "GDPR"} (
                    {consents.current.version || "v1.0"})
                  </div>
                  <div>
                    <span className="font-medium">Accepted:</span>{" "}
                    {consents.current.isAccepted ? "Yes" : "No"}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span>{" "}
                    {fmtDate(consents.current.consentDate)}
                  </div>
                  {consents.current.ipAddress && (
                    <div>
                      <span className="font-medium">IP:</span>{" "}
                      {consents.current.ipAddress}
                    </div>
                  )}
                  {consents.current.userAgent && (
                    <div className="truncate">
                      <span className="font-medium">UA:</span>{" "}
                      {consents.current.userAgent}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Accepted</th>
                    <th className="py-2 pr-4">IP</th>
                    <th className="py-2 pr-4">User Agent</th>
                    <th className="py-2">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.items.map((c, i) => (
                    <tr key={`${c.consentId ?? 'x'}-${i}`} className="border-t">
                      <td className="py-2 pr-4">{c.consentId}</td>
                      <td className="py-2 pr-4">{fmtDate(c.consentDate)}</td>
                      <td className="py-2 pr-4">{c.consentType || "GDPR"}</td>
                      <td className="py-2 pr-4">{c.version || "v1.0"}</td>
                      <td className="py-2 pr-4">{c.isAccepted ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4">{c.ipAddress || "—"}</td>
                      <td className="py-2 pr-4">
                        <span title={c.userAgent || ""} className="block max-w-[360px] truncate">
                          {c.userAgent || "—"}
                        </span>
                      </td>
                      <td className="py-2">{c.isCurrent ? "✅" : ""}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </>
        )}
      </div>
      {/* ---------- end GDPR (added) ---------- */}
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
