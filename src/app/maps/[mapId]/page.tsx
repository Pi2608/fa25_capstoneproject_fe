"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, TileLayer, LatLngTuple, Layer, FeatureGroup, LatLng, LatLngBounds } from "leaflet";
import {
  getMapDetail,
  type MapDetail,
  updateMap,
  type UpdateMapRequest,
  getActiveUserAccessTools,
  type UserAccessTool
} from "@/lib/api";
import type { Position } from "geojson";
import { saveFeature, addLayerToList, renameLayer, removeLayerFromList, toggleLayerVisibility } from "@/lib/mapUtils";
import { LayerPanel, type LayerPanelProps } from "@/components/map/MapControls";

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
      drawText?: boolean;
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

interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  layer: Layer;
  order: number;
}

interface GeoJSONLayer extends Layer {
  feature?: {
    type?: string;
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: Position | Position[] | Position[][] | Position[][][];
    };
  };
}

interface ExtendedLayer extends GeoJSONLayer {
  _mRadius?: number;                                // Circle
  _latlng?: LatLng;                                 // Marker
  _latlngs?: LatLng[] | LatLng[][] | LatLng[][][];  // Polyline / Polygon / MultiPolygon
  _bounds?: LatLngBounds;                           // Rectangle
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
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [locating, setLocating] = useState(false);

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

  // Geoman custom actions
  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text" ) => {
    mapRef.current?.pm.enableDraw(shape);
  };

  const toggleEdit = () => {
    mapRef.current?.pm.toggleGlobalEditMode();
  };

  const toggleDelete = () => {
    mapRef.current?.pm.toggleGlobalRemovalMode();
  };

  const toggleDrag = () => {
    mapRef.current?.pm.toggleGlobalDragMode();
  };

  const enableCutPolygon = () => {
    mapRef.current?.pm.enableGlobalCutMode();
  };

  const toggleRotate = () => {
    mapRef.current?.pm.toggleGlobalRotateMode();
  };

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

      const map = L.map(el as HTMLElement, { zoomControl: false }).setView(center, detail.initialZoom) as MapWithPM;
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
        drawMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawPolygon: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawText: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        rotateMode: false,
        removalMode: false,
      });

      map.on("pm:create", async (e: PMCreateEvent) => {
        sketch.addLayer(e.layer);
        const newFeature = await saveFeature(
          detail.id,
          e.layer as ExtendedLayer,
          layers,
          setLayers
        );
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
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const target: LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        map.stop();
        map.invalidateSize();
        map.setView(target, Math.max(map.getZoom(), 16));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const clearSketch = useCallback(() => {
    sketchRef.current?.clearLayers();
    setLayers([]);
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

  const GuardBtn: React.FC<
    React.PropsWithChildren<{ can: boolean; title: string; onClick?: () => void; disabled?: boolean }>
  > = ({ can, title, onClick, disabled, children }) => {
    // if (!can) return null;
    if (can) return null;
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
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={() => enableDraw("Text")}
                disabled={!mapRef.current}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20V4m7 2V4H5v2m9 14h-4"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={toggleRotate}
                disabled={!mapRef.current}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.95 11a8 8 0 1 0-.5 4m.5 5v-5h-5"/>
                </svg>
              </button>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                onClick={enableCutPolygon}
                disabled={!mapRef.current}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48">
                  <g fill="none" stroke="currentColor" strokeWidth="4">
                    <path strokeLinejoin="round" d="M11 42a5 5 0 1 0 0-10a5 5 0 0 0 0 10Zm26 0a5 5 0 1 0 0-10a5 5 0 0 0 0 10Z"/>
                    <path strokeLinecap="round" d="m15.377 39.413l2.123-3.597l17-29.445"/><path strokeLinecap="round" d="m13.496 6.175l17 29.445l2.13 3.793"/>
                  </g>
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
              <label className="px-3 py-2 rounded-md bg-transparent text-white text-sm cursor-pointer hover:bg-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="currentColor" fillRule="evenodd" d="M12 2a6 6 0 0 0-5.476 3.545a23 23 0 0 1-.207.452l-.02.001C6.233 6 6.146 6 6 6a4 4 0 1 0 0 8h.172l2-2H6a2 2 0 1 1 0-4h.064c.208 0 .45.001.65-.04a1.9 1.9 0 0 0 .7-.27c.241-.156.407-.35.533-.527a2.4 2.4 0 0 0 .201-.36q.08-.167.196-.428l.004-.01a4.001 4.001 0 0 1 7.304 0l.005.01q.115.26.195.428c.046.097.114.238.201.36c.126.176.291.371.533.528c.242.156.487.227.7.27c.2.04.442.04.65.04L18 8a2 2 0 1 1 0 4h-2.172l2 2H18a4 4 0 0 0 0-8c-.146 0-.233 0-.297-.002h-.02l-.025-.053a24 24 0 0 1-.182-.4A6 6 0 0 0 12 2m5.702 4.034" clipRule="evenodd"/>
                  <path fill="currentColor" d="m12 12l-.707-.707l.707-.707l.707.707zm1 9a1 1 0 1 1-2 0zm-5.707-5.707l4-4l1.414 1.414l-4 4zm5.414-4l4 4l-1.414 1.414l-4-4zM13 12v9h-2v-9z"/>
                </svg>
                <input
                  type="file"
                  accept=".geojson,.json,.kml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const data = JSON.parse(reader.result as string);
                          if (mapRef.current) {
                            const L = (await import("leaflet")).default;
                            const geoLayer = L.geoJSON(data, {
                              style: {
                                color: "red",
                                weight: 2,
                                fillOpacity: 0.1,
                              }
                            });

                            if (sketchRef.current) {
                              sketchRef.current.addLayer(geoLayer);
                              mapRef.current.fitBounds(geoLayer.getBounds());
                            }
                          }
                        } catch (err) {
                          alert("File không hợp lệ hoặc không phải GeoJSON!");
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
                  onClick={saveView}
                  disabled={busySaveView || !mapRef.current}
                  title="Lưu tâm & zoom hiện tại"
                >
                  {busySaveView ? "Saving view…" : "Save view"}
                </button>
                <button
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
                  onClick={saveMeta}
                  disabled={busySaveMeta}
                >
                  {busySaveMeta ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>

          {feedback && <div className="px-1 pt-2 text-center text-xs text-emerald-300">{feedback}</div>}
        </div>
      </div>

      <div ref={mapEl} className="absolute inset-0" />

      <LayerPanel
        layers={layers}
        showLayerPanel={showLayerPanel}
        setShowLayerPanel={setShowLayerPanel}
        renameLayer={(id: string, name: string) => setLayers(prev => renameLayer(prev, id, name))}
        toggleLayerVisibility={(id: string) => setLayers(prev => toggleLayerVisibility(prev, id, mapRef.current, sketchRef.current))}
        removeLayerFromList={(id: string) =>
          setLayers(prev => removeLayerFromList(prev, id, mapRef.current, sketchRef.current))
        }
        clearLayers={() => {
          sketchRef.current?.clearLayers();
          setLayers([]);
        }}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-top.leaflet-left .leaflet-control { display: none !important; }
      `}</style>
    </main>
  );
}