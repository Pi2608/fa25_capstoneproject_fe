// src/app/thu-duc-map/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type {
  Map,
  Layer,
  LatLngExpression,
  FeatureGroup,
  PopupOptions,
} from "leaflet";
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  Feature as GJFeature,
} from "geojson";

const BOUNDARY_SRC = "/data/ThuDucCity_boundary.json";
const WARDS_SRC = "/data/ThuDucCity_ward.json";
const STORE_KEY = "thu-duc-sketch";

type WardProps = { name?: string; NAME?: string; ten?: string } & Record<
  string,
  unknown
>;
type LGeoJSON = import("leaflet").GeoJSON;

type MapWithPM = Map & {
  pm: {
    addControls: (options: {
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

type LType = typeof import("leaflet");
type PMCreateEvent = { layer: Layer };

type PopupLayer = Layer & {
  bindPopup: (content: string | HTMLElement, options?: PopupOptions) => Layer;
  setStyle?: (s: object) => void;
  on: (event: string, handler: () => void) => PopupLayer;
};

/** --------- NEW: bọc Suspense quanh component con --------- */
export default function ThuDucMapPage() {
  return (
    <Suspense fallback={<div className="p-4 text-white">Đang tải bản đồ…</div>}>
      <MapClient />
    </Suspense>
  );
}

function MapClient() {
  const params = useSearchParams();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LType | null>(null);
  const mapRef = useRef<Map | null>(null);

  const boundaryRef = useRef<LGeoJSON | null>(null);
  const wardsRef = useRef<LGeoJSON | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);

  const [ready, setReady] = useState(false);

  const loadGeoJSON = useCallback(async (url: string, targetLayer: LGeoJSON) => {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Không tải được ${url}`);
    const data: GeoJsonObject = await res.json();
    targetLayer.clearLayers();
    targetLayer.addData(data);
    return targetLayer.getBounds();
  }, []);

  const handleLoadBoundary = useCallback(async () => {
    try {
      if (!boundaryRef.current) return;
      const bounds = await loadGeoJSON(BOUNDARY_SRC, boundaryRef.current);
      mapRef.current!.fitBounds(bounds.pad(0.05));
    } catch (e) {
      alert((e as Error).message || "Không tải được ranh giới");
    }
  }, [loadGeoJSON]);

  const handleLoadWards = useCallback(async () => {
    try {
      if (!wardsRef.current) return;
      const bounds = await loadGeoJSON(WARDS_SRC, wardsRef.current);
      mapRef.current!.fitBounds(bounds.pad(0.05));
    } catch (e) {
      alert((e as Error).message || "Không tải được phường/xã");
    }
  }, [loadGeoJSON]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");
      if (!alive || !mapEl.current) return;
      LRef.current = L;

      const map = L.map(mapEl.current).setView([10.85, 106.75], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const boundary = L.geoJSON(undefined, {
        style: {
          color: "#3b82f6",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.08,
        },
      }) as unknown as LGeoJSON;
      boundary.addTo(map);
      boundaryRef.current = boundary;

      const wards = L.geoJSON(undefined, {
        style: () => ({
          color: "#22c55e",
          weight: 1,
          fillColor: "#22c55e",
          fillOpacity: 0.12,
        }),
        onEachFeature: (feature: GJFeature | null, layer: Layer) => {
          const props = (feature?.properties ?? {}) as WardProps;
          const name = props.name || props.NAME || props.ten || "Khu vực";

          const pl = layer as PopupLayer;
          pl.bindPopup(`<b>${name}</b>`);
          pl.on("mouseover", () =>
            pl.setStyle?.({
              weight: 2,
              fillOpacity: 0.22,
            })
          );
          pl.on("mouseout", () =>
            pl.setStyle?.({
              weight: 1,
              fillOpacity: 0.12,
            })
          );
        },
      }) as unknown as LGeoJSON;
      wards.addTo(map);
      wardsRef.current = wards;

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

      map.on("pm:create", (e: PMCreateEvent) => {
        sketch.addLayer(e.layer);
      });

      try {
        const bounds = await loadGeoJSON(BOUNDARY_SRC, boundary);
        map.fitBounds(bounds.pad(0.05));
      } catch {
        /* ignore */
      }

      setReady(true);
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
    };
  }, [loadGeoJSON]);

  useEffect(() => {
    if (!ready) return;
    const layersParam = params?.get("layers") ?? "";
    const layers = layersParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (layers.includes("boundary")) handleLoadBoundary();
    if (layers.includes("wards")) handleLoadWards();
  }, [ready, params, handleLoadBoundary, handleLoadWards]);

  function fitAll() {
    const layers = [boundaryRef.current, wardsRef.current, sketchRef.current].filter(
      (l): l is FeatureGroup =>
        !!l && (l as FeatureGroup).getLayers?.().length > 0
    );
    if (!layers.length) return;
    let bounds = (layers[0] as FeatureGroup).getBounds();
    for (let i = 1; i < layers.length; i++) {
      bounds = bounds.extend((layers[i] as FeatureGroup).getBounds());
    }
    mapRef.current?.fitBounds(bounds.pad(0.05));
  }

  function serializeSketch(): FeatureCollection {
    const features: Feature[] = [];
    sketchRef.current?.eachLayer((layer) => {
      const gj = (layer as Layer & { toGeoJSON: () => GeoJsonObject }).toGeoJSON();
      if (gj.type === "Feature") features.push(gj as Feature);
      else if (gj.type === "FeatureCollection")
        features.push(...(gj as FeatureCollection).features);
    });
    return { type: "FeatureCollection", features };
  }

  function handleImport(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const L = LRef.current!;
        const data: GeoJsonObject = JSON.parse(String(reader.result));
        const layer = L.geoJSON(data) as unknown as LGeoJSON;
        layer.eachLayer((l: Layer) => sketchRef.current?.addLayer(l));
        fitAll();
      } catch {
        alert("File không phải GeoJSON hợp lệ.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function handleExport() {
    const fc = serializeSketch();
    const blob = new Blob([JSON.stringify(fc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawn_sketch.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSave() {
    const view = {
      center: mapRef.current!.getCenter(),
      zoom: mapRef.current!.getZoom(),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify({ fc: serializeSketch(), view }));
    alert("Đã lưu bản vẽ vào trình duyệt.");
  }

  function handleLoad() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return alert("Chưa có dữ liệu đã lưu.");
    const L = LRef.current!;
    const { fc, view } = JSON.parse(raw) as {
      fc: FeatureCollection;
      view: { center: LatLngExpression; zoom: number };
    };
    sketchRef.current?.clearLayers();
    const layer = L.geoJSON(fc) as unknown as LGeoJSON;
    layer.eachLayer((l: Layer) => sketchRef.current?.addLayer(l));
    if (view?.center && view?.zoom)
      mapRef.current?.setView(view.center, view.zoom);
    else fitAll();
  }

  function handleResetSave() {
    localStorage.removeItem(STORE_KEY);
    alert("Đã xoá dữ liệu đã lưu.");
  }

  const btnBase =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ring-1 transition focus:outline-none";
  const btn = `${btnBase} bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 ring-white/10`;
  const btnPrimary = `${btnBase} bg-emerald-500 text-zinc-950 hover:bg-emerald-400 ring-emerald-400/30`;

  return (
    <main className="relative min-h-[100vh] text-white">
      <div className="fixed inset-x-0 top-16 z-[3000] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-5xl w-full rounded-2xl bg-zinc-950/70 backdrop-blur-md ring-1 ring-white/10 shadow-2xl">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            <button onClick={handleLoadBoundary} disabled={!ready} className={btnPrimary}>
              Ranh giới
            </button>
            <button onClick={handleLoadWards} disabled={!ready} className={btnPrimary}>
              Phường/Xã
            </button>
            <span className="mx-1 text-white/20">|</span>
            <button onClick={fitAll} disabled={!ready} className={btn}>
              Fit
            </button>
            <label className={`${btn} cursor-pointer`}>
              Nhập GeoJSON
              <input
                type="file"
                accept=".geojson,.json"
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={() => sketchRef.current?.clearLayers()}
              disabled={!ready}
              className={btn}
            >
              Xoá vẽ
            </button>
            <button onClick={handleExport} disabled={!ready} className={btnPrimary}>
              Xuất GeoJSON
            </button>
            <span className="mx-1 text-white/20">|</span>
            <button onClick={handleSave} disabled={!ready} className={btn}>
              Lưu
            </button>
            <button onClick={handleLoad} disabled={!ready} className={btn}>
              Tải
            </button>
            <button onClick={handleResetSave} disabled={!ready} className={btn}>
              Xoá lưu
            </button>
          </div>
        </div>
      </div>

      <div ref={mapEl} className="w-full" style={{ height: "100vh" }} />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-top.leaflet-left {
          top: 112px;
        }
      `}</style>
    </main>
  );
}
