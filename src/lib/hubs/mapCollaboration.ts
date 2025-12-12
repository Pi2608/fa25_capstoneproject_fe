import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";


// ===================== MAP COLLABORATION TYPES =====================

export interface MapCollaborationEvent {
  mapId: string;
  userId: string;
  userName: string;
  action: "editing" | "viewing" | "idle";
  layerId?: string;
  featureId?: string;
}

export interface MapUpdateEvent {
  mapId: string;
  updateType: "layer-added" | "layer-removed" | "layer-updated" | "feature-updated" | "map-updated";
  layerId?: string;
  featureId?: string;
  timestamp: string;
  updatedBy: string;
}

// ===================== CONNECTION SETUP =====================

/**
 * Create SignalR connection for map collaboration hub
 * This hub handles real-time map editing collaboration
 */
export function createMapCollaborationConnection(
  mapId?: string,
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR MapCollaboration] Missing API_BASE_URL");
    return null;
  }

  const authToken = token || getToken();

  if (!authToken || !authToken.trim()) {
    console.error("[SignalR MapCollaboration] No token provided");
    return null;
  }

  if (!isTokenValid(authToken)) {
    console.error("[SignalR MapCollaboration] Invalid token");
    return null;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/mapCollaboration`;

  return createBaseConnection(hubUrl, {
    token: authToken,
    allowGuest: false, // Map collaboration requires authentication
    onClose: (error) => {
      console.error("[SignalR MapCollaboration] Connection closed with error:", error);
    },
    onReconnecting: (error) => {
      console.warn("[SignalR MapCollaboration] Reconnecting...", error);
    },
    onReconnected: (connectionId) => {
      console.info("[SignalR MapCollaboration] Reconnected:", connectionId);
    },
  });
}

export async function startMapCollaborationConnection(
  connection: signalR.HubConnection,
  mapId?: string
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[SignalR MapCollaboration] Connection not in disconnected state:",
        connection.state
      );
      return false;
    }

    await connection.start();

    if (mapId) {
      try {
        await connection.invoke("JoinMap", mapId);
      } catch (invokeError) {
        console.error(
          "[SignalR MapCollaboration] Failed to join map group:",
          invokeError
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[SignalR MapCollaboration] Failed to start connection:", error);
    return false;
  }
}

export async function leaveMapCollaborationConnection(
  connection: signalR.HubConnection,
  mapId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveMap", mapId);
    }
  } catch (error) {
    console.error("[SignalR MapCollaboration] Failed to leave map group:", error);
  }
}

export async function stopMapCollaborationConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("[SignalR MapCollaboration] Failed to stop connection:", error);
  }
}

// ===================== EVENT HANDLERS SETUP =====================

export interface MapCollaborationEventHandlers {
  onCollaborationChange?: (event: MapCollaborationEvent) => void;
  onMapUpdate?: (event: MapUpdateEvent) => void;
}

export function registerMapCollaborationEventHandlers(
  connection: signalR.HubConnection,
  handlers: MapCollaborationEventHandlers
): void {
  if (handlers.onCollaborationChange) {
    connection.on("CollaborationChange", handlers.onCollaborationChange);
  }

  if (handlers.onMapUpdate) {
    connection.on("MapUpdate", handlers.onMapUpdate);
  }
}

export function unregisterMapCollaborationEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("CollaborationChange");
  connection.off("MapUpdate");
}

