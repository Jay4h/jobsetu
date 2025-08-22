import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function PostJob() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: "", location: "",
    salaryMin: "", salaryMax: "", experience: "",
    expiryDate: "", isRemote: false, isUrgent: false, tags: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // backend expects JSON body on /api/recruiter/post-job
      await api.post("/api/recruiter/post-job", {
        Title: form.title,
        Location: form.location,
        SalaryMin: Number(form.salaryMin || 0),
        SalaryMax: Number(form.salaryMax || 0),
        ExperienceRequired: Number(form.experience || 0),
        ExpiryDate: form.expiryDate || null,
        IsRemote: form.isRemote,
        IsUrgent: form.isUrgent,
        Tags: form.tags, // your controller can parse/attach into JobMetadata
      });
      nav("/recruiter/jobs");
    } catch (e: any) {
      setErr(e?.response?.data ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-6 max-w-2xl space-y-3 mx-auto">
      <h1 className="text-2xl font-bold">Post Job</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <input className="input" placeholder="Title" value={form.title} onChange={e=>set("title", e.target.value)} required />
      <input className="input" placeholder="Location" value={form.location} onChange={e=>set("location", e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="Salary Min" value={form.salaryMin} onChange={e=>set("salaryMin", e.target.value)} />
        <input className="input" placeholder="Salary Max" value={form.salaryMax} onChange={e=>set("salaryMax", e.target.value)} />
      </div>
      <input className="input" placeholder="Experience (years)" value={form.experience} onChange={e=>set("experience", e.target.value)} />
      <input className="input" type="date" value={form.expiryDate} onChange={e=>set("expiryDate", e.target.value)} />
      <input className="input" placeholder="Tags (comma-separated)" value={form.tags} onChange={e=>set("tags", e.target.value)} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.isRemote} onChange={e=>set("isRemote", e.target.checked)} /> Remote</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.isUrgent} onChange={e=>set("isUrgent", e.target.checked)} /> Urgent</label>
      <button disabled={busy} className="px-4 py-2 rounded-xl bg-black text-white">{busy ? "Posting…" : "Post Job"}</button>
    </form>
  );
}
