// src/components/Navbar.tsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import AuthModal from "./AuthModal";
import { authStorage, onAuthChanged } from "../lib/api";
import { onOpenAuth } from "../lib/authGate";

type SavedUser = { fullName?: string; role?: string } | null;

function safeRead(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function readUser(): SavedUser {
  const saved = safeRead("jobsetu_user");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}
function makeInitials(name?: string) {
  const s = (name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Navbar() {
  const pillBtn =
    "px-3 h-9 inline-flex items-center rounded-xl border border-gray-300 text-sm";
  const [user, setUser] = useState<SavedUser>(readUser());
  const [open, setOpen] = useState(false);
  const [startTab, setStartTab] =
    useState<"login" | "register" | "forgot">("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  // keep in sync across tabs, react to auth changes, listen for global "open auth"
  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.storageArea !== localStorage) return;
      if (e.key === "jobsetu_user" || e.key === "jobsetu_token") {
        setUser(readUser());
      }
    };
    const offAuthChange = onAuthChanged(() => setUser(readUser()));

    // Listen for global request to open auth modal (from cards / 401 handler)
    const offOpenAuth = onOpenAuth((tab) => {
      setStartTab(tab);
      setOpen(true);
    });

    // Close menu on outside click
    const clickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    // Esc to close
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("storage", storageHandler);
    window.addEventListener("click", clickAway);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("click", clickAway);
      window.removeEventListener("keydown", esc);
      offAuthChange();
      offOpenAuth();
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
    } catch {}
    setUser(null);
    setMenuOpen(false);
    window.location.assign("/"); // hard redirect to clear state everywhere
  }

  const initials = makeInitials(user?.fullName);

  return (
    <>
      <nav className="w-full bg-white/90 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link to="/" className="font-semibold text-lg" aria-label="JobSetu Home">
              JobSetu
            </Link>
            <div className="flex items-center gap-6">
              <NavLink
                to="/jobs"
                className={({ isActive }) =>
                  isActive ? "navlink navlink-active" : "navlink"
                }
              >
                Jobs
              </NavLink>
              <NavLink
                to="/companies"
                className={({ isActive }) =>
                  isActive ? "navlink navlink-active" : "navlink"
                }
              >
                Companies
              </NavLink>
            </div>
          </div>

          {/* right: auth / profile */}
          <div className="relative flex items-center gap-2" ref={menuRef}>
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
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="h-7 w-7 rounded-full bg-gray-900 text-white grid place-items-center text-xs font-semibold">
                    {initials}
                  </span>
                  <span className="hidden sm:inline text-sm">
                    {user.fullName}
                  </span>
                  <span className="sr-only">Open profile menu</span>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 w-56 bg-white border rounded-xl shadow-lg overflow-hidden"
                  >
                    <div className="px-3 py-2 text-xs text-gray-500">
                      {user.role ? `Role: ${user.role}` : "Signed in"}
                    </div>

                    <button
                      role="menuitem"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setMenuOpen(false);
                        if (user.role === "Recruiter") {
                          nav("/recruiter/profile");
                        } else {
                          nav("/profile");
                        }
                      }}
                    >
                      Profile
                    </button>

                    {user.role === "Recruiter" ? (
                      <>
                        <button
                          role="menuitem"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setMenuOpen(false);
                            nav("/recruiter/jobs");
                          }}
                        >
                          My Jobs
                        </button>
                        <button
                          role="menuitem"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setMenuOpen(false);
                            nav("/recruiter/post");
                          }}
                        >
                          Post a Job
                        </button>
                        <button
                          role="menuitem"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setMenuOpen(false);
                            nav("/recruiter/analytics");
                          }}
                        >
                          Analytics
                        </button>
                      </>
                    ) : (
                      <button
                        role="menuitem"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => {
                          setMenuOpen(false);
                          nav("/applied-saved-jobs");
                        }}
                      >
                        Applied &amp; Saved Jobs
                      </button>
                    )}

                    <button
                      role="menuitem"
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
