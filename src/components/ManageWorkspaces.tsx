"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getWorkspacesByOrganization,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  type CreateWorkspaceRequest,
} from "@/lib/api-workspaces";
import type { Workspace } from "@/types/workspace";

type Props = { orgId: string; canManage: boolean };

export default function ManageWorkspaces({ orgId, canManage }: Props) {
  const [open, setOpen] = useState(false);
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

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
      await updateWorkspace(w.workspaceId, { workspaceName: name, description: w.description ?? "" });
      setEditId(null);
      setEditName("");
      await reload();
    } finally {
      setEditBusyId(null);
    }
  };

  const onAskDelete = (w: Workspace) => {
    if (!canManage) return;
    setDeleteId(w.workspaceId);
  };

  const onConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusyId(deleteId);
    try {
      await deleteWorkspace(deleteId);
      setDeleteId(null);
      await reload();
    } finally {
      setDeleteBusyId(null);
    }
  };

  const disabledActions = useMemo(() => !canManage, [canManage]);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
      >
        Manage Workspaces
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[56rem] max-w-[95vw] rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Manage Workspaces</h2>
              <button className="text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Workspace name</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={disabledActions}
                  placeholder="New workspace"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <button
                onClick={() => void onCreate()}
                disabled={creating || disabledActions}
                className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>

            {err && <div className="mb-3 text-sm text-red-300">{err}</div>}
            {loading && <div className="mb-3 text-sm text-zinc-300">Loading…</div>}

            <div className="max-h-[46vh] overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-zinc-300">
                  <tr>
                    <th className="text-left px-3 py-2 w-[38%]">Name</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2 w-24">Maps</th>
                    <th className="text-right px-3 py-2 w-56">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.workspaceId} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        {editId === w.workspaceId ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-sm text-zinc-100"
                          />
                        ) : (
                          <div className="truncate text-zinc-100">{w.workspaceName}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate text-zinc-300">{w.description ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">{w.mapCount ?? 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          {editId === w.workspaceId ? (
                            <>
                              <button
                                onClick={() => void onSaveRename(w)}
                                disabled={editBusyId === w.workspaceId || disabledActions}
                                className="px-2 py-1 rounded-md bg-emerald-500 text-zinc-900 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-60"
                              >
                                {editBusyId === w.workspaceId ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={() => { setEditId(null); setEditName(""); }}
                                className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => onStartRename(w)}
                                disabled={disabledActions}
                                className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs hover:bg-white/10 disabled:opacity-60"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => onAskDelete(w)}
                                disabled={disabledActions}
                                className="px-2 py-1 rounded-md border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-zinc-400">No workspaces</td>
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
                Close
              </button>
            </div>
          </div>

          {deleteId && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/70">
              <div className="w-[28rem] max-w-[95vw] rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
                <h3 className="text-white font-semibold mb-2 text-lg">Delete workspace</h3>
                <p className="text-sm text-zinc-300 mb-4">This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void onConfirmDelete()}
                    disabled={deleteBusyId === deleteId}
                    className="px-3 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
                  >
                    {deleteBusyId === deleteId ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
