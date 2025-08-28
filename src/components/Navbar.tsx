// src/components/Navbar.tsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import AuthModal from "./AuthModal";
import { authStorage, onAuthChanged, fetchConversations } from "../lib/api";
import { onOpenAuth } from "../lib/authGate";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
type SavedUser = { userId: number; fullName?: string; role?: string } | null;

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

  const [user, setUser] = useState<SavedUser>(authStorage.getUser());
  const [open, setOpen] = useState(false);
  const [startTab, setStartTab] = useState<"login" | "register" | "forgot">("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // 🔹 Keep user in sync with localStorage changes
  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.storageArea !== localStorage) return;
      if (e.key === "jobsetu_user" || e.key === "jobsetu_token") {
        setUser(authStorage.getUser());
      }
    };
    const offAuthChange = onAuthChanged(() => setUser(authStorage.getUser()));
    const offOpenAuth = onOpenAuth((tab) => {
      setStartTab(tab);
      setOpen(true);
    });

    const clickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
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
    setUser(authStorage.getUser());
  }, []);

  function handleLogout() {
    authStorage.clear();
    setUser(null);
    setMenuOpen(false);
    setUnreadCount(0);
    window.location.assign("/");
  }

  // 🔹 Setup SignalR + unread count
  useEffect(() => {
    const $: any = (window as any).$;
    if (!$ || !$.connection) return;

    async function loadUnread() {
      if (!user) { setUnreadCount(0); return; }
      const convos = await fetchConversations();
      const total = Array.isArray(convos)
        ? convos.reduce((s, c) => s + (c.unread || 0), 0)
        : 0;
      setUnreadCount(total);
    }

    async function init() {
      const token = authStorage.getToken();
      if (!token) {
        try { if ($.connection.hub && $.connection.hub.state !== 4) $.connection.hub.stop(); } catch { }
        return;
      }

      // hub url + token
      $.connection.hub.url = `${API_BASE}/signalr`;
      $.connection.hub.qs = { access_token: token };

      const hub = $.connection.chatHub;
      hub.client = hub.client || {};

      // chain existing handlers (don’t clobber)
      const prevNew = hub.client.newMessage;
      const prevRecv = hub.client.receiveMessage;
      const prevRead = hub.client.markRead;

      const me = authStorage.getUser()?.userId;

      // fetch a couple of times after the push to avoid race with DB writes
      const reconcile = () => {
        loadUnread();
        setTimeout(loadUnread, 400);
        setTimeout(loadUnread, 1500);
      };

      hub.client.newMessage = async (payload: any, ...rest: any[]) => {
        try { await prevNew?.(payload, ...rest); } catch { }
        if (payload?.receiverId === me) {
          // 👍 optimistic bump so it won't flash back to 0
          setUnreadCount(n => n + 1);
        }
        reconcile();
      };

      hub.client.receiveMessage = async (payload: any, ...rest: any[]) => {
        try { await prevRecv?.(payload, ...rest); } catch { }
        if (payload?.receiverId === me) {
          setUnreadCount(n => n + 1);
        }
        reconcile();
      };

      hub.client.markRead = async (...args: any[]) => {
        try { await prevRead?.(...args); } catch { }
        reconcile();
      };

      // reconnect
      const w = window as any;
      if (!w.__chatHubReconnectBound) {
        w.__chatHubReconnectBound = true;
        $.connection.hub.disconnected(async () => {
          const delay = 2000 + Math.floor(Math.random() * 1000);
          setTimeout(async () => {
            try {
              const fresh = authStorage.getToken(); if (!fresh) return;
              $.connection.hub.url = `${API_BASE}/signalr`;
              $.connection.hub.qs = { access_token: fresh };
              if ($.connection.hub.state === 4) {
                await $.connection.hub.start({ transport: ["serverSentEvents", "longPolling"] });
              }
            } catch { }
          }, delay);
        });
      }

      try {
        if ($.connection.hub.state === 4) {
          await $.connection.hub.start({ transport: ["serverSentEvents", "longPolling"] });
        }
      } catch { }
    }

    init();

    // initial + periodic + external “read” events
    loadUnread();
    const onPing = () => loadUnread();
    window.addEventListener("chat:unread-changed", onPing);
    const timer = setInterval(loadUnread, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("chat:unread-changed", onPing);
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

          <div className="relative flex items-center gap-3" ref={menuRef}>
            {/* 🔹 Messages icon (only if logged in) */}
            {user && (
              <button
                onClick={() => nav("/messages")}
                className="relative h-9 w-9 rounded-xl border border-gray-300 flex items-center justify-center"
                aria-label="Messages"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-gray-700"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 17.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75m19.5 0v.243a2.25 2.25 0 01-.66 1.59l-7.845 7.845a2.25 2.25 0 01-3.18 0L3.66 8.583a2.25 2.25 0 01-.66-1.59V6.75"
                  />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            )}

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
                  <span className="hidden sm:inline text-sm">{user.fullName}</span>
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
                        if (user.role === "Recruiter") nav("/recruiter/profile");
                        else nav("/profile");
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
                        Applied & Saved Jobs
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

      <AuthModal open={open} onClose={handleCloseModal} startTab={startTab} />
    </>
  );
}
