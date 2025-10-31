/**
 * Workspace (Project) Management API
 */

import { getJson, postJson, putJson, delJson } from "./api-core";
import type { Workspace, WorkspaceAccess } from "@/types/workspace";
import type { MapDto } from "./api-maps";

// ===== WORKSPACE/PROJECT CRUD =====
export type CreateWorkspaceRequest = {
  orgId: string;
  workspaceName: string;
  description?: string | null;
  icon?: string | null;
  access?: WorkspaceAccess;
};

export type CreateWorkspaceResponse = { result?: string };

export function createWorkspace(req: CreateWorkspaceRequest) {
  const body = {
    OrgId: req.orgId,
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
    Icon: req.icon ?? null,
    Access: req.access ?? "Private",
  };
  return postJson<typeof body, CreateWorkspaceResponse>("/workspaces", body);
}

// Backward compatibility aliases
export type CreateProjectRequest = CreateWorkspaceRequest;
export const createProject = createWorkspace;

const PERSONAL_WORKSPACE_NAME = "Personal Workspace";
const PERSONAL_WORKSPACE_NOTE = "Không thuộc tổ chức";

function normalizeWorkspace(raw: Workspace): Workspace {
  const orgId = raw.orgId ?? null;
  const isPersonal = !orgId;
  const trimmedOrgName =
    typeof raw.orgName === "string" ? raw.orgName.trim() : "";
  const finalOrgName = isPersonal
    ? trimmedOrgName || PERSONAL_WORKSPACE_NAME
    : trimmedOrgName || raw.orgName;
  const trimmedWorkspaceName =
    typeof raw.workspaceName === "string" ? raw.workspaceName.trim() : "";
  const finalWorkspaceName = isPersonal
    ? trimmedWorkspaceName || PERSONAL_WORKSPACE_NAME
    : trimmedWorkspaceName || raw.workspaceName;

  return {
    ...raw,
    orgId,
    orgName: finalOrgName,
    workspaceName: finalWorkspaceName,
    isPersonal,
    personalLabel: isPersonal ? PERSONAL_WORKSPACE_NOTE : raw.personalLabel,
  };
}

export type GetWorkspacesByOrgResponse = { workspaces: Workspace[] } | Workspace[];

export async function getWorkspacesByOrganization(orgId: string): Promise<Workspace[]> {
  const res = await getJson<GetWorkspacesByOrgResponse>(`/workspaces/organization/${orgId}`);
  const items = Array.isArray(res) ? res : (res.workspaces ?? []);
  return items.map(normalizeWorkspace);
}

export type GetMyWorkspacesResponse = { workspaces: Workspace[] } | Workspace[];

export async function getMyWorkspaces(): Promise<Workspace[]> {
  const res = await getJson<GetMyWorkspacesResponse>("/workspaces/my");
  const items = Array.isArray(res) ? res : (res.workspaces ?? []);
  return items.map(normalizeWorkspace);
}

export const getMyProjects = getMyWorkspaces;

export type AddMapToWorkspaceRequest = { mapId: string };
export type AddMapToWorkspaceResponse = { result?: string };

export function addMapToWorkspace(workspaceId: string, req: AddMapToWorkspaceRequest) {
  const body = { MapId: req.mapId };
  return postJson<typeof body, AddMapToWorkspaceResponse>(`/workspaces/${workspaceId}/maps`, body);
}

export function getWorkspaceById(workspaceId: string) {
  return getJson<Workspace>(`/workspaces/${workspaceId}`).then(normalizeWorkspace);
}

export function updateWorkspace(workspaceId: string, req: { workspaceName: string; description?: string }) {
  const body = {
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
  };
  return putJson<typeof body, Workspace>(`/workspaces/${workspaceId}`, body).then(normalizeWorkspace);
}

export function deleteWorkspace(workspaceId: string) {
  return delJson(`/workspaces/${workspaceId}`);
}

export function getWorkspaceMaps(workspaceId: string) {
  return getJson<MapDto[]>(`/workspaces/${workspaceId}/maps`);
}

export function removeMapFromWorkspace(workspaceId: string, mapId: string) {
  return delJson(`/workspaces/${workspaceId}/maps/${mapId}`);
}

// Backward compatibility aliases
export const getProjectsByOrganization = getWorkspacesByOrganization;
export const addMapToProject = addMapToWorkspace;
export const getProjectById = getWorkspaceById;
export const updateProject = updateWorkspace;
export const deleteProject = deleteWorkspace;
export const getProjectMaps = getWorkspaceMaps;
export const removeMapFromProject = removeMapFromWorkspace;
