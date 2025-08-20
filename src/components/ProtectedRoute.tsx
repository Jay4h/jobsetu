// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react"; // type-only (for verbatimModuleSyntax)
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authStorage } from "../lib/api";
import { getProfileStatus } from "../lib/profileGate";

type ProtectedRouteProps = {
  role?: "JobSeeker" | "Recruiter" | "Admin";
  requireProfile?: boolean; // default true
  children?: ReactNode;     // wrapper usage: <ProtectedRoute>...</ProtectedRoute>
};

/**
 * Auth + (optional) role + (optional) profile-completion guard.
 * Works for both wrapper and nested route patterns.
 */
export default function ProtectedRoute({
  role,
  requireProfile = true,
  children,
}: ProtectedRouteProps) {
  const token = authStorage.getToken();
  const [checking, setChecking] = useState(true);
  const [redir, setRedir] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1) Not logged in → redirect
      if (!token) {
        if (mounted) {
          setRedir("/");
          setChecking(false);
        }
        return;
      }

      // 2) Check role + onboarding/profile status
      try {
        const status = await getProfileStatus(); // { role: "JobSeeker"|"Recruiter"|"Admin", hasProfile: boolean }
        if (!mounted) return;

        // Role gate (if provided)
        if (role && status.role !== role) {
          setRedir("/");
          setChecking(false);
          return;
        }

        // Enforce onboarding/profile completion (if enabled)
        if (requireProfile) {
          if (status.role === "JobSeeker" && !status.hasProfile) {
            setRedir("/onboarding/seeker");
            setChecking(false);
            return;
          }
          if (status.role === "Recruiter" && !status.hasProfile) {
            setRedir("/onboarding/recruiter");
            setChecking(false);
            return;
          }
        }
      } catch {
        // If profile status fails, treat as unauthorized
        setRedir("/");
        setChecking(false);
        return;
      }

      setChecking(false);
    })();

    return () => {
      mounted = false;
    };
  }, [token, role, requireProfile]);

  if (checking) return null; // or a tiny spinner
  if (redir) return <Navigate to={redir} replace state={{ from: location }} />;
  if (!token) return <Navigate to="/" replace state={{ from: location }} />;

  // Support both usage styles
  return children ? <>{children}</> : <Outlet />;
}
