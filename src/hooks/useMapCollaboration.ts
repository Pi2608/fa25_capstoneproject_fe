"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { getToken } from "@/lib/api-core";
import { parseToken } from "@/utils/jwt";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Extract userId from current JWT token */
function getUserIdFromToken(): string | null {
  const token = getToken();
  if (!token) return null;
  const { userId } = parseToken(token);
  return userId;
}

export interface ActiveMapUser {
  userId: string;
  userName: string;
  userAvatar: string;
  highlightColor: string;
  joinedAt: string;
  lastActiveAt: string;
  isIdle: boolean;
  currentSelection: MapSelection | null;
}

export interface MapSelection {
  userId: string;
  userName: string;
  userAvatar: string;
  selectionType: string; // "Layer", "Point", "Line", "Polygon", "Marker"
  selectedObjectId: string | null;
  latitude: number | null;
  longitude: number | null;
  selectedAt: string;
  highlightColor: string;
}

interface UseMapCollaborationOptions {
  mapId: string | null;
  enabled?: boolean;
  userId?: string | null;
  onUserJoined?: (user: { userId: string; userName: string; joinedAt: string }) => void;
  onUserLeft?: (user: { userId: string; leftAt: string }) => void;
  onSelectionUpdated?: (selection: MapSelection) => void;
  onSelectionCleared?: (userId: string) => void;
  onInitialState?: (activeUsers: ActiveMapUser[]) => void;
  onError?: (error: string) => void;
  onMapDataChanged?: () => void; // Callback when map data (features/layers) should be reloaded
  onFeatureUpdated?: (featureId: string) => void; // Callback when a specific feature is updated
  onFeatureDeleted?: (featureId: string) => void; // Callback when a specific feature is deleted
  onFeatureCreated?: (featureId: string) => void; // Callback when a specific feature is created
  shouldIgnoreFeatureCreated?: (featureId: string) => boolean; // Check if FeatureCreated event should be ignored
}

export function useMapCollaboration({
  mapId,
  enabled = true,
  onUserJoined,
  onUserLeft,
  onSelectionUpdated,
  onSelectionCleared,
  onInitialState,
  onError,
  onMapDataChanged,
  onFeatureUpdated,
  onFeatureDeleted,
  onFeatureCreated,
  shouldIgnoreFeatureCreated,
  userId,
}: UseMapCollaborationOptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const userIdRef = useRef<string | null>(userId ?? null);

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveMapUser[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const currentMapIdRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid recreating connection
  const callbacksRef = useRef({
    onUserJoined,
    onUserLeft,
    onSelectionUpdated,
    onSelectionCleared,
    onInitialState,
    onError,
    onMapDataChanged,
    onFeatureUpdated,
    onFeatureDeleted,
    onFeatureCreated,
    shouldIgnoreFeatureCreated,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onUserJoined,
      onUserLeft,
      onSelectionUpdated,
      onSelectionCleared,
      onInitialState,
      onError,
      onMapDataChanged,
      onFeatureUpdated,
      onFeatureDeleted,
      onFeatureCreated,
      shouldIgnoreFeatureCreated,
    };
  }, [onUserJoined, onUserLeft, onSelectionUpdated, onSelectionCleared, onInitialState, onError, onMapDataChanged, onFeatureUpdated, onFeatureDeleted, onFeatureCreated, shouldIgnoreFeatureCreated]);

  const createConnection = useCallback((targetMapId: string): signalR.HubConnection | null => {
    if (!API_BASE_URL || !targetMapId) {
      return null;
    }

    const token = getToken();
    if (!token || token.trim().length === 0) {
      return null;
    }

    const baseUrl = API_BASE_URL.replace(/\/$/, "");
    const hubUrl = `${baseUrl}/hubs/mapCollaboration`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const currentToken = getToken();
          if (!currentToken) {
            throw new Error("No token available");
          }
          return currentToken;
        },
        withCredentials: true,
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Setup event handlers using refs
    connection.on("UserJoined", (data: { userId: string; userName: string; highlightColor?: string; joinedAt: string }) => {
      // Update activeUsers state when a new user joins
      setActiveUsers((prev) => {
        // Check if user already exists (avoid duplicates)
        if (prev.some((u) => u.userId === data.userId)) {
          return prev;
        }
        // Add new user to the list
        // Use highlight color from backend if provided, otherwise use default
        const newUser: ActiveMapUser = {
          userId: data.userId,
          userName: data.userName,
          userAvatar: "",
          highlightColor: data.highlightColor || "#FF5733", // Use backend color or default
          joinedAt: data.joinedAt,
          lastActiveAt: data.joinedAt,
          isIdle: false,
          currentSelection: null,
        };
        return [...prev, newUser];
      });
      callbacksRef.current.onUserJoined?.(data);
    });

    connection.on("UserLeft", (data: { userId: string; leftAt: string }) => {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      callbacksRef.current.onUserLeft?.(data);
    });

    connection.on("SelectionUpdated", (selection: MapSelection) => {
      setActiveUsers((prev) =>
        prev.map((user) =>
          user.userId === selection.userId
            ? { ...user, currentSelection: selection, lastActiveAt: new Date().toISOString() }
            : user
        )
      );
      callbacksRef.current.onSelectionUpdated?.(selection);
    });

    connection.on("SelectionCleared", (data: { userId: string; mapId: string }) => {
      setActiveUsers((prev) =>
        prev.map((user) =>
          user.userId === data.userId ? { ...user, currentSelection: null } : user
        )
      );
      callbacksRef.current.onSelectionCleared?.(data.userId);
    });

    connection.on("InitialState", (data: { activeUsers: ActiveMapUser[]; message: string }) => {
      setActiveUsers(data.activeUsers);
      callbacksRef.current.onInitialState?.(data.activeUsers);
    });

    connection.on("Error", (data: { message: string }) => {
      callbacksRef.current.onError?.(data.message);
    });

    // Listen for map data changes (features/layers updated)
    connection.on("FeatureCreated", (data: { mapId: string; featureId: string }) => {
      // Check if this feature was created by current user (should be ignored)
      if (callbacksRef.current.shouldIgnoreFeatureCreated?.(data.featureId)) {
        // Feature was created by current user, ignore the event
        return;
      }
      
      // Try to use specific callback first, fallback to full reload
      if (callbacksRef.current.onFeatureCreated) {
        callbacksRef.current.onFeatureCreated(data.featureId);
      } else {
        // New feature created by other user - need to reload to see it
        callbacksRef.current.onMapDataChanged?.();
      }
    });

    connection.on("FeatureUpdated", (data: { mapId: string; featureId: string }) => {
      // Try to update specific feature first, fallback to full reload
      if (callbacksRef.current.onFeatureUpdated) {
        callbacksRef.current.onFeatureUpdated(data.featureId);
      } else {
        callbacksRef.current.onMapDataChanged?.();
      }
    });

    connection.on("FeatureDeleted", (data: { mapId: string; featureId: string }) => {
      // Try to remove specific feature first, fallback to full reload
      if (callbacksRef.current.onFeatureDeleted) {
        callbacksRef.current.onFeatureDeleted(data.featureId);
      } else {
        callbacksRef.current.onMapDataChanged?.();
      }
    });

    connection.on("LayerUpdated", () => {
      // Layer updated - need to reload
      callbacksRef.current.onMapDataChanged?.();
    });

    connection.onreconnecting(() => {
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      setIsConnected(true);
      if (targetMapId) {
        const uid = userIdRef.current;
        if (uid) {
          connection.invoke("JoinMap", targetMapId, uid).catch((err) => {
            console.error("Failed to rejoin map after reconnect:", err);
          });
        } else {
          console.error("Map collaboration: userId not provided when rejoining after reconnect");
        }
      }
    });

    connection.onclose((error) => {
      setIsConnected(false);
      if (error) {
        console.error("Map collaboration connection closed with error:", error);
      }
    });

    return connection;
  }, []);

  const stopConnectionRef = useRef<() => Promise<void>>(async () => { return; });

  const stopConnection = useCallback(async () => {
    isConnectingRef.current = false;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (connectionRef.current) {
      try {
        const currentMapId = currentMapIdRef.current;
        const uid = userIdRef.current;
        if (currentMapId && uid) {
          await connectionRef.current.invoke("LeaveMap", currentMapId, uid);
        }
        await connectionRef.current.stop();
      } catch (error) {
        console.error("Error stopping connection:", error);
      }
      connectionRef.current = null;
      currentMapIdRef.current = null;
      setIsConnected(false);
      setActiveUsers([]);
    }
  }, []);

  stopConnectionRef.current = stopConnection;

  const updateSelection = useCallback(
    async (selection: {
      mapId: string;
      selectionType: string;
      selectedObjectId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
        try {
          const uid = userIdRef.current;
          if (uid) {
            await connectionRef.current.invoke("UpdateSelection", selection, uid);
          } else {
            console.error("Map collaboration: cannot UpdateSelection, userId not provided");
          }
        } catch (error) {
          console.error("Failed to update selection:", error);
        }
      }
    },
    []
  );

  const clearSelection = useCallback(
    async (mapId: string) => {
      if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
        try {
          const uid = userIdRef.current;
          if (uid) {
            await connectionRef.current.invoke("ClearSelection", { mapId }, uid);
          } else {
            console.error("Map collaboration: cannot ClearSelection, userId not provided");
          }
        } catch (error) {
          console.error("Failed to clear selection:", error);
        }
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;
    let cleanupCalled = false;

    const performStart = async () => {
      if (!isMounted || cleanupCalled) return;
      
      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current) {
        return;
      }

      // If already connected to the same map, skip
      if (
        connectionRef.current?.state === signalR.HubConnectionState.Connected &&
        currentMapIdRef.current === mapId
      ) {
        return;
      }

      if (!enabled || !mapId) {
        await stopConnectionRef.current?.();
        return;
      }

      isConnectingRef.current = true;

      try {
        // Cleanup existing connection if mapId changed
        if (connectionRef.current && currentMapIdRef.current !== mapId) {
          try {
            if (currentMapIdRef.current) {
              const uid = userIdRef.current;
              if (uid) {
                await connectionRef.current.invoke("LeaveMap", currentMapIdRef.current, uid);
              }
            }
            await connectionRef.current.stop();
          } catch (error) {
            console.error("Error stopping existing connection:", error);
          }
          connectionRef.current = null;
        }

        // If connection exists and is in a valid state, reuse it
        if (connectionRef.current) {
          const state = connectionRef.current.state;
          if (state === signalR.HubConnectionState.Disconnected) {
            // Connection exists but disconnected, try to start it
            try {
              await connectionRef.current.start();
              setIsConnected(true);
              const uid = userIdRef.current;
              if (uid) {
                await connectionRef.current.invoke("JoinMap", mapId, uid);
              } else {
                console.error("Map collaboration: userId not provided when joining map (existing connection)");
              }
              currentMapIdRef.current = mapId;
              isConnectingRef.current = false;
              return;
            } catch (error) {
              // If start fails, create new connection
              connectionRef.current = null;
            }
          } else if (state === signalR.HubConnectionState.Connected) {
            // Already connected, just join the new map
            const uid = userIdRef.current;
            if (uid) {
              await connectionRef.current.invoke("JoinMap", mapId, uid);
            } else {
              console.error("Map collaboration: userId not provided when joining map (already connected)");
            }
            currentMapIdRef.current = mapId;
            isConnectingRef.current = false;
            return;
          }
        }

        // Create new connection
        const connection = createConnection(mapId);
        if (!connection) {
          isConnectingRef.current = false;
          return;
        }

        await connection.start();
        connectionRef.current = connection;
        currentMapIdRef.current = mapId;
        setIsConnected(true);

        // Join the map with userId
        const uid = userIdRef.current;
        if (uid) {
          await connection.invoke("JoinMap", mapId, uid);
        } else {
          console.error("Map collaboration: userId not provided when joining map (new connection)");
        }

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (
            connectionRef.current?.state === signalR.HubConnectionState.Connected &&
            currentMapIdRef.current
          ) {
            const heartbeatUid = userIdRef.current;
            if (heartbeatUid) {
              connectionRef.current.invoke("SendHeartbeat", currentMapIdRef.current, heartbeatUid).catch((err) => {
                console.error("Heartbeat failed:", err);
              });
            } else {
              console.error("Map collaboration: cannot send heartbeat without userId");
            }
          }
        }, 30000); // Every 30 seconds
      } catch (error) {
        console.error("Failed to start map collaboration connection:", error);
        setIsConnected(false);
        callbacksRef.current.onError?.(error instanceof Error ? error.message : "Failed to connect");
        connectionRef.current = null;
        currentMapIdRef.current = null;
      } finally {
        isConnectingRef.current = false;
      }
    };

    // Only start if enabled and mapId is available
    if (enabled && mapId) {
      // Small delay to avoid rapid reconnections
      timer = setTimeout(() => {
        if (isMounted && !cleanupCalled) {
          performStart();
        }
      }, 200);
    } else {
      stopConnectionRef.current?.();
    }

    return () => {
      cleanupCalled = true;
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
      stopConnectionRef.current?.();
    };
  }, [enabled, mapId]);

  return {
    isConnected,
    activeUsers,
    updateSelection,
    clearSelection,
  };
}

