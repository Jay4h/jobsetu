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
  seeker: {
    fullName: string;
    email: string;
    phone: string;
    resume?: string | null;
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

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  // ===== Notes + Public Feedback Modal State =====
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
    if (saving) return; // prevent closing while saving
    setModalOpen(false);
    setDraftNote("");
    setDraftFeedback("");
    setTargetAppId(null);
    setTargetStatus("");
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStatusModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/recruiter/applicants/${jobId}`);

      const mapped: ApplicantRow[] = (data?.applicants ?? []).map((x: any) => {
        const seeker = x.seeker ?? x.Seeker ?? x.applicant ?? x.Applicant ?? {};
        return {
          applicationId: x.applicationId ?? x.ApplicationId,
          appliedOn: x.appliedOn ?? x.AppliedOn ?? "",
          currentStatus: x.currentStatus ?? x.CurrentStatus ?? "Applied",
          statusHistory: x.statusHistory ?? x.StatusHistory ?? "",
          recruiterNotes: x.recruiterNotes ?? x.RecruiterNotes ?? "",
          score: x.score ?? x.ResumeFitScore ?? x.FitScore ?? null,
          seeker: {
            fullName:
              seeker.fullName ?? seeker.FullName ?? x.fullName ?? x.FullName ?? "",
            email: seeker.email ?? seeker.Email ?? x.email ?? x.Email ?? "",
            phone: seeker.phone ?? seeker.Phone ?? x.phone ?? x.Phone ?? "",
            resume:
              seeker.resume ??
              seeker.Resume ??
              x.resumeFile ??
              x.ResumeFile ??
              null,
          },
        };
      });

      setRows(mapped);
    } catch (e) {
      toast.error(normalizeApiError(e).message);
    } finally {
      setLoading(false);
    }
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
        PublicFeedback: publicFeedback || "", // candidate-visible feedback
      });
      toast.success("Status updated");
      setRows((old) =>
        old.map((r) =>
          r.applicationId === id
            ? { ...r, currentStatus: newStatus, recruiterNotes: note || r.recruiterNotes }
            : r
        )
      );
    } catch (e) {
      toast.error(normalizeApiError(e).message);
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

  const toggleSaved = async (applicationId: number, wantSaved: boolean) => {
    const id = Number(applicationId);
    if (!id) return toast.error("Invalid application id");
    try {
      await api.post(`/api/recruiter/save-applicant`, null, {
        params: { applicationId: id, isSaved: wantSaved },
      });
      toast.success(wantSaved ? "Saved" : "Unsaved");
    } catch (e) {
      toast.error(normalizeApiError(e).message);
    }
  };

  // ===== CSV Export =====

  // parse filename from Content-Disposition
  function getFilenameFromDisposition(h?: string | null) {
    if (!h) return null;
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(h);
    return m ? decodeURIComponent(m[1]) : null;
  }

  const exportCsv = async () => {
    if (!jobId) return;
    try {
      const res = await api.get(`/api/recruiter/export-applicants/${jobId}`, {
        responseType: "blob",
        headers: { Accept: "text/csv" },
      });

      // axios: headers is a plain object
      const dispo =
        (res as any).headers?.["content-disposition"] ??
        (res as any).headers?.get?.("content-disposition");
      const suggested = getFilenameFromDisposition(dispo);
      const filename = suggested || `applicants_job_${jobId}.csv`;

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not export applicants."
      );
    }
  };

  const applKey = (a: ApplicantRow, i: number) =>
    a.applicationId ?? `${a.seeker.email}-${i}`;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Applicants</h1>
        <div className="flex items-center gap-2">
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
          <button
            onClick={exportCsv}
            className="rounded border px-3 py-2 hover:bg-gray-50"
          >
            Export CSV
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
            <li
              key={applKey(a, i)}
              className="border rounded-xl p-4 flex items-start justify-between"
            >
              <div className="pr-4">
                <div className="font-medium">{a.seeker.fullName}</div>
                <div className="text-sm text-gray-600">
                  {a.seeker.email} • {a.seeker.phone}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Applied: {a.appliedOn} • Fit score:{" "}
                  {a.score == null ? "—" : a.score}
                </div>

                {a.seeker.resume && (
                  <a
                    className="text-sm underline mt-2 inline-block"
                    href={`${
                      import.meta.env.VITE_API_BASE_URL
                    }/Uploads/Resumes/${a.seeker.resume}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View resume
                  </a>
                )}

                {a.recruiterNotes && (
                  <div className="text-xs text-gray-700 bg-gray-50 border rounded mt-3 p-2">
                    <span className="font-medium">Private note:</span>{" "}
                    {a.recruiterNotes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Change status opens modal with both private note + public feedback */}
                <select
                  value={a.currentStatus}
                  onChange={(e) =>
                    openStatusModal(
                      a.applicationId,
                      e.target.value,
                      a.recruiterNotes
                    )
                  }
                  className="border rounded px-2 py-2"
                >
                  {STATUS.map((s) => (
                    <option key={`row-${s}`} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Add/Edit note without changing status */}
                <button
                  onClick={() =>
                    openStatusModal(
                      a.applicationId,
                      a.currentStatus,
                      a.recruiterNotes
                    )
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
        <Link
          to={`/recruiter/jobs/${jobId}/saved`}
          className="underline text-sm"
        >
          View saved applicants
        </Link>
      </div>

      {/* ===== Status change / Note modal ===== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeStatusModal}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl p-5"
            onClick={(e) => e.stopPropagation()} // prevent backdrop close when clicking inside
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Update Status to{" "}
                <span className="text-blue-600">
                  {targetStatus || "Applied"}
                </span>
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

            <label className="block text-sm font-medium mb-1">
              Private note (recruiter only)
            </label>
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
              <button
                className="px-4 py-2 border rounded"
                onClick={closeStatusModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  saving
                    ? "bg-gray-400 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
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
