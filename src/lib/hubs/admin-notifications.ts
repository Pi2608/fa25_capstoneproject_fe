import * as signalR from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";
import { createSupportTicketConnection, startConnection as startSupportTicketConnection, stopConnection as stopSupportTicketConnection, type TicketCreatedEvent } from "./support-tickets";

export type AdminNotification = {
  type: "support_ticket" | "map_report" | "gallery_submission";
  title: string;
  message: string;
  ticketId?: number;
  reportId?: string;
  submissionId?: string;
  mapId?: string;
  createdAt: string;
  [key: string]: any;
};

type AdminNotificationHandlers = {
  onNotification?: (notification: AdminNotification) => void;
};

export function createAdminNotificationConnection(
  apiBaseUrl: string,
  token?: string | null
): signalR.HubConnection | null {
  if (!apiBaseUrl) {
    console.error("[AdminNotificationHub] Missing API_BASE_URL");
    return null;
  }

  const url = `${apiBaseUrl}/hubs/notifications`;
  const builder = new signalR.HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => {
        if (!token) {
          console.warn("[AdminNotificationHub] No token provided");
          return "";
        }
        if (token.startsWith("Bearer ")) {
          return token.substring(7);
        }
        return token;
      },
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information);

  const connection = builder.build();

  connection.onreconnecting((error) => {
    console.warn("[AdminNotificationHub] Reconnecting...", error);
  });

  connection.onreconnected((connectionId) => {
    console.info("[AdminNotificationHub] Reconnected:", connectionId);
  });

  return connection;
}

export async function startConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return;
    }
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[AdminNotificationHub] Connection not in disconnected state:",
        connection.state
      );
      return;
    }
    await connection.start();
  } catch (error) {
    console.error("[AdminNotificationHub] Failed to start connection:", error);
    throw error;
  }
}

export async function stopConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("[AdminNotificationHub] Failed to stop connection:", error);
  }
}

export function useAdminNotificationHub(
  handlers: AdminNotificationHandlers,
  options?: {
    enabled?: boolean;
  }
) {
  const [isConnected, setIsConnected] = useState(false);
  const notificationConnectionRef = useRef<signalR.HubConnection | null>(null);
  const supportTicketConnectionRef = useRef<signalR.HubConnection | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (options?.enabled === false) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
    if (!apiBaseUrl) {
      console.error("[useAdminNotificationHub] Missing API_BASE_URL");
      return;
    }

    let token: string | null = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    }

    const notificationConnection = createAdminNotificationConnection(apiBaseUrl, token);
    const supportTicketConnection = createSupportTicketConnection(apiBaseUrl, token, {
      allowGuest: false,
    });

    if (!notificationConnection || !supportTicketConnection) return;

    notificationConnectionRef.current = notificationConnection;
    supportTicketConnectionRef.current = supportTicketConnection;

    notificationConnection.on("AdminNotification", (notification: AdminNotification) => {
      handlersRef.current.onNotification?.(notification);
    });

    supportTicketConnection.on("TicketCreated", (event: TicketCreatedEvent) => {
      handlersRef.current.onNotification?.({
        type: "support_ticket",
        title: "Yêu cầu hỗ trợ mới",
        message: `Có yêu cầu hỗ trợ mới: ${event.subject}`,
        ticketId: event.ticketId,
        createdAt: event.createdAt,
      });
    });

    Promise.all([
      startConnection(notificationConnection),
      startSupportTicketConnection(supportTicketConnection),
    ])
      .then(() => {
        setIsConnected(true);
      })
      .catch((err) => {
        console.error("[useAdminNotificationHub] Failed to connect:", err);
        setIsConnected(false);
      });

    return () => {
      if (notificationConnection) {
        stopConnection(notificationConnection);
      }
      if (supportTicketConnection) {
        stopSupportTicketConnection(supportTicketConnection);
      }
      setIsConnected(false);
    };
  }, [options?.enabled]);

  return {
    notificationConnection: notificationConnectionRef.current,
    supportTicketConnection: supportTicketConnectionRef.current,
    isConnected,
  };
}

