"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";
import { getOrganizationById, OrganizationDetailDto } from "@/lib/api-organizations";
import { createWorkspace, CreateWorkspaceRequest, deleteWorkspace, getWorkspacesByOrganization, updateWorkspace } from "@/lib/api-workspaces";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name";

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

export default function WorkspacesPage() {
  const p = useParams<{ orgId: string }>();
  const orgId = p?.orgId ?? "";
  const router = useRouter();
  const { showToast } = useToast();

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");

  const [deleteOpen, setDeleteOpen] = useState<{
    open: boolean;
    workspaceId?: string;
    workspaceName?: string;
  }>({ open: false });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [editOpen, setEditOpen] = useState<{
    open: boolean;
    workspaceId?: string;
    workspaceName?: string;
    workspaceDesc?: string;
  }>({ open: false });
  const [editLoading, setEditLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [orgRes, workspacesRes] = await Promise.all([
        getOrganizationById(orgId),
        getWorkspacesByOrganization(orgId),
      ]);
      setOrg(orgRes.organization);
      setWorkspaces(workspacesRes);
    } catch (e) {
      setErr(safeMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) void loadData();
  }, [orgId, loadData]);

  const sortedWorkspaces = useMemo(() => {
    const arr = [...workspaces];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.workspaceName || "").localeCompare(b.workspaceName || "", undefined, { sensitivity: "base" });
      }
      const ad = new Date(a.createdAt ?? 0).getTime();
      const bd = new Date(b.createdAt ?? 0).getTime();
      return ad - bd;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [workspaces, sortKey, sortOrder]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim()) {
      showToast("error", "Vui lòng nhập tên workspace");
      return;
    }

    setCreateLoading(true);
    try {
      const req: CreateWorkspaceRequest = {
        orgId,
        workspaceName: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim() || undefined,
        access: "AllMembers",
      };

      await createWorkspace(req);
      showToast("success", "Tạo workspace thành công!");
      setCreateOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDesc("");
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setCreateLoading(false);
    }
  }, [orgId, newWorkspaceName, newWorkspaceDesc, showToast, loadData]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!deleteOpen.workspaceId) return;

    setDeleteLoading(true);
    try {
      await deleteWorkspace(deleteOpen.workspaceId);
      showToast("success", "Xóa workspace thành công!");
      setDeleteOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteOpen.workspaceId, showToast, loadData]);

  const handleEditWorkspace = useCallback(async () => {
    if (!editOpen.workspaceId || !editOpen.workspaceName?.trim()) {
      showToast("error", "Vui lòng nhập tên workspace");
      return;
    }

    setEditLoading(true);
    try {
      await updateWorkspace(editOpen.workspaceId, {
        workspaceName: editOpen.workspaceName.trim(),
        description: editOpen.workspaceDesc?.trim() || undefined,
      });
      showToast("success", "Cập nhật workspace thành công!");
      setEditOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setEditLoading(false);
    }
  }, [editOpen, showToast, loadData]);

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  if (err || !org) return <div className="max-w-3xl px-4 text-red-400">{err ?? "Không tìm thấy tổ chức."}</div>;

  return (
    <div className="min-w-0 relative px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">Workspaces</h1>
            <h4 className="text-sm text-zinc-400">{org.orgName}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            New Workspace
          </button>
        </div>
      </div>

      {/* View Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-sm text-zinc-100"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="dateCreated">Date created</option>
            <option value="recentlyModified">Recently modified</option>
            <option value="name">Name</option>
          </select>
          <button
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Workspaces List */}
      {sortedWorkspaces.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">No workspaces yet</h3>
          <p className="text-zinc-400 mb-4">Create your first workspace to organize your maps</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Workspace
          </button>
        </div>
      )}

      {sortedWorkspaces.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedWorkspaces.map((workspace) => (
            <div
              key={workspace.workspaceId}
              className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4"
            >
              <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{workspace.workspaceName || "Untitled"}</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {workspace.description ||
                      (workspace.isPersonal ? workspace.personalLabel ?? "Không thuộc tổ chức" : "No description")}
                  </div>
                  {workspace.isPersonal && (
                    <div className="mt-1 text-[11px] text-emerald-300">
                      {workspace.orgName} · {workspace.personalLabel ?? "Không thuộc tổ chức"}
                    </div>
                  )}
                  <div className="text-xs text-zinc-500">
                    {workspace.createdAt ? formatDate(workspace.createdAt) : "—"}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    className="p-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
                    onClick={() => {
                      setEditOpen({
                        open: true,
                        workspaceId: workspace.workspaceId,
                        workspaceName: workspace.workspaceName || "",
                        workspaceDesc: workspace.description || "",
                      });
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="p-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300"
                    onClick={() => {
                      setDeleteOpen({
                        open: true,
                        workspaceId: workspace.workspaceId,
                        workspaceName: workspace.workspaceName || "Untitled",
                      });
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${workspace.workspaceId}`)}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                >
                  View Workspace
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sortedWorkspaces.length > 0 && viewMode === "list" && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sortedWorkspaces.map((workspace) => (
                <tr key={workspace.workspaceId} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <button
                      className="text-emerald-300 hover:underline"
                      onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${workspace.workspaceId}`)}
                    >
                      {workspace.workspaceName || "Untitled"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {workspace.description ||
                      (workspace.isPersonal ? workspace.personalLabel ?? "Không thuộc tổ chức" : "—")}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {workspace.createdAt ? formatDate(workspace.createdAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => {
                          setEditOpen({
                            open: true,
                            workspaceId: workspace.workspaceId,
                            workspaceName: workspace.workspaceName || "",
                            workspaceDesc: workspace.description || "",
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
                        onClick={() => {
                          setDeleteOpen({
                            open: true,
                            workspaceId: workspace.workspaceId,
                            workspaceName: workspace.workspaceName || "Untitled",
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Workspace Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Workspace</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace Name *</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  placeholder="Enter workspace description (optional)"
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
                onClick={() => void handleCreateWorkspace()}
                disabled={createLoading || !newWorkspaceName.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {createLoading ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Workspace Modal */}
      {editOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Edit Workspace</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Workspace Name *</label>
                <input
                  type="text"
                  value={editOpen.workspaceName || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, workspaceName: e.target.value })}
                  placeholder="Enter workspace name"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={editOpen.workspaceDesc || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, workspaceDesc: e.target.value })}
                  placeholder="Enter workspace description (optional)"
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
                onClick={() => void handleEditWorkspace()}
                disabled={editLoading || !editOpen.workspaceName?.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Modal */}
      {deleteOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Delete Workspace</h2>
            <p className="text-sm text-zinc-300 mb-6">
              Are you sure you want to delete the workspace <span className="font-semibold">{deleteOpen.workspaceName}</span>?
              This action cannot be undone and will remove all maps associated with this workspace.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setDeleteOpen({ open: false })}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteWorkspace()}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Delete Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
