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

const PERSONAL_WORKSPACE_NAME = "Personal Workspace";
const PERSONAL_WORKSPACE_NOTE = "Không thuộc tổ chức";

function normalizeWorkspace(raw: Workspace): Workspace {
  const orgId = raw.orgId ?? null;
  const isPersonal = !orgId;
  const trimmedOrgName = typeof raw.orgName === "string" ? raw.orgName.trim() : "";
  const finalOrgName = isPersonal ? trimmedOrgName || PERSONAL_WORKSPACE_NAME : trimmedOrgName || raw.orgName;
  const trimmedWorkspaceName = typeof raw.workspaceName === "string" ? raw.workspaceName.trim() : "";
  const finalWorkspaceName = isPersonal ? trimmedWorkspaceName || PERSONAL_WORKSPACE_NAME : trimmedWorkspaceName || raw.workspaceName;
  return {
    ...raw,
    orgId,
    orgName: finalOrgName,
    workspaceName: finalWorkspaceName,
    isPersonal,
    personalLabel: isPersonal ? PERSONAL_WORKSPACE_NOTE : raw.personalLabel,
  };
}

type WorkspacesEnvelope = { workspaces: Workspace[] };
type WorkspaceEnvelope = { workspace: Workspace };
type MapsEnvelope = { maps: MapDto[] };

function asWorkspaces(res: WorkspacesEnvelope | Workspace[]): Workspace[] {
  return Array.isArray(res) ? res : res.workspaces ?? [];
}

function asWorkspace(res: WorkspaceEnvelope | Workspace): Workspace {
  return (res as WorkspaceEnvelope).workspace ?? (res as Workspace);
}

function asMaps(res: MapsEnvelope | MapDto[]): MapDto[] {
  return Array.isArray(res) ? res : res.maps ?? [];
}

export async function getWorkspacesByOrganization(orgId: string): Promise<Workspace[]> {
  const res = await getJson<WorkspacesEnvelope | Workspace[]>(`/workspaces/organization/${orgId}`);
  return asWorkspaces(res).map(normalizeWorkspace);
}

export async function getMyWorkspaces(): Promise<Workspace[]> {
  const res = await getJson<WorkspacesEnvelope | Workspace[]>("/workspaces/my");
  return asWorkspaces(res).map(normalizeWorkspace);
}

export const getMyProjects = getMyWorkspaces;

export type AddMapToWorkspaceRequest = { mapId: string };
export type AddMapToWorkspaceResponse = { result?: string };

export function addMapToWorkspace(workspaceId: string, req: AddMapToWorkspaceRequest) {
  const body = { MapId: req.mapId };
  return postJson<typeof body, AddMapToWorkspaceResponse>(`/workspaces/${workspaceId}/maps`, body);
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace> {
  const res = await getJson<WorkspaceEnvelope | Workspace>(`/workspaces/${workspaceId}`);
  return normalizeWorkspace(asWorkspace(res));
}

export async function updateWorkspace(workspaceId: string, req: { workspaceName: string; description?: string }) {
  const body = {
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
  };
  const res = await putJson<typeof body, WorkspaceEnvelope | Workspace>(`/workspaces/${workspaceId}`, body);
  return normalizeWorkspace(asWorkspace(res));
}

export function deleteWorkspace(workspaceId: string) {
  return delJson(`/workspaces/${workspaceId}`);
}

export async function getWorkspaceMaps(workspaceId: string): Promise<MapDto[]> {
  const res = await getJson<MapsEnvelope | MapDto[]>(`/workspaces/${workspaceId}/maps`);
  return asMaps(res);
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
