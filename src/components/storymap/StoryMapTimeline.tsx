"use client";

import { useEffect, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useSegments } from "@/hooks/useSegments";
import { useSegmentHandlers } from "@/hooks/useSegmentHandlers";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import TimelineHeader from "@/components/storymap/TimelineHeader";
import SegmentList from "@/components/storymap/SegmentList";
import TimelineDialogs from "@/components/storymap/TimelineDialogs";
import TimelineTransitionsDialog from "@/components/storymap/dialogs/TimelineTransitionsDialog";
import { Segment, getCurrentCameraState } from "@/lib/api-storymap";

type Props = {
  mapId: string;
  currentMap?: any;
  onSegmentSelect?: (segment: Segment) => void;
};

export default function StoryMapTimeline({ mapId, currentMap, onSegmentSelect }: Props) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [showTransitionsDialog, setShowTransitionsDialog] = useState(false);

  const {
    segments,
    loading,
    loadSegments,
    addSegment,
    editSegment,
    removeSegment,
    reorder,
    toggleExpanded,
    updateCameraState,
    updateSegmentsState,
  } = useSegments(mapId);

  const playback = useSegmentPlayback({
    mapId,
    segments,
    currentMap,
    currentSegmentLayers,
    setCurrentSegmentLayers,
    setActiveSegmentId,
    onSegmentSelect,
  });

  const handlers = useSegmentHandlers({
    mapId,
    segments: segments as any,
    activeSegmentId,
    updateSegmentsState: updateSegmentsState as any,
    addSegment,
    editSegment,
    removeSegment,
    onViewSegment: playback.handleViewSegment as any,
  });

  const [bodyHeight, setBodyHeight] = useState<number>(170);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(170);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await loadSegments();
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [loadSegments]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY;
      const next = Math.min(Math.max(startHeightRef.current + delta, 90), 420);
      setBodyHeight(next);
    };
    const handleUp = () => {
      setIsResizing(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = bodyHeight;
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex(s => s.segmentId === active.id);
      const newIndex = segments.findIndex(s => s.segmentId === over.id);
      const newOrder = arrayMove(segments, oldIndex, newIndex);
      try {
        await reorder(newOrder);
      } catch (error) {
        console.error("Failed to reorder:", error);
      }
    }
  };

  const handleCaptureCamera = async (segment: Segment) => {
    if (!currentMap) {
      console.warn("No map instance available for capture");
      return;
    }
    if (typeof currentMap.getCenter !== "function" || typeof currentMap.getZoom !== "function") {
      console.error("Invalid map instance - missing required methods");
      return;
    }
    try {
      const capturedState = getCurrentCameraState(currentMap);
      await updateCameraState(segment.segmentId, capturedState);
    } catch (error) {
      console.error("Failed to capture camera:", error);
    }
  };

  const segmentCount = segments.length;
  const isPlaying = playback.isPlaying;

  return (
    <>
      <div className="w-full px-4 pb-3 pt-1 pointer-events-auto">
        <div className="mr-24 border-t border-zinc-800/80 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-900 rounded-t-3xl shadow-[0_-14px_40px_rgba(0,0,0,0.85)] flex flex-col transition-all duration-300">
          <div
            className="flex items-center justify-center pt-0.5"
            onMouseDown={handleResizeStart}
          >
            <div className="h-1 w-20 cursor-row-resize rounded-full bg-zinc-600/80 hover:bg-zinc-300/90" />
          </div>

          <div className="px-5 pt-1 pb-1.5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-emerald-400 tracking-[0.22em] uppercase">
                  Storymap timeline
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {segmentCount === 0 ? "No segments" : `${segmentCount} segment${segmentCount > 1 ? "s" : ""}`}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "bg-sky-400" : "bg-zinc-600"}`} />
                    {isPlaying ? "Preview playing" : "Preview paused"}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center">
                  <div className="flex-1">
                    <TimelineHeader
                      segments={segments}
                      currentSegmentLayers={currentSegmentLayers}
                      isPlaying={playback.isPlaying}
                      currentPlayIndex={playback.currentPlayIndex}
                      onPlayPreview={playback.handlePlayPreview}
                      onStopPreview={playback.handleStopPreview}
                      onClearMap={playback.handleClearMap}
                      onCreateSegment={handlers.openCreateSegmentDialog}
                      onOpenTransitions={() => setShowTransitionsDialog(true)}
                    />
                  </div>
                </div>

                {/* Thông báo khi đang chờ chọn vị trí */}
                {handlers.waitingForLocation && (
                  <div className="mt-2 ml-5 mr-5 bg-blue-900/20 border border-blue-500/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-blue-300 text-xs font-medium">
                          Vui lòng chọn một địa điểm trên bản đồ
                        </p>
                        <p className="text-blue-400 text-[10px] mt-0.5">
                          Click vào bất kỳ đâu trên bản đồ để đặt Location
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          handlers.setShowLocationDialog(false);
                          handlers.setWaitingForLocation(false);
                        }}
                        className="flex-shrink-0 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                        title="Hủy"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="w-16 flex-shrink-0" />
            </div>
          </div>

          <div className="relative border-t border-zinc-800/70">
            <div className="h-[2px] bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-fuchsia-500/40 mx-5 rounded-b-full" />
            <div
              className="relative overflow-y-auto px-4 pb-2 pt-1.5"
              style={{ height: bodyHeight }}
            >
              <SegmentList
                segments={segments as any}
                loading={loading}
                activeSegmentId={activeSegmentId}
                currentMap={currentMap}
                onSelect={segment => {
                  setActiveSegmentId(segment.segmentId);
                  onSegmentSelect?.(segment);
                }}
                onToggle={toggleExpanded}
                onEdit={handlers.openEditSegmentDialog}
                onDelete={handlers.openDeleteSegmentDialog}
                onAddZone={handlers.openAddZoneDialog}
                onDeleteZone={handlers.openDeleteZoneDialog}
                onAddLayer={handlers.openAddLayerDialog}
                onDeleteLayer={handlers.handleDeleteLayer}
                onAddLocation={handlers.openAddLocationDialog}
                onDeleteLocation={handlers.handleDeleteLocation}
                onCaptureCamera={handleCaptureCamera}
                onViewOnMap={playback.handleViewSegment as any}
                onDragEnd={handleDragEnd}
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-zinc-950/95 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-zinc-950/95 to-transparent" />
            </div>
          </div>

          <TimelineDialogs
            currentMap={currentMap}
            showSegmentDialog={handlers.showSegmentDialog}
            editingSegment={handlers.editingSegment}
            onCloseSegmentDialog={() => handlers.setShowSegmentDialog(false)}
            onSaveSegment={handlers.editingSegment ? handlers.handleUpdateSegment : handlers.handleCreateSegment}
            showZoneDialog={handlers.showZoneDialog}
            targetSegmentId={handlers.targetSegmentId}
            onCloseZoneDialog={() => handlers.setShowZoneDialog(false)}
            onSaveZone={handlers.handleAddZone}
            showLayerDialog={handlers.showLayerDialog}
            onCloseLayerDialog={() => handlers.setShowLayerDialog(false)}
            onSaveLayer={handlers.handleAddLayer}
            showLocationDialog={handlers.showLocationDialog}
            onCloseLocationDialog={() => {
              handlers.setShowLocationDialog(false);
              handlers.setWaitingForLocation(false);
            }}
            onSaveLocation={handlers.handleAddLocation}
            onWaitingStateChange={(waiting) => handlers.setWaitingForLocation(waiting)}
            confirmDelete={handlers.confirmDelete}
            onCloseConfirmDelete={() => handlers.setConfirmDelete(null)}
            onConfirmDelete={handlers.handleDeleteSegment}
            confirmDeleteZone={handlers.confirmDeleteZone}
            onCloseConfirmDeleteZone={() => handlers.setConfirmDeleteZone(null)}
            onConfirmDeleteZone={handlers.handleDeleteZone}
          />
        </div>
      </div>

      {showTransitionsDialog && (
        <TimelineTransitionsDialog
          mapId={mapId}
          segments={segments as any}
          onClose={() => setShowTransitionsDialog(false)}
        />
      )}

      {playback.waitingForUserAction && playback.currentTransition && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-8 py-6 shadow-2xl max-w-md mx-4">
            {playback.currentTransition.showOverlay && playback.currentTransition.overlayContent && (
              <div className="mb-5 text-zinc-100 text-center">
                <div className="text-lg font-semibold mb-1">
                  {playback.currentTransition.transitionName || "Transition"}
                </div>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {playback.currentTransition.overlayContent}
                </div>
              </div>
            )}
            <button
              onClick={playback.handleContinueAfterUserAction}
              className="w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 active:from-sky-600 active:to-emerald-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              {playback.currentTransition.triggerButtonText || "Continue"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
