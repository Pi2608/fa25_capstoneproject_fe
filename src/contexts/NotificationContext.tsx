"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from "react";
import * as signalR from "@microsoft/signalr";
import { 
  createNotificationConnection, 
  startNotificationConnection as startConnection, 
  stopNotificationConnection as stopConnection 
} from "@/lib/hubs/notifications";
import { NotificationItem } from "@/lib/api-user";
import { useAuth } from "@/contexts/AuthContext";
import { getUnreadNotificationCount } from "@/lib/api-user";

interface NotificationContextType {
  unreadCount: number;
  isConnected: boolean;
  latestNotification: NotificationItem | null;
  onNotificationReceived: (callback: (notification: NotificationItem) => void) => void;
  onUnreadCountUpdated: (callback: (count: number) => void) => void;
  offNotificationReceived: (callback: (notification: NotificationItem) => void) => void;
  offUnreadCountUpdated: (callback: (count: number) => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const notificationCallbacksRef = useRef<Set<(notification: NotificationItem) => void>>(new Set());
  const unreadCountCallbacksRef = useRef<Set<(count: number) => void>>(new Set());
  const isConnectingRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!isLoggedIn || !token) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [isLoggedIn, token]);

  const cleanupConnection = useCallback(async () => {
    if (connectionRef.current) {
      try {
        connectionRef.current.off("NotificationReceived");
        connectionRef.current.off("UnreadCountUpdated");
        await stopConnection(connectionRef.current);
      } catch (error) {
        console.error("Error cleaning up connection:", error);
      }
      connectionRef.current = null;
      setIsConnected(false);
    }
    isConnectingRef.current = false;
    tokenRef.current = null;
  }, []);

  const setupConnection = useCallback(async () => {
    const currentToken = token?.trim() || null;

    if (!isLoggedIn || !currentToken) {
      await cleanupConnection();
      setUnreadCount(0);
      setLatestNotification(null);
      return;
    }

    // Check if already connecting
    if (isConnectingRef.current) {
      return;
    }

    // Check if we need to cleanup existing connection
    const hasExistingConnection = connectionRef.current !== null && connectionRef.current !== undefined;
    
    if (hasExistingConnection) {
      const existingState = connectionRef.current!.state;
      const hasSameToken = tokenRef.current === currentToken;
    
      
      // If already connected with same token, skip
      if (hasSameToken && existingState === signalR.HubConnectionState.Connected) {
        setIsConnected(true);
        return;
      }
      
      // If token changed or connection is in a bad state, cleanup
      if (!hasSameToken || existingState !== signalR.HubConnectionState.Disconnected) {
        await cleanupConnection();
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } else {
    }

    isConnectingRef.current = true;
    tokenRef.current = currentToken;

    try {
      const conn = createNotificationConnection(currentToken);
      if (!conn) {
        isConnectingRef.current = false;
        tokenRef.current = null;
        return;
      }

      connectionRef.current = conn;

      conn.on("NotificationReceived", (notification: NotificationItem) => {
        setLatestNotification(notification);
        notificationCallbacksRef.current.forEach((callback) => {
          try {
            callback(notification);
          } catch (error) {
            console.error("Error in notification callback:", error);
          }
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("notification-received", { detail: { notification } })
          );
        }
      });

      conn.on("UnreadCountUpdated", (count: number) => {
        setUnreadCount(count);
        unreadCountCallbacksRef.current.forEach((callback) => {
          try {
            callback(count);
          } catch (error) {
            console.error("Error in unread count callback:", error);
          }
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("notifications-changed", { detail: { unreadCount: count } })
          );
        }
      });

      // Handle connection state changes
      conn.onreconnecting(() => {
        setIsConnected(false);
      });

      conn.onreconnected((connectionId) => {
        setIsConnected(true);
        loadUnreadCount();
      });

      conn.onclose((error) => {
        setIsConnected(false);
        if (tokenRef.current !== currentToken) {
          connectionRef.current = null;
        }
      });

      const success = await startConnection(conn, currentToken);
      const currentState = conn.state;
      
      isConnectingRef.current = false;
      
      // Update connection state based on actual state
      const isActuallyConnected = currentState === signalR.HubConnectionState.Connected;
      setIsConnected(isActuallyConnected);
      
      if (isActuallyConnected) {
        await loadUnreadCount();
      } else {
        // If start() returned success but state is not Connected, it might still be connecting
        // Wait a bit and check again
        if (success && currentState === signalR.HubConnectionState.Connecting) {
          setTimeout(async () => {
            const delayedState = conn.state;
            if (delayedState === signalR.HubConnectionState.Connected) {
              setIsConnected(true);
              await loadUnreadCount();
            } else {
              setIsConnected(false);
            }
          }, 2000);
        } else {
          tokenRef.current = null;
          await cleanupConnection();
        }
      }
    } catch (error) {
      if (error instanceof Error) {
      }
      isConnectingRef.current = false;
      tokenRef.current = null;
      await cleanupConnection();
    }
  }, [isLoggedIn, token, cleanupConnection, loadUnreadCount]);

  useEffect(() => {
    if (isLoggedIn && token) {
      loadUnreadCount();
    }
  }, [isLoggedIn, token, loadUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      cleanupConnection();
      return;
    }

    const timer = setTimeout(() => {
      setupConnection();
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoggedIn, token, setupConnection]);

  const onNotificationReceived = useCallback((callback: (notification: NotificationItem) => void) => {
    notificationCallbacksRef.current.add(callback);
  }, []);

  const onUnreadCountUpdated = useCallback((callback: (count: number) => void) => {
    unreadCountCallbacksRef.current.add(callback);
  }, []);

  const offNotificationReceived = useCallback((callback: (notification: NotificationItem) => void) => {
    notificationCallbacksRef.current.delete(callback);
  }, []);

  const offUnreadCountUpdated = useCallback((callback: (count: number) => void) => {
    unreadCountCallbacksRef.current.delete(callback);
  }, []);

  const contextValue = useMemo(
    () => ({
      unreadCount,
      isConnected,
      latestNotification,
      onNotificationReceived,
      onUnreadCountUpdated,
      offNotificationReceived,
      offUnreadCountUpdated,
    }),
    [unreadCount, isConnected, latestNotification, onNotificationReceived, onUnreadCountUpdated, offNotificationReceived, offUnreadCountUpdated]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}