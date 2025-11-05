"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyOrganizations, type MyOrganizationDto } from "@/lib/api-organizations";
import {
  createWorkspace,
  type CreateWorkspaceRequest,
  getWorkspacesByOrganization,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMaps,
} from "@/lib/api-workspaces";
import type { Workspace } from "@/types/workspace";
import type { MapDto } from "@/lib/api-maps";
import { formatDateTime } from "@/utils/formatUtils";

type Role = "Owner" | "Admin" | "Member" | "Viewer" | string;

function safeMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Thao tác thất bại";
}

export default function WorkspacePage() {
  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [wsDetail, setWsDetail] = useState<Workspace | null>(null);
  const [maps, setMaps] = useState<MapDto[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getMyOrganizations();
        const list = res.organizations ?? [];
        if (!alive) return;
        setOrgs(list);
        const saved = typeof window !== "undefined" ? localStorage.getItem("cmosm:selectedOrgId") : null;
        if (saved && list.some(o => o.orgId === saved)) setSelectedOrgId(saved);
        else if (list.length) setSelectedOrgId(list[0].orgId);
      } catch {
        setToast("Không tải được danh sách tổ chức");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const myRole: Role | null = useMemo(() => {
    if (!selectedOrgId) return null;
    const o = orgs.find(x => x.orgId === selectedOrgId);
    return o?.myRole ?? null;
  }, [orgs, selectedOrgId]);

  const canManage = useMemo(() => {
    const r = String(myRole || "").toLowerCase();
    return r === "owner" || r === "admin";
  }, [myRole]);

  const loadWorkspaces = useCallback(async (orgId: string) => {
    setWsLoading(true);
    setWorkspaces([]);
    setSelectedWsId(null);
    setWsDetail(null);
    setMaps([]);
    try {
      const list = await getWorkspacesByOrganization(orgId);
      setWorkspaces(list);
      if (list.length) setSelectedWsId(list[0].workspaceId);
    } catch (e) {
      setToast(safeMessage(e));
    } finally {
      setWsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    if (typeof window !== "undefined") localStorage.setItem("cmosm:selectedOrgId", selectedOrgId);
    void loadWorkspaces(selectedOrgId);
  }, [selectedOrgId, loadWorkspaces]);

  const loadDetail = useCallback(async (wsId: string) => {
    setDetailBusy(true);
    try {
      const d = await getWorkspaceById(wsId);
      const m = await getWorkspaceMaps(wsId);
      setWsDetail(d);
      setNameInput(d.workspaceName || "");
      setDescInput(d.description || "");
      setMaps(m);
    } catch (e) {
      setWsDetail(null);
      setToast(safeMessage(e));
    } finally {
      setDetailBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWsId) return;
    void loadDetail(selectedWsId);
  }, [selectedWsId, loadDetail]);

  const onCreateWorkspace = async () => {
    if (!canManage || !selectedOrgId) return;
    const title = prompt("Tên workspace mới");
    if (!title) return;
    try {
      const req: CreateWorkspaceRequest = { orgId: selectedOrgId, workspaceName: title };
      await createWorkspace(req);
      await loadWorkspaces(selectedOrgId);
      setToast("Tạo workspace thành công");
    } catch (e) {
      setToast(safeMessage(e));
    }
  };

  const onSaveBasics = async () => {
    if (!canManage || !wsDetail) return;
    setDetailBusy(true);
    try {
      await updateWorkspace(wsDetail.workspaceId, { workspaceName: nameInput.trim() || "Untitled", description: descInput });
      const d = await getWorkspaceById(wsDetail.workspaceId);
      setWsDetail(d);
      setWorkspaces(prev => prev.map(w => (w.workspaceId === d.workspaceId ? d : w)));
      setToast("Đã lưu thay đổi");
    } catch (e) {
      setToast(safeMessage(e));
    } finally {
      setDetailBusy(false);
    }
  };

  const onDeleteWorkspace = async () => {
    if (!canManage || !wsDetail || !selectedOrgId) return;
    if (!confirm(`Xoá workspace "${wsDetail.workspaceName}"?`)) return;
    setDetailBusy(true);
    try {
      await deleteWorkspace(wsDetail.workspaceId);
      await loadWorkspaces(selectedOrgId);
      setWsDetail(null);
      setToast("Đã xoá workspace");
    } catch (e) {
      setToast(safeMessage(e));
    } finally {
      setDetailBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Workspace</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Quản lý dự án, tên, mô tả và các thiết lập mặc định.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Organization</span>
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                value={selectedOrgId ?? ""}
                onChange={(e) => setSelectedOrgId(e.target.value || null)}
              >
                {orgs.map((o) => (
                  <option key={o.orgId} value={o.orgId}>
                    {o.orgName}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onCreateWorkspace}
              disabled={!canManage || !selectedOrgId}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
              title={canManage ? "Create workspace" : "Only Owner/Admin"}
            >
              + New workspace
            </button>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-white/10">
            <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:text-zinc-200">
              Workspaces
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {wsLoading && <div className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">Đang tải…</div>}
              {!wsLoading && workspaces.length === 0 && (
                <div className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">Chưa có workspace</div>
              )}
              {!wsLoading &&
                workspaces.map((w) => {
                  const active = selectedWsId === w.workspaceId;
                  return (
                    <button
                      key={w.workspaceId}
                      onClick={() => setSelectedWsId(w.workspaceId)}
                      className={`w-full px-4 py-4 text-left transition ${
                        active ? "bg-emerald-50/70 dark:bg-emerald-500/10" : "hover:bg-zinc-50 dark:hover:bg-white/5"
                      } border-t border-zinc-200 dark:border-white/5`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="line-clamp-1 font-medium text-zinc-900 dark:text-zinc-50">{w.workspaceName}</div>
                        <span className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600 ring-1 ring-zinc-200 dark:text-zinc-300 dark:ring-white/10">
                          {w.isPersonal ? "Personal" : w.orgName || "—"}
                        </span>
                      </div>
                      {w.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{w.description}</div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-white/10">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:text-zinc-200">
                Basics
              </div>
              {!wsDetail && (
                <div className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-400">Chọn một workspace để xem chi tiết</div>
              )}
              {wsDetail && (
                <div className="p-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Workspace name</label>
                      <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={!canManage || detailBusy}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        placeholder="Untitled"
                      />
                    </div>
                    <button
                      onClick={onSaveBasics}
                      disabled={!canManage || detailBusy}
                      className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {detailBusy ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Description</label>
                    <textarea
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                      disabled={!canManage || detailBusy}
                      rows={3}
                      className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      placeholder="Mô tả ngắn"
                    />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {wsDetail.updatedAt ? `Cập nhật: ${formatDateTime(wsDetail.updatedAt)}` : ""}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-white/10">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:text-zinc-200">
                Maps in workspace
              </div>
              {!wsDetail && <div className="px-5 py-5 text-sm text-zinc-600 dark:text-zinc-400">Chọn workspace để xem bản đồ</div>}
              {wsDetail && (
                <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {maps.length === 0 && <div className="text-sm text-zinc-500 dark:text-zinc-400">Chưa có bản đồ</div>}
                  {maps.map(m => (
                    <div key={m.mapId} className="rounded-xl border border-zinc-200 dark:border-white/10 p-3">
                      <div className="truncate text-sm font-medium">{(m as unknown as { name?: string; mapName?: string }).name ?? (m as unknown as { name?: string; mapName?: string }).mapName ?? m.mapId}</div>
                      <div className="text-xs text-zinc-500">{m.updatedAt ? formatDateTime(m.updatedAt) : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-white/10">
              <div className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-white/10 dark:text-zinc-200">
                Danger zone
              </div>
              <div className="p-5">
                <button
                  onClick={onDeleteWorkspace}
                  disabled={!canManage || !wsDetail || detailBusy}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-60"
                >
                  Delete workspace
                </button>
                {!canManage && <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Chỉ Owner/Admin có thể xoá.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
