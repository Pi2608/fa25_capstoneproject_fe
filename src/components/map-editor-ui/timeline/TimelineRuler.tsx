"use client";

import { useMemo } from "react";
import type { Segment, RouteAnimation } from "@/lib/api-storymap";
import { RouteTimingBars } from "./RouteTimingBars";

interface TimelineRulerProps {
  totalDuration: number;
  zoomLevel: number;
  currentTime: number;
  isPlaying: boolean;
  isSingleSegmentPlaying?: boolean;
  segments?: Segment[];
  onRouteClick?: (route: RouteAnimation, segmentId: string) => void;
}

export function TimelineRuler({
  totalDuration,
  zoomLevel,
  currentTime,
  isPlaying,
  isSingleSegmentPlaying = false,
  segments = [],
  onRouteClick,
}: TimelineRulerProps) {
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = zoomLevel < 0.5 ? 10 : zoomLevel < 1 ? 5 : 2.5;

    for (let time = 0; time <= totalDuration; time += interval) {
      markers.push(time);
    }

    if (markers[markers.length - 1] < totalDuration) {
      markers.push(totalDuration);
    }

    return markers;
  }, [totalDuration, zoomLevel]);

  const pixelsPerSecond = zoomLevel * 50;
  const totalWidth = totalDuration * pixelsPerSecond;

  return (
    <div className="flex flex-col">
      {/* Time Ruler */}
      <div className="h-8 bg-zinc-900/50 border-b border-zinc-800 relative">
        <div
          className="absolute inset-0 flex pl-4"
          style={{ width: `${totalWidth}px` }}
        >
          {timeMarkers.map((time) => {
            const left = time * pixelsPerSecond;

            return (
              <div
                key={time}
                className="absolute flex flex-col items-center"
                style={{ left: `${left}px` }}
              >
                <div className="w-px h-2 bg-zinc-600" />
                <span className="text-[10px] text-zinc-500 mt-0.5 select-none">
                  {time.toFixed(1)}s
                </span>
              </div>
            );
          })}
        </div>

        {/* Hide playhead indicator during single segment play */}
        {!isSingleSegmentPlaying && (
          <div
            className={`absolute top-0 bottom-0 w-0.5 pointer-events-none z-10 transition-all duration-100 ${
              isPlaying
                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                : 'bg-blue-500 shadow-lg shadow-blue-500/50'
            }`}
            style={{ left: `${16 + currentTime * pixelsPerSecond}px` }}
          >
            <div className={`absolute -top-1 -left-1.5 w-3 h-3 rounded-full ${
              isPlaying ? 'bg-emerald-500' : 'bg-blue-500'
            }`} />
          </div>
        )}
      </div>

      {/* Route Timing Visualization */}
      {segments.length > 0 && (
        <RouteTimingBars
          segments={segments}
          pixelsPerSecond={pixelsPerSecond}
          currentTime={currentTime}
          onRouteClick={onRouteClick}
        />
      )}
    </div>
  );
}
