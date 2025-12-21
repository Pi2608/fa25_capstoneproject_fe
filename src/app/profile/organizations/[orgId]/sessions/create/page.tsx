"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import { toast } from "react-toastify";
import {
  createSession,
  getMyQuestionBanks,
  getMyQuestionBanksByOrg,
  type QuestionBankDto,
} from "@/lib/api-session";
import { getOrganizationById } from "@/lib/api-organizations";
import {
  getProjectsByOrganization,
  getWorkspaceMaps,
} from "@/lib/api-workspaces";
import { MapDto, getMapDetail } from "@/lib/api-maps";
import { Workspace } from "@/types/workspace";
import Loading from "@/app/loading";
import { useI18n } from "@/i18n/I18nProvider";

export default function OrganizationCreateSessionPage() {
  const { t } = useI18n(); // t("sessionCreate", "key", params?)

  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme ?? "light") === "dark";
  const themeClasses = getThemeClasses(isDark);

  const presetWorkspaceId = searchParams?.get("workspaceId") ?? "";
  const presetMapId = searchParams?.get("mapId") ?? "";

  const [orgName, setOrgName] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [mapsByWorkspace, setMapsByWorkspace] = useState<Record<string, MapDto[]>>({});
  const [mapsLoadingWorkspaceId, setMapsLoadingWorkspaceId] = useState<string | null>(null);
  const [workspaceMapErrors, setWorkspaceMapErrors] = useState<Record<string, string>>({});
  const [selectedMapId, setSelectedMapId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [availableQuestionBanks, setAvailableQuestionBanks] = useState<QuestionBankDto[]>([]);
  const [questionBanksLoading, setQuestionBanksLoading] = useState(false);
  const [questionBanksError, setQuestionBanksError] = useState<string | null>(null);
  const [selectedQuestionBankIds, setSelectedQuestionBankIds] = useState<string[]>([]);

  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState<"live" | "practice">("live");
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [enableHints, setEnableHints] = useState(true);
  const [pointsForSpeed, setPointsForSpeed] = useState(true);

  const loadedWorkspaceIdsRef = useRef(new Set<string>());
  const prefAppliedRef = useRef(false);

  const selectedWorkspace = useMemo(
    () =>
      workspaces.find(
        (workspace) => workspace.workspaceId === selectedWorkspaceId
      ),
    [workspaces, selectedWorkspaceId]
  );

  const mapsForSelectedWorkspace = useMemo(
    () => mapsByWorkspace[selectedWorkspaceId] ?? [],
    [mapsByWorkspace, selectedWorkspaceId]
  );

  const selectedMap = useMemo(
    () =>
      mapsForSelectedWorkspace.find((map) => map.id === selectedMapId) ?? null,
    [mapsForSelectedWorkspace, selectedMapId]
  );

  const formatDateLabel = useCallback(
    (value?: string | null) => {
      if (!value)
        return t("sessionCreate", "date_not_updated");
      const date = new Date(value);
      if (Number.isNaN(date.getTime()))
        return t("sessionCreate", "date_unknown");

      const locale =
        t("sessionCreate", "date_locale") || "vi-VN";

      return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
    [t]
  );

const fetchMapsForWorkspace = useCallback(
  async (workspaceId: string, options?: { force?: boolean }) => {
    if (!workspaceId) return;

    if (!options?.force && loadedWorkspaceIdsRef.current.has(workspaceId)) {
      return;
    }

    if (options?.force) {
      loadedWorkspaceIdsRef.current.delete(workspaceId);
    }

    setMapsLoadingWorkspaceId(workspaceId);
    setWorkspaceMapErrors((prev) => {
      const next = { ...prev };
      delete next[workspaceId];
      return next;
    });

    try {
      const rawMaps = await getWorkspaceMaps(workspaceId);

      const storyMapCandidates = rawMaps.filter((map: any) => {
        const isStoryMap =
          map.isStoryMap ??
          map.is_storymap ??
          map.IsStoryMap ??
          false;
        return Boolean(isStoryMap);
      });

      if (storyMapCandidates.length === 0) {
        setMapsByWorkspace((prev) => ({
          ...prev,
          [workspaceId]: [],
        }));
        loadedWorkspaceIdsRef.current.add(workspaceId);
        return;
      }

      const detailList = await Promise.all(
        storyMapCandidates.map(async (m: any) => {
          try {
            const id = m.id ?? m.mapId ?? m.map_id;
            if (!id) return null;
            const detail = await getMapDetail(id);
            return detail;
          } catch {
            return null;
          }
        })
      );

      const publishedIds = new Set(
        detailList
          .filter((d): d is any => {
            if (!d) return false;
            const status = (d.status ?? "")
              .toString()
              .toLowerCase();
            return status === "published";
          })
          .map((d: any) => d.id ?? d.mapId ?? d.map_id)
      );

      const storyMaps = storyMapCandidates.filter((m: any) => {
        const id = m.id ?? m.mapId ?? m.map_id;
        return publishedIds.has(id);
      });

      setMapsByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: storyMaps,
      }));
      loadedWorkspaceIdsRef.current.add(workspaceId);
    } catch (error) {
      console.error("Failed to load maps for workspace:", error);
      toast.error(t("sessionCreate", "toast_maps_error"));
      setWorkspaceMapErrors((prev) => ({
        ...prev,
        [workspaceId]: t("sessionCreate", "maps_error_message"),
      }));
    } finally {
      setMapsLoadingWorkspaceId((current) =>
        current === workspaceId ? null : current
      );
    }
  },
  [t]
);

  useEffect(() => {
    if (!orgId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setWorkspaces([]);
        setSelectedWorkspaceId("");
        setSelectedMapId("");
        setMapsByWorkspace({});
        loadedWorkspaceIdsRef.current.clear();

        const [ws, org] = await Promise.all([
          getProjectsByOrganization(orgId),
          getOrganizationById(orgId),
        ]);

        setOrgName(org?.organization?.orgName ?? "");
        setWorkspaces(ws);

        const matchedWorkspace = presetWorkspaceId
          ? ws.find((workspace) => workspace.workspaceId === presetWorkspaceId)
          : undefined;
        const initialWorkspaceId =
          matchedWorkspace?.workspaceId ?? (ws.length ? ws[0].workspaceId : "");

        if (initialWorkspaceId) {
          setSelectedWorkspaceId(initialWorkspaceId);
          await fetchMapsForWorkspace(initialWorkspaceId);
        }
      } catch (error) {
        console.error(
          "Failed to load organization workspaces for session creation:",
          error
        );
        toast.error(
          t("sessionCreate", "toast_org_error")
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [orgId, fetchMapsForWorkspace, presetWorkspaceId, t]);

  const handleSelectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedMapId("");
    setAvailableQuestionBanks([]);
    setSelectedQuestionBankIds([]);
    void fetchMapsForWorkspace(workspaceId);
  };

  const handleSelectMap = (mapId: string) => {
    setSelectedMapId(mapId);
  };

  const handleRefreshMaps = () => {
    if (!selectedWorkspaceId) return;
    void fetchMapsForWorkspace(selectedWorkspaceId, { force: true });
  };

  useEffect(() => {
    if (!selectedMapId) {
      setAvailableQuestionBanks([]);
      setSelectedQuestionBankIds([]);
      setQuestionBanksError(null);
      setQuestionBanksLoading(false);
      return;
    }

    let cancelled = false;

    const loadQuestionBanksForMap = async () => {
      try {
        setQuestionBanksLoading(true);
        setQuestionBanksError(null);

          const myBanks = orgId
          ? await getMyQuestionBanksByOrg(orgId)
          : await getMyQuestionBanks();

        const bankMap = new Map<string, QuestionBankDto>();
        [...myBanks].forEach((bank) => {
          if (!bankMap.has(bank.questionBankId)) {
            bankMap.set(bank.questionBankId, bank);
          }
        });

        const allBanks = Array.from(bankMap.values());
        const banksForMap: QuestionBankDto[] = allBanks;

        if (cancelled) return;

        setAvailableQuestionBanks(banksForMap);
        setSelectedQuestionBankIds([]);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load question banks for map:", error);
        setAvailableQuestionBanks([]);
        setQuestionBanksError(
          t("sessionCreate", "question_banks_error")
        );
      } finally {
        if (!cancelled) {
          setQuestionBanksLoading(false);
        }
      }
    };

    void loadQuestionBanksForMap();

    return () => {
      cancelled = true;
    };
  }, [selectedMapId, t]);

const handleCreateSession = async (e: React.FormEvent) => {
  e.preventDefault();

    if (!selectedWorkspaceId) {
      toast.error(
        t("sessionCreate", "toast_no_workspace")
      );
      return;
    }

    if (!selectedMapId || !selectedMap) {
      toast.error(
        t("sessionCreate", "toast_no_map")
      );
      return;
    }

    setIsCreating(true);
    try {
      const session = await createSession({
        mapId: selectedMapId,
        questionBankId: selectedQuestionBankIds ?? [],
        sessionName:
          sessionName || `${selectedMap.name ?? "Storymap"} Session`,
        description,
        sessionType,
        maxParticipants: maxParticipants || undefined,
        allowLateJoin,
        showLeaderboard,
        showCorrectAnswers,
        shuffleQuestions,
        shuffleOptions,
        enableHints,
        pointsForSpeed,
      });

      toast.success(
        t("sessionCreate", "toast_success")
      );

    const params = new URLSearchParams({
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
    });

    params.set("workspaceId", selectedWorkspaceId);
    params.set("mapId", selectedMapId);
    if (selectedMap.name) params.set("mapName", selectedMap.name);

      router.push(`/storymap/control/${selectedMapId}?${params.toString()}`);
    } catch (error: any) {
      console.error("Failed to create session inside organization:", error);
      toast.error(
        error?.message ||
        t("sessionCreate", "toast_create_error")
      );
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!presetMapId || prefAppliedRef.current) return;
    if (!selectedWorkspaceId) return;
    const maps = mapsByWorkspace[selectedWorkspaceId];
    if (!maps || maps.length === 0) return;
    const exists = maps.some((map) => map.id === presetMapId);
    if (exists) {
      setSelectedMapId(presetMapId);
      prefAppliedRef.current = true;
    }
  }, [presetMapId, selectedWorkspaceId, mapsByWorkspace]);

  if (!orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center text-zinc-600 dark:text-zinc-400">
          {t("sessionCreate", "org_not_found")}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] px-4 text-zinc-500 animate-pulse">
        <Loading />
      </div>
    );
  }

  const mapsErrorMessage = selectedWorkspaceId
    ? workspaceMapErrors[selectedWorkspaceId]
    : null;

  return (
    <div className="min-w-0 px-4 pb-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/profile/organizations/${orgId}`)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${themeClasses.buttonOutline}`}
            style={{
              color: isDark ? "#e5e7eb" : "#4b5563",
            }}
          >
            {t("sessionCreate", "back")}
          </button>
          <h1
            className="text-2xl font-semibold sm:text-3xl"
            style={{
              color: isDark ? "#f9fafb" : "#047857",
            }}
          >
            {t("sessionCreate", "title")}
          </h1>
        </div>
      </div>

      <main className="mx-auto max-w-6xl p-6 pb-20">
        <form onSubmit={handleCreateSession} className="space-y-6">
          {/* STEP 1: WORKSPACE */}
          <section className={`rounded-2xl border p-6 shadow-sm ${themeClasses.panel}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className={`text-lg font-semibold ${themeClasses.text}`}>
                  {t("sessionCreate", "step1_title")}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t("sessionCreate", "step1_subtitle")}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {t("sessionCreate", "workspace_badge", {
                  count: workspaces.length,
                })}
              </span>
            </div>

            {workspaces.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mb-3 text-4xl">🗂️</div>
                <div className="mb-2 text-zinc-600 dark:text-zinc-400">
                  {t("sessionCreate", "no_workspaces_title")}
                </div>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("sessionCreate", "no_workspaces_desc")}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/workspaces`)
                  }
                  className="rounded-lg bg-emerald-500 px-6 py-2 text-white hover:bg-emerald-600"
                >
                  {t("sessionCreate", "manage_workspaces_btn")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {workspaces.map((workspace) => {
                  const workspaceId = workspace.workspaceId;
                  const isSelected = workspaceId === selectedWorkspaceId;
                  return (
                    <button
                      key={workspaceId}
                      type="button"
                      onClick={() => handleSelectWorkspace(workspaceId)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                          : "border-zinc-100 hover:border-emerald-200 dark:border-zinc-800 dark:hover:border-emerald-800"
                        }`}
                    >
                      <div className={`mb-1 text-lg font-semibold ${themeClasses.text}`}>
                        {workspace.workspaceName}
                      </div>
                      <div className="mb-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {workspace.description ||
                          t("sessionCreate", "workspace_no_desc")}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>🗺️ {workspace.mapCount ?? 0} map</span>
                        {workspace.orgName && (
                          <span>🏢 {workspace.orgName}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* STEP 2: STORYMAP */}
          {selectedWorkspaceId && (
            <section className={`rounded-2xl border p-6 shadow-sm ${themeClasses.panel}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={`text-lg font-semibold ${themeClasses.text}`}>
                    {t("sessionCreate", "step2_title")}
                  </h2>
                  {selectedWorkspace && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t("sessionCreate", "step2_workspace_label", {
                        name: selectedWorkspace.workspaceName,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/profile/organizations/${orgId}/workspaces/${selectedWorkspaceId}`
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-sm ${themeClasses.button}`}
                  >
                    {t("sessionCreate", "manage_workspaces_btn")}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshMaps}
                    className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    {t("sessionCreate", "refresh_maps")}
                  </button>
                </div>
              </div>

              {mapsLoadingWorkspaceId === selectedWorkspaceId ? (
                <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                  <div className="mr-3 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                  {t("sessionCreate", "loading_maps")}
                </div>
              ) : mapsErrorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                  {mapsErrorMessage}
                </div>
              ) : mapsForSelectedWorkspace.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mb-3 text-4xl">🗺️</div>
                  <div className="mb-2 text-zinc-600 dark:text-zinc-400">
                    {t("sessionCreate", "no_storymaps_title")}
                  </div>
                  <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {t("sessionCreate", "no_storymaps_desc")}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/profile/organizations/${orgId}/workspaces/${selectedWorkspaceId}`
                      )
                    }
                    className="rounded-lg bg-sky-600 px-6 py-2 text-white hover:bg-sky-700"
                  >
                    {t("sessionCreate", "create_storymap_btn")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {mapsForSelectedWorkspace.map((map) => {
                    const isSelected = map.id === selectedMapId;
                    return (
                      <button
                        key={map.id}
                        type="button"
                        onClick={() => handleSelectMap(map.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected
                            ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                            : "border-zinc-100 hover:border-sky-200 dark:border-zinc-800 dark:hover:border-sky-800"
                          }`}
                      >
                        {map.previewImage && (
                          <div className={`mb-3 overflow-hidden rounded-lg border ${themeClasses.tableBorder}`}>
                            <img
                              src={map.previewImage}
                              alt={map.name}
                              className="h-32 w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className={`text-lg font-semibold ${themeClasses.text}`}>
                            {map.name}
                          </div>
                          {map.status && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {map.status}
                            </span>
                          )}
                        </div>
                        <div className="mb-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {map.description ||
                            t("sessionCreate", "map_no_desc")}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {t("sessionCreate", "updated_at", {
                            date: formatDateLabel(
                              (map as any).updatedAt ??
                              (map as any).createdAt
                            ),
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* QUESTION BANKS + STEP 3 + 4 */}
          {selectedMapId && selectedMap && (
            <>
              {/* Question banks */}
              <section className={`rounded-2xl border p-6 shadow-sm ${themeClasses.panel}`}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className={`text-lg font-semibold ${themeClasses.text}`}>
                      {t("sessionCreate", "qb_section_title")}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t("sessionCreate", "qb_section_desc")}
                    </p>
                    {selectedQuestionBankIds.length > 0 && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        {t("sessionCreate", "qb_selected", {
                          count: selectedQuestionBankIds.length,
                        })}
                      </p>
                    )}
                  </div>
                  {availableQuestionBanks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionBankIds([])}
                      className={`rounded-lg border px-3 py-2 text-sm ${themeClasses.button}`}
                    >
                      {t("sessionCreate", "qb_clear")}
                    </button>
                  )}
                </div>

                {questionBanksLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                    <div className="mr-3 h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    {t("sessionCreate", "qb_loading")}
                  </div>
                ) : questionBanksError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                    {questionBanksError}
                  </div>
                ) : availableQuestionBanks.length === 0 ? (
                  <div className="py-6 text-sm text-zinc-500 dark:text-zinc-400">
                    {t("sessionCreate", "qb_none_for_map")}
                    <br />
                    {t("sessionCreate", "qb_hint_prefix")}{" "}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/profile/organizations/${orgId}/question-banks`
                        )
                      }
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      {t("sessionCreate", "qb_link_label")}
                    </button>
                    .
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {availableQuestionBanks.map((bank) => {
                      const isSelected = selectedQuestionBankIds.includes(
                        bank.questionBankId
                      );
                      const tags =
                        Array.isArray(bank.tags)
                          ? bank.tags
                          : typeof bank.tags === "string" && bank.tags.length
                            ? bank.tags.split(",").map((tag) => tag.trim())
                            : [];

                      const description =
                        bank.description ||
                        t("sessionCreate", "bank_no_desc");

                      return (
                        <button
                          key={bank.questionBankId}
                          type="button"
                          onClick={() => {
                            setSelectedQuestionBankIds((prev) =>
                              isSelected
                                ? prev.filter(
                                  (id) => id !== bank.questionBankId
                                )
                                : [...prev, bank.questionBankId]
                            );
                          }}
                          className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                              : "border-zinc-100 hover:border-emerald-200 dark:border-zinc-800 dark:hover:border-emerald-800"
                            }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className={`text-base font-semibold ${themeClasses.text}`}>
                              {bank.bankName}
                            </div>
                            {isSelected && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {t("sessionCreate", "qb_selected_badge")}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            {description}
                          </div>
                          {tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 text-xs">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STEP 3: SESSION INFO */}
              <section className={`rounded-2xl border p-6 shadow-sm ${themeClasses.panel}`}>
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {t("sessionCreate", "step3_title")}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("sessionCreate", "session_name_label")}
                    </label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder={t(
                        "sessionCreate",
                        "session_name_placeholder"
                      )}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t("sessionCreate", "session_desc_label")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder={t(
                        "sessionCreate",
                        "session_desc_placeholder"
                      )}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t("sessionCreate", "session_type_label")}
                      </label>
                      <select
                        value={sessionType}
                        onChange={(e) =>
                          setSessionType(e.target.value as "live" | "practice")
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                      >
                        <option value="live">
                          {t("sessionCreate", "session_type_live")}
                        </option>
                        <option value="practice">
                          {t("sessionCreate", "session_type_practice")}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t(
                          "sessionCreate",
                          "max_participants_label"
                        )}
                      </label>
                      <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) =>
                          setMaxParticipants(parseInt(e.target.value) || 0)
                        }
                        min={0}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* STEP 4: SETTINGS */}
              <section className={`rounded-2xl border p-6 shadow-sm ${themeClasses.panel}`}>
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {t("sessionCreate", "step4_title")}
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      id: "allowLateJoin",
                      label: t(
                        "sessionCreate",
                        "setting_allowLateJoin_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_allowLateJoin_desc"
                      ),
                      value: allowLateJoin,
                      onChange: setAllowLateJoin,
                    },
                    {
                      id: "showLeaderboard",
                      label: t(
                        "sessionCreate",
                        "setting_showLeaderboard_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_showLeaderboard_desc"
                      ),
                      value: showLeaderboard,
                      onChange: setShowLeaderboard,
                    },
                    {
                      id: "showCorrectAnswers",
                      label: t(
                        "sessionCreate",
                        "setting_showCorrectAnswers_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_showCorrectAnswers_desc"
                      ),
                      value: showCorrectAnswers,
                      onChange: setShowCorrectAnswers,
                    },
                    {
                      id: "shuffleQuestions",
                      label: t(
                        "sessionCreate",
                        "setting_shuffleQuestions_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_shuffleQuestions_desc"
                      ),
                      value: shuffleQuestions,
                      onChange: setShuffleQuestions,
                    },
                    {
                      id: "shuffleOptions",
                      label: t(
                        "sessionCreate",
                        "setting_shuffleOptions_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_shuffleOptions_desc"
                      ),
                      value: shuffleOptions,
                      onChange: setShuffleOptions,
                    },
                    {
                      id: "enableHints",
                      label: t(
                        "sessionCreate",
                        "setting_enableHints_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_enableHints_desc"
                      ),
                      value: enableHints,
                      onChange: setEnableHints,
                    },
                    {
                      id: "pointsForSpeed",
                      label: t(
                        "sessionCreate",
                        "setting_pointsForSpeed_label"
                      ),
                      description: t(
                        "sessionCreate",
                        "setting_pointsForSpeed_desc"
                      ),
                      value: pointsForSpeed,
                      onChange: setPointsForSpeed,
                    },
                  ].map((setting) => (
                    <label
                      key={setting.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={setting.value}
                        onChange={(e) => setting.onChange(e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <div className={`font-medium ${themeClasses.text}`}>
                          {setting.label}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          {setting.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/profile/organizations/${orgId}`)}
                  className={`rounded-lg border px-6 py-3 font-medium ${themeClasses.button}`}
                >
                  {t("sessionCreate", "cancel_btn")}
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !selectedMapId}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreating ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>
                        {t("sessionCreate", "creating_label")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {t("sessionCreate", "submit_btn")}
                      </span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
