// src/lib/authGate.ts
export type AuthTab = "login" | "register" | "forgot";

const OPEN_EVT = "jobsetu:open-auth";

export function openAuth(tab: AuthTab = "login") {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_EVT, { detail: { tab } }));
  } catch { /* no-op */ }
}

export function onOpenAuth(fn: (tab: AuthTab) => void) {
  const handler = (e: Event) => {
    const ce = e as CustomEvent;
    fn((ce.detail?.tab as AuthTab) || "login");
  };
  window.addEventListener(OPEN_EVT, handler as any);
  return () => window.removeEventListener(OPEN_EVT, handler as any);
}
