// src/pages/Messages.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../lib/api";

type Conversation = {
  userId: number;
  lastMessage?: string | null;
  lastTimestamp?: string | null;
  unread: number;
  role: string;
  fullName?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
};

type Message = {
  messageId: number;
  senderId: number;
  receiverId: number;
  messageText: string | null;
  fileUrl: string | null;
  fileType: string | null;
  isRead: boolean;
  sentAt: string; // ISO
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";
const DEFAULT_AVATAR = "/default-avatar.jpg";

const fmtIST = (s?: string | null) =>
  !s
    ? ""
    : new Date(s).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

function buildImageUrl(raw?: string | null) {
  if (!raw) return DEFAULT_AVATAR;
  if (raw.startsWith("http")) return raw;
  return `${API_BASE}${raw}`;
}
function resolveAvatar(c?: Conversation | null) {
  if (!c) return DEFAULT_AVATAR;
  return c.role === "Recruiter" ? buildImageUrl(c.logoUrl) : DEFAULT_AVATAR;
}

// normalize API casing (MessageId -> messageId, etc.)
function normalizeMessages(list: any[]): Message[] {
  return (list || []).map((m) => ({
    messageId: m.MessageId ?? m.messageId,
    senderId: m.SenderId ?? m.senderId,
    receiverId: m.ReceiverId ?? m.receiverId,
    messageText: m.MessageText ?? m.messageText ?? null,
    fileUrl: m.FileUrl ?? m.fileUrl ?? null,
    fileType: m.FileType ?? m.fileType ?? null,
    isRead: m.IsRead ?? m.isRead ?? false,
    sentAt: (m.SentAt ?? m.sentAt) as string,
  }));
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeUser, setActiveUser] = useState<number | null>(null);

  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [sending, setSending] = useState(false);

  // mobile sidebar
  const [showList, setShowList] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesBoxRef = useRef<HTMLDivElement | null>(null);
  const lastMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jobsetu_user");
      if (saved) setUserRole(JSON.parse(saved)?.role || null);
    } catch {}
  }, []);

  // loaders
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/api/message/conversations");
      setConversations(data.conversations || []);
    } catch {
      setConversations([]);
    }
  }, []);

  const loadMessages = useCallback(async (userId: number) => {
    try {
      const { data } = await api.get(`/api/message/chat/${userId}`);
      setMessages(normalizeMessages(data.messages || []));
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // on conversation change
  useEffect(() => {
    if (!activeUser) return;
    (async () => {
      await loadMessages(activeUser);
      try {
        await api.post(`/api/message/read-all/${activeUser}`);
        await loadConversations();
      } catch {}
    })();
  }, [activeUser, loadMessages, loadConversations]);

  // search (server-side)
  async function handleSearch(value: string) {
    setQ(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await api.get(
        `/api/message/search?q=${encodeURIComponent(value)}`
      );
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    }
  }

  const listToShow = useMemo(
    () => (q.trim() ? searchResults : conversations),
    [q, searchResults, conversations]
  );

  // send message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUser) return;
    const textToSend = text.trim();
    if (!textToSend) return;

    // optimistic message
    const tempId = Date.now();
    const optimistic: Message = {
      messageId: tempId,
      senderId: -1, // self
      receiverId: activeUser,
      messageText: textToSend,
      fileUrl: null,
      fileType: null,
      isRead: true,
      sentAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    setSending(true);

    try {
      await api.post("/api/message/send", null, {
        params: { receiverId: activeUser, messageText: textToSend },
      });
      await loadMessages(activeUser);
      await loadConversations();
    } catch {
      setMessages((m) => m.filter((x) => x.messageId !== tempId));
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  // mark read / unread / delete
  async function markRead() {
    if (!activeUser) return;
    try {
      await api.post(`/api/message/read-all/${activeUser}`);
      await loadConversations();
      await loadMessages(activeUser);
    } catch {}
  }
  async function markUnread() {
    if (!activeUser) return;
    try {
      await api.post(`/api/message/unread-all/${activeUser}`);
      await loadConversations();
      await loadMessages(activeUser);
    } catch {}
  }
  async function deleteConversation() {
    if (!activeUser) return;
    if (!confirm("Delete this conversation for you?")) return;
    try {
      await api.delete(`/api/message/delete-all/${activeUser}`);
      setMessages([]);
      await loadConversations();
      const stillThere = conversations.some((c) => c.userId === activeUser);
      if (!stillThere) setActiveUser(null);
    } catch {}
  }

  // SignalR live
  useEffect(() => {
    // @ts-ignore
    const $: any = (window as any).$;
    if (!$ || !$.connection || !$.connection.chatHub) return;

    const hub = $.connection.chatHub;
    hub.client = hub.client || {};

    hub.client.receiveMessage = (msg: any) => {
      loadConversations();
      if (
        activeUser &&
        (msg.SenderId === activeUser || msg.ReceiverId === activeUser)
      ) {
        loadMessages(activeUser);
      }
    };
    hub.client.updateUnread = () => loadConversations();
    hub.client.read = () => loadConversations();
    hub.client.UserTyping = (username: string, isTyping: boolean) => {
      setTypingUser(isTyping ? username : null);
    };

    return () => {
      if (!hub.client) return;
      hub.client.receiveMessage = null;
      hub.client.updateUnread = null;
      hub.client.read = null;
      hub.client.UserTyping = null;
    };
  }, [activeUser, loadMessages, loadConversations]);

  // typing indicator
  function notifyTyping() {
    // @ts-ignore
    const $: any = (window as any).$;
    if (!activeUser || !($ && $.connection && $.connection.chatHub)) return;
    try {
      $.connection.chatHub.server.startTyping(activeUser);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        try {
          $.connection.chatHub.server.stopTyping(activeUser);
        } catch {}
      }, 1500);
    } catch {}
  }

  const activeMeta =
    listToShow.find((c) => c.userId === activeUser) ||
    conversations.find((c) => c.userId === activeUser) ||
    null;

  // auto scroll
  useEffect(() => {
    const el = messagesBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastMessageRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // enter to send
  function onComposerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && text.trim()) {
        // trigger form submit
        (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl h-[80vh] min-h-0 border rounded-lg bg-white shadow-sm overflow-hidden">
      {/* Responsive grid: list becomes overlay on small screens */}
      <div className="grid grid-cols-1 md:grid-cols-3 h-full">
        {/* LEFT: Conversation list */}
        <aside
          className={`relative bg-gray-50 border-r md:static md:translate-x-0 transition-transform duration-200 min-h-0 ${
            showList ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* mobile close bar */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b bg-white">
            <h2 className="font-semibold">Conversations</h2>
            <button
              className="text-sm px-2 py-1 border rounded"
              onClick={() => setShowList(false)}
            >
              Close
            </button>
          </div>

          <div className="hidden md:block border-b px-3 py-2">
            <h2 className="font-semibold">Conversations</h2>
          </div>

          {/* search */}
          <div className="p-3 border-b bg-gray-50">
            <input
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={
                userRole === "Recruiter"
                  ? "Search job seekers by name…"
                  : "Search by name or company…"
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* list */}
          <ul className="divide-y overflow-y-auto h-[calc(100%-112px)] md:h-[calc(100%-96px)]">
            {listToShow.length === 0 ? (
              <li className="p-4 text-sm text-gray-500">No conversations yet.</li>
            ) : (
              listToShow.map((c) => (
                <li
                  key={c.userId}
                  onClick={() => {
                    setActiveUser(c.userId);
                    setShowList(false);
                  }}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 ${
                    activeUser === c.userId ? "bg-gray-200" : ""
                  }`}
                >
                  <img
                    src={resolveAvatar(c)}
                    alt="avatar"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                    className="w-10 h-10 rounded-full border object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {c.role === "Recruiter"
                        ? c.companyName || `Recruiter ${c.userId}`
                        : c.fullName || `User ${c.userId}`}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {c.lastMessage || ""}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {fmtIST(c.lastTimestamp)}
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <span className="ml-auto text-xs bg-blue-600 text-white px-2 rounded-full">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* RIGHT: Chat */}
        <section className="col-span-2 flex flex-col min-h-0">
          {activeUser ? (
            <>
              {/* sticky chat header */}
              <div className="sticky top-0 z-10 border-b px-3 py-2 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {/* mobile open list */}
                  <button
                    className="md:hidden px-2 py-1 border rounded"
                    onClick={() => setShowList(true)}
                  >
                    Menu
                  </button>

                  <img
                    src={resolveAvatar(activeMeta)}
                    alt="avatar"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                    className="w-9 h-9 rounded-full border object-cover"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {activeMeta?.role === "Recruiter"
                        ? activeMeta?.companyName || `Recruiter ${activeUser}`
                        : activeMeta?.fullName || `User ${activeUser}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {typingUser ? `${typingUser} is typing…` : "Chat"}
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={markRead}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    Mark read
                  </button>
                  <button
                    onClick={markUnread}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    Mark unread
                  </button>
                  <button
                    onClick={deleteConversation}
                    className="px-3 py-1 text-sm border rounded text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* messages */}
              <div
                ref={messagesBoxRef}
                className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-[rgb(248,249,251)]"
              >
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const mine = m.senderId !== activeUser; // self on right
                  const timeIST = fmtIST(m.sentAt);

                  return (
                    <div
                      key={m.messageId || i}
                      ref={isLast ? lastMessageRef : undefined}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm max-w-[82%] sm:max-w-[75%] md:max-w-[70%] break-words ${
                          mine
                            ? "bg-blue-600 text-white text-right"
                            : "bg-gray-200 text-gray-900 text-left"
                        }`}
                      >
                        {m.messageText && <div>{m.messageText}</div>}

                        {m.fileUrl && (
                          <div className="mt-1">
                            <a
                              href={m.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`underline text-xs ${
                                mine ? "text-white/90" : "text-blue-700"
                              }`}
                            >
                              {m.fileType || "File"}
                            </a>
                          </div>
                        )}

                        <div
                          className={`text-[10px] mt-1 ${
                            mine ? "opacity-80" : "text-gray-600"
                          }`}
                        >
                          {timeIST}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* composer (sticky bottom) */}
              <form
                onSubmit={handleSend}
                className="sticky bottom-0 z-10 border-t bg-white px-3 py-2 flex gap-2 items-end"
              >
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    notifyTyping();
                  }}
                  onKeyDown={onComposerKeyDown}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  placeholder="Type a message…"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className={`px-4 h-10 rounded text-white text-sm ${
                    sending || !text.trim()
                      ? "bg-blue-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  aria-disabled={sending || !text.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-gray-500 p-6">
              <div className="text-center space-y-3">
                <button
                  className="md:hidden px-3 py-2 border rounded"
                  onClick={() => setShowList(true)}
                >
                  Open conversations
                </button>
                <div className="hidden md:block">Select a conversation to start chatting</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
