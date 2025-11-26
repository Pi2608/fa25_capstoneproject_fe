import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";


// ===================== NOTIFICATION TYPES =====================

export interface NotificationEvent {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

// ===================== CONNECTION SETUP =====================

/**
 * Create SignalR connection for notifications hub
 * This hub handles real-time notifications for authenticated users
 */
export function createNotificationConnection(
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR Notifications] Missing API_BASE_URL");
    return null;
  }

  const authToken = token || getToken();

  if (!authToken || !authToken.trim()) {
    console.error("[SignalR Notifications] No token provided");
    return null;
  }

  if (!isTokenValid(authToken)) {
    console.error("[SignalR Notifications] Invalid token");
    return null;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/notifications`;

  return createBaseConnection(hubUrl, {
    token: authToken,
    allowGuest: false, // Notifications require authentication
    onClose: (error) => {
      console.error("[SignalR Notifications] Connection closed with error:", error);
    },
    onReconnecting: (error) => {
      console.warn("[SignalR Notifications] Reconnecting...", error);
    },
    onReconnected: (connectionId) => {
      console.info("[SignalR Notifications] Reconnected:", connectionId);
    },
  });
}

export async function startNotificationConnection(
  connection: signalR.HubConnection,
  token: string
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[SignalR Notifications] Connection not in disconnected state:",
        connection.state
      );
      return false;
    }

    const currentToken = getToken();
    if (!currentToken || currentToken !== token) {
      console.error("[SignalR Notifications] Token mismatch");
      return false;
    }

    if (!isTokenValid(currentToken)) {
      console.error("[SignalR Notifications] Token invalid");
      return false;
    }

    await connection.start();
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    if (!errorMessage.includes("negotiation") && !errorMessage.includes("abort")) {
      console.error("[SignalR Notifications] Failed to start connection:", error);
    }
    return false;
  }
}

export async function stopNotificationConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("[SignalR Notifications] Failed to stop connection:", error);
  }
}

// ===================== EVENT HANDLERS SETUP =====================

export interface NotificationEventHandlers {
  onNotificationReceived?: (event: NotificationEvent) => void;
  onNotificationRead?: (notificationId: string) => void;
}

export function registerNotificationEventHandlers(
  connection: signalR.HubConnection,
  handlers: NotificationEventHandlers
): void {
  if (handlers.onNotificationReceived) {
    connection.on("NotificationReceived", handlers.onNotificationReceived);
  }

  if (handlers.onNotificationRead) {
    connection.on("NotificationRead", handlers.onNotificationRead);
  }
}

export function unregisterNotificationEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("NotificationReceived");
  connection.off("NotificationRead");
}

