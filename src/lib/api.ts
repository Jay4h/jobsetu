// src/lib/api.ts
import axios from "axios";
import type {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosRequestConfig,
} from "axios";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";
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
// --- Axios module augmentation so we can pass suppressUnauthorized ---
declare module "axios" {
  // what callers pass to api.get/post…
  interface AxiosRequestConfig {
    suppressUnauthorized?: boolean;           // ✅ our custom flag
    meta?: { ignoreGlobal401?: boolean };     // (legacy flag you had)
  }
  // what interceptors receive
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

/** Auth endpoints where 401/403 should NOT trigger global logout/alert */
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
    return url.toLowerCase();
  }
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<any>) => {
    const cfg = error.config as Cfg | undefined;
    const status = Number(error.response?.status);
    const path = extractPath(cfg?.url);

    const data = error.response?.data as any;
    const message =
      (typeof data === "string" && data) ||
      data?.message ||
      data?.Message ||
      error.message ||
      "Request failed";
    const normalized = { message, status, data };

    const suppressed =
      !!cfg?.suppressUnauthorized || !!cfg?.meta?.ignoreGlobal401;

    if ((status === 401 || status === 403) && !suppressed) {
      if (!AUTH_PATHS.has(path)) {
        authStorage.clear();
        onUnauthorized?.();
      }
      return Promise.reject(normalized);
    }
    return Promise.reject(normalized);
  }
);

/* ---------------- error normalization helper ------------- */
export function normalizeApiError(err: unknown): {
  message: string;
  status?: number;
  data?: any;
} {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
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