"use client";

import { useState, useEffect } from "react";
import { getSegments, type Segment } from "@/lib/api";
import StoryElementLayerPanel from "./StoryElementLayerPanel";

interface Props {
  mapId: string;
  availableLayers?: Array<{ id: string; name: string }>;
  availableZones?: Array<{ id: string; name: string }>;
}

export default function StoryElementManager({
  mapId,
  availableLayers = [],
  availableZones = [],
}: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSegments();
  }, [mapId]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSegments(mapId);
      setSegments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load segments");
    } finally {
      setLoading(false);
    }
  };

  const handleManageLayers = (elementId: string) => {
    setSelectedElement(elementId);
    setShowLayerPanel(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/80">Story Segments ({segments.length})</span>
        <button
          onClick={loadSegments}
          className="text-[11px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded p-2 border border-red-800/30">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-white/50">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mx-auto mb-2"></div>
            <p className="text-xs">Loading segments...</p>
          </div>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.segmentId}
              className="bg-zinc-700/50 rounded p-2 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-white truncate">
                      {segment.name}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-600/80 text-white rounded">
                      Segment
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-gray-600/80 text-white rounded">
                      #{segment.displayOrder}
                    </span>
                  </div>
                  {segment.summary && (
                    <p className="text-[10px] text-white/60 mt-0.5 truncate">
                      {segment.summary}
                    </p>
                  )}
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Created: {segment.createdAt ? new Date(segment.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleManageLayers(segment.segmentId)}
                    className="text-[10px] px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white"
                  >
                    Manage Layers
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {!loading && segments.length === 0 && (
          <div className="text-center py-4 text-white/50">
            <p className="text-xs">No story segments found</p>
            <p className="text-[10px] text-white/30">Create segments first to manage their story layers</p>
          </div>
        )}
      </div>

      {/* Story Element Layer Panel */}
      {showLayerPanel && selectedElement && (
        <StoryElementLayerPanel
          elementId={selectedElement}
          availableLayers={availableLayers}
          availableZones={availableZones}
          onClose={() => {
            setShowLayerPanel(false);
            setSelectedElement(null);
          }}
        />
      )}
    </div>
  );
}
