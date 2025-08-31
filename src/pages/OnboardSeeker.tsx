//src/pages/OnboardSeeker.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

type Form = {
  bio: string;
  location: string;
  education: string;
  experienceYears: number | "";
  skills: string;                 // comma-separated
  resume?: File | null;

  resumeVisibility: boolean;      // show resume publicly?
  publicProfileSlug: string;      // e.g., "john-doe" -> /user/public/john-doe
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function OnboardSeeker() {
  const [f, setF] = useState<Form>({
    bio: "",
    location: "",
    education: "",
    experienceYears: "",
    skills: "",
    resume: null,

    // 🔹 NEW defaults
    resumeVisibility: true,
    publicProfileSlug: "",
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
      // Build ONE multipart request — your backend reads Request.Form + Request.Files[0]
      const fd = new FormData();
      fd.append("bio", f.bio);
      fd.append("location", f.location);
      fd.append("education", f.education);
      fd.append("experienceYears", String(f.experienceYears || 0));
      fd.append("skills", f.skills);

      // 🔹 NEW: send visibility + slug (names match backend keys, case-insensitive)
      fd.append("resumeVisibility", String(!!f.resumeVisibility));
      if (f.publicProfileSlug) fd.append("publicProfileSlug", slugify(f.publicProfileSlug));

      if (f.resume) fd.append("file", f.resume);

      await api.post("/api/user/create-profile", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      navigate("/jobs", { replace: true });
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Couldn't save profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-10">
      <h1 className="text-xl font-semibold">Complete your profile</h1>
      <p className="text-gray-600 mt-1">
        Please fill your bio, location, education, experience, skills and upload a resume.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Bio</label>
          <textarea
            className="input min-h-[100px]"
            value={f.bio}
            onChange={(e) => set("bio", e.target.value)}
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={f.location}
              onChange={(e) => set("location", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Education</label>
            <input
              className="input"
              value={f.education}
              onChange={(e) => set("education", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Experience (years)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={f.experienceYears}
              onChange={(e) =>
                set("experienceYears", e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="label">Skills (comma separated)</label>
            <input
              className="input"
              placeholder="react, dotnet, sql"
              value={f.skills}
              onChange={(e) => set("skills", e.target.value)}
            />
          </div>
        </div>

        {/* 🔹 NEW: public profile slug */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Public profile slug</label>
            <input
              className="input"
              placeholder="your-name"
              value={f.publicProfileSlug}
              onChange={(e) => set("publicProfileSlug", slugify(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Public URL will be: <code>/user/public/{f.publicProfileSlug || "your-slug"}</code>
            </p>
          </div>

          {/* 🔹 NEW: resume visibility */}
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={f.resumeVisibility}
                onChange={(e) => set("resumeVisibility", e.target.checked)}
              />
              <span>Make my resume public</span>
            </label>
          </div>
        </div>

        <div>
          <label className="label">Resume (PDF)</label>
          <input
            className="input"
            type="file"
            accept="application/pdf"
            onChange={(e) => set("resume", e.target.files?.[0] || null)}
          />
        </div>

        <div className="pt-2">
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
