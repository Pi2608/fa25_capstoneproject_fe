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

function isBenignSignalRError(err: unknown) {
  const msg =
    typeof err === "object" && err && "message" in err
      ? String((err as any).message)
      : String(err);

  return (
    msg.includes(
      "Invocation canceled due to the underlying connection being closed"
    ) ||
    msg.includes("The connection was stopped during negotiation") ||
    msg.includes("Failed to complete negotiation") ||
    msg.includes(
      "Cannot send data if the connection is not in the 'Connected' State"
    )
  );
}

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

  // ✅ Không có token + không cho guest => khỏi tạo connection luôn
  if (!token && !options?.allowGuest) {
    return null;
  }

  const url = `${apiBaseUrl}/hubs/support-tickets`;
  const builder = new signalR.HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => {
        if (!token) return "";
        if (token.startsWith("Bearer ")) return token.substring(7);
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
    if (connection.state === signalR.HubConnectionState.Connected) return;

    // Chỉ start khi Disconnected
    if (connection.state !== signalR.HubConnectionState.Disconnected) return;

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
    // ✅ lỗi cancel khi đang stop là bình thường
    if (!isBenignSignalRError(error)) {
      console.error(
        "[SignalR SupportTicket] Failed to join ticket room:",
        error
      );
    }
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
    // ✅ lỗi cancel khi đang stop là bình thường
    if (!isBenignSignalRError(error)) {
      console.error(
        "[SignalR SupportTicket] Failed to leave ticket room:",
        error
      );
    }
  }
}

export async function stopConnection(
  connection: signalR.HubConnection
): Promise<void> {
  // ✅ Stop an toàn
  if (
    connection.state === signalR.HubConnectionState.Disconnected ||
    connection.state === signalR.HubConnectionState.Disconnecting
  ) {
    return;
  }

  try {
    await connection.stop();
  } catch (error) {
    // ✅ lỗi “Invocation canceled…” là expected khi stop/unmount
    if (!isBenignSignalRError(error)) {
      console.error("[SignalR SupportTicket] Failed to stop connection:", error);
    }
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

    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const connection = createSupportTicketConnection(apiBaseUrl, token, {
      allowGuest: false,
    });

    // ✅ Không có token => không connect => không có stop error
    if (!connection) {
      setIsConnected(false);
      return;
    }

    connectionRef.current = connection;

    connection.onclose(() => {
      setIsConnected(false);
    });

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
      .then(async () => {
        setIsConnected(true);

        if (options?.ticketId) {
          currentTicketIdRef.current = options.ticketId;
          await joinTicketRoom(connection, options.ticketId);
        }
      })
      .catch((err) => {
        console.error("[useSupportTicketHub] Failed to connect:", err);
        setIsConnected(false);
      });

    return () => {
      // ✅ cleanup phải await Leave trước rồi mới Stop
      void (async () => {
        const tid = currentTicketIdRef.current;

        if (tid && connection) {
          await leaveTicketRoom(connection, tid);
        }

        await stopConnection(connection);
        setIsConnected(false);
      })();
    };
  }, [options?.enabled]);

  useEffect(() => {
    const connection = connectionRef.current;
    if (!connection || !isConnected) return;

    const newTicketId = options?.ticketId ?? null;
    const oldTicketId = currentTicketIdRef.current;

    if (oldTicketId === newTicketId) return;

    void (async () => {
      if (oldTicketId !== null) {
        await leaveTicketRoom(connection, oldTicketId);
      }

      if (newTicketId !== null) {
        await joinTicketRoom(connection, newTicketId);
      }

      currentTicketIdRef.current = newTicketId;
    })();
  }, [options?.ticketId, isConnected]);

  return {
    connection: connectionRef.current,
    isConnected,
  };
}
