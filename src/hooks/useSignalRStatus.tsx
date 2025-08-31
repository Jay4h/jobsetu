// src/hooks/useSignalRStatus.tsx
import { useEffect, useState } from "react";

type Status =
  | "not loaded"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error"
  | "unknown";

export default function useSignalRStatus(): Status {
  const [status, setStatus] = useState<Status>("not loaded");

  useEffect(() => {
    const $: any = (window as any).$ || (window as any).jQuery;
    if (!$?.connection?.hub) {
      setStatus("not loaded");
      console.log("SignalR: not loaded");
      return;
    }

    const hub = $.connection.hub;
    const map: Record<number, Status> = {
      0: "connecting",
      1: "connected",
      2: "reconnecting",
      4: "disconnected",
    };

    const current = map[hub.state] ?? "unknown";
    setStatus(current);
    console.log("SignalR:", current);

    const onStateChanged = (change: any) => {
      const next = map[change.newState] ?? "unknown";
      setStatus(next);
      console.log("SignalR state ->", next);
    };

    hub.stateChanged(onStateChanged);
    hub.reconnecting(() => {
      setStatus("reconnecting");
      console.log("SignalR: reconnecting…");
    });
    hub.reconnected(() => {
      setStatus("connected");
      console.log("SignalR: reconnected");
    });
    hub.disconnected(() => {
      setStatus("disconnected");
      console.log("SignalR: disconnected");
    });
    hub.error((err: any) => {
      setStatus("error");
      console.error("SignalR error:", err);
    });
  }, []);

  return status;
}
