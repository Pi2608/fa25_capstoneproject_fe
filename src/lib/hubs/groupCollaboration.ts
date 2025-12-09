import * as signalR from "@microsoft/signalr";
import { getToken } from "../api-core";
import { isTokenValid, createBaseConnection, API_BASE_URL } from "./base";

export interface GroupDto {
  id: string;
  sessionId: string;
  name: string;
  maxMembers?: number | null;
  currentMembers?: number | null;
  [key: string]: unknown;
}

export interface GroupSubmissionDto {
  id: string;
  groupId: string;
  sessionId: string;
  submittedByUserId?: string | null;
  submittedAt: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface GroupGradedSubmissionDto {
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

export interface GroupTypingEvent {
  userName: string;
  isTyping: boolean;
}

export interface CreateGroupRequestPayload {
  sessionId: string;
  groupName: string;
  color?: string;
  memberParticipantIds: string[];
  leaderParticipantId?: string | null;
  [key: string]: unknown;
}

export interface SubmitGroupWorkRequestPayload {
  groupId: string;
  sessionId: string;
  content: unknown;
  [key: string]: unknown;
}

export interface GradeSubmissionRequestPayload {
  submissionId: string;
  score: number;
  feedback?: string;
  [key: string]: unknown;
}

export interface GroupCollaborationEventHandlers {
  onGroupCreated?: (group: GroupDto) => void;
  onWorkSubmitted?: (submission: GroupSubmissionDto) => void;
  onSubmissionConfirmed?: (submission: GroupSubmissionDto) => void;
  onSubmissionGraded?: (gradedSubmission: GroupGradedSubmissionDto) => void;
  onDrawingReceived?: (drawingData: unknown) => void;
  onCursorMoved?: (cursorData: unknown) => void;
  onMessageReceived?: (message: GroupChatMessage) => void;
  onMemberTyping?: (event: GroupTypingEvent) => void;
  onError?: (error: unknown) => void;
}

export function createGroupCollaborationConnection(
  token?: string
): signalR.HubConnection | null {
  if (!API_BASE_URL) {
    console.error("[SignalR GroupCollaboration] Missing API_BASE_URL");
    return null;
  }

  let authToken: string | null | undefined = token || getToken();

  if (!authToken || authToken.trim().length === 0) {
    authToken = undefined;
  } else if (!isTokenValid(authToken)) {
    console.warn(
      "[SignalR GroupCollaboration] Token provided but invalid, connecting as guest"
    );
    authToken = undefined;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const hubUrl = `${baseUrl}/hubs/groupCollaboration`;

  return createBaseConnection(hubUrl, {
    token: authToken || undefined, 
    allowGuest: true,            
    onClose: (error) => {
      console.error(
        "[SignalR GroupCollaboration] Connection closed with error:",
        error
      );
    },
    onReconnecting: (error) => {
      console.warn("[SignalR GroupCollaboration] Reconnecting...", error);
    },
    onReconnected: (connectionId) => {
      console.info("[SignalR GroupCollaboration] Reconnected:", connectionId);
    },
  });
}

export async function startGroupCollaborationConnection(
  connection: signalR.HubConnection
): Promise<boolean> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      return true;
    }

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
    console.error(
      "[SignalR GroupCollaboration] Failed to start connection:",
      error
    );
    return false;
  }
}

export async function stopGroupCollaborationConnection(
  connection: signalR.HubConnection
): Promise<void> {
  try {
    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      await connection.stop();
    }
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to stop connection:",
      error
    );
  }
}

export async function joinGroupCollaborationSession(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("JoinSession", sessionId);
    }
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to JoinSession:",
      error
    );
  }
}

export async function leaveGroupCollaborationSession(
  connection: signalR.HubConnection,
  sessionId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveSession", sessionId);
    }
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to LeaveSession:",
      error
    );
  }
}

export async function joinGroupCollaborationGroup(
  connection: signalR.HubConnection,
  groupId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("JoinGroup", groupId);
    }
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to JoinGroup:",
      error
    );
  }
}

export async function leaveGroupCollaborationGroup(
  connection: signalR.HubConnection,
  groupId: string
): Promise<void> {
  try {
    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("LeaveGroup", groupId);
    }
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to LeaveGroup:",
      error
    );
  }
}

export async function createGroupViaSignalR(
  connection: signalR.HubConnection,
  payload: CreateGroupRequestPayload
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for CreateGroup"
      );
      return false;
    }

    await connection.invoke("CreateGroup", {
      SessionId: payload.sessionId,
      GroupName: payload.groupName,
      Color: payload.color ?? null,
      MemberParticipantIds: payload.memberParticipantIds ?? [],
      LeaderParticipantId: payload.leaderParticipantId ?? null,
    });

    return true;
  } catch (error) {
    console.error("[SignalR GroupCollaboration] Failed to CreateGroup:", error);
    return false;
  }
}


export async function submitGroupWorkViaSignalR(
  connection: signalR.HubConnection,
  payload: SubmitGroupWorkRequestPayload
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for SubmitGroupWork"
      );
      return false;
    }

    await connection.invoke("SubmitGroupWork", {
      GroupId: payload.groupId,
      SessionId: payload.sessionId,
      Content: payload.content,
      ...payload,
    });

    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to SubmitGroupWork:",
      error
    );
    return false;
  }
}

export async function gradeSubmissionViaSignalR(
  connection: signalR.HubConnection,
  payload: GradeSubmissionRequestPayload
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for GradeSubmission"
      );
      return false;
    }

    await connection.invoke("GradeSubmission", {
      SubmissionId: payload.submissionId,
      Score: payload.score,
      Feedback: payload.feedback ?? null,
      ...payload,
    });

    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to GradeSubmission:",
      error
    );
    return false;
  }
}

export async function sendDrawingViaSignalR(
  connection: signalR.HubConnection,
  groupId: string,
  drawingData: unknown
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for SendDrawing"
      );
      return false;
    }

    await connection.invoke("SendDrawing", groupId, drawingData);
    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to SendDrawing:",
      error
    );
    return false;
  }
}

export async function sendCursorPositionViaSignalR(
  connection: signalR.HubConnection,
  groupId: string,
  cursorData: unknown
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for SendCursorPosition"
      );
      return false;
    }

    await connection.invoke("SendCursorPosition", groupId, cursorData);
    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to SendCursorPosition:",
      error
    );
    return false;
  }
}

export async function sendMessageViaSignalR(
  connection: signalR.HubConnection,
  groupId: string,
  message: string
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for SendMessage"
      );
      return false;
    }

    await connection.invoke("SendMessage", groupId, message);
    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to SendMessage:",
      error
    );
    return false;
  }
}

export async function notifyTypingViaSignalR(
  connection: signalR.HubConnection,
  groupId: string,
  isTyping: boolean
): Promise<boolean> {
  try {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.error(
        "[SignalR GroupCollaboration] Connection not connected for NotifyTyping"
      );
      return false;
    }

    await connection.invoke("NotifyTyping", groupId, isTyping);
    return true;
  } catch (error) {
    console.error(
      "[SignalR GroupCollaboration] Failed to NotifyTyping:",
      error
    );
    return false;
  }
}

export function registerGroupCollaborationEventHandlers(
  connection: signalR.HubConnection,
  handlers: GroupCollaborationEventHandlers
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
