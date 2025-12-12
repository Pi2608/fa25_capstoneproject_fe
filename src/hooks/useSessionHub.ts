import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import {
  createSessionConnection,
  startSessionConnection,
  stopSessionConnection,
  leaveSessionConnection,
  registerSessionEventHandlers,
  unregisterSessionEventHandlers,
  SessionEventHandlers,
} from "@/lib/hubs/session";
import { getToken } from "@/lib/api-core";

interface UseSessionHubOptions {
  sessionId: string;
  enabled?: boolean;
  token?: string;
  handlers: SessionEventHandlers;
}

interface UseSessionHubReturn {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => Promise<void>;
}

/**
 * Custom hook for managing SignalR session hub connection
 * Automatically connects, handles reconnection, and cleans up on unmount
 */
export function useSessionHub(
  options: UseSessionHubOptions
): UseSessionHubReturn {
  const { sessionId, enabled = true, token, handlers } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const handlersRef = useRef<SessionEventHandlers>(handlers);

  const stableHandlersRef = useRef<SessionEventHandlers>({
    onJoinedSession: (event) => handlersRef.current.onJoinedSession?.(event),
    onSessionStatusChanged: (event) =>
      handlersRef.current.onSessionStatusChanged?.(event),
    onParticipantJoined: (event) =>
      handlersRef.current.onParticipantJoined?.(event),
    onParticipantLeft: (event) => handlersRef.current.onParticipantLeft?.(event),
    onQuestionActivated: (event) =>
      handlersRef.current.onQuestionActivated?.(event),
    onQuestionTimeExtended: (event) =>
      handlersRef.current.onQuestionTimeExtended?.(event),
    onQuestionSkipped: (event) => handlersRef.current.onQuestionSkipped?.(event),
    onResponseReceived: (event) => handlersRef.current.onResponseReceived?.(event),
    onLeaderboardUpdated: (event) =>
      handlersRef.current.onLeaderboardUpdated?.(event),
    onTeacherFocusChanged: (event) =>
      handlersRef.current.onTeacherFocusChanged?.(event),
    onSessionEnded: (event) => handlersRef.current.onSessionEnded?.(event),
    onSegmentSync: (event) => handlersRef.current.onSegmentSync?.(event),
    onMapLayerSync: (event) => handlersRef.current.onMapLayerSync?.(event),
    onQuestionBroadcast: (event) => handlersRef.current.onQuestionBroadcast?.(event),
    onQuestionResults: (event) => handlersRef.current.onQuestionResults?.(event),
    onError: (event) => handlersRef.current.onError?.(event),
  });

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(async () => {
    if (!enabled || !sessionId) {
      return;
    }

    // If already connected, do nothing
    if (
      connectionRef.current &&
      connectionRef.current.state === signalR.HubConnectionState.Connected
    ) {
      setIsConnected(true);
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Create new connection if doesn't exist
      if (!connectionRef.current) {
        const authToken = token || getToken();
        connectionRef.current = createSessionConnection(
          sessionId,
          authToken || undefined
        );

        if (!connectionRef.current) {
          throw new Error("Failed to create SignalR connection");
        }

        // Register event handlers
        registerSessionEventHandlers(
          connectionRef.current,
          stableHandlersRef.current
        );

        // Handle state changes
        connectionRef.current.onreconnecting(() => {
          setIsConnected(false);
          setIsConnecting(true);
        });

        connectionRef.current.onreconnected(() => {
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
        });

        connectionRef.current.onclose((err) => {
          setIsConnected(false);
          setIsConnecting(false);
          if (err) {
            setError(err.message || "Connection closed unexpectedly");
          }
        });
      }

      // Start connection and join session
      const success = await startSessionConnection(
        connectionRef.current,
        sessionId
      );

      if (success) {
        setIsConnected(true);
        setError(null);
      } else {
        setError("Failed to connect to session hub");
      }
    } catch (err) {
      console.error("[useSessionHub] Connection error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect to session hub"
      );
    } finally {
      setIsConnecting(false);
    }
  }, [enabled, sessionId, token]);

  const reconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await stopSessionConnection(connectionRef.current);
        connectionRef.current = null;
      } catch (err) {
        console.error("[useSessionHub] Error stopping connection:", err);
      }
    }
    await connect();
  }, [connect]);

  // Connect on mount or when sessionId/enabled changes
  useEffect(() => {
    if (enabled && sessionId) {
      connect();
    }

    return () => {
      // Cleanup on unmount or when sessionId changes
      if (connectionRef.current) {
        const conn = connectionRef.current;
        (async () => {
          try {
            await leaveSessionConnection(conn, sessionId);
            unregisterSessionEventHandlers(conn);
            await stopSessionConnection(conn);
          } catch (err) {
            console.error("[useSessionHub] Cleanup error:", err);
          }
        })();
        connectionRef.current = null;
      }
    };
  }, [sessionId, enabled, connect]);

  return {
    connection: connectionRef.current,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}

