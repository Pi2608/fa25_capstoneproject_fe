import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { API_BASE_URL } from "./base";

// ===================== DTOs / Payloads =====================

export interface GroupDto {
  id?: string;
  groupId?: string;
  sessionId: string;
  name: string;
  maxMembers?: number | null;
  currentMembers?: number | null;
  currentMembersCount?: number | null;
  [key: string]: unknown;
}

export interface GroupSubmissionDto {
  id: string;
  groupId: string;
  sessionId: string;
  submittedByParticipantId: string;
  payloadJson?: string | null;
  submittedAt: string;
  [key: string]: unknown;
}

export interface GroupSubmissionGradedDto {
  id: string;
  groupId: string;
  sessionId: string;
  score: number;
  feedback?: string | null;
  gradedAt: string;
  gradedByUserId?: string | null;
  [key: string]: unknown;
}

export interface GroupChatMessage {
  userName: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

// Backend NotifyTyping emits: { userName, isTyping }
export interface GroupTypingEvent {
  userName: string;
  isTyping: boolean;
  [key: string]: unknown;
}

// Backend DrawingReceived / CursorMoved emit the raw object you send
export type DrawingData = unknown;
export type CursorData = unknown;

export interface GroupCollaborationHandlers {
  onGroupCreated?: (group: GroupDto) => void;
  onWorkSubmitted?: (submission: GroupSubmissionDto) => void;

  // Backend sends "SubmissionConfirmed" with the SAME object as submission
  onSubmissionConfirmed?: (submission: GroupSubmissionDto) => void;

  onSubmissionGraded?: (payload: GroupSubmissionGradedDto) => void;
  onDrawingReceived?: (drawingData: DrawingData) => void;
  onCursorMoved?: (cursorData: CursorData) => void;
  onMessageReceived?: (message: GroupChatMessage) => void;
  onMemberTyping?: (event: GroupTypingEvent) => void;
  onError?: (error: unknown) => void;
}

// ===================== Requests =====================

export interface CreateGroupRequest {
  sessionId: string;
  groupName: string;
  color?: string | null;
  memberParticipantIds?: string[];
  leaderParticipantId?: string | null;
  [key: string]: unknown;
}

export interface SubmitGroupWorkRequest {
  groupId: string;
  sessionId?: string;
  submittedByParticipantId?: string;
  payloadJson?: string | null;
  [key: string]: unknown;
}

export interface GradeSubmissionRequest {
  [key: string]: unknown;
}

// ===================== Auth helpers =====================

function safeAtob(input: string): string {
  try {
    // Browser
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      return window.atob(input);
    }

    const B: any = (globalThis as any).Buffer;
    if (B) return B.from(input, "base64").toString("utf8");
    return "";
  } catch {
    return "";
  }
}

export function isTokenValid(token: string): boolean {
  if (!token || token.trim().length === 0) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = safeAtob(b64);
    if (!json) return true;

    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

// ===================== Connection =====================

function resolveHubUrl(): string | null {
  if (!API_BASE_URL) {
    console.error("[SignalR GroupCollaboration] Missing API_BASE_URL");
    return null;
  }
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/hubs/groupCollaboration`;
}

function buildConnection(token?: string): signalR.HubConnection | null {
  const hubUrl = resolveHubUrl();
  if (!hubUrl) return null;

  const conn = new signalR.HubConnectionBuilder()
    .withUrl(
      hubUrl,
      token ? { accessTokenFactory: () => token } : undefined
    )
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

  return conn;
}

/**
 * VIEW (participants): guest connection, NO token.
 */
export function createGroupCollaborationViewConnection(): signalR.HubConnection | null {
  return buildConnection(undefined);
}

/**
 * CONTROL (teacher): authenticated connection, MUST have token.
 */
export function createGroupCollaborationControlConnection(
  tokenOverride?: string | null
): signalR.HubConnection | null {
  const token = (tokenOverride ?? getToken() ?? "").trim();

  if (!token) {
    console.error(
      "[SignalR GroupCollaboration][Control] Missing auth token."
    );
    return null;
  }

  if (!isTokenValid(token)) {
    console.error(
      "[SignalR GroupCollaboration][Control] Auth token invalid/expired."
    );
    return null;
  }

  return buildConnection(token);
}

/**
 * Backward-compatible:
 * - Nếu truyền token => coi như CONTROL connection
 * - Nếu không truyền token => coi như VIEW connection (guest)
 */
export function createGroupCollaborationConnection(
  tokenOverride?: string | null
): signalR.HubConnection | null {
  const t = (tokenOverride ?? "").trim();
  if (t) return createGroupCollaborationControlConnection(t);
  return createGroupCollaborationViewConnection();
}

export async function stopGroupCollaborationConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed to stop:", error);
  }
}

export async function startGroupCollaborationConnection(
  connection: signalR.HubConnection
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) return true;

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      console.warn(
        "[SignalR GroupCollaboration] Connection not in disconnected state:",
        connection.state
      );
      return false;
    }

    await connection.start();
    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed to start:", error);
    return false;
  }
}

function isConnected(connection: signalR.HubConnection): boolean {
  return connection.state === signalR.HubConnectionState.Connected;
}

// ===================== Session / Group join-leave =====================

export async function joinGroupCollaborationSession(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<void> {
  try {
    if (isConnected(connection)) {
      await connection.invoke("JoinSession", sessionId);
    }
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed JoinSession:", error);
  }
}

export async function leaveGroupCollaborationSession(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<void> {
  try {
    if (isConnected(connection)) {
      await connection.invoke("LeaveSession", sessionId);
    }
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed LeaveSession:", error);
  }
}

export async function joinGroupCollaborationGroup(
  connection: signalR.HubConnection,
  groupId: string
): Promise<void> {
  try {
    if (isConnected(connection)) {
      await connection.invoke("JoinGroup", groupId);
    }
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed JoinGroup:", error);
  }
}

export async function leaveGroupCollaborationGroup(
  connection: signalR.HubConnection,
  groupId: string
): Promise<void> {
  try {
    if (isConnected(connection)) {
      await connection.invoke("LeaveGroup", groupId);
    }
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed LeaveGroup:", error);
  }
}

// ===================== Hub methods (match backend) =====================

export async function createGroup(
  connection: signalR.HubConnection,
  payload: CreateGroupRequest
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] CreateGroup called but not connected."
      );
      return false;
    }

    await connection.invoke("CreateGroup", {
      sessionId: payload.sessionId,
      groupName: payload.groupName,
      color: payload.color ?? null,
      memberParticipantIds: payload.memberParticipantIds ?? [],
      leaderParticipantId: payload.leaderParticipantId ?? null,
      ...payload,
    });

    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed CreateGroup:", error);
    return false;
  }
}

export async function submitGroupWork(
  connection: signalR.HubConnection,
  payload: SubmitGroupWorkRequest
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] SubmitGroupWork called but not connected."
      );
      return false;
    }

    if (!payload?.groupId) {
      console.error(
        "[SignalR GroupCollaboration] SubmitGroupWork missing groupId."
      );
      return false;
    }

    await connection.invoke("SubmitGroupWork", {
      ...payload,
    });

    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed SubmitGroupWork:", error);
    return false;
  }
}

export async function gradeSubmission(
  connection: signalR.HubConnection,
  payload: GradeSubmissionRequest
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] GradeSubmission called but not connected."
      );
      return false;
    }

    await connection.invoke("GradeSubmission", {
      ...payload,
    });

    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed GradeSubmission:", error);
    return false;
  }
}

// Backend: SendDrawing(Guid groupId, object drawingData)
export async function sendDrawing(
  connection: signalR.HubConnection,
  groupId: string,
  drawingData: DrawingData
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] SendDrawing called but not connected."
      );
      return false;
    }

    await connection.invoke("SendDrawing", groupId, drawingData);
    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed SendDrawing:", error);
    return false;
  }
}

// Backend: SendCursorPosition(Guid groupId, object cursorData)
export async function sendCursorPosition(
  connection: signalR.HubConnection,
  groupId: string,
  cursorData: CursorData
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] SendCursorPosition called but not connected."
      );
      return false;
    }

    await connection.invoke("SendCursorPosition", groupId, cursorData);
    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed SendCursorPosition:",
      error
    );
    return false;
  }
}

// Backend: SendMessage(Guid groupId, string message)
export async function sendMessage(
  connection: signalR.HubConnection,
  groupId: string,
  message: string
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      console.warn(
        "[SignalR GroupCollaboration] SendMessage called but not connected."
      );
      return false;
    }

    if (!groupId) {
      console.error("[SignalR GroupCollaboration] SendMessage missing groupId.");
      return false;
    }

    await connection.invoke("SendMessage", groupId, message);
    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed SendMessage:", error);
    return false;
  }
}

// Backend: NotifyTyping(Guid groupId, bool isTyping)
export async function notifyTyping(
  connection: signalR.HubConnection,
  groupId: string,
  isTyping: boolean
): Promise<boolean> {
  try {
    if (!isConnected(connection)) {
      return false;
    }

    if (!groupId) {
      console.error("[SignalR GroupCollaboration] NotifyTyping missing groupId.");
      return false;
    }

    await connection.invoke("NotifyTyping", groupId, isTyping);
    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed NotifyTyping:", error);
    return false;
  }
}

// ===================== Backward-compat wrappers (optional) =====================

// Old name in your FE: submitWork -> map to SubmitGroupWork
export async function submitWork(
  connection: signalR.HubConnection,
  payload: Record<string, unknown>
): Promise<boolean> {
  return submitGroupWork(connection, payload as SubmitGroupWorkRequest);
}

// Old name in your FE: moveCursor(payload) -> map to SendCursorPosition(groupId, cursorData)
export async function moveCursor(
  connection: signalR.HubConnection,
  payload: { groupId?: string; [key: string]: unknown }
): Promise<boolean> {
  const groupId = payload?.groupId;
  if (!groupId) {
    console.error("[SignalR GroupCollaboration] moveCursor missing groupId.");
    return false;
  }
  return sendCursorPosition(connection, groupId, payload);
}

// Old name in your FE: setTyping(isTyping) -> backend requires groupId.
export async function setTyping(
  connection: signalR.HubConnection,
  isTyping: boolean,
  groupId?: string
): Promise<boolean> {
  if (!groupId) {
    console.error(
      "[SignalR GroupCollaboration] setTyping now needs groupId. Use notifyTyping(connection, groupId, isTyping)."
    );
    return false;
  }
  return notifyTyping(connection, groupId, isTyping);
}

// Backend does NOT have ConfirmSubmission hub method.
// Keep it to avoid build break if call-site still exists.
export async function confirmSubmission(): Promise<boolean> {
  console.error(
    "[SignalR GroupCollaboration] confirmSubmission is not supported by backend hub."
  );
  return false;
}

// ===================== Event handlers =====================

export function registerGroupCollaborationEventHandlers(
  connection: signalR.HubConnection,
  handlers: GroupCollaborationHandlers
): void {
  if (handlers.onGroupCreated) {
    connection.on("GroupCreated", handlers.onGroupCreated);
  }
  if (handlers.onWorkSubmitted) {
    connection.on("WorkSubmitted", handlers.onWorkSubmitted);
  }
  if (handlers.onSubmissionConfirmed) {
    connection.on("SubmissionConfirmed", handlers.onSubmissionConfirmed);
  }
  if (handlers.onSubmissionGraded) {
    connection.on("SubmissionGraded", handlers.onSubmissionGraded);
  }
  if (handlers.onDrawingReceived) {
    connection.on("DrawingReceived", handlers.onDrawingReceived);
  }
  if (handlers.onCursorMoved) {
    connection.on("CursorMoved", handlers.onCursorMoved);
  }
  if (handlers.onMessageReceived) {
    connection.on("MessageReceived", handlers.onMessageReceived);
  }
  if (handlers.onMemberTyping) {
    connection.on("MemberTyping", handlers.onMemberTyping);
  }
  if (handlers.onError) {
    connection.on("Error", handlers.onError);
  }
}

export function unregisterGroupCollaborationEventHandlers(
  connection: signalR.HubConnection
): void {
  connection.off("GroupCreated");
  connection.off("WorkSubmitted");
  connection.off("SubmissionConfirmed");
  connection.off("SubmissionGraded");
  connection.off("DrawingReceived");
  connection.off("CursorMoved");
  connection.off("MessageReceived");
  connection.off("MemberTyping");
  connection.off("Error");
}
