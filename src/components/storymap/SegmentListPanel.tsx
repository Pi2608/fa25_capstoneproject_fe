"use client";

import { useState } from "react";
import { Segment, SegmentZone, Location } from "@/lib/api-storymap";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface SegmentListPanelProps {
  segments: Segment[];
  activeSegmentId: string | null;
  onSegmentClick: (segment: Segment) => void;
  onAddSegment: () => void;
  onEditSegment: (segment: Segment) => void;
  onDeleteSegment: (segment: Segment) => void;
  onCaptureCamera: (segment: Segment) => void;
  onAddZone: (segmentId: string) => void;
  onDeleteZone: (zone: SegmentZone) => void;
  onAddLayer: (segmentId: string) => void;
  onAddLocation: (segmentId: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

export default function SegmentListPanel({
  segments,
  activeSegmentId,
  onSegmentClick,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
  onCaptureCamera,
  onAddZone,
  onDeleteZone,
  onAddLayer,
  onAddLocation,
  onDeleteLocation,
}: SegmentListPanelProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<SegmentZone | null>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<Location | null>(null);

  const toggleExpand = (segmentId: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Story Segments</h2>
          <Button onClick={onAddSegment} size="sm">
            ➕ New
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Segments List */}
      <div className="flex-1 overflow-y-auto">
        {segments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-zinc-500 mb-3">No segments yet</div>
            <Button onClick={onAddSegment} variant="outline" size="sm">
              Create First Segment
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {segments.map((segment, index) => {
              const isActive = activeSegmentId === segment.segmentId;
              const isExpanded = expandedSegments.has(segment.segmentId);

              return (
                <div
                  key={segment.segmentId}
                  className={`${isActive ? 'bg-emerald-950/30 border-l-4 border-emerald-500' : ''}`}
                >
                  {/* Segment Header */}
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleExpand(segment.segmentId)}
                        className="flex-shrink-0 mt-1 p-1 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 text-zinc-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>

                      {/* Segment Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                            {index + 1}
                          </span>
                          <button
                            onClick={() => onSegmentClick(segment)}
                            className="font-medium text-white hover:text-emerald-400 transition-colors text-left truncate"
                          >
                            {segment.name}
                          </button>
                        </div>

                        {segment.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
                            {segment.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                          {segment.zones && segment.zones.length > 0 && (
                            <span>🗺️ {segment.zones.length} zones</span>
                          )}
                          {segment.locations && segment.locations.length > 0 && (
                            <span>📍 {segment.locations.length} POIs</span>
                          )}
                          {segment.layers && segment.layers.length > 0 && (
                            <span>🔲 {segment.layers.length} layers</span>
                          )}
                          <span>⏱️ {(segment.durationMs / 1000).toFixed(1)}s</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => onSegmentClick(segment)}
                            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                          >
                            👁️ View
                          </button>
                          <button
                            onClick={() => onEditSegment(segment)}
                            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => onCaptureCamera(segment)}
                            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                          >
                            📷 Camera
                          </button>
                          <button
                            onClick={() => onDeleteSegment(segment)}
                            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-300 rounded transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-3 ml-6 space-y-3">
                        {/* Zones */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-400">Zones</span>
                            <button
                              onClick={() => onAddZone(segment.segmentId)}
                              className="text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              ➕ Add
                            </button>
                          </div>
                          {segment.zones && segment.zones.length > 0 ? (
                            <div className="space-y-1">
                              {segment.zones.map((zone) => (
                                <div
                                  key={zone.segmentZoneId}
                                  className="flex items-center justify-between p-2 bg-zinc-800/50 rounded text-xs"
                                >
                                  <span className="text-zinc-300 truncate">
                                    {zone.labelOverride || zone.zone?.name || 'Unnamed Zone'}
                                  </span>
                                  <button
                                    onClick={() => setConfirmDeleteZone(zone)}
                                    className="text-red-400 hover:text-red-300 ml-2"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 italic">No zones</p>
                          )}
                        </div>

                        {/* Locations */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-400">Locations/POIs</span>
                            <button
                              onClick={() => onAddLocation(segment.segmentId)}
                              className="text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              ➕ Add
                            </button>
                          </div>
                          {segment.locations && segment.locations.length > 0 ? (
                            <div className="space-y-1">
                              {segment.locations.map((location) => (
                                <div
                                  key={location.locationId}
                                  className="flex items-center justify-between p-2 bg-zinc-800/50 rounded text-xs"
                                >
                                  <span className="text-zinc-300 truncate flex items-center gap-1">
                                    <span>{location.iconType || '📍'}</span>
                                    <span>{location.title}</span>
                                  </span>
                                  <button
                                    onClick={() => setConfirmDeleteLocation(location)}
                                    className="text-red-400 hover:text-red-300 ml-2"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 italic">No locations</p>
                          )}
                        </div>

                        {/* Layers */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-400">Layers</span>
                            <button
                              onClick={() => onAddLayer(segment.segmentId)}
                              className="text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              ➕ Attach
                            </button>
                          </div>
                          {segment.layers && segment.layers.length > 0 ? (
                            <div className="space-y-1">
                              {segment.layers.map((layer) => (
                                <div
                                  key={layer.segmentLayerId}
                                  className="flex items-center justify-between p-2 bg-zinc-800/50 rounded text-xs"
                                >
                                  <span className="text-zinc-300 truncate">
                                    Layer {layer.layerId.slice(0, 8)}...
                                    {layer.isVisible ? ' 👁️' : ' 🚫'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 italic">No layers</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Delete Zone Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDeleteZone}
        onClose={() => setConfirmDeleteZone(null)}
        onConfirm={() => {
          if (confirmDeleteZone) {
            onDeleteZone(confirmDeleteZone);
            setConfirmDeleteZone(null);
          }
        }}
        title="Delete Zone"
        message="Are you sure you want to remove this zone from the segment?"
        itemName={confirmDeleteZone?.labelOverride || confirmDeleteZone?.zone?.name}
        itemType="zone"
      />

      {/* Confirm Delete Location Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDeleteLocation}
        onClose={() => setConfirmDeleteLocation(null)}
        onConfirm={() => {
          if (confirmDeleteLocation) {
            onDeleteLocation(confirmDeleteLocation.locationId || '');
            setConfirmDeleteLocation(null);
          }
        }}
        title="Delete Location"
        message="Are you sure you want to remove this location from the segment?"
        itemName={confirmDeleteLocation?.title}
        itemType="location"
      />
    </div>
  );
}
