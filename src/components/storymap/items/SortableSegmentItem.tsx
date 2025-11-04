"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Segment, SegmentZone } from "@/lib/api-storymap-v2";
import { TimelineSegment } from "@/types/storymap";

interface SortableSegmentItemProps {
  segment: TimelineSegment;
  isActive?: boolean;
  onSelect: () => void;
  onToggle: (id: string) => void;
  onEdit: (segment: Segment) => void;
  onDelete: (segment: Segment) => void;
  onAddZone: (segmentId: string) => void;
  onDeleteZone: (zone: SegmentZone) => void;
}

export default function SortableSegmentItem({ 
  segment, 
  isActive,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onAddZone,
  onDeleteZone,
}: SortableSegmentItemProps) {
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
      <div 
        className={`rounded-lg border transition-all ${
          isActive 
            ? 'bg-emerald-900/20 border-emerald-500' 
            : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3" onClick={onSelect}>
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          {/* Expand */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(segment.segmentId);
            }}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {segment.expanded ? '▼' : '▶'}
          </button>

          {/* Name */}
          <div className="flex-1">
            <div className="font-medium text-white">{segment.name}</div>
            {segment.summary && (
              <div className="text-xs text-zinc-500">{segment.summary}</div>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(segment);
            }}
            className="p-1 text-blue-400 hover:text-blue-300"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(segment);
            }}
            className="p-1 text-red-400 hover:text-red-300"
            title="Delete"
          >
            🗑️
          </button>
        </div>

        {/* Expanded content */}
        {segment.expanded && (
          <div className="px-4 pb-3 space-y-2">
            {/* Zones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Zones ({segment.zones.length})</span>
                <button
                  onClick={() => onAddZone(segment.segmentId)}
                  className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  + Add
                </button>
              </div>
              {segment.zones.map((zone) => (
                <div key={zone.segmentZoneId} className="flex items-center justify-between bg-zinc-900 rounded p-2 mb-1">
                  <span className="text-sm text-white">{zone.zone?.name || 'Zone'}</span>
                  <button
                    onClick={() => onDeleteZone(zone)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Layers */}
            <div>
              <span className="text-sm text-zinc-400">Layers ({segment.layers.length})</span>
              {segment.layers.map((layer) => (
                <div key={layer.segmentLayerId} className="bg-zinc-900 rounded p-2 mb-1">
                  <span className="text-sm text-white">Layer {layer.layerId}</span>
                </div>
              ))}
            </div>

            {/* Locations */}
            <div>
              <span className="text-sm text-zinc-400">Locations ({segment.locations.length})</span>
              {segment.locations.map((loc) => (
                <div key={loc.locationId} className="bg-zinc-900 rounded p-2 mb-1">
                  <span className="text-sm text-white">{loc.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
