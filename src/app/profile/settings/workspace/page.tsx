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
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

type Role = "Owner" | "Admin" | "Member" | "Viewer" | string;

export default function WorkspacePage() {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [wsDetail, setWsDetail] = useState<Workspace | null>(null);
  const [maps, setMaps] = useState<MapDto[]>([]);
  const [busy, setBusy] = useState(false);
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
        if (list.length > 0) setToast(null);
        const saved = typeof window !== "undefined" ? localStorage.getItem("imos:selectedOrgId") : null;
        if (saved && list.some(o => o.orgId === saved)) setSelectedOrgId(saved);
        else if (list.length) setSelectedOrgId(list[0].orgId);
      } catch {
        setOrgs([]);
        setToast(t("workspaces.toast_orgs_load_failed"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

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
    } catch {
      setToast(t("workspaces.toast_action_failed"));
    } finally {
      setWsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedOrgId) return;
    if (typeof window !== "undefined") localStorage.setItem("imos:selectedOrgId", selectedOrgId);
    void loadWorkspaces(selectedOrgId);
  }, [selectedOrgId, loadWorkspaces]);

  const loadDetail = useCallback(async (wsId: string) => {
    setBusy(true);
    try {
      const d = await getWorkspaceById(wsId);
      const m = await getWorkspaceMaps(wsId);
      setWsDetail(d);
      setNameInput(d.workspaceName || "");
      setDescInput(d.description || "");
      setMaps(m);
    } catch {
      setWsDetail(null);
      setToast(t("workspaces.toast_action_failed"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedWsId) return;
    void loadDetail(selectedWsId);
  }, [selectedWsId, loadDetail]);

  const onCreateWorkspace = async () => {
    if (!canManage || !selectedOrgId) return;
    const title = prompt(t("workspaces.prompt_new_workspace"));
    if (!title) return;
    try {
      const req: CreateWorkspaceRequest = { orgId: selectedOrgId, workspaceName: title };
      await createWorkspace(req);
      await loadWorkspaces(selectedOrgId);
      setToast(t("workspaces.toast_create_success"));
    } catch {
      setToast(t("workspaces.toast_action_failed"));
    }
  };

  const onSaveBasics = async () => {
    if (!canManage || !wsDetail) return;
    setBusy(true);
    try {
      await updateWorkspace(wsDetail.workspaceId, {
        workspaceName: nameInput.trim() || t("workspaces.placeholder_untitled"),
        description: descInput,
      });
      const d = await getWorkspaceById(wsDetail.workspaceId);
      setWsDetail(d);
      setWorkspaces(prev => prev.map(w => (w.workspaceId === d.workspaceId ? d : w)));
      setToast(t("workspaces.toast_saved"));
    } catch {
      setToast(t("workspaces.toast_action_failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteWorkspace = async () => {
    if (!canManage || !wsDetail || !selectedOrgId) return;
    if (!confirm(`${t("workspaces.confirm_delete")} "${wsDetail.workspaceName}"?`)) return;
    setBusy(true);
    try {
      await deleteWorkspace(wsDetail.workspaceId);
      await loadWorkspaces(selectedOrgId);
      setWsDetail(null);
      setToast(t("workspaces.toast_deleted"));
    } catch {
      setToast(t("workspaces.toast_action_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("workspaces.title")}</h2>
            <p className={`text-sm ${themeClasses.textMuted}`}>
              {t("workspaces.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${themeClasses.textMuted}`}>{t("workspaces.org_label")}</span>
              <select
                className={`rounded-lg border px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.select} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
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
          </div>
        </div>

        {toast && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          {/* Danh sách workspace */}
          <div className={`rounded-2xl shadow-sm ring-1 ${themeClasses.panel} ${isDark ? "ring-white/10" : "ring-gray-200"}`}>
            <div className={`border-b px-4 py-3 text-sm font-medium ${themeClasses.tableBorder} ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
              {t("workspaces.list_title")}
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {wsLoading && <div className={`px-4 py-4 text-sm ${themeClasses.textMuted}`}>{t("workspaces.loading")}</div>}
              {!wsLoading && workspaces.length === 0 && (
                <div className={`px-4 py-4 text-sm ${themeClasses.textMuted}`}>{t("workspaces.empty_list")}</div>
              )}
              {!wsLoading &&
                workspaces.map((w) => {
                  const active = selectedWsId === w.workspaceId;
                  return (
                    <button
                      key={w.workspaceId}
                      onClick={() => setSelectedWsId(w.workspaceId)}
                      className={`w-full px-4 py-4 text-left transition border-top ${
                        active ? (isDark ? "bg-emerald-500/10" : "bg-emerald-50/70") : (isDark ? "hover:bg-white/5" : "hover:bg-gray-50")
                      } ${themeClasses.tableBorder}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`line-clamp-1 font-medium ${isDark ? "text-zinc-50" : "text-gray-900"}`}>{w.workspaceName}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${themeClasses.textMuted} ${themeClasses.tableBorder}`}>
                          {w.isPersonal ? t("workspaces.personal_badge") : w.orgName || "—"}
                        </span>
                      </div>
                      {w.description && (
                        <div className={`mt-1 line-clamp-2 text-xs ${themeClasses.textMuted}`}>{w.description}</div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Chi tiết workspace */}
          <div className="space-y-6">
            <div className={`rounded-2xl shadow-sm ring-1 ${themeClasses.panel} ${isDark ? "ring-white/10" : "ring-gray-200"}`}>
              <div className={`border-b px-5 py-3 text-sm font-medium ${themeClasses.tableBorder} ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
                {t("workspaces.section_basics")}
              </div>
              {!wsDetail && (
                <div className={`px-5 py-5 text-sm ${themeClasses.textMuted}`}>
                  {t("workspaces.select_workspace_hint")}
                </div>
              )}
              {wsDetail && (
                <div className="p-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("workspaces.field_name")}</label>
                      <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={!canManage || busy}
                        className={`w-full rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ${themeClasses.input} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
                        placeholder={t("workspaces.placeholder_untitled")}
                      />
                    </div>
                    <button
                      onClick={onSaveBasics}
                      disabled={!canManage || busy}
                      className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busy ? t("workspaces.saving") : t("workspaces.btn_save_changes")}
                    </button>
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("workspaces.field_description")}</label>
                    <textarea
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                      disabled={!canManage || busy}
                      rows={3}
                      className={`w-full resize-y rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ${themeClasses.input} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
                      placeholder={t("workspaces.placeholder_desc")}
                    />
                  </div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>
                    {wsDetail.updatedAt ? `${t("workspaces.updated_prefix")} ${formatDateTime(wsDetail.updatedAt)}` : ""}
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách bản đồ */}
            <div className={`rounded-2xl shadow-sm ring-1 ${themeClasses.panel} ${isDark ? "ring-white/10" : "ring-gray-200"}`}>
              <div className={`border-b px-5 py-3 text-sm font-medium ${themeClasses.tableBorder} ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
                {t("workspaces.section_maps")}
              </div>
              {!wsDetail && (
                <div className={`px-5 py-5 text-sm ${themeClasses.textMuted}`}>{t("workspaces.select_workspace_maps_hint")}</div>
              )}
              {wsDetail && (
                <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {maps.length === 0 && (
                    <div className={`text-sm ${themeClasses.textMuted}`}>{t("workspaces.no_maps")}</div>
                  )}
                  {maps.map((m) => (
                    <div key={m.mapId} className={`rounded-xl border p-3 ${themeClasses.tableBorder}`}>
                      <div className={`truncate text-sm font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                        {"name" in m ? (m as { name: string }).name : (m as { mapName: string }).mapName}
                      </div>
                      <div className={`text-xs ${themeClasses.textMuted}`}>
                        {m.updatedAt ? formatDateTime(m.updatedAt) : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger zone */}
            <div className={`rounded-2xl shadow-sm ring-1 ${themeClasses.panel} ${isDark ? "ring-white/10" : "ring-gray-200"}`}>
              <div className={`border-b px-5 py-3 text-sm font-medium ${themeClasses.tableBorder} ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
                {t("workspaces.section_danger")}
              </div>
              <div className="p-5">
                <button
                  onClick={onDeleteWorkspace}
                  disabled={!canManage || !wsDetail || busy}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-60"
                >
                  {t("workspaces.btn_delete")}
                </button>
                {!canManage && (
                  <div className={`mt-2 text-xs ${themeClasses.textMuted}`}>
                    {t("workspaces.delete_permission_hint")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
