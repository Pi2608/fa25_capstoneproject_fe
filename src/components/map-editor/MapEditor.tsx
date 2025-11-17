"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple, Layer, FeatureGroup } from "leaflet";

import {
  saveFeature,
  loadFeaturesToMap,
  deleteFeatureFromDB,
  type FeatureData,
  renderAllDataLayers,
  handleLayerVisibilityChange,
  handleFeatureVisibilityChange,
  handleUpdateLayerStyle,
  handleUpdateFeatureStyle,
  handleDeleteFeature,
  handleSelectLayer
} from "@/utils/mapUtils";
import { DataLayersPanel } from "@/components/map";
import ZoneContextMenu, { LayerPickerDialog } from "@/components/map/ZoneContextMenu";
import { CopyFeatureDialog, FeaturePropertiesPanel } from "@/components/features";
import { getFeatureName, findFeatureIndex } from "@/utils/zoneOperations";
import { useToast } from "@/contexts/ToastContext";
import { getMapDetail, LayerDTO, updateMap, UpdateMapFeatureRequest, UpdateMapRequest } from "@/lib/api-maps";
import MapToolbar from "./components/MapToolbar";
import { useBaseLayer, useContextMenu, usePoiPicker, useMapDetail } from "./hooks";
import type { MapWithPM, PMCreateEvent, ExtendedLayer, CopyFeatureDialogState, SelectedFeatureState } from "./types";
import { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

export default function MapEditor() {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";
  const { showToast } = useToast();

  // Use custom hooks
  const { detail, setDetail, loading, err, name, setName, description, setDescription, baseKey, setBaseKey } = useMapDetail(mapId);

  // State
  const [busySaveMeta, setBusySaveMeta] = useState<boolean>(false);
  const [busySaveView, setBusySaveView] = useState<boolean>(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showDataLayersPanel, setShowDataLayersPanel] = useState(true);
  const [showFeaturePropertiesPanel, setShowFeaturePropertiesPanel] = useState(false);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<FeatureData | LayerDTO | null>(null);
  const [, setFeatureVisibility] = useState<Record<string, boolean>>({});
  const [, setLayerVisibility] = useState<Record<string, boolean>>({});

  const [copyFeatureDialog, setCopyFeatureDialog] = useState<CopyFeatureDialogState>({
    isOpen: false,
    sourceLayerId: '',
    sourceLayerName: '',
    featureIndex: -1,
    copyMode: "existing"
  });

  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeatureState>(null);

  // Refs
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);
  const dataLayerRefs = useRef<Map<string, Layer>>(new Map());

  // Custom hooks
  const { applyBaseLayer } = useBaseLayer(mapRef);
  const {
    contextMenu,
    setContextMenu,
    handleZoomToFit,
    handleCopyCoordinates,
    handleLayerSelected,
    handleDeleteZone
  } = useContextMenu(detail, mapRef, showToast, setDetail);

  usePoiPicker(mapRef);

  // Initialize map
  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");
      if (!alive || !el) return;

      const initialLat = typeof detail.viewState?.center[1] === 'number' ? detail.viewState?.center[1] : Number(detail.viewState?.center[1]);
      const initialLng = typeof detail.viewState?.center[0] === 'number' ? detail.viewState?.center[0] : Number(detail.viewState?.center[0]);
      const initialZoom = typeof detail.viewState?.zoom === 'number' ? detail.viewState?.zoom : Number(detail.viewState?.zoom);

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
        detail.baseLayer?.toLowerCase() === "satellite"
          ? "sat"
          : detail.baseLayer === "Dark"
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
  }, [detail, applyBaseLayer, features]);

  // Render data layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !detail?.layers) return;

    const abortController = new AbortController();
    renderAllDataLayers(map, detail.layers, dataLayerRefs, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [detail?.layers]);

  // Apply base layer when changed
  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

  // Callbacks
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
    const layerData = detail.layers.find((l: LayerDTO) => l.id === layerId);
    await handleLayerVisibilityChange(
      detail.id,
      layerId,
      isVisible,
      mapRef.current,
      dataLayerRefs,
      setLayerVisibility,
      layerData
    );
  }, [detail]);

  const onFeatureVisibilityChange = useCallback(async (featureId: string, isVisible: boolean) => {
    if (!detail) return;
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
  }, [detail, features]);

  const onSelectLayer = useCallback((layer: FeatureData | LayerDTO) => {
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
    try {
      const body: UpdateMapRequest = {
        name: (name ?? "").trim() || "Untitled Map",
        description: (description ?? "").trim() || undefined,
        baseLayer:
          baseKey === "osm" ? "OSM" : baseKey === "sat" ? "Satellite" : "Dark",
      };
      await updateMap(detail.id, body);
      showToast("success", "Đã lưu thông tin bản đồ.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveMeta(false);
    }
  }, [detail, name, description, baseKey, showToast]);

  const saveView = useCallback(async () => {
    if (!detail || !mapRef.current) return;
    setBusySaveView(true);
    try {
      const c = mapRef.current.getCenter();
      const view = {
        center: [c.lat, c.lng] as [number, number],
        zoom: mapRef.current.getZoom(),
      };
      const body: UpdateMapRequest = { viewState: JSON.stringify(view) };
      await updateMap(detail.id, body);
      showToast("success", "Đã lưu vị trí hiển thị.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveView(false);
    }
  }, [detail, showToast]);

  const openCopyFeatureDialog = useCallback((copyMode: "existing" | "new") => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) {
      return;
    }

    const sourceLayerId = contextMenu.layerId;
    const sourceLayer = detail.layers.find((l: LayerDTO) => l.id === sourceLayerId);
    const sourceLayerName = sourceLayer?.layerName || 'Unknown Layer';

    const layerData = JSON.parse(sourceLayer?.layerData as unknown as string || '{}') as FeatureCollection<Geometry, GeoJsonProperties>;
    const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

    if (featureIndex === -1) {
      showToast("error", "❌ Feature not found in layer");
      return;
    }

    setCopyFeatureDialog({
      isOpen: true,
      sourceLayerId,
      sourceLayerName,
      featureIndex,
      copyMode
    });
  }, [detail, contextMenu, showToast]);

  const handleCopyToExistingLayer = useCallback(() => {
    openCopyFeatureDialog("existing");
  }, [openCopyFeatureDialog]);

  const handleCopyToNewLayer = useCallback(() => {
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
    showToast("success", `✅ ${message}`);

    if (detail) {
      const updatedDetail = await getMapDetail(detail.id);
      setDetail(updatedDetail);
    }
  }, [detail, showToast, setDetail]);

  // Loading/Error states
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
      <MapToolbar
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        baseKey={baseKey}
        setBaseKey={setBaseKey}
        mapRef={mapRef}
        showFeaturePropertiesPanel={showFeaturePropertiesPanel}
        setShowFeaturePropertiesPanel={setShowFeaturePropertiesPanel}
        onSaveView={saveView}
        onClearSketch={clearSketch}
        onSaveMeta={saveMeta}
        busySaveView={busySaveView}
        busySaveMeta={busySaveMeta}
      />

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
        layers={detail?.layers.map((l: LayerDTO) => ({ id: l.id, name: l.layerName })) || []}
        currentLayerId={contextMenu.layerId || ''}
        onSelect={handleLayerSelected}
        onClose={() => setShowLayerPicker(false)}
      />

      <CopyFeatureDialog
        isOpen={copyFeatureDialog.isOpen}
        onClose={() => setCopyFeatureDialog(prev => ({ ...prev, isOpen: false }))}
        mapId={detail?.id || ''}
        sourceLayerId={copyFeatureDialog.sourceLayerId}
        sourceLayerName={copyFeatureDialog.sourceLayerName}
        featureIndex={copyFeatureDialog.featureIndex}
        initialCopyMode={copyFeatureDialog.copyMode}
        onSuccess={handleCopyFeatureSuccess}
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
