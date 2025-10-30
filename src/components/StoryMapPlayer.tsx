"use client";

import { useState, useEffect } from "react";
import { getSegments, type Segment } from "@/lib/api";

interface StoryMapPlayerProps {
  mapId: string;
}

export default function StoryMapPlayer({ mapId }: StoryMapPlayerProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSegments(mapId);
        setSegments(data);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load segments:", error);
        setLoading(false);
      }
    })();
  }, [mapId]);

  const handlePlay = () => {
    setIsPlaying(true);
    // TODO: Implement auto-advance logic
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handlePrevious = () => {
    setCurrentSegment(Math.max(0, currentSegment - 1));
  };

  const handleNext = () => {
    setCurrentSegment(Math.min(segments.length - 1, currentSegment + 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 backdrop-blur">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Đang tải Story Map...</p>
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 backdrop-blur">
        <p className="text-white">Story Map chưa có segments nào.</p>
      </div>
    );
  }

  const current = segments[currentSegment];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[3000] pointer-events-none">
      <div className="pointer-events-auto bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="max-w-4xl mx-auto">
          {/* Segment Content */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-blue-400 font-medium">
                Segment {currentSegment + 1} of {segments.length}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{current?.name || "Untitled Segment"}</h2>
            {current?.summary && (
              <p className="text-gray-300 text-sm">{current.summary}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentSegment === 0}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-md text-white transition-colors"
              >
                ← Previous
              </button>

              <button
                onClick={isPlaying ? handlePause : handlePlay}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white font-medium transition-colors"
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>

              <button
                onClick={handleNext}
                disabled={currentSegment === segments.length - 1}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-md text-white transition-colors"
              >
                Next →
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 max-w-xs">
              <div className="flex gap-1">
                {segments.map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      idx === currentSegment
                        ? "bg-blue-500"
                        : idx < currentSegment
                        ? "bg-blue-700"
                        : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

