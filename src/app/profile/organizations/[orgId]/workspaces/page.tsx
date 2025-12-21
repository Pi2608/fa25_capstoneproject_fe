"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/contexts/ToastContext";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";
import { getOrganizationById, OrganizationDetailDto } from "@/lib/api-organizations";
import { createWorkspace, CreateWorkspaceRequest, deleteWorkspace, getWorkspacesByOrganization, updateWorkspace } from "@/lib/api-workspaces";
import { useI18n, TFunc } from "@/i18n/I18nProvider";
import { getThemeClasses } from "@/utils/theme-utils";

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

type ApiErr = {
  status?: number;
  type?: string;
  title?: string;
  detail?: string;
  message?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function pickStr(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}
function pickNum(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  return typeof v === "number" ? v : undefined;
}

function parseApiError(err: unknown): ApiErr {
  if (isRecord(err)) {
    return {
      status: pickNum(err, "status"),
      type: pickStr(err, "type"),
      title: pickStr(err, "title"),
      detail: pickStr(err, "detail"),
      message: pickStr(err, "message"),
    };
  }
  if (typeof err === "string") {
    try {
      const parsed = JSON.parse(err);
      if (isRecord(parsed)) {
        return {
          status: pickNum(parsed, "status"),
          type: pickStr(parsed, "type"),
          title: pickStr(parsed, "title"),
          detail: pickStr(parsed, "detail"),
          message: pickStr(parsed, "message"),
        };
      }
    } catch {
      return { message: err };
    }
  }
  if (err instanceof Error) return { message: err.message };
  return {};
}

function userMessage(
  err: unknown,
  t: TFunc
): string {
  const e = parseApiError(err);
  const code = String(e.type || e.title || "").toLowerCase();
  const text = String(e.detail || e.message || "").toLowerCase();
  const status = e.status ?? 0;

  if (status === 400) {
    if( text.includes("active") && text.includes("workspaces"))
      {
        return t("org_detail.manage_err_has_active_workspaces");
      }
    return t("org_detail.manage_delete_failed")
  }

  if (e.detail && !/stack|trace|exception/i.test(e.detail)) return e.detail;
  if (e.message && !/stack|trace|exception/i.test(e.message)) return e.message;
  return t("org_detail.err_generic");
}

export default function WorkspacesPage() {
  const p = useParams<{ orgId: string }>();
  const orgId = p?.orgId ?? "";
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme ?? "light") === "dark";
  const themeClasses = getThemeClasses(isDark);

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
      showToast("success", t("workspaces", "ws_create_success"));
      setCreateOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDesc("");
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setCreateLoading(false);
    }
  }, [orgId, newWorkspaceName, newWorkspaceDesc, showToast, loadData, t]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!deleteOpen.workspaceId) return;

    setDeleteLoading(true);
    try {
      await deleteWorkspace(deleteOpen.workspaceId);
      showToast("success", t("workspaces", "ws_delete_success"));
      setDeleteOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteOpen.workspaceId, showToast, loadData, t]);

  const handleEditWorkspace = useCallback(async () => {
    if (!editOpen.workspaceId || !editOpen.workspaceName?.trim()) {
      showToast("error", t("workspaces", "ws_name_required"));
      return;
    }

    setEditLoading(true);
    try {
      await updateWorkspace(editOpen.workspaceId, {
        workspaceName: editOpen.workspaceName.trim(),
        description: editOpen.workspaceDesc?.trim() || undefined,
      });
      showToast("success", t("workspaces", "ws_update_success"));
      setEditOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setEditLoading(false);
    }
  }, [editOpen, showToast, loadData, t]);

  if (loading) return <div className={`min-h-[60vh] animate-pulse px-4 ${themeClasses.textMuted}`}>{t("workspaces", "loading")}</div>;
  if (err || !org) return <div className="max-w-3xl px-4 text-red-500">{err ?? t("workspaces", "ws_not_found")}</div>;

  return (
    <div className="min-w-0 relative px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-semibold ${themeClasses.text}`}>Workspaces</h1>
            <h4 className={`text-sm ${themeClasses.textMuted}`}>{org.orgName}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400"
          >
            New Workspace
          </button>
        </div>
      </div>

      {/* View Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex rounded-lg border overflow-hidden ${isDark ? "border-zinc-700" : "border-gray-300"}`}>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? themeClasses.tabActive : themeClasses.tabInactive} ${themeClasses.text}`}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? themeClasses.tabActive : themeClasses.tabInactive} ${themeClasses.text}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className={`rounded-md border px-2 py-1 text-sm ${themeClasses.selectDropdown}`}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="dateCreated">Date created</option>
            <option value="recentlyModified">Recently modified</option>
            <option value="name">Name</option>
          </select>
          <button
            className={`p-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Workspaces List */}
      {sortedWorkspaces.length === 0 && (
        <div className={`rounded-xl border p-8 text-center ${themeClasses.card}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
            <svg className={`w-8 h-8 ${themeClasses.iconMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${themeClasses.text}`}>No workspaces yet</h3>
          <p className={`mb-4 ${themeClasses.textMuted}`}>Create your first workspace to organize your maps</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400"
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
              className={`group rounded-xl border transition p-4 ${themeClasses.card}`}
            >
              <div className={`h-32 w-full rounded-lg border mb-3 grid place-items-center text-xs ${themeClasses.cardThumbnail}`}>
                <svg className={`w-8 h-8 ${themeClasses.iconMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-semibold ${themeClasses.text}`}>{workspace.workspaceName || "Untitled"}</div>
                  <div className={`text-xs truncate ${themeClasses.textMuted}`}>
                    {workspace.description ||
                      "No description"}
                  </div>
                  <div className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-400"}`}>
                    {workspace.createdAt ? formatDate(workspace.createdAt) : "—"}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    className={`p-1 rounded border text-xs ${themeClasses.buttonGhost}`}
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
                    className="p-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400"
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
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
                >
                  View Workspace
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sortedWorkspaces.length > 0 && viewMode === "list" && (
        <div className={`rounded-xl border overflow-hidden ${themeClasses.tableContainer}`}>
          <table className="w-full text-sm">
            <thead className={themeClasses.tableHeader}>
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${themeClasses.tableCell}`}>
              {sortedWorkspaces.map((workspace) => (
                <tr key={workspace.workspaceId} className={themeClasses.tableRowHover}>
                  <td className="px-3 py-2">
                    <button
                      className={`hover:underline ${isDark ? "text-emerald-300" : "text-emerald-600"}`}
                      onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${workspace.workspaceId}`)}
                    >
                      {workspace.workspaceName || "Untitled"}
                    </button>
                  </td>
                  <td className={`px-3 py-2 ${themeClasses.textMuted}`}>
                    {workspace.description ||
                      "—"}
                  </td>
                  <td className={`px-3 py-2 ${themeClasses.textMuted}`}>
                    {workspace.createdAt ? formatDate(workspace.createdAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className={`text-xs px-2 py-1 rounded border ${themeClasses.buttonGhost}`}
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
                        className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400"
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
        <div className={`fixed inset-0 z-50 grid place-items-center backdrop-blur-sm ${themeClasses.dialogOverlay}`}>
          <div className={`w-[32rem] max-w-[95vw] rounded-xl border p-6 shadow-2xl ${themeClasses.dialog}`}>
            <h2 className={`text-xl font-semibold mb-4 ${themeClasses.text}`}>{t("workspaces", "modal_ws_create_title")}</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>{t("workspaces", "ws_name_label")}</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder={t("workspaces", "ph_ws_name")}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                  autoFocus
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>{t("workspaces", "ws_description_label")}</label>
                <textarea
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  placeholder={t("workspaces", "ph_ws_desc")}
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
                onClick={() => setCreateOpen(false)}
              >
                {t("workspaces", "btn_ws_cancel")}
              </button>
              <button
                onClick={() => void handleCreateWorkspace()}
                disabled={createLoading || !newWorkspaceName.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {createLoading ? t("workspaces", "btn_ws_creating") : t("workspaces", "btn_ws_create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Workspace Modal */}
      {editOpen.open && (
        <div className={`fixed inset-0 z-50 grid place-items-center backdrop-blur-sm ${themeClasses.dialogOverlay}`}>
          <div className={`w-[32rem] max-w-[95vw] rounded-xl border p-6 shadow-2xl ${themeClasses.dialog}`}>
            <h2 className={`text-xl font-semibold mb-4 ${themeClasses.text}`}>{t("workspaces", "modal_ws_edit_title")}</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>{t("workspaces", "ws_name_label")}</label>
                <input
                  type="text"
                  value={editOpen.workspaceName || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, workspaceName: e.target.value })}
                  placeholder={t("workspaces", "ph_ws_name")}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                  autoFocus
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>{t("workspaces", "ws_description_label")}</label>
                <textarea
                  value={editOpen.workspaceDesc || ""}
                  onChange={(e) => setEditOpen({ ...editOpen, workspaceDesc: e.target.value })}
                  placeholder={t("workspaces", "ph_ws_desc")}
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
                onClick={() => setEditOpen({ open: false })}
              >
                {t("workspaces", "btn_ws_cancel")}
              </button>
              <button
                onClick={() => void handleEditWorkspace()}
                disabled={editLoading || !editOpen.workspaceName?.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {editLoading ? t("workspaces", "btn_ws_editing") : t("workspaces", "btn_ws_edit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Modal */}
      {deleteOpen.open && (
        <div className={`fixed inset-0 z-50 grid place-items-center backdrop-blur-sm ${themeClasses.dialogOverlay}`}>
          <div className={`w-[32rem] max-w-[95vw] rounded-xl border p-6 shadow-2xl ${themeClasses.dialog}`}>
            <h2 className={`text-xl font-semibold mb-4 ${themeClasses.text}`}>Delete Workspace</h2>
            <p className={`text-sm mb-6 ${themeClasses.textMuted}`}>
              Are you sure you want to delete the workspace <span className={`font-semibold ${themeClasses.text}`}>{deleteOpen.workspaceName}</span>?
              This action cannot be undone and will remove all maps associated with this workspace.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
                onClick={() => setDeleteOpen({ open: false })}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteWorkspace()}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
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
