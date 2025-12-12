import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";


// ===================== SESSION SIGNALR TYPES =====================

export interface SessionStatusChangedEvent {
  sessionId: string;
  // Backend session status values
  status: "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
  message?: string;
  changedAt?: string;
  timestamp?: string; // Legacy field, use changedAt if available
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

// JoinedSession event - sent when client joins a session
export interface JoinedSessionEvent {
  sessionId: string;
  sessionCode: string;
  status: string; // "WAITING", "IN_PROGRESS", "PAUSED", "COMPLETED"
  message?: string;
  mapState?: MapStateSyncEvent | null;
  segmentState?: SegmentSyncEvent | null;
}

// ===================== SEGMENT SYNC EVENTS =====================

export interface SegmentSyncEvent {
  sessionId: string;
  segmentIndex: number;
  segmentId?: string;
  segmentName?: string;
  isPlaying: boolean;
  syncedAt: string;
}

// ===================== MAP LAYER SYNC EVENTS =====================

export interface MapLayerSyncEvent {
  sessionId: string;
  layerKey: string;
  syncedAt: string;
}

// ===================== QUESTION BROADCAST EVENTS =====================

export interface QuestionBroadcastEvent {
  sessionId: string;
  sessionQuestionId: string;
  questionId: string;
  questionText: string;
  questionType: string;
  questionImageUrl?: string;
  options?: Array<{
    id: string;
    optionText: string;
    optionImageUrl?: string;
    displayOrder: number;
  }>;
  points: number;
  timeLimit: number;
  broadcastedAt: string;
}

export interface QuestionResultsEvent {
  sessionId: string;
  questionId: string;
  results?: Array<{
    participantId: string;
    displayName: string;
    answer?: string;
    isCorrect: boolean;
    pointsEarned: number;
  }>;
  correctAnswer?: string;
  showedAt: string;
}

// ===================== CONNECTION SETUP =====================

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

  // For session hub, allow guest connections (no token required)
  // Get token if available, but don't require it to be valid
  let authToken: string | null | undefined = token || getToken();

  // If token is empty string or null/undefined, treat as no token (guest mode)
  if (!authToken || (typeof authToken === 'string' && authToken.trim().length === 0)) {
    authToken = undefined; // No token - will connect as guest
  } else if (!isTokenValid(authToken)) {
    // Token exists but is invalid - log warning but still allow connection as guest
    console.warn("[SignalR Session] Token provided but invalid, connecting as guest");
    authToken = undefined; // Treat as no token, allow guest connection
  }
  // If token is valid, it will be used for authenticated connection

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/session`;

  return createBaseConnection(hubUrl, {
    token: authToken || undefined,
    allowGuest: true, // Session hub allows guest connections
    onClose: (error) => {
    },
    onReconnecting: (error) => {
      console.warn("[SignalR Session] Reconnecting...", error);
    },
    onReconnected: (connectionId) => {
      console.info("[SignalR Session] Reconnected:", connectionId);
    },
  });
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

    try {
      await connection.invoke("JoinSession", sessionId);
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
    }
  } catch (error) {
    console.error("[SignalR Session] Failed to stop connection:", error);
  }
}

// ===================== EVENT HANDLERS SETUP =====================

export interface SessionEventHandlers {
  onJoinedSession?: (event: JoinedSessionEvent) => void;
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
  onSegmentSync?: (event: SegmentSyncEvent) => void;
  onMapLayerSync?: (event: MapLayerSyncEvent) => void;
  onQuestionBroadcast?: (event: QuestionBroadcastEvent) => void;
  onQuestionResults?: (event: QuestionResultsEvent) => void;
  onError?: (event: unknown) => void;
}

export function registerSessionEventHandlers(
  connection: signalR.HubConnection,
  handlers: SessionEventHandlers
): void {
  // Always register a no-op for server "error" method to avoid warnings in production logs.
  connection.on("error", (event: unknown) => {
    handlers.onError?.(event);
  });

  // Handle JoinedSession event - sent when client joins a session
  if (handlers.onJoinedSession) {
    connection.on("JoinedSession", handlers.onJoinedSession);
  }

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

  if (handlers.onSegmentSync) {
    connection.on("SegmentSync", handlers.onSegmentSync);
  }

  if (handlers.onQuestionBroadcast) {
    connection.on("QuestionBroadcast", handlers.onQuestionBroadcast);
  }

  if (handlers.onQuestionResults) {
    connection.on("QuestionResults", handlers.onQuestionResults);
  }

  if (handlers.onMapLayerSync) {
    connection.on("MapLayerSync", handlers.onMapLayerSync);
  }

}

export function unregisterSessionEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("error");
  connection.off("JoinedSession");
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
  connection.off("SessionEnded");
  connection.off("SegmentSync");
  connection.off("QuestionBroadcast");
  connection.off("QuestionResults");
  connection.off("MapLayerSync");
}

// ===================== TEACHER FOCUS (MAP SYNC) =====================

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

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to send Teacher Focus:", error);
    return false;
  }
}

// ===================== SEGMENT SYNC =====================

export interface SegmentSyncRequest {
  segmentIndex: number;
  segmentId?: string;
  segmentName?: string;
  isPlaying: boolean;
}

/**
 * Send Segment Sync via SignalR Hub
 * This syncs the current segment to all students
 */
export async function sendSegmentSyncViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  segment: SegmentSyncRequest
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for SyncSegment");
      return false;
    }

    await connection.invoke("SyncSegment", sessionId, {
      SegmentIndex: segment.segmentIndex,
      SegmentId: segment.segmentId ?? null,
      SegmentName: segment.segmentName ?? null,
      IsPlaying: segment.isPlaying,
    });

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to send Segment sync:", error);
    return false;
  }
}

// ===================== MAP LAYER SYNC =====================

/**
 * Send Map Layer Sync via SignalR Hub
 * This syncs the current base map layer to all students
 */
export async function sendMapLayerSyncViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  layerKey: string
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for SyncMapLayer");
      return false;
    }

    await connection.invoke("SyncMapLayer", sessionId, layerKey);

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to send Map Layer sync:", error);
    return false;
  }
}

// ===================== QUESTION BROADCAST =====================

export interface QuestionBroadcastRequest {
  sessionQuestionId: string;
  questionId: string;
  questionText: string;
  questionType: string;
  questionImageUrl?: string;
  options?: Array<{
    id: string;
    optionText: string;
    optionImageUrl?: string;
    displayOrder: number;
  }>;
  points: number;
  timeLimit: number;
}

/**
 * Broadcast a question to all students via SignalR Hub
 */
export async function broadcastQuestionViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  question: QuestionBroadcastRequest
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for BroadcastQuestion");
      return false;
    }

    await connection.invoke("BroadcastQuestionToStudents", sessionId, {
      SessionQuestionId: question.sessionQuestionId,
      QuestionId: question.questionId,
      QuestionText: question.questionText,
      QuestionType: question.questionType,
      QuestionImageUrl: question.questionImageUrl ?? null,
      Options: question.options ?? null,
      Points: question.points,
      TimeLimit: question.timeLimit,
    });

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to broadcast question:", error);
    return false;
  }
}

/**
 * Show question results to all students via SignalR Hub
 */
export async function showQuestionResultsViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  questionId: string,
  results: Array<{
    participantId: string;
    displayName: string;
    answer?: string;
    isCorrect: boolean;
    pointsEarned: number;
  }>,
  correctAnswer?: string
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for ShowQuestionResults");
      return false;
    }

    await connection.invoke("ShowQuestionResults", sessionId, {
      QuestionId: questionId,
      Results: results,
      CorrectAnswer: correctAnswer ?? null,
    });

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to show question results:", error);
    return false;
  }
}

