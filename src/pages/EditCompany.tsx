// src/pages/EditCompany.tsx
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
  logoUrl?: string | null; // API may return logoUrl or logo
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
    // make relative paths absolute to your API base
    return /^https?:\/\//i.test(url) ? url : absUrl(url);
  }, [logo, model.logoUrl, model.logo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", model.name || "");
    fd.append("website", model.website || "");
    fd.append("description", model.description || "");
    fd.append("industry", model.industry || "");
    fd.append("type", model.type || "");
    if (logo) fd.append("file", logo); // backend treats this as the new logo

    try {
      await api.put("/api/recruiter/edit-company", fd, multipart);
      toast.success("Company updated");
      nav("/recruiter/profile");
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
              className="border rounded p-2"
              value={model.name}
              onChange={(e) => setModel({ ...model, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Website">
            <input
              className="border rounded p-2"
              value={model.website || ""}
              onChange={(e) => setModel({ ...model, website: e.target.value })}
            />
          </Field>
          <Field label="Industry">
            <input
              className="border rounded p-2"
              value={model.industry || ""}
              onChange={(e) => setModel({ ...model, industry: e.target.value })}
            />
          </Field>
          <Field label="Company Type">
            <input
              className="border rounded p-2"
              value={model.type || ""}
              onChange={(e) => setModel({ ...model, type: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="border rounded p-2"
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
              onLoad={() => logo && URL.revokeObjectURL(logoPreview)}
            />
          ) : (
            <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
              No Logo
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            Save
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
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
