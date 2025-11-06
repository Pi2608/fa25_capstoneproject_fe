"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSegments, Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";

export default function StoryMapControlPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const mapId = params?.mapId ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Initialize broadcast channel
  useEffect(() => {
    if (typeof window === 'undefined' || !mapId) return;

    broadcastRef.current = new BroadcastChannel(`storymap-${mapId}`);
    console.log('[Control] Broadcasting on:', `storymap-${mapId}`);

    return () => broadcastRef.current?.close();
  }, [mapId]);

  // Load data
  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setLoading(true);
        const [detail, segs] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        if (detail.status !== "Published") {
          setError("This map is not published yet");
          return;
        }

        setMapDetail(detail);
        setSegments(segs);
      } catch (e: any) {
        setError(e.message || "Failed to load storymap");
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  // Broadcast segment changes
  const handleSegmentChange = (segment: Segment, index: number) => {
    setCurrentIndex(index);
    broadcastRef.current?.postMessage({
      type: 'segment-change',
      segmentIndex: index,
      segment,
      timestamp: Date.now(),
    });
    console.log('[Control] Broadcasted segment:', index);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-xl">Loading Control Panel...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="text-red-400 text-2xl mb-4">⚠️ {error}</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapDetail?.center 
    ? [mapDetail.center.latitude, mapDetail.center.longitude]
    : [10.8231, 106.6297];

  return (
    <div className="h-screen flex">
      {/* Control Panel - Left Sidebar */}
      <div className="w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-white text-2xl font-bold mb-2">Control Panel</h1>
          <p className="text-zinc-400 text-sm">
            {mapDetail?.name || "Story Map"}
          </p>
          <div className="mt-3 px-3 py-2 bg-zinc-800 rounded text-zinc-400 text-xs">
            📡 Broadcasting: storymap-{mapId.slice(0, 8)}...
          </div>
        </div>

        {/* Segments List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {segments.map((segment, index) => (
              <button
                key={segment.segmentId}
                onClick={() => handleSegmentChange(segment, index)}
                className={`w-full text-left px-4 py-4 rounded-lg transition-all transform ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:scale-102'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">
                        {index + 1}
                      </span>
                      <span className="font-semibold">{segment.name}</span>
                    </div>
                    {segment.description && (
                      <div className="text-sm opacity-80 mt-2 line-clamp-2">
                        {segment.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                      {segment.zones && segment.zones.length > 0 && (
                        <span>🗺️ {segment.zones.length} zones</span>
                      )}
                      {segment.locations && segment.locations.length > 0 && (
                        <span>📍 {segment.locations.length} locations</span>
                      )}
                      {segment.layers && segment.layers.length > 0 && (
                        <span>🔲 {segment.layers.length} layers</span>
                      )}
                    </div>
                  </div>
                  {index === currentIndex && (
                    <div className="ml-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-zinc-800 rounded p-2">
              <div className="text-zinc-400 text-xs">Current</div>
              <div className="text-white font-bold">{currentIndex + 1}</div>
            </div>
            <div className="bg-zinc-800 rounded p-2">
              <div className="text-zinc-400 text-xs">Total</div>
              <div className="text-white font-bold">{segments.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Viewer - Right Side */}
      <div className="flex-1">
        <StoryMapViewer
          mapId={mapId}
          segments={segments}
          baseMapProvider={mapDetail?.baseMapProvider}
          initialCenter={center}
          initialZoom={mapDetail?.defaultZoom || 10}
          onSegmentChange={handleSegmentChange}
        />
      </div>
    </div>
  );
}
