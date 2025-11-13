"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Segment, SegmentZone } from "@/lib/api-storymap";
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
  onAddLayer?: (segmentId: string) => void;
  onDeleteLayer?: (segmentLayerId: string) => void;
  onAddLocation?: (segmentId: string) => void;
  onDeleteLocation?: (locationId: string) => void;
  onCaptureCamera?: (segment: Segment) => void;
  onViewOnMap?: (segment: TimelineSegment) => void;
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
  onAddLayer,
  onDeleteLayer,
  onAddLocation,
  onDeleteLocation,
  onCaptureCamera,
  onViewOnMap,
}: SortableSegmentItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.segmentId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const zones = segment.zones ?? [];
  const layers = segment.layers ?? [];
  const locations = segment.locations ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-2 min-w-[340px] max-w-[420px]"
    >
      <div
        className={[
          "rounded-2xl border px-3.5 pb-3 bg-gradient-to-b shadow-sm transition-all duration-150",
          "from-zinc-900/95 via-zinc-900 to-zinc-950",
          "border-zinc-800/90 hover:border-zinc-600/80",
          "text-[13px]", // base text size tăng nhẹ
          isActive
            ? "border-emerald-500/80 shadow-[0_0_0_1px_rgba(16,185,129,0.55)]"
            : "",
          isDragging ? "ring-1 ring-emerald-500/70" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* HEADER */}
        <div
          className="flex items-start gap-3 pt-2 pb-2"
          onClick={onSelect}
        >
          {/* drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-1 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-200 cursor-grab active:cursor-grabbing"
          >
            <span className="h-0.5 w-3 rounded-full bg-current mb-0.5" />
            <span className="h-0.5 w-3 rounded-full bg-current" />
          </button>

          {/* expand + title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(segment.segmentId);
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/90 text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                {segment.expanded ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </button>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 12l5 5L20 7"
                      />
                    </svg>
                  </span>
                  <span className="truncate text-sm font-semibold text-zinc-50">
                    {segment.name || "Untitled segment"}
                  </span>
                </div>
                {segment.description && (
                  <span className="mt-0.5 truncate text-xs text-zinc-400">
                    {segment.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="flex flex-col items-end gap-1 ml-1">
            <div className="flex items-center gap-1.5">
              {onViewOnMap && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOnMap(segment);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  title="View segment on map"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"
                    />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </button>
              )}
              {onCaptureCamera && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCaptureCamera(segment);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  title="Capture current camera view"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 7h3l1.2-2.4A1 1 0 0 1 9.1 4h5.8a1 1 0 0 1 .9.6L17 7h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1z"
                    />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(segment);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-200 hover:bg-emerald-600 hover:text-white"
                title="Edit segment"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 21h4l11-11a2.5 2.5 0 0 0-3.5-3.5L4.5 17.5 4 21z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(segment);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-200 hover:bg-red-600 hover:text-white"
                title="Delete segment"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m-9 0h10"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        {segment.expanded && (
          <div className="mt-1 space-y-3 border-t border-zinc-800/70 pt-3">
            {/* ZONES */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                  Zones ({zones.length})
                </span>
                <button
                  onClick={() => onAddZone(segment.segmentId)}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white"
                >
                  + Add
                </button>
              </div>
              {zones.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500">
                  No zones yet
                </div>
              )}
              {zones.map((zone) => (
                <div
                  key={zone.segmentZoneId}
                  className="mt-1 flex items-center justify-between rounded-lg bg-zinc-900/90 px-3 py-1.5 text-[12px]"
                >
                  <span className="text-zinc-100 truncate">
                    {zone.zone?.name || "Zone"}
                  </span>
                  <button
                    onClick={() => onDeleteZone(zone)}
                    className="ml-2 text-[11px] font-medium text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* LAYERS */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                  Layers ({layers.length})
                </span>
                {onAddLayer && (
                  <button
                    onClick={() => onAddLayer(segment.segmentId)}
                    className="rounded-full bg-sky-600 hover:bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    + Add
                  </button>
                )}
              </div>
              {layers.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500">
                  No layers yet
                </div>
              )}
              {layers.map((layer) => (
                <div
                  key={layer.segmentLayerId}
                  className="mt-1 flex items-center justify-between rounded-lg bg-zinc-900/90 px-3 py-1.5 text-[12px]"
                >
                  <span className="text-zinc-100">
                    Layer {layer.layerId}
                    {!layer.isVisible && (
                      <span className="ml-2 text-[11px] text-zinc-500">(Hidden)</span>
                    )}
                  </span>
                  {onDeleteLayer && (
                    <button
                      onClick={() => onDeleteLayer(layer.segmentLayerId)}
                      className="ml-2 text-[11px] font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* LOCATIONS */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                  Locations ({locations.length})
                </span>
                {onAddLocation && (
                  <button
                    onClick={() => onAddLocation(segment.segmentId)}
                    className="rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    + Add
                  </button>
                )}
              </div>
              {locations.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-500">
                  No locations yet
                </div>
              )}
              {locations.map((loc) => (
                <div
                  key={loc.poiId || loc.locationId}
                  className="mt-1 flex items-center justify-between rounded-lg bg-zinc-900/90 px-3 py-1.5 text-[12px]"
                >
                  <span className="text-zinc-100 truncate">
                    {loc.iconType || "📍"} {loc.title}
                    {!loc.isVisible && (
                      <span className="ml-2 text-[11px] text-zinc-500">(Hidden)</span>
                    )}
                  </span>
                  {onDeleteLocation && (
                    <button
                      onClick={() => onDeleteLocation(loc.poiId || loc.locationId!)}
                      className="ml-2 text-[11px] font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
