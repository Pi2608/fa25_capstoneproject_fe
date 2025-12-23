"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { Segment, TimelineTransition } from "@/lib/api-storymap";
import { TimelineRuler } from "./timeline/TimelineRuler";
import { TimelineTrack } from "./timeline/TimelineTrack";
import { calculateTotalTimelineDuration } from "@/utils/segmentTiming";
import { useI18n } from "@/i18n/I18nProvider";

interface TimelineWorkspaceProps {
  segments: Segment[];
  transitions: TimelineTransition[];
  activeSegmentId: string | null;
  isPlaying?: boolean;
  isSingleSegmentPlaying?: boolean;
  currentTime?: number;
  leftOffset?: number; // Offset from left for VSCode-style sidebar
  isOpen?: boolean;
  mapId?: string;
  onToggle?: () => void;
  onReorder: (newOrder: Segment[]) => void;
  onPlay: () => void;
  onStop: () => void;
  onSegmentClick: (segmentId: string) => void;
  onPlaySingleSegment?: (segmentId: string) => void;
  onRefreshSegments?: () => void;
}

export function TimelineWorkspace({
  segments,
  transitions,
  activeSegmentId,
  isPlaying = false,
  isSingleSegmentPlaying = false,
  currentTime = 0,
  leftOffset = 0,
  isOpen = true,
  mapId,
  onToggle,
  onReorder,
  onPlay,
  onStop,
  onSegmentClick,
  onPlaySingleSegment,
  onRefreshSegments,
}: TimelineWorkspaceProps) {
  const { t } = useI18n();
  const [height, setHeight] = useState(280); // Default height - increased to show all tracks
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%
  const [isResizing, setIsResizing] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // FIXED: Calculate total duration including route animations
  // Use calculateTotalTimelineDuration helper to account for routes that extend beyond segment duration
  const totalDuration = calculateTotalTimelineDuration(segments) / 1000; // Convert to seconds

  // Resize handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const newHeight = Math.min(400, Math.max(120, startHeight + deltaY));

        if (workspaceRef.current) {
          gsap.to(workspaceRef.current, {
            height: newHeight,
            duration: 0.1,
            ease: "power1.out",
          });
        }
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height]
  );

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // If not open, show a small toggle button at the bottom
  if (!isOpen) {
    return (
      <div
        className="fixed bottom-0 right-0 bg-zinc-950/98 backdrop-blur-lg border-t border-zinc-800 z-[1500] transition-all duration-300"
        style={{ height: "40px", left: `${leftOffset}px` }}
      >
        <button
          onClick={onToggle}
          className="h-full w-full flex items-center justify-center gap-2 hover:bg-zinc-800/50 transition-colors"
        >
          <Icon icon="mdi:chevron-up" className="w-5 h-5 text-zinc-400" />
          <span className="text-sm text-zinc-400">{t('mapEditor', 'timeline')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={workspaceRef}
      className="fixed bottom-0 right-0 bg-zinc-950/98 backdrop-blur-lg border-t border-zinc-800 z-[1500] transition-all duration-300"
      style={{ height: `${height}px`, left: `${leftOffset}px` }}
    >
      {/* Resize Handle */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 cursor-ns-resize transition-colors group",
          isResizing && "bg-emerald-500/50"
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-700 group-hover:bg-emerald-500/50 rounded-b transition-colors" />
      </div>

      {/* Header Controls */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPlay}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
            title={isPlaying ? t('mapEditor', 'timelinePause') : t('mapEditor', 'timelinePlay')}
          >
            <Icon
              icon={isPlaying ? "mdi:pause" : "mdi:play"}
              className="w-5 h-5 text-zinc-300"
            />
          </button>
          <button
            onClick={onStop}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
            title={t('mapEditor', 'timelineStop')}
          >
            <Icon icon="mdi:stop" className="w-5 h-5 text-zinc-300" />
          </button>
          <div className="ml-2 text-sm text-zinc-400 font-mono">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
        </div>

        {/* Center: Timeline Title */}
        <div className="flex items-center gap-2">
          <Icon icon="mdi:timeline-outline" className="w-5 h-5 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">{t('mapEditor', 'timeline')}</span>
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
            {t('mapEditor', 'timelineSegments', { count: segments.length })}
          </span>
        </div>

        {/* Right: Zoom Controls (Integrated & Smaller) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{t('mapEditor', 'timelineZoom')}</span>
          <button
            onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.1))}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title={t('mapEditor', 'timelineZoomOut')}
          >
            <Icon icon="mdi:magnify-minus-outline" className="w-4 h-4 text-zinc-400" />
          </button>
          <span className="text-xs text-zinc-400 w-12 text-center font-mono">
            {(zoomLevel * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(2, prev + 0.1))}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title={t('mapEditor', 'timelineZoomIn')}
          >
            <Icon icon="mdi:magnify-plus-outline" className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title={t('mapEditor', 'timelineZoomReset')}
          >
            <Icon icon="mdi:fit-to-screen-outline" className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Close button */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors ml-2"
              title={t('mapEditor', 'timelineClose')}
            >
              <Icon icon="mdi:chevron-down" className="w-5 h-5 text-zinc-300" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto scrollbar-dark h-[calc(100%-48px)]"
      >
        <div className="min-w-max">
          <TimelineRuler
            totalDuration={totalDuration}
            zoomLevel={zoomLevel}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isSingleSegmentPlaying={isSingleSegmentPlaying}
            segments={segments}
            onRouteClick={(route, segmentId) => {
              // Dispatch event to show route form in LeftSidebarToolbox
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('editRoute', {
                  detail: {
                    route,
                    segmentId,
                    mapId
                  }
                }));
              }
            }}
          />
          <TimelineTrack
            segments={segments}
            transitions={transitions}
            activeSegmentId={activeSegmentId}
            zoomLevel={zoomLevel}
            mapId={mapId}
            isPlaying={isPlaying}
            onReorder={onReorder}
            onSegmentClick={onSegmentClick}
            onPlaySingleSegment={onPlaySingleSegment}
            onRefreshSegments={onRefreshSegments}
          />
        </div>
      </div>
    </div>
  );
}
