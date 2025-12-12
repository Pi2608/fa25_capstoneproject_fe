import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";


// ===================== STORY SIGNALR TYPES =====================

export interface StoryUpdateEvent {
  storyId: string;
  mapId: string;
  segmentId?: string;
  updateType: "segment-changed" | "story-updated" | "story-deleted";
  timestamp: string;
}

export interface StoryCollaborationEvent {
  storyId: string;
  userId: string;
  userName: string;
  action: "editing" | "viewing" | "idle";
  segmentId?: string;
}

// ===================== CONNECTION SETUP =====================

/**
 * Create SignalR connection for story hub
 * This hub handles real-time story map collaboration and updates
 */
export function createStoryConnection(
  storyId?: string,
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR Story] Missing API_BASE_URL");
    return null;
  }

  const authToken = token || getToken();

  // Story hub does NOT require authorization (per backend config)
  if (authToken && !isTokenValid(authToken)) {
    console.error("[SignalR Story] Invalid token");
    return null;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/story`;

  return createBaseConnection(hubUrl, {
    token: authToken || undefined,
    allowGuest: true, // Story hub allows guest connections (no authorization required)
    onClose: (error) => {
      console.error("[SignalR Story] Connection closed with error:", error);
    },
    onReconnecting: (error) => {
      console.warn("[SignalR Story] Reconnecting...", error);
    },
    onReconnected: (connectionId) => {
      console.info("[SignalR Story] Reconnected:", connectionId);
    },
  });
}

export async function startStoryConnection(
  connection: signalR.HubConnection,
  storyId?: string
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[SignalR Story] Connection not in disconnected state:",
        connection.state
      );
      return false;
    }

    await connection.start();
    console.info("[SignalR Story] Connected successfully");

    // Join the story group on the server if storyId is provided
    if (storyId) {
      try {
        await connection.invoke("JoinStory", storyId);
      } catch (invokeError) {
        console.error(
          "[SignalR Story] Failed to join story group:",
          invokeError
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[SignalR Story] Failed to start connection:", error);
    return false;
  }
}

export async function leaveStoryConnection(
  connection: signalR.HubConnection,
  storyId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveStory", storyId);
    }
  } catch (error) {
    console.error("[SignalR Story] Failed to leave story group:", error);
  }
}

export async function stopStoryConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("[SignalR Story] Failed to stop connection:", error);
  }
}

// ===================== EVENT HANDLERS SETUP =====================

export interface StoryEventHandlers {
  onStoryUpdate?: (event: StoryUpdateEvent) => void;
  onCollaborationChange?: (event: StoryCollaborationEvent) => void;
}

export function registerStoryEventHandlers(
  connection: signalR.HubConnection,
  handlers: StoryEventHandlers
): void {
  if (handlers.onStoryUpdate) {
    connection.on("StoryUpdate", handlers.onStoryUpdate);
  }

  if (handlers.onCollaborationChange) {
    connection.on("CollaborationChange", handlers.onCollaborationChange);
  }
}

export function unregisterStoryEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("StoryUpdate");
  connection.off("CollaborationChange");
}

