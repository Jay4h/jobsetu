// src/components/Navbar.tsx
import { Link, NavLink } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import AuthModal from "./AuthModal";
import { authStorage, onAuthChanged } from "../lib/api";

type SavedUser = { fullName?: string; role?: string } | null;

function readUser(): SavedUser {
  const saved = localStorage.getItem("jobsetu_user");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export default function Navbar() {
  //const link = "text-sm text-gray-700 hover:text-gray-900";
  const pillBtn =
    "px-3 h-9 inline-flex items-center rounded-xl border border-gray-300 text-sm";

  const [user, setUser] = useState<SavedUser>(readUser());
  const [open, setOpen] = useState(false);
  const [startTab, setStartTab] =
    useState<"login" | "register" | "forgot">("login");
  const [menuOpen, setMenuOpen] = useState(false);

  // keep in sync across tabs + react to authStorage changes
  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "jobsetu_user" || e.key === "jobsetu_token") {
        setUser(readUser());
      }
    };
    const off = onAuthChanged(() => setUser(readUser()));

    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      off();
    };
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpen(false);
    setUser(readUser());
  }, []);

  function handleLogout() {
    authStorage.clear();
    try {
      localStorage.removeItem("jobsetu_user");
    } catch { }
    setUser(null);
    setMenuOpen(false);

    window.location.reload();
  }

  const initials =
    (user?.fullName || "")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <>
      <nav className="w-full bg-white/90 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link to="/" className="font-semibold text-lg">
              JobSetu
            </Link>
            <div className="flex items-center gap-6">
              <NavLink
                to="/jobs"
                className={({ isActive }) => isActive ? "navlink navlink-active" : "navlink"}
              >
                Jobs
              </NavLink>
              <NavLink
                to="/companies"
                className={({ isActive }) => isActive ? "navlink navlink-active" : "navlink"}
              >
                Companies
              </NavLink>
            </div>
          </div>

          {/* right: auth / profile */}
          <div className="relative flex items-center gap-2">
            {!user ? (
              <>
                <button
                  className={pillBtn}
                  onClick={() => {
                    setStartTab("login");
                    setOpen(true);
                  }}
                >
                  Login
                </button>
                <button
                  className={pillBtn}
                  onClick={() => {
                    setStartTab("register");
                    setOpen(true);
                  }}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                <button
                  className="h-9 px-2 rounded-xl border border-gray-300 inline-flex items-center gap-2"
                  onClick={() => setMenuOpen((s) => !s)}
                >
                  <span className="h-7 w-7 rounded-full bg-gray-900 text-white grid place-items-center text-xs font-semibold">
                    {initials}
                  </span>
                  <span className="hidden sm:inline text-sm">
                    {user.fullName}
                  </span>
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-12 w-48 bg-white border rounded-xl shadow-lg overflow-hidden"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <div className="px-3 py-2 text-xs text-gray-500">
                      {user.role ? `Role: ${user.role}` : "Signed in"}
                    </div>
                    <Link
                      to={
                        user.role === "Recruiter" ? "/recruiter/profile" : "/profile"
                      }
                      className="block px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    {user.role === "Recruiter" ? (
                      <Link
                        to="/recruiter/jobs"
                        className="block px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Jobs
                      </Link>
                    ) : (
                      <Link
                        to="/applied-saved-jobs"  // Updated link to point to the combined page
                        className="block px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Applied & Saved Jobs  {/* Updated text to match combined page */}
                      </Link>
                    )}
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Auth modal */}
      <AuthModal open={open} onClose={handleCloseModal} startTab={startTab} />
    </>
  );
}
