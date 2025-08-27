// src/hooks/useSignalR.ts
import { useEffect } from "react";
import * as signalR from "@microsoft/signalr";

export function useSignalR(
  onMessage: (msg: any) => void,
  onUnread: (count: number) => void
) {
  useEffect(() => {
    const token = localStorage.getItem("jobsetu_token");
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_BASE_URL}/signalr/messagesHub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveMessage", (msg) => {
      console.log("📩 New message:", msg);
      onMessage(msg);
    });

    connection.on("UnreadCountUpdated", (count) => {
      console.log("🔔 Unread count updated:", count);
      onUnread(count);
    });

    connection.on("MessageRead", (id) => {
      console.log("✅ Message read:", id);
    });

    connection.start().catch((err) => console.error("SignalR error", err));

    return () => {
      connection.stop();
    };
  }, []);
}
