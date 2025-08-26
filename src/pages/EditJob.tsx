import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api, { normalizeApiError } from "../lib/api";

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
  const [autoRejectExperience, setAutoRejectExperience] = useState<boolean>(false);
const [autoRejectLocation, setAutoRejectLocation] = useState<boolean>(false);
const toBool = (v: any) => /^(true|1|yes|on)$/i.test(String(v ?? "").trim());

  const { jobId } = useParams<{ jobId: string }>();
  const nav = useNavigate();
  const [m, setM] = useState<JobModel>({
    title: "",
    location: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);

  function findFilter(filters: any[] | undefined, key: string) {
    const hit = (filters || []).find(
      (f) => (f.FilterType || f.type) === key
    );
    return hit ? (hit.FilterValue || hit.value || "") : "";
  }

  // Try to extract tags/skills from various shapes that backends return
  function extractTagsAndSkills(src: any): { tags: string; skills: string } {
    let tagsArr: string[] = [];
    let skillsArr: string[] = [];

    if (!src) return { tags: "", skills: "" };

    // case A: array of strings (just tags)
    if (Array.isArray(src) && src.every((x) => typeof x === "string")) {
      tagsArr = src as string[];
    }

    // case B: array of { type/value }  OR { Type/Value } OR metadata list
    if (Array.isArray(src) && src.some((x) => typeof x === "object")) {
      for (const t of src as any[]) {
        const typ = (t.type || t.Type || t.FilterType || "").toString().toLowerCase();
        const val = t.value || t.Value || t.FilterValue || "";
        if (!val) continue;
        if (typ === "skill") skillsArr.push(val);
        else if (typ === "tag") tagsArr.push(val);
      }
    }

    // case C: object with arrays inside (defensive)
    if (!tagsArr.length && Array.isArray(src.tags)) {
      if (src.tags.every((x: any) => typeof x === "string")) {
        tagsArr = src.tags;
      } else {
        for (const t of src.tags) {
          const typ = (t.type || t.Type || "").toString().toLowerCase();
          const val = t.value || t.Value || "";
          if (!val) continue;
          if (typ === "skill") skillsArr.push(val);
          else if (typ === "tag") tagsArr.push(val);
        }
      }
    }
    if (!skillsArr.length && Array.isArray(src.skills)) {
      skillsArr = src.skills.filter((x: any) => !!x).map((x: any) => String(x));
    }

    return { tags: tagsArr.join(", "), skills: skillsArr.join(", ") };
  }

  useEffect(() => {
    if (!jobId) return;

    (async () => {
      setLoading(true);
      try {
        // 1) Public job (title, desc, salaries, filters, maybe tags)
        const jobP = api.get(`/api/jobs/${jobId}`, { suppressUnauthorized: true });

        // 2) Recruiter skills (many backends expose requiredSkills here)
        const skillsP = api.get(`/api/recruiter/skill-match-graph/${jobId}`, {
          suppressUnauthorized: true,
        });

        const [jobRes, skillsRes] = await Promise.allSettled([jobP, skillsP]);

        // --- Fill from job details ---
        if (jobRes.status === "fulfilled") {
          const d = jobRes.value.data;

          // numbers if present, else null
          const sMin = d.salaryMin ?? d.SalaryMin ?? null;
          const sMax = d.salaryMax ?? d.SalaryMax ?? null;
          const exp  = d.experienceRequired ?? d.ExperienceRequired ?? null;
const arExp = findFilter(d.filters, "AutoRejectExperience") || d.autoRejectExperience;
  const arLoc = findFilter(d.filters, "AutoRejectLocation")   || d.autoRejectLocation;
  
  setAutoRejectExperience(toBool(arExp));
  setAutoRejectLocation(toBool(arLoc));
          // normalize date string for <input type="date">
          const rawExp = d.expiryDate ?? d.ExpiryDate;
          const expiryDate =
            rawExp ? String(rawExp).slice(0, 10) : "";

          // extract tags/skills from the payload (if included)
          const { tags, skills } = extractTagsAndSkills(d.tags ?? d.jobMetadatas ?? d.metadata);

          setM((prev) => ({
            ...prev,
            title: d.title ?? d.Title ?? "",
            location: d.location ?? d.Location ?? "",
            description: d.description ?? d.Description ?? "",
            salaryMin: sMin,
            salaryMax: sMax,
            experience: exp,
            isRemote: !!(d.isRemote ?? d.IsRemote),
            isUrgent: !!(d.isUrgent ?? d.IsUrgent),
            expiryDate,

            // metadata from filters array
            industry:    findFilter(d.filters, "Industry"),
            department:  findFilter(d.filters, "Department"),
            companyType: findFilter(d.filters, "CompanyType"),
            roleCategory:findFilter(d.filters, "RoleCategory"),
            stipend:     findFilter(d.filters, "Stipend"),
            duration:    findFilter(d.filters, "Duration"),
            education:   findFilter(d.filters, "Education"),
            postedBy:    findFilter(d.filters, "PostedBy"),
            topCompanies:findFilter(d.filters, "TopCompanies"),

            tags,        // may be empty if API doesn’t include them
            skills,      // may be empty; we’ll try the recruiter endpoint next
          }));
        }

        // --- Fill/override skills from recruiter graph if available ---
        if (skillsRes.status === "fulfilled") {
          const s = skillsRes.value.data;
          const arr =
            s?.requiredSkills ??
            s?.skills ??
            (Array.isArray(s) ? s : []);
          if (Array.isArray(arr) && arr.length) {
            setM((prev) => ({ ...prev, skills: arr.join(", ") }));
          }
        }
      } catch (err) {
        toast.error(normalizeApiError(err).message || "Failed to load job.");
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
fd.append("autoRejectLocation",   autoRejectLocation ? "true" : "false");

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
      await api.put(`/api/recruiter/edit-job/${jobId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Job updated");
      nav("/recruiter/jobs");
    } catch (e) {
      toast.error(normalizeApiError(e).message);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Edit Job</h1>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">Title*
            <input className="border rounded p-2" required value={m.title} onChange={e=>setM({...m, title:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Location*
            <input className="border rounded p-2" required value={m.location} onChange={e=>setM({...m, location:e.target.value})}/>
          </label>

          <label className="flex flex-col gap-1">Salary Min
            <input type="number" className="border rounded p-2" value={m.salaryMin ?? ""} onChange={e=>setM({...m, salaryMin: e.target.value? Number(e.target.value): null})}/>
          </label>
          <label className="flex flex-col gap-1">Salary Max
            <input type="number" className="border rounded p-2" value={m.salaryMax ?? ""} onChange={e=>setM({...m, salaryMax: e.target.value? Number(e.target.value): null})}/>
          </label>

          <label className="flex flex-col gap-1">Experience (years)
            <input type="number" className="border rounded p-2" value={m.experience ?? ""} onChange={e=>setM({...m, experience: e.target.value? Number(e.target.value): null})}/>
          </label>
          <label className="flex flex-col gap-1">Expiry Date
            <input type="date" className="border rounded p-2" value={m.expiryDate || ""} onChange={e=>setM({...m, expiryDate:e.target.value})}/>
          </label>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.isRemote} onChange={(e)=>setM({...m, isRemote:e.target.checked})}/>
            <span>Remote</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.isUrgent} onChange={(e)=>setM({...m, isUrgent:e.target.checked})}/>
            <span>Urgent</span>
          </label>
        </div>

        <label className="flex flex-col gap-1">Description*
          <textarea rows={6} className="border rounded p-2" required value={m.description} onChange={e=>setM({...m, description:e.target.value})}/>
        </label>

        {/* metadata – optional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">Industry
            <input className="border rounded p-2" value={m.industry || ""} onChange={(e)=>setM({...m, industry:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Department
            <input className="border rounded p-2" value={m.department || ""} onChange={(e)=>setM({...m, department:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Company Type
            <input className="border rounded p-2" value={m.companyType || ""} onChange={(e)=>setM({...m, companyType:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Role Category
            <input className="border rounded p-2" value={m.roleCategory || ""} onChange={(e)=>setM({...m, roleCategory:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Stipend
            <input className="border rounded p-2" value={m.stipend || ""} onChange={(e)=>setM({...m, stipend:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Duration
            <input className="border rounded p-2" value={m.duration || ""} onChange={(e)=>setM({...m, duration:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Education
            <input className="border rounded p-2" value={m.education || ""} onChange={(e)=>setM({...m, education:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1">Posted By
            <input className="border rounded p-2" value={m.postedBy || ""} onChange={(e)=>setM({...m, postedBy:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Top Companies
            <input className="border rounded p-2" value={m.topCompanies || ""} onChange={(e)=>setM({...m, topCompanies:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Tags (comma-separated)
            <input className="border rounded p-2" value={m.tags || ""} onChange={(e)=>setM({...m, tags:e.target.value})}/>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">Skills (comma-separated)
            <input className="border rounded p-2" value={m.skills || ""} onChange={(e)=>setM({...m, skills:e.target.value})}/>
          </label>
        </div>

    <div className="space-y-2">
  <h3 className="text-lg font-medium">Auto‑Reject Rules</h3>
  <div className="flex flex-wrap gap-6">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={autoRejectExperience}
        onChange={(e)=>setAutoRejectExperience(e.target.checked)}
      />
      <span>Reject if candidate experience is less than required</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={autoRejectLocation}
        onChange={(e)=>setAutoRejectLocation(e.target.checked)}
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
