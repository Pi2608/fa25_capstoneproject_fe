"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  createSession,
  getMyQuestionBanks,
  getPublicQuestionBanks,
  getSessionsByQuestionBank,
  attachSessionToQuestionBank,
  type QuestionBankDto,
} from "@/lib/api-ques";

import { getOrganizationById } from "@/lib/api-organizations";
import {
  getProjectsByOrganization,
  getWorkspaceMaps,
} from "@/lib/api-workspaces";
import { MapDto } from "@/lib/api-maps";
import { Workspace } from "@/types/workspace";
import Loading from "@/app/loading";

type HeaderMode = "light" | "dark";

function useThemeMode(): HeaderMode {
  const [mode, setMode] = useState<HeaderMode>("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;

    const update = () => {
      setMode(html.classList.contains("dark") ? "dark" : "light");
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return mode;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function OrganizationCreateSessionPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = useThemeMode();

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

        const publicMaps = rawMaps.filter((map) => map.isPublic === true);

        setMapsByWorkspace((prev) => ({
          ...prev,
          [workspaceId]: publicMaps,
        }));
        loadedWorkspaceIdsRef.current.add(workspaceId);
      } catch (error) {
        console.error("Failed to load maps for workspace:", error);
        toast.error("Không tải được danh sách storymap của workspace");
        setWorkspaceMapErrors((prev) => ({
          ...prev,
          [workspaceId]:
            "Không thể tải danh sách storymap. Vui lòng thử lại.",
        }));
      } finally {
        setMapsLoadingWorkspaceId((current) =>
          current === workspaceId ? null : current
        );
      }
    },
    []
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
        toast.error("Không tải được dữ liệu tổ chức");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [orgId, fetchMapsForWorkspace, presetWorkspaceId]);

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

        const [myBanks, publicBanks] = await Promise.all([
          getMyQuestionBanks(),
          getPublicQuestionBanks(),
        ]);

        const bankMap = new Map<string, QuestionBankDto>();
        [...myBanks, ...publicBanks].forEach((bank) => {
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
          "Không tải được danh sách bộ câu hỏi cho storymap này"
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
  }, [selectedMapId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkspaceId) {
      toast.error("Vui lòng chọn workspace trước khi tạo session");
      return;
    }

    if (!selectedMapId || !selectedMap) {
      toast.error("Vui lòng chọn storymap cho session");
      return;
    }

    setIsCreating(true);
    try {
      const primaryBankId =
        selectedQuestionBankIds.length > 0 ? selectedQuestionBankIds[0] : undefined;

      const session = await createSession({
        mapId: selectedMapId,
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
        questionBankId: primaryBankId ? [primaryBankId] : null,
      });

      if (selectedQuestionBankIds.length > 1) {
        try {
          const extraBankIds = selectedQuestionBankIds.filter(
            (id) => id !== primaryBankId
          );

          await Promise.all(
            extraBankIds.map((qbId) =>
              attachSessionToQuestionBank(qbId, session.sessionId)
            )
          );
        } catch (attachError) {
          console.error("Failed to attach extra question banks:", attachError);
          toast.error(
            "Session đã tạo, nhưng gắn thêm một số bộ câu hỏi bị lỗi. Bạn có thể gắn lại trong trang control."
          );
        }
      }

      toast.success("Tạo session thành công!");

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
      toast.error(error?.message || "Không thể tạo session");
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
          Organization not found.
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
            className="px-3 py-1.5 rounded-lg border text-sm border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            style={{
              color: mode === "dark" ? "#e5e7eb" : "#4b5563",
            }}
          >
            ← Quay lại
          </button>
          <h1
            className="text-2xl font-semibold sm:text-3xl"
            style={{
              color: mode === "dark" ? "#f9fafb" : "#047857",
            }}
          >
            Tạo session
          </h1>
        </div>
      </div>

      <main className="mx-auto max-w-6xl p-6 pb-20">
        <form onSubmit={handleCreateSession} className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  1. Chọn workspace
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Chỉ hiển thị workspace thuộc tổ chức này
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {workspaces.length} workspace
              </span>
            </div>

            {workspaces.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mb-3 text-4xl">🗂️</div>
                <div className="mb-2 text-zinc-600 dark:text-zinc-400">
                  Tổ chức chưa có workspace nào
                </div>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Tạo workspace mới hoặc gán workspace hiện có cho tổ chức này
                  để quản lý session theo nhóm.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/workspaces`)
                  }
                  className="rounded-lg bg-emerald-500 px-6 py-2 text-white hover:bg-emerald-600"
                >
                  Quản lý workspace
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
                      <div className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {workspace.workspaceName}
                      </div>
                      <div className="mb-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {workspace.description || "Không có mô tả"}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>🗂️ {workspace.mapCount ?? 0} map</span>
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

          {selectedWorkspaceId && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    2. Chọn storymap
                  </h2>
                  {selectedWorkspace && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Workspace: {selectedWorkspace.workspaceName}
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
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Quản lý workspace
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshMaps}
                    className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    Làm mới
                  </button>
                </div>
              </div>

              {mapsLoadingWorkspaceId === selectedWorkspaceId ? (
                <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                  <div className="mr-3 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                  Đang tải storymap của workspace...
                </div>
              ) : mapsErrorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                  {mapsErrorMessage}
                </div>
              ) : mapsForSelectedWorkspace.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mb-3 text-4xl">🗺️</div>
                  <div className="mb-2 text-zinc-600 dark:text-zinc-400">
                    Workspace này chưa có storymap nào
                  </div>
                  <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Tạo hoặc gắn storymap vào workspace để có thể mở session từ
                    đây.
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
                    Tạo storymap
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
                          <div className="mb-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <img
                              src={map.previewImage}
                              alt={map.name}
                              className="h-32 w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            {map.name}
                          </div>
                          {map.status && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {map.status}
                            </span>
                          )}
                        </div>
                        <div className="mb-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {map.description || "Không có mô tả"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Cập nhật: {formatDateLabel(
                            map.updatedAt ?? map.createdAt
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {selectedMapId && selectedMap && (
            <>
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Bộ câu hỏi cho session này (tùy chọn)
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Dùng các bộ câu hỏi của bạn và bộ public. Bạn có thể chọn nhiều bộ câu hỏi hoặc bỏ qua bước này.
                    </p>
                    {selectedQuestionBankIds.length > 0 && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        Đã chọn {selectedQuestionBankIds.length} bộ câu hỏi.
                      </p>
                    )}
                  </div>
                  {availableQuestionBanks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionBankIds([])}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Không dùng bộ câu hỏi
                    </button>
                  )}
                </div>

                {questionBanksLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                    <div className="mr-3 h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    Đang tải danh sách bộ câu hỏi...
                  </div>
                ) : questionBanksError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                    {questionBanksError}
                  </div>
                ) : availableQuestionBanks.length === 0 ? (
                  <div className="py-6 text-sm text-zinc-500 dark:text-zinc-400">
                    Storymap này hiện chưa có bộ câu hỏi nào được gắn.
                    <br />
                    Bạn có thể tạo session không có câu hỏi, hoặc gắn bộ câu hỏi ở trang{" "}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/profile/organizations/${orgId}/question-banks`)
                      }
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      Bộ câu hỏi
                    </button>.
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
                            ? bank.tags
                              .split(/[;,]+/)
                              .map((t) => t.trim())
                              .filter(Boolean)
                            : [];

                      return (
                        <button
                          key={bank.questionBankId}
                          type="button"
                          onClick={() =>
                            setSelectedQuestionBankIds((prev) =>
                              prev.includes(bank.questionBankId)
                                ? prev.filter((id) => id !== bank.questionBankId)
                                : [...prev, bank.questionBankId]
                            )
                          }
                          className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-zinc-100 hover:border-emerald-200 dark:border-zinc-800 dark:hover:border-emerald-800"
                            }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                              {bank.bankName}
                            </div>
                            <div className="flex items-center gap-2">
                              {typeof bank.totalQuestions === "number" && (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {bank.totalQuestions} câu hỏi
                                </span>
                              )}
                              {isSelected && (
                                <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                                  Đã chọn
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mb-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {bank.description || "Không có mô tả"}
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

              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      3. Thông tin session
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Storymap: {selectedMap.name}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Tên session
                    </label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder={`${selectedMap?.name ?? "Session"}`}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Mô tả
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Thêm mô tả cho session..."
                      rows={3}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Loại session
                      </label>
                      <select
                        value={sessionType}
                        onChange={(e) =>
                          setSessionType(e.target.value as "live" | "practice")
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        <option value="live">Live</option>
                        <option value="practice">Practice</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Số người tối đa (0 = không giới hạn)
                      </label>
                      <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) =>
                          setMaxParticipants(parseInt(e.target.value) || 0)
                        }
                        min={0}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  4. Thiết lập session
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      id: "allowLateJoin",
                      label: "Cho phép vào muộn",
                      description: "Học sinh có thể tham gia sau khi đã bắt đầu",
                      value: allowLateJoin,
                      onChange: setAllowLateJoin,
                    },
                    {
                      id: "showLeaderboard",
                      label: "Hiển thị bảng xếp hạng",
                      description: "Cập nhật điểm theo thời gian thực",
                      value: showLeaderboard,
                      onChange: setShowLeaderboard,
                    },
                    {
                      id: "showCorrectAnswers",
                      label: "Hiển thị đáp án đúng",
                      description: "Cho phép xem đáp án sau khi trả lời",
                      value: showCorrectAnswers,
                      onChange: setShowCorrectAnswers,
                    },
                    {
                      id: "shuffleQuestions",
                      label: "Xáo trộn câu hỏi",
                      description: "Ngẫu nhiên thứ tự câu hỏi",
                      value: shuffleQuestions,
                      onChange: setShuffleQuestions,
                    },
                    {
                      id: "shuffleOptions",
                      label: "Xáo trộn đáp án",
                      description: "Ngẫu nhiên thứ tự đáp án",
                      value: shuffleOptions,
                      onChange: setShuffleOptions,
                    },
                    {
                      id: "enableHints",
                      label: "Cho phép gợi ý",
                      description: "Học sinh có thể xem gợi ý",
                      value: enableHints,
                      onChange: setEnableHints,
                    },
                    {
                      id: "pointsForSpeed",
                      label: "Cộng điểm tốc độ",
                      description: "Trả lời nhanh nhận thêm điểm",
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
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
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

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/profile/organizations/${orgId}`)}
                  className="rounded-lg border border-zinc-200 px-6 py-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !selectedMapId}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreating ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <span>Tạo session</span>
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
