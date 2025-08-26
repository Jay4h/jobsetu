// src/pages/Profile.tsx
import { useEffect, useMemo, useState, type FormEvent } from "react";
import api, { getRoleFromToken } from "../lib/api";
import { Link } from "react-router-dom";
import ResumeChat from "../components/ResumeChat";

/* ---------------- Types ---------------- */
type Role = "JobSeeker" | "Recruiter";
type DesignTip = string | { section?: string; advice?: string; priority?: string };

type DesignTipsState = {
  tips: DesignTip[];
  lengthStructure?: string | null;
  atsOptimization?: string | null;
};
type SeekerProfile = {
  fullName?: string;
  email?: string;
  bio?: string;
  location?: string;
  education?: string;
  experienceYears?: number;
  skills?: string; // comma string
  resumeFile?: string | null;
  resumeVisibility?: boolean;
  publicProfileSlug?: string | null;
  createdAt?: string;
  // Optional stats
  resumeScore?: number | null;
  fitScore?: number | null;
};
/* ---------- GDPR types ---------- */
type JsConsentItem = {
  consentId: number;
  userId: number;
  isAccepted: boolean;
  consentDate: string;
  consentType?: string;
  version?: string;
  ipAddress?: string;
  userAgent?: string;
  isCurrent?: boolean;
};

type JsConsentResp = {
  total: number;
  current?: JsConsentItem | null;
  items: JsConsentItem[];
};
/* -------------------------------- */

/* date formatter that supports ISO and /Date(…)/ */
function fmtConsentDate(dt?: string) {
  if (!dt) return "—";
  const s = String(dt);
  const m = s.match(/\/Date\((\d+)\)\//);
  const d = m ? new Date(Number(m[1])) : new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

type RecruiterProfile = {
  name?: string;
  website?: string | null;
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  isApproved?: boolean;
  isVerified?: boolean;
  slug?: string | null;
  createdAt?: string;
};

type PostedJob = { title?: string; jobId?: number };

type Summary = {
  views: { viewCount: number; lastViewedBy: string | null };
  saved: { total: number; recent: { createdAt: string; title: string; jobId: number }[] };
  applied: { total: number; recent: { appliedOn: string; title: string; jobId: number; currentStatus?: string }[] };
  ai?: { lastResumeFitScore?: number | null };
};

/* ---------------- Helpers ---------------- */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\- ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/.test(s); // 3–32 chars, no edge hyphens
}
function buildPublicProfileUrl(slug: string): string {
  return `https://localhost:44380/api/user/public/${encodeURIComponent(slug)}`;
}
function getFilenameFromDisposition(cd?: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=(?:UTF-8''|)([^;]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/(^"|"$)/g, ""));
    } catch {
      return star[1].replace(/(^"|"$)/g, "");
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain?.[1] ?? null;
}

/* ---------------- Page ---------------- */
export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);

  // NEW: four tabs (assistant separated)
  const [tab, setTab] = useState<"overview" | "edit" | "ai-tools" | "assistant">("overview");

  const [copied, setCopied] = useState(false);

  const [seeker, setSeeker] = useState<SeekerProfile | null>(null);
  const [recruiter, setRecruiter] = useState<RecruiterProfile | null>(null);

  // seeker stats/activity
  const [summary, setSummary] = useState<Summary | null>(null);

  // recruiter activity
  const [postedJobs, setPostedJobs] = useState<PostedJob[]>([]);
  const [jobsPostedCount, setJobsPostedCount] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);

  // resume scoring state
  const [scoring, setScoring] = useState(false);

  // ===== AI Tools states =====
  // Fit score
  const [fitGenerating, setFitGenerating] = useState(false);
  const [fitJobId, setFitJobId] = useState<number | "">("");
  const [fitResult, setFitResult] = useState<{ score?: number; breakdown?: Record<string, number>; explanation?: string } | null>(null);

  // Suggestions (selection list reused by gap analysis)
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

  // Parse
  const [parseLoading, setParseLoading] = useState(false);
  const [parsed, setParsed] = useState<{ emails?: string[]; phones?: string[]; skills?: string[] } | null>(null);

  // Design tips
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tips, setTips] = useState<DesignTipsState | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);

  // Breakdown from /api/resume/score (fallbacks if backend doesn’t send them)
  const [scoreBreakdown, setScoreBreakdown] = useState<{
    matchedSkills?: string[];
    matchedKeywords?: string[];
    wordCount?: number;
  }>({});
  const [jsConsents, setJsConsents] = useState<JsConsentResp | null>(null);
  const [jsConsentsErr, setJsConsentsErr] = useState<string | null>(null);
  const [jsConsentsLoading, setJsConsentsLoading] = useState<boolean>(false);
  // ---------- Skill Gap Analysis (merged) ----------
  const [gapJobId, setGapJobId] = useState<number | "">("");
  const [gapLoading, setGapLoading] = useState(false);
  const [gapData, setGapData] = useState<{
    fitScore?: number;
    matchedSkills?: string[];
    matchedKeywords?: string[];
    totalCriteria?: number;
    matchedCount?: number;
    gaps?: string[];
    suggestions?: string[];
  }>({});
  // Fetch GDPR consents for JobSeeker
  useEffect(() => {
    if (role !== "JobSeeker") return;

    setJsConsentsLoading(true);
    api
      .get("/api/user/consents", { suppressUnauthorized: true })
      .then((r) => {
        const raw = r.data || {};
        // map PascalCase → camelCase
        const items: JsConsentItem[] = (raw.items || []).map((x: any) => ({
          consentId: x.ConsentId,
          userId: x.UserId,
          isAccepted: !!x.IsAccepted,
          consentDate: x.ConsentDate,
          consentType: x.ConsentType,
          version: x.Version,
          ipAddress: x.IpAddress,
          userAgent: x.UserAgent,
          isCurrent: !!x.IsCurrent,
        }));
        const c = raw.current
          ? ({
            consentId: raw.current.ConsentId,
            userId: raw.current.UserId,
            isAccepted: !!raw.current.IsAccepted,
            consentDate: raw.current.ConsentDate,
            consentType: raw.current.ConsentType,
            version: raw.current.Version,
            ipAddress: raw.current.IpAddress,
            userAgent: raw.current.UserAgent,
            isCurrent: !!raw.current.IsCurrent,
          } as JsConsentItem)
          : null;

        setJsConsents({
          total: typeof raw.total === "number" ? raw.total : items.length,
          current: c,
          items,
        });
      })
      .catch((e) => setJsConsentsErr(e?.message || "Failed to load consents"))
      .finally(() => setJsConsentsLoading(false));
  }, [role]);

  // -------- Project Rewriter + Video Resume Script --------
  const [projectText, setProjectText] = useState("");
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteOutput, setRewriteOutput] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoOutput, setVideoOutput] = useState<string | null>(null);

  // --- Multilingual Resume Help ---
  const [chatLang, setChatLang] = useState<"en" | "hi" | "gu">("en");
  const [mlQuestion, setMlQuestion] = useState("");
  const [mlLoading, setMlLoading] = useState(false);
  const [mlAnswer, setMlAnswer] = useState<string | null>(null);

  // --- Mock Interview ---
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [interviewQs, setInterviewQs] = useState<string[] | null>(null);
  // AI Mode constants
  const AI_MODES = {
    MOCK_INTERVIEW: "MockInterview",
    PROJECT_REWRITER: "ProjectRewriter",
    VIDEO_SCRIPT: "VideoScript",
    RESUME_ASSISTANT: "ResumeAssistant",
  };
  const handleLangChange = (lang: "en" | "hi" | "gu") => {
    setChatLang(lang);
    localStorage.setItem("chatLang", lang);
  };

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const fromToken = getRoleFromToken();

        if (fromToken === "JobSeeker") {
          setRole("JobSeeker");
          await loadSeekerAll();
        } else if (fromToken === "Recruiter") {
          setRole("Recruiter");
          await loadRecruiterAll();
        } else {
          // fallback probe without triggering global 401 handler
          try {
            await api.get("/api/user/profile", { meta: { ignoreGlobal401: true } as any });
            if (!mounted) return;
            setRole("JobSeeker");
            await loadSeekerAll();
          } catch {
            try {
              await api.get("/api/recruiter/profile", { meta: { ignoreGlobal401: true } as any });
              if (!mounted) return;
              setRole("Recruiter");
              await loadRecruiterAll();
            } catch {
              setRole(null);
            }
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    async function loadSeekerAll() {
      await Promise.all([loadSeekerProfile(), loadSeekerSummaryWithFallback()]);
    }

    async function loadRecruiterAll() {
      await Promise.all([loadRecruiterProfile(), loadRecruiterActivity()]);
    }

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- merged gap analysis ---------- */
  async function runSkillGap() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    if (!gapJobId || Number.isNaN(Number(gapJobId))) {
      alert("Enter a valid Job ID.");
      return;
    }
    setGapLoading(true);
    try {
      // 1) Tailoring via /fit-score (gives matched + all job criteria)
      const { data: fit } = await api.post("/api/resume/fit-score", { jobId: Number(gapJobId) });

      const matchedSkills = fit?.matchedSkills ?? [];
      const matchedKeywords = fit?.matchedKeywords ?? [];
      const totalCriteria = Number(fit?.totalCriteria ?? 0);
      const matchedCount = Number(fit?.matchedCount ?? matchedSkills.length + matchedKeywords.length);
      const fitScore = Number(fit?.fitScore ?? fit?.score ?? 0);

      // Compute gaps from all job criteria
      const allSkills = uniqLower(fit?.allJobSkills ?? []);
      const allKeywords = uniqLower(fit?.allJobKeywords ?? []);
      const allCriteria = Array.from(new Set([...allSkills, ...allKeywords]));
      const matchedSet = new Set(uniqLower([...matchedSkills, ...matchedKeywords]));
      const gaps = allCriteria.filter((x) => !matchedSet.has(x));

      // 2) Suggestions via /suggestions (keywords to add)
      const { data: sug } = await api.post("/api/resume/suggestions", { jobId: Number(gapJobId) });
      const suggList = extractSuggestions(sug);

      setGapData({
        fitScore,
        matchedSkills,
        matchedKeywords,
        totalCriteria,
        matchedCount,
        gaps,
        suggestions: suggList,
      });

      // hydrate the selectable suggestions list (reuses existing handlers)
      setSuggestions(suggList.length ? suggList : ["No suggestions returned"]);
      setSelectedSuggestions([]);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to run skill gap analysis");
    } finally {
      setGapLoading(false);
    }
  }

  /* ---------- loads ---------- */
  async function loadSeekerProfile() {
    const { data } = await api.get("/api/user/profile");
    const p: SeekerProfile = {
      fullName: data?.fullName ?? data?.FullName,
      email: data?.email ?? data?.Email,
      bio: data?.profile?.Bio ?? data?.bio ?? data?.Bio,
      location: data?.profile?.Location ?? data?.location ?? data?.Location,
      education: data?.profile?.Education ?? data?.education ?? data?.Education,
      experienceYears: data?.profile?.ExperienceYears ?? data?.experienceYears ?? data?.ExperienceYears,
      skills:
        Array.isArray(data?.profile?.skills)
          ? data.profile.skills.join(", ")
          : data?.profile?.Skills ?? data?.skills ?? data?.Skills,
      resumeFile: data?.profile?.resumeFile ?? data?.resumeFile ?? data?.ResumeFile,
      resumeVisibility: (data?.profile?.ResumeVisibility ?? data?.resumeVisibility ?? data?.ResumeVisibility) ?? true,
      publicProfileSlug: data?.profile?.PublicProfileSlug ?? data?.publicProfileSlug ?? data?.PublicProfileSlug,
      createdAt: data?.createdAt ?? data?.CreatedAt,
      resumeScore: data?.resumeScore ?? data?.ResumeScore ?? null,
      fitScore: data?.fitScore ?? data?.FitScore ?? null,
    };
    setSeeker(p);
  }
  function extractDesignTips(data: any): DesignTipsState {
    const tips: DesignTip[] =
      (Array.isArray(data?.designTips) && data.designTips) ||
      (Array.isArray(data?.tips) && data.tips) ||
      (Array.isArray(data?.Tips) && data.Tips) ||
      [];
    return {
      tips,
      lengthStructure: data?.lengthStructure ?? data?.LengthStructure ?? null,
      atsOptimization: data?.atsOptimization ?? data?.AtsOptimization ?? null,
    };
  }

  // Also normalize the trailing "viewed on DD-MM-YYYY HH:mm:ss" to IST (browser-safe).
  async function loadSeekerSummaryWithFallback() {
    const [summaryRes, viewsRes] = await Promise.allSettled([
      api.get<Summary>("/api/user/profile/summary", { meta: { ignoreGlobal401: true } as any }),
      api.get("/api/user/resume/views", { meta: { ignoreGlobal401: true } as any }),
    ]);

    // start with defaults
    let views = { viewCount: 0, lastViewedBy: null as string | null };
    let saved = { total: 0, recent: [] as { createdAt: string; title: string; jobId: number }[] };
    let applied = { total: 0, recent: [] as { appliedOn: string; title: string; jobId: number; currentStatus?: string }[] };
    let ai: { lastResumeFitScore?: number | null } = { lastResumeFitScore: undefined };

    // Convert "... viewed on DD/MM/YYYY HH:mm:ss" (or DD-MM-YYYY) which is in IST
    // to the viewer's local timezone and format as "DD/MM/YYYY HH:mm:ss".
    function normalizeViewedOn(str?: string | null) {
      if (!str) return null;

      // Accept both slashes and hyphens, and optional comma between date/time.
      const m = str.match(/^(.*viewed on )(\d{2})[\/-](\d{2})[\/-](\d{4})[ ,]*(\d{2}):(\d{2}):(\d{2})$/);
      if (!m) return str; // leave unknown formats alone

      const [, prefix, dd, mm, yyyy, HH, MM, SS] = m;

      // The server time is IST (UTC+05:30). Convert that IST timestamp -> UTC.
      const IST_OFFSET_MIN = 330; // 5h 30m
      const utcMs = Date.UTC(+yyyy, +mm - 1, +dd, +HH, +MM, +SS) - IST_OFFSET_MIN * 60 * 1000;

      // Format in the user's local timezone (browser default).
      const formatted = new Intl.DateTimeFormat("en-IN", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .format(new Date(utcMs))
        .replace(",", ""); // "DD/MM/YYYY, HH:mm:ss" -> "DD/MM/YYYY HH:mm:ss"

      return `${prefix}${formatted}`;
    }

    // take what summary has first
    if (summaryRes.status === "fulfilled") {
      const data = summaryRes.value.data;
      views = data?.views ?? views;
      saved = data?.saved ?? saved;
      applied = data?.applied ?? applied;
      ai = data?.ai ?? ai;
    }

    // prefer /resume/views for freshest counts + localizable timestamp
    if (viewsRes.status === "fulfilled") {
      const d: any = viewsRes.value.data;
      views = {
        viewCount: Number(d?.viewCount ?? views.viewCount ?? 0),
        lastViewedBy: normalizeViewedOn(d?.lastViewedBy) ?? views.lastViewedBy ?? null,
      };
    }

    setSummary({ views, saved, applied, ai });
  }



  async function loadRecruiterProfile() {
    const { data } = await api.get("/api/recruiter/profile");
    const p: RecruiterProfile = {
      name: data?.name ?? data?.Name,
      website: data?.website ?? data?.Website,
      industry: data?.industry ?? data?.Industry,
      type: data?.type ?? data?.Type,
      description: data?.description ?? data?.Description,
      logoUrl: data?.logoUrl ?? data?.LogoUrl,
      isApproved: data?.isApproved ?? data?.IsApproved,
      isVerified: data?.isVerified ?? data?.IsVerified,
      slug: data?.slug ?? data?.Slug,
      createdAt: data?.createdAt ?? data?.CreatedAt,
    };
    setRecruiter(p);
  }

  async function loadRecruiterActivity() {
    try {
      const { data } = await api.get("/api/recruiter/analytics", { meta: { ignoreGlobal401: true } as any });
      if (data?.jobsPostedCount != null) setJobsPostedCount(Number(data.jobsPostedCount));
    } catch { }

    try {
      const { data } = await api.get("/api/recruiter/jobs", { meta: { ignoreGlobal401: true } as any });
      const list: any[] = Array.isArray(data) ? data : data?.results ?? [];
      setPostedJobs(list.slice(0, 5).map((x) => ({ title: x?.Title ?? x?.title, jobId: x?.JobId ?? x?.jobId })));
      if (jobsPostedCount == null) setJobsPostedCount(list.length);
    } catch { }
  }

  /* ---------- computed ---------- */
  const seekerSkillTags = useMemo(() => {
    if (!seeker?.skills) return [];
    // split, trim, drop empties
    const raw = String(seeker.skills).split(",").map(s => s.trim()).filter(Boolean);
    // case-insensitive dedupe, but keep original display text of first occurrence
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of raw) {
      const k = s.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(s);
      }
    }
    return unique;
  }, [seeker?.skills]);

  const memberSince = (seeker?.createdAt ?? recruiter?.createdAt) || null;

  /* ---------- helpers: submit seeker as multipart ---------- */
  function buildSeekerForm(s: SeekerProfile) {
    const fd = new FormData();
    fd.append("bio", s.bio ?? "");
    fd.append("location", s.location ?? "");
    fd.append("education", s.education ?? "");
    fd.append("skills", s.skills ?? "");
    fd.append("experienceYears", String(s.experienceYears ?? 0));
    fd.append("resumeVisibility", String(!!s.resumeVisibility));
    if (s.publicProfileSlug) fd.append("publicProfileSlug", s.publicProfileSlug);
    return fd;
  }

  async function putSeekerForm(fd: FormData) {
    await api.put("/api/user/update-profile", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    } as any);
  }

  /* ---------- actions ---------- */
  async function saveSeeker(e: FormEvent) {
    e.preventDefault();
    if (!seeker) return;

    if (seeker.publicProfileSlug && !isValidSlug(seeker.publicProfileSlug)) {
      alert("Please fix the public profile slug (3–32 chars, a–z, 0–9, hyphens; no leading/trailing hyphen).");
      return;
    }

    setSaving(true);
    try {
      const fd = buildSeekerForm(seeker);
      await putSeekerForm(fd);
      setTab("overview");
      await loadSeekerProfile();
    } catch (err: any) {
      alert(err?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function toggleResumeVisibility() {
    if (!seeker) return;
    try {
      const next = !seeker.resumeVisibility;
      const fd = buildSeekerForm({ ...seeker, resumeVisibility: next });
      await putSeekerForm(fd);
      setSeeker({ ...seeker, resumeVisibility: next });
    } catch (err: any) {
      alert(err?.message || "Couldn’t update visibility");
    }
  }

  async function downloadResume() {
    try {
      const res = await api.get("/api/user/resume/download", {
        responseType: "blob",
      } as any);

      const cd: string | undefined =
        res.headers?.["content-disposition"] || res.headers?.["Content-Disposition"];
      const filename = getFilenameFromDisposition(cd ?? null) || "JobSetu_Resume.pdf";

      const blobUrl = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      const msg =
        err?.response?.status === 404
          ? "Resume not found. Upload a resume first."
          : err?.response?.data?.message || err?.message || "Failed to download resume";
      alert(msg);
    }
  }

  async function copyPublicProfileLink(slug?: string | null) {
    if (!slug) return;
    const url = buildPublicProfileUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function generateResumeScore() {
    if (!seeker?.resumeFile) {
      alert("Upload a resume first, then score it.");
      return;
    }
    setScoring(true);
    try {
      const { data } = await api.post("/api/resume/score");

      const newScore = Number(data?.score ?? data?.Score ?? 0);

      // expose breakdown if backend sent it
      setScoreBreakdown({
        matchedSkills: data?.matchedSkills ?? data?.MatchedSkills ?? [],
        matchedKeywords: data?.matchedKeywords ?? data?.MatchedKeywords ?? data?.keywords ?? [],
        wordCount: data?.wordCount ?? data?.WordCount,
      });

      // optimistic UI + also refresh from server (authoritative)
      setSeeker((prev) => (prev ? { ...prev, resumeScore: newScore } : prev));
      await loadSeekerProfile();
    } catch (err: any) {
      console.error("Rescore failed:", err?.response || err); // <-- see DevTools
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to score resume";
      alert(msg);
    } finally {
      setScoring(false); // <-- ensures button re-enables even on error
    }
  }


  /* ---------- AI TOOLS actions ---------- */
  async function generateFitScore() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    if (!fitJobId || Number.isNaN(Number(fitJobId))) {
      alert("Enter a valid Job ID to compute fit score.");
      return;
    }
    setFitGenerating(true);
    try {
      const { data } = await api.post("/api/resume/fit-score", { jobId: Number(fitJobId) });
      const score = Number(data?.score ?? data?.Score ?? data?.fitScore ?? 0);
      setFitResult({
        score,
        breakdown: data?.breakdown ?? data?.Breakdown ?? undefined,
        explanation: data?.explanation ?? data?.Explanation ?? undefined,
      });
      setSeeker((prev) => (prev ? { ...prev, fitScore: score } : prev));
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to get fit score");
    } finally {
      setFitGenerating(false);
    }
  }

  function uniqLower(list: string[] = []) {
    const s = new Set<string>();
    list.forEach((x) => s.add(String(x || "").trim().toLowerCase()));
    return Array.from(s);
  }

  function extractSuggestions(data: any): string[] {
    if (Array.isArray(data?.missingKeywords)) return data.missingKeywords;
    if (Array.isArray(data?.suggestions)) return data.suggestions;
    if (Array.isArray(data)) return data;
    return [];
  }

  function toggleSuggestion(s: string) {
    setSelectedSuggestions((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function addSelectedToSkills() {
    if (!seeker) return;
    if (selectedSuggestions.length === 0) {
      alert("Select at least one suggestion.");
      return;
    }
    // merge into existing skills (comma string)
    const current = (seeker.skills || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    // avoid duplicates (case-insensitive)
    const next = [...current];
    selectedSuggestions.forEach((s) => {
      if (!next.some((x) => x.toLowerCase() === s.toLowerCase())) next.push(s);
    });

    // update via your existing multipart form
    const nextSeeker = { ...seeker, skills: next.join(", ") };
    const fd = buildSeekerForm(nextSeeker);
    try {
      await putSeekerForm(fd);
      setSeeker(nextSeeker);
      alert("Added to profile skills.");
    } catch (err: any) {
      alert(err?.message || "Failed to update skills");
    }
  }

  async function askAIToWriteBullets() {
    if (selectedSuggestions.length === 0) {
      alert("Select at least one suggestion.");
      return;
    }
    try {
      const prompt =
        `Turn these keywords into 5 ATS-friendly resume bullet points with action verbs and metrics where possible: ` +
        selectedSuggestions.join(", ") +
        `. Keep each bullet under 20 words.`;

      const { data } = await api.post("/api/resume/chat", {
        Question: prompt,
        Mode: "ResumeSummaryGenerator",
      });

      const text = (data?.shortAnswer as string)?.replace(/<br\/?>/gi, "\n") || data?.answer || "(No answer)";

      alert(text);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to ask AI");
    }
  }

  async function copySelected() {
    if (selectedSuggestions.length === 0) {
      alert("Select at least one suggestion.");
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedSuggestions.join(", "));
      alert("Copied to clipboard.");
    } catch {
      window.prompt("Copy this:", selectedSuggestions.join(", "));
    }
  }

  async function parseResume() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    setParseLoading(true);
    try {
      const { data } = await api.post("/api/resume/parse");
      setParsed({
        emails: data?.emails ?? data?.Emails ?? [],
        phones: data?.phones ?? data?.Phones ?? [],
        skills: data?.skills ?? data?.Skills ?? [],
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to parse resume");
    } finally {
      setParseLoading(false);
    }
  }

  async function loadDesignTips() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    setTipsLoading(true);
    try {
      const { data } = await api.get("/api/resume/design-tips");
      setTips(extractDesignTips(data));
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to load design tips");
    } finally {
      setTipsLoading(false);
    }
  }
  async function generateAiPdf() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    setPdfLoading(true);
    try {
      const res = await api.get("/api/user/resume/pdf", { responseType: "blob" } as any);
      const filename = `JobSetu_AI_Resume_${(seeker.fullName || "profile").replace(/\s+/g, "_")}.pdf`;

      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      const msg =
        err?.response?.status === 404
          ? "We couldn’t generate the PDF. Make sure your profile is complete."
          : err?.response?.data?.message || err?.message || "Failed to generate AI PDF";
      alert(msg);
    } finally {
      setPdfLoading(false);
    }
  }

  /* ---------- NEW helpers/actions for added features ---------- */
  function languagePreface(lang: "en" | "hi" | "gu") {
    if (lang === "hi") return "Answer in Hindi: ";
    if (lang === "gu") return "Answer in Gujarati: ";
    return "";
  }

  // Mock Interview questions
  async function generateInterviewQs() {
    if (!seeker?.resumeFile) {
      alert("Please upload a resume first.");
      return;
    }
    setInterviewLoading(true);
    try {
      const prompt =
        `Generate ${questionCount} realistic interview questions based on my resume. ` +
        `Mix behavioral and technical where relevant. Number each question only.`;

      const { data } = await api.post("/api/resume/chat", {
        Question: prompt,
        Mode: AI_MODES.MOCK_INTERVIEW,
      });

      let list: string[] = [];
      if (Array.isArray(data?.questions)) list = data.questions;
      else {
        const raw = (data?.shortAnswer || data?.answer || "") as string;
        list = raw
          .replace(/<\/?br\/?>/gi, "\n")
          .split(/\n+/)
          .map((s) => s.replace(/^\d+[\).\s-]?\s*/, "").trim())
          .filter(Boolean);
      }
      const trimmed = list.slice(0, questionCount);
      setInterviewQs(trimmed.length ? trimmed : ["No questions returned"]);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to generate interview questions");
    } finally {
      setInterviewLoading(false);
    }
  }

  // Project Rewriter
  async function generateProjectRewrite() {
    if (!projectText.trim()) {
      alert("Paste a project/experience description first.");
      return;
    }
    setRewriteLoading(true);
    try {
      const prompt =
        "Rewrite this project for a resume using strong action verbs, impact, and metrics. " +
        "Keep to 4–6 bullet points, 18 words max each.\n\n" + projectText.trim();

      const { data } = await api.post("/api/resume/chat", {
        Question: prompt,
        Mode: AI_MODES.PROJECT_REWRITER, // Adjust mode for your backend
      });

      const text = (data?.shortAnswer as string)?.replace(/<br\/?>/gi, "\n") || data?.answer || "(No answer)";
      setRewriteOutput(String(text));
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to rewrite project");
    } finally {
      setRewriteLoading(false);
    }
  }

  async function generateVideoScript() {
    if (!projectText.trim()) {
      alert("Paste your project/summary first.");
      return;
    }
    setVideoLoading(true);
    try {
      const prompt =
        "Create a concise 60–90 second video resume script with intro, 2–3 achievements, and a crisp closing CTA. " +
        "Keep sentences short and conversational.\n\n" + projectText.trim();

      const { data } = await api.post("/api/resume/chat", {
        Question: prompt,
        Mode: AI_MODES.VIDEO_SCRIPT, // Adjust mode for your backend
      });

      const text = (data?.shortAnswer as string)?.replace(/<br\/?>/gi, "\n") || data?.answer || "(No answer)";
      setVideoOutput(String(text));
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to generate video script");
    } finally {
      setVideoLoading(false);
    }
  }


  // Multilingual Q&A
  async function askMultilingual() {
    if (!mlQuestion.trim()) {
      alert("Type a question first.");
      return;
    }
    setMlLoading(true);
    try {
      const prompt = languagePreface(chatLang) + mlQuestion.trim();

      const { data } = await api.post("/api/resume/chat", {
        Question: prompt,
        Mode: "ResumeAssistant", // generic help mode—change if needed
      });

      const text = (data?.shortAnswer as string)?.replace(/<br\/?>/gi, "\n") || data?.answer || "(No answer)";
      setMlAnswer(String(text));
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to ask multilingual help");
    } finally {
      setMlLoading(false);
    }
  }

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        <div className="text-gray-600">Loading profile…</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-gray-600 mt-2">We couldn’t determine your role. Please sign in again.</p>
      </div>
    );
  }

  const viewCount = summary?.views?.viewCount ?? null;
  const lastViewedBy = summary?.views?.lastViewedBy ?? null;
  const recentSaved = summary?.saved?.recent ?? [];
  const recentApplied = summary?.applied?.recent ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 grid place-items-center">
            <span className="text-sm">
              {(role === "JobSeeker" ? seeker?.fullName : recruiter?.name)?.[0] ?? "U"}
            </span>
          </div>
          <div>
            <div className="font-semibold">
              {role === "JobSeeker" ? (seeker?.fullName || "Your profile") : (recruiter?.name || "Company")}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="chip">{role}</span>
              {memberSince && <span>Member since {new Date(memberSince).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2">
        <button className={`chip ${tab === "overview" ? "ring-1 ring-gray-300" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={`chip ${tab === "edit" ? "ring-1 ring-gray-300" : ""}`} onClick={() => setTab("edit")}>
          Edit
        </button>
        {role === "JobSeeker" && (
          <>
            <button className={`chip ${tab === "ai-tools" ? "ring-1 ring-gray-300" : ""}`} onClick={() => setTab("ai-tools")}>
              AI Tools
            </button>
            <button className={`chip ${tab === "assistant" ? "ring-1 ring-gray-300" : ""}`} onClick={() => setTab("assistant")}>
              AI Assistant
            </button>
          </>
        )}
      </div>

      {/* Overview - JobSeeker */}
      {tab === "overview" && role === "JobSeeker" && seeker && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="About">
              <TwoCol label="Name" value={seeker.fullName || "—"} />
              <TwoCol label="Email" value={seeker.email || "—"} />
              <TwoCol label="Location" value={seeker.location || "—"} />
              <TwoCol label="Education" value={seeker.education || "—"} />
              <TwoCol label="Experience" value={seeker.experienceYears != null ? `${seeker.experienceYears} yrs` : "—"} />
              <TwoCol
                label="Skills"
                value={
                  seekerSkillTags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {seekerSkillTags.map((t, i) => (
                        <span key={`${t}-${i}`} className="chip">{t}</span>
                      ))}
                    </div>
                  ) : "—"
                }
              />
              <TwoCol label="Bio" value={seeker.bio || "—"} />
            </Card>

            <Card title="Resume">
              <TwoCol label="File" value={seeker.resumeFile || "—"} />
              <TwoCol
                label="Visibility"
                value={
                  <div className="flex items-center gap-2">
                    <span>{seeker.resumeVisibility ? "Public" : "Private"}</span>
                    <button className="btn btn-ghost" onClick={toggleResumeVisibility}>Toggle</button>
                  </div>
                }
              />
              <div className="mt-2">
                <button className="btn btn-primary" onClick={downloadResume} disabled={!seeker.resumeFile}>
                  Download resume
                </button>
              </div>
            </Card>

            <div className="mt-2 flex gap-2">
              <button className="btn btn-primary" onClick={downloadResume} disabled={!seeker.resumeFile}>
                Download resume
              </button>

              <button
                className="btn btn-ghost"
                onClick={generateAiPdf}
                disabled={pdfLoading || !seeker.resumeFile}
                title="Generate an ATS-optimized AI PDF from your profile"
              >
                {pdfLoading ? "Generating…" : "Generate AI Resume PDF"}
              </button>
            </div>
            {/* GDPR Consent Logs */}
            <Card title="GDPR Consent Logs">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">User consent history</div>
                {jsConsents?.total != null && (
                  <span className="text-xs text-gray-500">Total: {jsConsents.total}</span>
                )}
              </div>

              {jsConsentsLoading && <div className="text-sm">Loading consent logs…</div>}
              {jsConsentsErr && <div className="text-sm text-red-600">{jsConsentsErr}</div>}

              {!jsConsentsLoading && !jsConsentsErr && jsConsents?.items?.length === 0 && (
                <div className="text-sm text-gray-600">No consent records found.</div>
              )}

              {!jsConsentsLoading && !jsConsentsErr && !!jsConsents?.items?.length && (
                <>
                  {jsConsents.current && (
                    <div className="rounded-md bg-gray-50 ring-1 ring-gray-200 p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Current Consent</span>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700 ring-1 ring-green-200">
                          Active
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 space-y-1">
                        <div>
                          <span className="font-medium">Type:</span>{" "}
                          {jsConsents.current.consentType || "GDPR"} ({jsConsents.current.version || "v1.0"})
                        </div>
                        <div>
                          <span className="font-medium">Accepted:</span>{" "}
                          {jsConsents.current.isAccepted ? "Yes" : "No"}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>{" "}
                          {fmtConsentDate(jsConsents.current.consentDate)}
                        </div>
                        {jsConsents.current.ipAddress && (
                          <div><span className="font-medium">IP:</span> {jsConsents.current.ipAddress}</div>
                        )}
                        {jsConsents.current.userAgent && (
                          <div className="truncate"><span className="font-medium">UA:</span> {jsConsents.current.userAgent}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-1 pr-3">#</th>
                          <th className="py-1 pr-3">Date</th>
                          <th className="py-1 pr-3">Type</th>
                          <th className="py-1 pr-3">Version</th>
                          <th className="py-1 pr-3">Accepted</th>
                          <th className="py-1 pr-3">IP</th>
                          <th className="py-1 pr-3">User Agent</th>
                          <th className="py-1">Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jsConsents.items.map((c, i) => (
                          <tr key={`${c.consentId ?? "x"}-${i}`} className="border-t">
                            <td className="py-1 pr-3">{c.consentId}</td>
                            <td className="py-1 pr-3">{fmtConsentDate(c.consentDate)}</td>
                            <td className="py-1 pr-3">{c.consentType || "GDPR"}</td>
                            <td className="py-1 pr-3">{c.version || "v1.0"}</td>
                            <td className="py-1 pr-3">{c.isAccepted ? "Yes" : "No"}</td>
                            <td className="py-1 pr-3">{c.ipAddress || "—"}</td>
                            <td className="py-1 pr-3">
                              <span className="block max-w-[280px] truncate" title={c.userAgent || ""}>
                                {c.userAgent || "—"}
                              </span>
                            </td>
                            <td className="py-1">{c.isCurrent ? "✅" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

          </div>

          <div className="space-y-6">
            {/* Resume Score card */}
            {/* Resume Score card (rendering) */}
            <Card title="Resume score">
              {!seeker?.resumeFile && (
                <div className="text-sm text-gray-600">
                  No resume found. Upload a resume in{" "}
                  <button className="link" onClick={() => setTab("edit")}>Edit</button> to generate a score.
                </div>
              )}

              {seeker?.resumeFile && (seeker.resumeScore == null || Number.isNaN(seeker.resumeScore)) && (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">You haven’t generated a resume score yet.</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateResumeScore}
                    disabled={scoring}
                    title="Runs /api/resume/score and saves the result"
                  >
                    {scoring ? "Scoring…" : "Generate score"}
                  </button>
                </div>
              )}

              {seeker?.resumeFile && seeker.resumeScore != null && !Number.isNaN(seeker.resumeScore) && (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Current score</div>
                      <div className="text-3xl font-semibold">{seeker.resumeScore}/100</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={generateResumeScore}
                      disabled={scoring}
                      title="Recalculate score"
                    >
                      {scoring ? "Updating…" : "Re-score"}
                    </button>
                  </div>

                  <div className="w-full h-2 rounded bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.max(0, Math.min(100, seeker.resumeScore))}%` }}
                    />
                  </div>

                  <div className="text-xs text-gray-600">
                    Higher scores usually mean better keyword/skill alignment and ATS-friendly formatting.
                  </div>
                </div>
              )}
            </Card>


            {/* Public link (copy only) */}
            {seeker.publicProfileSlug && (
              <Card title="Public profile link">
                <div className="flex items-center gap-2">
                  <input
                    className="input w-full truncate"
                    readOnly
                    value={buildPublicProfileUrl(seeker.publicProfileSlug)}
                    title="Shareable public profile API URL"
                  />
                  <button
                    className="btn btn-ghost"
                    onClick={() => copyPublicProfileLink(seeker.publicProfileSlug!)}
                    title="Copy public profile link"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Read-only JSON endpoint. You can change the slug in Edit.
                </div>
              </Card>
            )}

            {(viewCount != null || lastViewedBy) && (
              <Card title="Views">
                <TwoCol label="Total views" value={viewCount ?? "—"} />
                <TwoCol label="Last viewed" value={lastViewedBy || "—"} />
              </Card>
            )}

            <Card title="Recent activity">
              <SectionLabel>Saved jobs</SectionLabel>
              {recentSaved.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <ul className="list-disc list-inside text-sm">
                  {recentSaved.map((j, i) => <li key={i}>{j.title || "Untitled job"}</li>)}
                </ul>
              )}
              <div className="mt-3" />
              <SectionLabel>Applied jobs</SectionLabel>
              {recentApplied.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <ul className="list-disc list-inside text-sm">
                  {recentApplied.map((j, i) => <li key={i}>{j.title || "Untitled job"}</li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Overview - Recruiter */}
      {tab === "overview" && role === "Recruiter" && recruiter && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Company">
              <TwoCol label="Name" value={recruiter.name || "—"} />
              <TwoCol label="Website" value={recruiter.website || "—"} />
              <TwoCol label="Industry" value={recruiter.industry || "—"} />
              <TwoCol label="Type" value={recruiter.type || "—"} />
              <TwoCol label="Description" value={recruiter.description || "—"} />
              <TwoCol
                label="Status"
                value={
                  <div className="flex flex-wrap gap-2">
                    <span className={`chip ${recruiter.isApproved ? "bg-green-50 text-green-700 ring-green-200" : ""}`}>
                      {recruiter.isApproved ? "Approved" : "Not approved"}
                    </span>
                    <span className={`chip ${recruiter.isVerified ? "bg-blue-50 text-blue-700 ring-blue-200" : ""}`}>
                      {recruiter.isVerified ? "Verified" : "Not verified"}
                    </span>
                  </div>
                }
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Jobs">
              <TwoCol label="Jobs posted" value={jobsPostedCount != null ? jobsPostedCount : "—"} />
              <div className="mt-2">
                <Link to="/companies" className="btn btn-ghost">My Jobs</Link>
              </div>
            </Card>

            <Card title="Recent postings">
              {postedJobs.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <ul className="list-disc list-inside text-sm">
                  {postedJobs.map((j, i) => <li key={i}>{j.title || "Untitled job"}</li>)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Edit - JobSeeker */}
      {tab === "edit" && role === "JobSeeker" && seeker && (
        <form className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6" onSubmit={saveSeeker}>
          <div className="lg:col-span-2 space-y-6">
            <Card title="Edit profile">
              <Two>
                <Field label="Location">
                  <input className="input" value={seeker.location || ""} onChange={(e) => setSeeker({ ...seeker, location: e.target.value })} />
                </Field>
                <Field label="Education">
                  <input className="input" value={seeker.education || ""} onChange={(e) => setSeeker({ ...seeker, education: e.target.value })} />
                </Field>
              </Two>

              <Two>
                <Field label="Experience (years)">
                  <input
                    type="number"
                    className="input"
                    value={seeker.experienceYears ?? 0}
                    onChange={(e) => setSeeker({ ...seeker, experienceYears: Number(e.target.value || 0) })}
                  />
                </Field>
                <Field label="Skills (comma separated)">
                  <input className="input" value={seeker.skills || ""} onChange={(e) => setSeeker({ ...seeker, skills: e.target.value })} />
                </Field>
              </Two>

              <Field label="Bio">
                <textarea className="input h-24" value={seeker.bio || ""} onChange={(e) => setSeeker({ ...seeker, bio: e.target.value })} />
              </Field>

              <Field label="Public profile slug (optional)">
                <input
                  className="input"
                  placeholder="e.g., jobseeker-one"
                  value={seeker.publicProfileSlug || ""}
                  onChange={(e) => {
                    const next = slugify(e.target.value);
                    setSeeker({ ...seeker, publicProfileSlug: next });
                  }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  Will appear as <code>/user/public/&lt;slug&gt;</code>. Leave blank to disable.
                </div>
                {seeker.publicProfileSlug && !isValidSlug(seeker.publicProfileSlug) && (
                  <div className="text-xs text-red-600 mt-1">
                    Slug must be 3–32 chars, a–z, 0–9, and hyphens (no leading/trailing hyphen).
                  </div>
                )}
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!seeker.resumeVisibility}
                  onChange={(e) => setSeeker({ ...seeker, resumeVisibility: e.target.checked })}
                />
                Resume visible to recruiters
              </label>

              <div className="mt-4">
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </Card>
          </div>
        </form>
      )}

      {/* AI TOOLS - JobSeeker */}
      {tab === "ai-tools" && role === "JobSeeker" && seeker && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fit Score (quick per job) */}
          <Card title="Fit score (per job)">
            <Two>
              <Field label="Job ID">
                <input
                  className="input"
                  placeholder="Enter Job ID, e.g. 123"
                  value={fitJobId}
                  onChange={(e) => setFitJobId(e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
              <Field label="Action">
                <button className="btn btn-primary w-full" onClick={generateFitScore} disabled={fitGenerating}>
                  {fitGenerating ? "Calculating…" : "Generate fit score"}
                </button>
              </Field>
            </Two>
            {fitResult?.score != null && (
              <div className="mt-3 space-y-2">
                <div className="text-3xl font-semibold">{fitResult.score}/100</div>
                <div className="w-full h-2 rounded bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.max(0, Math.min(100, fitResult.score))}%` }}
                  />
                </div>
                {fitResult.explanation && (
                  <div className="text-sm text-gray-700 whitespace-pre-line">{fitResult.explanation}</div>
                )}
              </div>
            )}
          </Card>

          {/* Skill Gap Analysis (merged) */}
          <Card title="Skill Gap Analysis (by Job ID)">
            <div className="text-sm text-gray-600">
              Enter a Job ID to see your fit score, matched items, missing gaps, and AI suggestions you can add to your profile.
            </div>

            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Job ID">
                <input
                  className="input"
                  placeholder="e.g. 123"
                  value={gapJobId}
                  onChange={(e) => setGapJobId(e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
              <Field label="Action">
                <button className="btn btn-primary w-full" onClick={runSkillGap} disabled={gapLoading}>
                  {gapLoading ? "Analyzing…" : "Run analysis"}
                </button>
              </Field>
            </div>

            {typeof gapData.fitScore === "number" && (
              <div className="mt-4 space-y-4">
                {/* Score */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Company-tailored fit score</div>
                    <div className="text-2xl font-semibold">{gapData.fitScore}/100</div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {gapData.matchedCount ?? 0}/{gapData.totalCriteria ?? 0} criteria matched
                  </div>
                </div>
                <div className="w-full h-2 rounded bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.max(0, Math.min(100, gapData.fitScore || 0))}%` }}
                  />
                </div>

                {/* Matched */}
                {(gapData.matchedSkills?.length || gapData.matchedKeywords?.length) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <SectionLabel>Matched skills</SectionLabel>
                      <ul className="list-disc list-inside text-sm">
                        {(gapData.matchedSkills ?? []).length
                          ? gapData.matchedSkills!.map((s, i) => <li key={i}>{s}</li>)
                          : <li>—</li>}
                      </ul>
                    </div>
                    <div>
                      <SectionLabel>Matched keywords</SectionLabel>
                      <ul className="list-disc list-inside text-sm">
                        {(gapData.matchedKeywords ?? []).length
                          ? gapData.matchedKeywords!.map((s, i) => <li key={i}>{s}</li>)
                          : <li>—</li>}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {/* Gaps */}
                <div>
                  <SectionLabel>Gaps to add (skills/keywords)</SectionLabel>
                  <ul className="list-disc list-inside text-sm">
                    {(gapData.gaps ?? []).length ? (
                      gapData.gaps!.map((g, i) => <li key={i}>{g}</li>)
                    ) : (
                      <li>None — great match!</li>
                    )}
                  </ul>
                </div>

                {/* AI suggestions (select + actions) */}
                <div>
                  <SectionLabel>AI suggestions (select to act)</SectionLabel>
                  {Array.isArray(gapData.suggestions) && gapData.suggestions.length ? (
                    <>
                      <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                        {gapData.suggestions.map((s, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedSuggestions.includes(s)}
                              onChange={() => toggleSuggestion(s)}
                            />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="btn btn-ghost" onClick={addSelectedToSkills}>
                          Add selected to profile skills
                        </button>
                        <button className="btn btn-ghost" onClick={askAIToWriteBullets}>
                          Ask AI to create resume bullets
                        </button>
                        <button className="btn btn-ghost" onClick={copySelected}>
                          Copy selected
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-600 mt-1">—</div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Parse Resume */}
          <Card title="Parse resume (emails / phones / skills)">
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" onClick={parseResume} disabled={parseLoading}>
                {parseLoading ? "Parsing…" : "Parse resume"}
              </button>
            </div>
            {parsed && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <SectionLabel>Emails</SectionLabel>
                  <ul className="list-disc list-inside text-sm">
                    {(parsed.emails ?? []).length ? parsed.emails!.map((e, i) => <li key={i}>{e}</li>) : <li>—</li>}
                  </ul>
                </div>
                <div>
                  <SectionLabel>Phones</SectionLabel>
                  <ul className="list-disc list-inside text-sm">
                    {(parsed.phones ?? []).length ? parsed.phones!.map((e, i) => <li key={i}>{e}</li>) : <li>—</li>}
                  </ul>
                </div>
                <div>
                  <SectionLabel>Skills</SectionLabel>
                  <ul className="list-disc list-inside text-sm">
                    {(parsed.skills ?? []).length ? parsed.skills!.map((e, i) => <li key={i}>{e}</li>) : <li>—</li>}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* Design Tips */}
          <Card title="Design tips (ATS & formatting)">
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" onClick={loadDesignTips} disabled={tipsLoading}>
                {tipsLoading ? "Loading…" : "Get design tips"}
              </button>
            </div>

            {tips && (
              <div className="mt-3 space-y-3">
                {tips.lengthStructure && (
                  <div className="rounded-md bg-amber-50 ring-1 ring-amber-200 p-3 text-sm">
                    <div className="font-medium mb-1">Length / structure</div>
                    <div>{tips.lengthStructure}</div>
                  </div>
                )}

                {tips.atsOptimization && (
                  <div className="rounded-md bg-blue-50 ring-1 ring-blue-200 p-3 text-sm">
                    <div className="font-medium mb-1">ATS optimization</div>
                    <div>{tips.atsOptimization}</div>
                  </div>
                )}

                <div>
                  <SectionLabel>Actionable tips</SectionLabel>
                  {tips.tips.length ? (
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {tips.tips.map((t, i) => (
                        <li key={i}>
                          {typeof t === "string"
                            ? t
                            : `${t.section ? `[${t.section}] ` : ""}${t.advice || ""}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-600">No tips available.</div>
                  )}
                </div>

              </div>
            )}
          </Card>

          {/* NEW: Mock Interview Q/A Generator */}
          <Card title="Mock interview (generate questions)">
            <Two>
              <Field label="Number of questions">
                <input
                  type="number"
                  min={5}
                  max={20}
                  className="input"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(5, Math.min(20, Number(e.target.value || 10))))}
                />
              </Field>
              <Field label="Action">
                <button className="btn btn-primary w-full" onClick={generateInterviewQs} disabled={interviewLoading}>
                  {interviewLoading ? "Generating…" : "Generate questions"}
                </button>
              </Field>
            </Two>

            {interviewQs && (
              <ol className="list-decimal list-inside text-sm mt-3 space-y-1">
                {interviewQs.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            )}
          </Card>

          {/* NEW: Project Rewriter + Video Resume Script */}
          <Card title="Project rewrite & video script">
            <Field label="Paste your project / experience">
              <textarea
                className="input h-28"
                placeholder="Paste a project or short summary to transform…"
                value={projectText}
                onChange={(e) => setProjectText(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={generateProjectRewrite} disabled={rewriteLoading}>
                {rewriteLoading ? "Rewriting…" : "Rewrite for resume"}
              </button>
              <button className="btn btn-ghost" onClick={generateVideoScript} disabled={videoLoading}>
                {videoLoading ? "Creating…" : "Generate video script"}
              </button>
            </div>

            {rewriteOutput && (
              <div className="mt-3">
                <SectionLabel>Rewritten bullets</SectionLabel>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-2 ring-1 ring-gray-200">{rewriteOutput}</pre>
              </div>
            )}

            {videoOutput && (
              <div className="mt-3">
                <SectionLabel>Video resume script</SectionLabel>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-2 ring-1 ring-gray-200">{videoOutput}</pre>
              </div>
            )}
          </Card>


          {/* NEW: Multilingual Resume Help */}
          <Card title="Multilingual resume help (English / हिंदी / ગુજરાતી)">
            <Two>
              <Field label="Language">
                <select
                  className="input"
                  value={chatLang}
                  onChange={(e) => setChatLang(e.target.value as "en" | "hi" | "gu")}
                  title="Choose the language for the AI response"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                </select>
              </Field>
              <Field label="Ask anything about your resume">
                <input
                  className="input"
                  placeholder="e.g., Improve my summary for data analyst roles"
                  value={mlQuestion}
                  onChange={(e) => setMlQuestion(e.target.value)}
                />
              </Field>
            </Two>

            <div className="mt-2">
              <button className="btn btn-primary" onClick={askMultilingual} disabled={mlLoading}>
                {mlLoading ? "Asking…" : "Ask"}
              </button>
            </div>

            {mlAnswer && (
              <div className="mt-3">
                <SectionLabel>Answer</SectionLabel>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-2 ring-1 ring-gray-200">{mlAnswer}</pre>
              </div>
            )}
          </Card>

        </div>
      )}

      {/* ASSISTANT - full-width professional chat */}
      {tab === "assistant" && role === "JobSeeker" && (
        <div className="mt-6">
          <div className="rounded-2xl border border-gray-200 p-0 overflow-visible">
            <ResumeChat />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="font-medium">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
function TwoCol({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-gray-700">{children}</div>;
}
