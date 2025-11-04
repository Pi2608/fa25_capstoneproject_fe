"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentDialog from "@/components/storymap/dialogs/SegmentDialog";
import SelectZoneDialog from "@/components/storymap/dialogs/SelectZoneDialog";
import SortableSegmentItem from "@/components/storymap/items/SortableSegmentItem";
import { useSegments } from "@/hooks/useSegments";
import { 
  Segment, 
  SegmentZone,
  CreateSegmentRequest,
  CreateSegmentZoneRequest,
  getCurrentCameraState,
} from "@/lib/api-storymap";

type Props = {
  mapId: string;
  currentMap?: any; // Mapbox map instance
  onSegmentSelect?: (segment: Segment) => void;
};

// ==================== MAIN COMPONENT ====================
export default function StoryMapTimeline({ mapId, currentMap, onSegmentSelect }: Props) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Dialogs
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | undefined>();
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<SegmentZone | null>(null);

  // Drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Use custom hook for segments management
  const {
    segments,
    loading,
    loadSegments,
    addSegment,
    editSegment,
    removeSegment,
    addZoneToSegment,
    removeZoneFromSegment,
    reorder,
    toggleExpanded,
    updateCameraState,
  } = useSegments(mapId);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);


  // Handlers
  const handleCreateSegment = async (data: CreateSegmentRequest) => {
    try {
      await addSegment(data);
      setShowSegmentDialog(false);
    } catch (error) {
      console.error("Failed to create segment:", error);
    }
  };

  const handleUpdateSegment = async (data: CreateSegmentRequest) => {
    if (!editingSegment) return;
    try {
      await editSegment(editingSegment.segmentId, data);
      setShowSegmentDialog(false);
      setEditingSegment(undefined);
    } catch (error) {
      console.error("Failed to update segment:", error);
    }
  };

  const handleDeleteSegment = async () => {
    if (!confirmDelete) return;
    try {
      await removeSegment(confirmDelete.segmentId);
      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete segment:", error);
    }
  };

  const handleAddZone = async (data: CreateSegmentZoneRequest) => {
    try {
      await addZoneToSegment(data);
      setShowZoneDialog(false);
    } catch (error) {
      console.error("Failed to add zone:", error);
    }
  };

  const handleDeleteZone = async () => {
    if (!confirmDeleteZone) return;
    try {
      await removeZoneFromSegment(confirmDeleteZone.segmentId, confirmDeleteZone.zoneId);
      setConfirmDeleteZone(null);
    } catch (error) {
      console.error("Failed to delete zone:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
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

  const handleCaptureCamera = async (segment: Segment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available for capture");
      return;
    }
    
    // Validate map instance
    if (typeof currentMap.getCenter !== 'function' || typeof currentMap.getZoom !== 'function') {
      console.error("❌ Invalid map instance - missing required methods");
      return;
    }
    
    try {
      const capturedState = getCurrentCameraState(currentMap);
      
      await updateCameraState(segment.segmentId, capturedState);
    } catch (error) {
      console.error("❌ Failed to capture camera:", error);
      console.error("Map instance:", currentMap);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <button
            onClick={() => {
              setEditingSegment(undefined);
              setShowSegmentDialog(true);
            }}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm"
          >
            + Segment
          </button>
        </div>
      </div>

      {/* Segment list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-zinc-500 py-8">Loading...</div>
        ) : segments.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">No segments yet</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segments.map(s => s.segmentId)} strategy={verticalListSortingStrategy}>
              {segments.map((segment) => (
                <SortableSegmentItem
                  key={segment.segmentId}
                  segment={segment}
                  isActive={activeSegmentId === segment.segmentId}
                  onSelect={() => {
                    setActiveSegmentId(segment.segmentId);
                    onSegmentSelect?.(segment);
                  }}
                  onToggle={toggleExpanded}
                  onEdit={(seg) => {
                    setEditingSegment(seg);
                    setShowSegmentDialog(true);
                  }}
                  onDelete={(seg) => setConfirmDelete(seg)}
                  onAddZone={(segId) => {
                    setTargetSegmentId(segId);
                    setShowZoneDialog(true);
                  }}
                  onDeleteZone={(zone) => setConfirmDeleteZone(zone)}
                  onCaptureCamera={handleCaptureCamera}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      {showSegmentDialog && (
        <SegmentDialog
          editing={editingSegment}
          currentMap={currentMap}
          onClose={() => {
            setShowSegmentDialog(false);
            setEditingSegment(undefined);
          }}
          onSave={editingSegment ? handleUpdateSegment : handleCreateSegment}
        />
      )}

      {showZoneDialog && (
        <SelectZoneDialog
          segmentId={targetSegmentId}
          onClose={() => setShowZoneDialog(false)}
          onSave={handleAddZone}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteSegment}
        title="Delete Segment"
        message={confirmDelete ? `Delete "${confirmDelete.name}"?` : ""}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteZone}
        onClose={() => setConfirmDeleteZone(null)}
        onConfirm={handleDeleteZone}
        title="Remove Zone"
        message="Remove this zone from segment?"
        variant="warning"
      />
    </div>
  );
}
