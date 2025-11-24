"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Timer } from "@/components/session/Timer";
import { Leaderboard } from "@/components/session/Leaderboard";
import { QuestionDisplay } from "@/components/session/questions/QuestionDisplay";
import { useSessionHub } from "@/hooks/useSessionHub";
import {
  getSession,
  submitParticipantResponse,
  leaveSession,
  getSessionLeaderboard,
} from "@/lib/api-ques";
import type {
  SessionQuestion,
  LeaderboardEntry,
  SessionStatus,
} from "@/types/session";
import type {
  QuestionActivatedEvent,
  LeaderboardUpdatedEvent,
  SessionStatusChangedEvent,
  SessionEndedEvent,
  TeacherFocusChangedEvent,
  MapStateSyncEvent,
} from "@/lib/hubs/session";
import { toast } from "react-toastify";

type ViewState =
  | "waiting"
  | "ready"
  | "question"
  | "results"
  | "leaderboard"
  | "ended";

export default function StudentPlayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionId = params.sessionId as string;
  const participantId = searchParams.get("participantId");

  const [viewState, setViewState] = useState<ViewState>("waiting");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("Pending");
  const [currentQuestion, setCurrentQuestion] =
    useState<SessionQuestion | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<any>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [teacherFocus, setTeacherFocus] = useState<
    TeacherFocusChangedEvent | MapStateSyncEvent | null
  >(null);

  // Fetch initial session data
  useEffect(() => {
    if (!sessionId || !participantId) {
      toast.error("Invalid session or participant ID");
      router.push("/session/join");
      return;
    }

    const fetchSession = async () => {
      try {
        const session = await getSession(sessionId);
        setSessionStatus(session.status);
        setParticipantCount(session.totalParticipants || 0);

        if (session.status === "Running") {
          setViewState("ready");
        } else if (session.status === "Ended") {
          setViewState("ended");
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        toast.error("Failed to load session");
      }
    };

    fetchSession();
  }, [sessionId, participantId, router]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await getSessionLeaderboard(sessionId);
      setLeaderboard(data);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  }, [sessionId]);

  // Handle session status change
  const handleSessionStatusChanged = useCallback(
    (event: SessionStatusChangedEvent) => {
      console.log("Session status changed:", event);
      setSessionStatus(event.status);

      if (event.status === "Running") {
        setViewState("ready");
        toast.info("Session started!");
      } else if (event.status === "Paused") {
        toast.info("Session paused");
      } else if (event.status === "Ended") {
        setViewState("ended");
        toast.info("Session ended");
      }
    },
    []
  );

  // Handle new question activation
  const handleQuestionActivated = useCallback(
    (event: QuestionActivatedEvent) => {
      console.log("Question activated:", event);

      const question: SessionQuestion = {
        id: event.sessionQuestionId,
        questionId: event.questionId,
        sessionId: event.sessionId,
        questionType: event.questionType as any,
        questionText: event.questionText,
        questionImageUrl: event.questionImageUrl,
        questionAudioUrl: event.questionAudioUrl,
        options: event.options,
        points: event.points,
        timeLimit: event.timeLimit,
        hintText: event.hintText,
        correctLatitude: event.correctLatitude,
        correctLongitude: event.correctLongitude,
        acceptanceRadiusMeters: event.acceptanceRadiusMeters,
        displayOrder: 0,
        activatedAt: event.activatedAt,
      };

      setCurrentQuestion(question);
      setHasSubmitted(false);
      setSubmittedAnswer(null);
      setFeedbackMessage(null);
      setViewState("question");
      toast.success(`New question! ${event.points} points`);
    },
    []
  );

  // Handle leaderboard update
  const handleLeaderboardUpdated = useCallback(
    (event: LeaderboardUpdatedEvent) => {
      console.log("Leaderboard updated:", event);
      setLeaderboard(event.leaderboard);
    },
    []
  );

  // Handle session ended
  const handleSessionEnded = useCallback((event: SessionEndedEvent) => {
    console.log("Session ended:", event);
    setViewState("ended");
    setLeaderboard(event.finalLeaderboard);
    toast.info("Session has ended! Here are the final results.");
  }, []);

  // Handle teacher focus (map sync)
  const handleTeacherFocusChanged = useCallback(
    (event: TeacherFocusChangedEvent | MapStateSyncEvent) => {
      console.log("Teacher focus changed:", event);
      setTeacherFocus(event);
    },
    []
  );

  // SignalR connection
  const { isConnected, error: hubError } = useSessionHub({
    sessionId,
    enabled: !!sessionId && !!participantId,
    handlers: {
      onSessionStatusChanged: handleSessionStatusChanged,
      onQuestionActivated: handleQuestionActivated,
      onLeaderboardUpdated: handleLeaderboardUpdated,
      onSessionEnded: handleSessionEnded,
      onTeacherFocusChanged: handleTeacherFocusChanged,
    },
  });

  // Submit answer
  const handleSubmitAnswer = async (answer: {
    optionId?: string;
    textAnswer?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (!currentQuestion || !participantId || hasSubmitted) return;

    setIsSubmitting(true);

    try {
      await submitParticipantResponse(participantId, {
        sessionQuestionId: currentQuestion.id,
        questionOptionId: answer.optionId,
        responseText: answer.textAnswer,
        responseLatitude: answer.latitude,
        responseLongitude: answer.longitude,
        responseTimeSeconds: 0, // Will be calculated by server
        usedHint: false,
      });

      setHasSubmitted(true);
      setSubmittedAnswer(answer);
      setFeedbackMessage("Answer submitted! ✓");
      toast.success("Answer submitted successfully!");

      // Fetch updated leaderboard
      await fetchLeaderboard();
    } catch (error: any) {
      console.error("Failed to submit answer:", error);
      toast.error(error?.message || "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave session
  const handleLeaveSession = async () => {
    if (!participantId) return;

    try {
      await leaveSession(participantId);
      toast.info("You left the session");
      router.push("/session/join");
    } catch (error) {
      console.error("Failed to leave session:", error);
      toast.error("Failed to leave session");
    }
  };

  // Render based on view state
  const renderContent = () => {
    switch (viewState) {
      case "waiting":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold mb-2">Waiting for session to start...</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              {participantCount} participant{participantCount !== 1 ? "s" : ""}{" "}
              in the room
            </p>
            <div className="animate-pulse text-emerald-600 dark:text-emerald-400">
              Your teacher will start the session soon
            </div>
          </div>
        );

      case "ready":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-3xl font-bold mb-2">Get Ready!</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Waiting for the first question...
            </p>
          </div>
        );

      case "question":
        return (
          <div className="space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-semibold">
                  {currentQuestion?.points} points
                </div>
                {feedbackMessage && (
                  <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-semibold">
                    {feedbackMessage}
                  </div>
                )}
              </div>

              {/* Timer */}
              {currentQuestion && currentQuestion.activatedAt && (
                <Timer
                  timeLimit={currentQuestion.timeLimit}
                  startTime={currentQuestion.activatedAt}
                  className="scale-75 origin-right"
                />
              )}
            </div>

            {/* Question Display */}
            {currentQuestion && (
              <QuestionDisplay
                question={currentQuestion}
                onSubmitAnswer={handleSubmitAnswer}
                disabled={hasSubmitted || isSubmitting}
                submittedAnswer={submittedAnswer}
                showCorrect={false}
              />
            )}
          </div>
        );

      case "ended":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏁</div>
            <h2 className="text-3xl font-bold mb-2">Session Ended!</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              Thank you for participating!
            </p>

            {/* Final Leaderboard */}
            {leaderboard.length > 0 && (
              <Leaderboard
                entries={leaderboard}
                currentParticipantId={participantId || undefined}
                showAccuracy
                className="max-w-2xl mx-auto"
              />
            )}

            <button
              onClick={() => router.push("/session/join")}
              className="mt-8 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
            >
              Join Another Session
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold">🎮</div>
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Session {sessionId.slice(0, 8)}...</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
              </div>
            </div>
          </div>

          <button
            onClick={handleLeaveSession}
            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Leave Session
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area */}
          <div className="lg:col-span-2">
            <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
              {renderContent()}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Leaderboard */}
            {viewState !== "ended" && leaderboard.length > 0 && (
              <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-4">
                <Leaderboard
                  entries={leaderboard}
                  currentParticipantId={participantId || undefined}
                  maxVisible={10}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

