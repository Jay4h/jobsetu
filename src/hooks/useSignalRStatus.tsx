// src/hooks/useSignalRStatus.tsx
import { useEffect, useRef, useState } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { authStorage, onAuthChanged } from "../lib/api";
import { ensureHubStarted, on as onEvent, onStateChanged } from "../lib/signalr";

export default function useSignalRStatus() {
  const [status, setStatus] = useState<HubConnectionState>(
    HubConnectionState.Disconnected
  );
  const [onlineMap, setOnlineMap] = useState<Record<number, boolean>>({});
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // reflect hub state
    const offState = onStateChanged(setStatus);

    // subscribe to presence updates
    unsubRef.current = onEvent("userStatusChanged", (userId: number, online: boolean) => {
      setOnlineMap((m) => ({ ...m, [userId]: online }));
    });

    // start a connection if we have a token
    ensureHubStarted();

    // restart checks on auth changes
    const offAuth = onAuthChanged(() => ensureHubStarted());

    return () => {
      offState();
      offAuth();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  return { status, onlineMap };
}
