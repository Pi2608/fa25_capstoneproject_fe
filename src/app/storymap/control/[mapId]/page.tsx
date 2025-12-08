"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  getSessionLeaderboard,
  getSessionQuestions,
  activateNextQuestion,
  skipCurrentQuestion,
  extendQuestionTime,
  getSession,
  type SessionDto,
  type SessionRunningQuestionDto,
  type LeaderboardEntryDto,
  type QuestionDto,
} from "@/lib/api-ques";

import {
  showQuestionResultsViaSignalR,
  type QuestionResultsEvent,
} from "@/lib/hubs/session";
import {
  getGroupsBySession,
  getGroupById,
  deleteGroup,
} from "@/lib/api-groupCollaboration";
import type { HubConnection } from "@microsoft/signalr";
import {
  createGroupCollaborationConnection,
  startGroupCollaborationConnection,
  stopGroupCollaborationConnection,
  joinGroupCollaborationSession,
  registerGroupCollaborationEventHandlers,
  unregisterGroupCollaborationEventHandlers,
  createGroupViaSignalR,
  gradeSubmissionViaSignalR,
  sendMessageViaSignalR,
  type GroupDto,
  type GroupSubmissionDto,
  type GroupGradedSubmissionDto,
} from "@/lib/hubs/groupCollaboration";

import StoryMapViewer from "@/components/storymap/StoryMapViewer";
import { useLoading } from "@/contexts/LoadingContext";
import { useSessionHub } from "@/hooks/useSessionHub";
import {
  sendSegmentSyncViaSignalR,
  broadcastQuestionViaSignalR,
  type SegmentSyncRequest,
} from "@/lib/hubs/session";

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

type SessionQuestionBankInfo = {
  questionBankId: string;
  bankName?: string;
  totalQuestions: number;
};

// Kiểu dữ liệu cho member của group (theo response API /groups/{groupId})
type GroupMember = {
  groupMemberId: string;
  sessionParticipantId: string;
  participantName: string;
  isLeader: boolean;
  joinedAt: string;
};

export default function StoryMapControlPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapId = params?.mapId ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTeacherPlaying, setIsTeacherPlaying] = useState(false);

  const [session, setSession] = useState<SessionDto | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [participants, setParticipants] = useState<LeaderboardEntryDto[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [questionControlLoading, setQuestionControlLoading] = useState(false);

  const [questionBankMeta, setQuestionBankMeta] =
    useState<QuestionBankMeta | null>(null);
  const [groupCollabConnection, setGroupCollabConnection] =
    useState<HubConnection | null>(null);

  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [groupSubmissions, setGroupSubmissions] = useState<GroupSubmissionDto[]>(
    []
  );

  const [sessionQuestionBanks, setSessionQuestionBanks] = useState<
    SessionQuestionBankInfo[]
  >([]);

  // ========== NEW: state hiển thị chi tiết nhóm ==========
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMember[]>(
    []
  );
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);

  const totalQuestionsOfAllBanks = sessionQuestionBanks.reduce(
    (sum, bank) => sum + (bank.totalQuestions ?? 0),
    0
  );

  const [showShareModal, setShowShareModal] = useState(false);
  const shareOverlayGuardRef = useRef(false);

  // FIXED: Track last sent segment sync to avoid duplicates
  const lastSentSyncRef = useRef<{ index: number; isPlaying: boolean } | null>(
    null
  );
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!showShareModal || typeof document === "undefined") return;

    shareOverlayGuardRef.current = true;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        shareOverlayGuardRef.current = false;
      });
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowShareModal(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      shareOverlayGuardRef.current = false;
    };
  }, [showShareModal]);

  const copyToClipboard = (text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Copy to clipboard failed:", err);
    });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinLinkWithCode = `${origin}/session/join`;
  const joinLinkWithQR = session
    ? `${origin}/session/join?code=${session.sessionCode}`
    : joinLinkWithCode;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    joinLinkWithQR
  )}`;
  const { showLoading, hideLoading } = useLoading();
  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState<number | null>(null);
  const [currentQuestionResults, setCurrentQuestionResults] =
    useState<QuestionResultsEvent | null>(null);

  const [showStudentAnswers, setShowStudentAnswers] = useState(false);

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // ================== SignalR connection for session ==================
  const { connection, isConnected: signalRConnected } = useSessionHub({
    sessionId: session?.sessionId || "",
    enabled: !!session?.sessionId,
    handlers: {
      onParticipantJoined: () => {
        handleLoadParticipants();
      },
      onParticipantLeft: () => {
        handleLoadParticipants();
      },
      onQuestionResults: (event) => {
        setCurrentQuestionResults(event);
        setShowStudentAnswers(true);
      },
    },
  });

  // ================== SignalR connection for group collaboration ==================
  useEffect(() => {
    if (!session?.sessionId) return;

    const conn = createGroupCollaborationConnection();
    if (!conn) {
      console.error("[GroupCollab] Cannot create connection");
      return;
    }

    registerGroupCollaborationEventHandlers(conn, {
      onGroupCreated: (group) => {
        setGroups((prev) => [...prev, group]);
      },
      onWorkSubmitted: (submission) => {
        setGroupSubmissions((prev) => [...prev, submission]);
      },
      onSubmissionGraded: (graded) => {
        console.log("[GroupCollab] Submission graded", graded);
      },
      onError: (error) => {
        console.error("[GroupCollab] Error", error);
      },
    });

    (async () => {
      const ok = await startGroupCollaborationConnection(conn);
      if (ok && session?.sessionId) {
        await joinGroupCollaborationSession(conn, session.sessionId);
        setGroupCollabConnection(conn);
      }
    })();

    return () => {
      unregisterGroupCollaborationEventHandlers(conn);
      stopGroupCollaborationConnection(conn);
      setGroupCollabConnection(null);
    };
  }, [session?.sessionId]);

  // ================== Broadcast channel (for same-browser testing) ==================
  useEffect(() => {
    if (typeof window === "undefined" || !mapId) return;

    broadcastRef.current = new BroadcastChannel(`storymap-${mapId}`);

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

        const isPublished =
          typeof detail.status === "string" &&
          detail.status.toLowerCase() === "published";

        if (!isPublished) {
          setError("This map is not published yet");
          return;
        }

        setMapDetail(detail);
        setSegments(Array.isArray(segs) ? segs : []);
      } catch (e: any) {
        console.error("Load control page failed:", e);
        setError(e?.message || "Failed to load storymap");
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  useEffect(() => {
    if (!searchParams) return;

    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      setSession(null);
      setQuestionBankMeta(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const detail = await getSession(sessionId);
        if (cancelled) return;

        setSession({
          ...detail,
          mapId: detail.mapId ?? mapId,
        });

        const banks = Array.isArray((detail as any).questionBanks)
          ? (detail as any).questionBanks
          : [];

        if (banks.length > 0) {
          const first = banks[0];

          setQuestionBankMeta({
            id: first.questionBankId,
            bankName: first.questionBankName ?? undefined,
            description: first.description ?? undefined,
            category: first.category ?? undefined,
            tags: [],
            totalQuestions: first.totalQuestions ?? null,
            workspaceName: undefined,
            mapName: detail.mapName ?? undefined,
            createdAt: first.attachedAt ?? undefined,
            updatedAt: first.attachedAt ?? undefined,
          });
        } else {
          setQuestionBankMeta(null);
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("Load session by sessionId failed:", e);
        setSession(null);
        setQuestionBankMeta(null);
        setError(e?.message || "Không tải được thông tin session");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, mapId]);

  // ================== Load question banks + questions of session ==================
  useEffect(() => {
    if (!session?.sessionId) {
      setSessionQuestionBanks([]);
      setQuestions([]);
      setCurrentQuestionIndex(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingQuestions(true);

        const allQuestions = await getSessionQuestions(session.sessionId);
        if (cancelled) return;

        const list = Array.isArray(allQuestions) ? allQuestions : [];

        const grouped = new Map<string, SessionQuestionBankInfo>();

        for (const q of list) {
          if (!q.questionBankId) continue;

          const existing = grouped.get(q.questionBankId);
          if (existing) {
            existing.totalQuestions += 1;
          } else {
            grouped.set(q.questionBankId, {
              questionBankId: q.questionBankId,
              totalQuestions: 1,
            });
          }
        }
        const bankNameMap = new Map<string, string>();

        if (Array.isArray((session as any)?.questionBanks)) {
          (session as any).questionBanks.forEach((b: any) => {
            if (b?.questionBankId) {
              bankNameMap.set(
                b.questionBankId,
                b.questionBankName || `Bank (${b.questionBankId.slice(0, 6)}…)`
              );
            }
          });
        }

        const result: SessionQuestionBankInfo[] = Array.from(
          grouped.values()
        ).map((info) => ({
          ...info,
          bankName:
            bankNameMap.get(info.questionBankId) ||
            `Bank (${info.questionBankId.slice(0, 6)}…)`,
        }));

        setSessionQuestionBanks(result);

        // Sắp xếp toàn bộ câu hỏi để hiển thị bên dưới
        const ordered = [...list].sort((a, b) => {
          if (a.questionBankId === b.questionBankId) {
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          }
          return (a.questionBankId ?? "").localeCompare(
            b.questionBankId ?? ""
          );
        });

        setCurrentQuestionIndex(null);
        setQuestions(ordered);
      } catch (e) {
        console.error("Load question banks of session failed:", e);
        if (!cancelled) {
          setSessionQuestionBanks([]);
          setQuestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.sessionId, session?.questionBanks]);

  // ================== Load participants when session changes ==================
  useEffect(() => {
    if (!session?.sessionId) {
      setParticipants([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingParticipants(true);
        const data = await getSessionLeaderboard(session.sessionId, 1000);
        if (!cancelled) {
          setParticipants(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Load participants failed:", e);
          setParticipants([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingParticipants(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.sessionId]);

  // ================== Load groups khi vào trang control ==================
  useEffect(() => {
    if (!session?.sessionId) {
      setGroups([]);
      setSelectedGroupId(null);
      setSelectedGroupMembers([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await getGroupsBySession(session.sessionId);

        if (!cancelled) {
          setGroups(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("[GroupCollab] Load groups failed:", e);
        if (!cancelled) setGroups([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.sessionId]);

  // ==================chi tiết nhóm  ==================
  const handleSelectGroup = async (groupId: string | undefined) => {
    if (!groupId) return;

    setSelectedGroupId(groupId);
    setLoadingGroupMembers(true);
    setSelectedGroupMembers([]);

    try {
      const detail: any = await getGroupById(groupId);
      const members: GroupMember[] = Array.isArray(detail?.members)
        ? detail.members
        : [];
      setSelectedGroupMembers(members);
    } catch (e) {
      console.error("[GroupCollab] Load group detail failed:", e);
      setSelectedGroupMembers([]);
    } finally {
      setLoadingGroupMembers(false);
    }
  };

  const handleDeleteGroup = async (groupId: string | undefined) => {
    if (!groupId) return;

    const confirmDelete = window.confirm(
      "Bạn có chắc chắn muốn xóa nhóm này không?"
    );
    if (!confirmDelete) return;

    try {
      await deleteGroup(groupId);

      setGroups((prev) => prev.filter((g) => g.groupId !== groupId));

      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
        setSelectedGroupMembers([]);
      }
    } catch (error) {
      console.error("[GroupCollab] Delete group failed:", error);
    }
  };

  // ================== FIXED: Debounced Segment Sync Function ==================
  const sendSegmentSync = useCallback(
    async (
      segmentIndex: number,
      segmentId: string,
      segmentName: string,
      isPlaying: boolean
    ) => {
      if (!connection || !session?.sessionId) return;

      const last = lastSentSyncRef.current;
      if (last && last.index === segmentIndex && last.isPlaying === isPlaying) {
        console.log("[Control] Skipping duplicate SegmentSync:", {
          segmentIndex,
          isPlaying,
        });
        return;
      }

      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }

      syncDebounceRef.current = setTimeout(async () => {
        try {
          const segmentData: SegmentSyncRequest = {
            segmentIndex,
            segmentId,
            segmentName,
            isPlaying,
          };

          console.log("[Control] Sending SegmentSync:", segmentData);
          await sendSegmentSyncViaSignalR(
            connection,
            session.sessionId,
            segmentData
          );

          lastSentSyncRef.current = { index: segmentIndex, isPlaying };
        } catch (error) {
          console.error("[Control] Failed to send SegmentSync:", error);
        }
      }, 100);
    },
    [connection, session?.sessionId]
  );

  // ================== Segment broadcast ==================
  const handleSegmentChange = async (segment: Segment, index: number) => {
    setCurrentIndex(index);
    setIsTeacherPlaying(false);

    broadcastRef.current?.postMessage({
      type: "segment-change",
      segmentIndex: index,
      segment,
      timestamp: Date.now(),
    });

    if (connection && session?.sessionId) {
      sendSegmentSync(
        index,
        segment.segmentId,
        segment.name || `Segment ${index + 1}`,
        false
      );
    }
  };

  // ================== Play/Pause state broadcast ==================
  const handlePlayingChange = useCallback(
    async (isPlaying: boolean) => {
      console.log("[Control] handlePlayingChange called:", isPlaying);

      setIsTeacherPlaying(isPlaying);

      if (connection && session?.sessionId && segments.length > 0) {
        const segmentIndex = currentIndex >= 0 ? currentIndex : 0;
        const currentSeg = segments[segmentIndex] || segments[0];

        sendSegmentSync(
          segmentIndex,
          currentSeg.segmentId,
          currentSeg.name || `Segment ${segmentIndex + 1}`,
          isPlaying
        );
      }
    },
    [connection, session?.sessionId, segments, currentIndex, sendSegmentSync]
  );

  const goToSegment = (index: number) => {
    if (index < 0 || index >= segments.length) return;
    const seg = segments[index];
    if (!seg) return;
    handleSegmentChange(seg, index);
  };

  // ================== Session status handlers ==================
  const handleChangeStatus = async (
    action: "start" | "pause" | "resume" | "end"
  ) => {
    if (!session || changingStatus) return;

    try {
      setChangingStatus(true);
      if (action === "start") await startSession(session.sessionId);
      if (action === "pause") await pauseSession(session.sessionId);
      if (action === "resume") await resumeSession(session.sessionId);
      if (action === "end") await endSession(session.sessionId);

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

      if (action === "start" && connection && segments.length > 0) {
        const segmentIndex = currentIndex >= 0 ? currentIndex : 0;
        const currentSeg = segments[segmentIndex] || segments[0];
        sendSegmentSync(
          segmentIndex,
          currentSeg.segmentId,
          currentSeg.name || `Segment ${segmentIndex + 1}`,
          false
        );
      }

      if (action === "pause" && connection && segments.length > 0) {
        const segmentIndex = currentIndex >= 0 ? currentIndex : 0;
        const currentSeg = segments[segmentIndex] || segments[0];
        sendSegmentSync(
          segmentIndex,
          currentSeg.segmentId,
          currentSeg.name || `Segment ${segmentIndex + 1}`,
          false
        );
      }
    } catch (e: any) {
      console.error("Change session status failed:", e);
      setError(e?.message || "Không thay đổi được trạng thái session");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleLoadLeaderboard = async () => {
    if (!session || loadingLeaderboard) return;
    try {
      setLoadingLeaderboard(true);

      const data = await getSessionLeaderboard(session.sessionId, 10);

      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Load leaderboard failed:", e);
      setLeaderboard([]);
      setError(e?.message || "Không tải được bảng xếp hạng");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleLoadParticipants = async () => {
    if (!session || loadingParticipants) return;
    try {
      setLoadingParticipants(true);

      const data = await getSessionLeaderboard(session.sessionId, 1000);

      setParticipants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Load participants failed:", e);
      setParticipants([]);
      setError(e?.message || "Không tải được danh sách người tham gia");
    } finally {
      setLoadingParticipants(false);
    }
  };

  // ================== Question control handlers ==================
  const handleBroadcastQuestion = async (
    question: QuestionDto,
    index: number
  ) => {
    if (!session || questionControlLoading || !connection) return;

    try {
      setQuestionControlLoading(true);
      setCurrentQuestionIndex(index);
      setCurrentQuestionResults(null);
      setShowStudentAnswers(false);

      await broadcastQuestionViaSignalR(connection, session.sessionId, {
        sessionQuestionId: question.sessionQuestionId ?? question.questionId,
        questionId: question.questionId,
        questionText: question.questionText,
        questionType: question.questionType,
        questionImageUrl: question.questionImageUrl ?? undefined,
        options: question.options?.map((opt) => ({
          id: opt.questionOptionId,
          optionText: opt.optionText,
          optionImageUrl: opt.optionImageUrl ?? undefined,
          displayOrder: opt.displayOrder,
        })),
        points: question.points,
        timeLimit: question.timeLimit ?? 30,
      });
    } catch (e: any) {
      console.error("Broadcast question failed:", e);
      setError(e?.message || "Không phát được câu hỏi");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleShowQuestionResults = async (question: QuestionDto) => {
    if (!session || questionControlLoading || !connection) return;

    try {
      setQuestionControlLoading(true);

      const correctOption = question.options?.find((opt) => opt.isCorrect);
      const correctAnswerText = correctOption?.optionText ?? undefined;

      await showQuestionResultsViaSignalR(
        connection,
        session.sessionId,
        question.questionId,
        [],
        correctAnswerText
      );
    } catch (e: any) {
      console.error("Show question results failed:", e);
      setError(e?.message || "Không hiển thị được đáp án");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!session || questionControlLoading) return;

    try {
      setQuestionControlLoading(true);
      await activateNextQuestion(session.sessionId);

      setCurrentQuestionResults(null);
      setShowStudentAnswers(false);

      setCurrentQuestionIndex((prev) => {
        if (!questions.length) return prev;
        if (prev == null) return 0;
        const next = Math.min(prev + 1, questions.length - 1);
        return next;
      });
    } catch (e: any) {
      console.error("Next question failed:", e);
      setError(e?.message || "Không chuyển được sang câu tiếp theo");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!session || questionControlLoading) return;

    try {
      setQuestionControlLoading(true);
      await skipCurrentQuestion(session.sessionId);

      setCurrentQuestionResults(null);
      setShowStudentAnswers(false);

      setCurrentQuestionIndex((prev) => {
        if (!questions.length) return prev;
        if (prev == null) return 0;
        const next = Math.min(prev + 1, questions.length - 1);
        return next;
      });
    } catch (e: any) {
      console.error("Skip question failed:", e);
      setError(e?.message || "Không bỏ qua được câu hỏi");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleExtendQuestion = async () => {
    if (!session || questionControlLoading) return;

    const sessionQuestionId = window.prompt(
      "Nhập sessionQuestionId của câu hỏi đang chạy:"
    );
    if (!sessionQuestionId) return;

    const secondsStr = window.prompt("Gia hạn thêm bao nhiêu giây?", "10");
    const seconds = secondsStr ? parseInt(secondsStr, 10) : NaN;
    if (!seconds || Number.isNaN(seconds) || seconds <= 0) return;

    try {
      setQuestionControlLoading(true);
      await extendQuestionTime(sessionQuestionId, seconds);
    } catch (e: any) {
      console.error("Extend question failed:", e);
      setError(e?.message || "Không gia hạn được thời gian cho câu hỏi");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleCreateGroup = async (name: string, maxMembers?: number) => {
    if (!groupCollabConnection || !session?.sessionId) return;

    const source = participants ?? [];

    const allIds = source
      .map((p: any) => p.participantId ?? p.sessionParticipantId ?? p.id)
      .filter((id: unknown): id is string => Boolean(id));

    if (allIds.length === 0) {
      console.error(
        "[GroupCollab] Không tìm được participantId nào từ Danh sách người tham gia để tạo nhóm"
      );
      return;
    }

    const memberParticipantIds =
      typeof maxMembers === "number" && maxMembers > 0
        ? allIds.slice(0, maxMembers)
        : allIds;

    try {
      await createGroupViaSignalR(groupCollabConnection, {
        sessionId: session.sessionId,
        groupName: name,
        color: undefined,
        memberParticipantIds,
        leaderParticipantId: memberParticipantIds[0],
      });
    } catch (error) {
      console.error("[GroupCollab] Tạo nhóm thất bại", error);
    }
  };

  const handleGradeSubmission = async (
    submissionId: string,
    score: number,
    feedback?: string
  ) => {
    if (!groupCollabConnection) return;

    await gradeSubmissionViaSignalR(groupCollabConnection, {
      submissionId,
      score,
      feedback,
    });
  };

  const handleSendMessageToGroup = async (groupId: string, message: string) => {
    if (!groupCollabConnection) return;
    await sendMessageViaSignalR(groupCollabConnection, groupId, message);
  };

  // ================== Render states ==================
  useEffect(() => {
    if (loading) {
      useLoading;
      showLoading("Loading Control Panel...");
    } else {
      hideLoading();
    }
    return () => {
      hideLoading();
    };
  }, [loading, showLoading, hideLoading]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
        <div className="text-center max-w-md px-4">
          <div className="text-red-600 dark:text-red-400 text-2xl mb-4">
            ⚠️ {error}
          </div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-muted hover:bg-muted/80 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapDetail?.center
    ? [mapDetail.center.latitude, mapDetail.center.longitude]
    : [10.8231, 106.6297];

  // ================== Main layout ==================
  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      {/* MAIN: left panel + map */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[360px] border-r border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col">
          {/* HEADER */}
          <div className="px-5 pt-5 pb-4 border-b border-border bg-background/80">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
              Control Panel
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

          {/* BODY: SESSION + LEADERBOARD */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-4">
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

                {session && (
                  <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700">
                    ID: {session.sessionId.slice(0, 6)}…
                  </span>
                )}
              </div>

              {/* MÃ CODE */}
              {session ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-zinc-400">
                        Code cho học sinh
                      </p>
                      <p className="font-mono text-xl font-semibold tracking-[0.18em] text-emerald-400">
                        {session.sessionCode}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowShareModal(true);
                        }}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] text-zinc-100 hover:bg-blue-700 border border-blue-500"
                        title="Chia sẻ link hoặc QR code"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                        Share
                      </button>
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
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  Chưa có session cho bản đồ này. Hãy quay lại workspace và tạo
                  session từ đó.
                </div>
              )}

              {/* TRẠNG THÁI + NÚT ĐIỀU KHIỂN SESSION */}
              {session && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Trạng thái:{" "}
                      <span className="font-semibold text-zinc-100">
                        {session.status}
                      </span>
                    </span>

                    {sessionQuestionBanks.length > 0 && (
                      <span className="text-right">
                        Bộ câu hỏi:&nbsp;
                        <span className="font-semibold text-emerald-300">
                          {sessionQuestionBanks.length} bộ
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

                  <div className="flex items-center justify-between pt-2">
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

                  {session && (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1">
                      {loadingLeaderboard && (
                        <p className="text-[11px] text-zinc-500">
                          Đang tải bảng xếp hạng...
                        </p>
                      )}

                      {!loadingLeaderboard && leaderboard.length === 0 && (
                        <p className="text-[11px] text-zinc-500">
                          Chưa có dữ liệu bảng xếp hạng.
                        </p>
                      )}

                      {!loadingLeaderboard &&
                        leaderboard.length > 0 &&
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

                  {/* DANH SÁCH NGƯỜI THAM GIA */}
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                        Danh sách người tham gia
                      </p>
                      <button
                        type="button"
                        onClick={handleLoadParticipants}
                        disabled={loadingParticipants}
                        className="text-[10px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {loadingParticipants ? "Đang tải..." : "Làm mới"}
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
                      {loadingParticipants && (
                        <p className="text-[11px] text-zinc-500">
                          Đang tải danh sách...
                        </p>
                      )}

                      {!loadingParticipants && participants.length === 0 && (
                        <p className="text-[11px] text-zinc-500">
                          Chưa có người tham gia nào.
                        </p>
                      )}

                      {!loadingParticipants &&
                        participants.length > 0 &&
                        participants.map((p, idx) => (
                          <div
                            key={p.participantId ?? idx}
                            className="flex items-center justify-between text-[11px] text-zinc-200 py-1 border-b border-zinc-800/50 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                                {p.rank ?? idx + 1}
                              </span>
                              <span className="text-zinc-100">
                                {p.displayName}
                              </span>
                            </div>
                            {typeof p.score === "number" && (
                              <span className="font-semibold text-emerald-400">
                                {p.score} điểm
                              </span>
                            )}
                          </div>
                        ))}
                    </div>

                    {participants.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-zinc-500 text-right">
                        Tổng: {participants.length} người tham gia
                      </p>
                    )}
                  </div>

                  {/* HOẠT ĐỘNG NHÓM (Group Collaboration) */}
                  {session && (
                    <section className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                          Hoạt động nhóm
                        </p>
                        <button
                          type="button"
                          disabled={!groupCollabConnection}
                          onClick={() =>
                            handleCreateGroup(`Nhóm ${groups.length + 1}`, 4)
                          }
                          className="text-[11px] rounded-lg px-2.5 py-1 
             bg-emerald-600 text-zinc-100 hover:bg-emerald-500
             disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
                        >
                          {groupCollabConnection ? "+ Tạo nhóm" : "Đang kết nối..."}
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
                        {groups.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">
                            Chưa có nhóm nào. Bấm &quot;Tạo nhóm&quot; để bắt đầu.
                          </p>
                        ) : (
                          groups.map((g, idx) => {
                            const isSelected = g.groupId === selectedGroupId;
                            return (
                              <div
                                key={g.groupId ?? idx}
                                onClick={() => handleSelectGroup(g.groupId)}
                                className={
                                  "w-full flex items-center justify-between text-[11px] py-1 px-2 rounded-md border mb-[2px] last:mb-0 cursor-pointer " +
                                  (isSelected
                                    ? "bg-emerald-500/15 border-emerald-400/70 text-emerald-100"
                                    : "bg-transparent border-zinc-800 text-zinc-200 hover:bg-zinc-900/70")
                                }
                              >
                                <div>
                                  <p className="font-semibold">
                                    {g.name || `Nhóm ${idx + 1}`}
                                  </p>
                                  {typeof g.currentMembersCount === "number" &&
                                    typeof g.maxMembers === "number" && (
                                      <p className="text-zinc-400">
                                        {g.currentMembersCount}/{g.maxMembers} thành viên
                                      </p>
                                    )}
                                </div>

                                {/* Nút Xóa nhóm */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGroup(g.groupId);
                                  }}
                                  className="ml-2 inline-flex items-center justify-center rounded-full 
                     border border-rose-500/70 bg-rose-600/10 text-rose-200 
                     hover:bg-rose-600/20 px-2 py-[2px] text-[10px]"
                                >
                                  Xóa
                                </button>
                              </div>
                            );
                          })
                        )}

                      </div>

                      {/* Chi tiết thành viên của nhóm được chọn */}
                      {selectedGroupId && (
                        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                              Thành viên trong nhóm
                            </p>
                            {loadingGroupMembers ? (
                              <span className="text-[10px] text-zinc-400">
                                Đang tải...
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">
                                {selectedGroupMembers.length} thành viên
                              </span>
                            )}
                          </div>

                          {loadingGroupMembers ? (
                            <p className="text-[11px] text-zinc-500">
                              Đang tải danh sách thành viên...
                            </p>
                          ) : selectedGroupMembers.length === 0 ? (
                            <p className="text-[11px] text-zinc-500">
                              Chưa có thành viên nào trong nhóm này.
                            </p>
                          ) : (
                            <div className="max-h-32 overflow-y-auto space-y-1.5">
                              {selectedGroupMembers.map((m, index) => (
                                <div
                                  key={m.groupMemberId ?? index}
                                  className="flex items-center justify-between text-[11px] text-zinc-200 border-b border-zinc-800/60 pb-1 last:border-0"
                                >
                                  <div>
                                    <p className="font-medium">
                                      {m.participantName || `Thành viên ${index + 1}`}
                                    </p>
                                    <p className="text-zinc-500">
                                      Tham gia lúc: {m.joinedAt}
                                    </p>
                                  </div>
                                  {m.isLeader && (
                                    <span className="ml-2 rounded-full bg-emerald-500/15 border border-emerald-400/60 px-2 py-[1px] text-[10px] text-emerald-200">
                                      Nhóm trưởng
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </section>
          </div>
        </div>

        {/* MIDDLE + RIGHT: Map + Question panel */}
        <div className="flex-1 min-h-0 flex">
          {/* MIDDLE: Map Viewer */}
          <div className="flex-1 min-h-0">
            <StoryMapViewer
              mapId={mapId}
              segments={segments}
              baseMapProvider={mapDetail?.baseMapProvider}
              initialCenter={center}
              initialZoom={mapDetail?.defaultZoom || 10}
              onSegmentChange={handleSegmentChange}
              onPlayingChange={handlePlayingChange}
            />
          </div>

          {/* RIGHT: Question control + question bank */}
          <div className="w-[360px] border-l border-zinc-800 bg-zinc-950/95 flex flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-3">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 space-y-3">
                {/* HEADER QUESTION PANEL */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
                      Bộ câu hỏi của session này
                    </p>

                    {sessionQuestionBanks.length > 0 ? (
                      <>
                        <p className="text-xs text-zinc-400">
                          Đã gắn {sessionQuestionBanks.length} bộ câu hỏi vào
                          session này:
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {sessionQuestionBanks.map((bank, index) => (
                            <span
                              key={`${bank.questionBankId}-${index}`}
                              className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/5 px-2 py-[2px] text-[11px] text-emerald-200"
                            >
                              {bank.bankName}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        Chưa gắn bộ câu hỏi cho session này.
                      </p>
                    )}
                  </div>

                  {totalQuestionsOfAllBanks > 0 && (
                    <div className="text-right text-[11px] text-zinc-300">
                      <div className="font-semibold">
                        {totalQuestionsOfAllBanks}
                      </div>
                      <div className="text-zinc-500">câu hỏi</div>
                    </div>
                  )}
                </div>

                {/* NÚT ĐIỀU KHIỂN CÂU HỎI */}
                {session && (
                  <div className="border-t border-zinc-800 pt-2">
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
                          session.status !== "Running"
                        }
                        className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-emerald-500/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        + thời gian
                      </button>
                    </div>
                  </div>
                )}

                {/* META BỘ CÂU HỎI + DANH SÁCH CÂU HỎI */}
                {!questionBankMeta ? (
                  <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-[11px] text-zinc-400">
                    Session hiện tại chưa gắn bộ câu hỏi hoặc thông tin chưa
                    được truyền sang.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Danh sách câu hỏi
                      </p>
                    </div>

                    {questionBankMeta.tags && questionBankMeta.tags.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[11px] text-zinc-400 mb-1">Tags:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {questionBankMeta.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-900 text-[11px] text-zinc-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {questionBankMeta.description && (
                      <div className="pt-1">
                        <p className="text-[11px] text-zinc-400 mb-1">Mô tả:</p>
                        <p className="max-h-20 overflow-y-auto text-[11px] text-zinc-200 whitespace-pre-wrap">
                          {questionBankMeta.description}
                        </p>
                      </div>
                    )}

                    {(questionBankMeta.createdAt ||
                      questionBankMeta.updatedAt) && (
                        <div className="pt-1 border-t border-zinc-800 mt-1 text-[11px] text-zinc-500 space-y-0.5">
                          {questionBankMeta.createdAt && (
                            <p>Tạo lúc: {questionBankMeta.createdAt}</p>
                          )}
                          {questionBankMeta.updatedAt && (
                            <p>Cập nhật: {questionBankMeta.updatedAt}</p>
                          )}
                        </div>
                      )}

                    {/* DANH SÁCH CÂU HỎI */}
                    <div className="pt-2 border-t border-zinc-800 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                          Danh sách câu hỏi
                        </p>
                        {totalQuestionsOfAllBanks > 0 && (
                          <span className="text-[11px] text-zinc-400">
                            {totalQuestionsOfAllBanks} câu
                          </span>
                        )}
                      </div>

                      {loadingQuestions ? (
                        <p className="text-[11px] text-zinc-500">
                          Đang tải danh sách câu hỏi...
                        </p>
                      ) : questions.length === 0 ? (
                        <p className="text-[11px] text-zinc-500">
                          Chưa có câu hỏi nào trong bộ này.
                        </p>
                      ) : (
                        <div className="max-h-52 overflow-y-auto space-y-2 mt-1">
                          {questions.map((q, idx) => {
                            const isActive = idx === currentQuestionIndex;

                            return (
                              <div
                                key={q.questionId}
                                className={
                                  "rounded-lg px-3 py-2 space-y-1 border " +
                                  (isActive
                                    ? "border-emerald-500/80 bg-emerald-500/10"
                                    : "border-zinc-800 bg-zinc-950/70")
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-[11px] text-zinc-100">
                                      <span className="font-semibold">
                                        Câu {idx + 1}:
                                      </span>{" "}
                                      {q.questionText}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                                      {q.points} điểm · {q.timeLimit ?? 0}s
                                    </span>

                                    {isActive ? (
                                      <div className="flex items-center gap-1">
                                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/60 px-1.5 py-[1px] text-[10px] text-emerald-200">
                                          Đang phát cho HS
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleShowQuestionResults(q)
                                          }
                                          disabled={
                                            !session || questionControlLoading
                                          }
                                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/60 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          Hiển thị đáp án
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleBroadcastQuestion(q, idx)
                                        }
                                        disabled={
                                          !session ||
                                          session.status !== "Running" ||
                                          questionControlLoading
                                        }
                                        className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-400/60 px-2 py-0.5 text-[10px] text-blue-200 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        📢 Phát câu hỏi
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {q.options && q.options.length > 0 && (
                                  <ul className="mt-1 space-y-0.5">
                                    {[...q.options]
                                      .sort(
                                        (a, b) =>
                                          (a.displayOrder ?? 0) -
                                          (b.displayOrder ?? 0)
                                      )
                                      .map((opt) => (
                                        <li
                                          key={
                                            opt.questionOptionId ??
                                            opt.optionText
                                          }
                                          className="flex items-start gap-2 text-[11px]"
                                        >
                                          <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                          <span
                                            className={
                                              opt.isCorrect
                                                ? "text-emerald-300 font-medium"
                                                : "text-zinc-300"
                                            }
                                          >
                                            {opt.optionText ||
                                              "(Không có nội dung)"}
                                          </span>
                                          {opt.isCorrect && (
                                            <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-1.5 py-[1px] text-[10px] text-emerald-300">
                                              Đáp án
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {currentQuestionResults && (
                      <div className="mt-3 pt-2 border-t border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              setShowStudentAnswers((prev) => !prev)
                            }
                            disabled={!session || questionControlLoading}
                            className="text-[11px] uppercase tracking-[0.12em] text-zinc-200 font-medium underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {showStudentAnswers
                              ? "Ẩn câu trả lời của học sinh"
                              : "Các câu trả lời của học sinh"}
                          </button>

                          <span className="text-[11px] text-zinc-400">
                            {currentQuestionResults.results
                              ? `${currentQuestionResults.results.length} câu trả lời`
                              : "—"}
                          </span>
                        </div>

                        {typeof currentQuestionResults.correctAnswer ===
                          "string" &&
                          currentQuestionResults.correctAnswer.trim() !== "" && (
                            <p className="mb-2 text-[11px] text-emerald-300">
                              Đáp án đúng:{" "}
                              <span className="font-semibold">
                                {currentQuestionResults.correctAnswer}
                              </span>
                            </p>
                          )}

                        {!showStudentAnswers ? (
                          <p className="text-[11px] text-zinc-500">
                            Bấm nút &quot;Các câu trả lời của học sinh&quot; để
                            xem chi tiết.
                          </p>
                        ) : !currentQuestionResults.results ||
                          currentQuestionResults.results.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">
                            Chưa có câu trả lời nào cho câu hỏi này.
                          </p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
                            {currentQuestionResults.results.map(
                              (ans, index) => (
                                <div
                                  key={ans.participantId ?? index}
                                  className="flex items-start justify-between gap-3 text-[11px] text-zinc-100 border-b border-zinc-800/60 pb-1.5 last:border-0"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {ans.displayName ||
                                        `Học sinh ${index + 1}`}
                                    </p>

                                    {ans.answer &&
                                      ans.answer.trim() !== "" && (
                                        <p className="text-zinc-400">
                                          Trả lời:{" "}
                                          <span className="text-zinc-100">
                                            {ans.answer}
                                          </span>
                                        </p>
                                      )}
                                  </div>

                                  <div className="text-right text-[10px]">
                                    <p
                                      className={
                                        ans.isCorrect
                                          ? "text-emerald-300 font-semibold"
                                          : "text-rose-300 font-semibold"
                                      }
                                    >
                                      {ans.isCorrect ? "Đúng" : "Sai"}
                                    </p>
                                    <p className="text-zinc-400 mt-0.5">
                                      {ans.pointsEarned} điểm
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
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
          /{" "}
          <span className="font-semibold text-white">{segments.length}</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-2">
            {segments.map((seg, index) => (
              <button
                key={seg.segmentId}
                onClick={() => goToSegment(index)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${index === currentIndex
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

      {/* Session Share Modal */}
      {session &&
        showShareModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              role="presentation"
              onClick={() => {
                if (shareOverlayGuardRef.current) return;
                setShowShareModal(false);
              }}
            />
            <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Chia sẻ Session
              </div>

              <div className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Session Code:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={session.sessionCode}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-mono text-lg font-semibold tracking-wider text-center"
                      />
                      <button
                        onClick={() =>
                          copyToClipboard(session.sessionCode)
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mã QR:
                  </label>
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg inline-block border-2 border-gray-200 dark:border-zinc-700">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code for session join"
                        className="w-64 h-64"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Link từ QR code:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinLinkWithQR}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(joinLinkWithQR)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-6 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
