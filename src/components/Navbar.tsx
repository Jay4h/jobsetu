// src/components/Navbar.tsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import AuthModal from "./AuthModal";
import { authStorage, onAuthChanged, fetchConversations } from "../lib/api";
import { onOpenAuth } from "../lib/authGate";
import useSignalRStatus from "../hooks/useSignalRStatus";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
type SavedUser = { userId: number; fullName?: string; role?: string } | null;

function makeInitials(name?: string) {
  const s = (name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// robustly pull payload from various server shapes (object or JSON string)
function pickPayload(args: any[]): any | null {
  for (const a of args) {
    if (!a) continue;
    if (typeof a === "object") {
      if ("senderId" in a || "SenderId" in a || "messageId" in a || "Id" in a) return a;
    }
    if (typeof a === "string") {
      try {
        const o = JSON.parse(a);
        if ("senderId" in o || "SenderId" in o || "messageId" in o || "Id" in o) return o;
      } catch { }
    }
  }
  return null;
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

  // live SignalR status
  const srStatus = useSignalRStatus();
  const srDot =
    {
      connected: "bg-green-500",
      connecting: "bg-yellow-500",
      reconnecting: "bg-orange-500",
      disconnected: "bg-red-500",
      error: "bg-red-600",
      "not loaded": "bg-gray-400",
      unknown: "bg-gray-400",
    }[srStatus] || "bg-gray-400";

  // keep user synced with storage + auth events
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
    const $: any = (window as any).$ || (window as any).jQuery;
    try { $.connection?.hub?.stop(true, true); } catch { }
    authStorage.clear();
    setUser(null);
    setMenuOpen(false);
    setUnreadCount(0);
    window.location.assign("/");
  }

  // Unread badge + SignalR hub wiring (centralized here)
  // Unread badge + SignalR hub wiring (centralized here)
  useEffect(() => {
    const $: any = (window as any).$ || (window as any).jQuery;
    if (!$?.connection) return;

    const me = authStorage.getUser()?.userId || 0;
    const seenIds = new Set<number>();

    async function loadUnread() {
      const u = authStorage.getUser();
      if (!u) { setUnreadCount(0); return; }
      const convos = await fetchConversations();
      const total = Array.isArray(convos)
        ? convos.reduce((s: number, c: any) => s + (c.unread || 0), 0)
        : 0;
      setUnreadCount(total);
    }

    const reconcile = () => {
      loadUnread();
      // light backoff to avoid DB race after server pushes
      setTimeout(loadUnread, 300);
      setTimeout(loadUnread, 1200);
    };

    function processIncoming(raw: any) {
      const p = pickPayload([raw]);
      if (!p) { reconcile(); return; }

      // de-dupe across newMessage + receiveMessage
      const id = p.messageId ?? p.id ?? p.Id;
      if (id != null) {
        if (seenIds.has(id)) return;
        seenIds.add(id);
      }

      // optimistic badge bump if the message is to me
      if (p.receiverId === me) setUnreadCount(n => n + 1);

      // let Messages page refresh its thread/list
      window.dispatchEvent(new CustomEvent("chat:incoming", { detail: p }));

      reconcile();
    }

    async function init() {
      const token = authStorage.getToken();
      if (!token) {
        try { if ($.connection.hub && $.connection.hub.state !== 4) $.connection.hub.stop(); } catch { }
        return;
      }

      // hub URL + token BEFORE start
      $.connection.hub.url = `${API_BASE}/signalr`;
      $.connection.hub.qs = { access_token: token };
      $.connection.hub.logging = true; // console diagnostics

      const hub = $.connection.chatHub;
      hub.client = hub.client || {};

      // bind handlers only once per page
      const w = window as any;
      if (!w.__chatHubHandlersBound) {
        w.__chatHubHandlersBound = true;

        const prevNew = hub.client.newMessage;
        const prevRecv = hub.client.receiveMessage;
        const prevRead = hub.client.markRead;

        hub.client.newMessage = (...args: any[]) => {
          try { prevNew?.(...args); } catch { }
          processIncoming(pickPayload(args));
        };
        hub.client.receiveMessage = (...args: any[]) => {
          try { prevRecv?.(...args); } catch { }
          processIncoming(pickPayload(args));
        };
        hub.client.markRead = (...args: any[]) => {
          try { prevRead?.(...args); } catch { }
          reconcile();
        };

        // resilient reconnect with fresh token
        $.connection.hub.disconnected(async () => {
          const delay = 2000 + Math.floor(Math.random() * 1000);
          setTimeout(async () => {
            try {
              const fresh = authStorage.getToken();
              if (!fresh) return;
              $.connection.hub.url = `${API_BASE}/signalr`;
              $.connection.hub.qs = { access_token: fresh };
              if ($.connection.hub.state === 4) {
                await $.connection.hub.start({ transport: ["webSockets", "serverSentEvents", "longPolling"] });
              }
            } catch (e) {
              console.warn("SignalR re-start failed", e);
            }
          }, delay);
        });
      }

      try {
        if ($.connection.hub.state !== 1) {
          await $.connection.hub.start({ transport: ["webSockets", "serverSentEvents", "longPolling"] });
        }
      } catch (e) {
        console.warn("SignalR start failed", e);
      }
    }

    init();

    // initial + periodic + external pings
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
              <NavLink to="/jobs" className={({ isActive }) => (isActive ? "navlink navlink-active" : "navlink")}>
                Jobs
              </NavLink>
              <NavLink to="/companies" className={({ isActive }) => (isActive ? "navlink navlink-active" : "navlink")}>
                Companies
              </NavLink>
            </div>
          </div>

          <div className="relative flex items-center gap-3" ref={menuRef}>
            {/* SignalR status pill */}
            <div
              className="hidden sm:flex items-center gap-2 text-xs text-gray-600"
              title={`SignalR: ${srStatus}`}
              aria-label="SignalR status"
            >
              <span className={`inline-block w-2 h-2 rounded-full ${srDot}`} />
              <span>{srStatus}</span>
            </div>

            {/* Messages icon (only if logged in) */}
            {user && (
              <button
                onClick={() => nav("/messages")}
                className="relative h-9 w-9 rounded-xl border border-gray-300 flex items-center justify-center"
                aria-label="Messages"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 17.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75m19.5 0v.243a2.25 2.25 0 01-.66 1.59l-7.845 7.845a2.25 2.25 0 01-3.18 0L3.66 8.583a2.25 2.25 0 01-.66-1.59V6.75" />
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
                  <div role="menu" className="absolute right-0 top-12 w-56 bg-white border rounded-xl shadow-lg overflow-hidden">
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
                        Applied & Saved Jobs
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
