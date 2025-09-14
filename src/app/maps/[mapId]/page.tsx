"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type {
  Map as LMap,
  TileLayer,
  LatLngTuple,
  Layer,
  FeatureGroup,
} from "leaflet";
import {
  getMapDetail,
  type MapDetail,
  updateMap,
  type UpdateMapRequest,
} from "@/lib/api";

type BaseKey = "osm" | "sat" | "dark";

type MapWithPM = LMap & {
  pm: {
    addControls: (opts: {
      position: string;
      drawMarker: boolean;
      drawPolyline: boolean;
      drawRectangle: boolean;
      drawPolygon: boolean;
      drawCircle: boolean;
      drawCircleMarker: boolean;
      editMode: boolean;
      dragMode: boolean;
      cutPolygon: boolean;
      removalMode: boolean;
    }) => void;
  };
};

interface PMCreateEvent {
  layer: Layer;
}

export default function EditMapPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";
  const sp = useSearchParams();

  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [busySaveMeta, setBusySaveMeta] = useState<boolean>(false);
  const [busySaveView, setBusySaveView] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");

  const justCreated = (sp?.get("created") ?? "") === "1";
  const createdName = sp?.get("name") ?? "";

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);

  useEffect(() => {
    if (!mapId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const m = await getMapDetail(mapId);
        if (!alive) return;
        setDetail(m);
        setName(m.mapName ?? "");
        setDescription(m.description ?? "");
        setBaseKey(
          m.baseMapProvider === "Satellite"
            ? "sat"
            : m.baseMapProvider === "Dark"
              ? "dark"
              : "osm"
        );
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không tải được bản đồ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mapId]);

  const applyBaseLayer = useCallback((key: BaseKey) => {
    const map = mapRef.current;
    if (!map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    (async () => {
      const L = (await import("leaflet")).default;
      let layer: TileLayer;
      if (key === "sat") {
        layer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 20, attribution: "Tiles © Esri" }
        );
      } else if (key === "dark") {
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
      layer.addTo(map);
      baseRef.current = layer;
    })();
  }, []);

  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;

    const el = mapEl.current; 

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");

      const center: LatLngTuple = [
        detail.initialLatitude,
        detail.initialLongitude,
      ];

      const map = L.map(el as HTMLElement, { zoomControl: true }).setView(
        center,
        detail.initialZoom
      ) as MapWithPM;

      mapRef.current = map;

      applyBaseLayer(
        detail.baseMapProvider === "Satellite"
          ? "sat"
          : detail.baseMapProvider === "Dark"
            ? "dark"
            : "osm"
      );

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      map.pm.addControls({
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

      map.on("pm:create", (e: PMCreateEvent) => {
        sketch.addLayer(e.layer);
      });
    })();

    return () => {
      mapRef.current?.remove();
    };
  }, [detail, applyBaseLayer]);

  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

  const goMyLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const target: LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        map.stop();
        map.invalidateSize();
        map.setView(target, Math.max(map.getZoom(), 16));
      },
      () => { },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const clearSketch = useCallback(() => {
    sketchRef.current?.clearLayers();
  }, []);

  const saveMeta = useCallback(async () => {
    if (!detail) return;
    setBusySaveMeta(true);
    setFeedback(null);
    try {
      const body: UpdateMapRequest = {
        name: (name ?? "").trim() || "Untitled Map",
        description: (description ?? "").trim() || undefined,
        baseMapProvider:
          baseKey === "osm" ? "OSM" : baseKey === "sat" ? "Satellite" : "Dark",
      };
      await updateMap(detail.id, body);
      setFeedback("Đã lưu thông tin bản đồ.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveMeta(false);
      setTimeout(() => setFeedback(null), 1800);
    }
  }, [detail, name, description, baseKey]);

  const saveView = useCallback(async () => {
    if (!detail || !mapRef.current) return;
    setBusySaveView(true);
    setFeedback(null);
    try {
      const c = mapRef.current.getCenter();
      const view = {
        center: [c.lat, c.lng] as [number, number],
        zoom: mapRef.current.getZoom(),
      };
      const body: UpdateMapRequest = { viewState: JSON.stringify(view) };
      await updateMap(detail.id, body);
      setFeedback("Đã lưu vị trí hiển thị.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveView(false);
      setTimeout(() => setFeedback(null), 1800);
    }
  }, [detail]);

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[3000] w-full max-w-6xl px-3 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-black/75 backdrop-blur-md ring-1 ring-white/15 shadow-2xl">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            <input
              type="text"
              value={name ?? ""}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
              placeholder="Tên bản đồ"
            />
            <input
              type="text"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-72"
              placeholder="Mô tả (tuỳ chọn)"
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">Base</span>
              <select
                value={baseKey}
                onChange={(e) => setBaseKey(e.target.value as BaseKey)}
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
              disabled={!mapRef.current}
            >
              Vị trí của tôi
            </button>
            <button
              className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
              onClick={clearSketch}
              disabled={!mapRef.current}
            >
              Xoá vẽ
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
                onClick={saveView}
                disabled={busySaveView || !mapRef.current}
                title="Lưu tâm & zoom hiện tại"
              >
                {busySaveView ? "Đang lưu view…" : "Save view"}
              </button>
              <button
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
                onClick={saveMeta}
                disabled={busySaveMeta}
              >
                {busySaveMeta ? "Đang lưu…" : "Save"}
              </button>
            </div>
          </div>
          {feedback && (
            <div className="px-4 pb-2 text-xs text-emerald-300">{feedback}</div>
          )}
        </div>
      </div>

      {justCreated && (
        <div className="absolute left-1/2 top-[72px] z-[3000] -translate-x-1/2 w-[min(96vw,48rem)] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-emerald-200">
          Đã tạo bản đồ <b>{createdName || detail?.mapName || mapId}</b>. Bạn có
          thể chỉnh sửa tại đây.
        </div>
      )}

      {loading && <div className="p-4 text-zinc-400">Đang tải…</div>}
      {err && <div className="p-4 text-red-400">{err}</div>}

      <div ref={mapEl} className="absolute inset-0" />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </main>
  );
}
