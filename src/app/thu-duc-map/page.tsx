"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

const BOUNDARY_SRC = "/data/ThuDucCity_boundary.json";
const WARDS_SRC = "/data/ThuDucCity_ward.json";
const STORE_KEY = "thu-duc-sketch";
type LType = typeof import("leaflet");

export default function ThuDucMapPage() {
  const params = useSearchParams();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LType | null>(null);
  const mapRef = useRef<any>(null);
  const boundaryRef = useRef<any>(null);
  const wardsRef = useRef<any>(null);
  const sketchRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

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
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const boundary = L.geoJSON(null, {
        style: { color: "#3b82f6", weight: 2, fillColor: "#60a5fa", fillOpacity: 0.08 },
      }).addTo(map);
      boundaryRef.current = boundary;

      const wards = L.geoJSON(null, {
        style: () => ({ color: "#22c55e", weight: 1, fillColor: "#22c55e", fillOpacity: 0.12 }),
        onEachFeature: (f: any, layer: any) => {
          const p = f?.properties ?? {};
          const name = p.name || p.NAME || p.ten || "Khu vực";
          layer.bindPopup(`<b>${name}</b>`);
          layer.on("mouseover", () => layer.setStyle({ weight: 2, fillOpacity: 0.22 }));
          layer.on("mouseout", () => layer.setStyle({ weight: 1, fillOpacity: 0.12 }));
        },
      }).addTo(map);
      wardsRef.current = wards;

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      (map as any).pm.addControls({
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
      map.on("pm:create", (e: any) => sketch.addLayer(e.layer));

      try {
        const b = await loadGeoJSON(BOUNDARY_SRC, boundary);
        map.fitBounds(b.pad(0.05));
      } catch {}

      setReady(true);
    })();
    return () => {
      alive = false;
      mapRef.current?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const layers = (params.get("layers") ?? "").split(",").map((s) => s.trim());
    if (layers.includes("boundary")) handleLoadBoundary();
    if (layers.includes("wards")) handleLoadWards();
  }, [ready, params]);

  async function loadGeoJSON(url: string, targetLayer: any) {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Không tải được ${url}`);
    const gj = await res.json();
    targetLayer.clearLayers();
    targetLayer.addData(gj);
    return targetLayer.getBounds();
  }

  function fitAll() {
    const list = [boundaryRef.current, wardsRef.current, sketchRef.current].filter(
      (l: any) => l && l.getLayers().length
    );
    if (!list.length) return;
    let b = list[0].getBounds();
    for (let i = 1; i < list.length; i++) b = b.extend(list[i].getBounds());
    mapRef.current.fitBounds(b.pad(0.05));
  }

  function serializeSketch() {
    const fc = { type: "FeatureCollection", features: [] as any[] };
    sketchRef.current?.eachLayer((l: any) => {
      const gj = l.toGeoJSON();
      if (gj.type === "Feature") fc.features.push(gj);
      else if (gj.type === "FeatureCollection") fc.features.push(...gj.features);
    });
    return fc;
  }

  const handleLoadBoundary = async () => {
    try {
      const b = await loadGeoJSON(BOUNDARY_SRC, boundaryRef.current);
      mapRef.current.fitBounds(b.pad(0.05));
    } catch (e: any) {
      alert(e?.message || "Không tải được ranh giới");
    }
  };

  const handleLoadWards = async () => {
    try {
      const b = await loadGeoJSON(WARDS_SRC, wardsRef.current);
      mapRef.current.fitBounds(b.pad(0.05));
    } catch (e: any) {
      alert(e?.message || "Không tải được phường/xã");
    }
  };

  const handleImport = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const L = LRef.current!;
        const data = JSON.parse(String(reader.result));
        const layer = (L as any).geoJSON(data);
        layer.eachLayer((l: any) => sketchRef.current.addLayer(l));
        fitAll();
      } catch {
        alert("File không phải GeoJSON hợp lệ.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleExport = () => {
    const fc = serializeSketch();
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawn_sketch.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    const view = { center: mapRef.current.getCenter(), zoom: mapRef.current.getZoom() };
    localStorage.setItem(STORE_KEY, JSON.stringify({ fc: serializeSketch(), view }));
    alert("Đã lưu bản vẽ vào trình duyệt.");
  };

  const handleLoad = () => {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return alert("Chưa có dữ liệu đã lưu.");
    const L = LRef.current!;
    const { fc, view } = JSON.parse(raw);
    sketchRef.current.clearLayers();
    const layer = (L as any).geoJSON(fc);
    layer.eachLayer((l: any) => sketchRef.current.addLayer(l));
    if (view?.center && view?.zoom) mapRef.current.setView(view.center, view.zoom);
    else fitAll();
  };

  const handleResetSave = () => {
    localStorage.removeItem(STORE_KEY);
    alert("Đã xoá dữ liệu đã lưu.");
  };

  const btnBase =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ring-1 transition focus:outline-none";
  const btn = `${btnBase} bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 ring-white/10`;
  const btnPrimary = `${btnBase} bg-emerald-500 text-zinc-950 hover:bg-emerald-400 ring-emerald-400/30`;

  return (
    <main className="relative min-h-[100vh] text-white">
      <div className="fixed inset-x-0 top-16 z-[3000] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-5xl w-full rounded-2xl bg-zinc-950/70 backdrop-blur-md ring-1 ring-white/10 shadow-2xl">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            <button onClick={handleLoadBoundary} disabled={!ready} className={btnPrimary}>Ranh giới</button>
            <button onClick={handleLoadWards} disabled={!ready} className={btnPrimary}>Phường/Xã</button>
            <span className="mx-1 text-white/20">|</span>
            <button onClick={fitAll} disabled={!ready} className={btn}>Fit</button>
            <label className={btn + " cursor-pointer"}>
              Nhập GeoJSON
              <input type="file" accept=".geojson,.json" className="hidden" onChange={(e) => handleImport(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={() => sketchRef.current?.clearLayers()} disabled={!ready} className={btn}>Xoá vẽ</button>
            <button onClick={handleExport} disabled={!ready} className={btnPrimary}>Xuất GeoJSON</button>
            <span className="mx-1 text-white/20">|</span>
            <button onClick={handleSave} disabled={!ready} className={btn}>Lưu</button>
            <button onClick={handleLoad} disabled={!ready} className={btn}>Tải</button>
            <button onClick={handleResetSave} disabled={!ready} className={btn}>Xoá lưu</button>
          </div>
        </div>
      </div>

      <div ref={mapEl} className="w-full" style={{ height: "100vh" }} />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-top.leaflet-left { top: 112px; }
      `}</style>
    </main>
  );
}
