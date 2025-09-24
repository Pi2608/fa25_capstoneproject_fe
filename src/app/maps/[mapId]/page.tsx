"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, TileLayer, LatLngTuple, Layer, FeatureGroup } from "leaflet";
import {
  getMapDetail,
  type MapDetail,
  updateMap,
  type UpdateMapRequest,
  getActiveUserAccessTools,
  type UserAccessTool,
} from "@/lib/api";

type BaseKey = "osm" | "sat" | "dark";

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
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
      rotateMode?: boolean;
    }) => void;
    enableDraw: (
      shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text"
    ) => void;
    toggleGlobalEditMode: () => void;
    toggleGlobalRemovalMode: () => void;
    toggleGlobalDragMode: () => void;
    enableGlobalCutMode: () => void;
    toggleGlobalRotateMode?: () => void;
  };
};
type PMCreateEvent = { layer: Layer };

function normalizeToolName(
  name?: string | null
): "Marker" | "Line" | "Polygon" | "Circle" | "Text" | "Route" | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n === "pin" || n === "marker") return "Marker";
  if (n === "line") return "Line";
  if (n === "route") return "Route";
  if (n === "polygon") return "Polygon";
  if (n === "circle") return "Circle";
  if (n === "text") return "Text";
  return null;
}

export default function EditMapPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";
  const sp = useSearchParams();

  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);

  const [toolsLoading, setToolsLoading] = useState(true);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const perms = useMemo(() => {
    const has = (n: string) => allowed.has(n);
    return {
      marker: has("Marker"),
      line: has("Line") || has("Route"),
      polygon: has("Polygon"),
      rectangle: has("Polygon"),
      circle: has("Circle"),
      text: has("Text"),
      cut: has("Polygon"),
      rotate: has("Polygon"),
    };
  }, [allowed]);

  const [busySaveMeta, setBusySaveMeta] = useState(false);
  const [busySaveView, setBusySaveView] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
        setBaseKey(m.baseMapProvider === "Satellite" ? "sat" : m.baseMapProvider === "Dark" ? "dark" : "osm");
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setToolsLoading(true);
        const list = await getActiveUserAccessTools();
        const names = new Set<string>();
        (list ?? []).forEach((t: UserAccessTool) => {
          const key = normalizeToolName(t.name);
          if (key) names.add(key);
        });
        if (alive) setAllowed(names);
      } catch {
        if (alive) setAllowed(new Set());
      } finally {
        if (alive) setToolsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
        layer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
          attribution: "© OpenStreetMap contributors © CARTO",
        });
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

      const center: LatLngTuple = [detail.initialLatitude, detail.initialLongitude];

      const map = L.map(el as HTMLElement, { zoomControl: false }).setView(center, detail.initialZoom) as MapWithPM;
      mapRef.current = map;

      applyBaseLayer(detail.baseMapProvider === "Satellite" ? "sat" : detail.baseMapProvider === "Dark" ? "dark" : "osm");

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      map.pm.addControls({
        position: "topleft",
        drawMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawPolygon: false,
        drawCircle: false,
        drawCircleMarker: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
        rotateMode: false,
      });

      map.on("pm:create", (e: PMCreateEvent) => {
        sketch.addLayer(e.layer);
      });
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      baseRef.current = null;
      sketchRef.current = null;
    };
  }, [detail, applyBaseLayer]);

  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

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
        baseMapProvider: baseKey === "osm" ? "OSM" : baseKey === "sat" ? "Satellite" : "Dark",
      };
      await updateMap(detail.id, body);
      setFeedback("Đã lưu thông tin bản đồ.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveMeta(false);
      setTimeout(() => setFeedback(null), 1600);
    }
  }, [detail, name, description, baseKey]);

  const saveView = useCallback(async () => {
    if (!detail || !mapRef.current) return;
    setBusySaveView(true);
    setFeedback(null);
    try {
      const c = mapRef.current.getCenter();
      const view = { center: [c.lat, c.lng] as [number, number], zoom: mapRef.current.getZoom() };
      const body: UpdateMapRequest = { viewState: JSON.stringify(view) };
      await updateMap(detail.id, body);
      setFeedback("Đã lưu vị trí hiển thị.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveView(false);
      setTimeout(() => setFeedback(null), 1600);
    }
  }, [detail]);

  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") => {
    mapRef.current?.pm.enableDraw(shape);
  };
  const enableCutPolygon = () => mapRef.current?.pm.enableGlobalCutMode();
  const toggleRotate = () => mapRef.current?.pm.toggleGlobalRotateMode?.();

  const GuardBtn: React.FC<
    React.PropsWithChildren<{ can: boolean; title: string; onClick?: () => void; disabled?: boolean }>
  > = ({ can, title, onClick, disabled, children }) => {
    if (!can) return null;
    return (
      <button
        className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
        title={title}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl py-2 px-4">
          <div className="grid grid-cols-3 place-items-stretch gap-2">
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            </div>

            <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
              <GuardBtn can={perms.marker} title="Vẽ điểm" onClick={() => enableDraw("Marker")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.line} title="Vẽ đường" onClick={() => enableDraw("Line")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="7" r="2" />
                  <circle cx="19" cy="17" r="2" />
                  <path d="M7 8.5 17 15.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.polygon} title="Vẽ vùng" onClick={() => enableDraw("Polygon")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.rectangle} title="Vẽ hình chữ nhật" onClick={() => enableDraw("Rectangle")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="12" rx="1.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.circle} title="Vẽ hình tròn" onClick={() => enableDraw("Circle")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.text} title="Thêm chữ" onClick={() => enableDraw("Text")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M12 6v12" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.cut} title="Cắt polygon" onClick={enableCutPolygon} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="8" r="2" />
                  <circle cx="5.5" cy="16" r="2" />
                  <path d="M8 9l12 8M8 15l12-8" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.rotate} title="Xoay đối tượng" onClick={toggleRotate} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 1-2.2-5.5" />
                  <path d="M20 4v7h-7" />
                </svg>
              </GuardBtn>
            </div>

            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
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
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
                onClick={saveView}
                disabled={busySaveView || !mapRef.current}
                title="Lưu tâm & zoom hiện tại"
              >
                {busySaveView ? "Đang lưu view…" : "Save view"}
              </button>

              <button
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-800 hover:bg-zinc-700"
                onClick={clearSketch}
                disabled={!mapRef.current}
              >
                Xoá vẽ
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

          {feedback && <div className="px-1 pt-2 text-center text-xs text-emerald-300">{feedback}</div>}
        </div>
      </div>

      {loading && <div className="p-4 text-zinc-400">Đang tải…</div>}
      {err && <div className="p-4 text-red-400">{err}</div>}

      <div ref={mapEl} className="absolute inset-0" />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-top.leaflet-left .leaflet-control { display: none !important; }
      `}</style>
    </main>
  );
}
