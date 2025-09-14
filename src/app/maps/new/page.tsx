"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { createMap, type CreateMapRequest } from "@/lib/api";

type LNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LLayer = import("leaflet").Layer;
type LFeatureGroup = import("leaflet").FeatureGroup;
type LTileLayer = import("leaflet").TileLayer;
type LatLngTuple = import("leaflet").LatLngTuple;
type LeafletEvent = import("leaflet").LeafletEvent;

type MapWithPM = LMap & {
  pm: {
    addControls: (opts: {
      position?: string;
      drawMarker?: boolean;
      drawPolyline?: boolean;
      drawRectangle?: boolean;
      drawPolygon?: boolean;
      drawCircle?: boolean;
      drawCircleMarker?: boolean;
      drawText?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
    }) => void;
  };
};

type PMCreateEvent = LeafletEvent & { layer: LLayer };
type BaseKey = "osm" | "sat" | "dark";

function NewMapPageInner() {
  const q = useSearchParams();
  const router = useRouter();

  const orgId: string | undefined = q?.get("org") ?? undefined;

  const mapEl = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LNS | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const baseRef = useRef<LTileLayer | null>(null);
  const sketchRef = useRef<LFeatureGroup | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapName, setMapName] = useState("Untitled Map");
  const [description, setDescription] = useState("");
  const [baseLayer, setBaseLayer] = useState<BaseKey>("osm");

  const isMapValid = useCallback((): boolean => {
    const map = mapRef.current as (LMap & { _removed?: boolean; _loaded?: boolean }) | null;
    return !!(map && !map._removed && (map._loaded ?? true));
  }, []);

  const applyBaseLayer = useCallback((kind: BaseKey) => {
    const L = LRef.current;
    const map = mapRef.current as (LMap & { _loaded?: boolean }) | null;
    if (!L || !map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    let layer: LTileLayer;
    if (kind === "sat") {
      layer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, attribution: "Tiles © Esri" }
      );
    } else if (kind === "dark") {
      layer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 20, attribution: "© OpenStreetMap contributors © CARTO" }
      );
    } else {
      layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution: "© OpenStreetMap contributors",
      });
    }

    if ((map as { _loaded?: boolean })._loaded === false) {
      map.whenReady(() => {
        layer.addTo(map);
        baseRef.current = layer;
      });
    } else {
      layer.addTo(map);
      baseRef.current = layer;
    }
  }, []);

  const goMyLocation = useCallback(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const target: LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        map.stop();
        map.invalidateSize();
        map.setView(target, Math.max(map.getZoom(), 16));
        L.circleMarker(target, { radius: 6 }).addTo(map);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

  const saveMap = useCallback(async () => {
    if (!mapName.trim()) {
      alert("Nhập tên bản đồ trước khi lưu.");
      return;
    }
    if (!isMapValid()) {
      alert("Map chưa sẵn sàng.");
      return;
    }

    setSaving(true);
    try {
      const map = mapRef.current!;
      const center = map.getCenter();
      const zoomRaw = map.getZoom();
      const zoom = Math.max(1, Math.min(20, typeof zoomRaw === "number" ? zoomRaw : 13));

      const baseForApi: CreateMapRequest["baseMapProvider"] =
        baseLayer === "osm" ? "OSM" : baseLayer === "sat" ? "Satellite" : "Dark";

      const body: CreateMapRequest = {
        name: mapName.trim(),
        description: description.trim(),
        isPublic: false,
        initialLatitude: center.lat,
        initialLongitude: center.lng,
        initialZoom: zoom,
        baseMapProvider: baseForApi,
        orgId,
      };

      const created = await createMap(body);
      const id = created.mapId;
      router.push(`/maps/${id}?created=1&name=${encodeURIComponent(mapName.trim())}`);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Lưu bản đồ thất bại";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }, [mapName, description, baseLayer, orgId, router, isMapValid]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const L: typeof import("leaflet") = await import("leaflet");
      await import("@geoman-io/leaflet-geoman-free");

      if (!alive || !mapEl.current) return;

      LRef.current = L;

      const map = L.map(mapEl.current, { zoomControl: true }).setView([10.78, 106.69], 13);
      mapRef.current = map;

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      (map as MapWithPM).pm.addControls({
        position: "topleft",
        drawMarker: true,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: true,
        drawCircleMarker: true,
        editMode: true,
        dragMode: true,
        cutPolygon: true,
        removalMode: true,
      });

      map.on("pm:create", (e: LeafletEvent) => {
        const evt = e as PMCreateEvent;
        sketch.addLayer(evt.layer);
      });

      map.whenReady(() => {
        setReady(true);
      });
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      baseRef.current = null;
      sketchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyBaseLayer(baseLayer);
  }, [ready, baseLayer, applyBaseLayer]);

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] w-full max-w-6xl px-4 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            <input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
              placeholder="Tên bản đồ"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-72"
              placeholder="Mô tả (tuỳ chọn)"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">Base</span>
              <select
                value={baseLayer}
                onChange={(e) => setBaseLayer(e.target.value as BaseKey)}
                className="px-2 py-2 rounded-md bg-white text-black text-sm"
              >
                <option value="osm">OSM</option>
                <option value="sat">Satellite</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <button
              className="rounded-xl px-3.5 py-2 text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
              onClick={goMyLocation}
              disabled={!ready || locating}
            >
              {locating ? "Đang lấy vị trí…" : "Vị trí của tôi"}
            </button>
            <button
              className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
              onClick={() => sketchRef.current?.clearLayers()}
              disabled={!ready}
            >
              Xoá vẽ
            </button>
            <button
              className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
              onClick={() => void saveMap()}
              disabled={!ready || saving}
            >
              {saving ? "Đang lưu…" : "Lưu và chỉnh sửa"}
            </button>
          </div>
        </div>
      </div>

      <div ref={mapEl} className="absolute inset-0" />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-top.leaflet-left {
          top: 88px;
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </main>
  );
}

export default function NewMapPage() {
  return (
    <Suspense fallback={<div className="p-4 text-zinc-400">Đang tải…</div>}>
      <NewMapPageInner />
    </Suspense>
  );
}
