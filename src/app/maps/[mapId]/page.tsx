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
  LatLng,
  LatLngBounds,
} from "leaflet";

import {
  // Map detail & layers
  getMapDetail,
  type MapDetail,
  updateMap,
  type UpdateMapRequest,
  getActiveUserAccessTools,
  type UserAccessTool,
  type RawLayer,
  type UpdateMapFeatureRequest,

  // [StoryMap] API
  getSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  getSegmentZones,
  createSegmentZone,
  updateSegmentZone,
  deleteSegmentZone,
  getSegmentLayers,
  attachLayerToSegment,
  detachLayerFromSegment,
  type Segment,
  type SegmentZone,
  type SegmentLayer,
} from "@/lib/api";
import type * as L from "leaflet";
import type { GeoJsonObject, Feature, Point } from "geojson";

import type {
  Feature as GJFeature,
  Geometry as GJGeometry,
  GeoJsonObject as GJObject,
  Position,
} from "geojson";

import {
  // feature helpers
  type FeatureData,
  getFeatureType as getFeatureTypeUtil,
  serializeFeature,
  extractLayerStyle,

  // persistence & rendering
  saveFeature,
  updateFeatureInDB,
  deleteFeatureFromDB,
  loadFeaturesToMap,
  loadLayerToMap,
  renderAllDataLayers,

  // visibility/state helpers
  handleLayerVisibilityChange,
  handleFeatureVisibilityChange,

  // style helpers
  handleUpdateLayerStyle,
  handleUpdateFeatureStyle,
  getStylePreset,
  createCustomStyle,
  applyStyleToFeature,
  applyStyleToDataLayer,
} from "@/utils/mapUtils";

import { StylePanel, DataLayersPanel } from "@/components/map/MapControls";
import dynamic from "next/dynamic";
import { createMapPoi } from "@/lib/api";
import PoiDialog, { type PoiForm } from "@/components/poi/PoiDialog";


// Lazy components
const SegmentPanel = dynamic(() => import("@/components/storymap/SegmentPanel"), { ssr: false });
const MapPoiPanel = dynamic(() => import("@/components/poi/PoiPanel"), { ssr: false });
import CreateZoneDialog, { type ZoneDraft } from "@/components/storymap/CreateZoneDialog";

// ------------ Types & helpers ------------
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
      shape:
        | "Marker"
        | "Line"
        | "Polygon"
        | "Rectangle"
        | "Circle"
        | "CircleMarker"
        | "Text"
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
  _mRadius?: number;
  _latlng?: LatLng;
  _latlngs?: LatLng[] | LatLng[][] | LatLng[][][];
  _bounds?: LatLngBounds;
}
type LayerWithToGeoJSON = Layer & { toGeoJSON: () => GJFeature | GJGeometry | GJObject };
function hasToGeoJSON(x: Layer | null | undefined): x is LayerWithToGeoJSON {
  return !!x && typeof (x as unknown as { toGeoJSON?: unknown }).toGeoJSON === "function";
}

type SafeSegmentZone = Omit<SegmentZone, "geometry" | "properties"> & {
  geometry?: GJObject;
  properties?: Record<string, unknown>;
};

const VN_CENTER: LatLngTuple = [14.058324, 108.277199];
const VN_ZOOM = 6;
interface ParsedViewState {
  center: [number, number];
  zoom: number;
}

function parseViewState(input: unknown): ParsedViewState | null {
  if (input === null || input === undefined) return null;

  try {
    const obj = typeof input === "string" ? JSON.parse(input) : input;
    if (
      typeof obj === "object" &&
      obj !== null &&
      "center" in obj &&
      "zoom" in obj &&
      Array.isArray((obj as { center: unknown }).center) &&
      (obj as { center: unknown[] }).center.length === 2 &&
      typeof (obj as { center: unknown[] }).center[0] === "number" &&
      typeof (obj as { center: unknown[] }).center[1] === "number" &&
      typeof (obj as { zoom: unknown }).zoom === "number"
    ) {
      const c = (obj as { center: [number, number] }).center;
      const z = (obj as { zoom: number }).zoom;
      return { center: c, zoom: z };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

// ============ Component ============
export default function EditMapPage() {
  const params = useParams<{ mapId: string }>();
  const sp = useSearchParams();
  const mapId = params?.mapId ?? "";

  const [isMapReady, setIsMapReady] = useState(false);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [busySaveMeta, setBusySaveMeta] = useState<boolean>(false);
  const [busySaveView, setBusySaveView] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [name, setName] = useState<string>("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showDataLayersPanel, setShowDataLayersPanel] = useState(true);
  // ----- POI state -----
  const [poiDialogOpen, setPoiDialogOpen] = useState(false);
  const [poiForm, setPoiForm] = useState<PoiForm>({
    title: "",
    subtitle: "",
    markerGeometry: null,
    highlightOnEnter: false,
    shouldPin: false,
  });

  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<FeatureData | RawLayer | null>(null);
  const [layers, setLayers] = useState<RawLayer[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [featureVisibility, setFeatureVisibility] = useState<Record<string, boolean>>({});

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);
  const addingSegmentPoiRef = useRef<{ mapId: string; segmentId: string } | null>(null);

  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());

  const lastDrawnLayerRef = useRef<Layer | null>(null);

  const [toolsLoading, setToolsLoading] = useState(true);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  // [StoryMap] state
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [zones, setZones] = useState<SafeSegmentZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [showZonesPanel, setShowZonesPanel] = useState<boolean>(false);
  const [showMapPoiPanel, setShowMapPoiPanel] = useState(false);

  const [segmentLayers, setSegmentLayers] = useState<SegmentLayer[]>([]);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);

  // ---------- helpers ----------
  const guessZoneName = (geom: GJObject | null): string => {
    if (!geom) return "Zone mới";
    const t = geom.type;
    if (t === "Polygon" || t === "MultiPolygon") return "Vùng mới";
    if (t === "LineString" || t === "MultiLineString") return "Tuyến mới";
    if (t === "Point" || t === "MultiPoint") return "Điểm mới";
    return "Zone mới";
  };

  const getZoneGeometry = useCallback((z: SegmentZone): GJObject | null => {
    const g1 = (z as { geometry?: unknown }).geometry;
    const g2 = (z as { zoneGeometry?: unknown }).zoneGeometry;
    const raw = (g1 ?? g2) as unknown;
    if (!raw) return null;
    if (typeof raw === "string") {
      try { return JSON.parse(raw) as GJObject; } catch { return null; }
    }
    return raw as GJObject;
  }, []);

  // ---------- base layer ----------
  const baseTokenRef = useRef(0);

  const applyBaseLayer = useCallback((key: BaseKey) => {
    const map = mapRef.current;
    if (!map) return;

    if (baseRef.current) {
      try { map.removeLayer(baseRef.current); } catch { }
      baseRef.current = null;
    }

    const myToken = ++baseTokenRef.current;

    (async () => {
      try {
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
          layer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 20, attribution: "© OpenStreetMap contributors" }
          );
        }

        if (myToken !== baseTokenRef.current) return;

        const m = mapRef.current as unknown as { _panes?: { tilePane?: HTMLElement } } | null;
        if (!m || !m._panes || !m._panes.tilePane) return;

        layer.addTo(mapRef.current!);
        baseRef.current = layer;
      } catch (error) {
        console.error("Failed to apply baseLayer:", error);
      }
    })();
  }, []);

  // ---------- load map detail ----------
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
        setBaseKey(m.baseMapProvider === "Satellite" ? "sat" : m.baseMapProvider === "Dark" ? "dark" : "osm");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không tải được bản đồ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mapId]);

  // ---------- load tools ----------
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
    return () => { alive = false; };
  }, []);

  // ---------- init map ----------
  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");
      if (!alive || !el) return;

      const createdFlag = sp?.get("created") === "1";
      const rawLat = Number(detail.initialLatitude ?? 0);
      const rawLng = Number(detail.initialLongitude ?? 0);
      const rawZoom = Number(detail.initialZoom ?? 6);
      const isZeroZero = Math.abs(rawLat) < 1e-6 && Math.abs(rawLng) < 1e-6;
      const tooClose = rawZoom >= 14;

      const useVN = createdFlag || isZeroZero || tooClose;
      const initialCenter: LatLngTuple = useVN ? VN_CENTER : [rawLat, rawLng];
      const initialZoom = useVN ? VN_ZOOM : Math.min(Math.max(rawZoom || VN_ZOOM, 3), 12);

      const map = L.map(el, {
        zoomControl: false,
        minZoom: 2,
        maxZoom: 20,
      }).setView(initialCenter, initialZoom) as MapWithPM;

      mapRef.current = map;
      if (!alive) return;
      setIsMapReady(true);

      applyBaseLayer(
        detail.baseMapProvider === "Satellite" ? "sat" :
          detail.baseMapProvider === "Dark" ? "dark" : "osm"
      );

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      // Load Features from DB to sketch group
      try {
        const dbFeatures = await loadFeaturesToMap(detail.id, L, sketch);
        setFeatures(dbFeatures);
        const initialFeatureVisibility: Record<string, boolean> = {};
        dbFeatures.forEach((f) => {
          initialFeatureVisibility[f.id] = f.isVisible ?? true;
        });
        setFeatureVisibility(initialFeatureVisibility);
      } catch (error) {
        console.error("Failed to load from database:", error);
      }

      // Geoman controls (disabled by default; toggle via buttons)
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
        const extLayer = e.layer as ExtendedLayer;
        const type = getFeatureTypeUtil(extLayer);

        if (addingSegmentPoiRef.current && type === "Marker" && hasToGeoJSON(extLayer)) {
          const gj = extLayer.toGeoJSON();
          const geometry =
            (gj as GJFeature).type === "Feature"
              ? ((gj as GJFeature).geometry ?? null)
              : (gj as GJObject);

          if (geometry) {
            map.pm.disableDraw("Marker");
            try { sketch.removeLayer(extLayer); } catch { }
            try { map.removeLayer(extLayer); } catch { }

            const coords = (geometry as any)?.coordinates;
            window.dispatchEvent(
              new CustomEvent("poi:pointSelectedForSegment", {
                detail: {
                  lngLat: Array.isArray(coords)
                    ? ([coords[0], coords[1]] as [number, number])
                    : ([0, 0] as [number, number]),
                  geojson: geometry,
                },
              })
            );

            addingSegmentPoiRef.current = null;
            return;
          }
        }

        sketch.addLayer(extLayer);
        lastDrawnLayerRef.current = extLayer;

        if (type === "Marker" && hasToGeoJSON(extLayer)) {
          const gj = extLayer.toGeoJSON();
          const geometry =
            (gj as GJFeature).type === "Feature"
              ? ((gj as GJFeature).geometry ?? null)
              : (gj as GJObject);

          if (geometry) {
            setPoiForm({
              title: "",
              subtitle: "",
              markerGeometry: geometry,
              highlightOnEnter: false,
              shouldPin: false,
            });
            setPoiDialogOpen(true);
            return;
          }
        }

        const localId = `feature-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const newFeature: FeatureData = {
          id: localId,
          name: `${type} ${features.length + 1}`,
          type,
          layer: extLayer,
          isVisible: true,
        };

        try {
          const saved = await saveFeature(detail.id, "", extLayer, features, setFeatures);
          if (saved) {
            setFeatures((prev) => [...prev, saved]);
            setFeatureVisibility((prev) => ({ ...prev, [saved.id]: true }));
          } else {
            setFeatures((prev) => [...prev, newFeature]);
            setFeatureVisibility((prev) => ({ ...prev, [newFeature.id]: true }));
          }
        } catch (error) {
          console.error("Error saving to database:", error);
          setFeatures((prev) => [...prev, newFeature]);
          setFeatureVisibility((prev) => ({ ...prev, [newFeature.id]: true }));
        }

        if (hasToGeoJSON(extLayer)) {
          const gj2 = extLayer.toGeoJSON();
          const geometry2: GJObject | null =
            (gj2 as GJFeature).type === "Feature"
              ? ((gj2 as GJFeature).geometry ?? null)
              : (gj2 as GJObject);

          if (geometry2) {
            setZoneDraft({ geometry: geometry2, defaultName: guessZoneName(geometry2) });
            setZoneDialogOpen(true);
          }
        }
      });


      // Editing existing features
      sketch.on("pm:edit", async (e: { layer: Layer; shape: string }) => {
        const extLayer = e.layer as ExtendedLayer;
        const editedFeature = features.find((f) => f.layer === extLayer);
        if (editedFeature && editedFeature.featureId) {
          try {
            await updateFeatureInDB(detail.id, editedFeature.featureId, editedFeature);
            setFeatures((prev) =>
              prev.map((f) =>
                f.id === editedFeature.id || f.featureId === editedFeature.featureId
                  ? { ...f, layer: extLayer }
                  : f
              )
            );
          } catch (error) {
            console.error("Error updating feature:", error);
          }
        }
      });
    })();

    return () => {
      alive = false;
      try { mapRef.current?.remove(); } catch { }
      baseRef.current = null;
      sketchRef.current = null;
      mapRef.current = null;
    };

  }, [detail, applyBaseLayer, sp, features.length]);
  useEffect(() => {
    // chỉ hoạt động khi map đã sẵn sàng
    if (!mapRef.current) return;

    const onStartAdd = (e: Event) => {
      const ev = e as CustomEvent<{ mapId: string; segmentId: string }>;
      if (!mapRef.current) return;
      addingSegmentPoiRef.current = { mapId: ev.detail.mapId, segmentId: ev.detail.segmentId };
      mapRef.current.pm.enableDraw("Marker", {
        snappable: true,
        snapDistance: 20,
        finishOn: "click",
        cursorMarker: true,
      });
    };

    window.addEventListener("poi:startAddSegmentPoi", onStartAdd as EventListener);
    return () => {
      window.removeEventListener("poi:startAddSegmentPoi", onStartAdd as EventListener);
    };
  }, [isMapReady]); // hoặc [] cũng được, nhưng dùng isMapReady an toàn hơn

  // ---------- render data layers ----------
  useEffect(() => {
    if (!mapRef.current || !detail?.layers || detail.layers.length === 0 || !isMapReady) return;

    const map = mapRef.current;
    let alive = true;

    (async () => {
      setLayers(detail.layers);

      // clear current layers
      dataLayerRefs.current.forEach((layer) => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
      dataLayerRefs.current.clear();

      const initialLayerVisibility: Record<string, boolean> = {};

      for (const layer of detail.layers) {
        if (!alive) break;
        const vis = layer.isVisible ?? true;
        initialLayerVisibility[layer.id] = vis;
        try {
          const loaded = await loadLayerToMap(map, layer, dataLayerRefs);
          if (loaded && !vis) {
            const leaf = dataLayerRefs.current.get(layer.id);
            if (leaf && map.hasLayer(leaf)) map.removeLayer(leaf);
          }
        } catch (error) {
          console.error(`Error loading layer ${layer.name}:`, error);
        }
      }

      if (alive) setLayerVisibility(initialLayerVisibility);
    })();

    return () => { alive = false; };
  }, [detail?.layers, detail?.id, isMapReady]);

  // react to layerVisibility toggles
  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const layerOnMap = dataLayerRefs.current.get(layerId);
      if (!layerOnMap) return;
      const isOnMap = mapRef.current!.hasLayer(layerOnMap);
      if (isVisible && !isOnMap) mapRef.current!.addLayer(layerOnMap);
      else if (!isVisible && isOnMap) mapRef.current!.removeLayer(layerOnMap);
    });
  }, [layerVisibility]);

  // react to featureVisibility toggles
  useEffect(() => {
    if (!mapRef.current || !sketchRef.current) return;
    Object.entries(featureVisibility).forEach(([featureId, isVisible]) => {
      const feature = features.find((f) => f.id === featureId || f.featureId === featureId);
      if (!feature) return;
      const isOnMap = sketchRef.current!.hasLayer(feature.layer);
      if (isVisible && !isOnMap) sketchRef.current!.addLayer(feature.layer);
      else if (!isVisible && isOnMap) sketchRef.current!.removeLayer(feature.layer);
    });
  }, [featureVisibility, features]);

  // keep base layer in sync with selector
  useEffect(() => { applyBaseLayer(baseKey); }, [baseKey, applyBaseLayer]);

  // ---------- StoryMap: load segments ----------
  useEffect(() => {
    if (!detail?.id) return;
    let alive = true;
    (async () => {
      try {
        setSegmentsLoading(true);
        const list = await getSegments(detail.id);
        if (!alive) return;
        setSegments(list ?? []);
        if (!selectedSegmentId && (list?.length ?? 0) > 0) {
          const first = list![0] as Segment & { segmentId?: string; id?: string };
          setSelectedSegmentId(first.segmentId ?? first.id ?? null);
        }
      } catch (e) {
        console.error("getSegments error:", e);
        setFeedback(e instanceof Error ? `Segments lỗi: ${e.message}` : "Segments lỗi");
      } finally {
        if (alive) setSegmentsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [detail?.id, selectedSegmentId]);

  // StoryMap: load zones for selected segment
  useEffect(() => {
    if (!detail?.id || !selectedSegmentId) return;
    let alive = true;
    (async () => {
      try {
        setZonesLoading(true);
        const z = await getSegmentZones(detail.id, selectedSegmentId);
        if (!alive) return;
        const safe = (z ?? []).map((it) => it as unknown as SafeSegmentZone);
        setZones(safe);
      } catch (e) {
        console.error("getSegmentZones error:", e);
        setFeedback(e instanceof Error ? `Zones lỗi: ${e.message}` : "Zones lỗi");
      } finally {
        setZonesLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [detail?.id, selectedSegmentId]);

  // StoryMap: load segment layers
  useEffect(() => {
    if (!detail?.id || !selectedSegmentId) {
      setSegmentLayers([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const list = await getSegmentLayers(detail.id, selectedSegmentId);
        if (!alive) return;
        setSegmentLayers(list ?? []);
      } catch (e) {
        console.error("getSegmentLayers error:", e);
      }
    })();
    return () => { alive = false; };
  }, [detail?.id, selectedSegmentId]);

  // ---------- actions ----------
  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") =>
    mapRef.current?.pm.enableDraw(shape);
  const toggleRotate = () => mapRef.current?.pm.toggleGlobalRotateMode?.();
  const enableCutPolygon = () => mapRef.current?.pm.enableGlobalCutMode();

  const clearSketch = useCallback(async () => {
    if (!detail) return;
    for (const f of features) {
      if (f.featureId) {
        try { await deleteFeatureFromDB(detail.id, f.featureId); } catch (e) { console.error(e); }
      }
    }
    sketchRef.current?.clearLayers();
    setFeatures([]);
    setFeatureVisibility({});
  }, [detail, features]);

  const onLayerVisibilityChange = useCallback(
    async (layerId: string, isVisible: boolean) => {
      if (!detail?.id || !mapRef.current) return;
      const layerData = layers.find((l) => l.id === layerId);
      await handleLayerVisibilityChange(
        detail.id,
        layerId,
        isVisible,
        mapRef.current,
        dataLayerRefs,
        setLayerVisibility,
        layerData
      );
    },
    [detail?.id, layers]
  );

  const onFeatureVisibilityChange = useCallback(
    async (featureId: string, isVisible: boolean) => {
      if (!detail?.id) return;
      await handleFeatureVisibilityChange(
        detail.id,
        featureId,
        isVisible,
        features,
        setFeatures,
        mapRef.current,
        sketchRef.current,
        setFeatureVisibility
      );
    },
    [detail?.id, features]
  );

  const onSelectLayer = useCallback((layer: FeatureData | RawLayer) => {
    setSelectedLayer(layer);
    setShowStylePanel(true);
  }, []);

  const onUpdateLayer = useCallback(
    async (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => {
      if (!detail || !mapRef.current) return;
      await handleUpdateLayerStyle(detail.id, layerId, updates, mapRef.current, detail.layers, dataLayerRefs);
    },
    [detail]
  );

  const onUpdateFeature = useCallback(
    async (featureId: string, updates: UpdateMapFeatureRequest) => {
      if (!detail) return;
      const converted = {
        name: updates.name ?? undefined,
        style: updates.style ?? undefined,
        properties: updates.properties ?? undefined,
        isVisible: updates.isVisible ?? undefined,
        zIndex: updates.zIndex ?? undefined,
      };
      await handleUpdateFeatureStyle(detail.id, featureId, converted);
    },
    [detail]
  );

  const onDeleteFeature = useCallback(
    async (featureId: string) => {
      if (!detail) return;
      const f = features.find((x) => x.id === featureId || x.featureId === featureId);
      if (f && mapRef.current && sketchRef.current) sketchRef.current.removeLayer(f.layer);
      setFeatures((prev) => prev.filter((x) => x.id !== featureId && x.featureId !== featureId));
      setFeatureVisibility((prev) => {
        const next = { ...prev }; delete next[featureId]; return next;
      });
      if (f?.featureId) {
        try { await deleteFeatureFromDB(detail.id, f.featureId); } catch (e) { console.error(e); }
      }
    },
    [detail, features]
  );

  // style utils
  const applyPresetStyleToFeature = useCallback(
    async (featureId: string, layerType: string, presetName: string) => {
      if (!detail) return;
      const feature = features.find((f) => f.featureId === featureId);
      if (!feature) return;
      const presetStyle = getStylePreset(layerType, presetName);
      await applyStyleToFeature(detail.id, featureId, feature.layer, presetStyle, features, setFeatures);
    },
    [detail, features, setFeatures]
  );

  const applyCustomStyleToFeature = useCallback(
    async (featureId: string, styleOptions: {
      color?: string; fillColor?: string; weight?: number; opacity?: number;
      fillOpacity?: number; radius?: number; dashArray?: string;
    }) => {
      if (!detail) return;
      const feature = features.find((f) => f.featureId === featureId);
      if (!feature) return;
      const customStyle = createCustomStyle(styleOptions);
      await applyStyleToFeature(detail.id, featureId, feature.layer, customStyle, features, setFeatures);
    },
    [detail, features, setFeatures]
  );

  const applyStyleToLayer = useCallback(
    async (layerId: string, styleOptions: {
      color?: string; fillColor?: string; weight?: number; opacity?: number; fillOpacity?: number;
    }) => {
      if (!detail) return;
      const customStyle = createCustomStyle(styleOptions);
      await applyStyleToDataLayer(detail.id, layerId, customStyle);
    },
    [detail]
  );

  const getCurrentFeatureStyle = useCallback((featureId: string) => {
    const feature = features.find((f) => f.featureId === featureId);
    if (!feature) return {};
    return extractLayerStyle(feature.layer);
  }, [features]);

  const saveMeta = useCallback(async () => {
    if (!detail) return;
    setBusySaveMeta(true);
    setFeedback(null);
    try {
      const body: UpdateMapRequest = {
        name: (name ?? "").trim() || "Untitled Map",
        baseMapProvider: baseKey === "osm" ? "OSM" : baseKey === "sat" ? "Satellite" : "Dark",
      };
      await updateMap(detail.id, body);
      setFeedback("Đã lưu thông tin bản đồ.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveMeta(false);
      window.setTimeout(() => setFeedback(null), 1600);
    }
  }, [detail, name, baseKey]);

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
      window.setTimeout(() => setFeedback(null), 1600);
    }
  }, [detail]);

  // ---------- StoryMap actions ----------
  const handleSelectSegment = (id: string) => setSelectedSegmentId(id);

  const createNewSegment = useCallback(async (segName: string) => {
    if (!detail?.id) return;
    const created = await createSegment(detail.id, { name: segName.trim() || "Untitled Segment" });
    const list = await getSegments(detail.id);
    setSegments(list ?? []);
    const createdId = (created as Segment & { segmentId?: string; id?: string }).segmentId ?? (created as Segment & { id?: string }).id ?? "";
    setSelectedSegmentId(createdId || null);
  }, [detail?.id]);

  const renameSegment = useCallback(async (segmentId: string, newName: string) => {
    if (!detail?.id) return;
    await updateSegment(detail.id, segmentId, { name: newName });
    const list = await getSegments(detail.id);
    setSegments(list ?? []);
  }, [detail?.id]);

  const removeSegment = useCallback(async (segmentId: string) => {
    if (!detail?.id) return;
    await deleteSegment(detail.id, segmentId);
    const list = await getSegments(detail.id);
    setSegments(list ?? []);
    const first = (list ?? [])[0] as (Segment & { segmentId?: string; id?: string }) | undefined;
    setSelectedSegmentId(first ? (first.segmentId ?? first.id ?? null) : null);
  }, [detail?.id]);

  const handleZoomZone = useCallback(async (zone: SegmentZone) => {
    const geom = getZoneGeometry(zone);
    if (!geom || !mapRef.current) return;
    const L = (await import("leaflet")).default;
    const gj = L.geoJSON(geom);
    const b = gj.getBounds();
    if (b.isValid()) mapRef.current.fitBounds(b.pad(0.2));
  }, [getZoneGeometry]);

  const handleCopyZoneToExistingLayer = useCallback(async (zone: SegmentZone, layerId: string) => {
    if (!detail?.id) return;
    const geom = getZoneGeometry(zone);
    if (!geom) return;
    const L = (await import("leaflet")).default;
    const gj = L.geoJSON(geom);
    const first = gj.getLayers()[0] as Layer | undefined;
    if (!first) return;
    await saveFeature(detail.id, layerId, first as ExtendedLayer, features, setFeatures);
  }, [detail?.id, features, setFeatures, getZoneGeometry]);

  const handleCopyZoneToNewLayer = useCallback(async (zone: SegmentZone) => {
    if (!detail?.id) return;
    const geom = getZoneGeometry(zone);
    if (!geom) return;
    const targetLayerId = detail.layers?.[0]?.id;
    if (!targetLayerId) return;
    const L = (await import("leaflet")).default;
    const gj = L.geoJSON(geom);
    const first = gj.getLayers()[0] as Layer | undefined;
    if (!first) return;
    await saveFeature(detail.id, targetLayerId, first as ExtendedLayer, features, setFeatures);
  }, [detail?.id, detail?.layers, features, setFeatures, getZoneGeometry]);

  const createZoneFromLastDraw = useCallback(async (zoneName?: string) => {
    if (!detail?.id || !selectedSegmentId) return;
    const layer = lastDrawnLayerRef.current;
    if (!hasToGeoJSON(layer)) {
      setFeedback("Chưa có hình vẽ. Hãy vẽ Polygon/Rectangle trước.");
      return;
    }
    const gj = layer.toGeoJSON();
    const geometry: GJObject | null =
      (gj as GJFeature)?.geometry
        ? ((gj as GJFeature).geometry as unknown as GJObject)
        : ((gj as unknown) as GJObject) ?? null;

    if (!geometry) {
      setFeedback("Không trích xuất được geometry.");
      return;
    }

    await createSegmentZone(detail.id, selectedSegmentId, {
      name: (zoneName ?? "").trim() || "New Zone",
      zoneType: (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
        ? "Area"
        : (geometry.type === "LineString" || geometry.type === "MultiLineString")
          ? "Line"
          : "Point",
      zoneGeometry: JSON.stringify(geometry),
      isPrimary: false,
    });

    const z = await getSegmentZones(detail.id, selectedSegmentId);
    const safe = (z ?? []).map((it) => it as unknown as SafeSegmentZone);
    setZones(safe);
    setFeedback("Đã tạo Zone từ hình vẽ.");
    setShowZonesPanel(true);
  }, [detail?.id, selectedSegmentId]);

  const handleCreateZoneFromDialog = useCallback(async (data: {
    name: string; description?: string; isPrimary: boolean; geometry: GJObject;
  }) => {
    if (!detail?.id || !selectedSegmentId) return;
    await createSegmentZone(detail.id, selectedSegmentId, {
      name: data.name,
      description: data.description,
      isPrimary: data.isPrimary,
      zoneType: "Area",
      zoneGeometry: JSON.stringify(data.geometry),
    });
    const z = await getSegmentZones(detail.id, selectedSegmentId);
    const safe = (z ?? []).map((it) => it as unknown as SafeSegmentZone);
    setZones(safe);
    setZoneDialogOpen(false);
    setZoneDraft(null);
    setFeedback("Đã tạo Zone từ hình vẽ.");
  }, [detail?.id, selectedSegmentId]);

  // ---------- UI ----------
  if (loading) {
    return <main className="h-screen w-screen grid place-items-center text-zinc-400">Đang tải…</main>;
  }
  if (err || !detail) {
    return <main className="h-screen w-screen grid place-items-center text-red-300">{err ?? "Không tải được bản đồ"}</main>;
  }

  const GuardBtn: React.FC<
    React.PropsWithChildren<{ title: string; onClick?: () => void; disabled?: boolean }>
  > = ({ title, onClick, disabled, children }) => (
    <button
      className="px-2 py-1.5 rounded-md bg-transparent text-white text-xs hover:bg-emerald-500/20 disabled:opacity-60"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/70 backdrop-blur-md ring-1 ring-white/15 shadow-xl py-1 px-3">
          <div className="grid grid-cols-3 place-items-stretch gap-2">
            {/* left: name & POI */}
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-2.5 py-1.5 rounded-md bg-white text-black text-sm font-medium w-52"
                placeholder="Untitled Map"
              />
              <button
                onClick={() => setShowMapPoiPanel((v) => !v)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500"
                title="Quản lý POI cấp Map"
              >
                POIs của Map
              </button>
            </div>

            {/* middle: draw & storymap tools */}
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
              <GuardBtn title="Vẽ điểm" onClick={() => enableDraw("Marker")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ đường" onClick={() => enableDraw("Line")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="7" r="2" />
                  <circle cx="19" cy="17" r="2" />
                  <path d="M7 8.5 17 15.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ vùng" onClick={() => enableDraw("Polygon")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ hình chữ nhật" onClick={() => enableDraw("Rectangle")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="12" rx="1.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ hình tròn" onClick={() => enableDraw("Circle")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Thêm chữ" onClick={() => enableDraw("Text")} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M12 6v12" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Cắt polygon" onClick={enableCutPolygon} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="8" r="2" />
                  <circle cx="5.5" cy="16" r="2" />
                  <path d="M8 9l12 8M8 15l12-8" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Xoay đối tượng" onClick={toggleRotate} disabled={toolsLoading || !mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 1-2.2-5.5" />
                  <path d="M20 4v7h-7" />
                </svg>
              </GuardBtn>

              <GuardBtn
                title="Biến hình vẽ cuối thành Zone của Segment đang chọn"
                onClick={() => createZoneFromLastDraw(window.prompt("Tên Zone?") ?? undefined)}
                disabled={!mapRef.current || !selectedSegmentId}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <path d="M8 9h8M8 13h5" />
                </svg>
              </GuardBtn>
            </div>

            <div className="flex items-center justify-end gap-1.5 overflow-x-auto no-scrollbar">
              <input
                type="file"
                accept=".geojson,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log("File selected:", file.name);
                  }
                }}
                className="hidden"
                id="upload-layer"
              />
              <label
                htmlFor="upload-layer"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 cursor-pointer"
                title="Upload GeoJSON file to add as layer"
              >
                Upload Layer
              </label>
              <button
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
                onClick={saveView}
                disabled={busySaveView || !mapRef.current}
                title="Lưu tâm & zoom hiện tại"
              >
                {busySaveView ? "Đang lưu…" : "Save view"}
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700"
                onClick={clearSketch}
                disabled={!mapRef.current}
              >
                Xoá vẽ
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
                onClick={saveMeta}
                disabled={busySaveMeta}
              >
                {busySaveMeta ? "Đang lưu…" : "Save"}
              </button>
            </div>
          </div>

          {feedback && (
            <div className="px-1 pt-1 text-center text-[11px] text-emerald-300">
              {feedback}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapEl} className="absolute inset-0" />

      {/* Segment & Zone panel (StoryMap) */}
      <div className="absolute right-5 top-0 z-[3000] w-80 pointer-events-auto">
        {detail && (
          <SegmentPanel
            mapId={mapId}
            layers={(detail?.layers ?? []).map((l) => ({ id: l.id, name: l.name ?? "Layer" }))}
            currentLayerId={selectedLayer && "id" in (selectedLayer as RawLayer) ? (selectedLayer as RawLayer).id : ""}
            onZoomZone={handleZoomZone}
            onCopyZoneToExistingLayer={handleCopyZoneToExistingLayer}
            onCopyZoneToNewLayer={handleCopyZoneToNewLayer}
          />
        )}
      </div>

      {/* Map-level POIs */}
      {showMapPoiPanel && (
        <div className="absolute left-3 top-14 z-[3000] w-[380px]">
          <MapPoiPanel mapId={mapId} />
        </div>
      )}

      {/* Layers / Features panel */}
      <DataLayersPanel
        features={features}
        layers={layers}
        showDataLayersPanel={showDataLayersPanel}
        setShowDataLayersPanel={setShowDataLayersPanel}
        map={mapRef.current}
        dataLayerRefs={dataLayerRefs}
        onLayerVisibilityChange={onLayerVisibilityChange}
        onFeatureVisibilityChange={onFeatureVisibilityChange}
        onSelectLayer={onSelectLayer}
        onDeleteFeature={onDeleteFeature}
        onBaseLayerChange={setBaseKey}
        currentBaseLayer={baseKey}
      />

      {/* Zones list popup */}
      {showZonesPanel && (
        <div className="absolute right-2 top-16 z-[3000] w-80 bg-black/70 backdrop-blur-md ring-1 ring-white/15 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Zones {zonesLoading && <span className="opacity-60">(loading)</span>}
            </div>
            <button
              className="text-xs px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600"
              onClick={() => setShowZonesPanel(false)}
              title="Đóng"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[45vh] overflow-auto no-scrollbar space-y-1">
            {zones.map((z) => (
              <div key={z.segmentZoneId} className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/70 px-2 py-1">
                <button
                  className="text-left text-xs truncate"
                  title={z.name ?? ""}
                  onClick={async () => {
                    if (!mapRef.current) return;
                    const L = (await import("leaflet")).default;
                    const geom = z.geometry;
                    if (!geom) return;
                    const gjLayer = L.geoJSON(geom as GJObject);
                    const b = gjLayer.getBounds();
                    if (b?.isValid()) mapRef.current.fitBounds(b.pad(0.2));
                  }}
                >
                  {z.name ?? "Unnamed Zone"}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    className="text-[11px] px-1 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600"
                    onClick={async () => {
                      if (!detail?.id || !selectedSegmentId) return;
                      const newName = window.prompt("Đổi tên zone:", z.name ?? "");
                      if (newName == null) return;
                      await updateSegmentZone(detail.id, selectedSegmentId, z.segmentZoneId, { name: newName });
                      const zz = await getSegmentZones(detail.id, selectedSegmentId);
                      const safe = (zz ?? []).map((it) => it as unknown as SafeSegmentZone);
                      setZones(safe);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="text-[11px] px-1 py-0.5 rounded bg-red-600 hover:bg-red-500"
                    onClick={async () => {
                      if (!detail?.id || !selectedSegmentId) return;
                      if (!window.confirm("Xoá zone này?")) return;
                      await deleteSegmentZone(detail.id, selectedSegmentId, z.segmentZoneId);
                      const zz = await getSegmentZones(detail.id, selectedSegmentId);
                      const safe = (zz ?? []).map((it) => it as unknown as SafeSegmentZone);
                      setZones(safe);
                    }}
                  >
                    Del
                  </button>
                </div>
              </div>
            ))}
            {!zones.length && !zonesLoading && (
              <div className="text-xs text-zinc-400">
                Chưa có zone. Vẽ Polygon/Rectangle rồi bấm “Tạo Zone từ hình vẽ”.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Style panel */}
      <StylePanel
        selectedLayer={selectedLayer}
        showStylePanel={showStylePanel}
        setShowStylePanel={setShowStylePanel}
        onUpdateLayer={onUpdateLayer}
        onUpdateFeature={onUpdateFeature}
      />
      {poiDialogOpen && (
        <PoiDialog
          open={poiDialogOpen}
          initial={poiForm}
          onCancel={() => setPoiDialogOpen(false)}
          onSubmit={async (form) => {
            try {
              await createMapPoi(mapId, {
                title: form.title,
                subtitle: form.subtitle,
                markerGeometry: JSON.stringify(form.markerGeometry),
                highlightOnEnter: form.highlightOnEnter,
                shouldPin: form.shouldPin,
              });
              setPoiDialogOpen(false);
            } catch (err) {
              alert("Tạo POI thất bại: " + (err instanceof Error ? err.message : ""));
            }
          }}
        />
      )}

      {/* Create Zone dialog */}
      <CreateZoneDialog
        open={zoneDialogOpen}
        draft={zoneDraft}
        busy={false}
        onCancel={() => setZoneDialogOpen(false)}
        onCreate={handleCreateZoneFromDialog}
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
