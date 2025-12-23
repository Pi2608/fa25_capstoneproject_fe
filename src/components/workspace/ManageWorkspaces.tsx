"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
  getWorkspacesByOrganization,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  type CreateWorkspaceRequest,
} from "@/lib/api-workspaces";
import type { Workspace } from "@/types/workspace";
import { useI18n } from "@/i18n/I18nProvider";

type Props = {
  orgId: string;
  canManage: boolean;
  onWorkspaceCreated?: () => void;
  onWorkspaceDeleted?: () => void;
};

export type ManageWorkspacesHandle = {
  open: () => void;
};

const ManageWorkspaces = forwardRef<ManageWorkspacesHandle, Props>(
  (
    { orgId, canManage, onWorkspaceCreated, onWorkspaceDeleted },
    ref
  ) => {

    const { t } = useI18n();
    const { resolvedTheme, theme } = useTheme();
    const isDark = (resolvedTheme ?? theme ?? "light") === "dark";
    const themeClasses = getThemeClasses(isDark);

    const [open, setOpen] = useState(false);
    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Workspace[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const [creating, setCreating] = useState(false);
    const [createName, setCreateName] = useState("");

    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editBusyId, setEditBusyId] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

    const reload = useCallback(async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await getWorkspacesByOrganization(orgId);
        setItems(list);
      } catch {
        setErr(t("org_workspace.manage_load_failed"));
      } finally {
        setLoading(false);
      }
    }, [orgId, t]);

    useEffect(() => {
      if (!open) return;
      void reload();
    }, [open, reload]);

    const onCreate = async () => {
      if (!canManage) return;
      const name = createName.trim();
      if (!name) return;
      setCreating(true);
      try {
        const req: CreateWorkspaceRequest = { orgId, workspaceName: name };
        await createWorkspace(req);
        setCreateName("");
        await reload();
        // Notify parent to refresh its workspace list
        onWorkspaceCreated?.();
      } finally {
        setCreating(false);
      }
    };

    const onStartRename = (w: Workspace) => {
      setEditId(w.workspaceId);
      setEditName(w.workspaceName || "");
    };

    const onSaveRename = async (w: Workspace) => {
      if (!canManage) return;
      const name = editName.trim() || "Untitled";
      setEditBusyId(w.workspaceId);
      try {
        await updateWorkspace(w.workspaceId, {
          workspaceName: name,
          description: w.description ?? "",
        });
        setEditId(null);
        setEditName("");
        await reload();
      } finally {
        setEditBusyId(null);
      }
    };

    const onAskDelete = (w: Workspace) => {
      if (!canManage) return;
      setErr(null);
      setDeleteId(w.workspaceId);
    };

    const onConfirmDelete = async () => {
      if (!deleteId) return;
      setDeleteBusyId(deleteId);
      try {
        // 1) Gọi GET /workspaces/{id} trước
        const ws = await getWorkspaceById(deleteId);

        // Nếu backend trả về số lượng question bank trong workspace, ta check luôn
        const qbCount =
          (ws as any)?.questionBankCount ??
          (ws as any)?.questionBanksCount ??
          0;

        if (qbCount > 0) {
          // Không gọi DELETE nữa, báo lỗi rõ ràng cho user
          setErr(
            t("org_workspace.manage_err_has_question_banks", {
              count: qbCount,
            })
          );
          return;
        }

        // 2) Không có question bank → gọi DELETE /workspaces/{id}
        await deleteWorkspace(deleteId);
        setDeleteId(null);
        await reload();
        // Notify parent to refresh its workspace list
        onWorkspaceDeleted?.();
      } catch {
        setErr(t("org_workspace.manage_delete_failed"));
      } finally {
        setDeleteBusyId(null);
      }
    };

    const disabledActions = useMemo(() => !canManage, [canManage]);

    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className={`px-3 py-2 rounded-lg border text-sm transition-colors ${themeClasses.buttonOutline}`}
        >
          {t("org_workspace.manage_ws")}
        </button>

        {open && (
          <div className={`fixed inset-0 z-50 grid place-items-center backdrop-blur-sm ${themeClasses.dialogOverlay}`}>
            <div className={`w-[56rem] max-w-[95vw] rounded-2xl border p-5 shadow-2xl ${themeClasses.dialog}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${themeClasses.text}`}>
                  {t("org_workspace.manage_title")}
                </h2>
                <button
                  className={`transition-colors ${themeClasses.textMuted} ${themeClasses.hover}`}
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 flex items-end gap-2">
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${themeClasses.textMuted}`}>
                    {t("org_workspace.manage_name_label")}
                  </label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    disabled={disabledActions}
                    placeholder={t("org_workspace.manage_name_placeholder")}
                    className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                  />
                </div>
                <button
                  onClick={() => void onCreate()}
                  disabled={creating || disabledActions}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                  {creating
                    ? t("org_workspace.manage_creating")
                    : t("org_workspace.manage_create")}
                </button>
              </div>

              {err && (
                <div className="mb-3 text-sm text-red-400">
                  {err}
                </div>
              )}
              {loading && (
                <div className={`mb-3 text-sm ${themeClasses.textMuted}`}>
                  {t("org_workspace.manage_loading")}
                </div>
              )}

              <div className={`max-h-[46vh] overflow-auto rounded-lg border ${themeClasses.tableContainer}`}>
                <table className="w-full text-sm">
                  <thead className={themeClasses.tableHeader}>
                    <tr>
                      <th className="text-left px-3 py-2 w-[38%]">
                        {t("org_workspace.manage_table_name")}
                      </th>
                      <th className="text-left px-3 py-2">
                        {t("org_workspace.manage_table_desc")}
                      </th>
                      <th className="text-left px-3 py-2 w-24">
                        {t("org_workspace.manage_table_maps")}
                      </th>
                      <th className="text-right px-3 py-2 w-56">
                        {t("org_workspace.manage_table_actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${themeClasses.tableCell}`}>
                    {items.map((w) => (
                      <tr
                        key={w.workspaceId}
                        className={themeClasses.tableRowHover}
                      >
                        <td className="px-3 py-2">
                          {editId === w.workspaceId ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={`w-full rounded-md border px-2 py-1 text-sm ${themeClasses.input}`}
                            />
                          ) : (
                            <div className={`truncate ${themeClasses.text}`}>
                              {w.workspaceName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className={`truncate ${themeClasses.textMuted}`}>
                            {w.description ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {w.mapCount ?? 0}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            {editId === w.workspaceId ? (
                              <>
                                <button
                                  onClick={() => void onSaveRename(w)}
                                  disabled={
                                    editBusyId === w.workspaceId ||
                                    disabledActions
                                  }
                                  className="px-2 py-1 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {editBusyId === w.workspaceId
                                    ? t("org_workspace.manage_saving")
                                    : t("org_workspace.manage_save")}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditId(null);
                                    setEditName("");
                                  }}
                                  className={`px-2 py-1 rounded-md border text-xs transition-colors ${themeClasses.buttonOutline}`}
                                >
                                  {t("org_workspace.cancel")}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => onStartRename(w)}
                                  disabled={disabledActions}
                                  className={`px-2 py-1 rounded-md border text-xs transition-colors disabled:opacity-60 ${themeClasses.buttonGhost}`}
                                >
                                  {t("org_workspace.manage_rename")}
                                </button>
                                <button
                                  onClick={() => onAskDelete(w)}
                                  disabled={disabledActions}
                                  className="px-2 py-1 rounded-md border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 disabled:opacity-60"
                                >
                                  {t("org_workspace.manage_delete")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-8 text-center text-zinc-400"
                        >
                          {t("org_workspace.manage_no_ws")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                >
                  {t("org_workspace.close")}
                </button>
              </div>
            </div>

            {deleteId && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/70">
                <div className="w-[28rem] max-w-[95vw] rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
                  <h3 className="text-white font-semibold mb-2 text-lg">
                    {t("org_workspace.manage_delete_title")}
                  </h3>
                  <p className="text-sm text-zinc-300 mb-4">
                    {t("org_workspace.manage_delete_desc")}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                    >
                      {t("org_workspace.cancel")}
                    </button>
                    <button
                      onClick={() => void onConfirmDelete()}
                      disabled={deleteBusyId === deleteId}
                      className="px-3 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
                    >
                      {deleteBusyId === deleteId
                        ? t("org_workspace.manage_deleting")
                        : t("org_workspace.manage_delete")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });
ManageWorkspaces.displayName = "ManageWorkspaces";
export default ManageWorkspaces;

