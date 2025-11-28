"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";

import {
  getCurrentQuestionForParticipant,
  submitParticipantResponse,
  getSession,
  getSessionLeaderboard,
  type SessionRunningQuestionDto,
  type SessionDto,
  type LeaderboardEntryDto,
} from "@/lib/api-ques";

import { useSessionHub } from "@/hooks/useSessionHub";
import type {
  SessionStatusChangedEvent,
  SegmentSyncEvent,
  QuestionBroadcastEvent,
  QuestionResultsEvent,
  SessionEndedEvent,
  JoinedSessionEvent,
} from "@/lib/hubs/session";
import { toast } from "react-toastify";

type ViewState = "waiting" | "viewing" | "question" | "results" | "ended";

export default function StoryMapViewPage() {
  const params = useParams<{ mapId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = params?.mapId ?? "";
  const sessionId = searchParams.get("sessionId") ?? "";
  const participantIdFromUrl = searchParams.get("participantId") ?? "";

  // User info state
  const [displayName, setDisplayName] = useState("Học sinh");
  const [sessionCode, setSessionCode] = useState("");
  const [participantId, setParticipantId] = useState("");

  // Session state
  const [session, setSession] = useState<SessionDto | null>(null);
  const [viewState, setViewState] = useState<ViewState>("waiting");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);

  // Map and segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = no segment selected yet
  const [isTeacherPlaying, setIsTeacherPlaying] = useState(false); // Track if teacher is playing
  const [hasReceivedSegmentSync, setHasReceivedSegmentSync] = useState(false); // Track if we've received a live sync from teacher
  const [error, setError] = useState<string | null>(null);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<QuestionBroadcastEvent | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResultsEvent | null>(null);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load user info from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedName = window.sessionStorage.getItem("imos_student_name");
    const storedCode = window.sessionStorage.getItem("imos_session_code");
    const storedParticipant = window.sessionStorage.getItem("imos_participant_id") || participantIdFromUrl;

    if (storedName) setDisplayName(storedName);
    if (storedCode) setSessionCode(storedCode);

    if (storedParticipant) {
      setParticipantId(storedParticipant);
    } else if (sessionId) {
      setError(
        "Không tìm thấy thông tin học viên. Vui lòng quay lại và tham gia lại bằng mã tiết học."
      );
    }
  }, [sessionId, participantIdFromUrl]);

  // Load session info (only for initial data, viewState is controlled by SignalR)
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    (async () => {
      try {
        const sessionData = await getSession(sessionId);
        if (cancelled) return;
        setSession(sessionData);
        
        // Only set ended state from API - other states are controlled by SignalR
        const status = sessionData.status as string;
        if (status === "COMPLETED" || status === "Ended") {
          setViewState("ended");
          // Load final leaderboard
          try {
            const lb = await getSessionLeaderboard(sessionId, 100);
            setLeaderboard(lb);
          } catch (e) {
            console.error("Failed to load leaderboard:", e);
          }
        }
        // Note: viewState "waiting" or "viewing" will be set by JoinedSession event
        // This ensures we get the correct cached segment state from the hub
      } catch (e: any) {
        console.error("Load session failed:", e);
        if (!cancelled) {
          setError(e?.message || "Không tải được thông tin tiết học.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [sessionId]);

  // Load map and segments
  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setError(null);

        const [detail, segs] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        setMapDetail(detail);
        setSegments(segs);
      } catch (e: any) {
        console.error("Load student view failed:", e);
        setError(e?.message || "Không tải được bản đồ.");
      }
    })();
  }, [mapId]);

  // ================== SignalR Event Handlers ==================

  // Handle JoinedSession - sent when student joins/rejoins the session
  const handleJoinedSession = useCallback((event: JoinedSessionEvent) => {
    console.log("[Student] JoinedSession event:", event);
    
    // Reset sync state when joining/rejoining
    setHasReceivedSegmentSync(false);
    setCurrentIndex(-1); // Reset to no segment selected
    setIsTeacherPlaying(false);
    
    // Set view state based on session status
    const status = event.status as string;
    if (status === "IN_PROGRESS" || status === "Running") {
      // Session is in progress - show viewing state
      // But don't render segments until teacher sends live sync
      setViewState("viewing");
      // Note: We don't use cached segmentState here - wait for live SegmentSync event
    } else if (status === "COMPLETED" || status === "Ended") {
      setViewState("ended");
    } else {
      setViewState("waiting");
    }
  }, []);
  
  const handleSessionStatusChanged = useCallback((event: SessionStatusChangedEvent) => {
    console.log("[Student] SessionStatusChanged event:", event);
    
    const status = event.status as string;
    if (status === "IN_PROGRESS" || status === "Running") {
      // Session started - but wait for teacher to sync segment before playing
      setViewState("viewing");
      toast.info("Tiết học đã bắt đầu!");
    } else if (status === "PAUSED" || status === "Paused") {
      setIsTeacherPlaying(false);
      toast.info("Tiết học đã tạm dừng");
    } else if (status === "COMPLETED" || status === "Ended") {
      setViewState("ended");
      setIsTeacherPlaying(false);
      toast.info("Tiết học đã kết thúc");
    }
  }, []);

  // Track previous segment sync to avoid duplicate processing
  const prevSegmentSyncRef = useRef<{ index: number; isPlaying: boolean; timestamp: number } | null>(null);
  
  // Track play start time to ignore rapid stop signals
  const playStartTimeRef = useRef<number>(0);
  const MIN_PLAY_DURATION_MS = 1000; // Minimum 1 second before accepting stop

  const handleSegmentSync = useCallback((event: SegmentSyncEvent) => {
    console.log("[Student] SegmentSync event:", event);
    
    const idx = event.segmentIndex;
    const shouldPlay = typeof event.isPlaying === "boolean" ? event.isPlaying : false;
    const now = Date.now();
    
    // Check if this is a duplicate event (same index and same isPlaying)
    const prev = prevSegmentSyncRef.current;
    if (prev && prev.index === idx && prev.isPlaying === shouldPlay) {
      console.log("[Student] Ignoring duplicate SegmentSync event");
      return;
    }
    
    // CRITICAL: Ignore rapid stop signals after play
    // Teacher's playback hook sometimes sends stop right after play
    if (prev && prev.isPlaying === true && shouldPlay === false) {
      const timeSincePlay = now - prev.timestamp;
      if (timeSincePlay < MIN_PLAY_DURATION_MS) {
        console.log("[Student] Ignoring rapid stop signal -", timeSincePlay, "ms since play (min:", MIN_PLAY_DURATION_MS, "ms)");
        return; // Ignore this stop
      }
    }
    
    // Update ref with timestamp
    prevSegmentSyncRef.current = { index: idx, isPlaying: shouldPlay, timestamp: now };
    
    // Only update segment index when receiving live sync from teacher
    if (typeof idx === "number" && idx >= 0) {
      // Check if segment changed
      setCurrentIndex(prevIndex => {
        if (prevIndex !== idx) {
          console.log("[Student] Segment changed from", prevIndex, "to", idx);
          // When segment changes, stop playing immediately
          setIsTeacherPlaying(false);
        }
        return idx;
      });
      setHasReceivedSegmentSync(true); // Mark that we've received a live sync
    }
    
    // Update playing state from teacher
    console.log("[Student] Setting isTeacherPlaying to", shouldPlay);
    setIsTeacherPlaying(shouldPlay);
    
    // When viewing map, ensure we're in viewing state
    if (viewState === "waiting") {
      setViewState("viewing");
    }
  }, [viewState]);

  const handleQuestionBroadcast = useCallback((event: QuestionBroadcastEvent) => {
    console.log("[Student] QuestionBroadcast event:", event);
    
    setCurrentQuestion(event);
    setSelectedOptionId(null);
    setHasSubmitted(false);
    setInfoMessage(null);
    setQuestionResults(null);
    setViewState("question");
    
    // Start countdown timer
    if (event.timeLimit > 0) {
      setTimeRemaining(event.timeLimit);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    toast.success(`Câu hỏi mới! ${event.points} điểm`);
  }, []);

  const handleQuestionResults = useCallback((event: QuestionResultsEvent) => {
    console.log("[Student] QuestionResults event:", event);
    
    setQuestionResults(event);
    setViewState("results");
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    toast.info("Xem kết quả câu hỏi!");
  }, []);

  const handleSessionEnded = useCallback((event: SessionEndedEvent) => {
    console.log("[Student] SessionEnded event:", event);
    
    setViewState("ended");
    setLeaderboard(event.finalLeaderboard || []);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    toast.info("Tiết học đã kết thúc!");
  }, []);

  // ================== SignalR Connection ==================
  const { isConnected, error: hubError } = useSessionHub({
    sessionId: sessionId,
    enabled: !!sessionId && !!participantId,
    handlers: {
      onJoinedSession: handleJoinedSession,
      onSessionStatusChanged: handleSessionStatusChanged,
      onSegmentSync: handleSegmentSync,
      onQuestionBroadcast: handleQuestionBroadcast,
      onQuestionResults: handleQuestionResults,
      onSessionEnded: handleSessionEnded,
    },
  });

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ================== Submit Answer ==================
  const handleSubmitAnswer = async () => {
    if (!participantId || !currentQuestion || !selectedOptionId || hasSubmitted) {
      if (!selectedOptionId) {
        setInfoMessage("Vui lòng chọn một đáp án trước khi gửi.");
      }
      return;
    }

    try {
      setAnswering(true);
      setInfoMessage(null);

      await submitParticipantResponse(participantId, {
        sessionQuestionId: currentQuestion.questionId,
        questionOptionId: selectedOptionId,
      });

      setHasSubmitted(true);
      setInfoMessage("Đã gửi đáp án! Chờ giáo viên hiển thị kết quả...");
      toast.success("Đã gửi đáp án!");
    } catch (e: any) {
      console.error("Submit answer failed:", e);
      setInfoMessage(
        e?.message || "Gửi đáp án thất bại. Vui lòng thử lại."
      );
    } finally {
      setAnswering(false);
    }
  };

  // Continue viewing map after results
  const handleContinueViewing = () => {
    setCurrentQuestion(null);
    setQuestionResults(null);
    setViewState("viewing");
  };

  // ================== Render States ==================

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md text-center space-y-3 px-4">
          <p className="text-lg font-semibold text-rose-400">
            Không thể tham gia tiết học
          </p>
          <p className="text-sm text-zinc-300">{error}</p>
          <button
            onClick={() => router.push("/session/join")}
            className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
          >
            Quay lại trang tham gia
          </button>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapDetail?.center
    ? [mapDetail.center.latitude, mapDetail.center.longitude]
    : [10.8231, 106.6297];

  // Ensure currentIndex is valid (>= 0 and within segments array)
  const safeCurrentIndex = currentIndex >= 0 && currentIndex < segments.length ? currentIndex : 0;
  const currentSegment = segments.length > 0 ? segments[safeCurrentIndex] : null;

  // ================== WAITING STATE ==================
  if (viewState === "waiting") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
            Chờ giáo viên bắt đầu tiết học...
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Bạn đã tham gia thành công!
          </p>
          
          {sessionCode && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 mb-4">
              <p className="text-[11px] text-emerald-400 uppercase tracking-wider">Mã tiết học</p>
              <p className="text-2xl font-mono font-bold text-emerald-300">{sessionCode}</p>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
            <span>{isConnected ? "Đã kết nối" : "Đang kết nối..."}</span>
          </div>
          
          <p className="mt-2 text-[11px] text-zinc-400">
            Xin chào, <span className="font-semibold text-emerald-300">{displayName}</span>
          </p>
        </div>
      </div>
    );
  }

  // ================== ENDED STATE ==================
  if (viewState === "ended") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
        <div className="text-center max-w-lg px-4">
          <div className="text-6xl mb-6">🏁</div>
          <h2 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
            Tiết học đã kết thúc!
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Cảm ơn bạn đã tham gia!
          </p>

          {/* Final Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4 mb-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
                Bảng xếp hạng
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.participantId}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      entry.participantId === participantId
                        ? "bg-emerald-500/20 border border-emerald-500/40"
                        : "bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        idx === 0 ? "bg-yellow-500 text-yellow-900" :
                        idx === 1 ? "bg-gray-300 text-gray-800" :
                        idx === 2 ? "bg-amber-600 text-amber-100" :
                        "bg-zinc-700 text-zinc-300"
                      }`}>
                        {entry.rank ?? idx + 1}
                      </span>
                      <span className="text-zinc-100">{entry.displayName}</span>
                    </div>
                    <span className="font-bold text-emerald-400">{entry.score} điểm</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => router.push("/session/join")}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Tham gia tiết học khác
          </button>
        </div>
      </div>
    );
  }

  // ================== MAIN LAYOUT (VIEWING / QUESTION / RESULTS) ==================
  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-50">
      {/* LEFT SIDEBAR */}
      <div className="w-[360px] border-r border-zinc-800 bg-zinc-950/95 flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
            Đang xem tiết học
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white truncate">
            {mapDetail?.name || "Bản đồ chưa đặt tên"}
          </h1>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-400">
              <p className="font-semibold text-zinc-200">{displayName}</p>
              {currentSegment && currentIndex >= 0 && (
                <p className="mt-0.5">
                  Đang xem:{" "}
                  <span className="text-zinc-50">
                    {safeCurrentIndex + 1}. {currentSegment.name || "Segment"}
                  </span>
                </p>
              )}
            </div>

            {sessionCode && (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                  Mã tiết học
                </p>
                <p className="mt-1 text-base font-mono font-semibold text-emerald-200">
                  {sessionCode}
                </p>
              </div>
            )}
          </div>
          
          {/* Connection status */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
            <span>{isConnected ? "Đã kết nối với giáo viên" : "Đang kết nối..."}</span>
            {isTeacherPlaying && (
              <span className="ml-2 text-emerald-400">▶ Đang phát</span>
            )}
          </div>
        </div>

        {/* Question Panel */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4">
          {/* Current Question Card */}
          {(viewState === "question" || viewState === "results") && currentQuestion && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                  {viewState === "results" ? "Kết quả câu hỏi" : "Câu hỏi hiện tại"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">
                    {currentQuestion.points} điểm
                  </span>
                  {viewState === "question" && timeRemaining !== null && (
                    <span className={`font-mono text-sm font-bold ${
                      timeRemaining <= 10 ? "text-red-400" : "text-emerald-400"
                    }`}>
                      {timeRemaining}s
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 px-3 py-2">
                <p className="text-sm text-zinc-50 whitespace-pre-wrap">
                  {currentQuestion.questionText}
                </p>
                {currentQuestion.questionImageUrl && (
                  <img
                    src={currentQuestion.questionImageUrl}
                    alt="Question"
                    className="mt-2 rounded-lg max-h-40 object-contain"
                  />
                )}
              </div>

              {/* Answer Options */}
              {viewState === "question" && currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="space-y-1.5">
                  {[...currentQuestion.options]
                    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                    .map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-[13px] transition ${
                          hasSubmitted
                            ? "opacity-60 cursor-not-allowed"
                            : selectedOptionId === opt.id
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-50"
                            : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name="answer"
                          value={opt.id}
                          checked={selectedOptionId === opt.id}
                          onChange={() => !hasSubmitted && setSelectedOptionId(opt.id)}
                          disabled={hasSubmitted}
                          className="mt-[3px] h-3 w-3 accent-emerald-500"
                        />
                        <span>{opt.optionText || "(Không có nội dung)"}</span>
                      </label>
                    ))}
                </div>
              )}

              {/* Submit Button */}
              {viewState === "question" && !hasSubmitted && (
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={answering || !selectedOptionId}
                  className="mt-2 inline-flex justify-center w-full rounded-lg px-3 py-2 text-[13px] font-medium border border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {answering ? "Đang gửi..." : "Gửi đáp án"}
                </button>
              )}

              {/* Submitted Message */}
              {viewState === "question" && hasSubmitted && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[12px] text-emerald-300">
                  ✅ Đã gửi đáp án! Chờ giáo viên hiển thị kết quả...
                </div>
              )}

              {/* Results Display */}
              {viewState === "results" && questionResults && (
                <div className="space-y-2">
                  {questionResults.correctAnswer && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                      <p className="text-[11px] text-emerald-400 uppercase tracking-wider mb-1">Đáp án đúng</p>
                      <p className="text-sm text-emerald-100 font-medium">{questionResults.correctAnswer}</p>
                    </div>
                  )}
                  
                  {questionResults.results && questionResults.results.length > 0 && (
                    <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Kết quả các bạn</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {questionResults.results.map((result, idx) => (
                          <div
                            key={result.participantId}
                            className={`flex items-center justify-between text-[11px] ${
                              result.participantId === participantId
                                ? "text-emerald-300 font-semibold"
                                : "text-zinc-300"
                            }`}
                          >
                            <span>
                              {result.displayName}
                              {result.participantId === participantId && " (Bạn)"}
                            </span>
                            <span className={result.isCorrect ? "text-emerald-400" : "text-red-400"}>
                              {result.isCorrect ? `+${result.pointsEarned}` : "Sai"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleContinueViewing}
                    className="mt-2 inline-flex justify-center w-full rounded-lg px-3 py-2 text-[13px] font-medium border border-sky-500/70 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                  >
                    Tiếp tục xem bản đồ
                  </button>
                </div>
              )}

              {infoMessage && (
                <p className="text-[11px] text-zinc-400 mt-1">{infoMessage}</p>
              )}
            </section>
          )}

          {/* No Question - Viewing Map */}
          {viewState === "viewing" && !currentQuestion && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium mb-2">
                Thông tin
              </p>
              <p className="text-[12px] text-zinc-400">
                Giáo viên đang điều khiển bản đồ. Hãy theo dõi màn hình chính.
              </p>
              {currentSegment && currentIndex >= 0 && (
                <div className="mt-3 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                  <p className="text-[11px] text-zinc-500">Segment hiện tại:</p>
                  <p className="text-[13px] text-zinc-100 font-medium">
                    {safeCurrentIndex + 1}. {currentSegment.name || "Không có tên"}
                  </p>
                  {currentSegment.description && (
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {currentSegment.description}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* MAP AREA - ALWAYS RENDER MAP, just show overlay when waiting for sync */}
      <div className="flex-1 min-h-0 relative">
        {/* Always render the map to avoid unmount/remount issues */}
        {segments.length > 0 && (
          <StoryMapViewer
            mapId={mapId}
            segments={segments}
            baseMapProvider={mapDetail?.baseMapProvider}
            initialCenter={center}
            initialZoom={mapDetail?.defaultZoom || 10}
            controlledIndex={hasReceivedSegmentSync && currentIndex >= 0 ? safeCurrentIndex : undefined}
            controlledPlaying={hasReceivedSegmentSync ? isTeacherPlaying : false}
            controlsEnabled={false}
          />
        )}
        
        {/* Overlay when waiting for teacher sync */}
        {(!hasReceivedSegmentSync || currentIndex < 0) && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <p className="text-zinc-400">Chờ giáo viên điều khiển bản đồ...</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
                <span className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
                <span>{isConnected ? "Đã kết nối" : "Đang kết nối..."}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUESTION OVERLAY - When question is active */}
      {viewState === "question" && currentQuestion && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900/95 backdrop-blur-sm border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl max-w-lg mx-4 pointer-events-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-sm font-semibold">
                  {currentQuestion.points} điểm
                </span>
                {timeRemaining !== null && (
                  <span className={`font-mono text-2xl font-bold ${
                    timeRemaining <= 10 ? "text-red-400 animate-pulse" : "text-white"
                  }`}>
                    {timeRemaining}s
                  </span>
                )}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-4">
              {currentQuestion.questionText}
            </h2>

            {currentQuestion.questionImageUrl && (
              <img
                src={currentQuestion.questionImageUrl}
                alt="Question"
                className="mb-4 rounded-lg max-h-48 mx-auto object-contain"
              />
            )}

            <p className="text-zinc-400 text-sm">
              Trả lời câu hỏi ở sidebar bên trái →
            </p>
          </div>
        </div>
      )}
    </div>
  );
}