"use client";

import { useEffect, useState } from "react";
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

  // Segment data management
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

  // Playback and map rendering
  const playback = useSegmentPlayback({
    mapId,
    segments,
    currentMap,
    currentSegmentLayers,
    setCurrentSegmentLayers,
    setActiveSegmentId,
    onSegmentSelect,
  });

  // CRUD handlers and dialogs
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

  // Load segments on mount
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

  // Drag and drop handler
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex((s) => s.segmentId === active.id);
      const newIndex = segments.findIndex((s) => s.segmentId === over.id);
      const newOrder = arrayMove(segments, oldIndex, newIndex);
      
      try {
        await reorder(newOrder);
      } catch (error) {
        console.error("Failed to reorder:", error);
      }
    }
  };

  // Camera capture handler
  const handleCaptureCamera = async (segment: Segment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available for capture");
      return;
    }
    
    if (typeof currentMap.getCenter !== 'function' || typeof currentMap.getZoom !== 'function') {
      console.error("❌ Invalid map instance - missing required methods");
      return;
    }
    
    try {
      const capturedState = getCurrentCameraState(currentMap);
      await updateCameraState(segment.segmentId, capturedState);
    } catch (error) {
      console.error("❌ Failed to capture camera:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800 flex-none w-[550px]">
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

      <SegmentList
        segments={segments as any}
        loading={loading}
        activeSegmentId={activeSegmentId}
        currentMap={currentMap}
        onSelect={(segment) => {
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
        onCloseLocationDialog={() => handlers.setShowLocationDialog(false)}
        onSaveLocation={handlers.handleAddLocation}
        confirmDelete={handlers.confirmDelete}
        onCloseConfirmDelete={() => handlers.setConfirmDelete(null)}
        onConfirmDelete={handlers.handleDeleteSegment}
        confirmDeleteZone={handlers.confirmDeleteZone}
        onCloseConfirmDeleteZone={() => handlers.setConfirmDeleteZone(null)}
        onConfirmDeleteZone={handlers.handleDeleteZone}
      />

      {showTransitionsDialog && (
        <TimelineTransitionsDialog
          mapId={mapId}
          segments={segments as any}
          onClose={() => setShowTransitionsDialog(false)}
        />
      )}

      {/* User Action Continue Button Overlay */}
      {playback.waitingForUserAction && playback.currentTransition && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 shadow-2xl max-w-md mx-4">
            {playback.currentTransition.showOverlay && playback.currentTransition.overlayContent && (
              <div className="mb-6 text-zinc-300 text-center">
                <div className="text-lg font-medium mb-2">
                  {playback.currentTransition.transitionName || "Transition"}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {playback.currentTransition.overlayContent}
                </div>
              </div>
            )}
            
            <button
              onClick={playback.handleContinueAfterUserAction}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              {playback.currentTransition.triggerButtonText || "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
