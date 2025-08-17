// src/components/ResumeChat.tsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "../lib/api";

type MsgRole = "user" | "assistant";
type ChatMessage = {
  id: string;
  role: MsgRole;
  text: string;
  mode?: string;
  time: string;
};

const MODES = [
  { key: "", label: "Auto" },
  { key: "LearningPath", label: "Learning path" },
  { key: "SkillGap", label: "Skill gap" },
  { key: "ResumeSummaryGenerator", label: "Resume summary" },
  { key: "JobDescriptionAnalyzer", label: "JD analyzer" },
  { key: "InterviewPrep", label: "Interview prep" },
  { key: "CompanyTailoring", label: "Company tailoring" },
  { key: "CareerAdvisor", label: "Career advisor" },
];

export default function ResumeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<string>(""); // "" = auto
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/resume/chat/history");
        const data =
          (res.data?.chats as Array<{
            Question: string;
            Answer: string;
            Mode?: string;
            CreatedAt?: string;
            timeAgo?: string;
          }>) || [];
        const mapped: ChatMessage[] = [];
        data.forEach((c, idx) => {
          const uid = crypto.randomUUID?.() || `${Date.now()}_${idx}`;
          const aid = crypto.randomUUID?.() || `${Date.now()}_${idx}_a`;
          const t = (c as any).CreatedAt || (c as any).timeAgo || new Date().toISOString();
          mapped.push({ id: uid, role: "user", text: c.Question, mode: c.Mode, time: t });
          mapped.push({ id: aid, role: "assistant", text: stripHtml(c.Answer || ""), mode: c.Mode, time: t });
        });
        setMessages(mapped);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      role: "user",
      text: q,
      mode: mode || undefined,
      time: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await api.post("/api/resume/chat", { Question: q, Mode: mode || undefined });
      const answerHtml = (res.data?.shortAnswer as string) || res.data?.answer || res.data?.content || "";
      const answer = stripHtml(answerHtml);
      const botMsg: ChatMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}_a`,
        role: "assistant",
        text: answer || "(No answer)",
        mode: mode || detectModeFromServerMessage(res?.data?.message) || undefined,
        time: new Date().toISOString(),
      };
      setMessages((m) => [...m, botMsg]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || "Failed to get response";
      toast.error(String(msg));
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID?.() || `${Date.now()}_e`, role: "assistant", text: `⚠️ ${msg}`, time: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = async () => {
    const ok = confirm("Clear chat history for this account?");
    if (!ok) return;

    try {
      await api.delete("/api/resume/chat/deletehistory"); // <-- your chosen route
      toast.success("History cleared.");
    } catch {
      toast.info("Server history endpoint not found. Cleared locally only.");
    } finally {
      setMessages([]);
    }
  };

  return (
    // FORCE LIGHT MODE INSIDE THIS PANEL
    <div className="w-full h-full flex flex-col rounded-2xl border border-neutral-200 bg-white text-neutral-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-100 grid place-items-center">🤖</div>
          <div>
            <div className="text-sm font-semibold">Resume chatbot</div>
            <div className="text-xs text-neutral-600">Ask about your resume, interviews, skills & tailoring</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTools((s) => !s)}
              className="px-3 py-1.5 text-sm rounded-full border border-neutral-300 hover:bg-neutral-50"
            >
              {mode ? MODES.find((m) => m.key === mode)?.label : "Auto"} ▾
            </button>
            {showTools && (
              <div className="absolute right-0 mt-2 w-44 bg-white text-neutral-900 border border-neutral-200 rounded-xl shadow-lg z-20">
                {MODES.map((m) => (
                  <button
                    key={m.key || "auto"}
                    onClick={() => {
                      setMode(m.key);
                      setShowTools(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 ${mode === m.key ? "font-semibold" : ""}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={clearChat}
            className="px-3 py-1.5 text-sm rounded-full border border-neutral-300 hover:bg-neutral-50"
            title="Clear conversation"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center text-sm text-neutral-600 mt-8">
            Start the conversation. Try: “Summarize my top 3 strengths” or “Tailor my resume for SDE-1 at TCS”.
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}

        {loading && <TypingBubble />}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-neutral-200">
        <div className="flex items-end gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your resume, interviews, improvements…"
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const base = "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words leading-6";
  const bubbleClasses = isUser ? "bg-blue-600 text-white self-end" : "bg-neutral-100 text-neutral-900 self-start";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${base} ${bubbleClasses}`}>
        {msg.mode && <div className={`text-[10px] mb-1 ${isUser ? "text-white/80" : "text-neutral-500"}`}>{labelFromMode(msg.mode)}</div>}
        <div>{msg.text}</div>
        <div className={`mt-1 text-[10px] ${isUser ? "text-white/70" : "text-neutral-500"}`}>
          {new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm bg-neutral-100 text-neutral-700">
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse"></span>
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:120ms]"></span>
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse [animation-delay:240ms]"></span>
        </div>
      </div>
    </div>
  );
}

/* helpers */
function stripHtml(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}
function detectModeFromServerMessage(msg?: string) {
  if (!msg) return "";
  const lower = msg.toLowerCase();
  if (lower.includes("learning")) return "LearningPath";
  if (lower.includes("gap")) return "SkillGap";
  if (lower.includes("summary")) return "ResumeSummaryGenerator";
  if (lower.includes("job")) return "JobDescriptionAnalyzer";
  if (lower.includes("interview")) return "InterviewPrep";
  if (lower.includes("company")) return "CompanyTailoring";
  if (lower.includes("career")) return "CareerAdvisor";
  return "";
}
function labelFromMode(m?: string) {
  const f = MODES.find((x) => x.key === m);
  return f?.label || "Auto";
}
