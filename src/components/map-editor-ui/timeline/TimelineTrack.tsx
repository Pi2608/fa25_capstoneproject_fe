"use client";

import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../Icon";
import { cn } from "@/lib/utils";
import type { Segment, TimelineTransition, RouteAnimation, Location, SegmentZone, SegmentLayer } from "@/lib/api-storymap";
import { getRouteAnimationsBySegment, deleteRouteAnimation, deleteLocation, deleteSegmentZone, detachLayerFromSegment, reorderSegments, moveLocationToSegment, moveZoneToSegment, moveLayerToSegment, moveRouteToSegment, updateLocation } from "@/lib/api-storymap";
import RouteAnimationDialog from "@/components/storymap/RouteAnimationDialog";
import LocationDialog from "@/components/storymap/LocationDialog";

interface TimelineTrackProps {
  segments: Segment[];
  transitions: TimelineTransition[];
  activeSegmentId: string | null;
  zoomLevel: number;
  mapId?: string;
  currentMap?: any;
  onReorder: (newOrder: Segment[]) => void;
  onSegmentClick: (segmentId: string) => void;
  onRefreshSegments?: () => void;
  onAddLocation?: (segmentId: string) => void;
  onAddZone?: (segmentId: string) => void;
  onAddLayer?: (segmentId: string) => void;
  onAddRouteAnimation?: (segmentId: string) => void;
}

export function TimelineTrack({
  segments,
  transitions,
  activeSegmentId,
  zoomLevel,
  mapId,
  currentMap,
  onReorder,
  onSegmentClick,
  onAddLocation,
  onAddZone,
  onAddLayer,
  onAddRouteAnimation,
  onRefreshSegments,
}: TimelineTrackProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: string; id: string; segmentId: string } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: string; name: string } | null>(null);

  const handleDragStart = (event: any) => {
    const itemId = event.active.id as string;
    setActiveId(itemId);
    
    // Parse drag ID format: "{type}__|__{segmentId}__|__{itemId}"
    // Using __|__ as delimiter to avoid conflicts with GUID dashes
    const parts = itemId.split("__|__");
    if (parts.length === 3) {
      const type = parts[0];
      const segmentId = parts[1];
      const actualItemId = parts[2];
      
      setDraggedItem({ 
        type: type as "location" | "zone" | "route" | "layer", 
        id: actualItemId, 
        segmentId 
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) {
      setDraggedItem(null);
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Handle segment reordering
    if (activeId.startsWith("segment-") && overId.startsWith("segment-")) {
      const oldIndex = segments.findIndex((s) => s.segmentId === activeId.replace("segment-", ""));
      const newIndex = segments.findIndex((s) => s.segmentId === overId.replace("segment-", ""));

      if (oldIndex !== newIndex && mapId) {
      const newOrder = arrayMove(segments, oldIndex, newIndex);
        try {
          // Call API to reorder segments
          const segmentIds = newOrder.map(s => s.segmentId);
          await reorderSegments(mapId, segmentIds);
      onReorder(newOrder);
        } catch (error) {
          console.error("Failed to reorder segments:", error);
          alert("Failed to reorder segments");
        }
      }
    }
    // Handle item moving between segments
    else if (draggedItem && overId.startsWith("drop-")) {
      // Parse drop zone: "drop-{trackType}__|__{segmentId}"
      const dropParts = overId.replace("drop-", "").split("__|__");
      
      if (dropParts.length === 2) {
        const trackType = dropParts[0];
        const targetSegmentId = dropParts[1];
        
        // Validate: only allow drop to same track type (handle zone/layer special case)
        const isValidDrop = 
          draggedItem.type === trackType || 
          (trackType === "zone" && (draggedItem.type === "zone" || draggedItem.type === "layer"));
        
        if (!isValidDrop) {
          alert(`Cannot drop ${draggedItem.type} into ${trackType} track. Please drop into the correct track.`);
          setDraggedItem(null);
          return;
        }
        
        if (draggedItem.segmentId && draggedItem.segmentId !== targetSegmentId && mapId) {
          // Move item to new segment
          const targetSegment = segments.find(s => s.segmentId === targetSegmentId);
          const confirmed = window.confirm(
            `Move ${draggedItem.type} to segment "${targetSegment?.name || targetSegmentId}"?`
          );
          
          if (confirmed) {
            setIsMoving(true);
            const itemName = draggedItem.type === "location" 
              ? segments.find(s => s.segmentId === draggedItem.segmentId)?.locations?.find(l => l.locationId === draggedItem.id)?.title || "Location"
              : draggedItem.type === "route"
              ? segments.find(s => s.segmentId === draggedItem.segmentId)?.routeAnimations?.find(r => r.routeAnimationId === draggedItem.id)?.fromName || "Route"
              : draggedItem.type === "zone"
              ? segments.find(s => s.segmentId === draggedItem.segmentId)?.zones?.find(z => z.segmentZoneId === draggedItem.id)?.zone?.name || "Zone"
              : segments.find(s => s.segmentId === draggedItem.segmentId)?.layers?.find(l => l.segmentLayerId === draggedItem.id)?.layer?.name || "Layer";
            
            setMovingItem({ type: draggedItem.type, name: itemName });
            
            try {
              switch (draggedItem.type) {
                case "location":
                  await moveLocationToSegment(mapId, draggedItem.segmentId, draggedItem.id, targetSegmentId);
                  break;
                case "zone":
                  await moveZoneToSegment(mapId, draggedItem.segmentId, draggedItem.id, targetSegmentId);
                  break;
                case "layer":
                  await moveLayerToSegment(mapId, draggedItem.segmentId, draggedItem.id, targetSegmentId);
                  break;
                case "route":
                  await moveRouteToSegment(mapId, draggedItem.segmentId, draggedItem.id, targetSegmentId);
                  break;
              }
              
              // Refresh segments without page reload
              if (onRefreshSegments) {
                // Add a delay to ensure backend has fully processed the move
                await new Promise(resolve => setTimeout(resolve, 300));
                await onRefreshSegments();
              }
            } catch (error) {
              console.error(`Failed to move ${draggedItem.type}:`, error);
              alert(`Failed to move ${draggedItem.type}. Please try again.`);
            } finally {
              setIsMoving(false);
              setMovingItem(null);
            }
          }
        }
      }
    }
    
    setDraggedItem(null);
  };

  const pixelsPerSecond = zoomLevel * 50;
  const totalWidth = useMemo(() => {
    const totalDuration = segments.reduce((sum, seg) => sum + seg.durationMs, 0) / 1000;
    return totalDuration * pixelsPerSecond;
  }, [segments, pixelsPerSecond]);

  const findTransition = (fromSegmentId: string, toSegmentId: string) => {
    return transitions.find(
      (t) => t.fromSegmentId === fromSegmentId && t.toSegmentId === toSegmentId
    );
  };

  if (segments.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        <div className="text-center">
          <Icon icon="mdi:filmstrip-box-multiple" className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No segments yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add segments from the left sidebar
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loading Overlay */}
      {isMoving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center">
          <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-6 py-4 shadow-2xl flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            <div className="text-sm text-zinc-200 font-medium">
              Moving {movingItem?.type || "item"}...
            </div>
            {movingItem?.name && (
              <div className="text-xs text-zinc-400">
                "{movingItem.name}"
              </div>
            )}
          </div>
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        disabled={isMoving}
      >
      <SortableContext
        items={segments.map((s) => `segment-${s.segmentId}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950/50">
          {/* Track Headers - Video Editor Style */}
          <div className="flex-shrink-0 border-b border-zinc-800/80 bg-zinc-900/80">
            <div className="flex items-center" style={{ minWidth: `${totalWidth + 200}px` }}>
              <div className="w-[200px] flex-shrink-0 p-2 border-r border-zinc-800/80 bg-zinc-950/50">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Timeline
                </div>
              </div>
              <div className="flex-1 flex items-start p-2 gap-1" style={{ minWidth: `${totalWidth}px` }}>
          {segments.map((segment, index) => (
            <Fragment key={segment.segmentId}>
                    <SortableSegmentHeader
                segment={segment}
                      pixelsPerSecond={pixelsPerSecond}
                    />
                    {index < segments.length - 1 && (
                      <div className="w-0.5 flex-shrink-0 bg-zinc-800/50" />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Tracks Container */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col" style={{ minWidth: `${totalWidth + 200}px` }}>
              {/* Track 1: Routes */}
              <TimelineTrackRow
                trackLabel="Routes"
                trackIcon="mdi:routes"
                trackColor="orange"
                trackType="route"
                segments={segments}
                activeSegmentId={activeSegmentId}
                zoomLevel={zoomLevel}
                pixelsPerSecond={pixelsPerSecond}
                mapId={mapId}
                currentMap={currentMap}
                onSegmentClick={onSegmentClick}
                onAddItem={onAddRouteAnimation}
                renderItems={(segment) => (
                  <RouteTrackItems
                    segment={segment}
                    mapId={mapId || ""}
                    currentMap={currentMap}
                  />
                )}
              />

              {/* Track 2: Locations */}
              <TimelineTrackRow
                trackLabel="Locations"
                trackIcon="mdi:map-marker"
                trackColor="emerald"
                trackType="location"
                segments={segments}
                activeSegmentId={activeSegmentId}
                zoomLevel={zoomLevel}
                pixelsPerSecond={pixelsPerSecond}
                mapId={mapId}
                currentMap={currentMap}
                onSegmentClick={onSegmentClick}
                onAddItem={onAddLocation}
                renderItems={(segment) => (
                  <LocationTrackItems
                    segment={segment}
                    mapId={mapId || ""}
                    currentMap={currentMap}
                  />
                )}
              />

              {/* Track 3: Zones & Layers */}
              <TimelineTrackRow
                trackLabel="Zones & Layers"
                trackIcon="mdi:layers-triple"
                trackColor="blue"
                trackType="zone"
                segments={segments}
                activeSegmentId={activeSegmentId}
                zoomLevel={zoomLevel}
                pixelsPerSecond={pixelsPerSecond}
                mapId={mapId}
                currentMap={currentMap}
                onSegmentClick={onSegmentClick}
                onAddItem={onAddZone}
                renderItems={(segment) => (
                  <ZoneLayerTrackItems
                    segment={segment}
                    mapId={mapId || ""}
                    currentMap={currentMap}
                    onAddZone={onAddZone}
                    onAddLayer={onAddLayer}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </SortableContext>
    </DndContext>
    </>
  );
}

interface TimelineTrackRowProps {
  trackLabel: string;
  trackIcon: string;
  trackColor: "orange" | "emerald" | "blue" | "purple";
  trackType: "route" | "location" | "zone" | "layer";
  segments: Segment[];
  activeSegmentId: string | null;
  zoomLevel: number;
  pixelsPerSecond: number;
  mapId?: string;
  currentMap?: any;
  onSegmentClick: (segmentId: string) => void;
  onAddItem?: (segmentId: string) => void;
  renderItems: (segment: Segment) => React.ReactNode;
}

function TimelineTrackRow({
  trackLabel,
  trackIcon,
  trackColor,
  trackType,
  segments,
  activeSegmentId,
  zoomLevel,
  pixelsPerSecond,
  mapId,
  currentMap,
  onSegmentClick,
  onAddItem,
  renderItems,
}: TimelineTrackRowProps) {
  const colorClasses = {
    orange: {
      bg: "bg-orange-500/15",
      border: "border-orange-500/40",
      text: "text-orange-300",
      icon: "text-orange-400",
      hover: "hover:bg-orange-500/25 hover:border-orange-500/60",
    },
    emerald: {
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
      icon: "text-emerald-400",
      hover: "hover:bg-emerald-500/25 hover:border-emerald-500/60",
    },
    blue: {
      bg: "bg-blue-500/15",
      border: "border-blue-500/40",
      text: "text-blue-300",
      icon: "text-blue-400",
      hover: "hover:bg-blue-500/25 hover:border-blue-500/60",
    },
    purple: {
      bg: "bg-purple-500/15",
      border: "border-purple-500/40",
      text: "text-purple-300",
      icon: "text-purple-400",
      hover: "hover:bg-purple-500/25 hover:border-purple-500/60",
    },
  };

  const colors = colorClasses[trackColor];

  return (
    <div className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
      <div className="flex items-stretch min-h-[72px]">
        {/* Track Header - Video Editor Style */}
        <div className="w-[200px] flex-shrink-0 p-2 border-r border-zinc-800/80 bg-zinc-950/50 flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded flex items-center justify-center", colors.bg, colors.border, "border")}>
            <Icon icon={trackIcon} className={cn("w-3.5 h-3.5", colors.icon)} />
          </div>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{trackLabel}</span>
        </div>

        {/* Track Content */}
        <div className="flex-1 flex items-center p-1.5 gap-1 bg-zinc-900/20">
          {segments.map((segment, index) => {
            const width = Math.max((segment.durationMs / 1000) * pixelsPerSecond, 60);
            const isActive = segment.segmentId === activeSegmentId;
            
            return (
              <Fragment key={segment.segmentId}>
                <DroppableSegmentArea
                  segmentId={segment.segmentId}
                  trackType={trackType}
                  width={width}
                  isActive={isActive}
                  trackColor={trackColor}
                  colors={colors}
                  onSegmentClick={onSegmentClick}
                  onAddItem={isActive ? onAddItem : undefined}
                  trackLabel={trackLabel}
                >
                  {renderItems(segment)}
                </DroppableSegmentArea>

                {/* Transition Indicator */}
                {index < segments.length - 1 && (
                  <div className="w-0.5 flex-shrink-0 bg-zinc-800/50" />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RouteTrackItems({ segment, mapId, currentMap }: { segment: Segment; mapId: string; currentMap?: any }) {
  // Use routes from prop if available, otherwise load from API
  const [routeAnimations, setRouteAnimations] = useState<RouteAnimation[]>(segment.routeAnimations || []);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteAnimation | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const loadRoutes = async () => {
    setIsLoading(true);
    try {
      const routes = await getRouteAnimationsBySegment(mapId, segment.segmentId);
      setRouteAnimations(routes || []);
    } catch (e) {
      console.error("Failed to load routes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state with prop when segment.routeAnimations changes
  useEffect(() => {
    if (segment.routeAnimations && segment.routeAnimations.length >= 0) {
      // Use routes from prop (already loaded in parent)
      setRouteAnimations(segment.routeAnimations);
    } else {
      // Fallback: load from API if prop doesn't have routes
      loadRoutes();
    }
  }, [segment.segmentId, segment.routeAnimations]);

  const handleDelete = async (routeId: string) => {
    if (!confirm("Delete this route?")) return;
    try {
      await deleteRouteAnimation(mapId, segment.segmentId, routeId);
      setRouteAnimations(prev => prev.filter(r => r.routeAnimationId !== routeId));
    } catch (e) {
      console.error("Failed to delete route:", e);
      alert("Failed to delete route");
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditingRoute(null);
    // Reload routes data without reloading the page
    loadRoutes();
  };

  const handleSave = () => {
    setShowDialog(false);
    setEditingRoute(null);
    // Reload routes data without reloading the page
    loadRoutes();
  };

  if (isLoading) {
    return <div className="text-[10px] text-zinc-500 px-2">Loading...</div>;
  }

  if (routeAnimations.length === 0) {
    return <div className="text-[10px] text-zinc-500 px-2 italic">No routes</div>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 p-1">
        {routeAnimations.map((route, index) => (
          <div
            key={route.routeAnimationId || `route-${index}`}
            className="group relative flex items-stretch rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
          >
            {/* Drag Handle - Only if route has valid ID */}
            {route.routeAnimationId && (
              <DraggableItem
                id={route.routeAnimationId}
                type="route"
                segmentId={segment.segmentId}
                className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
              >
                <div className="px-2 py-2 bg-orange-600/20 border-r border-orange-500/30 flex items-center justify-center hover:bg-orange-600/30 transition-colors">
                  <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-orange-400" />
                </div>
              </DraggableItem>
            )}
            
            {/* No drag handle if no valid ID */}
            {!route.routeAnimationId && (
              <div className="px-2 py-2 bg-zinc-600/20 border-r border-zinc-500/30 flex items-center justify-center opacity-50 cursor-not-allowed">
                <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-zinc-500" />
              </div>
            )}

            {/* Main Content */}
            <div
              className="px-3 py-2 bg-gradient-to-br from-orange-600/25 via-orange-500/15 to-orange-600/10 backdrop-blur-sm flex items-center gap-2 min-w-[120px] cursor-pointer hover:from-orange-600/35 hover:via-orange-500/25 hover:to-orange-600/20 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setEditingRoute(route);
                setShowDialog(true);
              }}
              title={`${route.fromName || "Start"} → ${route.toName || "End"} - Click to edit`}
            >
              <div className="w-6 h-6 rounded-full bg-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="mdi:routes" className="w-4 h-4 text-orange-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-orange-50 truncate">
                  {route.fromName || "Start"} → {route.toName || "End"}
                </div>
                <div className="text-[9px] text-orange-300/70">
                  {(route.durationMs / 1000).toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-stretch bg-orange-950/40 border-l border-orange-500/30">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingRoute(route);
                  setShowDialog(true);
                }}
                className="px-2.5 hover:bg-orange-500/30 text-orange-300 hover:text-white transition-all flex items-center justify-center group/btn"
                title="Edit route"
              >
                <Icon icon="mdi:pencil" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
              </button>
              <div className="w-px bg-orange-500/20" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(route.routeAnimationId);
                }}
                className="px-2.5 hover:bg-red-500/30 text-orange-300 hover:text-red-300 transition-all flex items-center justify-center group/btn"
                title="Delete route"
              >
                <Icon icon="mdi:delete" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {showDialog && typeof window !== "undefined" && createPortal(
        <RouteAnimationDialog
          mapId={mapId}
          segmentId={segment.segmentId}
          currentMap={currentMap}
          routeAnimation={editingRoute}
          isOpen={showDialog}
          onClose={handleClose}
          onSave={handleSave}
        />,
        document.body
      )}
    </>
  );
}

function LocationTrackItems({ segment, mapId, currentMap }: { segment: Segment; mapId: string; currentMap?: any }) {
  const locations = segment.locations || [];
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDelete = async (locationId: string) => {
    if (!confirm("Delete this location?")) return;
    try {
      await deleteLocation(mapId, segment.segmentId, locationId);
      // Reload page to refresh segment data
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete location:", e);
      alert("Failed to delete location");
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async (data: any) => {
    const locationId = editingLocation?.locationId;
    if (!locationId) return;
    try {
      await updateLocation(mapId || "", segment.segmentId, locationId, data);
      setShowEditDialog(false);
      setEditingLocation(null);
      window.location.reload();
    } catch (e) {
      console.error("Failed to update location:", e);
      alert("Failed to update location");
    }
  };

  if (locations.length === 0) {
    return <div className="text-[10px] text-zinc-500 px-2 italic">No locations</div>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 p-1">
        {locations.map((location, index) => {
          const locationId = location.locationId;
          
          return (
            <div
              key={locationId || `location-${index}`}
              className="group relative flex items-stretch rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              {/* Drag Handle - Only if location has valid ID */}
              {locationId && (
                <DraggableItem
                  id={locationId}
                  type="location"
                  segmentId={segment.segmentId}
                  className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
                >
                  <div className="px-2 py-2 bg-emerald-600/20 border-r border-emerald-500/30 flex items-center justify-center hover:bg-emerald-600/30 transition-colors">
                    <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-emerald-400" />
                  </div>
                </DraggableItem>
              )}
              
              {/* No drag handle if no valid ID */}
              {!locationId && (
                <div className="px-2 py-2 bg-zinc-600/20 border-r border-zinc-500/30 flex items-center justify-center opacity-50 cursor-not-allowed">
                  <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-zinc-500" />
                </div>
              )}

            {/* Main Content */}
            <div
              className="px-3 py-2 bg-gradient-to-br from-emerald-600/25 via-emerald-500/15 to-emerald-600/10 backdrop-blur-sm flex items-center gap-2 min-w-[120px] cursor-pointer hover:from-emerald-600/35 hover:via-emerald-500/25 hover:to-emerald-600/20 transition-all group-hover:shadow-inner"
              title={`${location.title || "Untitled"} - Click to edit`}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(location);
              }}
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Icon icon="mdi:map-marker" className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-emerald-50 truncate">
                  {location.title || "Untitled Location"}
                </div>
                {location.subtitle && (
                  <div className="text-[9px] text-emerald-300/70 truncate">
                    {location.subtitle}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-stretch bg-emerald-950/40 border-l border-emerald-500/30">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(location);
                }}
                className="px-2.5 hover:bg-emerald-500/30 text-emerald-300 hover:text-white transition-all flex items-center justify-center group/btn"
                title="Edit location"
              >
                <Icon icon="mdi:pencil" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
              </button>
              <div className="w-px bg-emerald-500/20" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(locationId || "");
                }}
                className="px-2.5 hover:bg-red-500/30 text-emerald-300 hover:text-red-300 transition-all flex items-center justify-center group/btn"
                title="Delete location"
              >
                <Icon icon="mdi:delete" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        );
        })}
      </div>

      {/* Edit Dialog */}
      {showEditDialog && editingLocation && typeof window !== "undefined" && createPortal(
        <LocationDialog
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingLocation(null);
          }}
          onSave={handleSaveEdit}
          segmentId={segment.segmentId}
          currentMap={currentMap}
          initialLocation={editingLocation}
          initialCoordinates={editingLocation?.markerGeometry ? (() => {
            try {
              const geoJson = JSON.parse(editingLocation.markerGeometry);
              return geoJson.coordinates as [number, number] | null;
            } catch {
              return null;
            }
          })() : null}
        />,
        document.body
      )}
    </>
  );
}

function ZoneLayerTrackItems({
  segment,
  mapId,
  currentMap,
  onAddZone,
  onAddLayer,
}: {
  segment: Segment;
  mapId: string;
  currentMap?: any;
  onAddZone?: (segmentId: string) => void;
  onAddLayer?: (segmentId: string) => void;
}) {
  const zones = segment.zones || [];
  const layers = segment.layers || [];

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Remove this zone?")) return;
    try {
      await deleteSegmentZone(mapId, segment.segmentId, zoneId);
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete zone:", e);
      alert("Failed to remove zone");
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    if (!confirm("Remove this layer?")) return;
    try {
      await detachLayerFromSegment(mapId, segment.segmentId, layerId);
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete layer:", e);
      alert("Failed to remove layer");
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-1">
      {zones.map((zone, index) => (
        <div
          key={zone.segmentZoneId || `zone-${index}`}
          className="group relative flex items-stretch rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
        >
          {/* Drag Handle */}
          <DraggableItem
            id={zone.segmentZoneId}
            type="zone"
            segmentId={segment.segmentId}
            className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
          >
            <div className="px-2 py-2 bg-blue-600/20 border-r border-blue-500/30 flex items-center justify-center hover:bg-blue-600/30 transition-colors">
              <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-blue-400" />
            </div>
          </DraggableItem>

          {/* Main Content */}
          <div className="px-3 py-2 bg-gradient-to-br from-blue-600/25 via-blue-500/15 to-blue-600/10 backdrop-blur-sm flex items-center gap-2 min-w-[120px]">
            <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Icon icon="mdi:shape" className="w-4 h-4 text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-blue-50 truncate">
                {zone.zone?.name || "Zone"}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-stretch bg-blue-950/40 border-l border-blue-500/30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteZone(zone.segmentZoneId);
              }}
              className="px-2.5 hover:bg-red-500/30 text-blue-300 hover:text-red-300 transition-all flex items-center justify-center group/btn"
              title="Delete zone"
            >
              <Icon icon="mdi:delete" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      ))}
      
      {layers.map((layer, index) => (
        <div
          key={layer.segmentLayerId || `layer-${index}`}
          className="group relative flex items-stretch rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
        >
          {/* Drag Handle */}
          <DraggableItem
            id={layer.segmentLayerId}
            type="layer"
            segmentId={segment.segmentId}
            className="cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
          >
            <div className="px-2 py-2 bg-purple-600/20 border-r border-purple-500/30 flex items-center justify-center hover:bg-purple-600/30 transition-colors">
              <Icon icon="mdi:drag-vertical" className="w-4 h-4 text-purple-400" />
            </div>
          </DraggableItem>

          {/* Main Content */}
          <div className="px-3 py-2 bg-gradient-to-br from-purple-600/25 via-purple-500/15 to-purple-600/10 backdrop-blur-sm flex items-center gap-2 min-w-[120px]">
            <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Icon icon="mdi:layers" className="w-4 h-4 text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-purple-50 truncate">
                {layer.layer?.name || "Layer"}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-stretch bg-purple-950/40 border-l border-purple-500/30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteLayer(layer.segmentLayerId);
              }}
              className="px-2.5 hover:bg-red-500/30 text-purple-300 hover:text-red-300 transition-all flex items-center justify-center group/btn"
              title="Delete layer"
            >
              <Icon icon="mdi:delete" className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      ))}
      
      {zones.length === 0 && layers.length === 0 && (
        <div className="text-[10px] text-zinc-500 px-2 italic">No zones or layers</div>
      )}
    </div>
  );
}

// Sortable Segment Header Component
function SortableSegmentHeader({ segment, pixelsPerSecond }: { segment: Segment; pixelsPerSecond: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `segment-${segment.segmentId}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: `${Math.max((segment.durationMs / 1000) * pixelsPerSecond, 60)}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors cursor-move"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-center gap-1">
        <Icon icon="mdi:drag" className="w-3 h-3 text-zinc-500" />
        <div className="text-[10px] font-medium text-zinc-300 truncate text-center">
          {segment.name}
        </div>
      </div>
      <div className="text-[9px] text-zinc-500 text-center mt-0.5">
        {(segment.durationMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

// Droppable Segment Area Component
function DroppableSegmentArea({
  segmentId,
  trackType,
  width,
  isActive,
  trackColor,
  colors,
  onSegmentClick,
  onAddItem,
  trackLabel,
  children,
}: {
  segmentId: string;
  trackType: "route" | "location" | "zone" | "layer";
  width: number;
  isActive: boolean;
  trackColor: "orange" | "emerald" | "blue" | "purple";
  colors: any;
  onSegmentClick: (segmentId: string) => void;
  onAddItem?: (segmentId: string) => void;
  trackLabel: string;
  children: React.ReactNode;
}) {
  // Use __|__ as delimiter to avoid conflicts with GUID dashes
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${trackType}__|__${segmentId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 relative group h-full min-h-[56px] rounded border transition-all cursor-pointer",
        isActive
          ? "border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
          : cn("border-zinc-700/50 bg-zinc-800/40", colors.hover),
        isOver && "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/50"
      )}
      style={{ width: `${width}px`, minWidth: "60px" }}
      onClick={() => onSegmentClick(segmentId)}
    >
      {/* Drop indicator */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-emerald-500 rounded flex items-center justify-center bg-emerald-500/10 z-20">
          <span className="text-xs text-emerald-400 font-medium">Drop here</span>
        </div>
      )}

      {/* Add Button */}
      {isActive && onAddItem && !isOver && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddItem(segmentId);
          }}
          className={cn(
            "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10",
            "hover:bg-zinc-700/60 rounded backdrop-blur-sm"
          )}
          title={`Add ${trackLabel.toLowerCase()}`}
        >
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg, colors.border, "border-2")}>
            <Icon icon="mdi:plus" className={cn("w-4 h-4", colors.icon)} />
          </div>
        </button>
      )}

      {/* Items */}
      <div className="p-1 h-full overflow-x-auto overflow-y-hidden">
        {children}
      </div>
    </div>
  );
}

// Draggable Item Component
function DraggableItem({
  id,
  type,
  segmentId,
  children,
  className,
}: {
  id: string;
  type: "location" | "zone" | "route" | "layer";
  segmentId: string;
  children: React.ReactNode;
  className?: string;
}) {
  // Use __|__ as delimiter to avoid conflicts with GUID dashes
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${type}__|__${segmentId}__|__${id}`,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : { opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("cursor-move", className)}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
