// "use client";

// import { Suspense, useCallback, useEffect, useRef, useState } from "react";
// import { useParams, useSearchParams, useRouter } from "next/navigation";
// import { useUserTools } from "@/hooks/useUserTools";
// import { createMap, type CreateMapRequest } from "@/lib/api";

// type L = typeof import("leaflet");
// type Map = import("leaflet").Map;
// type Layer = import("leaflet").Layer;
// type FeatureGroup = import("leaflet").FeatureGroup;
// type GeoJsonObject = import("geojson").GeoJsonObject;
// type Feature = import("geojson").Feature;
// type FeatureCollection = import("geojson").FeatureCollection;

// type MapWithPM = Map & {
//   pm: {
//     addControls: (opts: {
//       position: string;
//       drawMarker: boolean;
//       drawPolyline: boolean;
//       drawRectangle: boolean;
//       drawPolygon: boolean;
//       drawCircle: boolean;
//       drawCircleMarker: boolean;
//       editMode: boolean;
//       dragMode: boolean;
//       cutPolygon: boolean;
//       removalMode: boolean;
//     }) => void;
//   };
// };
// type PMCreateEvent = { layer: Layer };

// const STORE_KEY_PREFIX = "new-map-draft";

// export default function NewMapPage() {
//   return (
//     <Suspense fallback={<div className="p-4 text-white">Đang tải bản đồ…</div>}>
//       <Client />
//     </Suspense>
//   );
// }

// function Client() {
//   const { orgId } = useParams<{ orgId: string }>();
//   const q = useSearchParams();
//   const router = useRouter();
//   const { loading, error, isAllowed } = useUserTools(orgId);

//   const mapEl = useRef<HTMLDivElement | null>(null);
//   const LRef = useRef<L | null>(null);
//   const mapRef = useRef<Map | null>(null);
//   const baseRef = useRef<import("leaflet").TileLayer | null>(null);
//   const sketchRef = useRef<FeatureGroup | null>(null);

//   const [ready, setReady] = useState(false);
//   const [locating, setLocating] = useState(false);
//   const [mapName, setMapName] = useState("Untitled Map");
//   const [baseLayer, setBaseLayer] = useState<"osm" | "sat" | "dark">("osm");
//   const [saving, setSaving] = useState(false);

//   const storeKey = `${STORE_KEY_PREFIX}:${orgId}`;

//   const serialize = useCallback((): FeatureCollection => {
//     const feats: Feature[] = [];
//     sketchRef.current?.eachLayer((layer) => {
//       const any = layer as unknown as { toGeoJSON?: () => GeoJsonObject };
//       const gj = any.toGeoJSON?.();
//       if (!gj) return;
//       if (gj.type === "Feature") feats.push(gj as Feature);
//       else if (gj.type === "FeatureCollection") feats.push(...(gj as FeatureCollection).features);
//     });
//     return { type: "FeatureCollection", features: feats };
//   }, []);

//   const exportGeoJSON = useCallback(() => {
//     const fc = serialize();
//     const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/json" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `${mapName || "map"}.geojson`;
//     a.click();
//     URL.revokeObjectURL(url);
//   }, [serialize, mapName]);

//   const saveDraft = useCallback(() => {
//     if (!mapRef.current) return;
//     const view = { center: mapRef.current.getCenter(), zoom: mapRef.current.getZoom() };
//     const fc = serialize();
//     localStorage.setItem(storeKey, JSON.stringify({ view, fc, baseLayer, mapName }));
//   }, [serialize, storeKey, baseLayer, mapName]);

//   const loadDraft = useCallback(() => {
//     const raw = localStorage.getItem(storeKey);
//     if (!raw) return;
//     try {
//       const L = LRef.current!;
//       const data = JSON.parse(raw) as {
//         view?: { center: [number, number]; zoom: number };
//         fc?: FeatureCollection;
//         baseLayer?: typeof baseLayer;
//         mapName?: string;
//       };
//       sketchRef.current?.clearLayers();
//       if (data.fc) {
//         const layer = (L.geoJSON(data.fc) as unknown) as FeatureGroup;
//         layer.eachLayer((l: Layer) => sketchRef.current?.addLayer(l));
//       }
//       if (data.view) mapRef.current?.setView(data.view.center, data.view.zoom);
//       if (data.baseLayer) setBaseLayer(data.baseLayer);
//       if (data.mapName) setMapName(data.mapName);
//       else fitAll();
//     } catch {}
//   }, [storeKey]);

//   const clearSketch = useCallback(() => {
//     sketchRef.current?.clearLayers();
//   }, []);

//   const fitAll = useCallback(() => {
//     const L = LRef.current!;
//     const group = L.featureGroup([sketchRef.current as any]).getLayers().filter(Boolean) as FeatureGroup[];
//     const have = group.some((g) => g.getLayers().length > 0);
//     if (!have) return;
//     let bounds = group[0].getBounds();
//     for (let i = 1; i < group.length; i++) bounds = bounds.extend(group[i].getBounds());
//     mapRef.current?.fitBounds(bounds.pad(0.05));
//   }, []);

//   const applyBaseLayer = useCallback((kind: "osm" | "sat" | "dark") => {
//     const L = LRef.current!;
//     if (!mapRef.current) return;
//     if (baseRef.current) {
//       mapRef.current.removeLayer(baseRef.current);
//       baseRef.current = null;
//     }
//     let layer: import("leaflet").TileLayer;
//     if (kind === "sat") {
//       layer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, attribution: "Tiles © Esri" });
//     } else if (kind === "dark") {
//       layer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, attribution: "© OpenStreetMap contributors © CARTO" });
//     } else {
//       layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap contributors" });
//     }
//     layer.addTo(mapRef.current);
//     baseRef.current = layer;
//   }, []);

//   const goMyLocation = useCallback(() => {
//     const map = mapRef.current;
//     const L = LRef.current;
//     if (!map) return;
//     if (!navigator.geolocation) return;
//     setLocating(true);
//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         const { latitude, longitude } = pos.coords;
//         map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
//         try {
//           L?.circleMarker([latitude, longitude], { radius: 6 }).addTo(map);
//         } catch {}
//         setLocating(false);
//       },
//       () => {
//         setLocating(false);
//       },
//       { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
//     );
//   }, []);

//   const saveMapToServer = useCallback(async () => {
//     if (!mapName.trim()) {
//       alert("Nhập tên bản đồ trước khi lưu.");
//       return;
//     }
//     try {
//       setSaving(true);
//       const body: CreateMapRequest = {
//         mapName: mapName.trim(),
//         description: "",
//         isPublic: false,
//         orgId: String(orgId),
//       };
//       const res = await createMap(body);
//       alert("Đã lưu bản đồ.");
//       router.push(`/maps/${res.mapId}`);
//     } catch (e) {
//       const msg = e && typeof e === "object" && "message" in e ? (e as any).message : "Lưu bản đồ thất bại";
//       alert(String(msg));
//     } finally {
//       setSaving(false);
//     }
//   }, [mapName, orgId, router]);

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       const L = (await import("leaflet")).default;
//       await import("@geoman-io/leaflet-geoman-free");
//       if (!alive || !mapEl.current) return;
//       LRef.current = L;

//       const centerQ = q.get("center");
//       const zoomQ = Number(q.get("zoom") ?? "");
//       let initCenter: [number, number] = [10.78, 106.69];
//       let initZoom = Number.isFinite(zoomQ) ? zoomQ : 13;

//       if (centerQ) {
//         const parts = centerQ.split(",").map((n) => Number(n.trim()));
//         if (parts.length === 2 && parts.every((v) => Number.isFinite(v))) {
//           initCenter = [parts[0], parts[1]] as [number, number];
//         }
//       }

//       const map = L.map(mapEl.current, { zoomControl: true }).setView(initCenter, initZoom);
//       mapRef.current = map;

//       applyBaseLayer(baseLayer);

//       const sketch = L.featureGroup().addTo(map);
//       sketchRef.current = sketch;

//       const allowMarker = isAllowed("Pin") || isAllowed("Marker") || isAllowed("CircleMarker");
//       const allowLine = isAllowed("Line") || isAllowed("Route");
//       const allowRect = isAllowed("Highlighter") || isAllowed("Rectangle");
//       const allowPolygon = isAllowed("Polygon");
//       const allowCircle = isAllowed("Circle");
//       const allowCircleMarker = isAllowed("CircleMarker");
//       const allowCut = isAllowed("Clip") || isAllowed("Cut");

//       (map as MapWithPM).pm.addControls({
//         position: "topleft",
//         drawMarker: allowMarker && !loading && !error,
//         drawPolyline: allowLine && !loading && !error,
//         drawRectangle: allowRect && !loading && !error,
//         drawPolygon: allowPolygon && !loading && !error,
//         drawCircle: allowCircle && !loading && !error,
//         drawCircleMarker: allowCircleMarker && !loading && !error,
//         editMode: true,
//         dragMode: true,
//         cutPolygon: allowCut && !loading && !error,
//         removalMode: true,
//       });

//       map.on("pm:create", (e: PMCreateEvent) => {
//         sketch.addLayer(e.layer);
//       });

//       setReady(true);

//       if (navigator.geolocation && !centerQ) {
//         navigator.geolocation.getCurrentPosition(
//           (pos) => {
//             if (!alive) return;
//             map.setView([pos.coords.latitude, pos.coords.longitude], 16);
//           },
//           () => {},
//           { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
//         );
//       }
//     })();

//     return () => {
//       alive = false;
//       mapRef.current?.remove();
//     };
//   }, [q, baseLayer, applyBaseLayer, isAllowed, loading, error]);

//   return (
//     <main className="relative h-screen w-screen overflow-hidden text-white">
//       <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] w-full max-w-6xl px-4 pointer-events-none">
//         <div className="pointer-events-auto rounded-2xl bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl">
//           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
//             <input
//               type="text"
//               value={mapName}
//               onChange={(e) => setMapName(e.target.value)}
//               className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
//             />
//             <div className="flex items-center gap-2">
//               <span className="text-xs text-white/70">Base</span>
//               <select
//                 value={baseLayer}
//                 onChange={(e) => setBaseLayer(e.target.value as "osm" | "sat" | "dark")}
//                 className="px-2 py-2 rounded-md bg-white text-black text-sm"
//               >
//                 <option value="osm">OSM</option>
//                 <option value="sat">Satellite</option>
//                 <option value="dark">Dark</option>
//               </select>
//             </div>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
//               onClick={goMyLocation}
//               disabled={!ready || locating}
//             >
//               {locating ? "Đang lấy vị trí…" : "Vị trí của tôi"}
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
//               onClick={fitAll}
//               disabled={!ready}
//             >
//               Fit
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
//               onClick={clearSketch}
//               disabled={!ready}
//             >
//               Xoá vẽ
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
//               onClick={saveDraft}
//               disabled={!ready}
//             >
//               Lưu nháp
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700"
//               onClick={loadDraft}
//               disabled={!ready}
//             >
//               Tải nháp
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
//               onClick={exportGeoJSON}
//               disabled={!ready}
//             >
//               Xuất GeoJSON
//             </button>
//             <button
//               className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
//               onClick={() => void saveMapToServer()}
//               disabled={!ready || saving}
//             >
//               {saving ? "Đang lưu…" : "Lưu"}
//             </button>
//           </div>
//         </div>
//       </div>

//       <div ref={mapEl} className="absolute inset-0" />

//       <style jsx global>{`
//         .no-scrollbar::-webkit-scrollbar { display: none; }
//         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
//         .leaflet-top.leaflet-left { top: 88px; }
//         .leaflet-container { width: 100%; height: 100%; }
//       `}</style>
//     </main>
//   );
// }

import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  redirect(`/maps/new?org=${orgId}`);
}
