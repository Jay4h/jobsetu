// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authStorage } from "../lib/api";
import { getProfileStatus } from "../lib/profileGate";

/**
 * Route guard for truly private pages.
 * (You can keep Jobs/Companies public; put dashboards/messages/etc. under this.)
 * It also enforces profile completion just in case someone lands deep-linked.
 */
export default function ProtectedRoute() {
  const token = authStorage.getToken();
  const [checking, setChecking] = useState(true);
  const [redir, setRedir] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!token) {
        if (!mounted) return;
        setRedir("/"); // or "/auth" if you have a dedicated page
        setChecking(false);
        return;
      }

      const status = await getProfileStatus();
      if (!mounted) return;

      if (status.role === "JobSeeker" && !status.hasProfile) {
        setRedir("/onboarding/seeker");
      } else if (status.role === "Recruiter" && !status.hasProfile) {
        setRedir("/onboarding/recruiter");
      }

      setChecking(false);
    })();

    return () => { mounted = false; };
  }, [token]);

  if (checking) return null; // or a tiny spinner
  if (redir) return <Navigate to={redir} replace state={{ from: location }} />;
  if (!token) return <Navigate to="/" replace state={{ from: location }} />;

  return <Outlet />;
}
