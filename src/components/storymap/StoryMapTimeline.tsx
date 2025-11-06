"use client";

import { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useSegments } from "@/hooks/useSegments";
import { useSegmentHandlers } from "@/hooks/useSegmentHandlers";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import TimelineHeader from "@/components/storymap/TimelineHeader";
import SegmentList from "@/components/storymap/SegmentList";
import TimelineDialogs from "@/components/storymap/TimelineDialogs";
import { Segment, getCurrentCameraState } from "@/lib/api-storymap";

type Props = {
  mapId: string;
  currentMap?: any;
  onSegmentSelect?: (segment: Segment) => void;
};

export default function StoryMapTimeline({ mapId, currentMap, onSegmentSelect }: Props) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);

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
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      <TimelineHeader
        segments={segments}
        currentSegmentLayers={currentSegmentLayers}
        isPlaying={playback.isPlaying}
        currentPlayIndex={playback.currentPlayIndex}
        onPlayPreview={playback.handlePlayPreview}
        onStopPreview={playback.handleStopPreview}
        onClearMap={playback.handleClearMap}
        onCreateSegment={handlers.openCreateSegmentDialog}
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
    </div>
  );
}
