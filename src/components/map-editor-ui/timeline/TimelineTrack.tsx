"use client";

import { Fragment, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import type { Segment, TimelineTransition } from "@/lib/api-storymap";
import { SegmentItemsList } from "../LeftSidebarToolbox";

interface TimelineTrackProps {
  segments: Segment[];
  transitions: TimelineTransition[];
  activeSegmentId: string | null;
  zoomLevel: number;
  mapId?: string;
  onReorder: (newOrder: Segment[]) => void;
  onSegmentClick: (segmentId: string) => void;
}

export function TimelineTrack({
  segments,
  transitions,
  activeSegmentId,
  zoomLevel,
  mapId,
  onReorder,
  onSegmentClick,
}: TimelineTrackProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex((s) => s.segmentId === active.id);
      const newIndex = segments.findIndex((s) => s.segmentId === over.id);

      const newOrder = arrayMove(segments, oldIndex, newIndex);
      onReorder(newOrder);
    }
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={segments.map((s) => s.segmentId)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          className="flex items-start p-4 h-full"
          style={{ minWidth: `${totalWidth}px` }}
        >
          {segments.map((segment, index) => (
            <Fragment key={segment.segmentId}>
              <SortableSegmentBlock
                segment={segment}
                isActive={segment.segmentId === activeSegmentId}
                zoomLevel={zoomLevel}
                mapId={mapId}
                onClick={() => onSegmentClick(segment.segmentId)}
              />

              {/* Transition Indicator */}
              {index < segments.length - 1 && (
                <TransitionIndicator
                  transition={findTransition(
                    segment.segmentId,
                    segments[index + 1].segmentId
                  )}
                />
              )}
            </Fragment>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSegmentBlock({
  segment,
  isActive,
  zoomLevel,
  mapId,
  onClick,
}: {
  segment: Segment;
  isActive: boolean;
  zoomLevel: number;
  mapId?: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: segment.segmentId,
    });

  const pixelsPerSecond = zoomLevel * 50;
  const width = (segment.durationMs / 1000) * pixelsPerSecond;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${Math.max(width, 60)}px`,
    minWidth: "60px",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border-2 cursor-pointer relative group flex-shrink-0 overflow-hidden",
        isActive
          ? "border-emerald-500 bg-emerald-500/20 h-auto min-h-[80px] max-h-[400px]"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 h-20",
        isDragging && "opacity-60 ring-2 ring-emerald-500/70"
      )}
      onClick={onClick}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-zinc-700/50 transition-colors z-10"
      >
        <Icon icon="mdi:drag-vertical" className="w-3 h-3 text-zinc-400" />
      </div>

      {/* Segment Info */}
      <div className={cn(
        "p-2 pt-7 flex flex-col w-full",
        isActive ? "h-full" : "h-full"
      )}>
        <div className="font-medium text-xs truncate text-zinc-200 mb-1">
          {segment.name}
        </div>
        <div className="text-[10px] text-zinc-400 flex items-center gap-1 mb-2">
          <Icon icon="mdi:clock-outline" className="w-3 h-3" />
          {(segment.durationMs / 1000).toFixed(1)}s
        </div>

        {/* Segment Items List - Only show when active */}
        {isActive && mapId && (
          <div className="flex-1 overflow-y-auto min-h-0 border-t border-zinc-700/50 pt-2 mt-2 max-h-[300px]">
            <SegmentItemsList
              segmentId={segment.segmentId}
              mapId={mapId}
              segment={segment}
              onAddLocation={() => {}}
              onAddZone={() => {}}
              onAddLayer={() => {}}
              onAddRouteAnimation={undefined}
            />
          </div>
        )}

        {/* Segment metadata badges - Only show when not active */}
        {!isActive && (
          <div className="flex gap-1 mt-auto">
            {segment.zones && segment.zones.length > 0 && (
              <span className="px-1 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] rounded">
                {segment.zones.length}Z
              </span>
            )}
            {segment.layers && segment.layers.length > 0 && (
              <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[9px] rounded">
                {segment.layers.length}L
              </span>
            )}
            {segment.locations && segment.locations.length > 0 && (
              <span className="px-1 py-0.5 bg-green-500/20 text-green-300 text-[9px] rounded">
                {segment.locations.length}P
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TransitionIndicator({
  transition,
}: {
  transition: TimelineTransition | undefined;
}) {
  if (!transition) {
    return <div className="w-1 flex-shrink-0" />;
  }

  return (
    <div
      className="relative w-1 flex-shrink-0"
      title={`${transition.transitionName || "Transition"} - ${transition.cameraAnimationType} (${(transition.durationMs / 1000).toFixed(1)}s)`}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center bg-blue-600/80 border border-blue-500 rounded-full z-10">
        <Icon icon="mdi:transition" className="w-3 h-3 text-white" />
      </div>
    </div>
  );
}
