// src/components/ProfileGate.tsx
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getProfileStatus } from "../lib/profileGate";
import { authStorage } from "../lib/api";

/**
 * Global gate that:
 *  - skips when not logged in
 *  - probes role/profile and redirects to the right onboarding page if missing
 *  - runs once (guards StrictMode double-effect)
 */
export default function ProfileGate() {
  const ran = useRef(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (ran.current) return;     // avoid double-run in React 18 StrictMode (dev)
    ran.current = true;

    const token = authStorage.getToken();
    if (!token) return;          // not logged in → nothing to do

    // Don’t gate onboarding pages themselves
    if (loc.pathname.startsWith("/onboarding/")) return;

    (async () => {
      const { role, hasProfile } = await getProfileStatus();

      if (role === "JobSeeker" && !hasProfile) {
        nav("/onboarding/seeker", { replace: true });
      } else if (role === "Recruiter" && !hasProfile) {
        nav("/onboarding/recruiter", { replace: true });
      }
      // else: let them pass
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
