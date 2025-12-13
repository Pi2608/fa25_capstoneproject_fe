"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple, FeatureGroup } from "leaflet";
import type L from "leaflet";
import { debounce, rafThrottle, BatchUpdater } from "@/utils/performance";
import { type FeatureData, extractLayerStyle, applyLayerStyle, handleLayerVisibilityChange, handleFeatureVisibilityChange, getFeatureType as getFeatureTypeUtil, updateFeatureInDB, deleteFeatureFromDB, loadFeaturesToMap, loadLayerToMap, type ExtendedLayer, saveFeature, } from "@/utils/mapUtils";
import { getFeatureName, getFeatureBounds, formatCoordinates, copyToClipboard, findFeatureIndex, removeFeatureFromGeoJSON } from "@/utils/zoneOperations";
import * as mapHelpers from "@/utils/mapHelpers";
import { calculateEffectiveSegmentDuration } from "@/utils/segmentTiming";

import type { BaseKey, Layer, LeafletMouseEvent, LeafletMapClickEvent, MapWithPM, PMCreateEvent, LayerStyle, PathLayer, LocationType, GeomanLayer } from "@/types";

interface CircleLayer extends Layer {
  setRadius(radius: number): void;
}
import { getSegments, reorderSegments, type Segment, type TimelineTransition, getTimelineTransitions, getRouteAnimationsBySegment, updateSegment, createSegment, deleteSegment, createTimelineTransition, deleteTimelineTransition, type Location } from "@/lib/api-storymap";
import { getMapDetail, type MapDetail, updateMap, type UpdateMapRequest, type UpdateMapFeatureRequest, uploadGeoJsonToMap, updateLayerData, MapStatus, updateMapFeature, LayerDTO, getMapFeatureById, type BaseLayer, createExport, getExportById, type ExportRequest, type ExportResponse} from "@/lib/api-maps";
import { createMapLocation, deleteLocation, getMapLocations } from "@/lib/api-location";

import { LeftSidebarToolbox, TimelineWorkspace, PropertiesPanel, DrawingToolsBar, ActiveUsersIndicator, MeasurementInfoBox } from "@/components/map-editor-ui";
import { LocationInfoPanel } from "@/components/map-editor-ui/LocationInfoPanel";
import ZoneContextMenu from "@/components/map/ZoneContextMenu";
import { CopyFeatureDialog } from "@/components/features";
import SequentialRoutePlaybackWrapper from "@/components/storymap/SequentialRoutePlaybackWrapper";

import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { iconEmojiMap, iconLabelMap, labelToIconKeyMap } from "@/constants/icons";
import { useMapCollaboration, type MapSelection } from "@/hooks/useMapCollaboration";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import { useLayerStyles } from "@/hooks/useLayerStyles";
import { useCollaborationVisualization } from "@/hooks/useCollaborationVisualization";
import { useFeatureManagement } from "@/hooks/useFeatureManagement";
import { usePoiMarkers } from "@/hooks/usePoiMarkers";
import { useZoneMarkers } from "@/hooks/useZoneMarkers";
import { useMeasurementTools } from "@/hooks/useMeasurementTools";
import type { FeatureCollection, Feature as GeoJSONFeature, Position } from "geojson";
import { SaveIcon, UploadIcon, DownloadIcon } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import html2canvas from "html2canvas";
import { useI18n } from "@/i18n/I18nProvider";
import PublishButton from "@/components/map/PublishButton";
import ZoomControls from "@/components/map/controls/ZoomControls";
import { ZoneStyleEditor } from "@/components/map-editor-ui/ZoneStyleEditor";
import EmbedCodeGenerator from "@/components/map/EmbedCodeGenerator";


const baseKeyToBackend = (key: BaseKey): BaseLayer => {
  const mapping: Record<BaseKey, BaseLayer> = {
    "osm": "OSM",
    "sat": "Satellite",
    "dark": "Dark",
    "positron": "Positron",
    "dark-matter": "DarkMatter",
    "terrain": "Terrain",
    "toner": "Toner",
    "watercolor": "Watercolor",
    "topo": "Topo"
  };
  return mapping[key] || "OSM";
};

const backendToBaseKey = (backendValue: string | null | undefined): BaseKey => {
  if (!backendValue) return "osm";
  const normalized = backendValue.toLowerCase();

  const mapping: Record<string, BaseKey> = {
    "osm": "osm",
    "openstreetmap": "osm",
    "satellite": "sat",
    "dark": "dark",
    "positron": "positron",
    "darkmatter": "dark-matter",
    "dark-matter": "dark-matter",
    "terrain": "terrain",
    "toner": "toner",
    "watercolor": "watercolor",
    "topo": "topo",
    "opentopomap": "topo"
  };

  return mapping[normalized] || "osm";
};

export default function EditMapPage() {
  const params = useParams<{ mapId: string }>();
  const sp = useSearchParams();
  const mapId = params?.mapId ?? "";

  const [isMapReady, setIsMapReady] = useState(false);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("draft");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { showToast } = useToast();
  const { t, lang } = useI18n();

  // Export functionality state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"geojson" | "png" | "pdf">("geojson");
  const [exportStatus, setExportStatus] = useState<ExportResponse | null>(null);
  const [exportModalTab, setExportModalTab] = useState<"export" | "embed">("export");

  const [name, setName] = useState<string>("");
  const [isEditingMapName, setIsEditingMapName] = useState<boolean>(false);
  const [editingMapName, setEditingMapName] = useState<string>("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<FeatureData | LayerDTO | null>(null);
  const [layers, setLayers] = useState<LayerDTO[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [featureVisibility, setFeatureVisibility] = useState<Record<string, boolean>>({})

  // Current layer ID for drawing new features
  const [currentLayerId, setCurrentLayerId] = useState<string | null>(null);

  // POI tooltip modal state
  const [poiTooltipModal, setPoiTooltipModal] = useState<{
    isOpen: boolean;
    locationId?: string;
    title?: string;
    subtitle?: string;
    content?: string;
    poi?: Location;
  }>({
    isOpen: false,
  });

  // New VSCode-style UI state
  const [leftSidebarView, setLeftSidebarView] = useState<"explorer" | "segments" | "transitions" | "icons" | "locations" | "zones" | "library" | null>("explorer");
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "feature" | "layer" | "segment";
    data: FeatureData | LayerDTO | Segment;
  } | null>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(10);

  const [selectedZone, setSelectedZone] = useState<{
    mapZone: import("@/lib/api-maps").MapZone;
    zone: import("@/lib/api-maps").Zone;
  } | null>(null);

  // Use layer styles hook for managing layer selection and styling
  const layerStyles = useLayerStyles();
  const {
    hoveredLayer,
    currentLayer,
    selectedLayers,
    originalStylesRef,
    setCurrentLayer,
    setSelectedLayers,
    storeOriginalStyle,
    applyHoverStyle,
    resetToOriginalStyle,
    applySelectionStyle,
    applyMultiSelectionStyle,
    handleLayerHover,
  } = layerStyles;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    feature: GeoJSONFeature | null;
    layerId: string | null;
    layerName: string | null;
    leafletLayer: Layer | null;
  }>({
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

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const [playbackMap, setPlaybackMap] = useState<MapWithPM | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);
  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());
  // Icon management refs for performance optimization
  const iconLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const iconMarkersRef = useRef<Map<string, L.Marker>>(new Map()); // Store all icon markers
  const iconMetadataRef = useRef<Map<string, { lat: number; lng: number; iconKey: string; timestamp: number }>>(new Map());
  const {
    otherUsersSelectionsRef,
    visualizeOtherUserSelection,
    removeUserSelectionVisualization,
  } = useCollaborationVisualization({
    mapRef,
    originalStylesRef,
    features,
  });

  usePoiMarkers({
    mapId,
    mapRef,
    isMapReady,
    setPoiTooltipModal,
  });

  useZoneMarkers({
    mapId,
    mapRef,
    isMapReady,
  });

  // Measurement tools hook
  const measurementTools = useMeasurementTools(mapRef);
  const { state: measurementState, startMeasurement, cancelMeasurement } = measurementTools;

  // Handle layer click (single or multi-select)
  const handleLayerClick = useCallback((layer: Layer, isShiftKey: boolean) => {
    if (isShiftKey) {
      // Multi-select mode
      const newSelected = new Set(selectedLayers);
      if (newSelected.has(layer)) {
        newSelected.delete(layer);
        resetToOriginalStyle(layer);
      } else {
        newSelected.add(layer);
        applyMultiSelectionStyle(layer);
      }
      setSelectedLayers(newSelected);

      // Update currentLayer to the last selected
      if (newSelected.size > 0) {
        setCurrentLayer(layer);
      } else {
        setCurrentLayer(null);
      }
    } else {
      // Single select mode - clear previous selections
      selectedLayers.forEach(l => {
        if (l !== layer) {
          resetToOriginalStyle(l);
        }
      });

      setSelectedLayers(new Set([layer]));
      setCurrentLayer(layer);
      applySelectionStyle(layer);

      // Show style panel and find corresponding feature/layer data
      const feature = features.find(f => f.layer === layer);
      if (feature) {
        setSelectedLayer(feature);
        setShowStylePanel(true);

        // Send selection update to collaboration hub
        if (collaborationRef.current?.updateSelection && mapId) {
          const latLng = (layer as any).getLatLng?.() || (layer as any).getBounds?.()?.getCenter?.();
          collaborationRef.current.updateSelection({
            mapId,
            selectionType: getFeatureTypeUtil(layer as ExtendedLayer),
            selectedObjectId: feature.featureId || feature.id,
            latitude: latLng ? latLng.lat : null,
            longitude: latLng ? latLng.lng : null,
          });
        }
      }
    }
  }, [selectedLayers, features, resetToOriginalStyle, applySelectionStyle, applyMultiSelectionStyle, mapId]);


  // Use feature management hook for Geoman event handling
  const featureManagement = useFeatureManagement({
    mapId: detail?.id || mapId || "",
    features,
    setFeatures,
    setFeatureVisibility,
    storeOriginalStyle,
    handleLayerHover,
    handleLayerClick,
    resetToOriginalStyle,
    sketchRef,
    rafThrottle,
    currentLayerId,
  });
  const {
    lastUpdateRef,
    recentlyCreatedFeatureIdsRef,
    handleFeatureCreate,
    handleSketchEdit,
    handleSketchDragEnd,
    handleSketchRotateEnd,
    // handlePolygonCut,
  } = featureManagement;

  // Initialize segment playback hook
  const playback = useSegmentPlayback({
    mapId,
    segments,
    currentMap: mapRef.current,
    currentSegmentLayers,
    setCurrentSegmentLayers,
    setActiveSegmentId,
  });


  const visualizeRef = useRef(visualizeOtherUserSelection);
  const removeVisualizationRef = useRef(removeUserSelectionVisualization);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    visualizeRef.current = visualizeOtherUserSelection;
    removeVisualizationRef.current = removeUserSelectionVisualization;
    showToastRef.current = showToast;
  }, [visualizeOtherUserSelection, removeUserSelectionVisualization, showToast]);

  const handleMapDataChangedRef = useRef<(() => Promise<void>) | null>(null);
  const collaborationRef = useRef<{
    updateSelection?: (selection: {
      mapId: string;
      selectionType: string;
      selectedObjectId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => Promise<void>;
    clearSelection?: (mapId: string) => Promise<void>;
  } | null>(null);

  const debouncedMapDataChanged = useMemo(
    () => debounce(async () => {
      if (handleMapDataChangedRef.current) {
        await handleMapDataChangedRef.current();
      }
    }, 300),
    []
  );

  const handleMapDataChanged = useCallback(async () => {
    if (!detail?.id || !isMapReady) return;

    try {
      if (mapRef.current && sketchRef.current) {
        const L = (await import("leaflet")).default;

        // Clear existing features from sketch
        sketchRef.current.clearLayers();

        const dbFeatures = await loadFeaturesToMap(detail.id, L, sketchRef.current);

        dbFeatures.forEach(feature => {
          if (feature.layer) {
            storeOriginalStyle(feature.layer);
            feature.layer.on('mouseover', () => handleLayerHover(feature.layer, true));
            feature.layer.on('mouseout', () => handleLayerHover(feature.layer, false));
            feature.layer.on('click', (event: LeafletMouseEvent) => {
              if (event.originalEvent) {
                event.originalEvent.stopPropagation();
              }
              handleLayerClick(feature.layer, event.originalEvent.shiftKey);
            });

            if (feature.featureId) {
              feature.layer.on('pm:edit', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);
                try {
                  resetToOriginalStyle(feature.layer);
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after edit:", error);
                }
              });

              feature.layer.on('pm:dragend', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);
                try {
                  resetToOriginalStyle(feature.layer);
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after drag:", error);
                }
              });

              feature.layer.on('pm:rotateend', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);
                try {
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after rotation:", error);
                }
              });
            }

            if ('pm' in feature.layer && (feature.layer as GeomanLayer).pm) {
              (feature.layer as GeomanLayer).pm.enable({
                draggable: true,
                allowEditing: true,
                allowSelfIntersection: true,
              });
            }
          }
        });

        setFeatures(dbFeatures);
        const initialFeatureVisibility: Record<string, boolean> = {};
        dbFeatures.forEach(feature => {
          initialFeatureVisibility[feature.id] = feature.isVisible ?? true;
          if (feature.featureId) {
            initialFeatureVisibility[feature.featureId] = feature.isVisible ?? true;
          }
        });
        setFeatureVisibility(initialFeatureVisibility);
      }
    } catch (error) {
      console.error("Failed to reload map data:", error);
    }
  }, [detail?.id, isMapReady, storeOriginalStyle, handleLayerHover, handleLayerClick, resetToOriginalStyle]);

  useEffect(() => {
    handleMapDataChangedRef.current = handleMapDataChanged;
  }, [handleMapDataChanged]);

  const handleFeatureUpdated = useCallback(async (featureId: string) => {
    if (!detail?.id || !isMapReady || !mapRef.current || !sketchRef.current) return;

    try {
      const updatedFeature = await getMapFeatureById(detail.id, featureId);
      if (!updatedFeature) return;

      const existingFeature = features.find(f => f.featureId === featureId);
      if (!existingFeature || !existingFeature.layer) {
        if (handleMapDataChangedRef.current) {
          handleMapDataChangedRef.current();
        }
        return;
      }

      let coordinates: Position | Position[] | Position[][];
      try {
        const parsed = JSON.parse(updatedFeature.coordinates);
        if (parsed.type && parsed.coordinates) {
          coordinates = parsed.coordinates;
        } else {
          coordinates = parsed;
        }
      } catch (error) {
        console.error("Failed to parse coordinates for updated feature:", error);
        return;
      }

      const L = (await import("leaflet")).default;
      const layer = existingFeature.layer;

      if (updatedFeature.geometryType.toLowerCase() === "point") {
        const coords = coordinates as Position;
        if ((layer as any)._latlng && 'setLatLng' in layer && typeof (layer as any).setLatLng === 'function') {
          (layer as any).setLatLng([coords[1], coords[0]]);
        }
      } else if (updatedFeature.geometryType.toLowerCase() === "linestring") {
        const coords = coordinates as Position[];
        if ('setLatLngs' in layer && typeof layer.setLatLngs === 'function') {
          (layer as any).setLatLngs(coords.map((c) => [c[1], c[0]]));
        }
      } else if (updatedFeature.geometryType.toLowerCase() === "polygon") {
        const coords = coordinates as Position[][];
        if ('setLatLngs' in layer && typeof layer.setLatLngs === 'function') {
          (layer as any).setLatLngs(coords[0].map((c) => [c[1], c[0]]));
        }
      } else if (updatedFeature.geometryType.toLowerCase() === "rectangle") {
        const rectCoords = coordinates as [number, number, number, number];
        const [minLng, minLat, maxLng, maxLat] = rectCoords;
        if ('setBounds' in layer && typeof layer.setBounds === 'function') {
          (layer as any).setBounds([[minLat, minLng], [maxLat, maxLng]]);
        }
      } else if (updatedFeature.geometryType.toLowerCase() === "circle") {
        let circleCoords: [number, number, number];

        if (Array.isArray(coordinates)) {
          if (coordinates.length === 3) {
            circleCoords = coordinates as [number, number, number];
          } else if (coordinates.length === 1 && Array.isArray(coordinates[0])) {
            const polygonCoords = coordinates[0] as Position[];
            if (polygonCoords.length > 0) {
              let sumLng = 0, sumLat = 0;
              for (const coord of polygonCoords) {
                sumLng += coord[0];
                sumLat += coord[1];
              }
              const centerLng = sumLng / polygonCoords.length;
              const centerLat = sumLat / polygonCoords.length;

              const firstPoint = polygonCoords[0];
              const radius = Math.sqrt(
                Math.pow(firstPoint[0] - centerLng, 2) +
                Math.pow(firstPoint[1] - centerLat, 2)
              ) * 111000;

              circleCoords = [centerLng, centerLat, radius];
            } else {
              return;
            }
          } else {
            return;
          }
        } else {
          return;
        }

        const [lng, lat, radius] = circleCoords;

        if (lng < -180 || lng > 180 || lat < -90 || lat > 90 || radius <= 0) {
          return;
        }

        const currentLatLng = (layer as any)._latlng;
        const currentRadius = (layer as any)._mRadius;

        const hasPositionChanged = !currentLatLng ||
          Math.abs(currentLatLng.lat - lat) > 0.000001 ||
          Math.abs(currentLatLng.lng - lng) > 0.000001;
        const hasRadiusChanged = currentRadius === undefined || Math.abs(currentRadius - radius) > 0.01;

        if (hasPositionChanged || hasRadiusChanged) {
          const circleLayer = layer as any;

          if (hasPositionChanged && 'setLatLng' in layer && typeof layer.setLatLng === 'function') {
            circleLayer.setLatLng([lat, lng]);
          }
          if (hasRadiusChanged && 'setRadius' in layer && typeof layer.setRadius === 'function') {
            (layer as CircleLayer).setRadius(radius);
          }
        }
      }

      if (updatedFeature.style) {
        try {
          const storedStyle = JSON.parse(updatedFeature.style);
          const currentStyle = extractLayerStyle(layer);

          if (JSON.stringify(storedStyle) !== JSON.stringify(currentStyle)) {
            applyLayerStyle(layer, storedStyle);
            storeOriginalStyle(layer);
          }
        } catch (error) {
          console.warn("Failed to parse feature style:", error);
        }
      }

      if (updatedFeature.isVisible !== existingFeature.isVisible) {
        if (updatedFeature.isVisible) {
          if (!sketchRef.current.hasLayer(layer)) {
            sketchRef.current.addLayer(layer);
          }
        } else {
          if (sketchRef.current.hasLayer(layer)) {
            sketchRef.current.removeLayer(layer);
          }
        }
        setFeatureVisibility(prev => ({
          ...prev,
          [existingFeature.id]: updatedFeature.isVisible ?? true,
          [featureId]: updatedFeature.isVisible ?? true,
        }));
      }

      setFeatures(prev =>
        prev.map(f =>
          f.featureId === featureId
            ? {
              ...f,
              isVisible: updatedFeature.isVisible ?? true,
              layerId: updatedFeature.layerId || null,
            }
            : f
        )
      );
    } catch (error) {
      console.error("Failed to update feature:", error);
      if (handleMapDataChangedRef.current) {
        handleMapDataChangedRef.current();
      }
    }
  }, [detail?.id, isMapReady, features, storeOriginalStyle, extractLayerStyle, applyLayerStyle]);

  const handleFeatureCreated = useCallback(async (featureId: string) => {
    if (!detail?.id || !isMapReady || !mapRef.current || !sketchRef.current) return;

    if (recentlyCreatedFeatureIdsRef.current.has(featureId)) {
      return;
    }

    const existingFeature = features.find(f => f.featureId === featureId);
    if (existingFeature) {
      return;
    }

    try {
      const newFeature = await getMapFeatureById(detail.id, featureId);
      if (!newFeature) {
        return;
      }

      // Re-check if it was created locally while we were waiting for the API
      if (recentlyCreatedFeatureIdsRef.current.has(featureId)) {
        return;
      }

      let coordinates: Position | Position[] | Position[][];
      try {
        const parsed = JSON.parse(newFeature.coordinates);
        if (parsed.type && parsed.coordinates) {
          coordinates = parsed.coordinates;
        } else {
          coordinates = parsed;
        }
      } catch (error) {
        return;
      }

      const L = (await import("leaflet")).default;
      let layer: ExtendedLayer | null = null;

      if (newFeature.geometryType.toLowerCase() === "point") {
        const coords = coordinates as Position;
        if (newFeature.annotationType?.toLowerCase() === "text") {
          layer = L.circleMarker([coords[1], coords[0]], {
            radius: 8,
            color: "#3388ff",
            fillColor: "#3388ff",
            fillOpacity: 0.8,
            weight: 2,
            opacity: 1
          }) as ExtendedLayer;
        } else {
          layer = L.circleMarker([coords[1], coords[0]], {
            radius: 6,
            color: '#3388ff',
            fillColor: 'white',
            fillOpacity: 1,
            weight: 2,
            opacity: 1
          }) as ExtendedLayer;
        }
      } else if (newFeature.geometryType.toLowerCase() === "linestring") {
        const coords = coordinates as Position[];
        layer = L.polyline(coords.map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (newFeature.geometryType.toLowerCase() === "polygon") {
        const coords = coordinates as Position[][];
        layer = L.polygon(coords[0].map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (newFeature.geometryType.toLowerCase() === "rectangle") {
        const rectCoords = coordinates as [number, number, number, number];
        const [minLng, minLat, maxLng, maxLat] = rectCoords;
        layer = L.rectangle([[minLat, minLng], [maxLat, maxLng]]) as ExtendedLayer;
      } else if (newFeature.geometryType.toLowerCase() === "circle") {
        let circleCoords: [number, number, number];
        if (Array.isArray(coordinates)) {
          if (coordinates.length === 3) {
            circleCoords = coordinates as [number, number, number];
          } else if (coordinates.length === 1 && Array.isArray(coordinates[0])) {
            const polygonCoords = coordinates[0] as Position[];
            if (polygonCoords.length > 0) {
              let sumLng = 0, sumLat = 0;
              for (const coord of polygonCoords) {
                sumLng += coord[0];
                sumLat += coord[1];
              }
              const centerLng = sumLng / polygonCoords.length;
              const centerLat = sumLat / polygonCoords.length;

              const firstPoint = polygonCoords[0];
              const radius = Math.sqrt(
                Math.pow(firstPoint[0] - centerLng, 2) +
                Math.pow(firstPoint[1] - centerLat, 2)
              ) * 111000;

              circleCoords = [centerLng, centerLat, radius];
            } else {
              console.error("Empty polygon coordinates for circle");
              return;
            }
          } else {
            console.error("Invalid circle coordinates length:", coordinates.length);
            return;
          }
        } else {
          console.error("Circle coordinates is not an array:", coordinates);
          return;
        }

        const [lng, lat, radius] = circleCoords;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90 || radius <= 0) {
          console.error("Circle coordinates out of valid range:", circleCoords);
          return;
        }

        layer = L.circle([lat, lng], { radius: radius }) as ExtendedLayer;
      }

      if (!layer) {
        console.error("Failed to create layer for feature:", featureId);
        return;
      }

      // Apply style if available
      if (newFeature.style) {
        try {
          const storedStyle = JSON.parse(newFeature.style);
          applyLayerStyle(layer, storedStyle);
        } catch (error) {
          console.warn("Failed to parse feature style:", error);
        }
      }

      storeOriginalStyle(layer);

      if (newFeature.isVisible) {
        sketchRef.current.addLayer(layer);
      }

      const hoverOverHandler = rafThrottle(() => handleLayerHover(layer, true));
      const hoverOutHandler = rafThrottle(() => handleLayerHover(layer, false));
      layer.on('mouseover', hoverOverHandler);
      layer.on('mouseout', hoverOutHandler);
      layer.on('click', (event: LeafletMouseEvent) => {
        if (event.originalEvent) {
          event.originalEvent.stopPropagation();
        }
        handleLayerClick(layer, event.originalEvent.shiftKey);
      });

      if (featureId) {
        layer.on('pm:edit', async () => {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(featureId) || 0;
          if (now - lastUpdate < 1000) return;
          lastUpdateRef.current.set(featureId, now);
          try {
            resetToOriginalStyle(layer);
            const featureData = features.find(f => f.featureId === featureId) || {
              id: `feature-${featureId}`,
              name: newFeature.name || "Feature",
              type: newFeature.geometryType,
              layer,
              isVisible: newFeature.isVisible ?? true,
              featureId,
            };
            await updateFeatureInDB(detail.id, featureId, featureData);
          } catch (error) {
            console.error("Error updating feature after edit:", error);
          }
        });

        layer.on('pm:dragend', async () => {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(featureId) || 0;
          if (now - lastUpdate < 1000) return;
          lastUpdateRef.current.set(featureId, now);
          try {
            resetToOriginalStyle(layer);
            const featureData = features.find(f => f.featureId === featureId) || {
              id: `feature-${featureId}`,
              name: newFeature.name || "Feature",
              type: newFeature.geometryType,
              layer,
              isVisible: newFeature.isVisible ?? true,
              featureId,
            };
            await updateFeatureInDB(detail.id, featureId, featureData);
          } catch (error) {
            console.error("Error updating feature after drag:", error);
          }
        });

        layer.on('pm:rotateend', async () => {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(featureId) || 0;
          if (now - lastUpdate < 1000) return;
          lastUpdateRef.current.set(featureId, now);
          try {
            const featureData = features.find(f => f.featureId === featureId) || {
              id: `feature-${featureId}`,
              name: newFeature.name || "Feature",
              type: newFeature.geometryType,
              layer,
              isVisible: newFeature.isVisible ?? true,
              featureId,
            };
            await updateFeatureInDB(detail.id, featureId, featureData);
          } catch (error) {
            console.error("Error updating feature after rotation:", error);
          }
        });
      }

      // Enable editing
      if ('pm' in layer && (layer as GeomanLayer).pm) {
        (layer as GeomanLayer).pm.enable({
          draggable: true,
          allowEditing: true,
          allowSelfIntersection: true,
        });
      }

      setFeatures(prev => {
        const alreadyExists = prev.some(f => f.featureId === featureId);
        if (alreadyExists) {
          // CRITICAL FIX: Remove the layer we just added because we are aborting
          // This prevents "orphan" layers from persisting on the map
          if (sketchRef.current && layer) {
            sketchRef.current.removeLayer(layer);
          }
          return prev;
        }

        const featureType = getFeatureTypeUtil(layer);
        const newFeatureData: FeatureData = {
          id: `feature-${featureId}`,
          name: newFeature.name || featureType,
          type: featureType,
          layer,
          isVisible: newFeature.isVisible ?? true,
          featureId,
        };

        setFeatureVisibility(prevVisibility => ({
          ...prevVisibility,
          [newFeatureData.id]: newFeature.isVisible ?? true,
          [featureId]: newFeature.isVisible ?? true,
        }));

        return [...prev, newFeatureData];
      });
    } catch (error) {
      console.error("Failed to add feature:", error);
    }
  }, [detail?.id, isMapReady, features, storeOriginalStyle, handleLayerHover, handleLayerClick, resetToOriginalStyle, applyLayerStyle]);

  const handleFeatureDeleted = useCallback((featureId: string) => {
    if (!sketchRef.current) return;

    const featureToRemove = features.find(f => f.featureId === featureId);
    if (featureToRemove && featureToRemove.layer) {
      sketchRef.current.removeLayer(featureToRemove.layer);
      setFeatures(prev => prev.filter(f => f.featureId !== featureId));
      setFeatureVisibility(prev => {
        const newVisibility = { ...prev };
        delete newVisibility[featureToRemove.id];
        if (featureId) delete newVisibility[featureId];
        return newVisibility;
      });
    }
  }, [features]);

  const collaboration = useMapCollaboration({
    mapId: mapId || null,
    enabled: isMapReady && !!mapId,
    onSelectionUpdated: (selection) => {
      visualizeRef.current(selection);
    },
    onSelectionCleared: (userId) => {
      removeVisualizationRef.current(userId);
    },
    onUserJoined: (user) => {
    },
    onUserLeft: (user) => {
      removeVisualizationRef.current(user.userId);
    },
    onError: (error) => {
      console.error("Map collaboration error:", error);
    },
    onMapDataChanged: () => {
      // Use debounced handler for better performance
      debouncedMapDataChanged();
    },
    onFeatureUpdated: (featureId) => {
      handleFeatureUpdated(featureId);
    },
    onFeatureDeleted: (featureId) => {
      handleFeatureDeleted(featureId);
    },
    onFeatureCreated: (featureId) => {
      handleFeatureCreated(featureId);
    },
    shouldIgnoreFeatureCreated: (featureId) => {
      return recentlyCreatedFeatureIdsRef.current.has(featureId);
    },
  });

  useEffect(() => {
    collaborationRef.current = collaboration;
  }, [collaboration]);

  const handleLayerDelete = useCallback((layer: Layer) => {
    if (currentLayer === layer) {
      setCurrentLayer(null);
      setSelectedLayer(null);
      setShowStylePanel(false);
    }

    const newSelected = new Set(selectedLayers);
    newSelected.delete(layer);
    setSelectedLayers(newSelected);

    originalStylesRef.current.delete(layer);
  }, [currentLayer, selectedLayers]);

  const resetAllSelections = useCallback(() => {
    selectedLayers.forEach(layer => resetToOriginalStyle(layer));
    setSelectedLayers(new Set());
    setCurrentLayer(null);
    setSelectedLayer(null);
    setShowStylePanel(false);

    if (collaborationRef.current?.clearSelection && mapId) {
      collaborationRef.current.clearSelection(mapId);
    }
  }, [selectedLayers, resetToOriginalStyle, mapId]);

  const handleZoomIn = useCallback(() => {
    mapHelpers.zoomIn(mapRef);
  }, []);

  useEffect(() => {
    const handleFeatureLayerEvent = (event: Event) => {
      const custom = event as CustomEvent<{ featureId?: string }>;
      const featureId = custom.detail?.featureId;
      if (featureId) {
        handleFeatureUpdated(featureId);
      } else if (handleMapDataChangedRef.current) {
        handleMapDataChangedRef.current();
      }
    };

    window.addEventListener("featureLayerUpdated", handleFeatureLayerEvent as EventListener);
    return () => {
      window.removeEventListener("featureLayerUpdated", handleFeatureLayerEvent as EventListener);
    };
  }, [handleFeatureUpdated]);

  const handleZoomOut = useCallback(() => {
    mapHelpers.zoomOut(mapRef);
  }, []);

  const applyBaseLayer = useCallback((key: BaseKey) => {
    if (!mapRef.current) return;
    if (baseRef.current) {
      try {
        mapRef.current.removeLayer(baseRef.current);
        baseRef.current = null;
      } catch (error) {
        console.warn("Failed to remove existing baseLayer:", error);
        baseRef.current = null;
      }
    }
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled) return;
        let layer: TileLayer;

        // Base layer tile URLs configuration
        const baseLayers: Record<BaseKey, { url: string; attribution: string; maxZoom?: number; subdomains?: string[] }> = {
          "osm": {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
            subdomains: ["a", "b", "c"]
          },
          "sat": {
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attribution: "Tiles © Esri",
            maxZoom: 20
          },
          "dark": {
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            attribution: "© OpenStreetMap contributors © CARTO",
            maxZoom: 20,
            subdomains: ["a", "b", "c"]
          },
          "positron": {
            url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            attribution: "© OpenStreetMap contributors © CARTO",
            maxZoom: 20,
            subdomains: ["a", "b", "c"]
          },
          "dark-matter": {
            url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
            attribution: "© OpenStreetMap contributors © CARTO",
            maxZoom: 20,
            subdomains: ["a", "b", "c"]
          },
          "terrain": {
            // Using Esri World Topographic Map for terrain view
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
            attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
            maxZoom: 20
          },
          "toner": {
            // Using CartoDB Positron No Labels (black and white style) as alternative to Stamen Toner
            url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
            attribution: "© OpenStreetMap contributors © CARTO",
            maxZoom: 20,
            subdomains: ["a", "b", "c"]
          },
          "watercolor": {
            // Using Wikimedia style as alternative to Stamen Watercolor
            url: "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png",
            attribution: "© OpenStreetMap contributors, Tiles style by Wikimedia, under CC BY-SA",
            maxZoom: 19,
            subdomains: []
          },
          "topo": {
            // Using multiple options for OpenTopoMap with proper subdomain handling
            // Primary: OpenTopoMap (may have rate limits, but provides best topo view)
            url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
            attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)",
            maxZoom: 17,
            subdomains: []
          }
        };

        const layerConfig = baseLayers[key] || baseLayers["osm"];
        const tileLayerOptions: any = {
          maxZoom: layerConfig.maxZoom || 20,
          attribution: layerConfig.attribution,
        };

        // Only add subdomains if specified (not for Esri or other servers without subdomains)
        if (layerConfig.subdomains !== undefined) {
          tileLayerOptions.subdomains = layerConfig.subdomains;
        } else if (!key.includes("sat") && !key.includes("terrain")) {
          // Default subdomains for most tile servers
          tileLayerOptions.subdomains = ["a", "b", "c"];
        }

        layer = L.tileLayer(layerConfig.url, tileLayerOptions);

        if (!cancelled && mapRef.current) {
          layer.addTo(mapRef.current as any);
          baseRef.current = layer;
        }
      } catch (error) {
        console.error("Failed to apply baseLayer:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        setDetail(m);
        setName(m.name ?? "");
        setBaseKey(backendToBaseKey(m.baseLayer));
        setMapStatus(m.status ?? "draft");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : t('mapEditor.loadMapFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mapId]);

  // Auto switch to export tab if map is story map and currently on embed tab
  useEffect(() => {
    if (!loading && detail?.isStoryMap === true && exportModalTab === "embed") {
      setExportModalTab("export");
    }
  }, [loading, detail?.isStoryMap, exportModalTab]);

  // Auto switch to export tab when opening modal if map is story map
  useEffect(() => {
    if (showExportModal && !loading && detail?.isStoryMap === true) {
      setExportModalTab("export");
    }
  }, [showExportModal, loading, detail?.isStoryMap]);

  // Listen for layer created event to refresh map detail
  useEffect(() => {
    if (!mapId) return;

    const handleLayerCreated = async () => {
      try {
        const updatedDetail = await getMapDetail(mapId);
        setDetail(updatedDetail);
      } catch (error) {
        console.error("Failed to refresh map detail after layer creation:", error);
      }
    };

    const handleLayerDeleted = async (e?: Event) => {
      try {
        const deletedLayerId = (e as CustomEvent<{ layerId: string }>)?.detail?.layerId;
        const updatedDetail = await getMapDetail(mapId);
        setDetail(updatedDetail);

        // Force update layers state immediately
        if (updatedDetail.layers) {
          setLayers(updatedDetail.layers);
        } else {
          setLayers([]);
        }

        // Update features to remove layerId if they belonged to the deleted layer
        if (deletedLayerId) {
          setFeatures(prev => {
            const updatedFeatures = prev.map(feature => {
              if (feature.layerId === deletedLayerId) {
                // Update local state immediately
                const updated = { ...feature, layerId: null };

                // Update backend asynchronously
                if (feature.featureId && mapId) {
                  updateMapFeature(mapId, feature.featureId, { layerId: null })
                    .catch(error => {
                      console.error(`Failed to update feature ${feature.featureId} after layer deletion:`, error);
                    });
                }

                return updated;
              }
              return feature;
            });
            return updatedFeatures;
          });
        }
      } catch (error) {
        console.error("Failed to refresh map detail after layer deletion:", error);
      }
    };

    window.addEventListener("layerCreated", handleLayerCreated);
    window.addEventListener("layerDeleted", handleLayerDeleted);
    return () => {
      window.removeEventListener("layerCreated", handleLayerCreated);
      window.removeEventListener("layerDeleted", handleLayerDeleted);
    };
  }, [mapId]);

  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;
    let contextMenuHandler: ((e: LeafletMouseEvent) => void) | null = null;
    let zoomEndHandler: (() => void) | null = null;
    let zoomHandler: (() => void) | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");

      // Get custom icons
      const customDefaultIcon = await getCustomDefaultIcon();
      const customMarkerIcon = await getCustomMarkerIcon();

      if (customDefaultIcon) {
        // Override icon mặc định bằng cách tạo constructor mới
        (L.Icon.Default as any) = L.Icon.extend({
          options: {
            iconSize: [12, 12],
            iconAnchor: [6, 6],
            popupAnchor: [0, -6],
            shadowSize: [0, 0],
            shadowAnchor: [0, 0]
          },
          _getIconUrl: function () {
            return '';
          },
          createIcon: function () {
            return customDefaultIcon.createIcon();
          },
          createShadow: function () {
            return null;
          }
        });
      }

      if (!alive || !el) return;

      const VN_CENTER: LatLngTuple = [14.058324, 108.277199];
      const VN_ZOOM = 6;

      const createdFlag = sp?.get("created") === "1";
      // Backend returns center as [lat, lng] in viewState
      const viewState = detail.viewState;
      const center = viewState?.center;

      // Extract lat/lng from center array: [lat, lng]
      const rawLat = center && Array.isArray(center) && center.length >= 2
        ? Number(center[0])
        : null;
      const rawLng = center && Array.isArray(center) && center.length >= 2
        ? Number(center[1])
        : null;
      const rawZoom = viewState?.zoom ? Number(viewState.zoom) : null;

      // Check if we have valid coordinates (not null, not zero/zero)
      const hasValidCoordinates = rawLat !== null && rawLng !== null &&
        !(Math.abs(rawLat) < 1e-6 && Math.abs(rawLng) < 1e-6);
      const hasValidZoom = rawZoom !== null && rawZoom >= 3 && rawZoom <= 20;

      // Use VN center only if map was just created, or if viewState is missing/invalid
      const useVN = createdFlag || !hasValidCoordinates;
      const initialCenter: LatLngTuple = useVN
        ? VN_CENTER
        : [rawLat!, rawLng!]; // Safe to use ! here because hasValidCoordinates ensures they're not null
      const initialZoom = useVN || !hasValidZoom
        ? VN_ZOOM
        : Math.min(Math.max(rawZoom!, 3), 20);

      const map = L.map(el, { zoomControl: false, minZoom: 2, maxZoom: 20 }).setView(initialCenter, initialZoom) as MapWithPM;
      mapRef.current = map;
      setPlaybackMap(map);
      if (!alive) return;
      setIsMapReady(true);
      setCurrentZoom(initialZoom);

      applyBaseLayer(backendToBaseKey(detail.baseLayer));

      const sketch = L.featureGroup().addTo(map as any);
      sketchRef.current = sketch;

      try {
        // Features will be loaded in a separate useEffect
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }

      // Check if PM is available on map before using it
      if (map.pm) {
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
          // cutPolygon: false,
          rotateMode: false,
          removalMode: false,
        });

        // Set global options (thêm tooltips: false nếu chưa)
        map.pm.setGlobalOptions({
          limitMarkersToCount: 20,
          allowSelfIntersection: true,
          finishOn: "contextmenu",  // Sử dụng click chuột phải để hoàn thành polygon
          snappable: true,
          snapDistance: 20,
          hideMiddleMarkers: true,
          cursorMarker: false,  // Tắt cursor marker hoàn toàn
          tooltips: false       // Tắt tooltip nếu chưa có
        });
      }

      // Define context menu handler for Geoman drawing/editing modes
      contextMenuHandler = (e: LeafletMouseEvent) => {
        const mapInstance = mapRef.current;
        if (!mapInstance || !mapInstance.pm) return;

        const pm = mapInstance.pm as any;

        const isDrawing = pm.globalDrawModeEnabled && pm.globalDrawModeEnabled();
        const isEditing = pm.globalEditModeEnabled && pm.globalEditModeEnabled();
        const isRemoving = pm.globalRemovalModeEnabled && pm.globalRemovalModeEnabled();

        if (isRemoving) {
          if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          }

          if (pm.disableGlobalRemovalMode) pm.disableGlobalRemovalMode();

          const container = mapInstance.getContainer();
          container.style.cursor = "";
        }
      };

      if (contextMenuHandler) {
        map.on("contextmenu", contextMenuHandler);
      }

      // Listen to zoom events to update currentZoom state
      zoomEndHandler = () => {
        if (map.getZoom) {
          setCurrentZoom(map.getZoom());
        }
      };
      zoomHandler = () => {
        if (map.getZoom) {
          setCurrentZoom(map.getZoom());
        }
      };
      map.on("zoomend", zoomEndHandler);
      map.on("zoom", zoomHandler);

      // Note: Event listeners for pm:create, pm:edit, pm:dragend, pm:rotateend
      // will be registered in a separate useEffect after handlers are ready

    })();
    return () => {
      alive = false;
      if (mapRef.current) {
        if (contextMenuHandler) {
          mapRef.current.off("contextmenu", contextMenuHandler);
        }
        if (zoomEndHandler) {
          mapRef.current.off("zoomend", zoomEndHandler);
        }
        if (zoomHandler) {
          mapRef.current.off("zoom", zoomHandler);
        }
        mapRef.current.remove();
      }
      contextMenuHandler = null;
      zoomEndHandler = null;
      zoomHandler = null;
      setIsMapReady(false);
      setPlaybackMap(null);
    };

  }, [detail?.id, applyBaseLayer, sp]);

  useEffect(() => {
    if (!detail?.id || !isMapReady) return;

    let alive = true;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const sketch = sketchRef.current;
        if (!sketch || !alive) return;

        const dbFeatures = await loadFeaturesToMap(detail.id, L, sketch);

        // Attach event listeners to loaded features
        dbFeatures.forEach(feature => {
          if (feature.layer) {
            // Store original style
            storeOriginalStyle(feature.layer);

            // Attach hover and click event listeners (throttled for performance)
            const hoverOverHandler = rafThrottle(() => handleLayerHover(feature.layer, true));
            const hoverOutHandler = rafThrottle(() => handleLayerHover(feature.layer, false));
            feature.layer.on('mouseover', hoverOverHandler);
            feature.layer.on('mouseout', hoverOutHandler);
            feature.layer.on('click', (event: LeafletMouseEvent) => {
              // Stop propagation to prevent base layer click from firing
              if (event.originalEvent) {
                event.originalEvent.stopPropagation();
              }
              handleLayerClick(feature.layer, event.originalEvent.shiftKey);
            });

            // Attach edit/drag/rotate/cut event listeners for database updates
            if (feature.featureId) {
              feature.layer.on('pm:edit', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);

                try {
                  // Reset to original style first to remove selection styling
                  resetToOriginalStyle(feature.layer);
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after edit:", error);
                }
              });

              feature.layer.on('pm:dragend', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);

                try {
                  // Reset to original style first to remove selection styling
                  resetToOriginalStyle(feature.layer);
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after drag:", error);
                }
              });

              feature.layer.on('pm:rotateend', async () => {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(feature.featureId!) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(feature.featureId!, now);

                try {
                  await updateFeatureInDB(detail.id, feature.featureId!, feature);
                } catch (error) {
                  console.error("Error updating feature after rotation:", error);
                }
              });

            }

            // Enable dragging and editing via Geoman
            if ('pm' in feature.layer && (feature.layer as GeomanLayer).pm) {
              (feature.layer as GeomanLayer).pm.enable({
                draggable: true,
                allowEditing: true,
                allowSelfIntersection: true,
              });
            }
          }
        });

        if (alive) {
          setFeatures(dbFeatures);
          const initialFeatureVisibility: Record<string, boolean> = {};
          dbFeatures.forEach(feature => {
            initialFeatureVisibility[feature.id] = feature.isVisible ?? true;
            if (feature.featureId) {
              initialFeatureVisibility[feature.featureId] = feature.isVisible ?? true;
            }
          });
          setFeatureVisibility(initialFeatureVisibility);
        }
      } catch (error) {
        console.error("Failed to load features from database:", error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [detail?.id, isMapReady]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !sketchRef.current) return;
    if (!handleFeatureCreate || !handleSketchEdit || !handleSketchDragEnd || !handleSketchRotateEnd) return;

    const map = mapRef.current;
    const sketch = sketchRef.current;

    const createHandler = async (e: PMCreateEvent) => {
      const L = (await import("leaflet")).default;
      const customMarkerIcon = await getCustomMarkerIcon();
      await handleFeatureCreate(e, customMarkerIcon as L.Icon | L.DivIcon | null, L, sketch);
    };
    map.on("pm:create", createHandler);

    // Handle polygon cut event at map level
    // map.on("pm:cut", handlePolygonCut);

    // Handle sketch-level edit/drag/rotate events
    sketch.on("pm:edit", handleSketchEdit);
    sketch.on("pm:dragend", handleSketchDragEnd);
    sketch.on("pm:rotateend", handleSketchRotateEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("pm:create", createHandler);
        // mapRef.current.off("pm:cut", handlePolygonCut);
      }
      if (sketchRef.current) {
        sketchRef.current.off("pm:edit", handleSketchEdit);
        sketchRef.current.off("pm:dragend", handleSketchDragEnd);
        sketchRef.current.off("pm:rotateend", handleSketchRotateEnd);
      }
    };
  }, [isMapReady, handleFeatureCreate, handleSketchEdit, handleSketchDragEnd, handleSketchRotateEnd]);
  // }, [isMapReady, handleFeatureCreate, handleSketchEdit, handleSketchDragEnd, handleSketchRotateEnd, handlePolygonCut]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    // Always update layers state, even if empty
    if (detail?.layers) {
      setLayers(detail.layers);
    } else {
      setLayers([]);
    }

    // Only process layers if there are any
    if (!detail?.layers || detail.layers.length === 0) return;

    const map = mapRef.current;

    let alive = true;

    (async () => {

      dataLayerRefs.current.forEach((layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      dataLayerRefs.current.clear();

      const initialLayerVisibility: Record<string, boolean> = {};

      for (const layer of detail.layers) {
        if (!alive) break;
        const isVisible = layer.isVisible ?? true;
        initialLayerVisibility[layer.id] = isVisible;

        try {
          const loaded = await loadLayerToMap(map as any, layer as LayerDTO, dataLayerRefs);
          if (loaded && !isVisible) {
            const leafletLayer = dataLayerRefs.current.get(layer.id);
            if (leafletLayer && map.hasLayer(leafletLayer)) {
              map.removeLayer(leafletLayer);
            }
          }
        } catch (error) {
          console.error(`Error loading layer ${layer.layerName}:`, error);
        }

      }

      if (alive) setLayerVisibility(initialLayerVisibility);
    })();

    return () => {
      alive = false;
    };
  }, [detail?.layers, detail?.id, isMapReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const layerOnMap = dataLayerRefs.current.get(layerId);
      if (!layerOnMap) return;

      const isOnMap = mapRef.current!.hasLayer(layerOnMap);

      if (isVisible && !isOnMap) {
        mapRef.current!.addLayer(layerOnMap);
      } else if (!isVisible && isOnMap) {
        mapRef.current!.removeLayer(layerOnMap);
      }
    });
  }, [layerVisibility]);

  // Optimized visibility updates with batching
  useEffect(() => {
    if (!mapRef.current || !sketchRef.current) return;

    // Use requestAnimationFrame for smooth batch updates
    const rafId = requestAnimationFrame(() => {
      Object.entries(featureVisibility).forEach(([featureId, isVisible]) => {
        const feature = features.find(f => f.id === featureId || f.featureId === featureId);
        if (!feature) return;

        const isOnMap = sketchRef.current!.hasLayer(feature.layer);

        if (isVisible && !isOnMap) {
          sketchRef.current!.addLayer(feature.layer);
        } else if (!isVisible && isOnMap) {
          sketchRef.current!.removeLayer(feature.layer);
        }
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [featureVisibility, features]);

  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

  // Helper function to load segments with their route animations
  const loadSegmentsWithRoutes = useCallback(async (mapIdParam: string) => {
    const segmentsData = await getSegments(mapIdParam);

    // Fetch route animations for each segment
    const segmentsWithRoutes = await Promise.all(
      segmentsData.map(async (segment) => {
        try {
          const routes = await getRouteAnimationsBySegment(mapIdParam, segment.segmentId);
          return {
            ...segment,
            routeAnimations: routes || []
          };
        } catch (e) {
          console.warn("Failed to load routes for segment:", segment.segmentId, e);
          return {
            ...segment,
            routeAnimations: []
          };
        }
      })
    );

    return segmentsWithRoutes;
  }, []);

  // Load segments and transitions for timeline
  const loadSegmentsAndTransitions = useCallback(async () => {
    if (!mapId) return;

    try {
      const [segmentsWithRoutes, transitionsData] = await Promise.all([
        loadSegmentsWithRoutes(mapId),
        getTimelineTransitions(mapId),
      ]);

      setSegments(segmentsWithRoutes);
      setTransitions(transitionsData);
    } catch (error) {
      console.error("Failed to load segments/transitions:", error);
    }
  }, [mapId, loadSegmentsWithRoutes]);

  // Handle refresh segments (used by TimelineWorkspace)
  const handleRefreshSegments = useCallback(async () => {
    try {
      // Reload segments with enhanced details (includes locations, routes, zones, layers)
      const [segmentsWithRoutes, transitionsData] = await Promise.all([
        loadSegmentsWithRoutes(mapId),
        getTimelineTransitions(mapId),
      ]);

      // Force new array reference to ensure React re-renders
      setSegments([...segmentsWithRoutes]);
      setTransitions([...transitionsData]);
    } catch (error) {
      console.error("Failed to refresh segments:", error);
    }
  }, [mapId, loadSegmentsWithRoutes]);

  useEffect(() => {
    if (!mapId || !isMapReady) return;

    let alive = true;

    (async () => {
      await loadSegmentsAndTransitions();
    })();

    return () => {
      alive = false;
    };
  }, [mapId, isMapReady, loadSegmentsAndTransitions]);

  // Listen for zone selection events (from useZoneMarkers)
  useEffect(() => {
    const handleSelectZone = (e: Event) => {
      const customEvent = e as CustomEvent<{
        mapZone: import("@/lib/api-maps").MapZone;
        zone: import("@/lib/api-maps").Zone;
      }>;
      setSelectedZone(customEvent.detail);
    };

    window.addEventListener("selectZone", handleSelectZone);
    return () => {
      window.removeEventListener("selectZone", handleSelectZone);
    };
  }, []);

  // Listen for location created event to refresh segments
  useEffect(() => {
    const handleLocationCreated = (e: Event) => {
      const customEvent = e as CustomEvent<{ segmentId: string }>;
      // Refresh segments to show newly created location
      loadSegmentsAndTransitions();
    };

    window.addEventListener('locationCreated', handleLocationCreated);
    return () => {
      window.removeEventListener('locationCreated', handleLocationCreated);
    };
  }, [loadSegmentsAndTransitions]);

  // Listen for route animation changed event to refresh segments
  useEffect(() => {
    const handleRouteAnimationChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ segmentId: string }>;
      // Refresh segments to show newly created route animation
      loadSegmentsAndTransitions();
    };

    window.addEventListener('routeAnimationChanged', handleRouteAnimationChanged);
    return () => {
      window.removeEventListener('routeAnimationChanged', handleRouteAnimationChanged);
    };
  }, [loadSegmentsAndTransitions]);

  // Listen for zone created/deleted events to refresh segments
  useEffect(() => {
    const handleZoneCreated = (e: Event) => {
      loadSegmentsAndTransitions();
    };
    const handleZoneDeleted = (e: Event) => {
      loadSegmentsAndTransitions();
    };

    window.addEventListener('zoneCreated', handleZoneCreated);
    window.addEventListener('zoneDeleted', handleZoneDeleted);
    return () => {
      window.removeEventListener('zoneCreated', handleZoneCreated);
      window.removeEventListener('zoneDeleted', handleZoneDeleted);
    };
  }, [loadSegmentsAndTransitions]);

  // Listen for location deleted/updated events to refresh segments
  useEffect(() => {
    const handleLocationDeleted = (e: Event) => {
      loadSegmentsAndTransitions();
    };
    const handleLocationUpdated = (e: Event) => {
      loadSegmentsAndTransitions();
    };

    window.addEventListener('locationDeleted', handleLocationDeleted);
    window.addEventListener('locationUpdated', handleLocationUpdated);
    return () => {
      window.removeEventListener('locationDeleted', handleLocationDeleted);
      window.removeEventListener('locationUpdated', handleLocationUpdated);
    };
  }, [loadSegmentsAndTransitions]);

  // Listen for layer created/deleted events to refresh segments
  useEffect(() => {
    const handleLayerCreated = (e: Event) => {
      loadSegmentsAndTransitions();
    };
    const handleLayerDeleted = (e: Event) => {
      loadSegmentsAndTransitions();
    };

    window.addEventListener('layerCreated', handleLayerCreated);
    window.addEventListener('layerDeleted', handleLayerDeleted);
    return () => {
      window.removeEventListener('layerCreated', handleLayerCreated);
      window.removeEventListener('layerDeleted', handleLayerDeleted);
    };
  }, [loadSegmentsAndTransitions]);

  // Zone selection mode handler
  useEffect(() => {
    const handleEnableZoneSelection = (e: CustomEvent) => {
      const { enabled } = e.detail;
      // Set global flag for zone selection mode
      (window as any).__zoneSelectionMode = enabled;

      // Optionally add visual feedback by changing cursor
      if (mapRef.current) {
        const mapContainer = mapRef.current.getContainer();
        if (enabled) {
          mapContainer.style.cursor = 'crosshair';
        } else {
          mapContainer.style.cursor = '';
        }
      }
    };

    window.addEventListener('storymap:enableZoneSelection', handleEnableZoneSelection as EventListener);

    return () => {
      window.removeEventListener('storymap:enableZoneSelection', handleEnableZoneSelection as EventListener);
    };
  }, []);

  // Context menu handler
  useEffect(() => {
    const handleZoneContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent;
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

    window.addEventListener('zone-contextmenu', handleZoneContextMenu as EventListener);

    return () => {
      window.removeEventListener('zone-contextmenu', handleZoneContextMenu as EventListener);
    };
  }, []);

  // POI picking mode handler
  useEffect(() => {
    let isPickingPoi = false;
    let clickHandler: ((e: LeafletMouseEvent) => void) | null = null;

    const handleStartPickLocation = () => {
      const map = mapRef.current;
      if (!map) {
        console.warn('⚠️ Map not ready yet');
        return;
      }

      isPickingPoi = true;

      // Thay đổi cursor thành crosshair (dấu cộng)
      const mapContainer = map.getContainer();
      mapContainer.style.cursor = 'crosshair';
      // Đảm bảo cursor được apply ngay
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');

      // Xử lý click trên map
      clickHandler = (e: LeafletMouseEvent) => {
        if (!isPickingPoi) return;

        const { lat, lng } = e.latlng;

        // Dispatch event với tọa độ đã chọn
        window.dispatchEvent(
          new CustomEvent("poi:locationPicked", {
            detail: {
              lngLat: [lng, lat],
            },
          })
        );

        mapContainer.style.cursor = '';
        isPickingPoi = false;

        if (clickHandler) {
          map.off('click', clickHandler);
          clickHandler = null;
        }
      };

      map.on('click', clickHandler);
    };

    const handleStopPickLocation = () => {
      const map = mapRef.current;
      if (!map) return;

      isPickingPoi = false;

      const mapContainer = map.getContainer();
      mapContainer.style.cursor = '';

      if (clickHandler) {
        map.off('click', clickHandler);
        clickHandler = null;
      }
    };

    window.addEventListener('poi:startPickLocation', handleStartPickLocation);
    window.addEventListener('poi:stopPickLocation', handleStopPickLocation);

    return () => {
      window.removeEventListener('poi:startPickLocation', handleStartPickLocation);
      window.removeEventListener('poi:stopPickLocation', handleStopPickLocation);
      if (clickHandler && mapRef.current) {
        mapRef.current.off('click', clickHandler);
      }
      if (mapRef.current) {
        mapRef.current.getContainer().style.cursor = '';
      }
    };
  }, []);

  const updateIconVisibility = useCallback((map: MapWithPM) => {
    if (!iconLayerGroupRef.current || !map) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const visibleMarkers = new Set<string>();

    const MIN_ZOOM_FOR_ICONS = 3;
    const shouldShowIcons = zoom >= MIN_ZOOM_FOR_ICONS;

    const MAX_VISIBLE_ICONS = 500;

    if (!shouldShowIcons) {
      const now = Date.now();
      iconMarkersRef.current.forEach((marker, id) => {
        const metadata = iconMetadataRef.current.get(id);
        const isRecentlyAdded = metadata && (now - metadata.timestamp) < 5000; // 5 seconds

        if (!isRecentlyAdded && iconLayerGroupRef.current?.hasLayer(marker)) {
          iconLayerGroupRef.current.removeLayer(marker);
        }
      });
      return;
    }

    const now = Date.now();
    let visibleCount = 0;
    const recentlyAddedIds = new Set<string>();

    iconMetadataRef.current.forEach((metadata, id) => {
      const isRecentlyAdded = (now - metadata.timestamp) < 5000; // 5 seconds grace period
      if (isRecentlyAdded) {
        recentlyAddedIds.add(id);
      }
    });

    iconMetadataRef.current.forEach((metadata, id) => {
      const marker = iconMarkersRef.current.get(id);
      if (!marker) return;

      const isInViewport = bounds.contains([metadata.lat, metadata.lng]);
      const isOnMap = iconLayerGroupRef.current?.hasLayer(marker) || false;
      const isRecentlyAdded = recentlyAddedIds.has(id);

      if (isRecentlyAdded) {
        if (!isOnMap) {
          iconLayerGroupRef.current?.addLayer(marker);
        }
        visibleMarkers.add(id);
        return;
      }

      if (isInViewport && !isOnMap && visibleCount < MAX_VISIBLE_ICONS) {
        iconLayerGroupRef.current?.addLayer(marker);
        visibleMarkers.add(id);
        visibleCount++;
      } else if (isInViewport && isOnMap) {
        visibleMarkers.add(id);
        visibleCount++;
      } else if (!isInViewport && isOnMap) {
        iconLayerGroupRef.current?.removeLayer(marker);
      }
    });
  }, []);

  const debouncedIconVisibilityUpdate = useMemo(
    () => debounce(() => {
      if (mapRef.current) {
        updateIconVisibility(mapRef.current);
      }
    }, 150),
    [updateIconVisibility]
  );

  const mapIdRef = useRef<string>(mapId);
  const segmentsRef = useRef<Segment[]>(segments);
  const activeSegmentIdRef = useRef<string | null>(activeSegmentId);

  useEffect(() => {
    mapIdRef.current = mapId;
  }, [mapId]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    activeSegmentIdRef.current = activeSegmentId;
  }, [activeSegmentId]);

  useEffect(() => {
    let isPlacingIcon = false;
    let currentIconKey: string | null = null;
    let clickHandler: ((e: LeafletMouseEvent) => void) | null = null;
    let contextMenuHandler: ((e: LeafletMouseEvent) => void) | null = null;

    const stopPlacement = () => {
      const map = mapRef.current;
      if (!map) return;

      isPlacingIcon = false;
      currentIconKey = null;

      const mapContainer = map.getContainer();
      mapContainer.style.cursor = "";

      if (clickHandler) {
        map.off("click", clickHandler);
        clickHandler = null;
      }
      if (contextMenuHandler) {
        map.off("contextmenu", contextMenuHandler);
        contextMenuHandler = null;
      }
    };

    const handleStartPlacement = (ev: Event) => {
      const custom = ev as CustomEvent<{ iconKey: string }>;
      const iconKey = custom.detail?.iconKey;
      const map = mapRef.current;

      if (!map || !iconKey) return;

      stopPlacement();

      isPlacingIcon = true;
      currentIconKey = iconKey;

      const mapContainer = map.getContainer();
      mapContainer.style.cursor = "crosshair";
      mapContainer.style.setProperty("cursor", "crosshair", "important");

      clickHandler = async (e: LeafletMouseEvent) => {
        if (!isPlacingIcon || !currentIconKey) return;

        const L = (await import("leaflet")).default;
        const emoji = iconEmojiMap[currentIconKey] ?? "📍";

        const iconCacheKey = `icon-${currentIconKey}`;
        let icon: L.DivIcon;

        if (!(map as any)._iconCache) {
          (map as any)._iconCache = new Map<string, L.DivIcon>();
        }

        if ((map as any)._iconCache.has(iconCacheKey)) {
          icon = (map as any)._iconCache.get(iconCacheKey);
        } else {
          icon = L.divIcon({
            className: `custom-marker-icon icon-marker icon-${currentIconKey}`,
            html: `<div style="font-size:24px; line-height:24px;">${emoji}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          (map as any)._iconCache.set(iconCacheKey, icon);
        }

        if (!iconLayerGroupRef.current) {
          iconLayerGroupRef.current = L.layerGroup().addTo(map);
        }

        const marker = L.marker(e.latlng, {
          icon,
          draggable: true,
          pane: 'markerPane',
          zIndexOffset: 0,
          keyboard: false,
          riseOnHover: false,
          autoPan: false,
        });

        let dragTimeout: NodeJS.Timeout | null = null;
        marker.on('drag', () => {
          if (dragTimeout) return;
          dragTimeout = setTimeout(() => {
            dragTimeout = null;
          }, 16);
        });

        marker.on('dragend', () => {
          const markerId = Array.from(iconMarkersRef.current.entries()).find(
            ([_, m]) => m === marker
          )?.[0];
          if (markerId) {
            const latlng = marker.getLatLng();
            iconMetadataRef.current.set(markerId, {
              lat: latlng.lat,
              lng: latlng.lng,
              iconKey: iconMetadataRef.current.get(markerId)?.iconKey || currentIconKey || '',
              timestamp: Date.now(),
            });
          }
        });


        const markerId = `icon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        iconMarkersRef.current.set(markerId, marker);
        iconMetadataRef.current.set(markerId, {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          iconKey: currentIconKey,
          timestamp: Date.now(),
        });


        if (!iconLayerGroupRef.current) {
          iconLayerGroupRef.current = L.layerGroup().addTo(map);
        }

        try {
          if (!iconLayerGroupRef.current) {
            iconLayerGroupRef.current = L.layerGroup().addTo(map);
          }
          iconLayerGroupRef.current.addLayer(marker);
        } catch (err) {
          console.error("[Icon] Failed to add icon marker to layer group:", err);
          marker.addTo(map);
        }

        (async () => {
          try {
            const iconLabel = iconLabelMap[currentIconKey] || currentIconKey;

            const currentMapId = mapIdRef.current;

            const markerGeometry = JSON.stringify({
              type: "Point",
              coordinates: [e.latlng.lng, e.latlng.lat],
            });

            const locationData = {
              title: iconLabel,
              locationType: "Custom" as LocationType,
              markerGeometry,
              iconType: emoji,
              displayOrder: 0,
              isVisible: true,
              showTooltip: false,
              openPopupOnClick: false,
            };


            const createdLocation = await createMapLocation(currentMapId, locationData);

            // Dispatch event to refresh segments
            if (createdLocation.segmentId) {
              window.dispatchEvent(new CustomEvent("locationCreated", {
                detail: { segmentId: createdLocation.segmentId }
              }));
            }

            // Update marker metadata with locationId from API response
            const apiMarkerId = `icon-${createdLocation.locationId}`;
            const currentMarkerId = Array.from(iconMarkersRef.current.entries()).find(
              ([_, m]) => m === marker
            )?.[0];

            if (currentMarkerId && currentMarkerId !== apiMarkerId) {
              // Move marker to new ID with locationId
              const existingMarker = iconMarkersRef.current.get(currentMarkerId);
              const existingMetadata = iconMetadataRef.current.get(currentMarkerId);

              if (existingMarker && existingMetadata) {
                iconMarkersRef.current.set(apiMarkerId, existingMarker);
                iconMetadataRef.current.set(apiMarkerId, existingMetadata);
                iconMarkersRef.current.delete(currentMarkerId);
                iconMetadataRef.current.delete(currentMarkerId);
              }
            }

            // Store locationId on marker for deletion
            (marker as any)._locationId = createdLocation.locationId;
          } catch (err) {
            console.error("[Icon] ❌ Failed to create location via API:", err);
          }
        })();

        marker.on("contextmenu", (event: any) => {
          if (event.originalEvent) {
            event.originalEvent.preventDefault();
            event.originalEvent.stopPropagation();
          }

          if (isPlacingIcon) {
            stopPlacement();
            return;
          }

          const leafletId = (marker as any)._leaflet_id;
          const popupButtonId = `delete-icon-${leafletId}`;

          const popupHtml = `
    <div style="display:flex;align-items:center;gap:6px;">
      <button
        id="${popupButtonId}"
        style="
          background:#ef4444;
          border:none;
          color:white;
          font-size:11px;
          padding:4px 8px;
          border-radius:4px;
          cursor:pointer;
          white-space:nowrap;
        "
      >
        Xóa icon
      </button>
    </div>
  `;

          marker
            .bindPopup(popupHtml, {
              closeButton: false,
              autoClose: true,
              closeOnClick: false,
              offset: L.point(0, -20),
              className: "icon-delete-popup",
            })
            .openPopup();

          setTimeout(() => {
            const btn = document.getElementById(popupButtonId);
            if (btn) {
              btn.addEventListener("click", () => {
                iconMarkersRef.current.forEach((m, id) => {
                  if (m === marker) {
                    iconMarkersRef.current.delete(id);
                    iconMetadataRef.current.delete(id);
                  }
                });

                if (iconLayerGroupRef.current?.hasLayer(marker)) {
                  iconLayerGroupRef.current.removeLayer(marker);
                }
                if (map.hasLayer(marker)) {
                  map.removeLayer(marker);
                }
                map.closePopup();
              });
            }
          }, 0);
        });

      };

      contextMenuHandler = (e: LeafletMouseEvent) => {
        if (!isPlacingIcon) return;
        if (e.originalEvent) {
          e.originalEvent.preventDefault();
        }
        stopPlacement();
      };

      map.on("click", clickHandler);
      map.on("contextmenu", contextMenuHandler);
    };

    const handleStopPlacement = () => {
      stopPlacement();
    };

    window.addEventListener(
      "icon:startPlacement",
      handleStartPlacement as EventListener
    );
    window.addEventListener("icon:stopPlacement", handleStopPlacement);

    return () => {
      window.removeEventListener(
        "icon:startPlacement",
        handleStartPlacement as EventListener
      );
      window.removeEventListener("icon:stopPlacement", handleStopPlacement);

      const map = mapRef.current;
      if (map) {
        if (clickHandler) map.off("click", clickHandler);
        if (contextMenuHandler) map.off("contextmenu", contextMenuHandler);
        map.getContainer().style.cursor = "";
      }

      if (iconLayerGroupRef.current && mapRef.current) {
        mapRef.current.removeLayer(iconLayerGroupRef.current);
        iconLayerGroupRef.current = null;
      }
      iconMarkersRef.current.clear();
      iconMetadataRef.current.clear();
    };
  }, [debouncedIconVisibilityUpdate, isMapReady, mapId, updateIconVisibility]);

  // Inject global CSS for POI markers
  useEffect(() => {
    const styleId = 'poi-marker-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .poi-marker {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: transparent !important;
        border: none !important;
      }
      .poi-marker > div {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: transparent !important;
        border: none !important;
        width: 100% !important;
        height: 100% !important;
      }
      .poi-marker img {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .poi-tooltip-modal {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
      }
      .poi-tooltip-modal::-webkit-scrollbar {
        width: 6px;
      }
      .poi-tooltip-modal::-webkit-scrollbar-track {
        background: transparent;
      }
      .poi-tooltip-modal::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
      }
      .poi-tooltip-modal::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
      .poi-tooltip-modal h1,
      .poi-tooltip-modal h2,
      .poi-tooltip-modal h3,
      .poi-tooltip-modal h4,
      .poi-tooltip-modal h5,
      .poi-tooltip-modal h6 {
        margin: 0 0 8px 0;
        color: #ffffff;
      }
      .poi-tooltip-modal p {
        margin: 0 0 8px 0;
      }
      .poi-tooltip-modal p:last-child {
        margin-bottom: 0;
      }
      .poi-tooltip-modal ul,
      .poi-tooltip-modal ol {
        margin: 8px 0;
        padding-left: 24px;
      }
      .poi-tooltip-modal * {
        color: inherit !important;
      }
      .poi-tooltip-modal {
        color: #ffffff !important;
      }
      .poi-tooltip-modal p,
      .poi-tooltip-modal span,
      .poi-tooltip-modal div,
      .poi-tooltip-modal li {
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Layer feature click handler for highlighting
  useEffect(() => {
    const handleLayerFeatureClick = (e: CustomEvent) => {
      const { leafletLayer } = e.detail;

      if (!leafletLayer || !('setStyle' in leafletLayer)) return;

      if (!originalStylesRef.current.has(leafletLayer)) {
        const currentOptions = (leafletLayer as any).options || {};
        const style: LayerStyle = {
          color: currentOptions.color || '#3388ff',
          weight: currentOptions.weight || 3,
          opacity: currentOptions.opacity || 1.0,
          fillColor: currentOptions.fillColor || currentOptions.color || '#3388ff',
          fillOpacity: currentOptions.fillOpacity || 0.2,
          dashArray: currentOptions.dashArray || ''
        };
        originalStylesRef.current.set(leafletLayer, style);
      }

      // Clear previous selections
      selectedLayers.forEach(layer => {
        if (layer !== leafletLayer) {
          const originalStyle = originalStylesRef.current.get(layer);
          if (originalStyle && 'setStyle' in layer) {
            (layer as any).setStyle(originalStyle);
          }
        }
      });

      // Apply selection style - preserve original weight for thick lines (freehand drawings)
      const storedStyle = originalStylesRef.current.get(leafletLayer);
      const originalWeight = storedStyle?.weight || 3;
      const selectionWeight = originalWeight > 10 ? originalWeight : Math.max(originalWeight + 1, 4);
      
      (leafletLayer as any).setStyle({
        color: '#ff6600',
        weight: selectionWeight,
        fillOpacity: 0.5
      });

      setSelectedLayers(new Set([leafletLayer]));
      setCurrentLayer(leafletLayer);
    };

    window.addEventListener('layer-feature-click', handleLayerFeatureClick as EventListener);

    return () => {
      window.removeEventListener('layer-feature-click', handleLayerFeatureClick as EventListener);
    };
  }, [selectedLayers]);

  // Map click handler for deselecting when clicking on empty space or base layer
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: LeafletMapClickEvent) => {
      // Only reset if clicking directly on map/base layer (not on a feature layer)
      const target = e.originalEvent.target;
      if (target && target instanceof HTMLElement && !target.closest('.leaflet-interactive')) {
        // Use ref to avoid dependency on resetAllSelections
        selectedLayers.forEach(layer => {
          const originalStyle = originalStylesRef.current.get(layer);
          if (originalStyle && 'setStyle' in layer && typeof (layer as unknown as PathLayer).setStyle === 'function') {
            (layer as unknown as PathLayer).setStyle(originalStyle);
          }
        });
        setSelectedLayers(new Set());
        setCurrentLayer(null);
        setSelectedLayer(null);
        setShowStylePanel(false);
      }
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      mapRef.current?.off('click', handleMapClick);
    };
  }, [selectedLayers]); // Only depend on selectedLayers, not the callback

  // Map right-click handler for measurement tools
  const [mapContextMenu, setMapContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapContextMenu = (e: L.LeafletMouseEvent) => {
      // Only show if clicking on empty map area (not on a feature)
      const target = e.originalEvent.target;
      if (
        target &&
        target instanceof HTMLElement &&
        !target.closest('.leaflet-interactive') &&
        !contextMenu.visible
      ) {
        e.originalEvent.preventDefault();
        setMapContextMenu({
          visible: true,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
      }
    };

    mapRef.current.on('contextmenu', handleMapContextMenu);

    return () => {
      mapRef.current?.off('contextmenu', handleMapContextMenu);
    };
  }, [mapRef, contextMenu.visible]);

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
      showToast("success", "📍 Coordinates copied to clipboard!");
    } else {
      showToast("error", "❌ Failed to copy coordinates");
    }
  }, [contextMenu.feature, showToast]);

  const openCopyFeatureDialog = useCallback((copyMode: "existing" | "new") => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) {
      return;
    }

    const sourceLayerId = contextMenu.layerId;
    const sourceLayer = detail.layers.find(l => l.id === sourceLayerId);
    const sourceLayerName = sourceLayer?.layerName || 'Unknown Layer';

    const layerData = sourceLayer?.layerData as FeatureCollection || {};
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
  }, [detail, contextMenu.feature, contextMenu.layerId, showToast]);

  const handleCopyToExistingLayer = useCallback((layerId?: string) => {
    // If layerId is provided, it means copy was done directly from context menu
    if (layerId) {
      // The actual copy is handled in ZoneContextMenu component
      return;
    }
    // Otherwise, open the dialog (for backward compatibility)
    openCopyFeatureDialog("existing");
  }, [openCopyFeatureDialog]);

  const handleCopyToNewLayer = useCallback((layerName?: string) => {
    // If layerName is provided, it means copy was done directly from context menu
    if (layerName) {
      // The actual copy is handled in ZoneContextMenu component
      return;
    }
    // Otherwise, open the dialog (for backward compatibility)
    openCopyFeatureDialog("new");
  }, [openCopyFeatureDialog]);

  const handleCopyFeatureSuccess = useCallback(async (message: string) => {
    showToast("success", `✅ ${message}`);
    if (detail) {
      const updatedDetail = await getMapDetail(detail.id);
      setDetail(updatedDetail);
    }
  }, [detail, showToast]);

  const handleDeleteZone = useCallback(async () => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${getFeatureName(contextMenu.feature)}"?`
    );
    if (!confirmed) return;

    const layerId = contextMenu.layerId;
    const targetLayer = detail.layers.find(l => l.id === layerId);
    if (!targetLayer) {
      showToast("error", "❌ Layer not found");
      return;
    }

    try {
      const layerData = targetLayer.layerData as FeatureCollection;
      const featureIndex = findFeatureIndex(layerData, contextMenu.feature);
      if (featureIndex === -1) {
        showToast("error", "❌ Feature not found in layer");
        return;
      }

      const updatedGeoJSON = removeFeatureFromGeoJSON(layerData as FeatureCollection, featureIndex);
      const success = await updateLayerData(detail.id, layerId, updatedGeoJSON);
      if (success) {
        showToast("success", "✅ Zone deleted successfully!");
        if (contextMenu.leafletLayer && mapRef.current) {
          mapRef.current.removeLayer(contextMenu.leafletLayer);
        }
        const updatedDetail = await getMapDetail(detail.id);
        setDetail(updatedDetail);
      } else {
        showToast("error", "❌ Failed to delete zone");
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
      showToast("error", "❌ Error deleting zone");
    }
  }, [detail, contextMenu, showToast]);

  const onLayerVisibilityChange = useCallback(async (layerId: string, isVisible: boolean) => {
    if (!detail?.id || !mapRef.current) return;

    const layerData = layers.find(l => l.id === layerId);

    // First, update all features in this layer to match the layer visibility
    const featuresInLayer = features.filter(f => f.layerId === layerId);
    for (const feature of featuresInLayer) {
      const featureId = feature.featureId || feature.id;
      if (feature.isVisible !== isVisible) {
        // Update feature visibility state immediately
        setFeatureVisibility(prev => ({
          ...prev,
          [featureId]: isVisible
        }));

        // Update feature in features state
        setFeatures(prev => prev.map(f => {
          if (f.id === feature.id || f.featureId === feature.featureId) {
            return { ...f, isVisible };
          }
          return f;
        }));

        // Update in database if feature has featureId
        if (feature.featureId) {
          try {
            await updateMapFeature(detail.id, feature.featureId, { isVisible });
          } catch (error) {
            console.error(`Failed to update feature ${feature.featureId} visibility:`, error);
          }
        }

        // Update on map
        if (feature.layer && mapRef.current) {
          if (isVisible) {
            if (sketchRef.current && !sketchRef.current.hasLayer(feature.layer)) {
              sketchRef.current.addLayer(feature.layer);
            }
          } else {
            if (sketchRef.current && sketchRef.current.hasLayer(feature.layer)) {
              sketchRef.current.removeLayer(feature.layer);
            }
          }
        }
      }
    }

    // Then update the layer itself
    await handleLayerVisibilityChange(
      detail.id,
      layerId,
      isVisible,
      mapRef.current as any,
      dataLayerRefs,
      setLayerVisibility,
      layerData
    );
  }, [detail?.id, layers, features, setFeatures, setFeatureVisibility, sketchRef]);

  const onFeatureVisibilityChange = useCallback(async (featureId: string, isVisible: boolean) => {
    if (!detail?.id) return;

    await handleFeatureVisibilityChange(
      detail.id,
      featureId,
      isVisible,
      features,
      setFeatures,
      mapRef.current as any,
      sketchRef.current,
      setFeatureVisibility
    );
  }, [detail?.id, features]);

  const onSelectLayer = useCallback((layer: FeatureData | LayerDTO) => {
    setSelectedLayer(layer);
    setShowStylePanel(true);
    // Also update new UI
    setSelectedEntity({ type: "layer", data: layer });
    setIsPropertiesPanelOpen(true);
  }, []);

  // New handlers for video editor UI
  const handleSelectFeature = useCallback((feature: FeatureData) => {
    setSelectedEntity({ type: "feature", data: feature });
    setIsPropertiesPanelOpen(true);
    setSelectedLayer(feature);
    setShowStylePanel(true);
  }, []);

  const handleSelectLayerNew = useCallback((layer: LayerDTO) => {
    setSelectedEntity({ type: "layer", data: layer });
    setIsPropertiesPanelOpen(true);
    setSelectedLayer(layer);
    setShowStylePanel(true);
  }, []);

  const handleSegmentClick = useCallback((segmentId: string) => {
    const segment = segments.find((s) => s.segmentId === segmentId);
    if (segment) {
      setSelectedEntity({ type: "segment", data: segment });
      setIsPropertiesPanelOpen(true);
      setActiveSegmentId(segmentId);
    }
  }, [segments]);

  // Update feature properties and style
  const handleUpdateFeature = useCallback(async (updates: {
    name?: string;
    description?: string;
    style?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    isVisible?: boolean;
    zIndex?: number;
  }) => {
    if (!mapId || !selectedEntity || selectedEntity.type !== "feature") return;

    const feature = selectedEntity.data as FeatureData;
    if (!feature.featureId) {
      showToast("error", "Cannot update feature: No feature ID");
      return;
    }

    try {

      // Prepare update request
      const updateRequest: any = {};

      if (updates.name !== undefined) updateRequest.name = updates.name;
      if (updates.description !== undefined) updateRequest.description = updates.description;
      if (updates.isVisible !== undefined) updateRequest.isVisible = updates.isVisible;
      if (updates.zIndex !== undefined) updateRequest.zIndex = updates.zIndex;

      // Serialize style and properties to JSON strings
      if (updates.style !== undefined) {
        updateRequest.style = JSON.stringify(updates.style);
      }
      if (updates.properties !== undefined) {
        updateRequest.properties = JSON.stringify(updates.properties);
      }

      // Update in database
      await updateMapFeature(mapId, feature.featureId, updateRequest);

      // Update local state
      setFeatures((prev) =>
        prev.map((f) =>
          f.featureId === feature.featureId
            ? { ...f, name: updates.name || f.name, isVisible: updates.isVisible ?? f.isVisible }
            : f
        )
      );

      // Update selected entity
      setSelectedEntity({
        type: "feature",
        data: { ...feature, name: updates.name || feature.name, isVisible: updates.isVisible ?? feature.isVisible },
      });

      showToast("success", "Feature updated successfully");
    } catch (error) {
      showToast("error", "Failed to update feature");
    }
  }, [mapId, selectedEntity, showToast]);

  // Save segment (create or update) - used by inline form
  const handleSaveSegment = useCallback(async (data: any, segmentId?: string) => {
    if (!mapId) return;

    try {

      if (segmentId) {
        // Update existing segment
        await updateSegment(mapId, segmentId, data);
        showToast("success", "Segment updated successfully");
      } else {
        // Create new segment
        await createSegment(mapId, data);
        showToast("success", "Segment created successfully");
      }

      // Reload segments with route animations
      const updatedSegments = await loadSegmentsWithRoutes(mapId);
      setSegments(updatedSegments);
    } catch (error) {
      showToast("error", "Failed to save segment");
    }
  }, [mapId, showToast, loadSegmentsWithRoutes]);

  // Delete segment
  const handleDeleteSegment = useCallback(async (segmentId: string) => {
    if (!mapId) return;

    try {
      await deleteSegment(mapId, segmentId);
      showToast("success", "Segment deleted successfully");

      // Reload segments with route animations
      const updatedSegments = await loadSegmentsWithRoutes(mapId);
      setSegments(updatedSegments);
    } catch (error) {
      showToast("error", "Failed to delete segment");
    }
  }, [mapId, showToast, loadSegmentsWithRoutes]);

  // Save transition (create only - edit not supported by API yet)
  const handleSaveTransition = useCallback(async (data: any, transitionId?: string) => {
    if (!mapId) return;

    try {

      if (transitionId) {
        // Update not supported by API - would need to delete and recreate
        showToast("warning", "Transition editing not yet supported. Please delete and recreate.");
        return;
      } else {
        // Create new transition
        await createTimelineTransition(mapId, data);
        showToast("success", "Transition created successfully");
      }

      // Reload transitions
      const updatedTransitions = await getTimelineTransitions(mapId);
      setTransitions(updatedTransitions);
    } catch (error) {
      showToast("error", "Failed to save transition");
    }
  }, [mapId, showToast]);

  // Delete transition
  const handleDeleteTransition = useCallback(async (transitionId: string) => {
    if (!mapId) return;

    try {
      await deleteTimelineTransition(mapId, transitionId);
      showToast("success", "Transition deleted successfully");

      // Reload transitions
      const updatedTransitions = await getTimelineTransitions(mapId);
      setTransitions(updatedTransitions);
    } catch (error) {
      showToast("error", "Failed to delete transition");
    }
  }, [mapId, showToast]);

  const handleTimelineReorder = useCallback(
    async (newOrder: Segment[]) => {
      if (!mapId) return;

      // Check affected transitions
      const affectedTransitions = transitions.filter((t) => {
        const fromIndex = newOrder.findIndex((s) => s.segmentId === t.fromSegmentId);
        const toIndex = newOrder.findIndex((s) => s.segmentId === t.toSegmentId);
        return toIndex !== fromIndex + 1;
      });

      if (affectedTransitions.length > 0) {
        const confirmed = window.confirm(
          `Reordering will affect ${affectedTransitions.length} transition(s). Continue?`
        );
        if (!confirmed) return;
      }

      try {
        await reorderSegments(mapId, newOrder.map((s) => s.segmentId));
        setSegments(newOrder);
        showToast("success", "Segments reordered successfully");
      } catch (error) {
        showToast("error", "Failed to reorder segments");
      }
    },
    [mapId, transitions, showToast]
  );

  const handlePlayTimeline = useCallback(() => {
    if (playback.isPlaying) {
      playback.handleStopPreview();
      setIsPlayingTimeline(false);
    } else {
      playback.handlePlayPreview();
      setIsPlayingTimeline(true);
    }
  }, [playback]);

  const handleStopTimeline = useCallback(() => {
    playback.handleStopPreview();
    setIsPlayingTimeline(false);
    setCurrentPlaybackTime(0);
  }, [playback]);

  // Sync isPlayingTimeline with hook's isPlaying state
  useEffect(() => {
    setIsPlayingTimeline(playback.isPlaying);
  }, [playback.isPlaying]);

  // Listen for custom route animation play/stop events
  useEffect(() => {
    const handlePlayRouteAnimation = async (event: CustomEvent) => {
      const { segmentId } = event.detail;
      if (segmentId) {
        // Use the playback hook's route animation function
        await playback.handlePlayRouteAnimation(segmentId);
      }
    };

    const handleStopRouteAnimation = () => {
      playback.handleStopPreview();
    };

    const playHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ segmentId: string }>;
      handlePlayRouteAnimation(customEvent);
    };

    window.addEventListener('playRouteAnimation', playHandler);
    window.addEventListener('stopRouteAnimation', handleStopRouteAnimation);
    return () => {
      window.removeEventListener('playRouteAnimation', playHandler);
      window.removeEventListener('stopRouteAnimation', handleStopRouteAnimation);
    };
  }, [playback]);

  // Smooth playback time progression - Optimized with requestAnimationFrame
  // Use refs to avoid dependency issues
  const playbackRef = useRef(playback);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback.isPlaying, playback.currentPlayIndex]);

  // Use ref to track last set time to avoid unnecessary updates
  const lastSetTimeRef = useRef<number>(0);
  const lastSegmentIndexRef = useRef<number>(-1);

  useEffect(() => {
    const currentPlayback = playbackRef.current;
    const currentSegments = segmentsRef.current;

    if (!currentPlayback.isPlaying || currentSegments.length === 0) {
      // Reset time when not playing
      if (!currentPlayback.isPlaying) {
        if (lastSetTimeRef.current !== 0) {
          setCurrentPlaybackTime(0);
          lastSetTimeRef.current = 0;
        }
      }
      return;
    }

    // FIXED: Calculate base time from completed segments using effective duration
    // This accounts for route animations that may extend beyond segment duration
    let baseTime = 0;
    for (let i = 0; i < currentPlayback.currentPlayIndex && i < currentSegments.length; i++) {
      const effectiveDuration = calculateEffectiveSegmentDuration(currentSegments[i]);
      baseTime += effectiveDuration / 1000; // Convert to seconds
    }

    // Only set initial time when segment changes (not on every render)
    if (lastSegmentIndexRef.current !== currentPlayback.currentPlayIndex) {
      setCurrentPlaybackTime(baseTime);
      lastSetTimeRef.current = baseTime;
      lastSegmentIndexRef.current = currentPlayback.currentPlayIndex;
    }

    // Start smooth time progression using requestAnimationFrame for better performance
    const startTime = Date.now();
    // FIXED: Use effective duration for current segment
    const currentSegment = currentSegments[currentPlayback.currentPlayIndex];
    const currentSegmentDuration = currentSegment
      ? calculateEffectiveSegmentDuration(currentSegment)
      : 0;
    let animationFrameId: number | null = null;
    let lastUpdateTime = startTime;
    let isCancelled = false;

    const updateTime = () => {
      const latestPlayback = playbackRef.current;
      if (isCancelled || !latestPlayback.isPlaying) {
        return;
      }

      const now = Date.now();
      const elapsed = (now - startTime) / 1000;

      // Stop advancing if we've reached the end of current segment
      if (elapsed >= currentSegmentDuration / 1000) {
        const finalTime = baseTime + currentSegmentDuration / 1000;
        // Only update if value actually changed
        if (Math.abs(lastSetTimeRef.current - finalTime) > 0.01) {
          setCurrentPlaybackTime(finalTime);
          lastSetTimeRef.current = finalTime;
        }
        return;
      }

      // Throttle state updates to ~60fps (only update every ~16ms)
      // AND only update if value actually changed significantly
      if (now - lastUpdateTime >= 16) {
        const newTime = baseTime + elapsed;
        // Only update if value changed by at least 0.01 seconds to avoid unnecessary re-renders
        if (Math.abs(lastSetTimeRef.current - newTime) >= 0.01) {
          setCurrentPlaybackTime(newTime);
          lastSetTimeRef.current = newTime;
          lastUpdateTime = now;
        }
      }

      if (latestPlayback.isPlaying && !isCancelled) {
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    animationFrameId = requestAnimationFrame(updateTime);

    return () => {
      isCancelled = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playback.isPlaying, playback.currentPlayIndex]);


  const onDeleteFeature = useCallback(async (featureId: string) => {
    if (!detail) return;

    const feature = features.find(f => f.id === featureId || f.featureId === featureId);
    if (!feature) {
      return;
    }

    // Handle layer deletion state cleanup
    handleLayerDelete(feature.layer);

    if (mapRef.current && sketchRef.current) {
      sketchRef.current.removeLayer(feature.layer);
    }

    setFeatures(prev => prev.filter(f => f.id !== featureId && f.featureId !== featureId));

    setFeatureVisibility(prev => {
      const newVisibility = { ...prev };
      delete newVisibility[featureId];
      return newVisibility;
    });

    if (feature.featureId) {
      try {
        await deleteFeatureFromDB(detail.id, feature.featureId);
      } catch (error) {
      }
    }

  }, [detail, features, handleLayerDelete]);

  // Keyboard event handler for delete/backspace
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayers.size > 0) {
        // Don't prevent backspace if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        e.preventDefault();

        // Delete all selected layers
        const layersToDelete = Array.from(selectedLayers);
        for (const layer of layersToDelete) {
          const feature = features.find(f => f.layer === layer);
          if (feature && (feature.id || feature.featureId)) {
            await onDeleteFeature(feature.featureId || feature.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayers, features, onDeleteFeature]);

  // Keyboard shortcut for measurement tools (M key)
  const [showMeasurementDropdown, setShowMeasurementDropdown] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        // Toggle measurement dropdown
        setShowMeasurementDropdown((prev) => !prev);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (showMeasurementDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest('.measurement-dropdown')) {
          setShowMeasurementDropdown(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMeasurementDropdown]);

  const saveMap = useCallback(async () => {
    if (!detail) return;

    if (!mapRef.current) {
      console.warn("saveMap: mapRef.current is null");
      showToast("error", "Bản đồ chưa sẵn sàng");
      return;
    }

    setIsSaving(true);
    try {
      const map = mapRef.current;

      // Get camera state if map is valid
      let viewState: string | undefined = undefined;
      if (map && map.getCenter && typeof map.getCenter === 'function') {
        const c = map.getCenter();
        if (c) {
          const zoom = map.getZoom ? map.getZoom() : 10;
          const view = { center: [c.lat, c.lng] as [number, number], zoom };
          viewState = JSON.stringify(view);
        }
      }

      // Update map with both metadata and view state
      const body: UpdateMapRequest = {
        name: (name ?? "").trim() || "Untitled Map",
        baseLayer: baseKeyToBackend(baseKey),
        ...(viewState && { viewState }),
      };

      await updateMap(detail.id, body);
      showToast("success", "Đã lưu thông tin bản đồ và vị trí hiển thị.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : t('mapEditor.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [detail, name, baseKey, showToast]);

  // Export map handler
  const handleExport = useCallback(async () => {
    if (!mapRef.current || !detail || !mapEl.current) {
      showToast("error", t('export_embed', 'error_map_not_ready'));
      return;
    }

    setIsExporting(true);

    try {
      const map = mapRef.current;

      // 1. Capture map canvas as image (for PNG/PDF formats)
      let mapImageData: string | undefined = undefined;
      if (exportFormat === "png" || exportFormat === "pdf") {
        showToast("info", t('export_embed', 'info_capturing_map'));

        // Use leaflet-image library - it handles everything internally
        // Just ensure map is ready
        if (map) {
          map.invalidateSize();
          
          // Wait a bit for map to stabilize
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Capture using custom canvas rendering - manually draw all features
        // This ensures 100% accurate positioning
        try {
          const mapContainer = mapEl.current;
          if (!mapContainer) {
            throw new Error("Map container not found");
          }
          
          const width = mapContainer.offsetWidth;
          const height = mapContainer.offsetHeight;
          const scale = 2;
          
          // Create a canvas to draw on
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error("Could not get canvas context");
          }
          
          // Scale the context
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          
          // Wait a bit for all images to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // First, capture the base map (tiles) and markers using html2canvas
          // We'll draw vector features (polygons, circles) manually on top
          const baseCanvas = await html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            scale: scale,
            width: width,
            height: height,
            logging: false, // Disable logging to avoid console errors
            onclone: (clonedDoc) => {
              // Remove any broken image references
              const images = clonedDoc.querySelectorAll('img');
              images.forEach((img: HTMLImageElement) => {
                if (!img.complete || img.naturalWidth === 0) {
                  img.style.display = 'none';
                }
              });
              
              // Ensure all marker panes are visible
              const markerPanes = clonedDoc.querySelectorAll('.leaflet-marker-pane');
              markerPanes.forEach((pane: Element) => {
                (pane as HTMLElement).style.visibility = 'visible';
                (pane as HTMLElement).style.display = 'block';
                (pane as HTMLElement).style.opacity = '1';
              });
            },
            ignoreElements: (element) => {
              // Only ignore vector overlay layers (polygons, circles, polylines)
              // Keep markers - they use divIcon and should be captured
              if (element.classList?.contains('leaflet-overlay-pane')) {
                // Check if it's a vector layer (has SVG paths)
                const hasVectorPaths = element.querySelector('svg path, svg circle, svg polygon');
                return !!hasVectorPaths;
              }
              // Ignore broken image elements
              if (element instanceof HTMLImageElement) {
                if (!element.complete || element.naturalWidth === 0) {
                  return true;
                }
              }
              return false;
            }
          });
          
          // Draw the base map
          ctx.drawImage(baseCanvas, 0, 0, width, height);
          
          // Now manually draw all vector features using Leaflet's coordinate conversion
          const L = (await import("leaflet")).default;
          
          // Helper function to draw a layer on canvas
          const drawLayerOnCanvas = (layer: any, featureData?: any, isRecursive: boolean = false) => {
            try {
              // Check if this is a container layer (GeoJSON, FeatureGroup) that should be traversed
              if (!isRecursive && (layer instanceof L.GeoJSON || layer instanceof L.FeatureGroup || (layer.eachLayer && typeof layer.eachLayer === 'function'))) {
                // Handle GeoJSON layers (zones) - iterate through their features recursively
                layer.eachLayer((subLayer: any) => {
                  if (!drawnLayers.has(subLayer)) {
                    drawnLayers.add(subLayer);
                    drawLayerOnCanvas(subLayer, featureData, true);
                  }
                });
                return; // Don't draw the container itself, only its children
              }
              
              // Get layer style - prefer feature style if available
              const options = layer.options || {};
              let fillColor = options.fillColor || options.color || '#3388ff';
              let strokeColor = options.color || '#3388ff';
              let fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.2;
              let strokeOpacity = options.opacity !== undefined ? options.opacity : 1;
              let weight = options.weight || 2;
              
              // If feature has style data, use it
              if (featureData?.style) {
                try {
                  const style = typeof featureData.style === 'string' 
                    ? JSON.parse(featureData.style) 
                    : featureData.style;
                  if (style.fillColor) fillColor = style.fillColor;
                  if (style.color) {
                    strokeColor = style.color;
                    if (!fillColor || fillColor === '#3388ff') fillColor = style.color;
                  }
                  if (style.fillOpacity !== undefined) fillOpacity = style.fillOpacity;
                  if (style.opacity !== undefined) strokeOpacity = style.opacity;
                  if (style.weight !== undefined) weight = style.weight;
                } catch (e) {
                  console.warn("Failed to parse feature style:", e);
                }
              }
              
              ctx.fillStyle = fillColor;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = weight;
              ctx.globalAlpha = fillOpacity;

              // Use duck-typing instead of instanceof to handle bundled/minified code
              // Check for Circle or CircleMarker (has getLatLng and getRadius or _mRadius)
              if (layer.getLatLng && typeof layer.getLatLng === 'function' &&
                  (layer.getRadius || layer._mRadius !== undefined)) {
                const center = layer.getLatLng();
                const centerPoint = map.latLngToContainerPoint(center);

                // For Circle (has _mRadius - radius in meters), convert radius from meters to pixels
                let radiusPx: number;
                if (layer._mRadius !== undefined) {
                  // Calculate a point that is _mRadius meters away from center
                  const earthRadius = 6378137; // Earth's radius in meters
                  const radiusInDegrees = (layer._mRadius / earthRadius) * (180 / Math.PI);

                  // Create a point to the east at the radius distance
                  const edgePoint = L.latLng(center.lat, center.lng + radiusInDegrees / Math.cos(center.lat * Math.PI / 180));
                  const edgePixel = map.latLngToContainerPoint(edgePoint);

                  radiusPx = Math.abs(edgePixel.x - centerPoint.x);
                } else {
                  // CircleMarker radius is already in pixels
                  radiusPx = layer.getRadius ? layer.getRadius() : (options.radius || 10);
                }

                console.log(`[EXPORT] Drawing circle/circleMarker at (${centerPoint.x}, ${centerPoint.y}) radius=${radiusPx}px (original: ${layer._mRadius || 'N/A'}m), fillColor=${fillColor}, strokeColor=${strokeColor}, fillOpacity=${fillOpacity}, strokeOpacity=${strokeOpacity}`);

                ctx.beginPath();
                ctx.arc(centerPoint.x, centerPoint.y, radiusPx, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = strokeOpacity;
                ctx.stroke();
              }
              // Check for Polygon or Rectangle (has getLatLngs and multiple coordinates)
              else if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
                const latlngs = layer.getLatLngs();
                if (Array.isArray(latlngs) && latlngs.length > 0) {
                  const coords = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;

                  // Check if this is a Polygon (closed shape) or Polyline (open shape)
                  const isPolygon = layer.getBounds && typeof layer.getBounds === 'function';

                  if (isPolygon && coords.length > 2) {
                    console.log(`[EXPORT] Drawing polygon with ${coords.length} points, fillColor=${fillColor}, strokeColor=${strokeColor}`);
                    ctx.beginPath();
                    coords.forEach((ll: any, idx: number) => {
                      const pt = map.latLngToContainerPoint(ll);
                      if (idx === 0) {
                        ctx.moveTo(pt.x, pt.y);
                      } else {
                        ctx.lineTo(pt.x, pt.y);
                      }
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = strokeOpacity;
                    ctx.stroke();
                  } else {
                    // Polyline (linestring)
                    console.log(`[EXPORT] Drawing polyline/linestring with ${latlngs.length} points, strokeColor=${strokeColor}, weight=${weight}, strokeOpacity=${strokeOpacity}`);
                    ctx.beginPath();
                    latlngs.forEach((ll: any, idx: number) => {
                      const pt = map.latLngToContainerPoint(ll);
                      if (idx === 0) {
                        ctx.moveTo(pt.x, pt.y);
                      } else {
                        ctx.lineTo(pt.x, pt.y);
                      }
                    });
                    ctx.globalAlpha = strokeOpacity;
                    ctx.stroke();
                  }
                }
              }
              // Check for Marker (has getLatLng but no getRadius)
              else if (layer.getLatLng && typeof layer.getLatLng === 'function') {
                console.log(`[EXPORT] Skipping marker (already captured in base canvas)`);
                // Markers are already captured in base canvas, skip
              } else {
                console.warn(`[EXPORT] Unknown layer type, cannot draw:`, layer.constructor.name, layer);
              }
            } catch (layerError) {
              console.warn("Error drawing layer:", layerError);
            }
          };
          
          // Create a map to track which layers we've drawn (to avoid duplicates)
          const drawnLayers = new Set<any>();

          // First, draw all layers directly from the map (this includes route animations, features, etc.)
          console.log(`[EXPORT] Starting to draw features. Drawing all map layers`);
          let mapLayerCount = 0;
          map.eachLayer((layer: any) => {
            // Skip tile layers and other base layers
            if (layer._url || layer instanceof L.TileLayer) {
              return; // Skip tile layers
            }

            // Skip if already drawn
            if (drawnLayers.has(layer)) {
              return;
            }

            drawnLayers.add(layer);
            mapLayerCount++;
            console.log(`[EXPORT] Drawing layer from map: ${layer.constructor.name}, hasLatLng=${!!layer.getLatLng}, hasLatLngs=${!!layer.getLatLngs}`);
            drawLayerOnCanvas(layer);
          });
          console.log(`[EXPORT] Drew ${mapLayerCount} layers from map`);

          // Second, draw all layers from sketchRef (in case they weren't in map.eachLayer)
          console.log(`[EXPORT] Checking sketchRef: ${sketchRef.current ? 'yes' : 'no'}`);
          if (sketchRef.current) {
            let sketchLayerCount = 0;
            sketchRef.current.eachLayer((layer: any) => {
              if (!drawnLayers.has(layer)) {
                drawnLayers.add(layer);
                sketchLayerCount++;
                console.log(`[EXPORT] Drawing layer from sketchRef: ${layer.constructor.name}`);
                drawLayerOnCanvas(layer);
              }
            });
            console.log(`[EXPORT] Drew ${sketchLayerCount} additional layers from sketchRef`);
          }
          
          // Third, draw all features from the features array (in case they're not in map or sketchRef)
          console.log(`[EXPORT] Processing features array, total features: ${features.length}`);
          let featuresDrawnCount = 0;
          let featuresSkippedCount = 0;
          features.forEach((feature) => {
            try {
              // Only process visible features
              const isVisible = featureVisibility[feature.id] ?? feature.isVisible ?? true;

              if (!isVisible) {
                console.log(`[EXPORT] Feature ${feature.name || feature.type} (${feature.id}) skipped: isVisible=false`);
                featuresSkippedCount++;
                return;
              }

              if (feature.layer && !drawnLayers.has(feature.layer)) {
                drawnLayers.add(feature.layer);
                featuresDrawnCount++;
                console.log(`[EXPORT] Drawing feature from features array: ${feature.name || feature.type}, layer type: ${feature.layer.constructor.name}`);
                drawLayerOnCanvas(feature.layer, feature);
              } else if (!feature.layer) {
                console.warn(`[EXPORT] Feature ${feature.name || feature.id} has no layer reference, skipping`);
                featuresSkippedCount++;
              } else {
                console.log(`[EXPORT] Feature ${feature.name || feature.id} already in drawnLayers, skipping`);
                featuresSkippedCount++;
              }
            } catch (featureError) {
              console.warn("Error processing feature for export:", featureError);
            }
          });
          console.log(`[EXPORT] Features array: drew ${featuresDrawnCount}, skipped ${featuresSkippedCount}`);

          // Fourth, draw all layers from dataLayerRefs (zones and other layer data)
          // Only draw visible layers
          console.log(`[EXPORT] dataLayerRefs exists: ${dataLayerRefs.current ? 'yes' : 'no'}, layers count: ${layers.length}`);
          if (dataLayerRefs.current && layers) {
            let dataLayerCount = 0;
            dataLayerRefs.current.forEach((layer: any, layerId: string) => {
              // Check if layer is visible
              const layerData = layers.find(l => l.id === layerId);
              const isLayerVisible = layerVisibility[layerId] ?? layerData?.isVisible ?? true;

              console.log(`[EXPORT] Checking dataLayer ${layerId}: visible=${isLayerVisible}, layer type: ${layer?.constructor?.name || 'unknown'}`);

              if (isLayerVisible && !drawnLayers.has(layer)) {
                drawnLayers.add(layer);
                dataLayerCount++;
                console.log(`[EXPORT] Drawing dataLayer ${layerId}: ${layer.constructor.name}`);
                drawLayerOnCanvas(layer);
              }
            });
            console.log(`[EXPORT] Drew ${dataLayerCount} layers from dataLayerRefs`);
          }
          
          // Now draw text labels for text features (if any markers have text icons)
          // Check all markers for text content in their icons
          if (sketchRef.current) {
            sketchRef.current.eachLayer((layer: any) => {
              try {
                if (layer instanceof L.Marker) {
                  const icon = layer.options?.icon as L.DivIcon | undefined;
                  if (icon?.options?.html && typeof icon.options.html === 'string') {
                    const textContent = icon.options.html;
                    const position = layer.getLatLng();
                    const point = map.latLngToContainerPoint(position);
                    
                    // Draw text background (optional, for better readability)
                    ctx.save();
                    ctx.font = `${14 * scale}px Arial, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Measure text to draw background
                    const metrics = ctx.measureText(textContent);
                    const textWidth = metrics.width;
                    const textHeight = 14 * scale;
                    
                    // Draw background rectangle
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(
                      point.x - textWidth / 2 - 4,
                      point.y - textHeight / 2 - 4,
                      textWidth + 8,
                      textHeight + 8
                    );
                    
                    // Draw text
                    ctx.fillStyle = '#000000';
                    ctx.fillText(textContent, point.x, point.y);
                    ctx.restore();
                  }
                }
              } catch (textError) {
                console.warn("Error drawing text label:", textError);
              }
            });
          }
          
          // Convert to base64
          mapImageData = canvas.toDataURL('image/png', 1.0);
          console.log("✅ Map captured successfully using custom canvas rendering. Canvas size:", canvas.width, "x", canvas.height);
        } catch (captureError) {
          console.error("Map capture failed:", captureError);
          showToast("error", t('export_embed', 'error_capture_failed'));
          setIsExporting(false);
          return;
        }
      }

      // 2. Get current view state (center, zoom)
      let viewState: string | undefined = undefined;
      if (map && map.getCenter && typeof map.getCenter === 'function') {
        const center = map.getCenter();
        if (center) {
          const zoom = map.getZoom ? map.getZoom() : 10;
          const view = {
            center: [center.lat, center.lng] as [number, number],
            zoom
          };
          viewState = JSON.stringify(view);
        }
      }

      // 3. Get visible layers
      const visibleLayerIds: Record<string, boolean> = {};
      layers.forEach(layer => {
        visibleLayerIds[layer.id] = layerVisibility[layer.id] ?? layer.isVisible ?? true;
      });

      // 4. Get visible features
      const visibleFeatureIds: Record<string, boolean> = {};
      features.forEach(feature => {
        visibleFeatureIds[feature.id] = featureVisibility[feature.id] ?? feature.isVisible ?? true;
      });

      // Note: SVG path extraction is no longer needed since we're using Canvas renderer
      // html2canvas can now capture everything directly from the canvas
      let svgPathData: string | undefined = undefined;
      // Disabled - using canvas renderer instead
      if (false && (exportFormat === "png" || exportFormat === "pdf") && sketchRef.current && map && mapEl.current) {
        try {
          const svgPaths: Array<{
            type: 'path' | 'circle' | 'polygon' | 'polyline';
            data: string;
            fill: string;
            stroke: string;
            strokeWidth: string;
            fillOpacity: string;
            strokeOpacity: string;
            transform?: string;
          }> = [];
          
          const mapBounds = map.getBounds();
          const mapSize = map.getSize();
          const containerRect = mapEl.current?.getBoundingClientRect();
          
          sketchRef.current?.eachLayer((layer: any) => {
            if (!layer._path) return;
            
            const pathElement = layer._path as SVGElement;
            if (!pathElement || !pathElement.parentElement) return;
            
            // Get computed styles
            const computedStyle = window.getComputedStyle(pathElement);
            const fill = pathElement.getAttribute('fill') || computedStyle.fill || '#3388ff';
            const stroke = pathElement.getAttribute('stroke') || computedStyle.stroke || '#3388ff';
            const strokeWidth = pathElement.getAttribute('stroke-width') || computedStyle.strokeWidth || '2';
            const fillOpacity = pathElement.getAttribute('fill-opacity') || computedStyle.fillOpacity || '0.2';
            const strokeOpacity = pathElement.getAttribute('stroke-opacity') || computedStyle.strokeOpacity || '1';
            
            // Get the actual SVG path data based on element type
            const tagName = pathElement.tagName.toLowerCase();
            
            try {
              // html2canvas captures at scale: 2, so we need to scale coordinates by 2
              const imageScale = 2;
              
              // Use Leaflet's coordinate conversion for accurate positioning
              if (tagName === 'path') {
                // For paths (polygons, circles rendered as paths), use layer coordinates
                if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
                  const latlngs = layer.getLatLngs();
                  if (Array.isArray(latlngs) && latlngs.length > 0) {
                    // Convert lat/lng to container points and scale
                    const points = Array.isArray(latlngs[0]) 
                      ? (latlngs[0] as any[]).map((ll: any) => {
                          const pt = map.latLngToContainerPoint(ll);
                          return { x: pt.x * imageScale, y: pt.y * imageScale };
                        })
                      : latlngs.map((ll: any) => {
                          const pt = map.latLngToContainerPoint(ll);
                          return { x: pt.x * imageScale, y: pt.y * imageScale };
                        });
                    
                    // Build path data from points
                    const pathCommands = points.map((pt, idx) => 
                      idx === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`
                    );
                    pathCommands.push('Z'); // Close path
                    
                    svgPaths.push({
                      type: 'path',
                      data: pathCommands.join(' '),
                      fill,
                      stroke,
                      strokeWidth: (parseFloat(strokeWidth) * imageScale).toString(),
                      fillOpacity,
                      strokeOpacity
                    });
                  }
                } else {
                  // Fallback: use SVG path as-is with transform and scale
                  const d = pathElement.getAttribute('d');
                  if (d) {
                    const pathRect = pathElement.getBoundingClientRect();
                    const mapContainerRect = mapEl.current?.getBoundingClientRect();
                    const offsetX = (pathRect.left - (mapContainerRect?.left ?? 0)) * imageScale;
                    const offsetY = (pathRect.top - (mapContainerRect?.top ?? 0)) * imageScale;
                    const bbox = (pathElement as SVGPathElement).getBBox();
                    
                    svgPaths.push({
                      type: 'path',
                      data: d,
                      fill,
                      stroke,
                      strokeWidth: (parseFloat(strokeWidth) * imageScale).toString(),
                      fillOpacity,
                      strokeOpacity,
                      transform: `translate(${offsetX - bbox.x * imageScale},${offsetY - bbox.y * imageScale}) scale(${imageScale})`
                    });
                  }
                }
              } else if (tagName === 'circle') {
                // For circles, use layer center and radius
                if (layer.getLatLng && typeof layer.getLatLng === 'function' && layer.getRadius && typeof layer.getRadius === 'function') {
                  const center = layer.getLatLng();
                  const radius = layer.getRadius();
                  const centerPoint = map.latLngToContainerPoint(center);
                  
                  // Convert radius from meters to pixels and scale
                  const radiusPoint = map.latLngToContainerPoint([
                    center.lat,
                    map.containerPointToLatLng([centerPoint.x + radius, centerPoint.y]).lng
                  ]);
                  const radiusPx = Math.abs(radiusPoint.x - centerPoint.x) * imageScale;
                  
                  svgPaths.push({
                    type: 'circle',
                    data: `${centerPoint.x * imageScale},${centerPoint.y * imageScale},${radiusPx}`,
                    fill,
                    stroke,
                    strokeWidth: (parseFloat(strokeWidth) * imageScale).toString(),
                    fillOpacity,
                    strokeOpacity
                  });
                } else {
                  // Fallback: use bounding box and scale
                  const pathRect = pathElement.getBoundingClientRect();
                  const mapContainerRect = mapEl.current?.getBoundingClientRect();
                  const circleCenterX = (pathRect.left + pathRect.width / 2 - (mapContainerRect?.left ?? 0)) * imageScale;
                  const circleCenterY = (pathRect.top + pathRect.height / 2 - (mapContainerRect?.top ?? 0)) * imageScale;
                  const circleRadius = Math.max(pathRect.width, pathRect.height) / 2 * imageScale;
                  
                  svgPaths.push({
                    type: 'circle',
                    data: `${circleCenterX},${circleCenterY},${circleRadius}`,
                    fill,
                    stroke,
                    strokeWidth: (parseFloat(strokeWidth) * imageScale).toString(),
                    fillOpacity,
                    strokeOpacity
                  });
                }
              } else if (tagName === 'polygon' || tagName === 'polyline') {
                // For polygons/polylines, use layer coordinates
                if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
                  const latlngs = layer.getLatLngs();
                  if (Array.isArray(latlngs) && latlngs.length > 0) {
                    // Handle nested arrays (polygon with holes)
                    const coords = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
                    const points = coords.map((ll: any) => {
                      const pt = map.latLngToContainerPoint(ll);
                      return `${pt.x * imageScale},${pt.y * imageScale}`;
                    });
                    
                    svgPaths.push({
                      type: tagName === 'polygon' ? 'polygon' : 'polyline',
                      data: points.join(' '),
                      fill,
                      stroke,
                      strokeWidth: (parseFloat(strokeWidth) * imageScale).toString(),
                      fillOpacity,
                      strokeOpacity
                    });
                  }
                }
              }
            } catch (err) {
              console.warn("Error extracting SVG path data:", err, layer, pathElement);
            }
          });
          
          if (svgPaths.length > 0) {
            svgPathData = JSON.stringify(svgPaths);
            console.log(`✅ [EXPORT] Extracted ${svgPaths.length} SVG paths for export`);
          }
        } catch (svgError) {
          console.warn("Failed to extract SVG paths:", svgError);
        }
      }

      // 5. Prepare export request
      const exportRequest: ExportRequest = {
        mapId: detail.id,
        format: exportFormat,
        viewState: viewState,
        mapImageData: mapImageData, // Include captured map image
        svgPathData: svgPathData, // Include extracted SVG path data
        visibleLayerIds: Object.keys(visibleLayerIds).length > 0 ? visibleLayerIds : undefined,
        visibleFeatureIds: Object.keys(visibleFeatureIds).length > 0 ? visibleFeatureIds : undefined,
        options: {
          title: detail.name,
          description: detail.description,
          width: (mapEl.current.offsetWidth || 1920).toString(),
          height: (mapEl.current.offsetHeight || 1080).toString(),
          dpi: "300",
          includeLegend: true,
          includeScale: true
        }
      };

      const response = await createExport(exportRequest);
      setExportStatus(response);

      // GeoJSON exports are auto-approved, PNG/PDF require admin approval
      if (exportFormat === "geojson") {
        // GeoJSON is auto-approved, check if it's already approved
        if (response.status === "Approved" && response.fileUrl) {
          // Auto-download GeoJSON file
          window.open(response.fileUrl, '_blank');
          showToast("success", lang === 'vi' ? 'GeoJSON đã được tải xuống tự động' : 'GeoJSON downloaded automatically');
        } else if (response.status === "Processing" || response.status === "Pending") {
          // If still processing, poll a few times to get the final status
          let pollCount = 0;
          const maxPolls = 10; // Poll up to 10 times (50 seconds max)
          
          const pollInterval = setInterval(async () => {
            pollCount++;
            try {
              const updatedExport = await getExportById(response.exportId);
              setExportStatus(updatedExport);
              
              if (updatedExport.status === "Approved" && updatedExport.fileUrl) {
                clearInterval(pollInterval);
                // Auto-download GeoJSON file
                window.open(updatedExport.fileUrl, '_blank');
                showToast("success", lang === 'vi' ? 'GeoJSON đã được tải xuống tự động' : 'GeoJSON downloaded automatically');
              } else if (updatedExport.status === "Rejected" || updatedExport.status === "Failed") {
                clearInterval(pollInterval);
                const reason = updatedExport.rejectionReason || updatedExport.errorMessage || '';
                showToast("error", `${lang === 'vi' ? 'Lỗi xuất GeoJSON' : 'GeoJSON export failed'}: ${reason}`);
              } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                showToast("warning", lang === 'vi' ? 'Hết thời gian chờ xuất GeoJSON' : 'GeoJSON export timeout');
              }
            } catch (error) {
              console.error("Error checking GeoJSON export status:", error);
              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
              }
            }
          }, 5000); // Poll every 5 seconds
        } else {
          showToast("success", t('export_embed', 'success_export_created'));
        }
      } else {
        // PNG/PDF require admin approval
        showToast("success", t('export_embed', 'success_export_created'));
        
        // Poll for status updates if pending approval
        if (response.status === "PendingApproval" || response.status === "Processing") {
          pollExportStatus(response.exportId);
        } else if (response.status === "Approved" && response.fileUrl) {
          // Show download link in toast if already approved
          showToast("success", `${t('export_embed', 'success_export_approved')} ${response.fileUrl}`);
        }
      }
    } catch (error) {
      console.error("Export failed:", error);

      // Handle specific error types
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Check for specific error types from the API
        if (errorMessage.includes("Export.MembershipNotFound") || errorMessage.includes("membership not found")) {
          showToast("error", t('export_embed', 'error_membership_not_found'));
        } else if (errorMessage.includes("permission") || errorMessage.includes("forbidden")) {
          showToast("error", t('export_embed', 'error_permission_denied'));
        } else if (errorMessage.includes("format")) {
          showToast("error", t('export_embed', 'error_invalid_format'));
        } else {
          showToast("error", errorMessage || t('export_embed', 'error_export_failed'));
        }
      } else {
        showToast("error", t('export_embed', 'error_export_failed'));
      }
    } finally {
      setIsExporting(false);
    }
  }, [detail, mapRef, mapEl, features, layers, layerVisibility, featureVisibility, exportFormat, showToast, t]);

  // Poll export status
  const pollExportStatus = useCallback(async (exportId: number) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const updatedExport = await getExportById(exportId);
        setExportStatus(updatedExport);

        if (updatedExport.status === "Approved") {
          clearInterval(interval);
          if (updatedExport.fileUrl) {
            showToast("success", `${t('export_embed', 'success_export_approved')} URL: ${updatedExport.fileUrl}`);
          } else {
            showToast("success", t('export_embed', 'success_export_approved'));
          }
        } else if (updatedExport.status === "Rejected" || updatedExport.status === "Failed") {
          clearInterval(interval);
          const reason = updatedExport.rejectionReason || updatedExport.errorMessage || '';
          const statusText = updatedExport.status === "Rejected"
            ? t('export_embed', 'status_rejected')
            : t('export_embed', 'status_failed');
          showToast("error", `${statusText}: ${reason}`);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          showToast("warning", t('export_embed', 'error_export_timeout'));
        }
      } catch (error) {
        console.error("Error polling export status:", error);
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [showToast, t]);

  // Toggle export popup

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/70 backdrop-blur-md ring-1 ring-white/15 shadow-xl py-1 px-3">
          <div className="grid grid-cols-3 place-items-stretch gap-2">
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              {isEditingMapName ? (
                <input
                  type="text"
                  value={editingMapName}
                  onChange={(e) => setEditingMapName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const newName = editingMapName.trim() || t('mapEditor.untitledMap');
                      if (newName !== name) {
                        try {
                          setIsSaving(true);
                          await updateMap(detail?.id || '', { name: newName });
                          setName(newName);
                          showToast("success", t('mapEditor.mapRenamed'));
                        } catch (error) {
                          showToast("error", t('mapEditor.renameMapFailed'));
                        } finally {
                          setIsSaving(false);
                        }
                      }
                      setIsEditingMapName(false);
                      setEditingMapName("");
                    } else if (e.key === "Escape") {
                      setIsEditingMapName(false);
                      setEditingMapName("");
                    }
                  }}
                  onBlur={async () => {
                    const newName = editingMapName.trim() || t('mapEditor.untitledMap');
                    if (newName !== name) {
                      try {
                        setIsSaving(true);
                        await updateMap(detail?.id || '', { name: newName });
                        setName(newName);
                        showToast("success", t('mapEditor.mapRenamed'));
                      } catch (error) {
                        showToast("error", t('mapEditor.renameMapFailed'));
                      } finally {
                        setIsSaving(false);
                      }
                    }
                    setIsEditingMapName(false);
                    setEditingMapName("");
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-white text-black text-sm font-medium w-52 border-2 border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder={t('mapEditor.untitledMap')}
                  autoFocus
                  disabled={isSaving}
                />
              ) : (
                <span
                  onDoubleClick={() => {
                    setEditingMapName(name);
                    setIsEditingMapName(true);
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-medium w-52 cursor-pointer transition-colors truncate"
                  title={t('mapEditor.doubleClickRename')}
                >
                  {name || t('mapEditor.untitledMap')}
                </span>
              )}
            </div>
            {!loading && mapStatus !== "archived" && (
            <DrawingToolsBar mapRef={mapRef} onStartMeasurement={startMeasurement} />
            )}
            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
              {/* Active Users */}
              <ActiveUsersIndicator
                activeUsers={collaboration.activeUsers}
                isConnected={collaboration.isConnected}
              />

              {/* Toolbar Group - Canva Style */}
              <div className="flex items-center gap-0 bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/50">
                <input
                  type="file"
                  accept=".geojson,.json,.kml,.gpx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && mapId) {
                      try {
                        showToast("info", t('mapEditor.uploadingFile'));

                        // Backend tự động tạo layer mới, chỉ cần truyền mapId
                        const result = await uploadGeoJsonToMap(mapId, file);

                        showToast("info", t('mapEditor.loadingData'));

                        // Refresh toàn bộ map detail để lấy layer mới
                        const updatedDetail = await getMapDetail(mapId);
                        setDetail(updatedDetail);

                        showToast("success", t('mapEditor.uploadSuccess', { count: result.featuresAdded, layerId: result.layerId }));

                        // Clear the input
                        e.target.value = '';
                      } catch (error) {
                        console.error("Upload error:", error);
                        showToast("error", error instanceof Error ? error.message : t('mapEditor.uploadFailed'));
                        e.target.value = '';
                      }
                    }
                  }}
                  className="hidden"
                  id="upload-layer"
                />
                <label
                  htmlFor="upload-layer"
                  className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white cursor-pointer transition-all flex items-center gap-2"
                  title={t('mapEditor.uploadTooltip')}
                >
                  <UploadIcon className="w-4 h-4" />
                  {t('mapEditor.upload')}
                </label>

                <div className="h-5 w-px bg-zinc-600/50" />

                <button
                  className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  onClick={saveMap}
                  disabled={isSaving || !mapRef.current}
                  title={t('mapEditor.saveTooltip')}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                      {t('mapEditor.saving')}
                    </>
                  ) : (
                    <>
                      <SaveIcon className="w-4 h-4" />
                      {t('mapEditor.save')}
                    </>
                  )}
                </button>

                <div className="h-5 w-px bg-zinc-600/50" />

                {/* Export Button */}
                <button
                  className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  onClick={() => {
                    setShowExportModal(true);
                    // If story map, ensure we're on export tab
                    if (!loading && detail?.isStoryMap === true) {
                      setExportModalTab("export");
                    }
                  }}
                  disabled={isExporting || !mapRef.current}
                  title={t('mapEditor.exportTooltip')}
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                      {t('mapEditor.exporting')}
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4" />
                      {t('mapEditor.export')}
                    </>
                  )}
                </button>

                <div className="h-5 w-px bg-zinc-600/50" />

                <PublishButton mapId={mapId} status={mapStatus} onStatusChange={setMapStatus} isStoryMap={!loading && detail?.isStoryMap !== false} />
              </div>
            </div>
          </div>
          {/* Toast messages are handled globally via ToastProvider */}
        </div>
      </div>

      {/* Map Canvas - Adjusted for VSCode-style UI panels */}
      <div
        ref={mapEl}
        className="absolute inset-0 transition-all duration-300"
        style={{
          left: mapStatus === "archived" ? "0" : (leftSidebarView ? "376px" : "56px"), // Hide sidebar when Archived
          right: (isPropertiesPanelOpen || poiTooltipModal.isOpen) ? "360px" : "0",
          // top: "60px",
          bottom: (!loading && detail?.isStoryMap !== false && mapStatus !== "archived") ? "200px" : "0", // Hide timeline when Archived
        }}
      />

      {/* NEW: VSCode-style Left Sidebar - Hide when Archived */}
      {mapStatus !== "archived" && !loading && (
        <LeftSidebarToolbox
        isStoryMap={!loading && detail?.isStoryMap !== false}
        activeView={leftSidebarView}
        onViewChange={setLeftSidebarView}
        features={features}
        layers={layers}
        segments={segments}
        transitions={transitions}
        baseLayer={baseKey}
        currentMap={mapRef.current}
        mapId={mapId}
        layerVisibility={layerVisibility}
        onSelectFeature={handleSelectFeature}
        onSelectLayer={handleSelectLayerNew}
        onBaseLayerChange={setBaseKey}
        onFeatureVisibilityChange={onFeatureVisibilityChange}
        onLayerVisibilityChange={onLayerVisibilityChange}
        onDeleteFeature={onDeleteFeature}
        onSegmentClick={handleSegmentClick}
        onSaveSegment={handleSaveSegment}
        onDeleteSegment={handleDeleteSegment}
        onSaveTransition={handleSaveTransition}
        onDeleteTransition={handleDeleteTransition}
        currentLayerId={currentLayerId}
          onLayerChange={setCurrentLayerId}
        />
      )}

      {/* NEW: Right Properties Panel */}
      <PropertiesPanel
        isOpen={isPropertiesPanelOpen}
        selectedItem={selectedEntity}
        onClose={() => setIsPropertiesPanelOpen(false)}
        onUpdate={handleUpdateFeature}
      />

      {/*Timeline Workspace - Only show for StoryMap, hide when Archived */}
      {!loading && detail?.isStoryMap !== false && mapStatus !== "archived" && (
        <TimelineWorkspace
          segments={segments}
          transitions={transitions}
          activeSegmentId={activeSegmentId}
          mapId={mapId}
          isPlaying={isPlayingTimeline}
          currentTime={currentPlaybackTime}
          leftOffset={leftSidebarView ? 376 : 56}
          isOpen={isTimelineOpen}
          onToggle={() => setIsTimelineOpen((prev) => !prev)}
          onReorder={handleTimelineReorder}
          onPlay={handlePlayTimeline}
          onStop={handleStopTimeline}
          onPlaySingleSegment={playback.handlePlaySingleSegment}
          onSegmentClick={handleSegmentClick}
          onRefreshSegments={handleRefreshSegments}
        />
      )}

      <ZoomControls
        zoomIn={handleZoomIn}
        zoomOut={handleZoomOut}
        isTimelineOpen={isTimelineOpen}
        currentZoom={currentZoom}
      />

      {/* Route Animations with Sequential Playback */}
      {playback.routeAnimations && playback.routeAnimations.length > 0 && playbackMap && (() => {
        // Get current segment for camera state
        const currentSegment = playback.currentPlayIndex !== undefined && playback.currentPlayIndex >= 0 && playback.currentPlayIndex < segments.length
          ? segments[playback.currentPlayIndex]
          : null;

        // Parse segment camera state
        const segmentCameraState = currentSegment?.cameraState
          ? (typeof currentSegment.cameraState === 'string'
            ? (() => {
              try {
                const parsed = JSON.parse(currentSegment.cameraState);
                return parsed?.center && Array.isArray(parsed.center) && parsed.center.length >= 2
                  ? { center: [parsed.center[0], parsed.center[1]] as [number, number], zoom: parsed.zoom ?? 10 }
                  : null;
              } catch {
                return null;
              }
            })()
            : (currentSegment.cameraState?.center && Array.isArray(currentSegment.cameraState.center) && currentSegment.cameraState.center.length >= 2
              ? { center: [currentSegment.cameraState.center[0], currentSegment.cameraState.center[1]] as [number, number], zoom: currentSegment.cameraState.zoom ?? 10 }
              : null))
          : null;

        return (
          <SequentialRoutePlaybackWrapper
            map={playbackMap}
            routeAnimations={playback.routeAnimations}
            isPlaying={playback.isPlaying}
            segmentStartTime={playback.segmentStartTime}
            onLocationClick={(location) => {
              setPoiTooltipModal({
                isOpen: true,
                poi: location,
              });
            }}
            segmentCameraState={segmentCameraState}
          />
        );
      })()}

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
        featureIndex={
          detail && contextMenu.feature && contextMenu.layerId
            ? findFeatureIndex(
              (detail.layers.find(l => l.id === contextMenu.layerId)?.layerData as FeatureCollection) || {},
              contextMenu.feature
            )
            : 0
        }
        feature={contextMenu.feature ?? undefined}
        onSuccess={handleCopyFeatureSuccess}
      />

      {/* Measurement Info Box */}
      {measurementState.mode && measurementState.points.length > 0 && !measurementState.isActive && (
        <MeasurementInfoBox
          mode={measurementState.mode}
          value={measurementState.currentValue}
          onDismiss={cancelMeasurement}
        />
      )}

      {/* Measurement Dropdown (M key) */}
      {showMeasurementDropdown && (
        <>
          <div
            className="fixed inset-0 z-[10000]"
            onClick={() => setShowMeasurementDropdown(false)}
          />
          <div
            className="measurement-dropdown fixed z-[10001] bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              onClick={() => {
                startMeasurement('distance');
                setShowMeasurementDropdown(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span>📏</span>
              <span>Measure Distance</span>
            </button>
            <button
              onClick={() => {
                startMeasurement('area');
                setShowMeasurementDropdown(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span>📐</span>
              <span>Measure Area</span>
            </button>
            <button
              onClick={() => setShowMeasurementDropdown(false)}
              className="w-full px-4 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Map Context Menu for Measurement */}
      {mapContextMenu.visible && (
        <>
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setMapContextMenu({ visible: false, x: 0, y: 0 })}
          />
          <div
            className="fixed z-[10000] bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{
              left: `${mapContextMenu.x}px`,
              top: `${mapContextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                startMeasurement('distance');
                setMapContextMenu({ visible: false, x: 0, y: 0 });
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span>📏</span>
              <span>Measure Distance</span>
            </button>
            <button
              onClick={() => {
                startMeasurement('area');
                setMapContextMenu({ visible: false, x: 0, y: 0 });
              }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span>📐</span>
              <span>Measure Area</span>
            </button>
          </div>
        </>
      )}

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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[4000] flex items-start justify-center pt-32">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setShowExportModal(false);
              setExportStatus(null);
            }}
          />
          <div className="relative bg-zinc-900 rounded-lg shadow-2xl border border-zinc-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-6 py-4 flex items-center justify-between rounded-t-lg z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">
                  {t('export_embed', 'hero_pill')}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportModalTab("export")}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      exportModalTab === "export"
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    Export
                  </button>
                  {!loading && detail?.isStoryMap !== true && (
                    <button
                      onClick={() => setExportModalTab("embed")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        exportModalTab === "embed"
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      Embed Code
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportStatus(null);
                  setExportModalTab("export");
                }}
                className="text-zinc-400 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {exportModalTab === "export" ? (
                <>
                  {/* Format Selection */}
                  <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t('export_embed', 'formats_title')}
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "geojson" | "png" | "pdf")}
                  disabled={isExporting}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="geojson">GeoJSON</option>
                  <option value="png">PNG Image</option>
                  <option value="pdf">PDF Document</option>
                </select>
              </div>

              {/* Export Status */}
              {exportStatus && (
                <div className="bg-zinc-800 rounded-md p-4 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-300">Status:</span>
                    <span className={`text-sm font-semibold ${
                      exportStatus.status === "Approved" ? "text-green-400" :
                      exportStatus.status === "Rejected" || exportStatus.status === "Failed" ? "text-red-400" :
                      exportStatus.status === "Processing" ? "text-blue-400" :
                      "text-yellow-400"
                    }`}>
                      {exportStatus.status === "PendingApproval" ? t('export_embed', 'status_pending') :
                       exportStatus.status === "Processing" ? t('export_embed', 'status_processing') :
                       exportStatus.status === "Approved" ? t('export_embed', 'status_approved') :
                       exportStatus.status === "Rejected" ? t('export_embed', 'status_rejected') :
                       exportStatus.status === "Failed" ? t('export_embed', 'status_failed') :
                       exportStatus.status}
                    </span>
                  </div>

                  {/* Info message for GeoJSON vs PNG/PDF */}
                  {exportFormat === "geojson" && exportStatus.status === "PendingApproval" && (
                    <div className="mt-2 text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 rounded px-2 py-1">
                      {lang === 'vi' 
                        ? 'GeoJSON sẽ được tự động phê duyệt và có thể tải xuống ngay sau khi xử lý xong.'
                        : 'GeoJSON will be auto-approved and available for download once processing is complete.'}
                    </div>
                  )}
                  {exportFormat !== "geojson" && exportStatus.status === "PendingApproval" && (
                    <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded px-2 py-1">
                      {lang === 'vi' 
                        ? 'PNG/PDF cần được quản trị viên phê duyệt trước khi có thể tải xuống.'
                        : 'PNG/PDF require admin approval before download is available.'}
                    </div>
                  )}

                  {/* Download Link */}
                  {exportStatus.status === "Approved" && exportStatus.fileUrl && (
                    <div className="mt-3 space-y-2">
                      <a
                        href={exportStatus.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-center transition-colors"
                        onClick={(e) => {
                          // For GeoJSON, also trigger download
                          if (exportFormat === "geojson") {
                            e.preventDefault();
                            window.open(exportStatus.fileUrl!, '_blank');
                          }
                        }}
                      >
                        {lang === 'vi' ? 'Tải xuống' : 'Download'}
                      </a>
                      {exportFormat === "geojson" && (
                        <p className="text-xs text-zinc-400 text-center">
                          {lang === 'vi' ? 'GeoJSON sẽ tự động tải xuống khi được phê duyệt' : 'GeoJSON will auto-download when approved'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Error/Rejection Reason */}
                  {(exportStatus.status === "Rejected" || exportStatus.status === "Failed") && (
                    <div className="mt-3 text-sm text-red-400">
                      {exportStatus.rejectionReason || exportStatus.errorMessage || t('export_embed', 'error_export_failed')}
                    </div>
                  )}
                </div>
              )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowExportModal(false);
                        setExportStatus(null);
                      }}
                      disabled={isExporting}
                      className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors disabled:opacity-50"
                    >
                      {t('common', 'cancel')}
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={isExporting || !mapRef.current}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t('export_embed', 'status_processing')}
                        </>
                      ) : (
                        lang === 'vi' ? 'Xuất' : 'Export'
                      )}
                    </button>
                  </div>
                </>
              ) : !loading && detail?.isStoryMap !== true ? (
                <EmbedCodeGenerator
                  mapId={mapId}
                  mapName={detail?.name || "Untitled Map"}
                  status={detail?.status || undefined}
                  isStoryMap={detail?.isStoryMap ?? false}
                  onMapUpdated={async () => {
                    // Reload map detail after preparing for embed
                    try {
                      const updatedDetail = await getMapDetail(mapId);
                      setDetail(updatedDetail);
                      setMapStatus(updatedDetail.status as MapStatus);
                    } catch (error) {
                      console.error("Failed to reload map detail:", error);
                    }
                  }}
                />
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Story maps không thể được embed. Chỉ có map bình thường mới có thể embed.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-top.leaflet-left .leaflet-control { display: none !important; }
        
        /* Other user selection markers */
        .other-user-selection-marker {
          background: transparent !important;
          border: none !important;
        }
        
        /* Hide Geoman tooltips and help text */
        .leaflet-pm-tooltip,
        .leaflet-pm-help,
        .leaflet-pm-hint,
        .leaflet-pm-cursor-marker,
        .leaflet-pm-cursor-marker-text {
          display: none !important;
        }
        
        /* Hide Geoman help text */
        .leaflet-pm-help-text,
        .leaflet-pm-tooltip-text {
          display: none !important;
        }
        
        /* Thêm các class mới để target tooltip vẽ/edit cụ thể */
        .leaflet-pm-draw-tooltip,
        .leaflet-pm-vertex-tooltip,
        .leaflet-pm-snapping-tooltip,
        .leaflet-pm-edit-tooltip,
        .leaflet-pm-drag-tooltip,
        .leaflet-pm-rotate-tooltip,
        .leaflet-pm-cut-tooltip {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* Đảm bảo không hiển thị text động */
        [class*="leaflet-pm-tooltip"]::after,
        [class*="leaflet-pm-tooltip"]::before,
        [class*="leaflet-pm-hint"] * {
          display: none !important;
        }

        /* Force crosshair cursor khi draw mode active */
        .leaflet-pm-draw-mode-enabled {
          cursor: crosshair !important;
        }

        /* Tắt hiển thị bất kỳ marker tạm nào trong draw mode */
        .leaflet-pm-cursor-marker .leaflet-marker-icon,
        .leaflet-pm-cursor-marker .leaflet-marker-shadow {
          display: none !important;
        }
        
        /* Hide default Leaflet marker icons */
        .leaflet-marker-icon {
          background: none !important;
          border: none !important;
        }
        
        /* Custom marker style */
        .custom-marker-icon {
          background: none !important;
          border: none !important;
        }
        
        /* Custom default marker style */
        .custom-default-marker {
          background: none !important;
          border: none !important;
        }
        
        /* Đảm bảo tất cả marker đều dùng custom icon */
        .leaflet-marker-icon {
          background: none !important;
          border: none !important;
        }
        
        /* Override any default marker styles */
        .leaflet-marker-icon[src*="marker-icon"],
        .leaflet-marker-icon[src*="marker-shadow"] {
          display: none !important;
        }
        
        /* Custom marker icon styles for consistency - Optimized for performance */
        .custom-marker-icon,
        .custom-default-marker {
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
          /* Disable transitions for better performance when many markers */
          will-change: transform;
          transform: translateZ(0); /* Force hardware acceleration */
          backface-visibility: hidden; /* Reduce repaints */
        }
        
        .custom-marker-icon:hover,
        .custom-default-marker:hover {
          transform: translateZ(0) scale(1.1);
        }

        /* Optimize icon rendering - reduce repaints */
        .leaflet-marker-icon {
          pointer-events: auto;
          will-change: transform;
          transform: translateZ(0);
        }

        /* Disable icon animations during zoom for performance */
        .leaflet-zoom-anim .leaflet-marker-icon {
          transition: none !important;
        }
      `}</style>

      {/* Zone Style Editor Panel */}
      {selectedZone && (
        <ZoneStyleEditor
          mapId={mapId}
          mapZone={selectedZone.mapZone}
          zone={selectedZone.zone}
          onClose={() => setSelectedZone(null)}
        />
      )}

      {/* Location Info Panel - right-side panel */}
      {poiTooltipModal.isOpen && poiTooltipModal.locationId && (
        <LocationInfoPanel
          locationId={poiTooltipModal.locationId}
          title={poiTooltipModal.title || ''}
          subtitle={poiTooltipModal.subtitle}
          content={poiTooltipModal.content}
          isOpen={poiTooltipModal.isOpen}
          onClose={() => setPoiTooltipModal({ isOpen: false })}
        />
      )}
    </main>
  );
}