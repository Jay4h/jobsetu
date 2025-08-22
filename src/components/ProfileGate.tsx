// src/components/ProfileGate.tsx
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { authStorage, getRoleFromToken } from "../lib/api";

export default function ProfileGate() {
  const ran = useRef(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (ran.current) return; // avoid StrictMode double-run
    ran.current = true;

    const path = loc.pathname.toLowerCase();

    // Skip while already on onboarding (handles "/onboarding" and "/onboarding/...")
    if (/^\/onboarding(\/|$)/.test(path)) return;

    // Not logged in → nothing to do
    if (!authStorage.getToken()) return;

    (async () => {
      const role = getRoleFromToken();
      if (!role) return;

      try {
        if (role === "Recruiter") {
          // ✅ boolean endpoint = no 404 noise
          const { data } = await api.get("/api/recruiter/profile/exists", {
            suppressUnauthorized: true,
          });
          if (!data?.exists) nav("/onboarding/recruiter", { replace: true });
        } else if (role === "JobSeeker") {
          // ✅ boolean endpoint for seeker
          const { data } = await api.get("/api/user/profile/exists", {
            suppressUnauthorized: true,
          });
          if (!data?.exists) nav("/onboarding/seeker", { replace: true });
        }
      } catch {
        // swallow transient errors; don't block navigation
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  return null;
}
