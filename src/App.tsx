// src/App.tsx
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Companies from "./pages/Companies";
import CompanyJobs from "./pages/CompanyJobs";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardSeeker from "./pages/OnboardSeeker";
import OnboardRecruiter from "./pages/OnboardRecruiter";
import ProfileGate from "./components/ProfileGate";
import { setUnauthorizedHandler } from "./lib/api";
import Profile from "./pages/Profile";
import AppliedSavedJobsHub from "./pages/AppliedSavedJobsHub";
import { openAuth } from "./lib/authGate";

// ✅ Recruiter pages
import RecruiterProfile from "./pages/RecruiterProfile";
import RecruiterJobs from "./pages/RecruiterJobs";
import PostJob from "./pages/PostJob";
import EditJob from "./pages/EditJob";
import Applicants from "./pages/Applicants";
import RecruiterAnalytics from "./pages/RecruiterAnalytics";
import SavedApplicants from "./pages/SavedApplicants";

function AppLayout() {
  const loc = useLocation();
  const showGate = !/^\/onboarding(\/|$)/i.test(loc.pathname); // ⬅️ skip on onboarding

  return (
    <>
      <Navbar />
      {showGate && <ProfileGate />} {/* runs on all routes except /onboarding/* */}
      <Outlet />
    </>
  );
}

export default function App() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      openAuth("login"); // show login popup on global 401/403
    });
  }, []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:companyId" element={<CompanyJobs />} />

        {/* Onboarding */}
        <Route path="/onboarding/seeker" element={<OnboardSeeker />} />
        <Route path="/onboarding/recruiter" element={<OnboardRecruiter />} />

        {/* Profile (Job Seeker) */}
        <Route path="/profile" element={<Profile />} />

        {/* ✅ Recruiter (Protected) */}
        <Route
          path="/recruiter/profile"
          element={
            <ProtectedRoute role="Recruiter">
              <RecruiterProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs"
          element={
            <ProtectedRoute role="Recruiter">
              <RecruiterJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/post"
          element={
            <ProtectedRoute role="Recruiter">
              <PostJob />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/edit"
          element={
            <ProtectedRoute role="Recruiter">
              <EditJob />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/applicants"
          element={
            <ProtectedRoute role="Recruiter">
              <Applicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/saved"
          element={
            <ProtectedRoute role="Recruiter">
              <SavedApplicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/analytics"
          element={
            <ProtectedRoute role="Recruiter">
              <RecruiterAnalytics />
            </ProtectedRoute>
          }
        />

        {/* Job Seeker (Protected) */}
        <Route
          path="/applied-saved-jobs"
          element={
            <ProtectedRoute role="JobSeeker">
              <AppliedSavedJobsHub />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16">
              <h1 className="text-xl font-semibold">Page not found</h1>
              <p className="text-gray-600 mt-1">
                The page you’re looking for doesn’t exist.
              </p>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
