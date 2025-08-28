// src/lib/api.ts
import axios from "axios";
import type {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosRequestConfig,
} from "axios";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";
export const API_BASE_URL = BASE_URL;              // ⬅️ useful for absolute links
const TOKEN_KEY = "jobsetu_token";

/* ----------------- auth change event bus ----------------- */
const AUTH_EVT = "jobsetu:auth-changed";
export function onAuthChanged(fn: () => void) {
  const handler = () => fn();
  window.addEventListener(AUTH_EVT, handler);
  return () => window.removeEventListener(AUTH_EVT, handler);
}
function emitAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_EVT));
  } catch {
    /* ignore */
  }
}
/* -------------------------------------------------------- */
export async function fetchConversations() {
  const token = authStorage.getToken();
  if (!token) return [];

  try {
const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
// --- Axios module augmentation so we can pass suppressUnauthorized ---
declare module "axios" {
  interface AxiosRequestConfig {
    suppressUnauthorized?: boolean;           // ✅ our custom flag
    meta?: { ignoreGlobal401?: boolean };     // (legacy flag you had)
  }
  interface InternalAxiosRequestConfig {
    suppressUnauthorized?: boolean;
    meta?: { ignoreGlobal401?: boolean };
  }
}

/* ---------------------- auth storage --------------------- */
export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    emitAuthChanged();
  },
  clear() {
    this.setToken(null);
    try {
      localStorage.removeItem("jobsetu_user");
    } catch {}
    emitAuthChanged();
  },
  /** ✅ Returns parsed user object stored in localStorage */
  getUser(): { userId: number; fullName?: string; role?: string } | null {
    try {
      const raw = localStorage.getItem("jobsetu_user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  /** ✅ Returns userId (or null if not logged in) */
  getUserId(): number | null {
    const u = this.getUser();
    return u?.userId ?? null;
  },
};

/* -------------------------------------------------------- */

// --- read role from the JWT (if present) ---
export function getRoleFromToken(): "JobSeeker" | "Recruiter" | null {
  const tok = authStorage.getToken();
  if (!tok) return null;
  const parts = tok.split(".");
  if (parts.length < 2) return null;

  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));

    const roleClaim =
      json.role ||
      json.roles ||
      json["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

    if (Array.isArray(roleClaim)) {
      const r = roleClaim.find(
        (x: string) => x === "Recruiter" || x === "JobSeeker"
      );
      return (r as any) || null;
    }
    if (roleClaim === "Recruiter" || roleClaim === "JobSeeker")
      return roleClaim as any;
    return null;
  } catch {
    return null;
  }
}

/* ---------------- unauthorized redirect hook ------------- */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/* --------------------- axios instance -------------------- */
type Cfg = InternalAxiosRequestConfig & {
  suppressUnauthorized?: boolean;
  meta?: { ignoreGlobal401?: boolean };
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  paramsSerializer: (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
      if (Array.isArray(v)) v.forEach((val) => sp.append(k, String(val)));
      else sp.append(k, String(v));
    });
    return sp.toString();
  },
});

api.interceptors.request.use((config: Cfg) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Auth endpoints where 401 should NOT trigger global logout/alert */
const AUTH_PATHS = new Set<string>([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/verify-forgot-password-otp",
  "/api/auth/reset-password",
]);

function extractPath(url?: string) {
  if (!url) return "";
  try {
    return new URL(url, BASE_URL || window.location.origin).pathname.toLowerCase();
  } catch {
    return (url || "").toLowerCase();
  }
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<any>) => {
    const cfg = error.config as Cfg | undefined;
    const status = Number(error.response?.status);
    const path = extractPath(cfg?.url);

    let data: any = error.response?.data;
    let message: string;

    // If server returned Blob (common on failed downloads), try to read text quickly
    if (data instanceof Blob) {
      message = error.message || "Request failed";
      // Note: we avoid async FileReader here to keep this interceptor sync.
    } else {
      message =
        (typeof data === "string" && data) ||
        data?.message ||
        data?.Message ||
        error.message ||
        "Request failed";
    }

    const normalized = { message, status, data };

    const suppressed =
      !!cfg?.suppressUnauthorized || !!cfg?.meta?.ignoreGlobal401;

    // ✅ Only 401 should clear credentials and fire the global handler.
    if (status === 401 && !suppressed && !AUTH_PATHS.has(path)) {
      authStorage.clear();
      onUnauthorized?.();
      return Promise.reject(normalized);
    }

    // ✅ 403 (forbidden) should *not* log users out.
    if (status === 403) {
      return Promise.reject(normalized);
    }

    return Promise.reject(normalized);
  }
);

/* ---------------- helpers you can import ----------------- */

/** Use this headers object for FormData requests so axios sets proper boundary. */
export const multipart = { headers: { "Content-Type": "multipart/form-data" } };

/** Build an absolute URL against API_BASE_URL (useful for image/src fallbacks). */
export function absUrl(path: string) {
  const base = (API_BASE_URL || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${base}/${p}`;
}

/** GET a Blob (e.g., CSV, PDF) with auth attached. */
export async function getBlob(path: string, params?: Record<string, any>): Promise<Blob> {
  const { data } = await api.get(path, { params, responseType: "blob" });
  return data as Blob;
}

/* ---------------- error normalization helper ------------- */
export function normalizeApiError(err: unknown): {
  message: string;
  status?: number;
  data?: any;
} {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;

    // If Blob error, just return a generic message (parsing Blob is async)
    if (data instanceof Blob) {
      return { message: "Request failed", status, data };
    }

    const message =
      (typeof data === "string" && data) ||
      (data as any)?.message ||
      (data as any)?.Message ||
      err.message ||
      "Request failed";
    return { message, status, data };
  }
  const anyErr = err as any;
  if (anyErr?.message) return anyErr;
  return { message: "Unknown error" };
}

export default api;
