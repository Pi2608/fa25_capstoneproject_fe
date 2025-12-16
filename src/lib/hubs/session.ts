import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";

// ===================== SESSION SIGNALR TYPES =====================

export interface SessionStatusChangedEvent {
  sessionId: string;
  status: "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
  message?: string;
  changedAt?: string;
  timestamp?: string;
}

export interface ParticipantJoinedEvent {
  sessionId: string;
  participantId: string;
  displayName: string;
  totalParticipants: number;
  // keep extra fields if backend sends more
  [key: string]: unknown;
}

export interface ParticipantLeftEvent {
  sessionId: string;
  participantId: string;
  displayName: string;
  totalParticipants: number;
  [key: string]: unknown;
}

export interface LeftSessionEvent {
  sessionId: string;
  message?: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface QuestionTimeExtendedEvent {
  sessionId: string;
  sessionQuestionId: string;
  additionalSeconds?: number;
  newEndTime?: string;
  extendedBy?: number;
  [key: string]: unknown;
}

export interface QuestionSkippedEvent {
  sessionId: string;
  sessionQuestionId: string;
  skippedAt: string;
  [key: string]: unknown;
}

export interface ResponseReceivedEvent {
  sessionId: string;
  sessionQuestionId: string;
  participantId: string;
  displayName?: string;
  totalResponses?: number;
  totalParticipants?: number;
  [key: string]: unknown;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  score: number;
  rank: number;
  [key: string]: unknown;
}

export interface LeaderboardUpdatedEvent {
  sessionId: string;
  leaderboard: LeaderboardEntry[];
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TeacherFocusChangedEvent {
  sessionId: string;
  latitude: number;
  longitude: number;
  zoom: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface MapStateSyncEvent {
  sessionId: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  bearing?: number;
  pitch?: number;
  syncedBy?: string;
  syncedAt?: string;
  [key: string]: unknown;
}

export interface SessionEndedEvent {
  sessionId: string;
  endedAt: string;
  finalLeaderboard: LeaderboardEntry[];
  [key: string]: unknown;
}

export interface SegmentSyncEvent {
  sessionId: string;
  segmentIndex: number;
  segmentId?: string;
  segmentName?: string;
  isPlaying: boolean;
  syncedAt: string;
  [key: string]: unknown;
}

export interface MapLayerSyncEvent {
  sessionId: string;
  layerKey: string;
  syncedAt: string;
  [key: string]: unknown;
}

/** ✅ Backend có SyncMapLockState + MapLockStateSync */
export interface MapLockStateSyncEvent {
  sessionId: string;
  isLocked: boolean;
  syncedAt: string;
  [key: string]: unknown;
}

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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

/** ✅ Backend có BroadcastQuestionResponsesUpdate -> "QuestionResponsesUpdate" */
export interface QuestionResponsesUpdateEvent {
  sessionId: string;
  sessionQuestionId: string;
  totalResponses: number;
  totalParticipants?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

// JoinedSession event - sent when client joins a session
export interface JoinedSessionEvent {
  sessionId: string;
  sessionCode: string;
  status: string;
  message?: string;
  mapState?: MapStateSyncEvent | null;
  segmentState?: SegmentSyncEvent | null;
  /** ✅ Backend gửi MapLockState trong JoinedSession */
  mapLockState?: MapLockStateSyncEvent | null;
  [key: string]: unknown;
}

// ===================== CONNECTION SETUP =====================

export function createSessionConnection(
  sessionId: string,
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR Session] Missing API_BASE_URL");
    return null;
  }

  let authToken: string | null | undefined = token || getToken();

  if (!authToken || (typeof authToken === "string" && authToken.trim().length === 0)) {
    authToken = undefined;
  } else if (!isTokenValid(authToken)) {
    console.warn("[SignalR Session] Token provided but invalid, connecting as guest");
    authToken = undefined;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/session`;

  return createBaseConnection(hubUrl, {
    token: authToken || undefined,
    allowGuest: true,
    onClose: () => {},
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
    if (connection.state === signalR.HubConnectionState.Connected) return true;

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn("[SignalR Session] Connection not in disconnected state:", connection.state);
      return false;
    }

    await connection.start();

    try {
      await connection.invoke("JoinSession", sessionId);
    } catch (invokeError) {
      console.error("[SignalR Session] Failed to join session group:", invokeError);
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

export async function stopSessionConnection(connection: signalR.HubConnection): Promise<void> {
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
  onLeftSession?: (event: LeftSessionEvent) => void;

  onSessionStatusChanged?: (event: SessionStatusChangedEvent) => void;
  onParticipantJoined?: (event: ParticipantJoinedEvent) => void;
  onParticipantLeft?: (event: ParticipantLeftEvent) => void;

  onQuestionActivated?: (event: QuestionActivatedEvent) => void;
  onQuestionTimeExtended?: (event: QuestionTimeExtendedEvent) => void;
  onQuestionSkipped?: (event: QuestionSkippedEvent) => void;
  onResponseReceived?: (event: ResponseReceivedEvent) => void;
  onLeaderboardUpdated?: (event: LeaderboardUpdatedEvent) => void;

  /** optional: nếu muốn bắt raw MapStateSync */
  onMapStateSync?: (event: MapStateSyncEvent) => void;
  onTeacherFocusChanged?: (event: TeacherFocusChangedEvent) => void;

  onSessionEnded?: (event: SessionEndedEvent) => void;
  onSegmentSync?: (event: SegmentSyncEvent) => void;
  onMapLayerSync?: (event: MapLayerSyncEvent) => void;

  /** ✅ Backend có MapLockStateSync */
  onMapLockStateSync?: (event: MapLockStateSyncEvent) => void;

  onQuestionBroadcast?: (event: QuestionBroadcastEvent) => void;
  onQuestionResults?: (event: QuestionResultsEvent) => void;

  /** ✅ Backend có QuestionResponsesUpdate */
  onQuestionResponsesUpdate?: (event: QuestionResponsesUpdateEvent) => void;

  onError?: (event: unknown) => void;
}

export function registerSessionEventHandlers(
  connection: signalR.HubConnection,
  handlers: SessionEventHandlers
): void {
  // ✅ Backend bắn "Error" (PascalCase). Để an toàn, nghe cả 2.
  const handleError = (event: unknown) => {
    handlers.onError?.(event);
  };
  connection.on("Error", handleError);
  connection.on("error", handleError);

  if (handlers.onJoinedSession) {
    connection.on("JoinedSession", handlers.onJoinedSession);
  }

  if (handlers.onLeftSession) {
    connection.on("LeftSession", handlers.onLeftSession);
  }

  if (handlers.onSessionStatusChanged) {
    connection.on("SessionStatusChanged", handlers.onSessionStatusChanged);
  }

  // ✅ Normalize participantId để không bị undefined nếu backend gửi SessionParticipantId
  if (handlers.onParticipantJoined) {
    connection.on("ParticipantJoined", (event: any) => {
      const participantId =
        event?.participantId ??
        event?.sessionParticipantId ??
        event?.SessionParticipantId ??
        event?.participantID;

      handlers.onParticipantJoined?.({
        ...event,
        sessionId: event?.sessionId ?? event?.SessionId,
        participantId,
        displayName: event?.displayName ?? event?.DisplayName,
        totalParticipants: event?.totalParticipants ?? event?.TotalParticipants ?? 0,
      });
    });
  }

  if (handlers.onParticipantLeft) {
    connection.on("ParticipantLeft", (event: any) => {
      const participantId =
        event?.participantId ??
        event?.sessionParticipantId ??
        event?.SessionParticipantId ??
        event?.participantID;

      handlers.onParticipantLeft?.({
        ...event,
        sessionId: event?.sessionId ?? event?.SessionId,
        participantId,
        displayName: event?.displayName ?? event?.DisplayName,
        totalParticipants: event?.totalParticipants ?? event?.TotalParticipants ?? 0,
      });
    });
  }

  if (handlers.onQuestionActivated) {
    connection.on("QuestionActivated", handlers.onQuestionActivated);
  }

  if (handlers.onQuestionTimeExtended) {
    connection.on("TimeExtended", handlers.onQuestionTimeExtended);
  }

  if (handlers.onQuestionSkipped) {
    connection.on("QuestionSkipped", handlers.onQuestionSkipped);
  }

  // ✅ Normalize participantId cho ResponseSubmitted
  if (handlers.onResponseReceived) {
    connection.on("ResponseSubmitted", (event: any) => {
      const participantId =
        event?.participantId ??
        event?.sessionParticipantId ??
        event?.SessionParticipantId;

      handlers.onResponseReceived?.({
        ...event,
        sessionId: event?.sessionId ?? event?.SessionId,
        sessionQuestionId: event?.sessionQuestionId ?? event?.SessionQuestionId,
        participantId,
        displayName: event?.displayName ?? event?.DisplayName,
        totalResponses: event?.totalResponses ?? event?.TotalResponses,
        totalParticipants: event?.totalParticipants ?? event?.TotalParticipants,
      });
    });
  }

  if (handlers.onLeaderboardUpdated) {
    connection.on("LeaderboardUpdate", handlers.onLeaderboardUpdated);
  }

  // ✅ MapStateSync: giữ logic cũ (convert sang TeacherFocusChanged) + optional bắt raw
  connection.on("MapStateSync", (event: MapStateSyncEvent) => {
    handlers.onMapStateSync?.(event);

    if (handlers.onTeacherFocusChanged) {
      const focusEvent: TeacherFocusChangedEvent = {
        sessionId: event.sessionId,
        latitude: event.latitude,
        longitude: event.longitude,
        zoom: event.zoomLevel,
        timestamp: event.syncedAt || new Date().toISOString(),
      };
      handlers.onTeacherFocusChanged(focusEvent);
    }
  });

  if (handlers.onSessionEnded) {
    connection.on("SessionEnded", handlers.onSessionEnded);
  }

  if (handlers.onSegmentSync) {
    connection.on("SegmentSync", handlers.onSegmentSync);
  }

  if (handlers.onMapLayerSync) {
    connection.on("MapLayerSync", handlers.onMapLayerSync);
  }

  // ✅ Backend có MapLockStateSync (JoinSession cũng bắn event này nếu có cache)
  if (handlers.onMapLockStateSync) {
    connection.on("MapLockStateSync", handlers.onMapLockStateSync);
  }

  if (handlers.onQuestionBroadcast) {
    connection.on("QuestionBroadcast", handlers.onQuestionBroadcast);
  }

  if (handlers.onQuestionResults) {
    connection.on("QuestionResults", handlers.onQuestionResults);
  }

  if (handlers.onQuestionResponsesUpdate) {
    connection.on("QuestionResponsesUpdate", handlers.onQuestionResponsesUpdate);
  }
}

export function unregisterSessionEventHandlers(connection: signalR.HubConnection): void {
  connection.off("Error");
  connection.off("error");

  connection.off("JoinedSession");
  connection.off("LeftSession");

  connection.off("SessionStatusChanged");
  connection.off("ParticipantJoined");
  connection.off("ParticipantLeft");

  connection.off("QuestionActivated");
  connection.off("TimeExtended");
  connection.off("QuestionSkipped");
  connection.off("ResponseSubmitted");
  connection.off("LeaderboardUpdate");

  connection.off("MapStateSync");
  connection.off("TeacherFocusChanged"); // (có thể không dùng, giữ cho an toàn)

  connection.off("SessionEnded");
  connection.off("SegmentSync");
  connection.off("MapLayerSync");
  connection.off("MapLockStateSync");

  connection.off("QuestionBroadcast");
  connection.off("QuestionResults");
  connection.off("QuestionResponsesUpdate");
}

// ===================== TEACHER FOCUS (MAP SYNC) =====================

export interface MapStateSyncRequest {
  latitude: number;
  longitude: number;
  zoomLevel: number;
  bearing?: number;
  pitch?: number;
}

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

// ===================== MAP LOCK STATE SYNC =====================

export async function sendMapLockStateSyncViaSignalR(
  connection: signalR.HubConnection,
  sessionId: string,
  isLocked: boolean
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error("[SignalR Session] Connection not connected for SyncMapLockState");
      return false;
    }

    await connection.invoke("SyncMapLockState", sessionId, {
      IsLocked: isLocked,
    });

    return true;
  } catch (error) {
    console.error("[SignalR Session] Failed to sync map lock state:", error);
    return false;
  }
}

// ===================== MAP LAYER SYNC =====================

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
