"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import {
  createProject,
  type CreateProjectRequest,
  deleteProject,
  updateProject,
} from "@/lib/api";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";

interface ProjectManagementProps {
  orgId: string;
  projects: Workspace[];
  onProjectsChange: () => void;
}

export function ProjectManagement({ orgId, projects, onProjectsChange }: ProjectManagementProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [editOpen, setEditOpen] = useState<{
    open: boolean;
    workspaceId?: string;
    workspaceName?: string;
    projectDesc?: string;
    description?: string;
  }>({ open: false });
  const [editLoading, setEditLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState<{
    open: boolean;
    projectId?: string;
    projectName?: string;
  }>({ open: false });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showToast("error", "Vui lòng nhập tên project");
      return;
    }

    setCreateLoading(true);
    try {
      const req: CreateProjectRequest = {
        orgId,
        workspaceName: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        access: "AllMembers",
      };

      await createProject(req);
      showToast("success", "Tạo project thành công!");
      setCreateOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      onProjectsChange();
    } catch (e) {
      showToast("error", "Tạo project thất bại");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditProject = async () => {
    if (!editOpen.workspaceId || !editOpen.workspaceName?.trim()) {
      showToast("error", "Vui lòng nhập tên project");
      return;
    }

    setEditLoading(true);
    try {
      await updateProject(editOpen.workspaceId, {
        workspaceName: editOpen.workspaceName.trim(),
        description: editOpen.description?.trim() || undefined,
      });
      showToast("success", "Cập nhật project thành công!");
      setEditOpen({ open: false });
      onProjectsChange();
    } catch (e) {
      showToast("error", "Cập nhật project thất bại");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteOpen.projectId) return;

    setDeleteLoading(true);
    try {
      await deleteProject(deleteOpen.projectId);
      showToast("success", "Xóa project thành công!");
      setDeleteOpen({ open: false });
      onProjectsChange();
    } catch (e) {
      showToast("error", "Xóa project thất bại");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      {/* Create Project Button */}
      <button
        onClick={() => setCreateOpen(true)}
        className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
      >
        New Project
      </button>

      {/* Create Project Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Enter project description (optional)"
                  rows={3}
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateProject()}
                disabled={createLoading || !newProjectName.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {createLoading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Edit Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={editOpen.workspaceName || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, workspaceName: e.target.value })}
                  placeholder="Enter project name"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={editOpen.description || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, description: e.target.value })}
                  placeholder="Enter project description (optional)"
                  rows={3}
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setEditOpen({ open: false })}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleEditProject()}
                disabled={editLoading || !editOpen.workspaceName?.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {deleteOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Delete Project</h2>
            <p className="text-sm text-zinc-300 mb-6">
              Are you sure you want to delete the project <span className="font-semibold">{deleteOpen.projectName}</span>?
              This action cannot be undone and will remove all maps associated with this project.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setDeleteOpen({ open: false })}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteProject()}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ProjectCardProps {
  project: Workspace;
  orgId: string;
  onEdit: (project: Workspace) => void;
  onDelete: (project: Workspace) => void;
}

export function ProjectCard({ project, orgId, onEdit, onDelete }: ProjectCardProps) {
  const router = useRouter();

  return (
    <div className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4">
      <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{project.workspaceName || "Untitled"}</div>
          <div className="text-xs text-zinc-400 truncate">
            {project.description ||
              (project.isPersonal ? project.personalLabel ?? "Không thuộc tổ chức" : "No description")}
          </div>
          {project.isPersonal && (
            <div className="mt-1 text-[11px] text-emerald-300">
              {project.orgName} · {project.personalLabel ?? "Không thuộc tổ chức"}
            </div>
          )}
          <div className="text-xs text-zinc-500">
            {project.createdAt ? formatDate(project.createdAt) : "—"}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            className="p-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
            onClick={() => onEdit(project)}
            title="Edit"
          >
            ✏️
          </button>
          <button
            className="p-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300"
            onClick={() => onDelete(project)}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="mt-3">
        <button
          onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${project.workspaceId}`)}
          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
        >
          View Project
        </button>
      </div>
    </div>
  );
}
