"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import {
  createSession,
  getSession,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  getSessionLeaderboard,
  getQuestionsOfQuestionBank,
  getMyQuestionBanks,
  activateNextQuestion,
  skipCurrentQuestion,
  extendQuestionTime,
  type SessionDto,
  type LeaderboardEntryDto,
  type QuestionDto,
  type QuestionBankDto,
  type CreateSessionRequest,
} from "@/lib/api-ques";
import { useSessionHub } from "@/hooks/useSessionHub";
import type {
  QuestionActivatedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ResponseReceivedEvent,
  LeaderboardUpdatedEvent,
  SessionStatusChangedEvent,
} from "@/lib/signalr-session";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";
import { toast } from "react-toastify";

type QuestionBankMeta = {
  id?: string;
  bankName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  totalQuestions?: number | null;
  workspaceName?: string;
  mapName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ViewMode = "create-session" | "control-session" | "view-only";

export default function StoryMapViewPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapId = params?.mapId ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Session state
  const [session, setSession] = useState<SessionDto | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    searchParams?.get("sessionId") ?? null
  );
  const [viewMode, setViewMode] = useState<ViewMode>("view-only");
  const [changingStatus, setChangingStatus] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Question Bank state
  const [questionBanks, setQuestionBanks] = useState<QuestionBankDto[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionBankMeta, setQuestionBankMeta] = useState<QuestionBankMeta | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  // Session controls
  const [questionControlLoading, setQuestionControlLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [responsesReceived, setResponsesReceived] = useState(0);

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // ================== Check if user is map owner ==================
  useEffect(() => {
    if (!mapDetail) return;

    // Check if current user is the owner
    // This would need to be implemented based on your auth system
    const isOwner = true; // TODO: Get from auth context
    if (isOwner && mapDetail.status === "Published") {
      setViewMode("create-session");
    }
  }, [mapDetail]);

  // ================== Broadcast channel ==================
  useEffect(() => {
    if (typeof window === "undefined" || !mapId) return;

    broadcastRef.current = new BroadcastChannel(`storymap-${mapId}`);
    console.log("[StoryMap View] Broadcasting on:", `storymap-${mapId}`);

    return () => broadcastRef.current?.close();
  }, [mapId]);

  // ================== Load map + segments ==================
  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [detail, segs] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        if (detail.status !== "Published" && !detail.isPublic) {
          setError("Bản đồ này chưa được publish");
          return;
        }

        setMapDetail(detail);
        setSegments(segs);
      } catch (e: any) {
        console.error("Load storymap failed:", e);
        setError(e?.message || "Không tải được bản đồ");
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  // ================== Load session if sessionId exists ==================
  useEffect(() => {
    const sid = searchParams?.get("sessionId");
    if (sid && sid !== sessionId) {
      setSessionId(sid);
      loadSession(sid);
    }
  }, [searchParams, sessionId]);

  const loadSession = async (sid: string) => {
    try {
      const sess = await getSession(sid);
      setSession(sess);
      setViewMode("control-session");
      
      if (sess.questionBankId) {
        loadQuestionBank(sess.questionBankId);
      }
    } catch (e: any) {
      console.error("Load session failed:", e);
      toast.error("Không tải được session");
    }
  };

  // ================== Load question banks ==================
  useEffect(() => {
    if (viewMode !== "create-session" && viewMode !== "control-session") return;

    (async () => {
      try {
        const banks = await getMyQuestionBanks();
        // Filter banks that match this map
        const matchingBanks = banks.filter((b) => b.mapId === mapId);
        setQuestionBanks(matchingBanks);

        // If we have a session with questionBankId, load it
        if (session?.questionBankId && viewMode === "control-session") {
          const selectedBank = matchingBanks.find((b) => b.id === session.questionBankId);
          if (selectedBank) {
            await loadQuestionBank(session.questionBankId);
          }
        }
      } catch (e: any) {
        console.error("Load question banks failed:", e);
        toast.error("Không tải được bộ câu hỏi");
      }
    })();
  }, [viewMode, mapId, session?.questionBankId]);

  // ================== Load question bank details ==================
  const loadQuestionBank = async (bankId: string) => {
    try {
      setLoadingQuestions(true);
      const selectedBank = questionBanks.find((b) => b.id === bankId);
      
      if (selectedBank) {
        setQuestionBankMeta({
          id: selectedBank.id,
          bankName: selectedBank.bankName,
          description: selectedBank.description ?? undefined,
          category: selectedBank.category ?? undefined,
          tags: Array.isArray(selectedBank.tags)
            ? selectedBank.tags
            : typeof selectedBank.tags === "string"
              ? selectedBank.tags.split(",").map((t) => t.trim())
              : [],
          totalQuestions: selectedBank.totalQuestions,
          workspaceName: selectedBank.workspaceName ?? undefined,
          mapName: selectedBank.mapName ?? undefined,
        });

        const qs = await getQuestionsOfQuestionBank(bankId);
        const ordered = Array.isArray(qs)
          ? [...qs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          : [];
        setQuestions(ordered);
      }
    } catch (e: any) {
      console.error("Load question bank failed:", e);
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // ================== Create Session ==================
  const handleCreateSession = async () => {
    if (!selectedBankId || !mapId) {
      toast.error("Vui lòng chọn bộ câu hỏi");
      return;
    }

    setIsCreating(true);
    try {
      const newSession = await createSession({
        mapId,
        questionBankId: selectedBankId,
        sessionName: `Session - ${mapDetail?.name || "Untitled"}`,
        sessionType: "live",
        allowLateJoin: true,
        showLeaderboard: true,
        showCorrectAnswers: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        enableHints: true,
        pointsForSpeed: true,
      } as CreateSessionRequest);

      toast.success("Tạo session thành công!");
      setSession(newSession);
      setSessionId(newSession.id);
      setViewMode("control-session");

      // Update URL
      router.push(`/storymap/view/${mapId}?sessionId=${newSession.id}`, {
        scroll: false,
      });

      // Load question bank
      if (selectedBankId) {
        loadQuestionBank(selectedBankId);
      }
    } catch (e: any) {
      console.error("Create session failed:", e);
      toast.error(e?.message || "Không tạo được session");
    } finally {
      setIsCreating(false);
    }
  };

  // ================== Segment broadcast ==================
  const handleSegmentChange = (segment: Segment, index: number) => {
    setCurrentIndex(index);
    broadcastRef.current?.postMessage({
      type: "segment-change",
      segmentIndex: index,
      segment,
      timestamp: Date.now(),
    });
    console.log("[StoryMap View] Broadcasted segment:", index);
  };

  const goToSegment = (index: number) => {
    if (index < 0 || index >= segments.length) return;
    const seg = segments[index];
    if (!seg) return;
    handleSegmentChange(seg, index);
  };

  // ================== SignalR Handlers ==================
  const handleSessionStatusChanged = useCallback(
    (event: SessionStatusChangedEvent) => {
      if (session && session.id === event.sessionId) {
        setSession((prev) =>
          prev ? { ...prev, status: event.status as any } : prev
        );
      }
    },
    [session]
  );

  const handleParticipantJoined = useCallback(
    (event: ParticipantJoinedEvent) => {
      setParticipantCount((prev) => prev + 1);
    },
    []
  );

  const handleParticipantLeft = useCallback(
    (event: ParticipantLeftEvent) => {
      setParticipantCount((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const handleQuestionActivated = useCallback((event: QuestionActivatedEvent) => {
    setCurrentQuestion({
      id: event.questionId,
      questionText: event.questionText,
      questionType: event.questionType,
      points: event.points,
      timeLimit: event.timeLimit,
      activatedAt: event.activatedAt,
    });
    setResponsesReceived(0);
  }, []);

  const handleResponseReceived = useCallback((event: ResponseReceivedEvent) => {
    setResponsesReceived(event.totalResponses ?? 0);
  }, []);

  const handleLeaderboardUpdated = useCallback(
    (event: LeaderboardUpdatedEvent) => {
      setLeaderboard(event.leaderboard);
    },
    []
  );

  // ================== SignalR Connection ==================
  const { isConnected, connection } = useSessionHub({
    sessionId: sessionId ?? "",
    enabled: !!sessionId && viewMode === "control-session",
    handlers: {
      onSessionStatusChanged: handleSessionStatusChanged,
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onQuestionActivated: handleQuestionActivated,
      onResponseReceived: handleResponseReceived,
      onLeaderboardUpdated: handleLeaderboardUpdated,
    },
  });

  // ================== Session Controls ==================
  const handleChangeStatus = async (
    action: "start" | "pause" | "resume" | "end"
  ) => {
    if (!session || changingStatus || !sessionId) return;

    try {
      setChangingStatus(true);
      if (action === "start") await startSession(sessionId);
      if (action === "pause") await pauseSession(sessionId);
      if (action === "resume") await resumeSession(sessionId);
      if (action === "end") await endSession(sessionId);

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status:
                action === "start"
                  ? "Running"
                  : action === "pause"
                    ? "Paused"
                    : action === "resume"
                      ? "Running"
                      : "Ended",
            }
          : prev
      );
    } catch (e: any) {
      console.error("Change session status failed:", e);
      toast.error(e?.message || "Không thay đổi được trạng thái session");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleLoadLeaderboard = async () => {
    if (!session || loadingLeaderboard || !sessionId) return;
    try {
      setLoadingLeaderboard(true);
      const data = await getSessionLeaderboard(sessionId, 10);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Load leaderboard failed:", e);
      setLeaderboard([]);
      toast.error(e?.message || "Không tải được bảng xếp hạng");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!session || questionControlLoading || !sessionId) return;
    try {
      setQuestionControlLoading(true);
      await activateNextQuestion(sessionId);
    } catch (e: any) {
      console.error("Next question failed:", e);
      toast.error(e?.message || "Không chuyển được sang câu tiếp theo");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!session || questionControlLoading || !sessionId) return;
    try {
      setQuestionControlLoading(true);
      await skipCurrentQuestion(sessionId);
    } catch (e: any) {
      console.error("Skip question failed:", e);
      toast.error(e?.message || "Không bỏ qua được câu hỏi");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleExtendQuestion = async () => {
    if (!currentQuestion || questionControlLoading) return;

    try {
      setQuestionControlLoading(true);
      await extendQuestionTime(currentQuestion.id, 30);
      toast.success("Đã thêm 30 giây");
    } catch (e: any) {
      console.error("Extend question failed:", e);
      toast.error(e?.message || "Không gia hạn được thời gian");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  // ================== Render States ==================
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
          <div className="text-white text-xl">Đang tải bản đồ...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center max-w-md px-4">
          <div className="text-red-400 text-2xl mb-4">⚠️ {error}</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapDetail?.center
    ? [mapDetail.center.latitude, mapDetail.center.longitude]
    : [10.8231, 106.6297];

  // ================== Main Layout ==================
  return (
    <div className="h-screen flex flex-col bg-zinc-900">
      {/* MAIN: left panel + map */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR: Controls */}
        <div className="w-[360px] border-r border-zinc-800 bg-zinc-950/95 flex flex-col">
          {/* HEADER */}
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
              Story Map
            </p>
            <h1 className="mt-1 text-lg font-semibold text-white truncate">
              {mapDetail?.name || "Bản đồ chưa đặt tên"}
            </h1>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Broadcasting: storymap-{mapId.slice(0, 8)}…</span>
              </div>

              {session && (
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border " +
                    (session.status === "Running"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : session.status === "Paused"
                        ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                        : session.status === "Ended"
                          ? "border-rose-500/70 bg-rose-600/10 text-rose-300"
                          : "border-sky-400/60 bg-sky-500/10 text-sky-200")
                  }
                >
                  ● {session.status}
                </span>
              )}
            </div>
          </div>

          {/* BODY: Create Session or Control Session */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4">
            {/* CREATE SESSION MODE */}
            {viewMode === "create-session" && !session && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                    Tạo Session Mới
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Chọn bộ câu hỏi để bắt đầu session tương tác
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-2">
                    Chọn bộ câu hỏi:
                  </label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn bộ câu hỏi --</option>
                    {questionBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.bankName} ({bank.totalQuestions || 0} câu)
                      </option>
                    ))}
                  </select>
                </div>

                {questionBanks.length === 0 && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                    Chưa có bộ câu hỏi nào cho bản đồ này. Vui lòng tạo bộ câu hỏi trước.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={!selectedBankId || isCreating}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:opacity-50 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
                >
                  {isCreating ? "Đang tạo..." : "Tạo Session"}
                </button>
              </section>
            )}

            {/* CONTROL SESSION MODE */}
            {viewMode === "control-session" && session && (
              <>
                {/* SESSION CARD */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                        Phiên tương tác
                      </p>
                      <p className="text-xs text-zinc-400">
                        Quản lý mã tham gia & trạng thái
                      </p>
                    </div>

                    <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700">
                      ID: {session.id.slice(0, 6)}…
                    </span>
                  </div>

                  {/* MÃ CODE */}
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-zinc-400">Code cho học sinh</p>
                      <p className="font-mono text-xl font-semibold tracking-[0.18em] text-emerald-400">
                        {session.sessionCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(session.sessionCode)
                      }
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
                    >
                      <span>Copy</span>
                    </button>
                  </div>

                  {/* TRẠNG THÁI + NÚT ĐIỀU KHIỂN */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Trạng thái:{" "}
                      <span className="font-semibold text-zinc-100">
                        {session.status}
                      </span>
                    </span>
                    {participantCount > 0 && (
                      <span>
                        Tham gia:{" "}
                        <span className="font-semibold text-emerald-300">
                          {participantCount}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleChangeStatus("start")}
                      disabled={
                        changingStatus || session.status === "Running"
                      }
                      className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeStatus("pause")}
                      disabled={
                        changingStatus || session.status !== "Running"
                      }
                      className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-amber-400/70 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeStatus("resume")}
                      disabled={
                        changingStatus || session.status !== "Paused"
                      }
                      className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-sky-400/70 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeStatus("end")}
                      disabled={changingStatus || session.status === "Ended"}
                      className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-rose-500/70 bg-rose-600/10 text-rose-100 hover:bg-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      End
                    </button>
                  </div>

                  {/* QUESTION CONTROLS */}
                  <div className="mt-2 border-t border-zinc-800 pt-2">
                    <p className="text-[11px] text-zinc-500 mb-1">
                      Điều khiển câu hỏi (giáo viên)
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        disabled={
                          !session ||
                          questionControlLoading ||
                          session.status !== "Running"
                        }
                        className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-sky-400/70 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Câu tiếp
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipQuestion}
                        disabled={
                          !session ||
                          questionControlLoading ||
                          session.status !== "Running"
                        }
                        className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-amber-400/70 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        onClick={handleExtendQuestion}
                        disabled={
                          !session ||
                          questionControlLoading ||
                          !currentQuestion ||
                          session.status !== "Running"
                        }
                        className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-emerald-500/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +30s
                      </button>
                    </div>
                  </div>

                  {/* CURRENT QUESTION */}
                  {currentQuestion && (
                    <div className="mt-2 border-t border-zinc-800 pt-2">
                      <p className="text-[11px] text-zinc-500 mb-1">
                        Câu hỏi hiện tại
                      </p>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
                        <p className="text-xs text-zinc-100 mb-1">
                          {currentQuestion.questionText}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          <span>{currentQuestion.points} điểm</span>
                          {currentQuestion.timeLimit && (
                            <>
                              <span>•</span>
                              <span>{currentQuestion.timeLimit}s</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{responsesReceived} phản hồi</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LEADERBOARD */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-zinc-500">
                      HS truy cập link lớp học rồi nhập code ở trên.
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadLeaderboard}
                      className="text-[11px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline"
                    >
                      Xem bảng xếp hạng
                    </button>
                  </div>

                  {leaderboard.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1">
                      {loadingLeaderboard && (
                        <p className="text-[11px] text-zinc-500">
                          Đang tải bảng xếp hạng...
                        </p>
                      )}

                      {!loadingLeaderboard &&
                        leaderboard.map((p, idx) => (
                          <div
                            key={p.participantId ?? idx}
                            className="flex items-center justify-between text-[11px] text-zinc-200"
                          >
                            <span>
                              #{p.rank ?? idx + 1} {p.displayName}
                            </span>
                            <span className="font-semibold">{p.score}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </section>

                {/* QUESTION BANK INFO */}
                {questionBankMeta && (
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                          Bộ câu hỏi
                        </p>
                      </div>
                      {typeof questionBankMeta.totalQuestions === "number" && (
                        <div className="text-right text-[11px] text-zinc-300">
                          <div className="font-semibold">
                            {questionBankMeta.totalQuestions}
                          </div>
                          <div className="text-zinc-500">câu hỏi</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {questionBankMeta.bankName || "Bộ câu hỏi"}
                      </p>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Map Viewer */}
        <div className="flex-1 min-h-0">
          <StoryMapViewer
            mapId={mapId}
            segments={segments}
            baseMapProvider={mapDetail?.baseMapProvider}
            initialCenter={center}
            initialZoom={mapDetail?.defaultZoom || 10}
            onSegmentChange={handleSegmentChange}
          />
        </div>
      </div>

      {/* BOTTOM: Timeline panel */}
      <div className="h-24 border-t border-zinc-800 bg-zinc-900/95 px-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSegment(currentIndex - 1)}
            disabled={segments.length === 0 || currentIndex === 0}
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-100 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            ◀ Trước
          </button>
          <button
            onClick={() => goToSegment(currentIndex + 1)}
            disabled={
              segments.length === 0 || currentIndex >= segments.length - 1
            }
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-100 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            Sau ▶
          </button>
        </div>

        <div className="text-xs text-zinc-300 min-w-[110px]">
          Segment{" "}
          <span className="font-semibold text-white">
            {segments.length === 0 ? 0 : currentIndex + 1}
          </span>{" "}
          / <span className="font-semibold text-white">{segments.length}</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-2">
            {segments.map((seg, index) => (
              <button
                key={seg.segmentId}
                onClick={() => goToSegment(index)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                  index === currentIndex
                    ? "bg-blue-500 text-white border-blue-400"
                    : "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                {index + 1}. {seg.name || "Untitled"}
              </button>
            ))}

            {segments.length === 0 && (
              <div className="text-xs text-zinc-500">
                No segments – please add segments in the editor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
