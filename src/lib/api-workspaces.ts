/**
 * Workspace (Project) Management API
 */

import { getJson, postJson, putJson, delJson } from "./api-core";
import type { Workspace, WorkspaceAccess } from "@/types/workspace";
import type { MapDto } from "./api-maps";

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

export type CreateProjectRequest = CreateWorkspaceRequest;
export const createProject = createWorkspace;



export async function getWorkspacesByOrganization(orgId: string): Promise<Workspace[]> {
  const res = await getJson<any>(`/workspaces/organization/${orgId}`);
  return Array.isArray(res) ? res : res?.workspaces ?? [];
}

export async function getMyWorkspaces(): Promise<Workspace[]> {
  const res = await getJson<any>("/workspaces/my");
  return Array.isArray(res) ? res : res?.workspaces ?? [];
}

export const getMyProjects = getMyWorkspaces;

export type AddMapToWorkspaceRequest = { mapId: string };
export type AddMapToWorkspaceResponse = { result?: string };

export function addMapToWorkspace(workspaceId: string, req: AddMapToWorkspaceRequest) {
  const body = { MapId: req.mapId };
  return postJson<typeof body, AddMapToWorkspaceResponse>(`/workspaces/${workspaceId}/maps`, body);
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace> {
  const res = await getJson<any>(`/workspaces/${workspaceId}`);
  return res?.workspace ?? res;
}

export async function updateWorkspace(workspaceId: string, req: { workspaceName: string; description?: string }) {
  const body = {
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
  };
  const res = await putJson<typeof body, any>(`/workspaces/${workspaceId}`, body);
  return res?.workspace ?? res;
}

export function deleteWorkspace(workspaceId: string) {
  return delJson(`/workspaces/${workspaceId}`);
}

export async function getWorkspaceMaps(workspaceId: string): Promise<MapDto[]> {
  const res = await getJson<any>(`/workspaces/${workspaceId}/maps`);
  return Array.isArray(res) ? res : res?.maps ?? [];
}

export function removeMapFromWorkspace(workspaceId: string, mapId: string) {
  return delJson(`/workspaces/${workspaceId}/maps/${mapId}`);
}

export const getProjectsByOrganization = getWorkspacesByOrganization;
export const addMapToProject = addMapToWorkspace;
export const getProjectById = getWorkspaceById;
export const updateProject = updateWorkspace;
export const deleteProject = deleteWorkspace;
export const getProjectMaps = getWorkspaceMaps;
export const removeMapFromProject = removeMapFromWorkspace;
