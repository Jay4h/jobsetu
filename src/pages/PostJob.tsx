// src/pages/PostJob.tsx
import { useMemo, useState } from "react";
import api, { normalizeApiError } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const inputCls =
  "border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/20";

type FormState = {
  title: string;
  description: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  experience: string;
  expiryDate: string;
  isRemote: boolean;
  isUrgent: boolean;
  industry: string;
  department: string;
  companyType: string;
  roleCategory: string;
  stipend: string;
  duration: string;
  education: string;
  postedBy: string;
  topCompanies: string;
};

export default function PostJob() {
  const [f, setF] = useState<FormState>({
    title: "",
    description: "",
    location: "",
    salaryMin: "",
    salaryMax: "",
    experience: "",
    expiryDate: "",
    isRemote: false,
    isUrgent: false,
    industry: "",
    department: "",
    companyType: "",
    roleCategory: "",
    stipend: "",
    duration: "",
    education: "",
    postedBy: "",
    topCompanies: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const nav = useNavigate();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const lpaHint = useMemo(() => {
    const sMin = Number(f.salaryMin || 0);
    const sMax = Number(f.salaryMax || 0);
    if (!sMin || !sMax) return "";
    return `${(sMin / 100000).toFixed(1)}–${(sMax / 100000).toFixed(1)} LPA`;
  }, [f.salaryMin, f.salaryMax]);

  const up =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val =
        e.currentTarget.type === "checkbox"
          ? (e.currentTarget as HTMLInputElement).checked
          : e.currentTarget.value;
      setF((s) => ({ ...s, [k]: val as any }));
    };

  function addChip(v: string, list: string[], setList: (x: string[]) => void) {
    const t = v.trim();
    if (!t || list.includes(t)) return;
    setList([...list, t]);
  }
  function removeChip(v: string, list: string[], setList: (x: string[]) => void) {
    setList(list.filter((x) => x !== v));
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();

    if (!f.title.trim() || !f.location.trim() || !f.description.trim()) {
      toast.error("Title, Location, and Description are required.");
      return;
    }
    if (f.salaryMin && f.salaryMax && Number(f.salaryMin) > Number(f.salaryMax)) {
      toast.error("Salary Min cannot be greater than Salary Max.");
      return;
    }

    const fd = new FormData();
    fd.append("title", f.title);
    fd.append("description", f.description);
    fd.append("location", f.location);
    fd.append("salaryMin", f.salaryMin || "");
    fd.append("salaryMax", f.salaryMax || "");
    fd.append("experience", f.experience || "");
    fd.append(
      "expiryDate",
      f.expiryDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    );
    fd.append("isRemote", f.isRemote ? "true" : "false");
    fd.append("isUrgent", f.isUrgent ? "true" : "false");

    // metadata that your backend writes into JobMetadata
    fd.append("industry", f.industry);
    fd.append("department", f.department);
    fd.append("companyType", f.companyType);
    fd.append("roleCategory", f.roleCategory);
    fd.append("stipend", f.stipend);
    fd.append("duration", f.duration);
    fd.append("education", f.education);
    fd.append("postedBy", f.postedBy);
    fd.append("topCompanies", f.topCompanies);
    fd.append("tags", tags.join(","));
    fd.append("skills", skills.join(","));

    try {
      await api.post("/api/recruiter/post-job", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Job posted successfully");
      nav("/recruiter/jobs");
    } catch (err) {
      toast.error(normalizeApiError(err).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-0 py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Post Job</h1>
      </div>

      <form onSubmit={submit} className="rounded-2xl border bg-white shadow-sm p-6 space-y-6">
        {/* Job details (everything lives here) */}
        <h2 className="text-lg font-medium">Job details</h2>

        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Title" required>
            <input className={inputCls} placeholder="e.g., Senior Frontend Engineer" value={f.title} onChange={up("title")} required />
          </Field>
          <Field label="Location" required>
            <input className={inputCls} placeholder="e.g., Bengaluru / Remote" value={f.location} onChange={up("location")} required />
          </Field>

          <Field label="Salary Min (₹)">
            <input className={inputCls} type="number" min={0} step={1000} placeholder="e.g., 600000" value={f.salaryMin} onChange={up("salaryMin")} />
          </Field>
          <Field label="Salary Max (₹)">
            <input className={inputCls} type="number" min={0} step={1000} placeholder="e.g., 1200000" value={f.salaryMax} onChange={up("salaryMax")} />
          </Field>

          <Field label="Experience (years)">
            <input className={inputCls} type="number" min={0} step={1} placeholder="e.g., 3" value={f.experience} onChange={up("experience")} />
          </Field>
          <Field label="Expiry Date">
            <input className={inputCls} type="date" min={todayIso} value={f.expiryDate} onChange={up("expiryDate")} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-6">
          <Switch checked={f.isRemote} onChange={up("isRemote")} label="Remote" />
          <Switch checked={f.isUrgent} onChange={up("isUrgent")} label="Urgent" />
          {lpaHint && <span className="text-sm text-gray-500">Approx: {lpaHint}</span>}
        </div>

        <Field label="Description" required>
          <textarea
            className={`${inputCls} min-h-[160px]`}
            placeholder="Role overview, responsibilities, must-have skills, nice-to-haves, interview process…"
            value={f.description}
            onChange={up("description")}
            required
          />
        </Field>

        {/* Optional fields (no heading) */}
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Industry"><input className={inputCls} value={f.industry} onChange={up("industry")} /></Field>
          <Field label="Department"><input className={inputCls} value={f.department} onChange={up("department")} /></Field>
          <Field label="Company Type"><input className={inputCls} value={f.companyType} onChange={up("companyType")} /></Field>
          <Field label="Role Category"><input className={inputCls} value={f.roleCategory} onChange={up("roleCategory")} /></Field>
          <Field label="Stipend"><input className={inputCls} value={f.stipend} onChange={up("stipend")} /></Field>
          <Field label="Duration"><input className={inputCls} value={f.duration} onChange={up("duration")} /></Field>
          <Field label="Education"><input className={inputCls} value={f.education} onChange={up("education")} /></Field>
          <Field label="Posted By"><input className={inputCls} value={f.postedBy} onChange={up("postedBy")} /></Field>
          <Field label="Top Companies"><input className={inputCls} value={f.topCompanies} onChange={up("topCompanies")} /></Field>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <ChipInput
            label="Tags"
            placeholder="Type and press Enter"
            items={tags}
            onAdd={(v) => addChip(v, tags, setTags)}
            onRemove={(v) => removeChip(v, tags, setTags)}
          />
          <ChipInput
            label="Skills"
            placeholder="Type and press Enter"
            items={skills}
            onAdd={(v) => addChip(v, skills, setSkills)}
            onRemove={(v) => removeChip(v, skills, setSkills)}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button className="px-5 py-2 rounded-xl bg-black text-white hover:opacity-90">Post Job</button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------- UI bits ------------------------ */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (e: any) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 text-sm select-none">
      <span
        className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
          checked ? "bg-black" : "bg-gray-300"
        }`}
      >
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange as any} />
        <span
          className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
      {label}
    </label>
  );
}

function ChipInput({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder?: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [val, setVal] = useState("");
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = val.trim();
      if (t) onAdd(t);
      setVal("");
    }
  }
  return (
    <div>
      <div className="text-sm mb-1">{label}</div>
      <div className="border rounded-xl px-2 py-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it}
            className="px-2 py-1 rounded-lg bg-gray-100 text-sm inline-flex items-center gap-2"
          >
            {it}
            <button
              type="button"
              className="text-gray-500 hover:text-black"
              onClick={() => onRemove(it)}
              aria-label={`remove ${it}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[180px] outline-none px-1"
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKey}
        />
      </div>
    </div>
  );
}

