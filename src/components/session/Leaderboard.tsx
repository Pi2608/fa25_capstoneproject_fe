"use client";

import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "@/types/session";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentParticipantId?: string;
  maxVisible?: number;
  showAccuracy?: boolean;
  showResponseTime?: boolean;
  animated?: boolean;
  className?: string;
}

export function Leaderboard({
  entries,
  currentParticipantId,
  maxVisible = 10,
  showAccuracy = false,
  showResponseTime = false,
  animated = true,
  className = "",
}: LeaderboardProps) {
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  // Animate changes to leaderboard
  useEffect(() => {
    if (!animated) {
      setDisplayEntries(entries.slice(0, maxVisible));
      return;
    }

    // Find new or moved entries
    const newIds = new Set(entries.map((e) => e.participantId));
    const oldIds = new Set(displayEntries.map((e) => e.participantId));

    const changed = new Set<string>();
    entries.forEach((entry, index) => {
      const oldEntry = displayEntries.find(
        (e) => e.participantId === entry.participantId
      );
      if (!oldEntry || oldEntry.rank !== entry.rank || oldEntry.score !== entry.score) {
        changed.add(entry.participantId);
      }
    });

    setHighlightedIds(changed);
    setDisplayEntries(entries.slice(0, maxVisible));

    // Clear highlights after animation
    const timer = setTimeout(() => {
      setHighlightedIds(new Set());
    }, 1000);

    return () => clearTimeout(timer);
  }, [entries, maxVisible, animated, displayEntries]);

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-600 dark:text-yellow-400";
      case 2:
        return "text-gray-500 dark:text-gray-400";
      case 3:
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  if (displayEntries.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 ${className}`}
      >
        <div className="text-4xl mb-2">🏆</div>
        <div className="text-lg font-medium">No participants yet</div>
        <div className="text-sm">Leaderboard will update as students join</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span>🏆</span>
          <span>Leaderboard</span>
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {displayEntries.length} participants
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-1">
        {displayEntries.map((entry, index) => {
          const isCurrentUser = entry.participantId === currentParticipantId;
          const isHighlighted = highlightedIds.has(entry.participantId);
          const medal = getMedalEmoji(entry.rank);

          return (
            <div
              key={entry.participantId}
              className={`
                flex items-center gap-3 px-4 py-3
                rounded-lg
                transition-all duration-500
                ${
                  isCurrentUser
                    ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                }
                ${isHighlighted ? "scale-105 shadow-lg" : ""}
                ${animated ? "transform" : ""}
              `}
            >
              {/* Rank */}
              <div
                className={`flex items-center justify-center w-10 text-xl font-bold ${getRankColor(entry.rank)}`}
              >
                {medal || `#${entry.rank}`}
              </div>

              {/* Display Name */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-semibold truncate ${isCurrentUser ? "text-blue-700 dark:text-blue-300" : ""}`}
                >
                  {entry.displayName}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                      (You)
                    </span>
                  )}
                </div>

                {/* Additional Stats */}
                {(showAccuracy || showResponseTime) && (
                  <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {showAccuracy && entry.accuracy !== undefined && (
                      <span>📊 {entry.accuracy.toFixed(0)}% accuracy</span>
                    )}
                    {showResponseTime && entry.averageResponseTime !== undefined && (
                      <span>⏱️ {entry.averageResponseTime.toFixed(1)}s avg</span>
                    )}
                  </div>
                )}
              </div>

              {/* Score */}
              <div
                className={`text-xl font-bold tabular-nums ${isCurrentUser ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}
              >
                {entry.score.toLocaleString()}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                  pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More Indicator */}
      {entries.length > maxVisible && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
          + {entries.length - maxVisible} more participants
        </div>
      )}
    </div>
  );
}

// Compact Leaderboard for sidebars or small spaces
export function CompactLeaderboard({
  entries,
  currentParticipantId,
  maxVisible = 5,
  className = "",
}: Pick<LeaderboardProps, "entries" | "currentParticipantId" | "maxVisible" | "className">) {
  const topEntries = entries.slice(0, maxVisible);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2 pb-1 flex items-center gap-1">
        <span>🏆</span>
        <span>Top {maxVisible}</span>
      </div>

      {topEntries.map((entry) => {
        const isCurrentUser = entry.participantId === currentParticipantId;
        const medal = entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : null;

        return (
          <div
            key={entry.participantId}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-sm
              ${isCurrentUser ? "bg-blue-100 dark:bg-blue-900/30 font-semibold" : "bg-gray-50 dark:bg-gray-800"}
            `}
          >
            <span className="w-5 text-center">
              {medal || `#${entry.rank}`}
            </span>
            <span className="flex-1 truncate">{entry.displayName}</span>
            <span className="font-semibold tabular-nums">
              {entry.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

