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
import { TimelineSegment } from "@/types/storymap";

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

  const handleViewSegment = useCallback(async (segment: TimelineSegment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    try {
      // Import Leaflet dynamically
      const L = (await import("leaflet")).default;

      // Clear previous visualization layers (optional)
      // Store layer references if you want to manage cleanup

      // 1. Fly to segment camera position if available
      if (segment.cameraState) {
        const camera = segment.cameraState;
        // Leaflet uses [lat, lng] format
        currentMap.flyTo(
          [camera.center[1], camera.center[0]], // [lat, lng]
          camera.zoom,
          {
            duration: 1.5,
            animate: true,
          }
        );
      }

      // 2. Render zones
      if (segment.zones && segment.zones.length > 0) {
        const allBounds: any[] = [];

        for (const segmentZone of segment.zones) {
          const zone = segmentZone.zone;
          if (!zone) continue;

          // Validate geometry exists and is not empty
          if (!zone.geometry || zone.geometry.trim() === '') {
            console.warn(`⚠️ Zone ${zone.zoneId} has no geometry`);
            continue;
          }

          try {
            let geoJsonData;
            try {
              geoJsonData = JSON.parse(zone.geometry);
            } catch (parseError) {
              console.error(`❌ Failed to parse geometry for zone ${zone.zoneId}:`, parseError);
              console.error("Geometry length:", zone.geometry?.length);
              console.error("Geometry preview:", zone.geometry?.substring(0, 200));
              continue;
            }

            // Create GeoJSON layer with Leaflet
            const geoJsonLayer = L.geoJSON(geoJsonData, {
              style: () => {
                const style: any = {};
                
                // Fill zone styling
                if (segmentZone.fillZone) {
                  style.fillColor = segmentZone.fillColor || '#FFD700';
                  style.fillOpacity = segmentZone.fillOpacity || 0.3;
                } else {
                  style.fillOpacity = 0;
                }

                // Boundary styling
                if (segmentZone.highlightBoundary) {
                  style.color = segmentZone.boundaryColor || '#FFD700';
                  style.weight = segmentZone.boundaryWidth || 2;
                } else {
                  style.weight = 0;
                }

                return style;
              },
            });

            // Add layer to map
            geoJsonLayer.addTo(currentMap);

            // Collect bounds for fitBounds
            const layerBounds = geoJsonLayer.getBounds();
            if (layerBounds.isValid()) {
              allBounds.push(layerBounds);
            }

            // Add label if enabled
            if (segmentZone.showLabel) {
              try {
                let labelPosition;
                
                // Try to get centroid from zone data
                if (zone.centroid) {
                  const centroid = JSON.parse(zone.centroid);
                  // GeoJSON Point format: [lng, lat]
                  labelPosition = [centroid.coordinates[1], centroid.coordinates[0]];
                } else {
                  // Fallback: use layer center
                  const center = layerBounds.getCenter();
                  labelPosition = [center.lat, center.lng];
                }

                // Create a marker with custom icon (text label)
                const labelMarker = L.marker(labelPosition as [number, number], {
                  icon: L.divIcon({
                    className: 'zone-label',
                    html: `<div style="
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 14px;
                      font-weight: 500;
                      white-space: nowrap;
                      border: 2px solid rgba(255, 255, 255, 0.8);
                    ">${segmentZone.labelOverride || zone.name}</div>`,
                    iconSize: undefined,
                  }),
                });
                labelMarker.addTo(currentMap);
              } catch (labelError) {
                console.error(`Failed to add label for zone ${zone.zoneId}:`, labelError);
              }
            }

          } catch (error) {
            console.error(`❌ Failed to render zone ${zone.zoneId}:`, error);
          }
        }

        // Fit bounds to show all zones
        if (allBounds.length > 0) {
          try {
            // Create a bounds that encompasses all zone bounds
            const combinedBounds = allBounds[0];
            for (let i = 1; i < allBounds.length; i++) {
              combinedBounds.extend(allBounds[i]);
            }
            
            currentMap.fitBounds(combinedBounds, {
              padding: [50, 50],
              animate: true,
              duration: 1.5,
            });
            console.log("📦 Fitted bounds to show all zones");
          } catch (error) {
            console.error("❌ Failed to fit bounds:", error);
          }
        }
      }

      // 3. TODO: Render layers when implemented
      // if (segment.layers && segment.layers.length > 0) { ... }

      // 4. TODO: Render locations/POIs when implemented
      // if (segment.locations && segment.locations.length > 0) { ... }

      console.log(`✅ Viewing segment: ${segment.name}`);
      
    } catch (error) {
      console.error("❌ Failed to view segment on map:", error);
    }
  }, [currentMap]);

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
                  onViewOnMap={handleViewSegment}
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
