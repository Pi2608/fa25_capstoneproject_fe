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
  type MapLayerSyncEvent,
} from "@/lib/hubs/session";
import type { BaseKey } from "@/types/common";

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

  // Layer sync state - receives layer from teacher
  const [selectedLayer, setSelectedLayer] = useState<BaseKey>("osm");

  const [currentQuestion, setCurrentQuestion] = useState<QuestionBroadcastEvent | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResultsEvent | null>(null);

  const [shortAnswerText, setShortAnswerText] = useState("");

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
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

        const status = (sessionData.status as string || "").toUpperCase();
        console.log("[View] Session status from API:", sessionData.status, "->", status);

        if (status === "COMPLETED" || status === "CANCELLED") {
          setViewState("ended");
          try {
            const lb = await getSessionLeaderboard(sessionId, 100);
            setLeaderboard(lb);
          } catch (e) {
            console.error("Failed to load leaderboard:", e);
          }
        } else if (status === "IN_PROGRESS") {
          setViewState("viewing");
        } else if (status === "PAUSED") {
          setViewState("viewing");
          setIsTeacherPlaying(false);
        } else {
          // WAITING or other status
          setViewState("waiting");
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

  useEffect(() => {
    if (!sessionId || !participantId) return;
    let cancelled = false;

    (async () => {
      try {
        const data: any[] = await getGroupsBySession(sessionId);

        if (cancelled) return;

        const groups = Array.isArray(data) ? data : [];

        const myGroup = groups.find((g: any) =>
          Array.isArray(g.members) &&
          g.members.some((m: any) =>
            (m.participantId ?? m.sessionParticipantId ?? m.id) === participantId
          )
        );

        setSessionGroups(myGroup ? [myGroup] : []);
      } catch (e) {
        console.error("[GroupCollab][View] Load groups failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId]);

  const handleJoinedSession = useCallback((event: JoinedSessionEvent) => {
    setHasReceivedSegmentSync(false);
    setCurrentIndex(-1);
    setIsTeacherPlaying(false);

    const status = (event.status as string || "").toUpperCase();
    console.log("[View] JoinedSession status:", event.status, "->", status);

    if (status === "IN_PROGRESS") {
      setViewState("viewing");
    } else if (status === "COMPLETED" || status === "CANCELLED") {
      setViewState("ended");
    } else {
      setViewState("waiting");
    }
  }, []);

  const handleSessionStatusChanged = useCallback((event: SessionStatusChangedEvent) => {
    const status = (event.status as string || "").toUpperCase();
    console.log("[View] SessionStatusChanged:", event.status, "->", status);

    if (status === "IN_PROGRESS") {
      setViewState("viewing");
      toast.info("Tiết học đã bắt đầu!");
    } else if (status === "PAUSED") {
      setIsTeacherPlaying(false);
      toast.info("Tiết học đã tạm dừng");
    } else if (status === "COMPLETED" || status === "CANCELLED") {
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
    setShortAnswerText("");
    setSelectedLocation(null);

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

  const handleMapLayerSync = useCallback((event: MapLayerSyncEvent) => {
    console.log("[View] Received MapLayerSync:", event);
    setSelectedLayer(event.layerKey as BaseKey);
    toast.info(`Bản đồ đã chuyển sang: ${event.layerKey}`);
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
      onMapLayerSync: handleMapLayerSync,
    },
  });

  useEffect(() => {
    if (!sessionId || !participantId) return;

    const conn = createGroupCollaborationConnection();
    if (!conn) {
      console.error(
        "[GroupCollab][View] Cannot create connection – missing or invalid auth token."
      );
      toast.error(
        "Không thể kết nối Hoạt động nhóm. Vui lòng đăng nhập lại rồi tham gia tiết học."
      );
      return;
    }
    setGroupConnection(conn);

    registerGroupCollaborationEventHandlers(conn, {
      onGroupCreated: (group: GroupDto) => {
        const anyGroup = group as any;
        const normalized: GroupDto = {
          ...anyGroup,
          id: anyGroup.id ?? anyGroup.groupId,
          groupId: anyGroup.groupId ?? anyGroup.id,
          currentMembersCount:
            anyGroup.currentMembersCount ??
            anyGroup.currentMembers ??
            anyGroup.memberCount ??
            null,
        };

        setSessionGroups((prev) => {
          if (prev.some((g) => (g as any).groupId === (normalized as any).groupId)) {
            return prev;
          }
          return [...prev, normalized];
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
    if (!participantId || !currentQuestion || hasSubmitted) {
      return;
    }

    const rawType = (currentQuestion as any).questionType as string | undefined;
    const questionType = rawType ? rawType.toUpperCase() : "";
    const hasOptions = !!(
      currentQuestion.options && currentQuestion.options.length > 0
    );

    if (hasOptions && !selectedOptionId) {
      setInfoMessage("Vui lòng chọn một đáp án trước khi gửi.");
      return;
    }

    if (!hasOptions && questionType === "SHORT_ANSWER" && !shortAnswerText.trim()) {
      setInfoMessage("Vui lòng nhập câu trả lời trước khi gửi.");
      return;
    }

    if (!hasOptions && questionType === "PIN_ON_MAP" && !selectedLocation) {
      setInfoMessage("Vui lòng chọn vị trí trên bản đồ trước khi gửi.");
      return;
    }

    try {
      setAnswering(true);
      setInfoMessage(null);

      const payload: any = {
        sessionQuestionId: currentQuestion.sessionQuestionId,
      };

      if (
        typeof currentQuestion.timeLimit === "number" &&
        currentQuestion.timeLimit > 0 &&
        typeof timeRemaining === "number"
      ) {
        const used = currentQuestion.timeLimit - timeRemaining;
        payload.responseTimeSeconds = used > 0 ? used : 0;
      }

      if (hasOptions) {
        // TRUE_FALSE hoặc MULTIPLE_CHOICE
        payload.questionOptionId = selectedOptionId;
      } else if (questionType === "SHORT_ANSWER") {
        payload.responseText = shortAnswerText.trim();
      } else if (questionType === "PIN_ON_MAP" && selectedLocation) {
        payload.responseLatitude = selectedLocation.latitude;
        payload.responseLongitude = selectedLocation.longitude;
      }

      await submitParticipantResponse(participantId, payload);

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

  const handleLeaveGroup = async () => {
    if (!groupConnection || !currentGroupId) return;
    try {
      await leaveGroupCollaborationGroup(groupConnection, currentGroupId);
      setCurrentGroupId(null);
      setGroupMessages([]);
      setGroupWorkContent("");
      setGroupChatInput("");
      toast.info("Bạn đã rời khỏi nhóm.");
    } catch (e) {
      console.error("[GroupCollab][View] Leave group failed:", e);
      toast.error("Không rời khỏi nhóm được.");
    }
  };

  const handleSubmitGroupWork = async () => {
    if (!groupConnection || !currentGroupId || !groupWorkContent.trim() || groupSubmitting) return;
    try {
      setGroupSubmitting(true);
      await submitGroupWorkViaSignalR(groupConnection, {
        sessionId,
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
      await sendMessageViaSignalR(
        groupConnection,
        currentGroupId,
        groupChatInput.trim()
      );
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

  const isPinOnMapQuestion =
    viewState === "question" &&
    !!currentQuestion &&
    String((currentQuestion as any).questionType || "").toUpperCase() === "PIN_ON_MAP" &&
    !hasSubmitted;

  if (viewState === "waiting") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50">
        <div className="text-center max-w-md px-6">
          {/* Animated hourglass */}
          <div className="text-7xl mb-6 animate-bounce">⏳</div>

          <h2 className="text-3xl font-bold mb-3 text-slate-800">
            Chờ thầy cô bắt đầu nhé! 🎉
          </h2>
          <p className="text-lg text-slate-600 mb-6">
            Bạn đã vào lớp thành công rồi!
          </p>

          {/* Session code - colorful and prominent */}
          {sessionCode && (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 p-1 mb-6 shadow-lg shadow-emerald-200">
              <div className="bg-white rounded-xl px-6 py-4">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">
                  🔑 Mã lớp học
                </p>
                <p className="text-4xl font-mono font-bold text-emerald-600 tracking-wider">
                  {sessionCode}
                </p>
              </div>
            </div>
          )}

          {/* Connection status - friendly */}
          <div className="flex items-center justify-center gap-2 text-base mb-4">
            <span
              className={`inline-flex h-3 w-3 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"
                } animate-pulse`}
            />
            <span className={isConnected ? "text-emerald-700 font-medium" : "text-amber-600"}>
              {isConnected ? "✓ Đã kết nối!" : "Đang kết nối..."}
            </span>
          </div>

          {/* Student name - welcoming */}
          <div className="inline-block rounded-full bg-gradient-to-r from-purple-100 to-pink-100 px-6 py-2">
            <p className="text-slate-700">
              Xin chào, <span className="font-bold text-purple-600">{displayName}</span> 👋
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === "ended") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-amber-100 via-rose-50 to-purple-100">
        <div className="text-center max-w-lg px-6">
          {/* Celebratory icons */}
          <div className="text-7xl mb-4 animate-bounce">🎊</div>

          <h2 className="text-3xl font-bold mb-3 text-slate-800">
            Tuyệt vời! Bạn đã hoàn thành! 🌟
          </h2>
          <p className="text-lg text-slate-600 mb-6">
            Cảm ơn bạn đã tham gia bài học hôm nay!
          </p>

          {/* Leaderboard - bright and colorful */}
          {leaderboard.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl shadow-purple-100 p-5 mb-6 border border-purple-100">
              <h3 className="text-base font-bold text-slate-700 mb-4 flex items-center justify-center gap-2">
                🏆 Bảng xếp hạng
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.participantId}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${entry.participantId === participantId
                      ? "bg-gradient-to-r from-emerald-100 to-teal-100 border-2 border-emerald-400 scale-105"
                      : "bg-slate-50 hover:bg-slate-100"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Medal badges - bigger and more colorful */}
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold shadow-md ${idx === 0
                          ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-yellow-900"
                          : idx === 1
                            ? "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800"
                            : idx === 2
                              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-orange-900"
                              : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600"
                          }`}
                      >
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : entry.rank ?? idx + 1}
                      </span>
                      <span className="font-semibold text-slate-700">{entry.displayName}</span>
                    </div>
                    <span className="font-bold text-lg text-emerald-600">
                      {entry.score} <span className="text-sm font-normal">điểm</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button - playful */}
          <button
            onClick={() => router.push("/session/join")}
            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-bold rounded-2xl shadow-lg shadow-emerald-200 transition-all hover:scale-105"
          >
            🚀 Tham gia lớp học khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-sky-50 to-emerald-50 text-slate-800">
      <div className="w-[380px] border-r border-emerald-200 bg-white/90 backdrop-blur flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
            📖 Đang học
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-800 truncate">
            {mapDetail?.name || "Bài học hôm nay"}
          </h1>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full px-4 py-2">
              <span className="text-lg">👋</span>
              <span className="font-bold text-purple-700">{displayName}</span>
            </div>

            {sessionCode && (
              <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-0.5 shadow-lg shadow-emerald-200">
                <div className="bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase">
                    🔑 Mã lớp
                  </p>
                  <p className="text-lg font-mono font-bold text-emerald-600">
                    {sessionCode}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Current segment indicator */}
          {currentSegment && currentIndex >= 0 && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              <span className="text-lg">📍</span>
              <span className="text-sm text-amber-800">
                Đang xem: <span className="font-bold">{safeCurrentIndex + 1}. {currentSegment.name || "Phần học"}</span>
              </span>
            </div>
          )}

          {/* Connection status */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span
              className={`inline-flex h-3 w-3 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"
                } animate-pulse`}
            />
            <span className={isConnected ? "text-emerald-700 font-medium" : "text-amber-600"}>
              {isConnected ? "✓ Đã kết nối với thầy cô!" : "Đang kết nối..."}
            </span>
            {isTeacherPlaying && <span className="ml-2 text-emerald-600 font-medium">▶ Đang phát</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-4">
          {(viewState === "question" || viewState === "results") && currentQuestion && (
            <section className="rounded-2xl border-2 border-purple-200 bg-white shadow-lg shadow-purple-100 px-5 py-4 space-y-4">
              {/* Question header - colorful */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-purple-700 flex items-center gap-2">
                  {viewState === "results" ? "📊 Kết quả" : "❓ Câu hỏi"}
                </p>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                    ⭐ {currentQuestion.points} điểm
                  </span>
                  {viewState === "question" && timeRemaining !== null && (
                    <span
                      className={`px-3 py-1 rounded-full font-mono text-base font-bold ${timeRemaining <= 10
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "bg-emerald-100 text-emerald-700"
                        }`}
                    >
                      ⏱ {timeRemaining}s
                    </span>
                  )}
                </div>
              </div>

              {/* Question text - prominent */}
              <div className="rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 px-4 py-3">
                <p className="text-base text-slate-800 whitespace-pre-wrap font-medium">
                  {currentQuestion.questionText}
                </p>
                {currentQuestion.questionImageUrl && (
                  <img
                    src={currentQuestion.questionImageUrl}
                    alt="Question"
                    className="mt-3 rounded-xl max-h-48 object-contain border border-sky-200"
                  />
                )}
              </div>

              {/* Answer options - big colorful buttons */}
              {viewState === "question" &&
                currentQuestion.options &&
                currentQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    {[...currentQuestion.options]
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      .map((opt, idx) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer text-base transition-all ${hasSubmitted
                            ? "opacity-60 cursor-not-allowed"
                            : selectedOptionId === opt.id
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800 scale-[1.02] shadow-md"
                              : "border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50"
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
                            className="hidden"
                          />
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${selectedOptionId === opt.id
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-600"}`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="font-medium">{opt.optionText || "(Không có nội dung)"}</span>
                        </label>
                      ))}
                  </div>
                )}

              {/* SHORT_ANSWER: ô nhập câu trả lời */}
              {viewState === "question" &&
                (!currentQuestion.options || currentQuestion.options.length === 0) &&
                (currentQuestion as any).questionType === "SHORT_ANSWER" && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                      Gõ câu trả lời của bạn bên dưới:
                    </p>
                    <input
                      type="text"
                      value={shortAnswerText}
                      onChange={(e) => setShortAnswerText(e.target.value)}
                      placeholder="Nhập câu trả lời..."
                      className="w-full rounded-xl border-2 border-sky-200 bg-white px-4 py-3 text-base text-slate-800 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                )}

              {viewState === "question" &&
                (!currentQuestion.options || currentQuestion.options.length === 0) &&
                (currentQuestion as any).questionType === "PIN_ON_MAP" && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                      Nhấp chuột lên bản đồ để chọn vị trí trả lời.{" "}
                      <span className="font-semibold text-emerald-600">
                        Bạn có thể đổi vị trí bằng cách click lại chỗ khác.
                      </span>
                    </p>

                    {selectedLocation ? (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-mono">
                        Đã chọn: lat {selectedLocation.latitude.toFixed(4)}, lng{" "}
                        {selectedLocation.longitude.toFixed(4)}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                        Chưa chọn vị trí. Hãy click lên bản đồ ở bên phải để chọn.
                      </div>
                    )}
                  </div>
                )}

              {viewState === "question" && !hasSubmitted && (
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={
                    answering ||
                    (timeRemaining !== null && timeRemaining <= 0) ||
                    (
                      currentQuestion.options &&
                      currentQuestion.options.length > 0 &&
                      !selectedOptionId
                    ) ||
                    (
                      (!currentQuestion.options || currentQuestion.options.length === 0) &&
                      (currentQuestion as any).questionType === "SHORT_ANSWER" &&
                      !shortAnswerText.trim()
                    ) ||
                    (
                      (!currentQuestion.options || currentQuestion.options.length === 0) &&
                      (currentQuestion as any).questionType === "PIN_ON_MAP" &&
                      !selectedLocation
                    )
                  }

                  className="mt-2 w-full rounded-xl px-4 py-4 text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                >
                  {answering ? "⏳ Đang gửi..." : "🚀 Gửi đáp án!"}
                </button>
              )}

              {/* Submitted confirmation */}
              {viewState === "question" && hasSubmitted && (
                <div className="rounded-xl bg-emerald-50 border-2 border-emerald-300 px-4 py-3 text-center">
                  <p className="text-base font-bold text-emerald-700">
                    ✅ Tuyệt vời! Đã gửi đáp án!
                  </p>
                  <p className="text-sm text-emerald-600 mt-1">Chờ thầy cô hiển thị kết quả nhé...</p>
                </div>
              )}

              {viewState === "results" && questionResults && (
                <div className="space-y-3">
                  {questionResults.correctAnswer && (
                    <div className="rounded-xl bg-emerald-50 border-2 border-emerald-300 px-4 py-3">
                      <p className="text-sm font-bold text-emerald-700 mb-1">
                        ✅ Đáp án đúng
                      </p>
                      <p className="text-base font-medium text-emerald-800">
                        {questionResults.correctAnswer}
                      </p>
                    </div>
                  )}

                  {questionResults.results && questionResults.results.length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                      <p className="text-sm font-bold text-slate-700 mb-3">
                        📋 Kết quả các bạn
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {questionResults.results.map((result) => (
                          <div
                            key={result.participantId}
                            className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${result.participantId === participantId
                              ? "bg-purple-100 border border-purple-300 font-bold"
                              : "bg-white"
                              }`}
                          >
                            <span className="text-slate-700">
                              {result.displayName}
                              {result.participantId === participantId && " 👈 (Bạn)"}
                            </span>
                            <span
                              className={`font-bold ${result.isCorrect ? "text-emerald-600" : "text-red-500"
                                }`}
                            >
                              {result.isCorrect ? `✓ +${result.pointsEarned}` : "✗ Sai"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleContinueViewing}
                    className="mt-2 w-full rounded-xl px-4 py-3 text-base font-bold bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-blue-600 transition-all hover:scale-[1.02]"
                  >
                    ▶ Tiếp tục xem bản đồ
                  </button>
                </div>
              )}

              {infoMessage && (
                <p className="text-[11px] text-zinc-400 mt-1">{infoMessage}</p>
              )}
            </section>
          )}

          {viewState === "viewing" && !currentQuestion && (
            <section className="rounded-2xl border-2 border-sky-200 bg-white shadow-lg shadow-sky-100 px-5 py-4">
              <p className="text-sm font-bold text-sky-700 flex items-center gap-2 mb-2">
                📺 Thông tin
              </p>
              <p className="text-base text-slate-600">
                Thầy cô đang điều khiển bản đồ. Hãy theo dõi màn hình chính nhé! 👀
              </p>
              {currentSegment && currentIndex >= 0 && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 uppercase">📍 Phần đang học:</p>
                  <p className="text-base font-bold text-amber-900 mt-1">
                    {safeCurrentIndex + 1}. {currentSegment.name || "Không có tên"}
                  </p>
                  {currentSegment.description && (
                    <p className="text-sm text-amber-700 mt-2">
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

      <div className="flex-1 min-h-0 relative">
        {segments.length > 0 && (
          <StoryMapViewer
            key={`storymap-${selectedLayer}`}
            mapId={mapId}
            segments={segments}
            baseMapProvider={selectedLayer || mapDetail?.baseMapProvider}
            initialCenter={center}
            initialZoom={mapDetail?.defaultZoom || 10}
            controlledIndex={
              hasReceivedSegmentSync && currentIndex >= 0 ? safeCurrentIndex : undefined
            }
            controlledPlaying={hasReceivedSegmentSync ? isTeacherPlaying : false}
            controlsEnabled={isPinOnMapQuestion}
            pinAnswerMode={isPinOnMapQuestion}
            pinAnswerLocation={selectedLocation}
            onPinAnswerLocation={(lat: number, lng: number) => {
              setSelectedLocation({ latitude: lat, longitude: lng });
            }}
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

      <div className="w-[340px] border-l border-purple-200 bg-white/95 backdrop-blur flex flex-col shadow-xl">
        <div className="px-4 pt-5 pb-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-700 flex items-center gap-2">
              👥 Hoạt động nhóm
            </p>

            {currentGroupId ? (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                ✓ Đã vào nhóm
              </span>
            ) : (
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                Chưa vào nhóm
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-4">
          {/* DANH SÁCH NHÓM */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-purple-700 flex items-center gap-2">
              📌 Chọn nhóm
            </p>

            {sessionGroups.length === 0 && (
              <p className="text-[12px] text-zinc-500">
                Giáo viên chưa tạo nhóm hoặc chưa cập nhật.
              </p>
            )}

            {sessionGroups.map((g, idx) => {
              const anyGroup = g as any;
              const groupId = anyGroup.groupId ?? g.id;
              const currentCount =
                anyGroup.currentMembersCount ?? anyGroup.currentMembers ?? null;
              const maxMembers = anyGroup.maxMembers ?? null;

              return (
                <button
                  key={groupId ?? g.id ?? idx}
                  type="button"
                  onClick={() => handleJoinGroup(groupId)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-[12px] border ${currentGroupId === groupId
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                    }`}
                >
                  <span className="truncate">
                    {g.name || `Nhóm ${idx + 1}`}
                  </span>

                  {typeof currentCount === "number" &&
                    typeof maxMembers === "number" && (
                      <span className="text-[11px] text-zinc-400">
                        {currentCount}/{maxMembers}
                      </span>
                    )}
                </button>
              );
            })}
          </div>


          {/* CHỈ HIỆN BÀI LÀM + CHAT KHI ĐÃ VÀO NHÓM */}
          {currentGroupId && (
            <>
              {/* Group work section - bright styling */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-purple-700 flex items-center gap-2">
                  ✏️ Bài làm nhóm
                </p>
                <textarea
                  value={groupWorkContent}
                  onChange={(e) => setGroupWorkContent(e.target.value)}
                  placeholder="Viết nội dung bài làm nhóm tại đây..."
                  className="w-full rounded-xl border-2 border-purple-200 bg-white px-4 py-3 text-base text-slate-700 placeholder:text-slate-400 resize-none h-28 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
                <button
                  type="button"
                  onClick={handleSubmitGroupWork}
                  disabled={
                    !currentGroupId ||
                    groupSubmitting ||
                    !groupWorkContent.trim()
                  }
                  className="w-full rounded-xl px-4 py-3 text-base font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-200 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {groupSubmitting ? "⏳ Đang gửi..." : "📤 Gửi bài nhóm"}
                </button>
              </div>

              {/* Group chat section - bright styling */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-purple-700 flex items-center gap-2">
                  💬 Chat nhóm
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl border-2 border-sky-200 bg-sky-50 px-4 py-3">
                  {groupMessages.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Tin nhắn nhóm sẽ hiển thị tại đây 📝
                    </p>
                  )}
                  {groupMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className="text-sm bg-white rounded-lg px-3 py-2 shadow-sm"
                    >
                      <span className="font-bold text-purple-600">
                        {m.userName}:
                      </span>{" "}
                      <span className="text-slate-700">{m.message}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={groupChatInput}
                    onChange={(e) => setGroupChatInput(e.target.value)}
                    placeholder="Nhắn tin cho nhóm..."
                    className="flex-1 rounded-xl border-2 border-purple-200 bg-white px-4 py-2 text-base text-slate-700 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendGroupMessage}
                    disabled={!currentGroupId || !groupChatInput.trim()}
                    className="px-4 py-2 rounded-xl text-base font-bold bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📩 Gửi
                  </button>
                </div>
              </div>
            </>
          )}
          {currentGroupId && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-[12px] font-semibold border border-rose-500/60 bg-rose-500/5 text-rose-600 hover:bg-rose-500/15 transition"
              >
                🚪 Rời nhóm hiện tại
              </button>
            </div>
          )}

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
