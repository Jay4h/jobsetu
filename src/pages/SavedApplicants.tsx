import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api, { normalizeApiError } from "../lib/api";

type SavedRow = {
  applicationId: number;
  userId: number;
  appliedOn?: string;
  currentStatus: string;
  isSaved: boolean;
  applicant: {
    fullName: string;
    email: string;
    phone: string;
    Skills?: string;
    Experience?: number;
  };
  resumeFile?: string | null;
};

export default function SavedApplicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/recruiter/saved-applicants/${jobId}`);

      // Normalize shapes coming from backend
      const list: SavedRow[] = (data?.applicants ?? data ?? []).map((x: any) => {
        const applicant = x.applicant ?? x.Applicant ?? {};
        return {
          applicationId: x.applicationId ?? x.ApplicationId ?? 0,
          userId:
            x.userId ??
            x.UserId ??
            applicant.userId ??
            applicant.UserId ??
            0,
          appliedOn: x.appliedOn ?? x.AppliedOn ?? "",
          currentStatus: x.currentStatus ?? x.CurrentStatus ?? "Applied",
          isSaved: !!(x.isSaved ?? x.IsSaved ?? true),
          applicant: {
            fullName:
              applicant.fullName ?? applicant.FullName ?? "",
            email: applicant.email ?? applicant.Email ?? "",
            phone: applicant.phone ?? applicant.Phone ?? "",
            Skills: applicant.Skills ?? applicant.skills,
            Experience: applicant.Experience ?? applicant.experience,
          },
          resumeFile:
            x.resumeFile ??
            x.ResumeFile ??
            applicant.resume ??
            applicant.Resume ??
            null,
        };
      });

      setRows(list);
    } catch (e) {
      toast.error(normalizeApiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const unsave = async (applicationId: number) => {
    const id = Number(applicationId);
    if (!id) return toast.error("Invalid application id");
    try {
      await api.post(`/api/recruiter/save-applicant`, null, {
        params: { applicationId: id, isSaved: false },
      });
      toast.success("Removed from saved");
      setRows((old) => old.filter((r) => r.applicationId !== id));
    } catch (e) {
      toast.error(normalizeApiError(e).message);
    }
  };

  // Stable key for each row
  const rowKey = (a: SavedRow, i: number) =>
    a.applicationId || a.userId || `${a.applicant.email}-${i}`;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Saved Applicants</h1>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-600">No saved applicants.</div>
      ) : (
        <ul className="space-y-4">
          {rows.map((a, i) => (
            <li key={rowKey(a, i)} className="border rounded-xl p-4 flex justify-between">
              <div>
                <div className="font-medium">{a.applicant.fullName || "—"}</div>
                <div className="text-sm text-gray-600">
                  {a.applicant.email || "—"} • {a.applicant.phone || "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Status: {a.currentStatus} • Applied: {a.appliedOn || "—"} • Exp:{" "}
                  {a.applicant.Experience ?? "—"} yrs
                </div>
                {a.resumeFile && (
                  <a
                    className="text-sm underline mt-2 inline-block"
                    href={`${import.meta.env.VITE_API_BASE_URL}/Uploads/Resumes/${a.resumeFile}`}
                    target="_blank"
                  >
                    View resume
                  </a>
                )}
              </div>
              <button
                onClick={() => unsave(a.applicationId)}
                className="px-3 py-2 rounded border hover:bg-gray-50"
              >
                Unsave
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
