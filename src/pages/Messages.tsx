// src/pages/Messages.tsx
import { useEffect, useState, useRef } from "react";
import { authStorage, fetchConversations } from "../lib/api";

type Conversation = {
  userId: number;
  lastMessage?: string | null;
  lastTimestamp?: string | null;
  unread: number;
  fullName?: string;
  companyName?: string;
  logoUrl?: string;
};

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  text: string | null;
  fileUrl: string | null;
  sentAtUtc: string;
  isRead: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const IST_TZ = "Asia/Kolkata";

// ---------- helpers ----------
function normalizeMsg(raw: any): Message {
  const toNum = (v: any) => Number(v ?? 0);
  return {
    id: toNum(raw.messageId ?? raw.id ?? raw.Id),
    senderId: toNum(raw.senderId ?? raw.SenderId),
    receiverId: toNum(raw.receiverId ?? raw.ReceiverId),
    text: raw.messageText ?? raw.text ?? raw.Text ?? null,
    fileUrl: raw.fileUrl ?? raw.FileUrl ?? null,
    sentAtUtc: raw.sentAt ?? raw.SentAt ?? raw.sentAtUtc ?? raw.SentAtUtc,
    isRead: Boolean(raw.isRead ?? raw.IsRead ?? false),
  };
}

// Prefer saved user; fallback to decoding JWT
function getMyIdSafe(): number | null {
  const u = authStorage.getUser();
  if (u?.userId) return u.userId;

  const tok = authStorage.getToken();
  if (!tok) return null;
  const jwt = tok.replace(/^Bearer\s+/i, "");
  const parts = jwt.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const val =
      payload.userId ||
      payload.userid ||
      payload.UserId ||
      payload.nameid ||
      payload.sub ||
      payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier"];
    const n = parseInt(String(val), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Dates
function parseDateish(s?: string | null): Date | null {
  if (!s) return null;
  const ms = /^\/Date\((\d+)\)\/$/.exec(s);
  if (ms) {
    const d = new Date(parseInt(ms[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  const isoNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s);
  const fixed = isoNoTz ? s + "Z" : s;
  const d2 = new Date(fixed);
  return isNaN(d2.getTime()) ? null : d2;
}
function fmtTimeIST(s?: string | null): string {
  const d = parseDateish(s); if (!d) return "";
  try {
    return d.toLocaleTimeString("en-IN", { timeZone: IST_TZ, hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
}
function fmtDateIST(s?: string | null): string {
  const d = parseDateish(s); if (!d) return "";
  try {
    return d.toLocaleDateString("en-IN", { timeZone: IST_TZ, month: "short", day: "numeric" });
  } catch {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
}

function toAbs(url?: string | null) {
  if (!url) return "/default-avatar.jpg";
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}
function isRecruiterItem(u: any) {
  const t = u?.type || u?.Type;
  return String(t).toLowerCase() === "recruiter";
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUser, setActiveUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // keep my id in a ref so it’s available in handlers
  const myIdRef = useRef<number | null>(getMyIdSafe());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeUserIdRef = useRef<number | null>(null);
  useEffect(() => { activeUserIdRef.current = activeUser?.userId ?? null; }, [activeUser]);

  // keep myId up to date if auth changes
  useEffect(() => {
    const sync = () => { myIdRef.current = getMyIdSafe(); };
    window.addEventListener("storage", sync);
    window.addEventListener("chat:auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("chat:auth-changed", sync);
    };
  }, []);

  // ✅ New: robust ownership check with fallback to peer id
  const isMine = (senderId: number) => {
    const me = myIdRef.current;
    const peer = activeUserIdRef.current;
    if (me != null) return senderId === me;
    // when we don't know 'me' yet, infer: in a 1-to-1 chat, if it's not from the peer, it's mine
    if (peer != null) return senderId !== peer;
    return false;
  };

  async function loadConversations() {
    const convos = await fetchConversations();
    setConversations(Array.isArray(convos) ? convos : []);
  }

  async function loadMessages(userId: number) {
    const token = authStorage.getToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/api/chat/messages/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const list: Message[] = Array.isArray(data?.messages)
        ? data.messages.map(normalizeMsg)
        : [];

      // de-dupe
      const seen = new Set<number>();
      const unique = list.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      setMessages(unique);

      // mark read on server
      await fetch(`${API_BASE}/api/chat/read/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      window.dispatchEvent(new CustomEvent("chat:unread-changed"));

      // optimistic unread clear
      setConversations((prev) =>
        prev.map((c) => (c.userId === userId ? { ...c, unread: 0 } : c))
      );

      await loadConversations();
    }
  }

  async function sendMessage() {
    if (!activeUser || (!input && !fileInputRef.current?.files?.length)) return;
    const token = authStorage.getToken();
    if (!token) return;

    const form = new FormData();
    form.append("receiverId", String(activeUser.userId));
    form.append("text", input || "");
    if (fileInputRef.current?.files?.[0]) {
      form.append("file", fileInputRef.current.files[0]);
    }

    const res = await fetch(`${API_BASE}/api/chat/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (res.ok) {
      setInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMessages(activeUser.userId);
      await loadConversations();
    }
  }

  // search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const token = authStorage.getToken(); if (!token) return;
    const timer = setTimeout(async () => {
      const res = await fetch(
        `${API_BASE}/api/chat/search?query=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // listen to incoming events from Navbar
  useEffect(() => {
    const onIncoming = async (e: any) => {
      const raw = e.detail;
      if (!raw) { await loadConversations(); return; }
      const msg = normalizeMsg(raw);
      const openId = activeUserIdRef.current;

      if (openId && (msg.senderId === openId || msg.receiverId === openId)) {
        await loadMessages(openId);
        setConversations(prev =>
          prev.map(c => (c.userId === openId ? { ...c, unread: 0 } : c))
        );
      } else {
        await loadConversations();
      }
    };

    window.addEventListener("chat:incoming", onIncoming);
    return () => window.removeEventListener("chat:incoming", onIncoming);
  }, []);

  // initial convos
  useEffect(() => { loadConversations(); }, []);

  // auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-3 border-b">
          <input
            type="text"
            placeholder="Search users or companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0
            ? searchResults.map((u) => {
                const recruiter = isRecruiterItem(u);
                const uid = u.userId ?? u.UserId ?? null;
                const companyName =
                  u.companyName ?? u.CompanyName ?? u.name ?? u.Name ?? "";
                const fullName = u.fullName ?? u.FullName ?? "";
                const title = recruiter ? companyName || "Company" : fullName || "User";
                const logo = recruiter ? toAbs(u.logoUrl ?? u.LogoUrl) : "/default-avatar.jpg";
                const key = `${recruiter ? "recruiter" : "seeker"}-${uid ?? Math.random()}`;

                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (!uid) return;
                      setActiveUser({
                        userId: uid,
                        fullName: recruiter ? undefined : fullName,
                        companyName: recruiter ? companyName : undefined,
                        logoUrl: logo,
                        unread: 0,
                        lastMessage: "",
                      });
                      setSearch("");
                      setSearchResults([]);
                      loadMessages(uid);
                    }}
                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  >
                    <img
                      src={logo}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{title}</span>
                      <span className="text-xs text-gray-500">
                        {recruiter ? "Recruiter" : "Job Seeker"}
                      </span>
                    </div>
                  </div>
                );
              })
            : conversations.map((c) => {
                const recruiter = !!c.companyName && c.companyName.trim().length > 0;
                const title = recruiter ? c.companyName! : c.fullName || "User";
                const logo = recruiter ? toAbs(c.logoUrl) : "/default-avatar.jpg";

                return (
                  <div
                    key={c.userId}
                    onClick={() => {
                      setActiveUser(c);
                      setConversations((prev) =>
                        prev.map((x) => (x.userId === c.userId ? { ...x, unread: 0 } : x))
                      );
                      loadMessages(c.userId);
                    }}
                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${activeUser?.userId === c.userId ? "bg-gray-100" : ""}`}
                  >
                    <img
                      src={logo}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{title}</div>
                      {!recruiter && c.lastMessage && (
                        <div className="text-sm text-gray-500 truncate">{c.lastMessage}</div>
                      )}
                    </div>
                    {c.unread > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-2">{c.unread}</span>
                    )}
                  </div>
                );
              })}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex flex-col">
        {activeUser ? (
          <>
            <div className="p-3 border-b flex items-center gap-3">
              {(() => {
                const recruiter = !!activeUser?.companyName;
                const logo = recruiter ? toAbs(activeUser?.logoUrl) : "/default-avatar.jpg";
                const title = recruiter ? activeUser?.companyName : activeUser?.fullName || "Conversation";
                return (
                  <>
                    <img
                      src={logo}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-semibold">{title}</div>
                      {!recruiter && activeUser?.companyName && (
                        <div className="text-xs text-gray-500">{activeUser.companyName}</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
              {messages.map((m) => {
                const mine = isMine(m.senderId);
                return (
                  <div key={m.id} className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={[
                        "max-w-[75%] px-3 py-2 shadow",
                        "rounded-2xl",
                        mine
                          ? "bg-green-200 text-black rounded-br-md ml-8"
                          : "bg-gray-100 text-black rounded-bl-md mr-8 border border-gray-200",
                      ].join(" ")}
                    >
                      {m.text && <div className="whitespace-pre-wrap break-words leading-snug">{m.text}</div>}
                      {m.fileUrl && (
                        <a
                          href={`${API_BASE}${m.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-sm block mt-0.5"
                        >
                          📎 File
                        </a>
                      )}
                      <div className="text-[11px] mt-1 text-right text-gray-600">
                        {fmtDateIST(m.sentAtUtc)} {fmtTimeIST(m.sentAtUtc)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 border rounded px-2"
              />
              <input ref={fileInputRef} type="file" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-3 border rounded">📎</button>
              <button onClick={sendMessage} className="px-3 bg-blue-500 text-white rounded">Send</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
