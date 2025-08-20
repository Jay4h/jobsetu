import { Routes, Route, Outlet } from "react-router-dom";
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
function AppLayout() {
  return (
    <>
      <Navbar />
      <ProfileGate />   {/* 👈 runs on every route */}
      <Outlet />
    </>
  );
}

export default function App() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      alert("Your session expired or you are not logged in. Please sign in.");
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
        <Route path="/profile" element={<Profile />} />

        {/* Protected Routes */}
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
