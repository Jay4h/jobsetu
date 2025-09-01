// src/pages/Applicants.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import api, { normalizeApiError } from "../lib/api";

type ApplicantRow = {
  applicationId: number;
  appliedOn: string;
  currentStatus: string;
  statusHistory?: string;
  recruiterNotes?: string;
  score?: number | null;
  userId?: number; // <-- needed for /api/resume/view/{userId}
  seeker: {
    fullName: string;
    email: string;
    phone: string;
    resume?: string | null;

    // optional/tolerant extras
    resumeViewCount?: number | null;
    resumeLastViewedBy?: string | null;
    experienceYears?: number | null;
    skills?: string | null;
  };
};

const STATUS = [
  "Applied",
  "Shortlisted",
  "Interview",
  "Offered",
  "Hired",
  "Rejected",
  "On Hold",
];

export default function Applicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);

  // search + status
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  // filters
  const [minExp, setMinExp] = useState<number | "">("");
  const [skill, setSkill] = useState("");
  const [exporting, setExporting] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftFeedback, setDraftFeedback] = useState("");
  const [targetAppId, setTargetAppId] = useState<number | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const openStatusModal = (
    applicationId: number,
    newStatus: string,
    existingNote?: string
  ) => {
    setTargetAppId(applicationId);
    setTargetStatus(newStatus);
    setDraftNote(existingNote || "");
    setDraftFeedback("");
    setModalOpen(true);
  };

  const closeStatusModal = () => {
    if (saving) return;
    setModalOpen(false);
    setDraftNote("");
    setDraftFeedback("");
    setTargetAppId(null);
    setTargetStatus("");
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeStatusModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  // ---------- load (unfiltered) ----------
  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/recruiter/applicants/${jobId}`);
      const mapped: ApplicantRow[] = (data?.applicants ?? data ?? []).map((x: any) => {
        const seeker = x.seeker ?? x.Seeker ?? x.applicant ?? x.Applicant ?? {};
        return {
          applicationId: x.applicationId ?? x.ApplicationId,
          appliedOn: x.appliedOn ?? x.AppliedOn ?? "",
          currentStatus: x.currentStatus ?? x.CurrentStatus ?? "Applied",
          statusHistory: x.statusHistory ?? x.StatusHistory ?? "",
          recruiterNotes: x.recruiterNotes ?? x.RecruiterNotes ?? "",
          score: x.score ?? x.ResumeFitScore ?? x.FitScore ?? null,
          userId: x.userId ?? x.UserId ?? seeker.userId ?? seeker.UserId ?? undefined, // <-- add it
          seeker: {
            fullName:
              seeker.fullName ?? seeker.FullName ?? x.fullName ?? x.FullName ?? "",
            email: seeker.email ?? seeker.Email ?? x.email ?? x.Email ?? "",
            phone: seeker.phone ?? seeker.Phone ?? x.phone ?? x.Phone ?? "",
            resume:
              seeker.resume ?? seeker.Resume ?? x.resumeFile ?? x.ResumeFile ?? null,
            resumeViewCount:
              seeker.resumeViewCount ??
              seeker.ResumeViewCount ??
              x.resumeViewCount ??
              x.ResumeViewCount ??
              x.viewCount ??
              x.ViewCount ??
              null,
            resumeLastViewedBy:
              seeker.resumeLastViewedBy ??
              seeker.ResumeLastViewedBy ??
              x.resumeLastViewedBy ??
              x.ResumeLastViewedBy ??
              x.lastViewedBy ??
              x.LastViewedBy ??
              null,
            experienceYears:
              seeker.experienceYears ??
              seeker.ExperienceYears ??
              x.experienceYears ??
              x.ExperienceYears ??
              null,
            skills: seeker.skills ?? seeker.Skills ?? x.skills ?? x.Skills ?? null,
          },
        };
      });
      setRows(mapped);
    } catch (e: any) {
      toast.error(normalizeApiError(e).message || "Failed to load applicants.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- load (filtered) ----------
  const applyFilter = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("jobId", String(jobId));
      if (minExp !== "") params.set("minExp", String(minExp));
      if (skill.trim()) params.set("skill", skill.trim());
      const { data } = await api.get(
        `/api/recruiter/applicants/filter?${params.toString()}`
      );

      const mapped: ApplicantRow[] = (data?.applicants ?? data ?? []).map((x: any) => {
        const seeker = x.seeker ?? x.Seeker ?? x.applicant ?? x.Applicant ?? {};
        return {
          applicationId: x.applicationId ?? x.ApplicationId,
          appliedOn: x.appliedOn ?? x.AppliedOn ?? "",
          currentStatus: x.currentStatus ?? x.CurrentStatus ?? "Applied",
          statusHistory: x.statusHistory ?? x.StatusHistory ?? "",
          recruiterNotes: x.recruiterNotes ?? x.RecruiterNotes ?? "",
          score: x.score ?? x.ResumeFitScore ?? x.FitScore ?? null,
          userId: x.userId ?? x.UserId ?? seeker.userId ?? seeker.UserId ?? undefined,
          seeker: {
            fullName:
              seeker.fullName ?? seeker.FullName ?? x.fullName ?? x.FullName ?? "",
            email: seeker.email ?? seeker.Email ?? x.email ?? x.Email ?? "",
            phone: seeker.phone ?? seeker.Phone ?? x.phone ?? x.Phone ?? "",
            resume:
              seeker.resume ?? seeker.Resume ?? x.resumeFile ?? x.ResumeFile ?? null,
            resumeViewCount:
              seeker.resumeViewCount ??
              seeker.ResumeViewCount ??
              x.resumeViewCount ??
              x.ResumeViewCount ??
              x.viewCount ??
              x.ViewCount ??
              null,
            resumeLastViewedBy:
              seeker.resumeLastViewedBy ??
              seeker.ResumeLastViewedBy ??
              x.resumeLastViewedBy ??
              x.ResumeLastViewedBy ??
              x.lastViewedBy ??
              x.LastViewedBy ??
              null,
            experienceYears:
              seeker.experienceYears ??
              seeker.ExperienceYears ??
              x.experienceYears ??
              x.ExperienceYears ??
              null,
            skills: seeker.skills ?? seeker.Skills ?? x.skills ?? x.Skills ?? null,
          },
        };
      });
      setRows(mapped);
    } catch (e: any) {
      toast.error(normalizeApiError(e).message || "Failed to filter applicants.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilter = () => {
    setMinExp("");
    setSkill("");
    load();
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesText =
        !term ||
        r.seeker.fullName.toLowerCase().includes(term) ||
        (r.seeker.email || "").toLowerCase().includes(term) ||
        (r.seeker.phone || "").toLowerCase().includes(term);
      const matchesStatus = !status || r.currentStatus === status;
      return matchesText && matchesStatus;
    });
  }, [rows, q, status]);

  // ---------- status update ----------
  const updateStatus = async (
    applicationId: number,
    newStatus: string,
    note?: string,
    publicFeedback?: string
  ) => {
    const id = Number(applicationId);
    if (!id) return toast.error("Invalid application id");
    try {
      await api.put(`/api/recruiter/update-status`, {
        ApplicationId: id,
        NewStatus: newStatus,
        Note: note || "",
        PublicFeedback: publicFeedback || "",
      });
      toast.success("Status updated");
      setRows((old) =>
        old.map((r) =>
          r.applicationId === id
            ? { ...r, currentStatus: newStatus, recruiterNotes: note || r.recruiterNotes }
            : r
        )
      );
    } catch (e: any) {
      toast.error(normalizeApiError(e).message || "Failed to update status.");
    }
  };

  const confirmStatusChange = async () => {
    if (!targetAppId || !targetStatus) return;
    try {
      setSaving(true);
      await updateStatus(targetAppId, targetStatus, draftNote, draftFeedback);
      closeStatusModal();
    } finally {
      setSaving(false);
    }
  };

  // ---------- saved toggle ----------
  const toggleSaved = async (applicationId: number, wantSaved: boolean) => {
    const id = Number(applicationId);
    if (!id) return toast.error("Invalid application id");
    try {
      await api.post(`/api/recruiter/save-applicant`, null, {
        params: { applicationId: id, isSaved: wantSaved },
      });
      toast.success(wantSaved ? "Saved" : "Unsaved");
    } catch (e: any) {
      toast.error(normalizeApiError(e).message || "Failed to update save state.");
    }
  };

  // ---------- view + increment resume ----------
  async function handleViewResume(a: ApplicantRow) {
    try {
      if (!a.userId) {
        toast.error("Missing user id for applicant.");
        return;
      }
      const { data } = await api.get(`/api/resume/view/${a.userId}`);
      // data => { FilePath, viewCount, lastViewedBy }
      setRows((prev) =>
        prev.map((r) =>
          r.applicationId === a.applicationId
            ? {
              ...r,
              seeker: {
                ...r.seeker,
                resume: data.FilePath ?? r.seeker.resume,
                resumeViewCount: data.viewCount ?? r.seeker.resumeViewCount,
                resumeLastViewedBy: data.lastViewedBy ?? r.seeker.resumeLastViewedBy,
              },
            }
            : r
        )
      );
      const url = `${import.meta.env.VITE_API_BASE_URL}/Uploads/Resumes/${data.FilePath}`;
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(normalizeApiError(e).message || "Could not open resume.");
    }
  }

  // ---------- export ----------
  function getFilenameFromDisposition(h?: string | null) {
    if (!h) return null;
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(h);
    return m ? decodeURIComponent(m[1]) : null;
  }
  // add next to exportCsv
  const exportXlsx = async () => {
    if (!jobId || exporting) return;
    try {
      setExporting(true);
      const res = await api.get(`/api/recruiter/export-applicants/${jobId}`, {
        responseType: "blob",
      });

      const dispo =
        (res as any).headers?.["content-disposition"] ??
        (res as any).headers?.get?.("content-disposition");
      const suggested = getFilenameFromDisposition(dispo);
      const filename = suggested || `applicants_job_${jobId}.xlsx`;

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e: any) {
      let message = e?.message || "Could not export applicants.";
      try {
        const resp = e?.response;
        if (resp?.data instanceof Blob) {
          const text = await resp.data.text();
          const j = JSON.parse(text);
          message = j?.message || j?.error || message; // server sends { message, error }
        }
      } catch { }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };


  const applKey = (a: ApplicantRow, i: number) =>
    a.applicationId ?? `${a.seeker.email}-${i}`;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Applicants</h1>

        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search name / email / phone"
            className="border rounded px-3 py-2 w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All statuses</option>
            {STATUS.map((s) => (
              <option key={`filter-${s}`} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            value={minExp}
            onChange={(e) =>
              setMinExp(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="Min Exp (yrs)"
            className="border rounded px-3 py-2 w-36"
            title="Min experience"
          />
          <input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="Skill (e.g., React)"
            className="border rounded px-3 py-2 w-44"
            title="Skill keyword"
          />
          <button onClick={applyFilter} className="rounded border px-3 py-2 hover:bg-gray-50">
            Filter
          </button>
          <button onClick={clearFilter} className="rounded border px-3 py-2 hover:bg-gray-50">
            Clear
          </button>
          <button onClick={exportXlsx} disabled={exporting} className="rounded border px-3 py-2 hover:bg-gray-50">
            {exporting ? "Exporting…" : "Export Excel"}
          </button>

        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-600">No applicants yet.</div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((a, i) => (
            <li key={applKey(a, i)} className="border rounded-xl p-4 flex items-start justify-between">
              <div className="pr-4">
                <div className="font-medium">{a.seeker.fullName}</div>
                <div className="text-sm text-gray-600">
                  {a.seeker.email} • {a.seeker.phone}
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Applied: {a.appliedOn} • Fit score: {a.score == null ? "—" : a.score}
                </div>

                {(a.seeker.resumeViewCount != null || a.seeker.resumeLastViewedBy) && (
                  <div className="text-xs text-gray-500 mt-1">
                    Views: {a.seeker.resumeViewCount ?? 0}
                    {a.seeker.resumeLastViewedBy
                      ? ` • Last viewed by: ${a.seeker.resumeLastViewedBy}`
                      : ""}
                  </div>
                )}

                {(a.seeker.experienceYears != null || a.seeker.skills) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {a.seeker.experienceYears != null &&
                      `Exp: ${a.seeker.experienceYears} yrs`}
                    {a.seeker.experienceYears != null && a.seeker.skills ? " • " : ""}
                    {a.seeker.skills && `Skills: ${a.seeker.skills}`}
                  </div>
                )}

                {(a.seeker.resume || a.userId) && (
                  <button
                    type="button"
                    onClick={() => handleViewResume(a)}
                    className="text-sm underline mt-2 inline-block"
                  >
                    View resume
                  </button>
                )}

                {a.recruiterNotes && (
                  <div className="text-xs text-gray-700 bg-gray-50 border rounded mt-3 p-2">
                    <span className="font-medium">Private note:</span> {a.recruiterNotes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={a.currentStatus}
                  onChange={(e) =>
                    openStatusModal(a.applicationId, e.target.value, a.recruiterNotes)
                  }
                  className="border rounded px-2 py-2"
                >
                  {STATUS.map((s) => (
                    <option key={`row-${s}`} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    openStatusModal(a.applicationId, a.currentStatus, a.recruiterNotes)
                  }
                  className="px-3 py-2 rounded border hover:bg-gray-50"
                >
                  Note
                </button>

                <button
                  onClick={() => toggleSaved(a.applicationId, true)}
                  className="px-3 py-2 rounded border hover:bg-gray-50"
                >
                  Save
                </button>
                <button
                  onClick={() => toggleSaved(a.applicationId, false)}
                  className="px-3 py-2 rounded border hover:bg-gray-50"
                >
                  Unsave
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link to={`/recruiter/jobs/${jobId}/saved`} className="underline text-sm">
          View saved applicants
        </Link>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeStatusModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Update Status to <span className="text-blue-600">{targetStatus || "Applied"}</span>
              </h2>
              <button
                className="text-gray-500 hover:text-gray-800"
                onClick={closeStatusModal}
                aria-label="Close"
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <label className="block text-sm font-medium mb-1">Private note (recruiter only)</label>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={3}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="e.g., Strong React depth; schedule tech round"
              disabled={saving}
            />

            <label className="block text-sm font-medium mb-1">
              Public feedback (visible to candidate) — optional
            </label>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={3}
              value={draftFeedback}
              onChange={(e) => setDraftFeedback(e.target.value)}
              placeholder="e.g., You’re shortlisted for the next round."
              disabled={saving}
            />

            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 border rounded" onClick={closeStatusModal} disabled={saving}>
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded ${saving ? "bg-gray-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                onClick={confirmStatusChange}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
