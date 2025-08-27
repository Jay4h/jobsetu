// src/components/Navbar.tsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import AuthModal from "./AuthModal";
import { authStorage, onAuthChanged } from "../lib/api";
import { onOpenAuth } from "../lib/authGate";

type SavedUser = { fullName?: string; role?: string } | null;

function safeRead(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readUser(): SavedUser {
  const saved = safeRead("jobsetu_user");
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
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
  const [startTab, setStartTab] = useState<"login" | "register" | "forgot">("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.storageArea !== localStorage) return;
      if (e.key === "jobsetu_user" || e.key === "jobsetu_token") {
        setUser(readUser());
      }
    };
    const offAuthChange = onAuthChanged(() => setUser(readUser()));
    const offOpenAuth = onOpenAuth((tab) => { setStartTab(tab); setOpen(true); });

    const clickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };

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
    try { localStorage.removeItem("jobsetu_user"); } catch {}
    setUser(null);
    setMenuOpen(false);
    setUnread(0);
    window.location.assign("/");
  }

  // ---- SignalR unread counter (via Vite proxy + generated hubs) ----
  useEffect(() => {
    // @ts-ignore jQuery is loaded globally in index.html
    const $: any = (window as any).$;
    if (!$ || !$.connection) return;

    async function fetchUnread(token: string) {
      try {
        const res = await fetch("/api/message/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnread(Number(data?.count || 0));
        } else {
          setUnread(0);
        }
      } catch {
        /* ignore */
      }
    }

    async function init() {
      const token = authStorage.getToken();

      // logged out → clear & (optionally) stop hub
      if (!token) {
        setUnread(0);
        try {
          if ($.connection.hub && $.connection.hub.state !== 4 /* disconnected */) {
            $.connection.hub.stop();
          }
        } catch {}
        return;
      }

      // initial count
      await fetchUnread(token);

      // generated proxy from /signalr/hubs
      const hub = $.connection.chatHub;
      hub.client = hub.client || {};
      hub.client.updateUnread = (payload: { count: number }) => {
        if (typeof payload?.count === "number") setUnread(payload.count);
      };
      hub.client.receiveMessage = () => fetchUnread(token);
      hub.client.read = () => fetchUnread(token);

      // target the proxied path and pass JWT
      $.connection.hub.url = "/signalr";
      $.connection.hub.qs = { access_token: token };

      // register a single reconnect handler per page
      const w = window as any;
      if (!w.__chatHubReconnectBound) {
        w.__chatHubReconnectBound = true;
        $.connection.hub.disconnected(async () => {
          const delay = 2000 + Math.floor(Math.random() * 1000);
          setTimeout(async () => {
            try {
              const fresh = authStorage.getToken();
              if (!fresh) return;
              $.connection.hub.qs = { access_token: fresh };
              if ($.connection.hub.state === 4) {
                await $.connection.hub.start();
              }
            } catch {}
          }, delay);
        });
      }

      // start only if disconnected
      try {
        if ($.connection.hub.state === 4 /* disconnected */) {
          await $.connection.hub.start();
        }
      } catch {
        // ignore; it will retry on next auth change or disconnect callback
      }
    }

    init();

    return () => {
      // keep the shared hub alive; no stop here
    };
  }, [user]);

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
              <NavLink to="/jobs" className={({ isActive }) => (isActive ? "navlink navlink-active" : "navlink")}>
                Jobs
              </NavLink>
              <NavLink to="/companies" className={({ isActive }) => (isActive ? "navlink navlink-active" : "navlink")}>
                Companies
              </NavLink>
            </div>
          </div>

          <div className="relative flex items-center gap-3" ref={menuRef}>
            {/* Messages icon + badge (only when logged in) */}
            {user && (
              <NavLink
                to="/messages"
                aria-label="Messages"
                className="relative h-9 w-9 grid place-items-center rounded-xl border border-gray-300 hover:bg-gray-50"
                title="Messages"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
            )}

            {!user ? (
              <>
                <button className={pillBtn} onClick={() => { setStartTab("login"); setOpen(true); }}>
                  Login
                </button>
                <button className={pillBtn} onClick={() => { setStartTab("register"); setOpen(true); }}>
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
                  <span className="hidden sm:inline text-sm">{user.fullName}</span>
                  <span className="sr-only">Open profile menu</span>
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-12 w-56 bg-white border rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-2 text-xs text-gray-500">{user.role ? `Role: ${user.role}` : "Signed in"}</div>

                    <button
                      role="menuitem"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setMenuOpen(false);
                        if (user.role === "Recruiter") nav("/recruiter/profile");
                        else nav("/profile");
                      }}
                    >
                      Profile
                    </button>

                    {user.role === "Recruiter" ? (
                      <>
                        <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setMenuOpen(false); nav("/recruiter/jobs"); }}>
                          My Jobs
                        </button>
                        <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setMenuOpen(false); nav("/recruiter/post"); }}>
                          Post a Job
                        </button>
                        <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setMenuOpen(false); nav("/recruiter/analytics"); }}>
                          Analytics
                        </button>
                      </>
                    ) : (
                      <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setMenuOpen(false); nav("/applied-saved-jobs"); }}>
                        Applied &amp; Saved Jobs
                      </button>
                    )}

                    <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      <AuthModal open={open} onClose={handleCloseModal} startTab={startTab} />
    </>
  );
}
