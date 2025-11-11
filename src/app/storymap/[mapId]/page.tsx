"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSegments, Segment } from "@/lib/api-storymap";
import { getMapDetail } from "@/lib/api-maps";
import StoryMapViewer from "@/components/storymap/StoryMapViewer";
import * as signalR from "@microsoft/signalr";
import { getToken } from "@/lib/api-core";

export default function StoryMapPlayerPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const mapId = params?.mapId ?? "";

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mapDetail, setMapDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlledIndex, setControlledIndex] = useState<number>();
  const [controlledPlaying, setControlledPlaying] = useState<boolean>();

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

        if (detail.status !== "Published" && !detail.isPublic) {
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

  // Broadcast channel for control sync
  useEffect(() => {
    if (typeof window === 'undefined' || !mapId) return;

    const channel = new BroadcastChannel(`storymap-${mapId}`);
    
    channel.onmessage = (event) => {
      console.log('[Viewer] Received:', event.data);
      if (event.data.type === 'segment-change') {
        setControlledIndex(event.data.segmentIndex);
      } else if (event.data.type === 'play-state') {
        setControlledPlaying(event.data.isPlaying);
      }
    };

    console.log('[Viewer] Listening on channel:', `storymap-${mapId}`);

    return () => channel.close();
  }, [mapId]);

  // SignalR: join as viewer for cross-device sync
  useEffect(() => {
    let connection: signalR.HubConnection | null = null;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    // StoryHub is mapped at app root: /hubs/story (not under /api/v1)
    const hubBase = apiBase ? apiBase.replace(/\/api(\/v\d+)?$/i, "") : undefined;
    const token = getToken();

    if (!mapId || !hubBase || !token) {
      return;
    }

    (async () => {
      try {
        connection = new signalR.HubConnectionBuilder()
          .withUrl(`${hubBase}/hubs/story`, {
            accessTokenFactory: () => token,
            withCredentials: true,
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          })
          .withAutomaticReconnect()
          .configureLogging(signalR.LogLevel.Information)
          .build();

        // listeners
        connection.on("SessionNotFound", () => {
          setError("Phiên điều khiển không tồn tại hoặc đã kết thúc");
        });

        connection.on("StoryStepChanged", (state: any) => {
          // Expecting { segmentIndex?: number, isPlaying?: boolean } from backend
          if (typeof state?.segmentIndex === "number") {
            setControlledIndex(state.segmentIndex);
          }
          if (typeof state?.isPlaying === "boolean") {
            setControlledPlaying(state.isPlaying);
          }
        });

        connection.on("SessionEnded", () => {
          setControlledPlaying(false);
          setError("Phiên điều khiển đã kết thúc");
        });

        connection.on("JoinedSession", (_payload: any) => {
          // Optional: could display viewer count or initial state already handled by StoryStepChanged
          // Intentionally no-op for viewer UI
        });

        await connection.start();
        await connection.invoke("JoinAsViewer", mapId);
      } catch (e) {
        console.warn("[StoryMap Viewer] SignalR connection failed:", e);
      }
    })();

    return () => {
      if (connection) {
        void connection.stop();
      }
    };
  }, [mapId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white text-xl">Loading Story Map...</div>
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
    <div className="h-screen">
      <StoryMapViewer
        mapId={mapId}
        segments={segments}
        baseMapProvider={mapDetail?.baseMapProvider}
        initialCenter={center}
        initialZoom={mapDetail?.defaultZoom || 10}
        controlledIndex={controlledIndex}
        controlledPlaying={controlledPlaying}
        controlsEnabled={false}
      />
    </div>
  );
}
