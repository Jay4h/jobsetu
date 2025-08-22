import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function EditJob() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ title: "", location: "", salaryMin: "", salaryMax: "", experience: "", expiryDate: "" });

  useEffect(() => {
    api.get(`/api/jobs/${jobId}`)
      .then(r => {
        const d = r.data ?? {};
        setForm({
          title: d.title ?? d.Title ?? "",
          location: d.location ?? d.Location ?? "",
          salaryMin: d.salaryMin ?? d.SalaryMin ?? "",
          salaryMax: d.salaryMax ?? d.SalaryMax ?? "",
          experience: d.experienceRequired ?? d.ExperienceRequired ?? "",
          expiryDate: (d.expiryDate ?? d.ExpiryDate ?? "").slice?.(0,10) ?? "",
        });
      })
      .catch(e => setErr(e?.response?.data ?? e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/api/recruiter/edit-job/${jobId}`, {
        Title: form.title,
        Location: form.location,
        SalaryMin: Number(form.salaryMin || 0),
        SalaryMax: Number(form.salaryMax || 0),
        ExperienceRequired: Number(form.experience || 0),
        ExpiryDate: form.expiryDate || null,
      });
      nav("/recruiter/jobs");
    } catch (e: any) {
      setErr(e?.response?.data ?? e.message);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  return (
    <form onSubmit={save} className="p-6 max-w-2xl space-y-3 mx-auto">
      <h1 className="text-2xl font-bold">Edit Job</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <input className="input" value={form.title} onChange={e=>set("title", e.target.value)} />
      <input className="input" value={form.location} onChange={e=>set("location", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className="input" value={form.salaryMin} onChange={e=>set("salaryMin", e.target.value)} />
        <input className="input" value={form.salaryMax} onChange={e=>set("salaryMax", e.target.value)} />
      </div>
      <input className="input" value={form.experience} onChange={e=>set("experience", e.target.value)} />
      <input className="input" type="date" value={form.expiryDate} onChange={e=>set("expiryDate", e.target.value)} />
      <button className="px-4 py-2 rounded-xl bg-black text-white">Save</button>
    </form>
  );
}
