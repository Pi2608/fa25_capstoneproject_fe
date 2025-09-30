"use client";

import { useCallback, useEffect, useRef, useState, Suspense, useMemo, type PropsWithChildren } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import {
  createMap,
  type CreateMapRequest,
  createMapTemplateFromGeoJson,
  getActiveUserAccessTools,
  type UserAccessTool,
} from "@/lib/api";
import type { FeatureCollection as GeoFeatureCollection, Geometry, GeoJsonProperties, Position } from "geojson";
import { addLayerToList, removeLayerFromList, toggleLayerVisibility, renameLayer, LayerInfo, ExtendedLayer } from "@/lib/mapUtils";

type LNS = typeof import("leaflet");
type LMap = import("leaflet").Map;
type LLayer = import("leaflet").Layer;
type LFeatureGroup = import("leaflet").FeatureGroup;
type LTileLayer = import("leaflet").TileLayer;
type LatLngTuple = import("leaflet").LatLngTuple;
type LeafletEvent = import("leaflet").LeafletEvent;
type LatLng = import("leaflet").LatLng;
type LatLngBounds = import("leaflet").LatLngBounds;

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
    toggleGlobalRotateMode: () => void;
  };
};

interface GeoJSONLayer extends LLayer {
  feature?: {
    type?: string;
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: Position | Position[] | Position[][] | Position[][][];
    };
  };
}

type PMCreateEvent = LeafletEvent & { layer: LLayer };
type BaseKey = "osm" | "sat" | "dark";

const TEMPLATE_CATEGORIES = ["General", "Hazard", "Population", "LandUse", "Transportation", "Environment", "Business"] as const;
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

function normalizeToolName(name?: string | null): "Marker" | "Line" | "Polygon" | "Circle" | "Text" | "Route" | null {
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

function NewMapPageInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LNS | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const baseRef = useRef<LTileLayer | null>(null);
  const sketchRef = useRef<LFeatureGroup | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapName, setMapName] = useState("Untitled Map");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseKey>("osm");
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  const [asTemplate, setAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templatePublic, setTemplatePublic] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>("General");
  const [templateLayerName, setTemplateLayerName] = useState("Layer 1");

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"General" | "Developers">("General");
  const [limitBounds, setLimitBounds] = useState(false);
  const [boundsJSON, setBoundsJSON] = useState<string>("");
  const [minZoom, setMinZoom] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(20);
  const [viewersCanOpenTable, setViewersCanOpenTable] = useState(true);
  const [openTableDefault, setOpenTableDefault] = useState<"None" | "Left" | "Right">("None");

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

  const isMapValid = useCallback((): boolean => {
    const map = mapRef.current as (LMap & { _removed?: boolean; _loaded?: boolean }) | null;
    return !!(map && !map._removed && (map._loaded ?? true));
  }, []);

  const getLayerType = useCallback((layer: ExtendedLayer): string => {
    if (layer.feature?.geometry?.type) {
      return layer.feature.geometry.type;
    }
    if (layer._mRadius !== undefined) return "Circle";
    if (layer._latlng !== undefined) return "Marker";
    if (layer._latlngs !== undefined) {
      const lls = layer._latlngs;
      if (Array.isArray(lls)) {
        const first: unknown = lls[0] as unknown;
        if (Array.isArray(first)) return "Polygon";
        return "Polyline";
      }
    }
    if (layer._bounds !== undefined) return "Rectangle";
    return "Unknown";
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
      layer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        attribution: "Tiles © Esri",
      });
    } else if (kind === "dark") {
      layer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        attribution: "© OpenStreetMap contributors © CARTO",
      });
    } else {
      layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom:0, 
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const exportSketchToGeoJson = useCallback(() => {
    const sketch = sketchRef.current;
    if (!sketch) return null;
    const ls = sketch.getLayers();
    const count = Array.isArray(ls) ? ls.length : 0;
    if (!count) return { geojsonText: "", featureCount: 0, boundsStr: "", sizeKB: 0 };
    const fc = sketch.toGeoJSON() as GeoFeatureCollection<Geometry, GeoJsonProperties>;
    const geojsonText = JSON.stringify(fc ?? { type: "FeatureCollection", features: [] });
    const bounds = sketch.getBounds();
    const boundsStr = bounds
      ? JSON.stringify({ _southWest: bounds.getSouthWest(), _northEast: bounds.getNorthEast() })
      : "";
    const blob = new Blob([geojsonText], { type: "application/json" });
    const sizeKB = Math.round((blob.size / 1024) * 100) / 100;
    return { geojsonText, featureCount: count, boundsStr, sizeKB };
  }, []);

  const captureConstraintsFromMap = useCallback(() => {
    const map = mapRef.current;
    const sketch = sketchRef.current;
    if (!map) return;
    setMinZoom(Math.max(1, map.getZoom() - 2));
    setMaxZoom(Math.min(20, map.getZoom() + 2));
    const b = sketch?.getBounds() ?? map.getBounds?.();
    if (b) {
      setBoundsJSON(JSON.stringify({ _southWest: b.getSouthWest(), _northEast: b.getNorthEast() }));
      setLimitBounds(true);
    }
  }, []);

  const triggerUpload = () => uploadInputRef.current?.click();

  const handleUploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (mapRef.current && LRef.current) {
          const geoLayer = LRef.current.geoJSON(data, {
            style: { color: "red", weight: 2, fillOpacity: 0.1 },
          });
          geoLayer.addTo(mapRef.current);
          setLayers((prev) => addLayerToList(prev, geoLayer));
          const gj = geoLayer as unknown as LFeatureGroup;
          mapRef.current.fitBounds(gj.getBounds());
        }
      } catch {
        setNotice({ text: "Invalid file or not a GeoJSON file.", type: "error" });
      }
    };
    reader.readAsText(file);
  };

  const saveMap = useCallback(async () => {
    if (!mapName.trim()) {
      setNotice({ text: "Enter a map name before saving.", type: "error" });
      return;
    }
    if (!isMapValid()) {
      setNotice({ text: "Map is not ready.", type: "error" });
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
        isPublic,
        initialLatitude: center.lat,
        initialLongitude: center.lng,
        initialZoom: zoom,
        baseMapProvider: baseForApi,
        orgId,
      };

      const created = await createMap(body);
      const id = created.mapId;

      if (asTemplate) {
        const exported = exportSketchToGeoJson();
        if (!exported || exported.featureCount === 0 || !exported.geojsonText) {
          setNotice({ text: "No sketch data to save as a template. Please draw something first.", type: "error" });
        } else {
          const blob = new Blob([exported.geojsonText], { type: "application/json" });
          const file = new File(
            [blob],
            `${(templateName || mapName).trim().replace(/\s+/g, "_")}.geojson`,
            { type: "application/json" }
          );
          await createMapTemplateFromGeoJson({
            geoJsonFile: file,
            templateName: (templateName || mapName).trim(),
            description: templateDesc.trim() || description.trim(),
            layerName: templateLayerName.trim() || "Layer 1",
            category: templateCategory,
            isPublic: templatePublic,
          });
        }
      }

      setCreatedId(id);
      setNotice({ text: "Map saved. You can open it in the editor.", type: "success" });
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to save map";
      setNotice({ text: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  }, [
    mapName,
    description,
    baseLayer,
    orgId,
    router,
    isMapValid,
    asTemplate,
    exportSketchToGeoJson,
    templateName,
    templateDesc,
    templateLayerName,
    templateCategory,
    templatePublic,
    isPublic,
  ]);

  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.enableDraw(shape);
  };

  const toggleEdit = () => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.toggleGlobalEditMode();
  };
  const toggleDelete = () => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.toggleGlobalRemovalMode();
  };
  const toggleDrag = () => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.toggleGlobalDragMode();
  };
  const enableCutPolygon = () => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.enableGlobalCutMode();
  };
  const toggleRotate = () => {
    (mapRef.current as unknown as MapWithPM | null)?.pm.toggleGlobalRotateMode();
  };

  useEffect(() => {
    const val = sp?.get("org") || sp?.get("orgId") || undefined;
    setOrgId(val || undefined);
  }, [sp]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const L: typeof import("leaflet") = await import("leaflet");
      await import("@geoman-io/leaflet-geoman-free");
      if (!alive || !mapEl.current) return;
      LRef.current = L;

      const map = L.map(mapEl.current, { minZoom: 2 , zoomControl: false }).setView([10.78, 106.69], 13);
      mapRef.current = map;
      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;
      (map as unknown as MapWithPM).pm.addControls({
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
      map.on("pm:create", (e: LeafletEvent) => {
        const evt = e as PMCreateEvent;
        sketch.addLayer(evt.layer);
        setLayers(prev => addLayerToList(prev, evt.layer));
      });
      map.whenReady(() => setReady(true));
    })();
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      baseRef.current = null;
      sketchRef.current = null;
    };
  }, [addLayerToList]);

  useEffect(() => {
    if (!ready) return;
    applyBaseLayer(baseLayer);
  }, [ready, baseLayer, applyBaseLayer]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getActiveUserAccessTools();
        const names = new Set<string>();
        (list ?? []).forEach((t: UserAccessTool) => {
          const key = normalizeToolName(t.name);
          if (key) names.add(key);
        });
        if (alive) setAllowed(names);
      } catch {
        if (alive) setAllowed(new Set());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  type GuardBtnProps = PropsWithChildren<{ can: boolean; title: string; onClick?: () => void; disabled?: boolean }>;
  function GuardBtn({ can, title, onClick, disabled, children }: GuardBtnProps) {
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
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl py-2 px-4">
          {notice && (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 text-sm ${notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                : notice.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-white/5 text-white/80"
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{notice.text}</span>
                {createdId && (
                  <button
                    className="px-3 py-1.5 rounded bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
                    onClick={() =>
                      router.push(`/maps/${createdId}?created=1&name=${encodeURIComponent(mapName.trim())}`)
                    }
                  >
                    Open editor
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 place-items-stretch gap-2">
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              <input
                type="text"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
                placeholder="Map name"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-72"
                placeholder="Description (optional)"
              />
            </div>

            <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
              <GuardBtn can={perms.marker} title="Draw point" onClick={() => enableDraw("Marker")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.line} title="Draw line" onClick={() => enableDraw("Line")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="7" r="2" />
                  <circle cx="19" cy="17" r="2" />
                  <path d="M7 8.5 17 15.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.polygon} title="Draw polygon" onClick={() => enableDraw("Polygon")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.rectangle} title="Draw rectangle" onClick={() => enableDraw("Rectangle")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="12" rx="1.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.circle} title="Draw circle" onClick={() => enableDraw("Circle")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.text} title="Add text" onClick={() => enableDraw("Text")} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M12 6v12" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.cut} title="Cut polygon" onClick={enableCutPolygon} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="8" r="2" />
                  <circle cx="5.5" cy="16" r="2" />
                  <path d="M8 9l12 8M8 15l12-8" />
                </svg>
              </GuardBtn>

              <GuardBtn can={perms.rotate} title="Rotate features" onClick={toggleRotate} disabled={!ready}>
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 1-2.2-5.5" />
                  <path d="M20 4v7h-7" />
                </svg>
              </GuardBtn>

              <label className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500 cursor-pointer" title="Upload GeoJSON/KML">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".geojson,.json,.kml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadFile(file);
                  }}
                />
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18.5 9a4.5 4.5 0 0 1 1.5 8.74" />
                  <path d="M12 15V3M8.5 6.5L12 3l3.5 3.5" />
                </svg>
              </label>

              <button
                className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
                title="Toggle Layers panel"
                onClick={() => setShowLayerPanel((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                  <path d="M19.4 15l.6-1.1l-.6-1.1a1 1 0 0 0-.2-1.1l-1.2-1.2l-1.1.6l-1.1-.6l-1.2 1.2l.6 1.1l-.6 1.1l1.2 1.2l1.1-.6l1.1.6l1.2-1.2a1 1 0 0 0 .2-1.1Z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
              <label className="flex items-center gap-2 text-sm mr-2 select-none">
                <input
                  type="checkbox"
                  className="size-4 accent-emerald-500"
                  checked={asTemplate}
                  onChange={(e) => setAsTemplate(e.target.checked)}
                />
                Save as Template
              </label>

              <button
                className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-400 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => void saveMap()}
                disabled={!ready || saving}
              >
                {saving ? "Saving…" : "Save and edit"}
              </button>
            </div>
          </div>

          {asTemplate && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name (defaults to map name)"
                className="px-3 py-2 rounded-md bg-white text-black text-sm"
              />
              <input
                type="text"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Template description (optional)"
                className="px-3 py-2 rounded-md bg-white text-black text-sm"
              />
              <div className="flex items-center gap-2">
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value as TemplateCategory)}
                  className="px-3 py-2 rounded-md bg-white text-black text-sm"
                >
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-emerald-500"
                    checked={templatePublic}
                    onChange={(e) => setTemplatePublic(e.target.checked)}
                  />
                  Public
                </label>
              </div>
              <input
                type="text"
                value={templateLayerName}
                onChange={(e) => setTemplateLayerName(e.target.value)}
                placeholder="Default layer name (e.g., Layer 1)"
                className="px-3 py-2 rounded-md bg-white text-black text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="fixed top-0 right-0 h-full w-[360px] z-[4000] bg-zinc-900/95 backdrop-blur-md ring-1 ring-white/10 shadow-2xl">
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
            <div className="font-semibold">Map settings</div>
            <button className="rounded-md px-2 py-1 hover:bg-white/10" onClick={() => setShowSettings(false)}>
              ✕
            </button>
          </div>

          <div className="px-4 py-3 border-b border-white/10">
            <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
              <button
                className={`px-3 py-1.5 text-sm ${settingsTab === "General" ? "bg-white/10" : ""}`}
                onClick={() => setSettingsTab("General")}
              >
                General
              </button>
              <button
                className={`px-3 py-1.5 text-sm ${settingsTab === "Developers" ? "bg-white/10" : ""}`}
                onClick={() => setSettingsTab("Developers")}
              >
                Developers
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-56px-48px)]">
            {settingsTab === "General" ? (
              <>
                <section>
                  <div className="text-sm font-medium mb-1">Description</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add map description…"
                    className="w-full h-24 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm mb-1">Base</div>
                    <select
                      value={baseLayer}
                      onChange={(e) => setBaseLayer(e.target.value as BaseKey)}
                      className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm"
                    >
                      <option value="osm">OSM</option>
                      <option value="sat">Satellite</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <label className="mt-6 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-500"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                    />
                    Public
                  </label>
                </section>

                <section>
                  <div className="text-sm font-medium">Map constraints</div>
                  {!limitBounds ? (
                    <button className="mt-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm" onClick={captureConstraintsFromMap}>
                      Add constraints
                    </button>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-white/60">Limit to the current bounds (you can edit below).</div>
                      <textarea
                        className="w-full h-24 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs"
                        value={boundsJSON}
                        onChange={(e) => setBoundsJSON(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs mb-1">Min zoom</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={minZoom}
                            onChange={(e) => setMinZoom(Number(e.target.value))}
                            className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs mb-1">Max zoom</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={maxZoom}
                            onChange={(e) => setMaxZoom(Number(e.target.value))}
                            className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm" onClick={captureConstraintsFromMap}>
                          Use current view
                        </button>
                        <button className="px-3 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-sm" onClick={() => setLimitBounds(false)}>
                          Clear constraints
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section>
                  <div className="text-sm font-medium">Table settings</div>
                  <label className="mt-2 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-500"
                      checked={viewersCanOpenTable}
                      onChange={(e) => setViewersCanOpenTable(e.target.checked)}
                    />
                    Viewers can open table
                  </label>
                  <div className="mt-2">
                    <div className="text-xs mb-1">Open table by default</div>
                    <select
                      value={openTableDefault}
                      onChange={(e) => setOpenTableDefault(e.target.value as "None" | "Left" | "Right")}
                      className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm"
                    >
                      <option>None</option>
                      <option>Left</option>
                      <option>Right</option>
                    </select>
                  </div>
                </section>

                <div className="pt-2">
                  <button className="w-full px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400" onClick={() => setShowSettings(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-white/70">Webhooks, embed code (not connected)</div>
            )}
          </div>
        </div>
      )}

      <div ref={mapEl} className="absolute inset-0" />

      <div className="absolute bottom-4 right-4 z-[3000] flex flex-col gap-2">
        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
          onClick={() => mapRef.current?.zoomOut()}
        >
          –
        </button>
        <button
          className="flex w-10 h-10 justify-center items-center rounded-full bg-emerald-400 text-white shadow hover:bg-emerald-500 cursor-pointer"
          onClick={goMyLocation}
        >
          {locating ? "…" : "●"}
        </button>
      </div>

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
    <Suspense fallback={<div className="p-4 text-zinc-400">Loading…</div>}>
      <NewMapPageInner />
    </Suspense>
  );
}