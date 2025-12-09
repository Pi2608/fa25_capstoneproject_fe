import * as signalR from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";

export type SupportTicketMessage = {
  messageId: number;
  ticketId: number;
  message: string;
  isFromUser: boolean;
  createdAt: string;
};

export type TicketCreatedEvent = {
  ticketId: number;
  subject: string;
  message: string;
  priority: string;
  status: string;
  createdAt: string;
};

export type TicketUpdatedEvent = {
  ticketId: number;
  hasNewMessage: boolean;
};

export type TicketReplyEvent = {
  ticketId: number;
  subject: string;
  message: string;
  createdAt: string;
};

export type TicketStatusChangedEvent = {
  ticketId: number;
  status: string;
};

export type TicketClosedEvent = {
  ticketId: number;
  subject: string;
};

export function createSupportTicketConnection(
  apiBaseUrl: string,
  token?: string | null,
  options?: {
    allowGuest?: boolean;
  }
): signalR.HubConnection | null {
  if (!apiBaseUrl) {
    console.error("[SignalR SupportTicket] Missing API_BASE_URL");
    return null;
  }

  const url = `${apiBaseUrl}/hubs/support-tickets`;
  const builder = new signalR.HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => {
        if (!token) {
          if (!options?.allowGuest) {
            console.warn("[SignalR SupportTicket] No token provided");
          }
          return "";
        }
        if (token.startsWith("Bearer ")) {
          console.warn("[SignalR SupportTicket] Token provided but invalid, connecting as guest");
          return "";
        }
        return token;
      },
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information);

  const connection = builder.build();

  connection.onreconnecting((error) => {
    console.warn("[SignalR SupportTicket] Reconnecting...", error);
  });

  connection.onreconnected((connectionId) => {
    console.info("[SignalR SupportTicket] Reconnected:", connectionId);
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
        "[SignalR SupportTicket] Connection not in disconnected state:",
        connection.state
      );
      return;
    }
    await connection.start();
  } catch (error) {
    console.error("[SignalR SupportTicket] Failed to start connection:", error);
    throw error;
  }
}

export async function joinTicketRoom(
  connection: signalR.HubConnection,
  ticketId: number
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("JoinTicketRoom", ticketId);
    }
  } catch (error) {
    console.error(
      "[SignalR SupportTicket] Failed to join ticket room:",
      error
    );
  }
}

export async function leaveTicketRoom(
  connection: signalR.HubConnection,
  ticketId: number
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveTicketRoom", ticketId);
    }
  } catch (error) {
    console.error(
      "[SignalR SupportTicket] Failed to leave ticket room:",
      error
    );
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
    console.error("[SignalR SupportTicket] Failed to stop connection:", error);
  }
}

type SupportTicketHubHandlers = {
  onNewMessage?: (message: SupportTicketMessage) => void;
  onTicketCreated?: (ticket: TicketCreatedEvent) => void;
  onTicketUpdated?: (event: TicketUpdatedEvent) => void;
  onTicketReply?: (event: TicketReplyEvent) => void;
  onTicketStatusChanged?: (event: TicketStatusChangedEvent) => void;
  onTicketClosed?: (event: TicketClosedEvent) => void;
};

export function useSupportTicketHub(
  handlers: SupportTicketHubHandlers,
  options?: {
    enabled?: boolean;
    ticketId?: number | null;
  }
) {
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const handlersRef = useRef(handlers);
  const currentTicketIdRef = useRef<number | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (options?.enabled === false) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
    if (!apiBaseUrl) {
      console.error("[useSupportTicketHub] Missing API_BASE_URL");
      return;
    }

    let token: string | null = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token");
    }

    const connection = createSupportTicketConnection(apiBaseUrl, token, {
      allowGuest: false,
    });

    if (!connection) return;

    connectionRef.current = connection;

    connection.on("NewMessage", (message: SupportTicketMessage) => {
      handlersRef.current.onNewMessage?.(message);
    });

    connection.on("TicketCreated", (ticket: TicketCreatedEvent) => {
      handlersRef.current.onTicketCreated?.(ticket);
    });

    connection.on("TicketUpdated", (event: TicketUpdatedEvent) => {
      handlersRef.current.onTicketUpdated?.(event);
    });

    connection.on("TicketReply", (event: TicketReplyEvent) => {
      handlersRef.current.onTicketReply?.(event);
    });

    connection.on("TicketStatusChanged", (event: TicketStatusChangedEvent) => {
      handlersRef.current.onTicketStatusChanged?.(event);
    });

    connection.on("TicketClosed", (event: TicketClosedEvent) => {
      handlersRef.current.onTicketClosed?.(event);
    });

    startConnection(connection)
      .then(() => {
        setIsConnected(true);
        if (options?.ticketId) {
          currentTicketIdRef.current = options.ticketId;
          joinTicketRoom(connection, options.ticketId);
        }
      })
      .catch((err) => {
        console.error("[useSupportTicketHub] Failed to connect:", err);
        setIsConnected(false);
      });

    return () => {
      if (currentTicketIdRef.current && connection) {
        leaveTicketRoom(connection, currentTicketIdRef.current);
      }
      stopConnection(connection);
      setIsConnected(false);
    };
  }, [options?.enabled]);

  useEffect(() => {
    const connection = connectionRef.current;
    if (!connection || !isConnected) return;

    const newTicketId = options?.ticketId;
    const oldTicketId = currentTicketIdRef.current;

    if (oldTicketId === newTicketId) return;

    if (oldTicketId !== null) {
      leaveTicketRoom(connection, oldTicketId);
    }

    if (newTicketId !== null && newTicketId !== undefined) {
      joinTicketRoom(connection, newTicketId);
    }

    currentTicketIdRef.current = newTicketId ?? null;
  }, [options?.ticketId, isConnected]);

  return {
    connection: connectionRef.current,
    isConnected,
  };
}

