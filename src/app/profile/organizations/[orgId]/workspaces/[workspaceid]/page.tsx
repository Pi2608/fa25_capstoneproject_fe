"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";
import { getOrganizationById, OrganizationDetailDto } from "@/lib/api-organizations";
import { createDefaultMap, deleteMap, getMapDetail } from "@/lib/api-maps";
import { getWorkspaceById, getWorkspaceMaps, removeMapFromWorkspace } from "@/lib/api-workspaces";
import { useI18n } from "@/i18n/I18nProvider";
import {
  QuestionBankDto,
  getMyQuestionBanks,
  createSession,
  SessionDto,
  getMySessions,
} from "@/lib/api-ques";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name" | "author";

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
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

  // -------- Modal chọn bộ câu hỏi & tạo session ----------
  const [createSessionOpen, setCreateSessionOpen] = useState<{
    open: boolean;
    mapId?: string;
    mapName?: string;
  }>({ open: false });

  const [questionBanks, setQuestionBanks] = useState<QuestionBankDto[]>([]);
  const [loadingQuestionBanks, setLoadingQuestionBanks] = useState(false);
  const [selectedQuestionBankId, setSelectedQuestionBankId] = useState<string>("");
  const [creatingSession, setCreatingSession] = useState(false);

  // ------- Session form fields -------
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [sessionType, setSessionType] = useState<"live" | "practice">("live");
  const [maxParticipants, setMaxParticipants] = useState<number>(0);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [enableHints, setEnableHints] = useState(true);
  const [pointsForSpeed, setPointsForSpeed] = useState(true);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>("");

  // ------- Danh sách các tiết học đã tạo -------
  const [mySessionsOpen, setMySessionsOpen] = useState(false);
  const [mySessions, setMySessions] = useState<SessionDto[]>([]);
  const [mySessionsLoading, setMySessionsLoading] = useState(false);
  const [mySessionsError, setMySessionsError] = useState<string | null>(null);

  const handleCreateMap = useCallback(async () => {
    try {
      const created = await createDefaultMap({
        name: t("workspace_detail.untitled_map"),
        workspaceId,
      });
      router.push(`/maps/${created.mapId}?created=1`);
    } catch (e) {
      showToast("error", safeMessage(e, t("workspace_detail.request_failed")));
    }
  }, [router, showToast, workspaceId, t]);

  const handleOpenMySessions = useCallback(async () => {
    setMySessionsOpen(true);
    setMySessionsLoading(true);
    setMySessionsError(null);

    try {
      const sessions = await getMySessions();
      setMySessions(sessions);
    } catch (e) {
      const msg = safeMessage(e, t("workspace_detail.request_failed"));
      setMySessionsError(msg);
      showToast("error", msg);
    } finally {
      setMySessionsLoading(false);
    }
  }, [showToast, t]);

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
        normalized.map(async (m) => {
          try {
            const detail = await getMapDetail(m.id);
            return detail;
          } catch {
            return null;
          }
        })
      );

      const published = detailList
        .filter((d): d is any => !!d && (!!(d as any).PublishedAt || !!(d as any).publishedAt))
        .map((d: any) => ({
          id: d.mapId ?? d.id ?? d.map_id,
          name: d.name ?? d.mapName ?? d.map_name ?? "",
          publishedAt: d.PublishedAt ?? d.publishedAt ?? d.updatedAt ?? d.createdAt ?? null,
        }));
      setPublishedMaps(published);
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
      showToast("success", t("workspace_detail.toast_deleted"));
      setDeleteMapOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e, t("workspace_detail.request_failed")));
    } finally {
      setDeleteMapLoading(false);
    }
  }, [deleteMapOpen.mapId, showToast, loadData, t]);

  const handleRemoveMapFromWorkspace = useCallback(
    async (mapId: string) => {
      try {
        await removeMapFromWorkspace(workspaceId, mapId);
        showToast("success", t("workspace_detail.toast_removed"));
        await loadData();
      } catch (e) {
        showToast("error", safeMessage(e, t("workspace_detail.request_failed")));
      }
    },
    [workspaceId, showToast, loadData, t]
  );

  const handleOpenCreateSession = useCallback(
    async (mapId: string, mapName?: string) => {
      setCreateSessionOpen({ open: true, mapId, mapName });

      // reset form session
      setSelectedQuestionBankId("");
      setSessionName(mapName ? `Session - ${mapName}` : "New session");
      setSessionDescription("");
      setSessionType("live");
      setMaxParticipants(0);
      setAllowLateJoin(true);
      setShowLeaderboard(true);
      setShowCorrectAnswers(true);
      setShuffleQuestions(true);
      setShuffleOptions(true);
      setEnableHints(true);
      setPointsForSpeed(true);
      setScheduledStartTime("");

      setLoadingQuestionBanks(true);
      try {
        const allBanks = await getMyQuestionBanks();
        const filtered = allBanks.filter((b) => b.mapId === mapId);
        setQuestionBanks(filtered);
      } catch (e) {
        setQuestionBanks([]);
        showToast("error", safeMessage(e, t("workspace_detail.request_failed")));
      } finally {
        setLoadingQuestionBanks(false);
      }
    },
    [showToast, t]
  );

  const handleCreateSessionForMap = useCallback(
    async () => {
      if (!createSessionOpen.mapId) return;

      const mapIdForSession = createSessionOpen.mapId;

      setCreatingSession(true);
      try {
        const nowIso = new Date().toISOString();
        const scheduledIso =
          scheduledStartTime &&
          !Number.isNaN(new Date(scheduledStartTime).getTime())
            ? new Date(scheduledStartTime).toISOString()
            : nowIso;

        const body: any = {
          mapId: mapIdForSession,
          sessionName:
            sessionName ||
            (createSessionOpen.mapName
              ? `Session - ${createSessionOpen.mapName}`
              : "New session"),
          description: sessionDescription || null,
          sessionType,
          maxParticipants: maxParticipants || 0,
          allowLateJoin,
          showLeaderboard,
          showCorrectAnswers,
          shuffleQuestions,
          shuffleOptions,
          enableHints,
          pointsForSpeed,
          scheduledStartTime: scheduledIso,
        };

        if (selectedQuestionBankId) {
          body.questionBankId = selectedQuestionBankId;
        }

        const session = await createSession(body);

        showToast("success", "Tạo session thành công");

        setCreateSessionOpen({
          open: false,
          mapId: undefined,
          mapName: undefined,
        });

        router.push(
          `/storymap/control/${mapIdForSession}?sessionId=${session.id}`
        );
      } catch (e) {
        showToast(
          "error",
          safeMessage(e, t("workspace_detail.request_failed"))
        );
      } finally {
        setCreatingSession(false);
      }
    },
    [
      createSessionOpen,
      selectedQuestionBankId,
      router,
      showToast,
      t,
      sessionName,
      sessionDescription,
      sessionType,
      maxParticipants,
      allowLateJoin,
      showLeaderboard,
      showCorrectAnswers,
      shuffleQuestions,
      shuffleOptions,
      enableHints,
      pointsForSpeed,
      scheduledStartTime,
    ]
  );

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">{t("workspace_detail.loading")}</div>;
  if (err || !org || !workspace) return <div className="max-w-3xl px-4 text-red-400">{err ?? t("workspace_detail.not_found")}</div>;

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
            onClick={() => void handleCreateMap()}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            {t("workspace_detail.create_map")}
          </button>

          <button
            type="button"
            onClick={() => void handleOpenMySessions()}
            className="px-4 py-2 rounded-lg border border-emerald-500/60 bg-emerald-500/5 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 hover:text-emerald-100 transition"
          >
            Các tiết học đã tạo
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
            onClick={() => void handleCreateMap()}
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
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Bản đồ đã publish</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {publishedMaps.map((map) => (
              <div key={map.id} className="rounded-xl border border-emerald-500/40 bg-zinc-900/70 p-4">
                <div className="h-24 w-full rounded-lg bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-zinc-900 border border-emerald-400/40 mb-3 grid place-items-center text-emerald-300 text-xs">
                  Đã publish
                </div>
                <div className="min-w-0 mb-2">
                  <div className="truncate font-semibold text-white">{map.name || t("workspace_detail.unnamed")}</div>
                  <div className="text-xs text-zinc-400">
                    {map.publishedAt ? `Publish: ${formatDate(map.publishedAt)}` : "Publish: —"}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => router.push(`/maps/${map.id}`)}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                  >
                    {t("workspace_detail.open_map")}
                  </button>
                  <button
                    onClick={() =>
                      void handleOpenCreateSession(
                        map.id,
                        map.name || t("workspace_detail.unnamed")
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
                  >
                    Tạo session
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {publishedMaps.length === 0 && (
        <div className="mt-10 text-sm text-zinc-500">
          Chưa có bản đồ nào đã publish trong workspace này.
        </div>
      )}

      {/* Modal: Các tiết học đã tạo */}
      {mySessionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Các tiết học đã tạo
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Danh sách session mà bạn là host (lấy từ /api/sessions/my).
                </p>
              </div>
              <button
                onClick={() => setMySessionsOpen(false)}
                className="rounded-full bg-zinc-800/80 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {mySessionsLoading && (
                <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
                  Đang tải danh sách tiết học...
                </div>
              )}

              {!mySessionsLoading && mySessionsError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {mySessionsError}
                </div>
              )}

              {!mySessionsLoading &&
                !mySessionsError &&
                mySessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-xs text-zinc-400">
                    <p>Bạn chưa tạo tiết học nào.</p>
                  </div>
                )}

              {!mySessionsLoading &&
                !mySessionsError &&
                mySessions.length > 0 && (
                  <ul className="space-y-2">
                    {mySessions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {s.sessionName || "Tiết học không tên"}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                              {s.status}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-400">
                            <span className="mr-3">
                              Mã tham gia:{" "}
                              <span className="font-mono text-emerald-300">
                                {s.sessionCode}
                              </span>
                            </span>
                            {s.mapName && (
                              <span>
                                Bản đồ:{" "}
                                <span className="text-zinc-100">
                                  {s.mapName}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-zinc-500">
                            Tạo lúc:{" "}
                            {s.createdAt ? formatDate(s.createdAt) : "—"} •{" "}
                            Người tham gia: {s.totalParticipants ?? 0}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!s.mapId) {
                                showToast("error", "Session này không có mapId, không mở được");
                                return;
                              }
                              setMySessionsOpen(false);
                              router.push(`/storymap/control/${s.mapId}?sessionId=${s.id}`);
                            }}
                            className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-zinc-900 hover:bg-emerald-400 transition"
                          >
                            Mở tiết học
                          </button>


                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(s.sessionCode);
                                showToast("success", "Đã copy mã tham gia vào clipboard");
                              } catch {
                                showToast("error", "Không copy được mã tham gia");
                              }
                            }}
                            className="inline-flex items-center rounded-lg border border-white/15 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-medium text-zinc-100 hover:bg-zinc-800 transition"
                          >
                            Copy mã
                          </button>
                        </div>

                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal chọn bộ câu hỏi + tạo session */}
      {createSessionOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[44rem] max-w-[95vw] rounded-xl border border-emerald-500/40 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Thiết lập session
                </h2>
                <p className="text-sm text-zinc-300 mt-1">
                  Bản đồ:&nbsp;
                  <span className="font-semibold text-emerald-300">
                    {createSessionOpen.mapName}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setCreateSessionOpen({ open: false })}
                className="px-2 py-1 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
                disabled={creatingSession}
              >
                ✕
              </button>
            </div>

            {/* 2 cột: bên trái thông tin session, bên phải bộ câu hỏi */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Cột 1: Thông tin session */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Tên session
                  </label>
                  <input
                    className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="VD: Tiết 1 - Địa lý 9A1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Mô tả (tuỳ chọn)
                  </label>
                  <textarea
                    className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white resize-none"
                    rows={2}
                    value={sessionDescription}
                    onChange={(e) => setSessionDescription(e.target.value)}
                    placeholder="Ghi chú nhanh cho tiết học này..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Loại session
                    </label>
                    <select
                      className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white"
                      value={sessionType}
                      onChange={(e) =>
                        setSessionType(e.target.value as "live" | "practice")
                      }
                    >
                      <option value="live">Live</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Số người tham gia tối đa (0 = không giới hạn)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white"
                      value={maxParticipants}
                      onChange={(e) =>
                        setMaxParticipants(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Thời gian bắt đầu (tuỳ chọn)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white"
                    value={scheduledStartTime}
                    onChange={(e) => setScheduledStartTime(e.target.value)}
                  />
                </div>

                {/* Các tuỳ chọn boolean – gom lại thành 1 card nhỏ */}
                <div className="rounded-lg border border-white/10 bg-zinc-800/70 px-3 py-3">
                  <p className="text-xs font-semibold text-zinc-300 mb-2">
                    Tuỳ chọn hiển thị & chấm điểm
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-zinc-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={allowLateJoin}
                        onChange={(e) => setAllowLateJoin(e.target.checked)}
                      />
                      Cho vào muộn
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={showLeaderboard}
                        onChange={(e) => setShowLeaderboard(e.target.checked)}
                      />
                      Hiện bảng xếp hạng
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={showCorrectAnswers}
                        onChange={(e) =>
                          setShowCorrectAnswers(e.target.checked)
                        }
                      />
                      Hiện đáp án đúng
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={shuffleQuestions}
                        onChange={(e) =>
                          setShuffleQuestions(e.target.checked)
                        }
                      />
                      Xáo trộn câu hỏi
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                      />
                      Xáo trộn đáp án
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={enableHints}
                        onChange={(e) => setEnableHints(e.target.checked)}
                      />
                      Cho phép gợi ý
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={pointsForSpeed}
                        onChange={(e) => setPointsForSpeed(e.target.checked)}
                      />
                      Cộng điểm theo tốc độ
                    </label>
                  </div>
                </div>
              </div>

              {/* Cột 2: Bộ câu hỏi */}
              <div className="flex flex-col h-full">
                <h3 className="text-sm font-semibold text-white mb-2">
                  Bộ câu hỏi (tuỳ chọn)
                </h3>
                <div className="flex-1 rounded-lg border border-white/10 bg-zinc-800/70 px-3 py-3 max-h-72 overflow-y-auto">
                  {loadingQuestionBanks ? (
                    <div className="text-sm text-zinc-400">
                      Đang tải danh sách bộ câu hỏi...
                    </div>
                  ) : questionBanks.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      Chưa có bộ câu hỏi nào gắn với bản đồ này.
                      <br />
                      Bạn vẫn có thể tạo session không có câu hỏi.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-200">
                        <input
                          type="radio"
                          name="questionBank"
                          value=""
                          checked={selectedQuestionBankId === ""}
                          onChange={() => setSelectedQuestionBankId("")}
                          className="accent-emerald-500"
                        />
                        <span>Không dùng bộ câu hỏi</span>
                      </label>

                      <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                        {questionBanks.map((qb) => (
                          <label
                            key={qb.id}
                            className="flex items-start gap-2 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 px-3 py-2 text-sm cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="questionBank"
                              value={qb.id}
                              checked={selectedQuestionBankId === qb.id}
                              onChange={() => setSelectedQuestionBankId(qb.id)}
                              className="mt-1 accent-emerald-500"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-100 truncate">
                                {qb.bankName}
                              </div>
                              {typeof qb.totalQuestions === "number" && (
                                <div className="text-xs text-zinc-400">
                                  {qb.totalQuestions} câu hỏi
                                </div>
                              )}
                              {qb.mapName && (
                                <div className="text-xs text-zinc-500">
                                  Map: {qb.mapName}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setCreateSessionOpen({ open: false })}
                disabled={creatingSession}
              >
                Hủy
              </button>
              <button
                onClick={() => void handleCreateSessionForMap()}
                disabled={creatingSession || loadingQuestionBanks}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {creatingSession ? "Đang tạo session..." : "Xác nhận tạo session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMapOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">{t("workspace_detail.delete_map_title")}</h2>
            <p className="text-sm text-zinc-300 mb-6">
              {t("workspace_detail.delete_map_desc", { name: deleteMapOpen.mapName })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setDeleteMapOpen({ open: false })}
              >
                {t("workspace_detail.cancel")}
              </button>
              <button
                onClick={() => void handleDeleteMap()}
                disabled={deleteMapLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteMapLoading ? t("workspace_detail.deleting") : t("workspace_detail.delete_map_cta")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
