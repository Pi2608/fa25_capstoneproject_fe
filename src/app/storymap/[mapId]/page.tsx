"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSegments, type Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";
import { MapEditorLegend } from "@/components/map-editor-ui";
import ReportViolationDialog from "@/components/map/ReportViolationDialog";
import { AlertTriangle } from "lucide-react";

export default function StoryMapPlayerPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const mapId = params?.mapId ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Load map + segments
  useEffect(() => {
    if (!mapId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [detail, segs] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        // Only Published storymaps can be viewed
        if (detail.status !== "published") {
          setError("This map is not published yet");
          return;
        }

        setMapDetail(detail);
        const segmentList = Array.isArray(segs) ? segs : [];
        setSegments(segmentList);
        setCurrentIndex(0);

      } catch (e: any) {
        console.error("Load storymap failed:", e);
        setError(e?.message || "Failed to load storymap");
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  // Khi viewer tự chuyển segment
  const handleSegmentChange = useCallback((segment: Segment, index: number) => {
    setCurrentIndex(index);
  }, []);

  // Chuyển segment bằng nút Trước/Sau/Timeline
  const goToSegment = (index: number) => {
    if (index < 0 || index >= segments.length) return;
    // Ở player không cần broadcast, chỉ update state để người dùng biết đang ở segment nào
    setCurrentIndex(index);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
          <div className="text-white text-xl">Loading Story Map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center max-w-md px-4">
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

  const center: [number, number] = mapDetail?.viewState?.center
    ? [mapDetail.viewState.center[0], mapDetail.viewState.center[1]]
    : [10.8231, 106.6297];
  
  const zoom = mapDetail?.viewState?.zoom || 10;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]">
      {/* MAP FULL WIDTH – không có panel trái/phải */}
      <div className="flex-1 min-h-0 relative">
        <StoryMapViewer
          mapId={mapId}
          segments={segments}
          baseMapProvider={mapDetail?.baseLayer || "Satellite"}
          initialCenter={center}
          initialZoom={zoom}
          onSegmentChange={handleSegmentChange}
          // KHÔNG set controlledIndex/controlledPlaying, KHÔNG controlsEnabled=false
          // => UI Play/Stop bên trong StoryMapViewer giống hệt trang control
        />
        
        {/* Legend Panel - Bảng chú giải (chỉ xem, không edit) */}
        <MapEditorLegend
          mapId={mapId}
          segments={segments}
          layers={[]}
          features={[]}
          isCollapsed={legendCollapsed}
          onToggle={() => setLegendCollapsed(!legendCollapsed)}
          isVisible={true}
          isEditMode={false}
        />

        {/* Report Violation Button */}
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={() => setShowReportDialog(true)}
            className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
            title="Báo cáo vi phạm"
          >
            <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Report Violation Dialog */}
      <ReportViolationDialog
        mapId={mapId}
        mapName={mapDetail?.name || "Untitled Map"}
        isOpen={showReportDialog}
        onClose={() => setShowReportDialog(false)}
      />

      {/* BOTTOM: Timeline panel giống y chang file control */}
      <div className="h-24 border-t border-zinc-800 bg-zinc-900/95 px-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSegment(currentIndex - 1)}
            disabled={segments.length === 0 || currentIndex === 0}
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-100 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            ◀ Trước
          </button>
          <button
            onClick={() => goToSegment(currentIndex + 1)}
            disabled={
              segments.length === 0 || currentIndex >= segments.length - 1
            }
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-100 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            Sau ▶
          </button>
        </div>

        <div className="text-xs text-zinc-300 min-w-[110px]">
          Segment{" "}
          <span className="font-semibold text-white">
            {segments.length === 0 ? 0 : currentIndex + 1}
          </span>{" "}
          /{" "}
          <span className="font-semibold text-white">{segments.length}</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-2">
            {segments.map((seg, index) => (
              <button
                key={seg.segmentId}
                onClick={() => goToSegment(index)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                  index === currentIndex
                    ? "bg-blue-500 text-white border-blue-400"
                    : "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                {index + 1}. {seg.name || "Untitled"}
              </button>
            ))}

            {segments.length === 0 && (
              <div className="text-xs text-zinc-500">
                No segments – please add segments in the editor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
