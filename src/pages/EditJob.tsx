// src/pages/EditJob.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../lib/api";

// ---- helper: normalize API errors from wrapper or raw axios ----
function extractApiError(err: any) {
  const status = err?.status ?? err?.response?.status;
  const data = err?.data ?? err?.response?.data;
  const code = typeof data === "object" ? data?.code : undefined;
  const message =
    (typeof data === "object" && (data?.message || data?.Message)) ||
    err?.message ||
    "Request failed";
  return { status, code, message, data };
}

type JobModel = {
  title: string;
  location: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  experience?: number | null;
  expiryDate?: string;
  description: string;
  isRemote?: boolean;
  isUrgent?: boolean;
  // meta
  industry?: string;
  department?: string;
  companyType?: string;
  roleCategory?: string;
  stipend?: string;
  duration?: string;
  education?: string;
  postedBy?: string;
  topCompanies?: string;
  tags?: string;   // comma-separated
  skills?: string; // comma-separated
};

export default function EditJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const nav = useNavigate();

  const [m, setM] = useState<JobModel>({
    title: "",
    location: "",
    description: "",
  });

  const [loading, setLoading] = useState(true);

  // same UX as PostJob
  const [formError, setFormError] = useState<string>("");
  const errRef = useRef<HTMLDivElement | null>(null);

  const [autoRejectExperience, setAutoRejectExperience] = useState<boolean>(false);
  const [autoRejectLocation, setAutoRejectLocation] = useState<boolean>(false);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/recruiter/jobs?forEdit=${jobId}`);
        const d = res.data;

        const dateStr = d.expiryDate ? String(d.expiryDate).slice(0, 10) : "";

        setM(prev => ({
          ...prev,
          title: d.title ?? "",
          location: d.location ?? "",
          description: d.description ?? "",
          salaryMin: d.salaryMin ?? null,
          salaryMax: d.salaryMax ?? null,
          experience: d.experience ?? null,
          expiryDate: dateStr,
          isRemote: !!d.isRemote,
          isUrgent: !!d.isUrgent,
          industry: d.industry ?? "",
          department: d.department ?? "",
          companyType: d.companyType ?? "",
          roleCategory: d.roleCategory ?? "",
          stipend: d.stipend ?? "",
          duration: d.duration ?? "",
          education: d.education ?? "",
          postedBy: d.postedBy ?? "",
          topCompanies: d.topCompanies ?? "",
          tags: Array.isArray(d.tags) ? d.tags.join(", ") : (d.tags ?? ""),
          skills: Array.isArray(d.skills) ? d.skills.join(", ") : (d.skills ?? ""),
        }));

        setAutoRejectExperience(!!d.autoRejectExperience);
        setAutoRejectLocation(!!d.autoRejectLocation);
      } catch (err) {
        toast.error(extractApiError(err).message || "Failed to load job.");
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;

    const fd = new FormData();
    fd.append("title", m.title);
    fd.append("location", m.location);
    fd.append("description", m.description);
    if (m.salaryMin != null) fd.append("salaryMin", String(m.salaryMin));
    if (m.salaryMax != null) fd.append("salaryMax", String(m.salaryMax));
    if (m.experience != null) fd.append("experience", String(m.experience));
    if (m.expiryDate) fd.append("expiryDate", m.expiryDate);
    fd.append("isRemote", String(!!m.isRemote));
    fd.append("isUrgent", String(!!m.isUrgent));
    fd.append("autoRejectExperience", autoRejectExperience ? "true" : "false");
    fd.append("autoRejectLocation", autoRejectLocation ? "true" : "false");

    // metadata (keys match backend)
    if (m.industry) fd.append("industry", m.industry);
    if (m.department) fd.append("department", m.department);
    if (m.companyType) fd.append("companyType", m.companyType);
    if (m.roleCategory) fd.append("roleCategory", m.roleCategory);
    if (m.stipend) fd.append("stipend", m.stipend);
    if (m.duration) fd.append("duration", m.duration);
    if (m.education) fd.append("education", m.education);
    if (m.postedBy) fd.append("postedBy", m.postedBy);
    if (m.topCompanies) fd.append("topCompanies", m.topCompanies);
    if (m.tags) fd.append("tags", m.tags);
    if (m.skills) fd.append("skills", m.skills);

    try {
      const res = await api.put(`/api/recruiter/edit-job/${jobId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const d = res?.data || {};

      // ⬇️ EXACTLY like PostJob: backend returns 200 + { duplicate: true, message, match }
      if (d.duplicate) {
        const match = d.match;
        const detailed = match
          ? `${d.message} (Title: ${match.title}, Loc: ${match.location}, Exp: ${match.experience}y, ₹${match.salaryMin}–₹${match.salaryMax})`
          : (d.message || "Duplicate job.");

        setFormError(detailed);

        // 🔴 red toast, long duration (60s)
        toast.error(d.message || "Duplicate job.", {
          autoClose: 60000,
          closeOnClick: true,
          pauseOnHover: true,
        });

        errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return; // stop; do not navigate
      }


      setFormError("");
      toast.success(d?.message || "Job updated successfully.");
      nav("/recruiter/jobs");
    } catch (err) {
      const { message } = extractApiError(err);
      setFormError(message);
      toast.error(message);
      errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Edit Job</h1>

      {/* same inline error banner as PostJob */}
      {formError && (
        <div
          ref={errRef}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4"
          role="alert"
        >
          {formError}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">Title*
            <input className="border rounded p-2" required
              value={m.title} onChange={e => setM({ ...m, title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Location*
            <input className="border rounded p-2" required
              value={m.location} onChange={e => setM({ ...m, location: e.target.value })} />
          </label>

          <label className="flex flex-col gap-1">Salary Min
            <input type="number" className="border rounded p-2"
              value={m.salaryMin ?? ""} onChange={e => setM({ ...m, salaryMin: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="flex flex-col gap-1">Salary Max
            <input type="number" className="border rounded p-2"
              value={m.salaryMax ?? ""} onChange={e => setM({ ...m, salaryMax: e.target.value ? Number(e.target.value) : null })} />
          </label>

          <label className="flex flex-col gap-1">Experience (years)
            <input type="number" className="border rounded p-2"
              value={m.experience ?? ""} onChange={e => setM({ ...m, experience: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="flex flex-col gap-1">Expiry Date
            <input type="date" className="border rounded p-2"
              value={m.expiryDate || ""} onChange={e => setM({ ...m, expiryDate: e.target.value })} />
          </label>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.isRemote}
              onChange={(e) => setM({ ...m, isRemote: e.target.checked })} />
            <span>Remote</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.isUrgent}
              onChange={(e) => setM({ ...m, isUrgent: e.target.checked })} />
            <span>Urgent</span>
          </label>
        </div>

        <label className="flex flex-col gap-1">Description*
          <textarea rows={6} className="border rounded p-2" required
            value={m.description} onChange={e => setM({ ...m, description: e.target.value })} />
        </label>

        {/* metadata – optional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">Industry
            <input className="border rounded p-2"
              value={m.industry || ""} onChange={(e) => setM({ ...m, industry: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Department
            <input className="border rounded p-2"
              value={m.department || ""} onChange={(e) => setM({ ...m, department: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Company Type
            <input className="border rounded p-2"
              value={m.companyType || ""} onChange={(e) => setM({ ...m, companyType: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Role Category
            <input className="border rounded p-2"
              value={m.roleCategory || ""} onChange={(e) => setM({ ...m, roleCategory: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Stipend
            <input className="border rounded p-2"
              value={m.stipend || ""} onChange={(e) => setM({ ...m, stipend: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Duration
            <input className="border rounded p-2"
              value={m.duration || ""} onChange={(e) => setM({ ...m, duration: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Education
            <input className="border rounded p-2"
              value={m.education || ""} onChange={(e) => setM({ ...m, education: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">Posted By
            <input className="border rounded p-2"
              value={m.postedBy || ""} onChange={(e) => setM({ ...m, postedBy: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Top Companies
            <input className="border rounded p-2"
              value={m.topCompanies || ""} onChange={(e) => setM({ ...m, topCompanies: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Tags (comma-separated)
            <input className="border rounded p-2"
              value={m.tags || ""} onChange={(e) => setM({ ...m, tags: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Skills (comma-separated)
            <input className="border rounded p-2"
              value={m.skills || ""} onChange={(e) => setM({ ...m, skills: e.target.value })} />
          </label>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">Auto-Reject Rules</h3>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRejectExperience}
                onChange={(e) => setAutoRejectExperience(e.target.checked)}
              />
              <span>Reject if candidate experience is less than required</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRejectLocation}
                onChange={(e) => setAutoRejectLocation(e.target.checked)}
              />
              <span>Reject if candidate location ≠ job location</span>
            </label>
          </div>
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded">Save changes</button>
      </form>
    </div>
  );
}
