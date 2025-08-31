// src/lib/signalr.ts
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { API_BASE_URL, authStorage, onAuthChanged } from "./api";

let connection: HubConnection | null = null;
let starting: Promise<HubConnection> | null = null;

// keep handlers so we can rebind them on reconnect
const handlers = new Map<string, Set<(...args: any[]) => void>>();

// state listeners
const stateListeners = new Set<(s: HubConnectionState) => void>();
function notifyState() {
  const s = connection ? connection.state : HubConnectionState.Disconnected;
  stateListeners.forEach((fn) => fn(s));
}

function bindAllHandlers(conn: HubConnection) {
  handlers.forEach((set, evt) => {
    set.forEach((h) => conn.on(evt, h));
  });
}

export function onStateChanged(fn: (s: HubConnectionState) => void) {
  stateListeners.add(fn);
  // push current state immediately
  fn(connection ? connection.state : HubConnectionState.Disconnected);
  return () => stateListeners.delete(fn);
}

export async function stopHub() {
  if (connection) {
    try {
      await connection.stop();
    } catch {}
    connection = null;
    notifyState();
  }
}

/** Ensure a connection exists and is started (if a token exists). */
export async function ensureHubStarted(): Promise<HubConnection | null> {
  const token = authStorage.getToken();
  if (!token) {
    await stopHub();
    return null;
  }

  if (connection && connection.state !== HubConnectionState.Disconnected) {
    return connection;
  }

  if (!starting) {
    starting = (async () => {
      // fresh connection
      if (connection) {
        try {
          await connection.stop();
        } catch {}
        connection = null;
      }

      const conn = new HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/signalr`, {
          accessTokenFactory: () => authStorage.getToken() ?? "",
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Information)
        .build();

      // forward state changes
      conn.onclose(() => notifyState());
      conn.onreconnecting(() => notifyState());
      conn.onreconnected(() => {
        bindAllHandlers(conn);
        notifyState();
      });

      notifyState();
      await conn.start();
      connection = conn;
      bindAllHandlers(conn);
      notifyState();
      return conn;
    })().finally(() => (starting = null));
  }

  try {
    return await starting;
  } catch (e) {
    console.warn("SignalR start failed:", e);
    return null;
  }
}

/** Subscribe to a hub event. Returns an unsubscribe function. */
export function on(event: string, handler: (...args: any[]) => void) {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler);

  // bind to current connection
  connection?.on(event, handler);

  return () => {
    const conn = connection;
    set!.delete(handler);
    conn?.off(event, handler);
  };
}

/** Access the current connection (may be null). */
export function hub(): HubConnection | null {
  return connection;
}

// auto (re)start/stop on auth changes
onAuthChanged(() => {
  ensureHubStarted(); // will stop if token missing
});
