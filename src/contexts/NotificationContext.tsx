"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from "react";
import * as signalR from "@microsoft/signalr";
import { createNotificationConnection, startConnection, stopConnection } from "@/lib/signalr";
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

    console.log("[SignalR] setupConnection called", {
      isLoggedIn,
      hasToken: !!currentToken,
      currentState: connectionRef.current?.state,
      isConnecting: isConnectingRef.current,
    });

    if (!isLoggedIn || !currentToken) {
      console.log("[SignalR] No token or not logged in, cleaning up");
      await cleanupConnection();
      setUnreadCount(0);
      setLatestNotification(null);
      return;
    }

    // Check if already connecting
    if (isConnectingRef.current) {
      console.log("[SignalR] Connection already in progress, skipping");
      return;
    }

    // Check if we need to cleanup existing connection
    const hasExistingConnection = connectionRef.current !== null && connectionRef.current !== undefined;
    console.log("[SignalR] Has existing connection:", hasExistingConnection);
    
    if (hasExistingConnection) {
      const existingState = connectionRef.current!.state;
      const hasSameToken = tokenRef.current === currentToken;
      
      console.log("[SignalR] Existing connection details:", {
        state: existingState,
        hasSameToken,
        currentTokenStored: !!tokenRef.current,
      });
      
      // If already connected with same token, skip
      if (hasSameToken && existingState === signalR.HubConnectionState.Connected) {
        console.log("[SignalR] Already connected with same token, skipping setup");
        setIsConnected(true);
        return;
      }
      
      // If token changed or connection is in a bad state, cleanup
      if (!hasSameToken || existingState !== signalR.HubConnectionState.Disconnected) {
        console.log("[SignalR] Cleaning up existing connection (token changed or not disconnected)");
        await cleanupConnection();
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } else {
      console.log("[SignalR] No existing connection, will create new one");
    }

    console.log("[SignalR] Setting up new connection");
    isConnectingRef.current = true;
    tokenRef.current = currentToken;

    try {
      const conn = createNotificationConnection(currentToken);
      if (!conn) {
        console.error("[SignalR] Failed to create connection");
        isConnectingRef.current = false;
        tokenRef.current = null;
        return;
      }

      console.log("[SignalR] Connection created successfully");
      connectionRef.current = conn;

      conn.on("NotificationReceived", (notification: NotificationItem) => {
        console.log("[SignalR] Notification received:", notification);
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
        console.log("[SignalR] Unread count updated:", count);
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
        console.log("[SignalR] Reconnecting...");
        setIsConnected(false);
      });

      conn.onreconnected((connectionId) => {
        console.log("[SignalR] Reconnected successfully, connectionId:", connectionId);
        setIsConnected(true);
        loadUnreadCount();
      });

      conn.onclose((error) => {
        console.log("[SignalR] Connection closed", error ? `with error: ${error?.message || String(error)}` : "normally");
        setIsConnected(false);
        if (tokenRef.current !== currentToken) {
          connectionRef.current = null;
        }
      });

      console.log("[SignalR] Starting connection...");
      const success = await startConnection(conn, currentToken);
      const currentState = conn.state;
      console.log("[SignalR] Connection start result:", success, "State:", currentState);
      
      isConnectingRef.current = false;
      
      // Update connection state based on actual state
      const isActuallyConnected = currentState === signalR.HubConnectionState.Connected;
      setIsConnected(isActuallyConnected);
      
      if (isActuallyConnected) {
        console.log("[SignalR] Connection established successfully, loading unread count...");
        await loadUnreadCount();
      } else {
        console.error("[SignalR] Failed to establish connection, state:", currentState);
        // If start() returned success but state is not Connected, it might still be connecting
        // Wait a bit and check again
        if (success && currentState === signalR.HubConnectionState.Connecting) {
          console.log("[SignalR] Connection is still connecting, waiting...");
          setTimeout(async () => {
            const delayedState = conn.state;
            console.log("[SignalR] Delayed state check:", delayedState);
            if (delayedState === signalR.HubConnectionState.Connected) {
              setIsConnected(true);
              await loadUnreadCount();
            } else {
              console.error("[SignalR] Connection failed after waiting, state:", delayedState);
              setIsConnected(false);
            }
          }, 2000);
        } else {
          tokenRef.current = null;
          await cleanupConnection();
        }
      }
    } catch (error) {
      console.error("[SignalR] Failed to setup SignalR connection:", error);
      if (error instanceof Error) {
        console.error("[SignalR] Error details:", {
          message: error.message,
          stack: error.stack,
        });
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