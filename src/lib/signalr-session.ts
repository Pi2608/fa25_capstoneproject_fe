import * as signalR from "@microsoft/signalr";
import { getToken } from "./api-core";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ===================== SESSION SIGNALR TYPES =====================

export interface SessionStatusChangedEvent {
  sessionId: string;
  status: "Pending" | "Running" | "Paused" | "Ended";
  timestamp: string;
}

export interface ParticipantJoinedEvent {
  sessionId: string;
  participantId: string;
  displayName: string;
  totalParticipants: number;
}

export interface ParticipantLeftEvent {
  sessionId: string;
  participantId: string;
  displayName: string;
  totalParticipants: number;
}

export interface QuestionActivatedEvent {
  sessionId: string;
  sessionQuestionId: string;
  questionId: string;
  questionType: string;
  questionText: string;
  questionImageUrl?: string | null;
  questionAudioUrl?: string | null;
  options?: Array<{
    id: string;
    optionText: string;
    optionImageUrl?: string | null;
    displayOrder: number;
  }>;
  points: number;
  timeLimit: number;
  hintText?: string | null;
  correctLatitude?: number | null;
  correctLongitude?: number | null;
  acceptanceRadiusMeters?: number | null;
  activatedAt: string;
}

// Backend sends TimeExtendedEvent
export interface QuestionTimeExtendedEvent {
  sessionId: string;
  sessionQuestionId: string;
  additionalSeconds?: number;
  newEndTime?: string;
  extendedBy?: number; // Backend might use this field
}

export interface QuestionSkippedEvent {
  sessionId: string;
  sessionQuestionId: string;
  skippedAt: string;
}

// Backend sends ResponseSubmittedEvent, mapping to our interface
export interface ResponseReceivedEvent {
  sessionId: string;
  sessionQuestionId: string;
  participantId: string; // Backend uses SessionParticipantId
  displayName?: string;
  totalResponses?: number;
  totalParticipants?: number;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  score: number;
  rank: number;
}

// Backend sends LeaderboardUpdateEvent
export interface LeaderboardUpdatedEvent {
  sessionId: string;
  leaderboard: LeaderboardEntry[];
  updatedAt?: string;
}

export interface TeacherFocusChangedEvent {
  sessionId: string;
  latitude: number;
  longitude: number;
  zoom: number;
  timestamp: string;
}

// Backend event is "MapStateSync", mapping to our interface
export interface MapStateSyncEvent {
  sessionId: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  bearing?: number;
  pitch?: number;
  syncedBy?: string;
  syncedAt?: string;
}

export interface SessionEndedEvent {
  sessionId: string;
  endedAt: string;
  finalLeaderboard: LeaderboardEntry[];
}

// ===================== CONNECTION SETUP =====================

function isTokenValid(token: string): boolean {
  if (!token || token.trim().length === 0) {
    return false;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const exp = payload.exp;

    if (!exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return exp > now;
  } catch {
    return false;
  }
}

/**
 * Create SignalR connection for session hub
 * This hub handles real-time session events (questions, responses, leaderboard, etc.)
 */
export function createSessionConnection(
  sessionId: string,
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR Session] Missing API_BASE_URL");
    return null;
  }

  const authToken = token || getToken();

  // Guest users (no token) can connect to session hub
  // Teachers/logged-in users need valid token
  if (authToken && !isTokenValid(authToken)) {
    console.error("[SignalR Session] Invalid token");
    return null;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/sessions`;

  const connectionBuilder = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: async () => {
        if (!authToken) {
          // Guest mode - no token
          return "";
        }
        const currentToken = getToken();
        if (!currentToken) {
          return authToken; // Fallback to provided token
        }
        if (!isTokenValid(currentToken)) {
          throw new Error("Token is invalid or expired");
        }
        return currentToken;
      },
      withCredentials: true,
      skipNegotiation: false,
      transport:
        signalR.HttpTransportType.WebSockets |
        signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        if (retryContext.previousRetryCount === 0) return 0;
        if (retryContext.previousRetryCount === 1) return 2000;
        if (retryContext.previousRetryCount === 2) return 10000;
        return 30000;
      },
    })
    .configureLogging(signalR.LogLevel.Information)
    .build();

  connectionBuilder.onclose((error) => {
    if (error) {
      console.error("[SignalR Session] Connection closed with error:", error);
    } else {
      console.log("[SignalR Session] Connection closed");
    }
  });

  connectionBuilder.onreconnecting((error) => {
    console.warn("[SignalR Session] Reconnecting...", error);
  });

  connectionBuilder.onreconnected((connectionId) => {
    console.log("[SignalR Session] Reconnected:", connectionId);
  });

  return connectionBuilder;
}

export async function startSessionConnection(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[SignalR Session] Connection not in disconnected state:",
        connection.state
      );
      return false;
    }

    await connection.start();
    console.log("[SignalR Session] Connected successfully");

    // Join the session group on the server
    try {
      await connection.invoke("JoinSession", sessionId);
      console.log(`[SignalR Session] Joined session group: ${sessionId}`);
    } catch (invokeError) {
      console.error(
        "[SignalR Session] Failed to join session group:",
        invokeError
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to start connection:", error);
    return false;
  }
}

export async function leaveSessionConnection(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveSession", sessionId);
      console.log(`[SignalR Session] Left session group: ${sessionId}`);
    }
  } catch (error) {
    console.error("[SignalR Session] Failed to leave session group:", error);
  }
}

export async function stopSessionConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
      console.log("[SignalR Session] Connection stopped");
    }
  } catch (error) {
    console.error("[SignalR Session] Failed to stop connection:", error);
  }
}

// ===================== EVENT HANDLERS SETUP =====================

export interface SessionEventHandlers {
  onSessionStatusChanged?: (event: SessionStatusChangedEvent) => void;
  onParticipantJoined?: (event: ParticipantJoinedEvent) => void;
  onParticipantLeft?: (event: ParticipantLeftEvent) => void;
  onQuestionActivated?: (event: QuestionActivatedEvent) => void;
  onQuestionTimeExtended?: (event: QuestionTimeExtendedEvent) => void;
  onQuestionSkipped?: (event: QuestionSkippedEvent) => void;
  onResponseReceived?: (event: ResponseReceivedEvent) => void;
  onLeaderboardUpdated?: (event: LeaderboardUpdatedEvent) => void;
  onTeacherFocusChanged?: (event: TeacherFocusChangedEvent) => void;
  onSessionEnded?: (event: SessionEndedEvent) => void;
}

export function registerSessionEventHandlers(
  connection: signalR.HubConnection,
  handlers: SessionEventHandlers
): void {
  if (handlers.onSessionStatusChanged) {
    connection.on("SessionStatusChanged", handlers.onSessionStatusChanged);
  }

  if (handlers.onParticipantJoined) {
    connection.on("ParticipantJoined", handlers.onParticipantJoined);
  }

  if (handlers.onParticipantLeft) {
    connection.on("ParticipantLeft", handlers.onParticipantLeft);
  }

  if (handlers.onQuestionActivated) {
    connection.on("QuestionActivated", handlers.onQuestionActivated);
  }

  if (handlers.onQuestionTimeExtended) {
    // Backend sends "TimeExtended" event
    connection.on("TimeExtended", handlers.onQuestionTimeExtended);
  }

  if (handlers.onQuestionSkipped) {
    connection.on("QuestionSkipped", handlers.onQuestionSkipped);
  }

  if (handlers.onResponseReceived) {
    // Backend sends "ResponseSubmitted" event
    connection.on("ResponseSubmitted", handlers.onResponseReceived);
  }

  if (handlers.onLeaderboardUpdated) {
    // Backend sends "LeaderboardUpdate" event
    connection.on("LeaderboardUpdate", handlers.onLeaderboardUpdated);
  }

  if (handlers.onTeacherFocusChanged) {
    // Backend sends "MapStateSync" event
    connection.on("MapStateSync", (event: MapStateSyncEvent) => {
      // Convert to TeacherFocusChangedEvent format
      const focusEvent: TeacherFocusChangedEvent = {
        sessionId: event.sessionId,
        latitude: event.latitude,
        longitude: event.longitude,
        zoom: event.zoomLevel,
        timestamp: event.syncedAt || new Date().toISOString(),
      };
      handlers.onTeacherFocusChanged!(focusEvent);
    });
  }

  if (handlers.onSessionEnded) {
    connection.on("SessionEnded", handlers.onSessionEnded);
  }

  console.log("[SignalR Session] Event handlers registered");
}

export function unregisterSessionEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("SessionStatusChanged");
  connection.off("ParticipantJoined");
  connection.off("ParticipantLeft");
  connection.off("QuestionActivated");
  connection.off("TimeExtended");
  connection.off("QuestionSkipped");
  connection.off("ResponseSubmitted");
  connection.off("LeaderboardUpdate");
  connection.off("MapStateSync");
  connection.off("TeacherFocusChanged");
  connection.off("MapStateSync"); // Backend event name
  connection.off("SessionEnded");

  console.log("[SignalR Session] Event handlers unregistered");
}

// ===================== TEACHER FOCUS (MAP SYNC) =====================

export interface MapStateSyncEvent {
  sessionId: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  bearing?: number;
  pitch?: number;
  syncedBy?: string;
  syncedAt?: string;
}

export interface MapStateSyncRequest {
  latitude: number;
  longitude: number;
  zoomLevel: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Send Teacher Focus (Map Sync) via SignalR Hub
 * This syncs the teacher's map view to all students
 */
export async function sendTeacherFocusViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  focus: MapStateSyncRequest
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for SyncMapState");
      return false;
    }

    await connection.invoke("SyncMapState", sessionId, {
      Latitude: focus.latitude,
      Longitude: focus.longitude,
      ZoomLevel: focus.zoomLevel,
      Bearing: focus.bearing ?? null,
      Pitch: focus.pitch ?? null,
    });

    console.log("[SignalR Session] Teacher Focus sent successfully");
    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to send Teacher Focus:", error);
    return false;
  }
}

