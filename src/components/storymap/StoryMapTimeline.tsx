"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getSegments,
  getSegmentZones,
  createSegment,
  updateSegment,
  deleteSegment,
  deleteSegmentZone,
  createSegmentZone,
  updateSegmentZone,
  getSegmentLayers,
  attachLayerToSegment,
  detachLayerFromSegment,
  getSegmentPois,
  type Segment,
  type SegmentZone,
  type SegmentLayer,
  type SegmentPoi,
} from "@/lib/api";
import type { GeoJsonObject } from "geojson";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type LayerLite = { id: string; name: string };

type Props = {
  mapId: string;
  layers?: LayerLite[];
  onZoomZone?: (zone: SegmentZone) => void;
};

type StoryElement = {
  id: string;
  type: "layer" | "poi";
  name: string;
  displayOrder: number;
  // Animation properties
  delayMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  startOpacity?: number;
  endOpacity?: number;
  easing?: string;
  autoPlayAnimation?: boolean;
  repeatCount?: number;
  // Reference
  layerId?: string;
  poiId?: string;
};

type TimelineSegment = Segment & {
  zones: (SegmentZone & { zoneType?: "area" | "line" | "point" })[];
  elements: StoryElement[];
  expanded: boolean;
  showElements: boolean;
};

// Sortable Segment Item
function SortableSegmentItem({ 
  segment, 
  onToggle,
  onToggleElements,
  onEdit,
  onDelete,
  onAddZone,
  onEditZone,
  onDeleteZone,
  onZoomZone,
  onAddLayer,
  onRemoveLayer,
  availableLayers,
}: { 
  segment: TimelineSegment;
  onToggle: (id: string) => void;
  onToggleElements: (id: string) => void;
  onEdit: (segment: Segment) => void;
  onDelete: (segment: Segment) => void;
  onAddZone: (segmentId: string) => void;
  onEditZone: (zone: SegmentZone) => void;
  onDeleteZone: (zone: SegmentZone) => void;
  onZoomZone?: (zone: SegmentZone) => void;
  onAddLayer: (segmentId: string, layerId: string) => void;
  onRemoveLayer: (segmentId: string, layerId: string, layerName: string) => void;
  availableLayers: LayerLite[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.segmentId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      {/* Segment Header */}
      <div className="bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
        <div className="flex items-center gap-2 p-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300"
            title="Kéo để sắp xếp"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => onToggle(segment.segmentId)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${segment.expanded ? 'rotate-90' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Segment Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">{segment.name}</div>
            {segment.summary && (
              <div className="text-xs text-zinc-400 truncate">{segment.summary}</div>
            )}
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs font-medium">
              {segment.zones.length} zones
            </div>
            <div className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs font-medium">
              {segment.elements.length} elements
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleElements(segment.segmentId)}
              className={`p-1.5 rounded ${segment.showElements ? 'bg-purple-600/20 text-purple-400' : 'hover:bg-zinc-700 text-zinc-400'}`}
              title="Show/Hide elements"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => onAddZone(segment.segmentId)}
              className="p-1.5 rounded hover:bg-zinc-700 text-emerald-400"
              title="Thêm zone"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => onEdit(segment)}
              className="p-1.5 rounded hover:bg-zinc-700 text-blue-400"
              title="Sửa segment"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(segment)}
              className="p-1.5 rounded hover:bg-zinc-700 text-red-400"
              title="Xóa segment"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Zones List */}
        {segment.expanded && segment.zones.length > 0 && (
          <div className="border-t border-zinc-700 bg-zinc-900/50">
            {segment.zones.map((zone, idx) => (
              <div
                key={zone.segmentZoneId}
                className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition-colors"
              >
                {/* Zone Order */}
                <div className="w-6 h-6 rounded bg-zinc-700 flex items-center justify-center text-xs text-zinc-400">
                  {idx + 1}
                </div>

                {/* Zone Type Icon */}
                <div className="text-zinc-500">
                  {zone.zoneType === 'area' && '🟦'}
                  {zone.zoneType === 'line' && '📏'}
                  {zone.zoneType === 'point' && '📍'}
                </div>

                {/* Zone Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{zone.name || 'Unnamed Zone'}</div>
                  {zone.description && (
                    <div className="text-xs text-zinc-500 truncate">{zone.description}</div>
                  )}
                </div>

                {/* Primary Badge */}
                {zone.isPrimary && (
                  <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 rounded text-xs">
                    Primary
                  </span>
                )}

                {/* Zone Actions */}
                <div className="flex items-center gap-1">
                  {onZoomZone && (
                    <button
                      onClick={() => onZoomZone(zone)}
                      className="p-1 rounded hover:bg-zinc-700 text-blue-400"
                      title="Zoom đến zone"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => onEditZone(zone)}
                    className="p-1 rounded hover:bg-zinc-700 text-emerald-400"
                    title="Sửa zone"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteZone(zone)}
                    className="p-1 rounded hover:bg-zinc-700 text-red-400"
                    title="Xóa zone"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {segment.expanded && segment.zones.length === 0 && (
          <div className="border-t border-zinc-700 p-4 text-center text-sm text-zinc-500">
            Chưa có zone nào. Click <span className="text-emerald-400">+</span> để thêm.
          </div>
        )}

        {/* Story Elements Section */}
        {segment.showElements && (
          <div className="border-t-2 border-purple-600/30 bg-zinc-900/70">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
                  ✨ Story Elements ({segment.elements.length})
                </div>
                <div className="flex gap-1">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddLayer(segment.segmentId, e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="text-xs bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-700"
                  >
                    <option value="">+ Layer</option>
                    {availableLayers
                      .filter(l => !segment.elements.some(el => el.layerId === l.id))
                      .map(layer => (
                        <option key={layer.id} value={layer.id}>{layer.name}</option>
                      ))
                    }
                  </select>
                  <button
                    className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded"
                    title="Add POI (Coming soon)"
                  >
                    + POI
                  </button>
                </div>
              </div>

              {segment.elements.length > 0 ? (
                <div className="space-y-2">
                  {segment.elements.map((element, idx) => (
                    <div
                      key={element.id}
                      className="bg-zinc-800/50 rounded-lg p-2 border border-zinc-700 hover:border-zinc-600"
                    >
                      {/* Element Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded bg-zinc-700 flex items-center justify-center text-xs text-zinc-400">
                          {idx + 1}
                        </div>
                        <div className="text-sm">
                          {element.type === "layer" ? "📦" : "📍"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {element.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {element.type === "layer" ? "Layer" : "POI"}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (element.layerId) {
                              onRemoveLayer(segment.segmentId, element.layerId, element.name);
                            }
                          }}
                          className="p-1 rounded hover:bg-zinc-700 text-red-400"
                          title="Remove"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Animation Settings */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-900/50 rounded p-2">
                        <div>
                          <div className="text-zinc-500 mb-1">⏱️ Delay</div>
                          <div className="text-white">{element.delayMs || 0}ms</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">📥 Fade In</div>
                          <div className="text-white">{element.fadeInMs || 400}ms</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">📤 Fade Out</div>
                          <div className="text-white">{element.fadeOutMs || 400}ms</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">🎯 Easing</div>
                          <div className="text-white">{element.easing || "EaseOut"}</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">👁️ Start → End</div>
                          <div className="text-white">
                            {(element.startOpacity || 0) * 100}% → {(element.endOpacity || 1) * 100}%
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">� Repeat</div>
                          <div className="text-white">
                            {element.repeatCount === 0 ? "∞" : element.repeatCount || 1}x
                          </div>
                        </div>
                      </div>

                      {/* Edit Animation Button */}
                      <button
                        className="w-full mt-2 text-xs px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded"
                        title="Edit animation settings"
                      >
                        ⚙️ Edit Animation
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-center text-zinc-600 italic py-4">
                  No elements yet. Add layers or POIs to this segment.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoryMapTimeline({ mapId, layers = [], onZoomZone }: Props) {
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dialog states
  const [segmentDialog, setSegmentDialog] = useState<{
    open: boolean;
    editing?: Segment;
  }>({ open: false });

  const [zoneDialog, setZoneDialog] = useState<{
    open: boolean;
    segmentId?: string;
    editing?: SegmentZone;
  }>({ open: false });

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: "segment" | "zone" | "element";
    itemId: string;
    itemName: string;
    segmentId?: string;
    layerId?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: "segment",
    itemId: "",
    itemName: "",
    onConfirm: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load segments and zones
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const segs = await getSegments(mapId);
      
      // Load zones, layers, and POIs for each segment
      const segsWithData = await Promise.all(
        segs.map(async (seg) => {
          const [zones, segLayers, pois] = await Promise.all([
            getSegmentZones(mapId, seg.segmentId),
            getSegmentLayers(mapId, seg.segmentId),
            getSegmentPois(mapId, seg.segmentId),
          ]);
          
          // Combine layers and POIs into story elements
          const elements: StoryElement[] = [
            ...segLayers.map((layer, idx): StoryElement => ({
              id: layer.segmentLayerId,
              type: "layer" as const,
              name: layers.find(l => l.id === layer.layerId)?.name || "Unknown Layer",
              displayOrder: layer.zIndex || idx,
              layerId: layer.layerId,
              // Default animation values
              delayMs: 0,
              fadeInMs: 400,
              fadeOutMs: 400,
              startOpacity: 0,
              endOpacity: 1,
              easing: "EaseOut",
              autoPlayAnimation: true,
              repeatCount: 1,
            })),
            ...pois.map((poi, idx): StoryElement => ({
              id: poi.poiId,
              type: "poi" as const,
              name: poi.title,
              displayOrder: poi.displayOrder || (segLayers.length + idx),
              poiId: poi.poiId,
              // Default animation values
              delayMs: 0,
              fadeInMs: 400,
              fadeOutMs: 400,
              startOpacity: 0,
              endOpacity: 1,
              easing: "EaseOut",
              autoPlayAnimation: true,
              repeatCount: 1,
            })),
          ].sort((a, b) => a.displayOrder - b.displayOrder);
          
          return {
            ...seg,
            zones,
            elements,
            expanded: false,
            showElements: false,
          };
        })
      );

      setSegments(segsWithData);
    } catch (error) {
      console.error("Failed to load story map data:", error);
    } finally {
      setLoading(false);
    }
  }, [mapId, layers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle segment expansion
  const toggleSegment = useCallback((id: string) => {
    setSegments((prev) =>
      prev.map((seg) =>
        seg.segmentId === id ? { ...seg, expanded: !seg.expanded } : seg
      )
    );
  }, []);

  // Toggle elements visibility
  const toggleElements = useCallback((id: string) => {
    setSegments((prev) =>
      prev.map((seg) =>
        seg.segmentId === id ? { ...seg, showElements: !seg.showElements } : seg
      )
    );
  }, []);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSegments((items) => {
        const oldIndex = items.findIndex((item) => item.segmentId === active.id);
        const newIndex = items.findIndex((item) => item.segmentId === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });

      // TODO: Call API to update segment order
    }

    setActiveId(null);
  };

  // Segment actions
  const handleCreateSegment = () => {
    setSegmentDialog({ open: true });
  };

  const handleEditSegment = (segment: Segment) => {
    setSegmentDialog({ open: true, editing: segment });
  };

  const handleDeleteSegment = (segment: Segment) => {
    setConfirmDialog({
      isOpen: true,
      type: "segment",
      itemId: segment.segmentId,
      itemName: segment.name || "Unnamed Segment",
      onConfirm: async () => {
        try {
          await deleteSegment(mapId, segment.segmentId);
          await loadData();
        } catch (error) {
          console.error("Failed to delete segment:", error);
          alert("Xóa segment thất bại!");
        }
      },
    });
  };

  const handleSaveSegment = async (data: { name: string; summary?: string }) => {
    try {
      if (segmentDialog.editing) {
        await updateSegment(mapId, segmentDialog.editing.segmentId, data);
      } else {
        await createSegment(mapId, data);
      }
      await loadData();
      setSegmentDialog({ open: false });
    } catch (error) {
      console.error("Failed to save segment:", error);
      alert("Lưu segment thất bại!");
    }
  };

  // Zone actions
  const handleAddZone = (segmentId: string) => {
    setZoneDialog({ open: true, segmentId });
  };

  const handleEditZone = (zone: SegmentZone) => {
    setZoneDialog({ open: true, editing: zone });
  };

  const handleDeleteZone = (zone: SegmentZone) => {
    setConfirmDialog({
      isOpen: true,
      type: "zone",
      itemId: zone.segmentZoneId,
      itemName: zone.name || "Unnamed Zone",
      segmentId: zone.segmentId,
      onConfirm: async () => {
        try {
          await deleteSegmentZone(mapId, zone.segmentId, zone.segmentZoneId);
          await loadData();
        } catch (error) {
          console.error("Failed to delete zone:", error);
          alert("Xóa zone thất bại!");
        }
      },
    });
  };

  const handleSaveZone = async (data: any) => {
    try {
      const segmentId = zoneDialog.segmentId || zoneDialog.editing?.segmentId;
      if (!segmentId) return;

      if (zoneDialog.editing) {
        await updateSegmentZone(mapId, segmentId, zoneDialog.editing.segmentZoneId, data);
      } else {
        await createSegmentZone(mapId, segmentId, data);
      }
      await loadData();
      setZoneDialog({ open: false });
    } catch (error) {
      console.error("Failed to save zone:", error);
      alert("Lưu zone thất bại!");
    }
  };

  // Layer actions
  const handleAddLayer = async (segmentId: string, layerId: string) => {
    try {
      await attachLayerToSegment(mapId, segmentId, { layerId, isVisible: true });
      await loadData();
    } catch (error) {
      console.error("Failed to add layer:", error);
      alert("Thêm layer thất bại!");
    }
  };

  const handleRemoveLayer = (segmentId: string, layerId: string, layerName: string) => {
    setConfirmDialog({
      isOpen: true,
      type: "element",
      itemId: layerId,
      itemName: layerName,
      segmentId: segmentId,
      layerId: layerId,
      onConfirm: async () => {
        try {
          await detachLayerFromSegment(mapId, segmentId, layerId);
          await loadData();
        } catch (error) {
          console.error("Failed to remove layer:", error);
          alert("Xóa layer thất bại!");
        }
      },
    });
  };

  const activeSegment = activeId ? segments.find(s => s.segmentId === activeId) : null;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-[420px] bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl z-[1000]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">Story Map Timeline</h2>
        </div>
        <button
          onClick={handleCreateSegment}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Segment
        </button>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2"></div>
              <div>Đang tải...</div>
            </div>
          </div>
        ) : segments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p className="mb-2">Chưa có segment nào</p>
              <button
                onClick={handleCreateSegment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
              >
                Tạo segment đầu tiên
              </button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={segments.map((s) => s.segmentId)}
              strategy={verticalListSortingStrategy}
            >
              {segments.map((segment) => (
                <SortableSegmentItem
                  key={segment.segmentId}
                  segment={segment}
                  onToggle={toggleSegment}
                  onToggleElements={toggleElements}
                  onEdit={handleEditSegment}
                  onDelete={handleDeleteSegment}
                  onAddZone={handleAddZone}
                  onEditZone={handleEditZone}
                  onDeleteZone={handleDeleteZone}
                  onZoomZone={onZoomZone}
                  onAddLayer={handleAddLayer}
                  onRemoveLayer={handleRemoveLayer}
                  availableLayers={layers}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeSegment ? (
                <div className="bg-zinc-800 rounded-lg border-2 border-emerald-500 p-3 shadow-2xl opacity-90">
                  <div className="font-medium text-white">{activeSegment.name}</div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      {segmentDialog.open && (
        <SegmentDialog
          editing={segmentDialog.editing}
          onClose={() => setSegmentDialog({ open: false })}
          onSave={handleSaveSegment}
        />
      )}

      {zoneDialog.open && (
        <ZoneDialog
          editing={zoneDialog.editing}
          onClose={() => setZoneDialog({ open: false })}
          onSave={handleSaveZone}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={
          confirmDialog.type === "segment" ? "Delete Segment" :
          confirmDialog.type === "zone" ? "Delete Zone" :
          "Remove Element"
        }
        message={
          confirmDialog.type === "segment" ? "Are you sure you want to delete this segment? All zones and elements will be lost." :
          confirmDialog.type === "zone" ? "Are you sure you want to delete this zone?" :
          "Are you sure you want to remove this element from the segment?"
        }
        itemName={confirmDialog.itemName}
        variant="danger"
      />
    </div>
  );
}

// Simple Dialogs
function SegmentDialog({
  editing,
  onClose,
  onSave,
}: {
  editing?: Segment;
  onClose: () => void;
  onSave: (data: { name: string; summary?: string }) => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [summary, setSummary] = useState(editing?.summary || "");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10003]">
      <div className="bg-zinc-900 rounded-lg w-[420px] shadow-2xl border border-zinc-800">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Sửa Segment" : "Tạo Segment mới"}
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tên Segment</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="VD: Khám phá Quận 1"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Mô tả (tùy chọn)</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Mô tả ngắn gọn..."
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onSave({ name, summary });
              }
            }}
            disabled={!name.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {editing ? "Lưu" : "Tạo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoneDialog({
  editing,
  onClose,
  onSave,
}: {
  editing?: SegmentZone & { zoneType?: "area" | "line" | "point" };
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [zoneType, setZoneType] = useState<"Area" | "Line" | "Point">(
    editing?.zoneType ? 
      (editing.zoneType.charAt(0).toUpperCase() + editing.zoneType.slice(1) as "Area" | "Line" | "Point") 
      : "Area"
  );
  const [isPrimary, setIsPrimary] = useState(editing?.isPrimary || false);
  const [geometry, setGeometry] = useState(editing?.zoneGeometry ? 
    (typeof editing.zoneGeometry === 'string' ? JSON.parse(editing.zoneGeometry) : editing.zoneGeometry) 
    : null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setGeometry(json);
    } catch {
      alert("File không hợp lệ!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10003]">
      <div className="bg-zinc-900 rounded-lg w-[480px] shadow-2xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Sửa Zone" : "Tạo Zone mới"}
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tên Zone</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="VD: Vùng trung tâm"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Loại Zone</label>
            <select
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value as "Area" | "Line" | "Point")}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Area">Khu vực (Polygon)</option>
              <option value="Line">Đường (LineString)</option>
              <option value="Point">Điểm (Point)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded"
            />
            Là Zone chính
          </label>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">GeoJSON</label>
            <input
              type="file"
              accept=".json,.geojson"
              onChange={handleFileUpload}
              className="text-xs text-zinc-400 mb-2"
            />
            <textarea
              value={geometry ? JSON.stringify(geometry, null, 2) : ""}
              onChange={(e) => {
                try {
                  setGeometry(e.target.value ? JSON.parse(e.target.value) : null);
                } catch {}
              }}
              rows={4}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Dán GeoJSON..."
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onSave({
                  name,
                  description,
                  zoneType,
                  isPrimary,
                  zoneGeometry: geometry ? JSON.stringify(geometry) : "",
                });
              }
            }}
            disabled={!name.trim() || !geometry}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {editing ? "Lưu" : "Tạo"}
          </button>
        </div>
      </div>
    </div>
  );
}
