import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

type Form = {
  name: string;
  website: string;
  industry: string;
  type: string; // Private, Public, etc.
  description: string;
  logo?: File | null;
};

export default function OnboardRecruiter() {
  const [f, setF] = useState<Form>({
    name: "",
    website: "",
    industry: "",
    type: "",
    description: "",
    logo: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      // If your backend expects multipart for logo, use FormData:
      const fd = new FormData();
      fd.append("name", f.name);
      fd.append("website", f.website);
      fd.append("industry", f.industry);
      fd.append("type", f.type);
      fd.append("description", f.description);
      if (f.logo) fd.append("logo", f.logo);

      await api.post("/api/recruiter/create-company", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Go to jobs or recruiter dashboard
      navigate("/jobs", { replace: true });
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Couldn't create company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-10">
      <h1 className="text-xl font-semibold">Create your company profile</h1>
      <p className="text-gray-600 mt-1">
        Add company details and logo to start posting jobs.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Company name</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Industry</label>
            <input className="input" value={f.industry} onChange={(e) => set("industry", e.target.value)} />
          </div>
          <div>
            <label className="label">Company type</label>
            <input className="input" placeholder="Private / Public / Startup…" value={f.type}
                   onChange={(e) => set("type", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[100px]" value={f.description}
                    onChange={(e) => set("description", e.target.value)} />
        </div>

        <div>
          <label className="label">Logo</label>
          <input className="input" type="file" accept="image/*"
                 onChange={(e) => set("logo", e.target.files?.[0] || null)} />
        </div>

        <div className="pt-2">
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create company"}
          </button>
        </div>
      </form>
    </div>
  );
}
