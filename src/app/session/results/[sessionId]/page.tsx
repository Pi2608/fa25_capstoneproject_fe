"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Leaderboard } from "@/components/session/Leaderboard";
import { getSession, getSessionLeaderboard } from "@/lib/api-session";
import type { LeaderboardEntry } from "@/types/session";

export default function SessionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [sessionData, leaderboardData] = await Promise.all([
          getSession(sessionId),
          getSessionLeaderboard(sessionId, 100), // Get all participants
        ]);

        setSession(sessionData);
        setLeaderboard(
          leaderboardData
            .map((entry) => ({
              participantId: entry.participantId ?? entry.sessionParticipantId ?? "",
              displayName: entry.displayName ?? "",
              score: entry.score ?? entry.totalScore ?? 0,
              rank: entry.rank ?? 0,
              totalCorrect: entry.totalCorrect ?? 0,
              totalAnswered: entry.totalAnswered ?? 0,
              averageResponseTime: entry.averageResponseTime ?? 0,
              isCurrentUser: entry.isCurrentUser ?? false,
            }))
            .filter((e) => e.participantId)
        );
      } catch (error) {
        console.error("Failed to fetch results:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Loading results...
          </div>
        </div>
      </div>
    );
  }

  const averageScore =
    leaderboard.length > 0
      ? leaderboard.reduce((sum, entry) => sum + entry.score, 0) /
      leaderboard.length
      : 0;

  const topScore = leaderboard.length > 0 ? leaderboard[0].score : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Session Results</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Code: {session?.sessionCode}
            </p>
          </div>
          <button
            onClick={() => router.push("/session/create")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            New Session
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              Total Participants
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {session?.totalParticipants || leaderboard.length}
            </div>
          </div>

          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              Average Score
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {averageScore.toFixed(0)}
            </div>
          </div>

          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              Top Score
            </div>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {topScore.toLocaleString()}
            </div>
          </div>

          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              Status
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {(session?.status === "COMPLETED" || session?.status === "CANCELLED") ? "🏁" : "🟢"}
            </div>
          </div>
        </div>

        {/* Session Info */}
        {session && (
          <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Session Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Session Code:
                </span>
                <span className="ml-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {session.sessionCode}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Status:
                </span>
                <span className="ml-2 font-semibold text-zinc-900 dark:text-zinc-100">{session.status}</span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Started:
                </span>
                <span className="ml-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {session.startedAt
                    ? new Date(session.startedAt).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Ended:
                </span>
                <span className="ml-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {session.endedAt
                    ? new Date(session.endedAt).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Final Leaderboard */}
        <div className="bg-background/80 backdrop-blur rounded-xl border shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Final Rankings</h2>

          {leaderboard.length > 0 ? (
            <Leaderboard
              entries={leaderboard}
              maxVisible={100}
              showAccuracy
              showResponseTime
              animated={false}
            />
          ) : (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <div className="text-4xl mb-2">🏆</div>
              <div>No participants in this session</div>
            </div>
          )}
        </div>

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="mt-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-center mb-8">
              🏆 Top 3 Champions 🏆
            </h2>

            <div className="flex items-end justify-center gap-4">
              {/* 2nd Place */}
              {leaderboard[1] && (
                <div className="flex flex-col items-center">
                  <div className="text-6xl mb-2">🥈</div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-48">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">2nd</div>
                      <div className="font-semibold text-lg mb-2 truncate">
                        {leaderboard[1].displayName}
                      </div>
                      <div className="text-3xl font-bold text-gray-600">
                        {leaderboard[1].score.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {leaderboard[0] && (
                <div className="flex flex-col items-center transform scale-110">
                  <div className="text-7xl mb-2">🥇</div>
                  <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-600/30 dark:to-yellow-700/30 rounded-lg p-6 w-48 border-4 border-yellow-400">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">1st</div>
                      <div className="font-semibold text-lg mb-2 truncate">
                        {leaderboard[0].displayName}
                      </div>
                      <div className="text-4xl font-bold text-yellow-700 dark:text-yellow-300">
                        {leaderboard[0].score.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {leaderboard[2] && (
                <div className="flex flex-col items-center">
                  <div className="text-6xl mb-2">🥉</div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-48">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">3rd</div>
                      <div className="font-semibold text-lg mb-2 truncate">
                        {leaderboard[2].displayName}
                      </div>
                      <div className="text-3xl font-bold text-orange-600">
                        {leaderboard[2].score.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-muted hover:bg-muted/80 text-zinc-900 dark:text-zinc-100 font-semibold rounded-lg transition-colors"
          >
            🖨️ Print Results
          </button>
          <button
            onClick={() => router.push("/session/create")}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
          >
            Create New Session
          </button>
        </div>
      </main>
    </div>
  );
}

