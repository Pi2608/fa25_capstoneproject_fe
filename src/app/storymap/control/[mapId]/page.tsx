"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  getSessionQuestionResponses,
  getMapPinsData,
  type MapPinsDataDto,
  type SessionDto,
  type SessionRunningQuestionDto,
  type LeaderboardEntryDto,
  type QuestionDto,
} from "@/lib/api-ques";

import {
  QuestionBroadcastEvent,
  showQuestionResultsViaSignalR,
  type QuestionResultsEvent,
} from "@/lib/hubs/session";
import {
  getGroupsBySession,
  getGroupById,
  deleteGroup,
  getGroupSubmissions,
} from "@/lib/api-groupCollaboration";
import type { HubConnection } from "@microsoft/signalr";
import {
  createGroupCollaborationConnection,
  startGroupCollaborationConnection,
  stopGroupCollaborationConnection,
  joinGroupCollaborationSession,
  registerGroupCollaborationEventHandlers,
  unregisterGroupCollaborationEventHandlers,
  createGroup,
  gradeSubmission,
  sendMessage,
  type GroupDto,
  type GroupSubmissionDto,
  type GroupSubmissionGradedDto,
} from "@/lib/hubs/groupCollaboration";

import { toast } from "react-toastify";

import StoryMapViewer from "@/components/storymap/StoryMapViewer";
import { useLoading } from "@/contexts/LoadingContext";
import { useSessionHub } from "@/hooks/useSessionHub";
import {
  sendSegmentSyncViaSignalR,
  broadcastQuestionViaSignalR,
  sendMapLayerSyncViaSignalR,
  type SegmentSyncRequest,
} from "@/lib/hubs/session";
import type { BaseKey } from "@/types/common";
import { getToken } from "@/lib/api-core";

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

type GroupMember = {
  groupMemberId: string;
  sessionParticipantId: string;
  participantName: string;
  isLeader: boolean;
  joinedAt: string;
};

function normalizeGroup(raw: any): GroupDto {
  const groupId = raw?.groupId ?? raw?.id ?? raw?.GroupId ?? raw?.Id ?? "";
  const sessionId = raw?.sessionId ?? raw?.SessionId ?? "";

  const members: any[] = Array.isArray(raw?.members)
    ? raw.members
    : Array.isArray(raw?.groupMembers)
      ? raw.groupMembers
      : [];

  return {
    groupId,
    sessionId,

    name: raw?.groupName ?? raw?.name ?? raw?.GroupName ?? raw?.Name ?? "",

    color: raw?.color ?? raw?.Color ?? null,

    currentMembersCount:
      typeof raw?.currentMembersCount === "number"
        ? raw.currentMembersCount
        : members.length,

    maxMembers:
      typeof raw?.maxMembers === "number"
        ? raw.maxMembers
        : raw?.MaxMembers ?? null,

    members,
  } as GroupDto;
}

function normalizeHexColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const p of participants as any[]) {
      const id = p.sessionParticipantId ?? p.participantId ?? p.id;
      const name = p.displayName ?? p.name ?? p.fullName;
      if (id && name) map.set(String(id), String(name));
    }

    return map;
  }, [participants]);

  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  const [assignedParticipantIds, setAssignedParticipantIds] = useState<string[]>([]);

  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [questionControlLoading, setQuestionControlLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionBroadcastEvent | null>(null);

  const [questionBankMeta, setQuestionBankMeta] =
    useState<QuestionBankMeta | null>(null);
  const [groupCollabConnection, setGroupCollabConnection] =
    useState<HubConnection | null>(null);

  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [groupSubmissions, setGroupSubmissions] = useState<GroupSubmissionDto[]>(
    []
  );

  const [openPickGroup, setOpenPickGroup] = useState(false);
  const [pickGroupId, setPickGroupId] = useState<string>("");

  const [loadingGroupSubmissions, setLoadingGroupSubmissions] = useState(false);
  const [showGroupSubmissions, setShowGroupSubmissions] = useState(false);
  const [groupSubmissionsError, setGroupSubmissionsError] = useState<string | null>(null);
  const [submissionsGroupId, setSubmissionsGroupId] = useState<string | null>(null);

  const [isRespOpen, setIsRespOpen] = useState(false);
  const [respLoading, setRespLoading] = useState(false);
  const [respError, setRespError] = useState<string | null>(null);
  const [respItems, setRespItems] = useState<
    Array<{
      name: string;
      answer: string;
      isCorrect?: boolean;
      pointsEarned?: number;
      responseTimeSeconds?: number;
      submittedAt?: string;
    }>
  >([]);


  const [sessionQuestionBanks, setSessionQuestionBanks] = useState<
    SessionQuestionBankInfo[]
  >([]);

  // ========== NEW: state hiển thị chi tiết nhóm ==========
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const selectedGroupName =
    selectedGroupId
      ? (groups.find((g: any) => (g.groupId ?? g.id) === selectedGroupId)?.name ?? selectedGroupId)
      : null;

  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMember[]>(
    []
  );
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);

  // ========== NEW: state cho layer sync ==========
  const [selectedLayer, setSelectedLayer] = useState<BaseKey>("osm");

  const totalQuestionsOfAllBanks = sessionQuestionBanks.reduce(
    (sum, bank) => sum + (bank.totalQuestions ?? 0),
    0
  );
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState("");
  const [draftGroupColor, setDraftGroupColor] = useState("#22c55e"); // mặc định xanh
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extendSeconds, setExtendSeconds] = useState<string>("10");
  const [extendError, setExtendError] = useState<string | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const shareOverlayGuardRef = useRef(false);
  const [isGradeOpen, setIsGradeOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<any>(null);
  const [gradeScore, setGradeScore] = useState<string>("");
  const [gradeFeedback, setGradeFeedback] = useState<string>("");
  const [grading, setGrading] = useState(false);

  const openGradeModal = (submission: any) => {
    setGradeTarget(submission);
    setGradeScore(
      submission?.score != null ? String(submission.score) : ""
    );
    setGradeFeedback(submission?.feedback ?? "");
    setIsGradeOpen(true);
  };

  const closeGradeModal = () => {
    setIsGradeOpen(false);
    setGradeTarget(null);
    setGradeScore("");
    setGradeFeedback("");
  };

  const submitGrade = async () => {
    if (!gradeTarget) return;

    const submissionId = gradeTarget?.submissionId ?? gradeTarget?.SubmissionId ?? gradeTarget?.id ?? gradeTarget?.Id;
    const scoreNum = Number(gradeScore);

    if (!submissionId) {
      alert("Thiếu submissionId");
      return;
    }
    if (!Number.isFinite(scoreNum)) {
      alert("Điểm không hợp lệ");
      return;
    }

    setGrading(true);
    try {
      await handleGradeSubmission(submissionId, scoreNum, gradeFeedback?.trim() || undefined);
      closeGradeModal();
      await handleLoadGroupSubmissions();
    } finally {
      setGrading(false);
    }
  };

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
  const [currentBroadcastSessionQuestionId, setCurrentBroadcastSessionQuestionId] =
    useState<string | null>(null);

  const [isRestartRun, setIsRestartRun] = useState(false);

  const isLastQuestion =
    questions.length > 0 &&
    currentQuestionIndex != null &&
    currentQuestionIndex >= questions.length - 1;

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
        if (connection && session?.sessionId && segments.length > 0) {
          const segIndex = currentIndex >= 0 ? currentIndex : 0;
          const seg = segments[segIndex] || segments[0];

          sendSegmentSync(segIndex, seg.segmentId, seg.name || `Segment ${segIndex + 1}`, isTeacherPlaying);

          // sync luôn base layer
          sendMapLayerSyncViaSignalR(connection, session.sessionId, selectedLayer);
        }
      },


      onParticipantLeft: () => {
        handleLoadParticipants();
      },

      onQuestionBroadcast: (event: any) => {
        const sqid = event?.sessionQuestionId ?? event?.SessionQuestionId;
        if (sqid) setCurrentBroadcastSessionQuestionId(String(sqid));

        const qid = event?.questionId ?? event?.QuestionId;
        if (qid && Array.isArray(questions) && questions.length > 0) {
          const idx = questions.findIndex((q) => q.questionId === qid);
          if (idx >= 0) setCurrentQuestionIndex(idx);
        }
      },

      onQuestionResults: (event) => {
        setCurrentQuestionResults(event);
        setShowStudentAnswers(true);
      },
    },
  });

  const openCreateGroupModal = () => {
    setDraftGroupName(`Nhóm ${groups.length + 1}`);
    setDraftGroupColor("#22c55e");
    setShowCreateGroupModal(true);
  };

  // ================== SignalR connection for group collaboration ==================
  useEffect(() => {
    if (!session?.sessionId) return;

    const token = getToken();
    const conn = createGroupCollaborationConnection(token);

    if (!conn) {
      console.error("[GroupCollab] Cannot create connection");
      return;
    }

    registerGroupCollaborationEventHandlers(conn, {
      onGroupCreated: (group) => {
        setGroups((prev) => [...prev, normalizeGroup(group)]);
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
      setAssignedParticipantIds([]);
      setSelectedParticipantIds([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await getGroupsBySession(session.sessionId);
        if (cancelled) return;

        const rawList = Array.isArray(data) ? data : [];
        const list = rawList.map(normalizeGroup);
        setGroups(list);

        setGroups(list);

        const assigned = new Set<string>();

        for (const g of list as any[]) {
          const members: any[] = Array.isArray(g.members)
            ? g.members
            : Array.isArray(g.groupMembers)
              ? g.groupMembers
              : [];

          for (const m of members) {
            const mid: string | undefined =
              m.sessionParticipantId ?? m.participantId ?? m.id;
            if (mid) assigned.add(mid);
          }
        }

        setAssignedParticipantIds(Array.from(assigned));
        setSelectedParticipantIds((prev) =>
          prev.filter((id) => assigned.has(id) === false)
        );

      } catch (e) {
        console.error("[GroupCollab] Load groups failed:", e);
        if (!cancelled) {
          setGroups([]);
          setAssignedParticipantIds([]);
        }
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
      const members: GroupMember[] = Array.isArray(detail?.members) ? detail.members : [];

      const membersWithNames = (members as any[]).map((m, idx) => {
        const pid = m.sessionParticipantId ?? m.participantId ?? m.id;
        const raw = typeof m.participantName === "string" ? m.participantName.trim() : "";
        const isUnknown = raw.toLowerCase() === "unknown";

        const resolvedName =
          (!raw || isUnknown)
            ? (pid ? participantNameById.get(String(pid)) : undefined)
            : raw;

        return {
          ...m,
          participantName: resolvedName || m.participantName || `Thành viên ${idx + 1}`,
        };
      });

      setSelectedGroupMembers(membersWithNames as any);

    } catch (e) {
      console.error("[GroupCollab] Load group detail failed:", e);
      setSelectedGroupMembers([]);
    } finally {
      setLoadingGroupMembers(false);
    }
  };

  const handleLoadGroupSubmissions = async () => {
    setShowGroupSubmissions(true);
    setGroupSubmissionsError(null);

    if (!selectedGroupId) {
      setGroupSubmissions([]);
      setSubmissionsGroupId(null);
      setGroupSubmissionsError("Hãy chọn 1 nhóm ở mục Hoạt động nhóm trước.");
      return;
    }

    setLoadingGroupSubmissions(true);
    setSubmissionsGroupId(selectedGroupId);

    try {
      const res: any = await getGroupSubmissions(selectedGroupId);

      const list =
        Array.isArray(res) ? res :
          Array.isArray(res?.items) ? res.items :
            Array.isArray(res?.data) ? res.data :
              [];

      setGroupSubmissions(list);
    } catch (e) {
      console.error("[GroupCollab] Load group submissions failed:", e);
      setGroupSubmissions([]);
      setGroupSubmissionsError("Không tải được bài nộp nhóm.");
    } finally {
      setLoadingGroupSubmissions(false);
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

    const prevStatus = session.status;
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

      if (action === "start" && (prevStatus === "Ended" || prevStatus === "Completed")) {
        setIsRestartRun(true);
        setCurrentQuestionIndex(null);
        setCurrentBroadcastSessionQuestionId(null);
        setCurrentQuestionResults(null);
        setShowStudentAnswers(false);
        setError(null);
      }

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

      setCurrentBroadcastSessionQuestionId(null);

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

  const broadcastQuestionAtIndex = async (index: number) => {
    if (!session || !connection) return;
    const q = questions[index];
    if (!q) return;

    setCurrentQuestionIndex(index);
    setCurrentQuestionResults(null);
    setShowStudentAnswers(false);

    await broadcastQuestionViaSignalR(connection, session.sessionId, {
      sessionQuestionId: q.sessionQuestionId ?? q.questionId,
      questionId: q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
      questionImageUrl: q.questionImageUrl ?? undefined,
      options: q.options?.map((opt) => ({
        id: opt.questionOptionId,
        optionText: opt.optionText,
        optionImageUrl: opt.optionImageUrl ?? undefined,
        displayOrder: opt.displayOrder,
      })),
      points: q.points,
      timeLimit: q.timeLimit ?? 30,
    });
  };

  const handleShowQuestionResults = async (question: QuestionDto) => {
    if (!session || questionControlLoading || !connection) return;

    try {
      setQuestionControlLoading(true);

      let correctAnswerText: string | undefined;

      // 1) Nếu có options (TRUE_FALSE / MULTIPLE_CHOICE) → lấy option đúng
      if (question.options && question.options.length > 0) {
        const correctOption = question.options.find((opt) => opt.isCorrect);
        correctAnswerText = correctOption?.optionText ?? undefined;
      }
      // 2) SHORT_ANSWER → lấy correctAnswerText
      else if (question.questionType === "SHORT_ANSWER") {
        correctAnswerText = question.correctAnswerText ?? undefined;
      }
      // 3) PIN_ON_MAP → hiển thị toạ độ làm đáp án 
      else if (
        question.questionType === "PIN_ON_MAP" &&
        typeof question.correctLatitude === "number" &&
        typeof question.correctLongitude === "number"
      ) {
        correctAnswerText = `${question.correctLatitude.toFixed(4)}, ${question.correctLongitude.toFixed(4)}`;
        if (question.acceptanceRadiusMeters) {
          correctAnswerText += ` (±${question.acceptanceRadiusMeters}m)`;
        }
      }

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
    if (!session || questionControlLoading || !connection) return;
    if (!questions.length) return;

    const prevIndex = currentQuestionIndex ?? -1;
    const nextIndex = Math.min(prevIndex + 1, questions.length - 1);
    const nextQuestion = questions[nextIndex];

    if (!nextQuestion) return;

    try {
      setQuestionControlLoading(true);
      setCurrentQuestionResults(null);
      setShowStudentAnswers(false);

      if (isRestartRun) {
        await handleBroadcastQuestion(nextQuestion, nextIndex);
        return;
      }

      await activateNextQuestion(session.sessionId);

      await handleBroadcastQuestion(nextQuestion, nextIndex);
    } catch (e: any) {
      const msg = String(e?.message || "");


      if (msg.includes("Session.NoMoreQuestions")) {
        toast.info("Hết câu hỏi trong queue. Chuyển sang chế độ phát lại từ danh sách.");
        setIsRestartRun(true);
        await handleBroadcastQuestion(nextQuestion, nextIndex);
        return;
      }

      console.error("Next question failed:", e);
      toast.error(e?.message || "Không chuyển được sang câu tiếp theo");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!session || questionControlLoading || !connection) return;
    if (!questions.length) return;

    const prevIndex = currentQuestionIndex ?? -1;
    const isLast = prevIndex >= questions.length - 1;

    if (isLast) {
      toast.info("Đang ở câu cuối, không thể bỏ qua thêm.");
      return;
    }

    const nextIndex = Math.min(prevIndex + 1, questions.length - 1);
    const nextQuestion = questions[nextIndex];

    if (!nextQuestion) return;

    try {
      setQuestionControlLoading(true);
      setCurrentQuestionResults(null);
      setShowStudentAnswers(false);

      if (!isRestartRun) {
        await skipCurrentQuestion(session.sessionId);
      }

      await handleBroadcastQuestion(nextQuestion, nextIndex);
    } catch (e: any) {
      const msg = String(e?.message || "");

      if (msg.includes("Session.NoMoreQuestions")) {
        toast.info("Hết câu hỏi trong queue. Chuyển sang chế độ phát theo danh sách.");
        setIsRestartRun(true);
        await handleBroadcastQuestion(nextQuestion, nextIndex);
        return;
      }

      console.error("Skip question failed:", e);
      toast.error(e?.message || "Không bỏ qua được câu hỏi");

    } finally {
      setQuestionControlLoading(false);
    }
  };

  const handleExtendQuestion = async () => {
    if (!session || questionControlLoading) return;

    const sessionQuestionId = currentBroadcastSessionQuestionId;
    if (!sessionQuestionId) {
      toast.error('Chưa có câu hỏi nào đang phát. Hãy bấm "Câu tiếp" để broadcast câu hỏi trước.');
      return;
    }

    setExtendError(null);
    setExtendSeconds("10");
    setIsExtendOpen(true);
  };

  const closeExtendModal = () => {
    setIsExtendOpen(false);
    setExtendError(null);
  };

  const submitExtendTime = async () => {
    if (!session || questionControlLoading) return;

    const sessionQuestionId = currentBroadcastSessionQuestionId;
    if (!sessionQuestionId) {
      setExtendError("Chưa có câu hỏi nào đang broadcast.");
      return;
    }

    const seconds = Number(extendSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setExtendError("Số giây không hợp lệ. Vui lòng nhập số > 0.");
      return;
    }

    try {
      setExtendError(null);
      setQuestionControlLoading(true);
      await extendQuestionTime(sessionQuestionId, seconds);
      try {
        setExtendError(null);
        setQuestionControlLoading(true);

        await extendQuestionTime(sessionQuestionId, seconds);

        toast.success(`Đã cộng thêm ${seconds}s cho câu hỏi đang phát`);
        setIsExtendOpen(false);
      } catch (e: any) {
        setExtendError(e?.message || "Không gia hạn được thời gian cho câu hỏi");
        toast.error(e?.message || "❌ Cộng thời gian thất bại");
      } finally {
        setQuestionControlLoading(false);
      }

      setIsExtendOpen(false);
    } catch (e: any) {
      setExtendError(e?.message || "Không gia hạn được thời gian cho câu hỏi");
    } finally {
      setQuestionControlLoading(false);
    }
  };

  const loadStudentResponses = async () => {
    const sessionQuestionId = currentBroadcastSessionQuestionId;
    if (!sessionQuestionId) {
      toast.error('Chưa có câu hỏi đang phát. Hãy bấm "Câu tiếp" trước.');
      return;
    }

    try {
      setRespLoading(true);
      setRespError(null);

      const data = await getSessionQuestionResponses(sessionQuestionId);

      const mapped = (data.answers || []).map((a) => {
        const answer =
          a.optionText ??
          a.responseText ??
          (a.responseLatitude != null && a.responseLongitude != null
            ? `${a.responseLatitude}, ${a.responseLongitude}`
            : "(không có câu trả lời)");

        return {
          name: a.displayName || a.participantId,
          answer,
          isCorrect: Boolean(a.isCorrect),
          pointsEarned: typeof a.pointsEarned === "number" ? a.pointsEarned : undefined,
          responseTimeSeconds:
            typeof a.responseTimeSeconds === "number" ? a.responseTimeSeconds : undefined,
          submittedAt: a.submittedAt,
        };

      });

      setRespItems(mapped);
    } catch (e: any) {
      const msg = e?.message || "Không tải được câu trả lời";
      setRespError(msg);
      toast.error(msg);
    } finally {
      setRespLoading(false);
    }
  };

  const handleCreateGroup = async (name: string, color?: string) => {
    if (!groupCollabConnection || !session?.sessionId) return;

    const memberParticipantIds = selectedParticipantIds.filter(
      (id) => !assignedParticipantIds.includes(id)
    );

    if (memberParticipantIds.length === 0) {
      window.alert("Hãy chọn ít nhất 1 học sinh trong danh sách tham gia để tạo nhóm.");
      return;
    }

    await createGroup(groupCollabConnection, {
      sessionId: session.sessionId,
      groupName: name,
      color: color || null,
      memberParticipantIds,
      leaderParticipantId: memberParticipantIds[0],
    });

    setAssignedParticipantIds((prev) => [...prev, ...memberParticipantIds]);
    setSelectedParticipantIds([]);
  };


  const handleGradeSubmission = async (
    submissionId: string,
    score: number,
    feedback?: string
  ) => {
    if (!groupCollabConnection) return;

    await gradeSubmission(groupCollabConnection, {
      submissionId,
      score,
      feedback,
    });

  };

  const handleSendMessageToGroup = async (groupId: string, message: string) => {
    if (!groupCollabConnection) return;
    await sendMessage(groupCollabConnection, groupId, message);
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

                  {(session.status === "Ended" || session.status === "Completed") && (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-emerald-200">
                          Session đã kết thúc — xem tổng kết.
                        </p>

                        <button
                          type="button"
                          onClick={() => router.push(`/session/results/${session.sessionId}`)}
                          className="shrink-0 inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-emerald-500 border border-emerald-500/60"
                        >
                          Tổng kết session
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LAYER SYNC DROPDOWN */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-2">
                    <p className="text-[11px] text-zinc-400">
                      🗺️ Base Map:
                    </p>
                    <select
                      value={selectedLayer}
                      onChange={(e) => {
                        const newLayer = e.target.value as BaseKey;
                        setSelectedLayer(newLayer);
                        // Sync layer to students
                        if (connection && session) {
                          sendMapLayerSyncViaSignalR(
                            connection,
                            session.sessionId,
                            newLayer
                          );
                        }
                      }}
                      className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="osm">OpenStreetMap</option>
                      <option value="sat">Satellite</option>
                      <option value="dark">Dark</option>
                      <option value="positron">Light</option>
                      <option value="terrain">Terrain</option>
                      <option value="topo">Topographic</option>
                    </select>
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

                      {!loadingLeaderboard && leaderboard.length > 0 && (
                        <div className="space-y-1">
                          {leaderboard.map((p, idx) => {
                            const place = Number(p.rank ?? idx + 1);

                            const isTop1 = place === 1;
                            const isTop2 = place === 2;
                            const isTop3 = place === 3;

                            const rowCls =
                              "flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-[11px] " +
                              (isTop1
                                ? "border-amber-400/70 bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent"
                                : isTop2
                                  ? "border-zinc-300/30 bg-gradient-to-r from-zinc-200/10 via-zinc-200/5 to-transparent"
                                  : isTop3
                                    ? "border-orange-400/60 bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent"
                                    : "border-zinc-800 bg-zinc-950/30");

                            const badgeCls =
                              "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-bold border " +
                              (isTop1
                                ? "border-amber-400/70 bg-amber-500/15 text-amber-200"
                                : isTop2
                                  ? "border-zinc-200/30 bg-zinc-200/10 text-zinc-100"
                                  : isTop3
                                    ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-300");

                            return (
                              <div key={p.participantId ?? idx} className={rowCls}>
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className={badgeCls}>#{place}</span>

                                  <div className="min-w-0">
                                    <p
                                      className={
                                        "truncate font-semibold " +
                                        (isTop1
                                          ? "text-amber-200"
                                          : isTop2
                                            ? "text-zinc-100"
                                            : isTop3
                                              ? "text-orange-200"
                                              : "text-zinc-200")
                                      }
                                    >
                                      {p.displayName}
                                    </p>

                                    {(isTop1 || isTop2 || isTop3) && (
                                      <p
                                        className={
                                          "mt-0.5 text-[10px] " +
                                          (isTop1
                                            ? "text-amber-300/90"
                                            : isTop2
                                              ? "text-zinc-300"
                                              : "text-orange-300/90")
                                        }
                                      >
                                        {isTop1 ? "Top 1" : isTop2 ? "Top 2" : "Top 3"}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p
                                    className={
                                      "text-[12px] font-extrabold " +
                                      (isTop1
                                        ? "text-amber-200"
                                        : isTop2
                                          ? "text-zinc-100"
                                          : isTop3
                                            ? "text-orange-200"
                                            : "text-zinc-200")
                                    }
                                  >
                                    {p.score}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">điểm</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

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
                        participants.map((p, idx) => {
                          const id: string | undefined =
                            p.participantId ?? (p as any).sessionParticipantId ?? (p as any).id;

                          if (!id) return null;

                          const isAssigned = assignedParticipantIds.includes(id);
                          const isSelected = selectedParticipantIds.includes(id);

                          return (
                            <div
                              key={id ?? idx}
                              className="flex items-center justify-between text-[11px] text-zinc-200 py-1 border-b border-zinc-800/50 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                {/* NEW: checkbox chọn học sinh */}
                                <input
                                  type="checkbox"
                                  disabled={isAssigned}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isAssigned) return;
                                    setSelectedParticipantIds((prev) =>
                                      prev.includes(id)
                                        ? prev.filter((x) => x !== id)
                                        : [...prev, id]
                                    );
                                  }}
                                  className="h-3 w-3 rounded border-zinc-600 bg-zinc-900 text-emerald-400 focus:ring-emerald-500"
                                />

                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                                  {p.rank ?? idx + 1}
                                </span>
                                <span className="text-zinc-100">
                                  {p.displayName}
                                </span>

                                {isAssigned && (
                                  <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-1.5 py-[1px] text-[9px] text-emerald-300">
                                    Đã có nhóm
                                  </span>
                                )}
                              </div>

                              {typeof p.score === "number" && (
                                <span className="font-semibold text-emerald-400">
                                  {p.score} điểm
                                </span>
                              )}
                            </div>
                          );
                        })}

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
                          onClick={openCreateGroupModal}
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

                            const groupColor = normalizeHexColor((g as any).color);
                            const bg = groupColor
                              ? hexToRgba(groupColor, isSelected ? 0.18 : 0.10)
                              : undefined;

                            return (
                              <div
                                key={g.groupId ?? idx}
                                onClick={() => handleSelectGroup(g.groupId)}
                                className={
                                  "w-full flex items-center justify-between text-[11px] py-1.5 px-2 rounded-md border mb-[2px] last:mb-0 cursor-pointer " +
                                  "border-zinc-800 hover:bg-zinc-900/70 " +
                                  "border-l-4 " +
                                  (isSelected ? "text-zinc-50" : "text-zinc-200")
                                }
                                style={{
                                  backgroundColor: bg,
                                  borderLeftColor: groupColor ?? undefined,
                                  boxShadow: isSelected && groupColor ? `0 0 0 1px ${hexToRgba(groupColor, 0.55)}` : undefined,
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <span
                                    className="mt-[3px] h-2.5 w-2.5 rounded-full border border-zinc-800"
                                    style={{ backgroundColor: groupColor ?? "#3f3f46" }}
                                    title={groupColor ?? undefined}
                                  />
                                  <div>
                                    <p className="font-semibold">
                                      {g.name || `Nhóm ${idx + 1}`}
                                    </p>

                                    {typeof g.currentMembersCount === "number" &&
                                      typeof g.maxMembers === "number" && (
                                        <p className={isSelected ? "text-zinc-200" : "text-zinc-400"}>
                                          {g.currentMembersCount}/{g.maxMembers} thành viên
                                        </p>
                                      )}
                                  </div>
                                </div>

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
              key={`control-map-${selectedLayer}`}
              mapId={mapId}
              segments={segments}
              baseMapProvider={selectedLayer}
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
                          session.status !== "Running" ||
                          isLastQuestion
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
                          session.status !== "Running" ||
                          isLastQuestion
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
                      <button
                        type="button"
                        onClick={() => {
                          setIsRespOpen(true);
                          loadStudentResponses();
                        }}
                        disabled={!session || questionControlLoading || session.status !== "Running"}
                        className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-zinc-700 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Các câu trả lời
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

                                {q.options && q.options.length > 0 ? (
                                  // TRUE_FALSE / MULTIPLE_CHOICE
                                  <ul className="mt-1 space-y-0.5">
                                    {[...q.options]
                                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                                      .map((opt) => (
                                        <li
                                          key={opt.questionOptionId ?? opt.optionText}
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
                                            {opt.optionText || "(Không có nội dung)"}
                                          </span>
                                          {opt.isCorrect && (
                                            <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-1.5 py-[1px] text-[10px] text-emerald-300">
                                              Đáp án
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                  </ul>
                                ) : q.questionType === "SHORT_ANSWER" && q.correctAnswerText ? (
                                  // SHORT_ANSWER: hiện trực tiếp text đáp án
                                  <p className="mt-1 text-[11px]">
                                    <span className="text-zinc-400">Đáp án: </span>
                                    <span className="text-emerald-300 font-semibold">
                                      {q.correctAnswerText}
                                    </span>
                                  </p>
                                ) : q.questionType === "PIN_ON_MAP" &&
                                  typeof q.correctLatitude === "number" &&
                                  typeof q.correctLongitude === "number" ? (
                                  // PIN_ON_MAP: hiện toạ độ / mô tả đáp án
                                  <p className="mt-1 text-[11px] text-zinc-400">
                                    Đáp án: vị trí trên bản đồ{" "}
                                    <span className="font-mono text-emerald-300">
                                      ({q.correctLatitude.toFixed(4)}, {q.correctLongitude.toFixed(4)})
                                    </span>
                                    {q.acceptanceRadiusMeters && (
                                      <> · bán kính {q.acceptanceRadiusMeters}m</>
                                    )}
                                  </p>
                                ) : null}

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
            {/* ===================== BÀI NỘP NHÓM (card riêng) ===================== */}
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold text-zinc-200">Bài nộp nhóm</p>
                  <p className="text-[11px] text-zinc-500">
                    {selectedGroupId
                      ? `Nhóm: ${selectedGroupName}`
                      : "Chưa chọn nhóm (bấm nhóm ở panel trái)."}

                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLoadGroupSubmissions}
                  disabled={loadingGroupSubmissions}
                  className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Tải bài nộp
                </button>
              </div>

              <div className="mt-2">
                {loadingGroupSubmissions ? (
                  <p className="text-[11px] text-zinc-500">Đang tải bài nộp...</p>
                ) : groupSubmissionsError ? (
                  <p className="text-[11px] text-red-400">{groupSubmissionsError}</p>
                ) : groupSubmissions.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Chưa có bài nộp.</p>
                ) : (
                  <div className="space-y-2">
                    {groupSubmissions.map((s: any, idx: number) => {
                      const submissionId = s?.submissionId ?? s?.SubmissionId ?? s?.id ?? s?.Id;
                      const groupName = s?.groupName ?? s?.GroupName ?? "Nhóm (chưa có tên)";
                      const title = s?.title ?? s?.Title ?? "";
                      const submittedAt = s?.submittedAt ?? s?.SubmittedAt ?? "";
                      const content = s?.content ?? s?.Content ?? "";
                      const attachmentUrls = s?.attachmentUrls ?? s?.AttachmentUrls ?? [];

                      return (
                        <div
                          key={submissionId ?? idx}
                          className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-zinc-200 truncate">
                                {groupName}
                              </p>

                              {title && (
                                <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                                  {title}
                                </p>
                              )}

                              {content && (
                                <p className="mt-1 text-[11px] text-zinc-400">
                                  {String(content).length > 200 ? String(content).slice(0, 200) + "…" : String(content)}
                                </p>
                              )}

                              {Array.isArray(attachmentUrls) && attachmentUrls.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {attachmentUrls.map((url: string, i: number) => (
                                    <a
                                      key={`${submissionId}-att-${i}`}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block text-[11px] text-sky-300 hover:text-sky-200 underline truncate"
                                      title={url}
                                    >
                                      Đính kèm {i + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* CỘT PHẢI: thời gian + nút Chấm điểm */}
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-zinc-500">{submittedAt}</p>

                              <button
                                type="button"
                                onClick={() => openGradeModal(s)}
                                className="mt-1 inline-flex items-center rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                              >
                                Chấm điểm
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                )}
              </div>
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

      {isExtendOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/95 p-5 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-zinc-200">Gia hạn thời gian</p>
              <button
                type="button"
                onClick={closeExtendModal}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-[12px] text-zinc-400 mb-1">
                  Nhập số giây muốn cộng thêm
                </label>

                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={extendSeconds}
                  onChange={(e) => setExtendSeconds(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ví dụ: 10"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 20, 30].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setExtendSeconds(String(s))}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[11px] text-zinc-100 hover:bg-zinc-800"
                    >
                      +{s}s
                    </button>
                  ))}
                </div>

                {extendError && (
                  <p className="mt-2 text-[12px] text-red-300">{extendError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeExtendModal}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={submitExtendTime}
                  disabled={questionControlLoading}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  {questionControlLoading ? "Đang cộng..." : "Cộng thời gian"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRespOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-3">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-zinc-200">Câu trả lời học sinh</p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadStudentResponses}
                  disabled={respLoading}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {respLoading ? "Đang tải..." : "Tải lại"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRespOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {respError && <p className="mt-2 text-[12px] text-rose-300">{respError}</p>}

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-zinc-800">
              {respItems.length === 0 && !respLoading ? (
                <p className="p-3 text-[12px] text-zinc-400">Chưa có câu trả lời.</p>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {respItems.map((it, idx) => (
                    <li key={idx} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-100">{it.name}</p>

                        {typeof it.isCorrect === "boolean" && (
                          <span
                            className={[
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                              it.isCorrect
                                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                                : "border-rose-500/60 bg-rose-500/10 text-rose-200",
                            ].join(" ")}
                          >
                            {it.isCorrect ? "Đúng" : "Sai"}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        {typeof it.pointsEarned === "number" && (
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                            {it.pointsEarned} điểm
                          </span>
                        )}
                        {typeof it.responseTimeSeconds === "number" && (
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                            {it.responseTimeSeconds}s
                          </span>
                        )}
                        {it.submittedAt && (
                          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                            {new Date(it.submittedAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-[13px] text-zinc-300 whitespace-pre-wrap">
                        {it.answer}
                      </p>
                    </li>

                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {isGradeOpen && gradeTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-5 shadow-2xl ring-1 ring-white/10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-zinc-200">Chấm điểm bài nộp</p>
              <button
                type="button"
                onClick={closeGradeModal}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            {(() => {
              const s = gradeTarget;
              const submissionId = s?.submissionId ?? s?.SubmissionId ?? s?.id ?? s?.Id;
              const groupName = s?.groupName ?? s?.GroupName ?? "";
              const groupId = s?.groupId ?? s?.GroupId ?? "";
              const title = s?.title ?? s?.Title ?? "";
              const content = s?.content ?? s?.Content ?? "";
              const attachmentUrls = s?.attachmentUrls ?? s?.AttachmentUrls ?? [];
              const submittedAt = s?.submittedAt ?? s?.SubmittedAt ?? "";
              const gradedAt = s?.gradedAt ?? s?.GradedAt ?? "";
              const score = s?.score ?? s?.Score ?? null;
              const feedback = s?.feedback ?? s?.Feedback ?? null;

              return (
                <div className="mt-3 space-y-3 text-[12px] text-zinc-300">
                  <div className="grid grid-cols-2 gap-2">
                    {/* <div><span className="text-zinc-500">submissionId:</span> {submissionId}</div> */}
                    <div><span className="text-zinc-500">groupName:</span> {groupName}</div>
                    {/* <div><span className="text-zinc-500">groupId:</span> {groupId}</div> */}
                    <div><span className="text-zinc-500">submittedAt:</span> {submittedAt}</div>
                    <div><span className="text-zinc-500">score:</span> {score ?? "null"}</div>
                    <div><span className="text-zinc-500">gradedAt:</span> {gradedAt || "null"}</div>
                  </div>

                  {title && (
                    <div>
                      <div className="text-zinc-500">title:</div>
                      <div className="rounded-lg border-zinc-700 bg-zinc-800/50">{title}</div>
                    </div>
                  )}

                  {content && (
                    <div>
                      <div className="text-zinc-500">content:</div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 whitespace-pre-wrap">
                        {String(content)}
                      </div>
                    </div>
                  )}

                  {Array.isArray(attachmentUrls) && attachmentUrls.length > 0 && (
                    <div>
                      <div className="text-zinc-500">attachmentUrls:</div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 space-y-1">
                        {attachmentUrls.map((url: string, i: number) => (
                          <a
                            key={`att-${i}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sky-300 hover:text-sky-200 underline break-all"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-zinc-500">feedback hiện tại:</div>
                    <div className="rounded-lg border-zinc-700 bg-zinc-800/50">
                      {feedback ?? "Chưa có"}
                    </div>
                  </div>

                  {/* Form chấm điểm */}
                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    <div>
                      <div className="text-zinc-500 mb-1">Điểm</div>
                      <input
                        type="number"
                        value={gradeScore}
                        onChange={(e) => setGradeScore(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[12px] text-zinc-100
           focus:outline-none focus:ring-2 focus:ring-emerald-500/30"

                      />
                    </div>

                    <div>
                      <div className="text-zinc-500 mb-1">Nhận xét</div>
                      <textarea
                        value={gradeFeedback}
                        onChange={(e) => setGradeFeedback(e.target.value)}
                        className="w-full h-24 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[12px] text-zinc-100 resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={closeGradeModal}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] text-zinc-200 hover:bg-zinc-800"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={submitGrade}
                        disabled={grading}
                        className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {grading ? "Đang lưu..." : "Lưu điểm"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showCreateGroupModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-sm font-semibold">Tạo nhóm mới</p>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <div className="px-4 py-4 space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Tên nhóm</label>
                  <input
                    value={draftGroupName}
                    onChange={(e) => setDraftGroupName(e.target.value)}
                    maxLength={50}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    placeholder="Ví dụ: Nhóm 1"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Tối đa 50 ký tự
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Màu nhóm</label>

                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={draftGroupColor}
                      onChange={(e) => setDraftGroupColor(e.target.value)}
                      className="h-10 w-12 rounded-md border border-zinc-800 bg-transparent p-1"
                      title="Chọn màu"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[
                        "#22c55e", "#3b82f6", "#a855f7", "#f97316",
                        "#ef4444", "#eab308", "#14b8a6", "#f43f5e",
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDraftGroupColor(c)}
                          className={
                            "h-7 w-7 rounded-full border " +
                            (draftGroupColor === c ? "border-white" : "border-zinc-800")
                          }
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={creatingGroup || !draftGroupName.trim() || !groupCollabConnection}
                  onClick={async () => {
                    const name = draftGroupName.trim();
                    if (!name) return;

                    try {
                      setCreatingGroup(true);
                      await handleCreateGroup(name, draftGroupColor);
                      setShowCreateGroupModal(false);
                    } finally {
                      setCreatingGroup(false);
                    }
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  {creatingGroup ? "Đang tạo..." : "Tạo nhóm"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}
