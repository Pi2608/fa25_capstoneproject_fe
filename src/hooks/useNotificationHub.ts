import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { 
  createNotificationConnection, 
  startNotificationConnection as startConnection, 
  stopNotificationConnection as stopConnection 
} from "@/lib/hubs/notifications";
import { NotificationItem } from "@/lib/api-user";
import { getToken } from "@/lib/api-core";

export interface UseNotificationHubReturn {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  onNotificationReceived: (callback: (notification: NotificationItem) => void) => void;
  onUnreadCountUpdated: (callback: (count: number) => void) => void;
  offNotificationReceived: (callback: (notification: NotificationItem) => void) => void;
  offUnreadCountUpdated: (callback: (count: number) => void) => void;
}

/**
 * Hook to manage SignalR connection for notifications
 */
export function useNotificationHub(): UseNotificationHubReturn {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const notificationCallbacksRef = useRef<Set<(notification: NotificationItem) => void>>(new Set());
  const unreadCountCallbacksRef = useRef<Set<(count: number) => void>>(new Set());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }

    const conn = createNotificationConnection(token);
    if (!conn) {
      return;
    }

    connectionRef.current = conn;
    setConnection(conn);

    conn.on("NotificationReceived", (notification: NotificationItem) => {
      notificationCallbacksRef.current.forEach((callback) => {
        try {
          callback(notification);
        } catch (error) {
          console.error("Error in notification callback:", error);
        }
      });
    });

    conn.on("UnreadCountUpdated", (count: number) => {
      unreadCountCallbacksRef.current.forEach((callback) => {
        try {
          callback(count);
        } catch (error) {
          console.error("Error in unread count callback:", error);
        }
      });
    });

    conn.onreconnecting(() => {
      setIsConnected(false);
    });

    conn.onreconnected(() => {
      setIsConnected(true);
    });

    conn.onclose(() => {
      setIsConnected(false);
    });

    startConnection(conn, token).then((success) => {
      setIsConnected(success);
    });

    return () => {
      if (connectionRef.current) {
        connectionRef.current.off("NotificationReceived");
        connectionRef.current.off("UnreadCountUpdated");
        stopConnection(connectionRef.current);
        connectionRef.current = null;
        setConnection(null);
        setIsConnected(false);
      }
    };
  }, []);

  const onNotificationReceived = (callback: (notification: NotificationItem) => void) => {
    notificationCallbacksRef.current.add(callback);
  };

  const onUnreadCountUpdated = (callback: (count: number) => void) => {
    unreadCountCallbacksRef.current.add(callback);
  };

  const offNotificationReceived = (callback: (notification: NotificationItem) => void) => {
    notificationCallbacksRef.current.delete(callback);
  };

  const offUnreadCountUpdated = (callback: (count: number) => void) => {
    unreadCountCallbacksRef.current.delete(callback);
  };

  return {
    connection,
    isConnected,
    onNotificationReceived,
    onUnreadCountUpdated,
    offNotificationReceived,
    offUnreadCountUpdated,
  };
}

