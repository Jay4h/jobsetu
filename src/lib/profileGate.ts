import api, { getRoleFromToken } from "./api";

export type Role = "JobSeeker" | "Recruiter" | "Unknown";
export type ProfileStatus = { role: Role; hasProfile: boolean };

export async function getProfileStatus(): Promise<ProfileStatus> {
  // 0) Try to read role from JWT; this avoids the extra 401 entirely
  const tokenRole = getRoleFromToken();

  if (tokenRole === "JobSeeker") {
    try {
      await api.get("/api/user/profile", { suppressUnauthorized: true });
      return { role: "JobSeeker", hasProfile: true };
    } catch (e: any) {
      const s = Number(e?.status ?? e?.response?.status);
      if (s === 404) return { role: "JobSeeker", hasProfile: false };
      // anything else → unknown
      return { role: "Unknown", hasProfile: false };
    }
  }

  if (tokenRole === "Recruiter") {
    try {
      await api.get("/api/recruiter/profile", { suppressUnauthorized: true });
      return { role: "Recruiter", hasProfile: true };
    } catch (e: any) {
      const s = Number(e?.status ?? e?.response?.status);
      if (s === 400 || s === 404) return { role: "Recruiter", hasProfile: false };
      return { role: "Unknown", hasProfile: false };
    }
  }

  // Fallback: if token has no role claim, keep the old dual-probe logic
  try {
    await api.get("/api/user/profile", { suppressUnauthorized: true });
    return { role: "JobSeeker", hasProfile: true };
  } catch (e: any) {
    const s = Number(e?.status ?? e?.response?.status);
    if (s === 404) return { role: "JobSeeker", hasProfile: false };
  }

  try {
    await api.get("/api/recruiter/profile", { suppressUnauthorized: true });
    return { role: "Recruiter", hasProfile: true };
  } catch (e: any) {
    const s = Number(e?.status ?? e?.response?.status);
    if (s === 400 || s === 404) return { role: "Recruiter", hasProfile: false };
  }

  return { role: "Unknown", hasProfile: false };
}
