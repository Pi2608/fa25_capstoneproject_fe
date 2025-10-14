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
  type UserAccessTool,
  getMapById,
  type RawLayer,
  type UpdateMapFeatureRequest,
} from "@/lib/api";
import type { Position } from "geojson";
import {
  saveFeature,
  loadFeaturesToMap,
  deleteFeatureFromDB,
  type FeatureData,
  renderAllDataLayers,
  updateLayerStyle,
  updateFeatureStyle,
  handleLayerVisibilityChange,
  handleFeatureVisibilityChange,
  handleUpdateLayerStyle,
  handleUpdateFeatureStyle,
  handleDeleteFeature,
  handleSelectLayer
} from "@/utils/mapUtils";
import { StylePanel, DataLayersPanel } from "@/components/map/MapControls";
import ZoneContextMenu, { LayerPickerDialog } from "@/components/map/ZoneContextMenu";
import CopyFeatureDialog from "@/components/CopyFeatureDialog";
import FeaturePropertiesPanel from "@/components/FeaturePropertiesPanel";
import {
  getFeatureName,
  getFeatureBounds,
  formatCoordinates,
  copyToClipboard,
  findFeatureIndex,
  removeFeatureFromGeoJSON
} from "@/utils/zoneOperations";
import {
  copyZoneToLayer,
  deleteZoneFromLayer,
  updateLayerData
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

type ZoneContextMenuDetail = {
  visible: boolean;
  x: number;
  y: number;
  feature: GeoJSON.Feature | null;
  layerId: string | null;
  layerName: string | null;
  leafletLayer: Layer | null;
};

export default function MapEditor() {
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
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showDataLayersPanel, setShowDataLayersPanel] = useState(true);
  const [showFeaturePropertiesPanel, setShowFeaturePropertiesPanel] = useState(false);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [locating, setLocating] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<FeatureData | RawLayer | null>(null);

  const [contextMenu, setContextMenu] = useState<ZoneContextMenuDetail>({
    visible: false,
    x: 0,
    y: 0,
    feature: null,
    layerId: null,
    layerName: null,
    leafletLayer: null
  });

  const [copyFeatureDialog, setCopyFeatureDialog] = useState<{
    isOpen: boolean;
    sourceLayerId: string;
    sourceLayerName: string;
    featureIndex: number;
    copyMode: "existing" | "new";
  }>({
    isOpen: false,
    sourceLayerId: '',
    sourceLayerName: '',
    featureIndex: -1,
    copyMode: "existing"
  });

  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<{
    layerId: string;
    featureIndex: number;
  } | null>(null);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);
  const dataLayerRefs = useRef<Map<string, Layer>>(new Map());

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

  const applyBaseLayer = useCallback((kind: BaseKey) => {
    const map = mapRef.current;
    if (!map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) {
      console.error("Missing NEXT_PUBLIC_MAPTILER_KEY");
    }

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      const attribution =
        '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> ' +
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

      const commonOpts: L.TileLayerOptions = {
        minZoom: 0,
        maxZoom: 20,
        attribution,
        crossOrigin: true,
        errorTileUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      };

      let url = "";
      if (kind === "sat") {
        url = `https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${key}`;
      } else if (kind === "dark") {
        url = `https://api.maptiler.com/maps/dark-v2/256/{z}/{x}/{y}.png?key=${key}`;
      } else {
        url = `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${key}`;
      }

      if (cancelled) return;
      const layer = L.tileLayer(url, commonOpts);

      if ((map as unknown as { _loaded?: boolean })._loaded === false) {
        map.whenReady(() => {
          if (!cancelled) {
            layer.addTo(map);
            baseRef.current = layer;
          }
        });
      } else {
        layer.addTo(map);
        baseRef.current = layer;
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const m = await getMapDetail(mapId);
        if (!alive) return;

        console.log('Loaded map detail:', m);
        console.log('Layers count:', m.layers?.length);
        console.log('Base map provider:', m.baseMapProvider);

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

  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;

    const hasValidCoords = typeof detail.initialLatitude === 'number' &&
      typeof detail.initialLongitude === 'number' &&
      typeof detail.initialZoom === 'number';

    if (!hasValidCoords) {
      console.warn('Invalid map detail data, will use fallback values during initialization');
    }

    let alive = true;
    const el = mapEl.current;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");
      if (!alive || !el) return;

      const initialLat = typeof detail.initialLatitude === 'number' ? detail.initialLatitude : Number(detail.initialLatitude);
      const initialLng = typeof detail.initialLongitude === 'number' ? detail.initialLongitude : Number(detail.initialLongitude);
      const initialZoom = typeof detail.initialZoom === 'number' ? detail.initialZoom : Number(detail.initialZoom);

      const validLat = isNaN(initialLat) || initialLat < -90 || initialLat > 90 ? 10.78 : initialLat;
      const validLng = isNaN(initialLng) || initialLng < -180 || initialLng > 180 ? 106.69 : initialLng;
      const validZoom = isNaN(initialZoom) || initialZoom < 1 || initialZoom > 20 ? 13 : Math.min(20, Math.max(1, initialZoom));

      const map = L.map(el, {
        zoomControl: false,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0
      })
        .setView([validLat, validLng], validZoom) as MapWithPM;

      mapRef.current = map;
      if (!alive) return;

      applyBaseLayer(
        detail.baseMapProvider === "Satellite"
          ? "sat"
          : detail.baseMapProvider === "Dark"
            ? "dark"
            : "osm"
      );

      const sketch = L.featureGroup().addTo(map);
      sketchRef.current = sketch;

      const loadedFeatures = await loadFeaturesToMap(
        detail.id,
        L,
        sketch
      );
      setFeatures(loadedFeatures);

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
        await saveFeature(
          detail.id,
          detail?.layers[0].id,
          e.layer as ExtendedLayer,
          features,
          setFeatures
        );
      });
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
    };
  }, [detail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !detail?.layers) return;

    console.log('🎯 About to render data layers:', detail.layers.length, 'layers');
    const abortController = new AbortController();

    renderAllDataLayers(map, detail.layers, dataLayerRefs, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [detail?.layers]);

  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

  useEffect(() => {
    const handleZoneContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent<ZoneContextMenuDetail>;
      const { feature, layerId, layerName, x, y, leafletLayer } = customEvent.detail;

      setContextMenu({
        visible: true,
        x,
        y,
        feature,
        layerId,
        layerName,
        leafletLayer
      });
    };

    window.addEventListener('zone-contextmenu', handleZoneContextMenu);

    return () => {
      window.removeEventListener('zone-contextmenu', handleZoneContextMenu);
    };
  }, []);

  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") => {
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

  const clearSketch = useCallback(async () => {
    if (!detail) return;

    for (const feature of features) {
      if (feature.featureId) {
        await deleteFeatureFromDB(detail.id, feature.featureId);
      }
    }

    sketchRef.current?.clearLayers();
    setFeatures([]);
  }, [detail, features]);

  const onLayerVisibilityChange = useCallback(async (layerId: string, isVisible: boolean) => {
    if (!detail || !mapRef.current) return;
    await handleLayerVisibilityChange(detail.id, layerId, isVisible, mapRef.current, detail.layers, dataLayerRefs);
  }, [detail]);

  const onFeatureVisibilityChange = useCallback(async (featureId: string, isVisible: boolean) => {
    if (!detail) return;
    await handleFeatureVisibilityChange(detail.id, featureId, isVisible, features, setFeatures, mapRef.current, sketchRef.current);
  }, [detail, features]);

  const onSelectLayer = useCallback((layer: FeatureData | RawLayer) => {
    handleSelectLayer(layer, setSelectedLayer, setShowStylePanel);
  }, []);

  const onUpdateLayer = useCallback(async (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => {
    if (!detail || !mapRef.current) return;
    await handleUpdateLayerStyle(detail.id, layerId, updates, mapRef.current, detail.layers, dataLayerRefs);
  }, [detail]);

  const onUpdateFeature = useCallback(async (featureId: string, updates: UpdateMapFeatureRequest) => {
    if (!detail) return;
    const convertedUpdates = {
      name: updates.name ?? undefined,
      style: updates.style ?? undefined,
      properties: updates.properties ?? undefined,
      isVisible: updates.isVisible ?? undefined,
      zIndex: updates.zIndex ?? undefined,
    };
    await handleUpdateFeatureStyle(detail.id, featureId, convertedUpdates);
  }, [detail]);

  const onDeleteFeature = useCallback(async (featureId: string) => {
    if (!detail) return;
    await handleDeleteFeature(detail.id, featureId, features, setFeatures, mapRef.current, sketchRef.current);
  }, [detail, features]);

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

  const handleZoomToFit = useCallback(async () => {
    if (!mapRef.current || !contextMenu.feature) return;

    const bounds = getFeatureBounds(contextMenu.feature);
    if (bounds) {
      const L = (await import("leaflet")).default;
      const leafletBounds = L.latLngBounds(bounds);
      mapRef.current.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }, [contextMenu.feature]);

  const handleCopyCoordinates = useCallback(async () => {
    if (!contextMenu.feature) return;

    const coordsText = formatCoordinates(contextMenu.feature);
    const success = await copyToClipboard(coordsText);

    if (success) {
      setFeedback('📍 Coordinates copied to clipboard!');
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback('❌ Failed to copy coordinates');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [contextMenu.feature]);

  const openCopyFeatureDialog = useCallback((copyMode: "existing" | "new") => {
    console.log("📝 openCopyFeatureDialog called with mode:", copyMode);
    console.log("📊 Detail:", detail);
    console.log("📊 ContextMenu:", contextMenu);

    if (!detail || !contextMenu.feature || !contextMenu.layerId) {
      console.log("❌ Missing required data:", { detail: !!detail, feature: !!contextMenu.feature, layerId: !!contextMenu.layerId });
      return;
    }

    const sourceLayerId = contextMenu.layerId;
    const sourceLayer = detail.layers.find(l => l.id === sourceLayerId);
    const sourceLayerName = sourceLayer?.name || 'Unknown Layer';

    const layerData = JSON.parse(sourceLayer?.layerData || '{}');
    const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

    console.log("🔍 Feature search result:", { featureIndex, layerData, feature: contextMenu.feature });

    if (featureIndex === -1) {
      console.log("❌ Feature not found in layer");
      setFeedback('❌ Feature not found in layer');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    console.log("✅ Opening copy dialog with:", { sourceLayerId, sourceLayerName, featureIndex, copyMode });
    setCopyFeatureDialog({
      isOpen: true,
      sourceLayerId,
      sourceLayerName,
      featureIndex,
      copyMode
    });
  }, [detail, contextMenu]);

  const handleCopyToExistingLayer = useCallback(() => {
    openCopyFeatureDialog("existing");
  }, [openCopyFeatureDialog]);

  const handleCopyToNewLayer = useCallback(() => {
    console.log("🚀 handleCopyToNewLayer called!");
    openCopyFeatureDialog("new");
  }, [openCopyFeatureDialog]);

  const handleFeatureSelect = useCallback(async (feature: GeoJSON.Feature, layerId: string, featureIndex: number) => {
    setSelectedFeature({ layerId, featureIndex });

    if (mapRef.current && feature.geometry) {
      try {
        const L = (await import("leaflet")).default;
        const geoJsonLayer = L.geoJSON(feature);
        const bounds = geoJsonLayer.getBounds();
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
      } catch (error) {
        console.error('Failed to zoom to feature:', error);
      }
    }
  }, []);

  const handleCopyFeatureSuccess = useCallback(async (message: string) => {
    setFeedback(`✅ ${message}`);
    setTimeout(() => setFeedback(null), 3000);

    if (detail) {
      const updatedDetail = await getMapDetail(detail.id);
      setDetail(updatedDetail);
    }
  }, [detail]);

  const handleLayerSelected = useCallback(async (targetLayerId: string) => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) return;

    const sourceLayerId = contextMenu.layerId;

    const sourceLayer = detail.layers.find(l => l.id === sourceLayerId);
    if (!sourceLayer) {
      setFeedback('❌ Source layer not found');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    try {
      const layerData = JSON.parse(sourceLayer.layerData);
      const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

      if (featureIndex === -1) {
        setFeedback('❌ Feature not found in layer');
        setTimeout(() => setFeedback(null), 2000);
        return;
      }

      const success = await copyZoneToLayer(detail.id, sourceLayerId, targetLayerId, featureIndex);

      if (success) {
        setFeedback('✅ Zone copied to layer successfully!');
        setTimeout(() => setFeedback(null), 2000);

        const updatedDetail = await getMapDetail(detail.id);
        setDetail(updatedDetail);
      } else {
        setFeedback('❌ Failed to copy zone to layer');
        setTimeout(() => setFeedback(null), 2000);
      }
    } catch (error) {
      console.error('Error copying zone:', error);
      setFeedback('❌ Error copying zone');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [detail, contextMenu]);

  const handleDeleteZone = useCallback(async () => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${getFeatureName(contextMenu.feature)}"?`
    );

    if (!confirmed) return;

    const layerId = contextMenu.layerId;
    const targetLayer = detail.layers.find(l => l.id === layerId);

    if (!targetLayer) {
      setFeedback('❌ Layer not found');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    try {
      const layerData = JSON.parse(targetLayer.layerData);
      const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

      if (featureIndex === -1) {
        setFeedback('❌ Feature not found in layer');
        setTimeout(() => setFeedback(null), 2000);
        return;
      }

      const updatedGeoJSON = removeFeatureFromGeoJSON(layerData, featureIndex);

      const success = await updateLayerData(detail.id, layerId, updatedGeoJSON);

      if (success) {
        setFeedback('✅ Zone deleted successfully!');
        setTimeout(() => setFeedback(null), 2000);

        if (contextMenu.leafletLayer && mapRef.current) {
          mapRef.current.removeLayer(contextMenu.leafletLayer);
        }

        const updatedDetail = await getMapDetail(detail.id);
        setDetail(updatedDetail);
      } else {
        setFeedback('❌ Failed to delete zone');
        setTimeout(() => setFeedback(null), 2000);
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
      setFeedback('❌ Error deleting zone');
      setTimeout(() => setFeedback(null), 2000);
    }
  }, [detail, contextMenu]);

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

  if (loading) {
    return (
      <main className="relative h-screen w-screen overflow-hidden text-white" suppressHydrationWarning={true}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/60">Loading map...</div>
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="relative h-screen w-screen overflow-hidden text-white" suppressHydrationWarning={true}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-400">Error: {err}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white" suppressHydrationWarning={true}>
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
              <button
                onClick={() => setShowFeaturePropertiesPanel(!showFeaturePropertiesPanel)}
                className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center gap-2"
                title="Feature Properties"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Properties
              </button>

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

      <div
        ref={mapEl}
        className="absolute inset-0"
        style={{
          minHeight: '100vh',
          minWidth: '100vw'
        }}
        suppressHydrationWarning={true}
      />

      <DataLayersPanel
        features={features}
        layers={detail?.layers || []}
        showDataLayersPanel={showDataLayersPanel}
        setShowDataLayersPanel={setShowDataLayersPanel}
        map={mapRef.current}
        dataLayerRefs={dataLayerRefs}
        onLayerVisibilityChange={onLayerVisibilityChange}
        onFeatureVisibilityChange={onFeatureVisibilityChange}
        onSelectLayer={onSelectLayer}
        onDeleteFeature={onDeleteFeature}
      />

      <StylePanel
        selectedLayer={selectedLayer}
        showStylePanel={showStylePanel}
        setShowStylePanel={setShowStylePanel}
        onUpdateLayer={onUpdateLayer}
        onUpdateFeature={onUpdateFeature}
      />

      {showFeaturePropertiesPanel && (
        <div className="fixed top-20 right-4 w-96 max-h-[calc(100vh-6rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-40 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Feature Properties</h3>
            <button
              onClick={() => setShowFeaturePropertiesPanel(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-10rem)]">
            <FeaturePropertiesPanel
              layers={detail?.layers || []}
              selectedLayerId={selectedFeature?.layerId}
              onFeatureSelect={handleFeatureSelect}
              selectedFeature={selectedFeature || undefined}
            />
          </div>
        </div>
      )}

      <ZoneContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        zoneName={contextMenu.feature ? getFeatureName(contextMenu.feature) : 'Zone'}
        onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        onZoomToFit={handleZoomToFit}
        onCopyCoordinates={handleCopyCoordinates}
        onCopyToExistingLayer={handleCopyToExistingLayer}
        onCopyToNewLayer={handleCopyToNewLayer}
        onDeleteZone={handleDeleteZone}
        mapId={detail?.id}
        layerId={contextMenu.layerId ?? undefined}
        feature={contextMenu.feature ?? undefined}
      />

      <LayerPickerDialog
        visible={showLayerPicker}
        layers={detail?.layers.map(l => ({ id: l.id, name: l.name })) || []}
        currentLayerId={contextMenu.layerId || ''}
        onSelect={handleLayerSelected}
        onClose={() => setShowLayerPicker(false)}
      />

      {/* Copy Feature Dialog - Temporarily disabled */}
      {/* <CopyFeatureDialog
        isOpen={copyFeatureDialog.isOpen}
        onClose={() => setCopyFeatureDialog(prev => ({ ...prev, isOpen: false }))}
        mapId={detail?.id || ''}
        sourceLayerId={copyFeatureDialog.sourceLayerId}
        sourceLayerName={copyFeatureDialog.sourceLayerName}
        featureIndex={copyFeatureDialog.featureIndex}
        initialCopyMode={copyFeatureDialog.copyMode}
        onSuccess={handleCopyFeatureSuccess}
      /> */}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-top.leaflet-left .leaflet-control { display: none !important; }
      `}</style>
    </main>
  );
}

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
