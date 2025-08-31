import React, { useEffect, useMemo, useState } from "react";
import api, { multipart, normalizeApiError, absUrl } from "../lib/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

type Company = {
  name: string;
  website: string;
  description: string;
  industry: string;
  type: string;
  logoUrl?: string | null;
  logo?: string | null;
};

export default function EditCompany() {
  const [model, setModel] = useState<Company>({
    name: "",
    website: "",
    description: "",
    industry: "",
    type: "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api
      .get("/api/recruiter/profile")
      .then((res) => {
        const c = (res.data?.company || {}) as Company;
        setModel({
          name: c.name || "",
          website: c.website || "",
          description: c.description || "",
          industry: c.industry || "",
          type: c.type || "",
          logoUrl: c.logoUrl || c.logo || null,
          logo: c.logo || null,
        });
      })
      .catch((e) => toast.error(normalizeApiError(e).message))
      .finally(() => setLoading(false));
  }, []);

  const logoPreview = useMemo(() => {
    if (logo) return URL.createObjectURL(logo);
    const url = model.logoUrl || model.logo || "";
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : absUrl(url);
  }, [logo, model.logoUrl, model.logo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!model.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    const fd = new FormData();
    fd.append("name", model.name.trim());
    fd.append("website", model.website?.trim() || "");
    fd.append("description", model.description?.trim() || "");
    fd.append("industry", model.industry?.trim() || "");
    fd.append("type", model.type?.trim() || "");
    if (logo) fd.append("logo", logo); // 🔧 match onboarding form

    try {
      await api.put("/api/recruiter/edit-company", fd, multipart);
      toast.success("Company updated successfully");
      nav("/recruiter/profile", { replace: true });
    } catch (err) {
      toast.error(normalizeApiError(err).message);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Edit Company</h1>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              className="input"
              value={model.name}
              onChange={(e) => setModel({ ...model, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Website">
            <input
              className="input"
              value={model.website || ""}
              onChange={(e) => setModel({ ...model, website: e.target.value })}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="Industry">
            <input
              className="input"
              value={model.industry || ""}
              onChange={(e) => setModel({ ...model, industry: e.target.value })}
            />
          </Field>
          <Field label="Company Type">
            <input
              className="input"
              value={model.type || ""}
              onChange={(e) => setModel({ ...model, type: e.target.value })}
              placeholder="Private / Public / Startup…"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-[100px]"
            rows={5}
            value={model.description || ""}
            onChange={(e) => setModel({ ...model, description: e.target.value })}
          />
        </Field>

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] || null)}
          />
          {logoPreview ? (
            <img
              src={logoPreview}
              className="h-12 w-12 rounded object-cover bg-gray-100"
              alt="Company logo"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
              No Logo
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button className="btn btn-primary">Save</button>
          <button
            type="button"
            className="btn"
            onClick={() => nav("/recruiter/profile")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      {children}
    </label>
  );
}

