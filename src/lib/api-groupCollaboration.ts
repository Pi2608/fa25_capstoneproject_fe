// api-groupCollaboration.ts
import { getJson, delJson } from "./api-core";

export type SessionId = string;
export type GroupId = string;

// GET /api/v1/api/groups/sessions/{sessionId}
export function getGroupsBySession<T = unknown>(
  sessionId: SessionId
): Promise<T> {
  return getJson<T>(
    `/api/groups/sessions/${encodeURIComponent(sessionId)}`
  );
}

// GET /api/v1/api/groups/{groupId}
export function getGroupById<T = unknown>(groupId: GroupId): Promise<T> {
  return getJson<T>(
    `/api/groups/${encodeURIComponent(groupId)}`
  );
}

// DELETE /api/v1/api/groups/{groupId}
export function deleteGroup<T = unknown>(groupId: GroupId): Promise<T> {
  return delJson<T>(
    `/api/groups/${encodeURIComponent(groupId)}`
  );
}

// GET /api/v1/api/groups/{groupId}/submissions
export function getGroupSubmissions<T = unknown>(
  groupId: GroupId
): Promise<T> {
  return getJson<T>(
    `/api/groups/${encodeURIComponent(groupId)}/submissions`
  );
}

// GET /api/v1/api/groups/sessions/{sessionId}/submissions
export function getSessionSubmissions<T = unknown>(
  sessionId: SessionId
): Promise<T> {
  return getJson<T>(
    `/api/groups/sessions/${encodeURIComponent(sessionId)}/submissions`
  );
}
