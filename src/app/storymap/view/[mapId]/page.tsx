"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";

import {
  submitParticipantResponse,
  getSession,
  getSessionLeaderboard,
  leaveSession,
  type SessionDto,
  type LeaderboardEntryDto,
} from "@/lib/api-ques";

import { useSessionHub } from "@/hooks/useSessionHub";
import {
  leaveSessionConnection,
  stopSessionConnection,
  type SessionStatusChangedEvent,
  type SegmentSyncEvent,
  type QuestionBroadcastEvent,
  type QuestionResultsEvent,
  type SessionEndedEvent,
  type JoinedSessionEvent,
} from "@/lib/hubs/session";

import {
  createGroupCollaborationConnection,
  startGroupCollaborationConnection,
  stopGroupCollaborationConnection,
  joinGroupCollaborationSession,
  joinGroupCollaborationGroup,
  leaveGroupCollaborationGroup,
  submitGroupWorkViaSignalR,
  sendMessageViaSignalR,
  registerGroupCollaborationEventHandlers,
  unregisterGroupCollaborationEventHandlers,
  type GroupDto,
  type GroupChatMessage,
  type GroupSubmissionDto,
  type GroupGradedSubmissionDto,
} from "@/lib/hubs/groupCollaboration";
import { getGroupsBySession } from "@/lib/api-groupCollaboration";

import { toast } from "react-toastify";

type ViewState = "waiting" | "viewing" | "question" | "results" | "ended";

export default function StoryMapViewPage() {
  const params = useParams<{ mapId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapId = params?.mapId ?? "";
  const sessionId = searchParams.get("sessionId") ?? "";
  const participantIdFromUrl = searchParams.get("participantId") ?? "";

  const [displayName, setDisplayName] = useState("Học sinh");
  const [sessionCode, setSessionCode] = useState("");
  const [participantId, setParticipantId] = useState("");

  const [session, setSession] = useState<SessionDto | null>(null);
  const [viewState, setViewState] = useState<ViewState>("waiting");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isTeacherPlaying, setIsTeacherPlaying] = useState(false);
  const [hasReceivedSegmentSync, setHasReceivedSegmentSync] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState<QuestionBroadcastEvent | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResultsEvent | null>(null);

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [isLeaving, setIsLeaving] = useState(false);

  // ==== Group Collaboration state ====
  const [groupConnection, setGroupConnection] = useState<any>(null);
  const [sessionGroups, setSessionGroups] = useState<GroupDto[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessage[]>([]);
  const [groupWorkContent, setGroupWorkContent] = useState("");
  const [groupChatInput, setGroupChatInput] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedName = window.sessionStorage.getItem("imos_student_name");
    const storedCode = window.sessionStorage.getItem("imos_session_code");
    const storedParticipant =
      window.sessionStorage.getItem("imos_participant_id") || participantIdFromUrl;

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

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    (async () => {
      try {
        const sessionData = await getSession(sessionId);
        if (cancelled) return;
        setSession(sessionData);

        const status = sessionData.status as string;
        if (status === "COMPLETED" || status === "Ended") {
          setViewState("ended");
          try {
            const lb = await getSessionLeaderboard(sessionId, 100);
            setLeaderboard(lb);
          } catch (e) {
            console.error("Failed to load leaderboard:", e);
          }
        }
      } catch (e: any) {
        console.error("Load session failed:", e);
        if (!cancelled) {
          setError(e?.message || "Không tải được thông tin tiết học.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setError(null);

        const [detail, segs] = await Promise.all([getMapDetail(mapId), getSegments(mapId)]);

        setMapDetail(detail);
        setSegments(Array.isArray(segs) ? segs : []);
      } catch (e: any) {
        console.error("Load student view failed:", e);
        setError(e?.message || "Không tải được bản đồ.");
      }
    })();
  }, [mapId]);

  // ==== Load groups of this session (list nhóm để join) ====
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getGroupsBySession(sessionId);
        if (!cancelled) {
          setSessionGroups(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("[GroupCollab][View] Load groups failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleJoinedSession = useCallback((event: JoinedSessionEvent) => {
    setHasReceivedSegmentSync(false);
    setCurrentIndex(-1);
    setIsTeacherPlaying(false);

    const status = event.status as string;
    if (status === "IN_PROGRESS" || status === "Running") {
      setViewState("viewing");
    } else if (status === "COMPLETED" || status === "Ended") {
      setViewState("ended");
    } else {
      setViewState("waiting");
    }
  }, []);

  const handleSessionStatusChanged = useCallback((event: SessionStatusChangedEvent) => {
    const status = event.status as string;
    if (status === "IN_PROGRESS" || status === "Running") {
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

  const prevSegmentSyncRef = useRef<{
    index: number;
    isPlaying: boolean;
    timestamp: number;
  } | null>(null);

  const MIN_PLAY_DURATION_MS = 1000;

  const handleSegmentSync = useCallback(
    (event: SegmentSyncEvent) => {
      const idx = event.segmentIndex;
      const shouldPlay = typeof event.isPlaying === "boolean" ? event.isPlaying : false;
      const now = Date.now();

      const prev = prevSegmentSyncRef.current;
      if (prev && prev.index === idx && prev.isPlaying === shouldPlay) {
        return;
      }

      if (prev && prev.isPlaying === true && shouldPlay === false) {
        const timeSincePlay = now - prev.timestamp;
        if (timeSincePlay < MIN_PLAY_DURATION_MS) {
          return;
        }
      }

      prevSegmentSyncRef.current = { index: idx, isPlaying: shouldPlay, timestamp: now };

      if (typeof idx === "number" && idx >= 0) {
        setCurrentIndex((prevIndex) => {
          const segmentChanged = prevIndex !== idx;

          if (segmentChanged) {
            setIsTeacherPlaying(false);

            if (shouldPlay) {
              setTimeout(() => {
                setIsTeacherPlaying(true);
              }, 500);
            } else {
              setIsTeacherPlaying(false);
            }
          } else {
            setIsTeacherPlaying(shouldPlay);
          }

          return idx;
        });

        setHasReceivedSegmentSync(true);
      } else {
        setIsTeacherPlaying(shouldPlay);
      }

      if (viewState === "waiting") {
        setViewState("viewing");
      }
    },
    [viewState, mapId]
  );

  const handleQuestionBroadcast = useCallback((event: QuestionBroadcastEvent) => {
    setCurrentQuestion(event);
    setSelectedOptionId(null);
    setHasSubmitted(false);
    setInfoMessage(null);
    setQuestionResults(null);
    setViewState("question");

    if (event.timeLimit > 0) {
      setTimeRemaining(event.timeLimit);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
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
    setQuestionResults(event);
    setViewState("results");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    toast.info("Xem kết quả câu hỏi!");
  }, []);

  const handleSessionEnded = useCallback((event: SessionEndedEvent) => {
    setViewState("ended");
    setLeaderboard(event.finalLeaderboard || []);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    toast.info("Tiết học đã kết thúc!");
  }, []);

  const { connection, isConnected } = useSessionHub({
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

  useEffect(() => {
    if (!sessionId || !participantId) return;

    const conn = createGroupCollaborationConnection();
    if (!conn) return;
    setGroupConnection(conn);

    registerGroupCollaborationEventHandlers(conn, {
      onGroupCreated: (group: GroupDto) => {
        setSessionGroups((prev) => {
          if (prev.some((g) => g.id === group.id)) return prev;
          return [...prev, group];
        });
      },
      onMessageReceived: (msg: GroupChatMessage) => {
        setGroupMessages((prev) => [...prev, msg]);
      },
      onWorkSubmitted: () => {
        toast.info("Nhóm đã gửi bài thành công!");
      },
      onSubmissionGraded: () => {
        toast.info("Bài nhóm đã được chấm điểm!");
      },
      onError: (err: any) => {
        console.error("[GroupCollab][View] Error:", err);
      },
    });

    (async () => {
      try {
        const started = await startGroupCollaborationConnection(conn);
        if (started) {
          await joinGroupCollaborationSession(conn, sessionId);
        }
      } catch (e) {
        console.error("[GroupCollab][View] Start connection failed:", e);
      }
    })();

    return () => {
      (async () => {
        try {
          unregisterGroupCollaborationEventHandlers(conn);
          await stopGroupCollaborationConnection(conn);
        } catch (err) {
          console.error("[GroupCollab][View] Stop connection failed:", err);
        }
      })();
    };
  }, [sessionId, participantId]);


  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
        sessionQuestionId: currentQuestion.sessionQuestionId,
        questionOptionId: selectedOptionId,
      });

      setHasSubmitted(true);
      setInfoMessage("Đã gửi đáp án! Chờ giáo viên hiển thị kết quả...");
      toast.success("Đã gửi đáp án!");
    } catch (e: any) {
      console.error("Submit answer failed:", e);
      setInfoMessage(e?.message || "Gửi đáp án thất bại. Vui lòng thử lại.");
    } finally {
      setAnswering(false);
    }
  };

  const handleContinueViewing = () => {
    setCurrentQuestion(null);
    setQuestionResults(null);
    setViewState("viewing");
  };

  // ==== GroupCollab helpers ====
  const handleJoinGroup = async (groupId: string) => {
    if (!groupConnection || !groupId) return;
    try {
      if (currentGroupId && currentGroupId !== groupId) {
        await leaveGroupCollaborationGroup(groupConnection, currentGroupId);
      }
      await joinGroupCollaborationGroup(groupConnection, groupId);
      setCurrentGroupId(groupId);
      setGroupMessages([]);
      toast.success("Đã tham gia nhóm!");
    } catch (e) {
      console.error("[GroupCollab][View] Join group failed:", e);
      toast.error("Không tham gia được nhóm.");
    }
  };

  const handleSubmitGroupWork = async () => {
    if (!groupConnection || !currentGroupId || !groupWorkContent.trim() || groupSubmitting) return;
    try {
      setGroupSubmitting(true);
      await submitGroupWorkViaSignalR(groupConnection, {
        groupId: currentGroupId,
        content: groupWorkContent.trim(),
      });
      setGroupWorkContent("");
      toast.success("Đã gửi bài nhóm!");
    } catch (e) {
      console.error("[GroupCollab][View] Submit group work failed:", e);
      toast.error("Gửi bài nhóm thất bại.");
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleSendGroupMessage = async () => {
    if (!groupConnection || !currentGroupId || !groupChatInput.trim()) return;
    try {
      await sendMessageViaSignalR(groupConnection, {
        groupId: currentGroupId,
        message: groupChatInput.trim(),
      });
      setGroupChatInput("");
    } catch (e) {
      console.error("[GroupCollab][View] Send group message failed:", e);
    }
  };

  const handleLeaveSession = async () => {
    if (isLeaving) return;
    setIsLeaving(true);

    if (participantId) {
      try {
        await leaveSession(participantId);
      } catch (err) {
        console.error("Leave session API failed:", err);
      }
    }

    if (connection) {
      try {
        await leaveSessionConnection(connection, sessionId);
      } catch (err) {
        console.error("LeaveSessionConnection error:", err);
      }

      try {
        await stopSessionConnection(connection);
      } catch (err) {
        console.error("StopSessionConnection error:", err);
      }
    }

    if (groupConnection) {
      try {
        if (currentGroupId) {
          await leaveGroupCollaborationGroup(groupConnection, currentGroupId);
        }
      } catch (err) {
        console.error("[GroupCollab][View] leaveGroup on leaveSession failed:", err);
      }
      try {
        await stopGroupCollaborationConnection(groupConnection);
      } catch (err) {
        console.error("[GroupCollab][View] stopGroupCollab failed:", err);
      }
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("imos_student_name");
      window.sessionStorage.removeItem("imos_session_code");
      window.sessionStorage.removeItem("imos_participant_id");
    }

    toast.info("Bạn đã rời tiết học.");
    router.push("/session/join");
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md text-center space-y-3 px-4">
          <p className="text-lg font-semibold text-rose-400">Không thể tham gia tiết học</p>
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

  const safeCurrentIndex =
    currentIndex >= 0 && currentIndex < segments.length ? currentIndex : 0;
  const currentSegment = segments.length > 0 ? segments[safeCurrentIndex] : null;

  if (viewState === "waiting") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
            Chờ giáo viên bắt đầu tiết học...
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Bạn đã tham gia thành công!</p>

          {sessionCode && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 mb-4">
              <p className="text-[11px] text-emerald-400 uppercase tracking-wider">Mã tiết học</p>
              <p className="text-2xl font-mono font-bold text-emerald-300">{sessionCode}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"
                } animate-pulse`}
            />
            <span>{isConnected ? "Đã kết nối" : "Đang kết nối..."}</span>
          </div>

          <p className="mt-2 text-[11px] text-zinc-400">
            Xin chào, <span className="font-semibold text-emerald-300">{displayName}</span>
          </p>
        </div>
      </div>
    );
  }

  if (viewState === "ended") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
        <div className="text-center max-w-lg px-4">
          <div className="text-6xl mb-6">🏁</div>
          <h2 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
            Tiết học đã kết thúc!
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Cảm ơn bạn đã tham gia!</p>

          {leaderboard.length > 0 && (
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4 mb-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
                Bảng xếp hạng
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.participantId}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${entry.participantId === participantId
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : "bg-zinc-800/50"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0
                          ? "bg-yellow-500 text-yellow-900"
                          : idx === 1
                            ? "bg-gray-300 text-gray-800"
                            : idx === 2
                              ? "bg-amber-600 text-amber-100"
                              : "bg-zinc-700 text-zinc-300"
                          }`}
                      >
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

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-50">
      {/* SIDEBAR TRÁI: giữ như cũ, không có Hoạt động nhóm */}
      <div className="w-[360px] border-r border-zinc-800 bg-zinc-950/95 flex flex-col">
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

          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"
                } animate-pulse`}
            />
            <span>{isConnected ? "Đã kết nối với giáo viên" : "Đang kết nối..."}</span>
            {isTeacherPlaying && <span className="ml-2 text-emerald-400">▶ Đang phát</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4">
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
                    <span
                      className={`font-mono text-sm font-bold ${timeRemaining <= 10 ? "text-red-400" : "text-emerald-400"
                        }`}
                    >
                      {timeRemaining}s
                    </span>
                  )}
                </div>
              </div>

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

              {viewState === "question" &&
                currentQuestion.options &&
                currentQuestion.options.length > 0 && (
                  <div className="space-y-1.5">
                    {[...currentQuestion.options]
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      .map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-[13px] transition ${hasSubmitted
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
                            onChange={() => {
                              if (!hasSubmitted && (timeRemaining === null || timeRemaining > 0)) {
                                setSelectedOptionId(opt.id);
                              }
                            }}
                            disabled={
                              hasSubmitted || (timeRemaining !== null && timeRemaining <= 0)
                            }
                            className="mt-[3px] h-3 w-3 accent-emerald-500"
                          />

                          <span>{opt.optionText || "(Không có nội dung)"}</span>
                        </label>
                      ))}
                  </div>
                )}

              {viewState === "question" && !hasSubmitted && (
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={
                    answering ||
                    !selectedOptionId ||
                    (timeRemaining !== null && timeRemaining <= 0)
                  }
                  className="mt-2 inline-flex justify-center w-full rounded-lg px-3 py-2 text-[13px] font-medium border border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {answering ? "Đang gửi..." : "Gửi đáp án"}
                </button>
              )}

              {viewState === "question" && hasSubmitted && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[12px] text-emerald-300">
                  ✅ Đã gửi đáp án! Chờ giáo viên hiển thị kết quả...
                </div>
              )}

              {viewState === "results" && questionResults && (
                <div className="space-y-2">
                  {questionResults.correctAnswer && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                      <p className="text-[11px] text-emerald-400 uppercase tracking-wider mb-1">
                        Đáp án đúng
                      </p>
                      <p className="text-sm text-emerald-100 font-medium">
                        {questionResults.correctAnswer}
                      </p>
                    </div>
                  )}

                  {questionResults.results && questionResults.results.length > 0 && (
                    <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 px-3 py-2">
                      <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                        Kết quả các bạn
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {questionResults.results.map((result) => (
                          <div
                            key={result.participantId}
                            className={`flex items-center justify-between text-[11px] ${result.participantId === participantId
                              ? "text-emerald-300 font-semibold"
                              : "text-zinc-300"
                              }`}
                          >
                            <span>
                              {result.displayName}
                              {result.participantId === participantId && " (Bạn)"}
                            </span>
                            <span
                              className={
                                result.isCorrect ? "text-emerald-400" : "text-red-400"
                              }
                            >
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

        <div className="px-4 pb-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleLeaveSession}
            disabled={isLeaving}
            className="w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-[13px] font-semibold border border-rose-500/60 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLeaving ? "Đang rời..." : "Rời tiết học"}
          </button>
        </div>
      </div>

      {/* MAP GIỮA */}
      <div className="flex-1 min-h-0 relative">
        {segments.length > 0 && (
          <StoryMapViewer
            mapId={mapId}
            segments={segments}
            baseMapProvider={mapDetail?.baseMapProvider}
            initialCenter={center}
            initialZoom={mapDetail?.defaultZoom || 10}
            controlledIndex={
              hasReceivedSegmentSync && currentIndex >= 0 ? safeCurrentIndex : undefined
            }
            controlledPlaying={hasReceivedSegmentSync ? isTeacherPlaying : false}
            controlsEnabled={false}
          />
        )}

        {(!hasReceivedSegmentSync || currentIndex < 0) && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <p className="text-zinc-400">Chờ giáo viên điều khiển bản đồ...</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"
                    } animate-pulse`}
                />
                <span>{isConnected ? "Đã kết nối" : "Đang kết nối..."}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PANEL PHẢI: Hoạt động nhóm */}
      <div className="w-[340px] border-l border-zinc-800 bg-zinc-950/95 flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
              Hoạt động nhóm
            </p>
            <span className="text-[10px] text-zinc-500">
              {currentGroupId ? "Đã vào nhóm" : "Chưa vào nhóm"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-3">
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {sessionGroups.length === 0 && (
              <p className="text-[12px] text-zinc-500">
                Giáo viên chưa tạo nhóm hoặc chưa cập nhật.
              </p>
            )}
            {sessionGroups.map((g, idx) => (
              <button
                key={g.id ?? idx}
                type="button"
                onClick={() => handleJoinGroup(g.id)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-[12px] border ${currentGroupId === g.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                  }`}
              >
                <span className="truncate">{g.name || `Nhóm ${idx + 1}`}</span>
                {typeof g.currentMembers === "number" && typeof g.maxMembers === "number" && (
                  <span className="text-[11px] text-zinc-400">
                    {g.currentMembers}/{g.maxMembers}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em]">
              Bài làm nhóm
            </p>
            <textarea
              value={groupWorkContent}
              onChange={(e) => setGroupWorkContent(e.target.value)}
              placeholder="Nội dung bài làm nhóm..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-[12px] resize-none h-20"
            />
            <button
              type="button"
              onClick={handleSubmitGroupWork}
              disabled={!currentGroupId || groupSubmitting || !groupWorkContent.trim()}
              className="w-full inline-flex justify-center rounded-lg px-3 py-2 text-[12px] font-medium border border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {groupSubmitting ? "Đang gửi bài nhóm..." : "Gửi bài nhóm"}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em]">
              Chat nhóm
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2">
              {groupMessages.length === 0 && (
                <p className="text-[11px] text-zinc-500">
                  Tin nhắn nhóm sẽ hiển thị tại đây.
                </p>
              )}
              {groupMessages.map((m, idx) => (
                <div key={idx} className="text-[11px] text-zinc-300">
                  <span className="font-semibold text-emerald-300">{m.userName}:</span>{" "}
                  <span>{m.message}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={groupChatInput}
                onChange={(e) => setGroupChatInput(e.target.value)}
                placeholder="Nhắn tin cho nhóm..."
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[12px]"
              />
              <button
                type="button"
                onClick={handleSendGroupMessage}
                disabled={!currentGroupId || !groupChatInput.trim()}
                className="px-3 py-1.5 rounded-lg text-[12px] border border-sky-500/70 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewState === "question" && currentQuestion && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900/95 backdrop-blur-sm border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl max-w-lg mx-4 pointer-events-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-sm font-semibold">
                  {currentQuestion.points} điểm
                </span>
                {timeRemaining !== null && (
                  <span
                    className={`font-mono text-2xl font-bold ${timeRemaining <= 10 ? "text-red-400 animate-pulse" : "text-white"
                      }`}
                  >
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

            <p className="text-zinc-400 text-sm">Trả lời câu hỏi ở sidebar bên trái →</p>
          </div>
        </div>
      )}
    </div>
  );
}
