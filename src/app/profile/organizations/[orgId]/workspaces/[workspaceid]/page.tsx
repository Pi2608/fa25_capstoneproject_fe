"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";
import { getOrganizationById, OrganizationDetailDto } from "@/lib/api-organizations";
import { createDefaultMap, deleteMap, getMapDetail } from "@/lib/api-maps";
import { getWorkspaceById, getWorkspaceMaps, removeMapFromWorkspace } from "@/lib/api-workspaces";
import { useI18n, type TFunc } from "@/i18n/I18nProvider";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name" | "author";

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {};
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
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
    if( text.includes("active") && text.includes("sessions"))
      {
        return t("workspace_detail.manage_err_has_active_sessions");
      }
    return t("workspace_detail.manage_delete_failed")
  }

  if (e.detail && !/stack|trace|exception/i.test(e.detail)) return e.detail;
  if (e.message && !/stack|trace|exception/i.test(e.message)) return e.message;
  return t("workspace_detail.err_generic");
}


export default function WorkspaceDetailPage() {
  const { t } = useI18n();
  const p = useParams<{ orgId: string; workspaceid: string }>();
  const orgId = p?.orgId ?? "";
  const workspaceId = p?.workspaceid ?? "";
  const router = useRouter();
  const { showToast } = useToast();

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [publishedMaps, setPublishedMaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [deleteMapOpen, setDeleteMapOpen] = useState<{
    open: boolean;
    mapId?: string;
    mapName?: string;
  }>({ open: false });
  const [deleteMapLoading, setDeleteMapLoading] = useState(false);

  const [publishedMenuOpenId, setPublishedMenuOpenId] = useState<string | null>(null);
  const [showCreateMapDialog, setShowCreateMapDialog] = useState(false);
  const [mapType, setMapType] = useState<"normal" | "storymap">("normal");

  const handleCreateMap = useCallback(async () => {
    try {
      const created = await createDefaultMap({
        name: t("workspace_detail.untitled_map"),
        workspaceId,
        isStoryMap: mapType === "storymap",
      });
      setShowCreateMapDialog(false);
      router.push(`/maps/${created.mapId}`);
    } catch (e) {
      showToast("error", safeMessage(e, t("workspace_detail.request_failed")));
    }
  }, [router, showToast, workspaceId, mapType, t]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [orgRes, workspaceRes, mapsRes] = await Promise.all([
        getOrganizationById(orgId),
        getWorkspaceById(workspaceId),
        getWorkspaceMaps(workspaceId),
      ]);
      setOrg(orgRes.organization);
      setWorkspace(workspaceRes);

      const mapsArray = Array.isArray(mapsRes) ? mapsRes : ((mapsRes as any)?.maps || []);
      const normalized = mapsArray.map((m: any) => ({
        id: m.id ?? m.mapId ?? m.map_id,
        name: m.name ?? m.mapName ?? m.map_name ?? "",
        createdAt: m.createdAt ?? m.created_at ?? m.PublishedAt ?? m.updated_at ?? null,
        ownerId: m.ownerId ?? m.userId ?? m.user_id ?? "",
      }));
      setMaps(normalized);

      const detailList = await Promise.all(
        normalized.map(async (m: any) => {
          try {
            const detail = await getMapDetail(m.id);
            return detail;
          } catch {
            return null;
          }
        })
      );

      const storyMaps = detailList
        .filter((d): d is any => {
          if (!d) return false;
          const anyD = d as any;

          const isStoryMap =
            anyD.isStoryMap ??
            anyD.is_storymap ??
            anyD.IsStoryMap ??
            false;

          const status = (anyD.status ?? anyD.Status ?? "")
            .toString()
            .toLowerCase();

          return Boolean(isStoryMap) && status === "published";
        })
        .map((d: any) => ({
          id: d.mapId ?? d.id ?? d.map_id,
          name: d.name ?? d.mapName ?? d.map_name ?? "",
          publishedAt:
            d.PublishedAt ??
            d.publishedAt ??
            d.updatedAt ??
            d.createdAt ??
            null,
        }));

      setPublishedMaps(storyMaps);

    } catch (e) {
      setErr(safeMessage(e, t("workspace_detail.request_failed")));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspaceId, t]);

  useEffect(() => {
    if (orgId && workspaceId) void loadData();
  }, [orgId, workspaceId, loadData]);

  const sortedMaps = useMemo(() => {
    const arr = [...maps];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      if (sortKey === "author") {
        return (a.ownerId || "").localeCompare(b.ownerId || "", undefined, { sensitivity: "base" });
      }
      const ad = new Date(a.createdAt ?? 0).getTime();
      const bd = new Date(b.createdAt ?? 0).getTime();
      return ad - bd;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [maps, sortKey, sortOrder]);

  const handleDeleteMap = useCallback(async () => {
    if (!deleteMapOpen.mapId) return;
    setDeleteMapLoading(true);
    try {
      await deleteMap(deleteMapOpen.mapId);
      showToast("success", "Đã xoá bản đồ.");
      setDeleteMapOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", userMessage(e, t));
    } finally {
      setDeleteMapLoading(false);
    }
  }, [deleteMapOpen.mapId, showToast, loadData]);

  const handleRemoveMapFromWorkspace = useCallback(
    async (mapId: string) => {
      try {
        await removeMapFromWorkspace(workspaceId, mapId);
        showToast("success", "Đã gỡ bản đồ khỏi workspace.");
        await loadData();
      } catch (e) {
        showToast("error", userMessage(e, t));
      }
    },
    [workspaceId, showToast, loadData]
  );

  const handleOpenCreateSession = useCallback(
    async (mapId: string) => {
      const search = new URLSearchParams({
        workspaceId,
        mapId,
      });
      router.push(
        `/profile/organizations/${orgId}/sessions/create?${search.toString()}`
      );
    },
    [orgId, workspaceId, router]
  );

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">{t("workspace_detail.loading")}</div>;
  if (err || !org || !workspace) return <div className="max-w-3xl px-4 text-red-400">{err ?? t("workspace_detail.not_found")}</div>;

  const deleteMapLabel = deleteMapOpen.mapName || "bản đồ này";

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/profile/organizations/${orgId}`)}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            title={t("workspace_detail.back_to_list")}
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">{workspace.workspaceName}</h1>
            <p className="text-sm text-zinc-400">{org.orgName}</p>
            {workspace.description && <p className="text-sm text-zinc-500 mt-1">{workspace.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateMapDialog(true)}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            {t("workspace_detail.create_map")}
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              {t("workspace_detail.mode_grid")}
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("list")}
            >
              {t("workspace_detail.mode_list")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-sm text-zinc-100"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            title={t("workspace_detail.sort_by")}
          >
            <option value="dateCreated">{t("workspace_detail.sort_date_created")}</option>
            <option value="recentlyModified">{t("workspace_detail.sort_recently_modified")}</option>
            <option value="name">{t("workspace_detail.sort_name")}</option>
            <option value="author">{t("workspace_detail.sort_author")}</option>
          </select>
          <button
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            title={sortOrder === "asc" ? t("workspace_detail.to_desc") : t("workspace_detail.to_asc")}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {sortedMaps.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">{t("workspace_detail.empty_title")}</h3>
          <p className="text-zinc-400 mb-4">{t("workspace_detail.empty_desc")}</p>
          <button
            onClick={() => setShowCreateMapDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("workspace_detail.create_map")}
          </button>
        </div>
      )}

      {sortedMaps.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedMaps.map((map) => (
            <div key={map.id} className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4">
              <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{map.name || t("workspace_detail.unnamed")}</div>
                  <div className="text-xs text-zinc-400">{map.createdAt ? formatDate(map.createdAt) : "—"}</div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    className="p-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
                    onClick={() => router.push(`/maps/${map.id}`)}
                    title={t("workspace_detail.edit")}
                  >
                    ✏️
                  </button>
                  <button
                    className="p-1 rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-xs text-orange-300"
                    onClick={() => void handleRemoveMapFromWorkspace(map.id)}
                    title={t("workspace_detail.remove_from_ws")}
                  >
                    📤
                  </button>
                  <button
                    className="p-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300"
                    onClick={() => {
                      setDeleteMapOpen({
                        open: true,
                        mapId: map.id,
                        mapName: map.name || t("workspace_detail.unnamed"),
                      });
                    }}
                    title={t("workspace_detail.delete")}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => router.push(`/maps/${map.id}`)}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                >
                  {t("workspace_detail.open_map")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sortedMaps.length > 0 && viewMode === "list" && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">{t("workspace_detail.col_name")}</th>
                <th className="text-left px-3 py-2">{t("workspace_detail.col_author")}</th>
                <th className="text-left px-3 py-2">{t("workspace_detail.col_created")}</th>
                <th className="px-3 py-2">{t("workspace_detail.col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sortedMaps.map((map) => (
                <tr key={map.id} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <button className="text-emerald-300 hover:underline" onClick={() => router.push(`/maps/${map.id}`)}>
                      {map.name || t("workspace_detail.unnamed")}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{map.ownerId || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{map.createdAt ? formatDate(map.createdAt) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => router.push(`/maps/${map.id}`)}
                      >
                        {t("workspace_detail.edit")}
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300"
                        onClick={() => void handleRemoveMapFromWorkspace(map.id)}
                      >
                        {t("workspace_detail.remove")}
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
                        onClick={() => {
                          setDeleteMapOpen({
                            open: true,
                            mapId: map.id,
                            mapName: map.name || t("workspace_detail.unnamed"),
                          });
                        }}
                      >
                        {t("workspace_detail.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {publishedMaps.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">
            {t("workspace_detail.storymap_section_title")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {publishedMaps.map((map) => (
              <div
                key={map.id}
                className="group relative rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-zinc-950/40 hover:border-emerald-400 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.5)] transition-all duration-200 p-4"
              >
                <div
                  className={`absolute top-3 right-3 transition ${publishedMenuOpenId === map.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                >
                  <div className="relative">
                    <button
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-900/60 hover:bg-emerald-800/80 text-xs text-zinc-100"
                      title={t("workspace_detail.storymap_menu_title")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPublishedMenuOpenId((prev) => (prev === map.id ? null : map.id));
                      }}
                    >
                      <span className="leading-none translate-y-[1px]">⋯</span>
                    </button>
                    {publishedMenuOpenId === map.id && (
                      <div
                        className="absolute right-0 mt-2 w-44 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-xl"
                        onMouseLeave={() => setPublishedMenuOpenId(null)}
                      >
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPublishedMenuOpenId(null);
                            setDeleteMapOpen({
                              open: true,
                              mapId: map.id,
                              mapName: map.name || t("workspace_detail.unnamed"),
                            });
                          }}
                        >
                          {t("workspace_detail.storymap_menu_delete")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4 h-28 w-full rounded-2xl border border-emerald-500/40 bg-[radial-gradient(circle_at_0_0,#22c55e33,transparent_55%),radial-gradient(circle_at_100%_0,#22c55e22,transparent_55%)] bg-emerald-950/40 flex items-center justify-center text-sm font-medium text-emerald-300">
                  {t("workspace_detail.storymap_published_badge")}
                </div>
                <div className="min-w-0 mb-3">
                  <div className="truncate font-semibold text-zinc-50">
                    {map.name || t("workspace_detail.unnamed")}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {map.publishedAt
                      ? t("workspace_detail.storymap_publish_at", {
                        date: formatDate(map.publishedAt),
                      })
                      : t("workspace_detail.storymap_publish_unknown")}
                  </div>

                </div>
                <div className="flex flex-col gap-2 mt-auto">
                  <button
                    onClick={() => router.push(`/storymap/${map.id}`)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 hover:bg-zinc-800"
                  >
                    {t("workspace_detail.storymap_open_btn")}
                  </button>
                  <button
                    onClick={() => void handleOpenCreateSession(map.id)}
                    className="w-full px-3 py-2 rounded-xl bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
                  >
                    {t("workspace_detail.storymap_create_session_btn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {publishedMaps.length === 0 && (
        <div className="mt-10 text-sm text-zinc-500">
          {t("workspace_detail.storymap_empty_text")}
        </div>
      )}

      {deleteMapOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Xoá bản đồ?</h2>
            <p className="text-sm text-zinc-300 mb-6">
              Bạn có chắc chắn muốn xoá bản đồ{" "}
              <span className="font-semibold text-white">"{deleteMapLabel}"</span>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setDeleteMapOpen({ open: false })}
              >
                Hủy
              </button>
              <button
                onClick={() => void handleDeleteMap()}
                disabled={deleteMapLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteMapLoading ? "Đang xoá..." : "Xoá bản đồ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Map Dialog */}
      {showCreateMapDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Chọn loại bản đồ</h2>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setMapType("normal")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${mapType === "normal"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${mapType === "normal" ? "border-emerald-500" : "border-zinc-600"
                      }`}>
                      {mapType === "normal" && (
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-1">Bản đồ thường</div>
                      <div className="text-sm text-zinc-400">Tạo bản đồ để hiển thị và chia sẻ dữ liệu địa lý</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMapType("storymap")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${mapType === "storymap"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${mapType === "storymap" ? "border-emerald-500" : "border-zinc-600"
                      }`}>
                      {mapType === "storymap" && (
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-1">Storymap</div>
                      <div className="text-sm text-zinc-400">Tạo storymap với timeline và segments để có thể tạo session học tập</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateMapDialog(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => void handleCreateMap()}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Tạo bản đồ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
