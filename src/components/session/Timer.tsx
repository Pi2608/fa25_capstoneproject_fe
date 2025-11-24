"use client";

import { useEffect, useState, useCallback } from "react";

interface TimerProps {
  timeLimit: number; // Total time in seconds
  startTime?: string; // ISO timestamp when timer started
  onTimeUp?: () => void;
  onTick?: (remaining: number) => void;
  isPaused?: boolean;
  className?: string;
}

export function Timer({
  timeLimit,
  startTime,
  onTimeUp,
  onTick,
  isPaused = false,
  className = "",
}: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isActive, setIsActive] = useState(false);

  // Calculate time remaining based on start time
  const calculateTimeRemaining = useCallback(() => {
    if (!startTime) return timeLimit;

    const start = new Date(startTime).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = Math.max(0, timeLimit - elapsed);

    return remaining;
  }, [startTime, timeLimit]);

  // Initialize and sync timer
  useEffect(() => {
    if (startTime) {
      setIsActive(true);
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0 && onTimeUp) {
        onTimeUp();
      }
    } else {
      setIsActive(false);
      setTimeRemaining(timeLimit);
    }
  }, [startTime, timeLimit, calculateTimeRemaining, onTimeUp]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (onTick) {
        onTick(remaining);
      }

      if (remaining <= 0) {
        setIsActive(false);
        if (onTimeUp) {
          onTimeUp();
        }
      }
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [isActive, isPaused, calculateTimeRemaining, onTick, onTimeUp]);

  const progress = (timeRemaining / timeLimit) * 100;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);

  // Color coding based on time remaining
  const getTimerColor = () => {
    if (progress > 50) return "text-green-600";
    if (progress > 20) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = () => {
    if (progress > 50) return "bg-green-500";
    if (progress > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Timer Display */}
      <div
        className={`text-6xl font-bold tabular-nums ${getTimerColor()} transition-colors`}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getProgressColor()} transition-all duration-300 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status Text */}
      {isPaused && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          ⏸️ Paused
        </div>
      )}
      {!isActive && timeRemaining <= 0 && (
        <div className="text-sm text-red-500">⏰ Time&apos;s Up!</div>
      )}
    </div>
  );
}

// Compact timer for small spaces (e.g., leaderboard header)
export function CompactTimer({
  timeLimit,
  startTime,
  isPaused = false,
  className = "",
}: Omit<TimerProps, "onTimeUp" | "onTick">) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);

  useEffect(() => {
    if (!startTime || isPaused) {
      setTimeRemaining(timeLimit);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, timeLimit, isPaused]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const progress = (timeRemaining / timeLimit) * 100;

  const getColor = () => {
    if (progress > 50) return "text-green-600";
    if (progress > 20) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 ${className}`}
    >
      <span className="text-lg">⏱️</span>
      <span className={`font-mono font-semibold ${getColor()}`}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

