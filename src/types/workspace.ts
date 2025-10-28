export type WorkspaceAccess = "AllMembers" | "Private" | string;

export type Workspace = {
    workspaceId: string;
    orgId: string;
    orgName: string;
    workspaceName: string;
    description?: string | null;
    icon?: string | null;
    access: WorkspaceAccess;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string | null;
    mapCount?: number;
    createdBy?: string;
    creatorName?: string;
  };