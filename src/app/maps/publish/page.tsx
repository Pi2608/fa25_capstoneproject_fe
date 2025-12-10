"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple, FeatureGroup } from "leaflet";
import type L from "leaflet";
import { debounce, rafThrottle, BatchUpdater } from "@/utils/performance";
import { type FeatureData, extractLayerStyle, applyLayerStyle, handleLayerVisibilityChange, handleFeatureVisibilityChange, getFeatureType as getFeatureTypeUtil, updateFeatureInDB, deleteFeatureFromDB, loadFeaturesToMap, loadLayerToMap, type ExtendedLayer, saveFeature, } from "@/utils/mapUtils";
import * as mapHelpers from "@/utils/mapHelpers";

import type { BaseKey, Layer, LeafletMouseEvent, LeafletMapClickEvent, MapWithPM, PMCreateEvent, LayerStyle, PathLayer, LocationType, GeomanLayer } from "@/types";

interface CircleLayer extends Layer {
  setRadius(radius: number): void;
}
import { getSegments, reorderSegments, type Segment, type TimelineTransition, getTimelineTransitions, getRouteAnimationsBySegment, updateSegment, createSegment, deleteSegment, createTimelineTransition, deleteTimelineTransition, type Location } from "@/lib/api-storymap";
import { getMapDetail, type MapDetail, updateMap, type UpdateMapRequest, type UpdateMapFeatureRequest, uploadGeoJsonToMap, updateLayerData, MapStatus, updateMapFeature, LayerDTO, getMapFeatureById, type BaseLayer, createExport, getExportById, type ExportRequest, type ExportResponse } from "@/lib/api-maps";
import { createMapLocation, deleteLocation, getMapLocations } from "@/lib/api-location";


import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { iconEmojiMap, iconLabelMap, labelToIconKeyMap } from "@/constants/icons";
import { useMapCollaboration, type MapSelection } from "@/hooks/useMapCollaboration";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import { useLayerStyles } from "@/hooks/useLayerStyles";
import { useCollaborationVisualization } from "@/hooks/useCollaborationVisualization";
import { useFeatureManagement } from "@/hooks/useFeatureManagement";
import { usePoiMarkers } from "@/hooks/usePoiMarkers";
import { useZoneMarkers } from "@/hooks/useZoneMarkers";
import type { FeatureCollection, Feature as GeoJSONFeature, Position } from "geojson";
import { SaveIcon, UploadIcon, DownloadIcon, AlertTriangle } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import html2canvas from "html2canvas";
import { useI18n } from "@/i18n/I18nProvider";
import PublishButton from "@/components/map/PublishButton";
import ZoomControls from "@/components/map/controls/ZoomControls";
import { ZoneStyleEditor } from "@/components/map-editor-ui/ZoneStyleEditor";
import EmbedCodeGenerator from "@/components/map/EmbedCodeGenerator";
import ReportViolationDialog from "@/components/map/ReportViolationDialog";


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
  const mapId = params?.mapId ?? sp?.get("mapId") ?? "";
  const isViewMode = sp?.get("view") === "true";

  const [isMapReady, setIsMapReady] = useState(false);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("draft");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { showToast } = useToast();
  const { t, lang } = useI18n();

  // Export functionality state
  const [exportStatus, setExportStatus] = useState<ExportResponse | null>(null);

  // Report violation state
  const [showReportDialog, setShowReportDialog] = useState<boolean>(false);

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
    title?: string;
    content?: string;
    x?: number;
    y?: number;
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

  // Handle layer click (single or multi-select)
  const handleLayerClick = useCallback((layer: Layer, isShiftKey: boolean) => {
    if (isViewMode) return;
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


  // Use feature management hook for Geoman event handling (only in edit mode)
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
    handlePolygonCut,
  } = isViewMode ? {
    lastUpdateRef: { current: new Map() },
    recentlyCreatedFeatureIdsRef: { current: new Set() },
    handleFeatureCreate: async () => { },
    handleSketchEdit: async () => { },
    handleSketchDragEnd: async () => { },
    handleSketchRotateEnd: async () => { },
    handlePolygonCut: async () => { },
  } : featureManagement;

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

        if (isViewMode) {
          // View mode: Only render features, no edit handlers
          dbFeatures.forEach(feature => {
            if (feature.layer) {
              // Just add to map, no event handlers
            }
          });
        } else {
          // Edit mode: Attach all edit handlers
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
        }

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
  }, [detail?.id, isMapReady, isViewMode, storeOriginalStyle, handleLayerHover, handleLayerClick, resetToOriginalStyle]);

  useEffect(() => {
    handleMapDataChangedRef.current = handleMapDataChanged;
  }, [handleMapDataChanged]);

  const handleFeatureUpdated = useCallback(async (featureId: string) => {
    if (isViewMode) return;
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
    if (isViewMode) return;
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
      if ('pm' in layer && (layer as GeomanLayer).pm && !isViewMode) {
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
  }, [detail?.id, isMapReady, isViewMode, features, storeOriginalStyle, handleLayerHover, handleLayerClick, resetToOriginalStyle, applyLayerStyle]);

  const handleFeatureDeleted = useCallback((featureId: string) => {
    if (isViewMode) return;
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
  }, [features, isViewMode]);

  const collaboration = useMapCollaboration({
    mapId: mapId || null,
    enabled: isMapReady && !!mapId && !isViewMode,
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
        setErr(e instanceof Error ? e.message : "Không tải được bản đồ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mapId]);

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
      if (map.pm && !isViewMode) {
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

        if (isViewMode) {
          // View mode: Only render features, no event handlers
          dbFeatures.forEach(feature => {
            if (feature.layer) {
              // Just render, no handlers
            }
          });
        } else {
          // Edit mode: Attach all event listeners
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
        }

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
  }, [detail?.id, isMapReady, isViewMode]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !sketchRef.current) return;
    if (isViewMode) return;
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
    map.on("pm:cut", handlePolygonCut);

    // Handle sketch-level edit/drag/rotate events
    sketch.on("pm:edit", handleSketchEdit);
    sketch.on("pm:dragend", handleSketchDragEnd);
    sketch.on("pm:rotateend", handleSketchRotateEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("pm:create", createHandler);
        mapRef.current.off("pm:cut", handlePolygonCut);
      }
      if (sketchRef.current) {
        sketchRef.current.off("pm:edit", handleSketchEdit);
        sketchRef.current.off("pm:dragend", handleSketchDragEnd);
        sketchRef.current.off("pm:rotateend", handleSketchRotateEnd);
      }
    };
  }, [isMapReady, isViewMode, handleFeatureCreate, handleSketchEdit, handleSketchDragEnd, handleSketchRotateEnd, handlePolygonCut]);

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

  // Load segments and transitions for timeline
  const loadSegmentsAndTransitions = useCallback(async () => {
    if (!mapId) return;

    try {
      const [segmentsData, transitionsData] = await Promise.all([
        getSegments(mapId),
        getTimelineTransitions(mapId),
      ]);

      // Fetch route animations for each segment
      const segmentsWithRoutes = await Promise.all(
        segmentsData.map(async (segment) => {
          try {
            const routes = await getRouteAnimationsBySegment(mapId, segment.segmentId);
            return {
              ...segment,
              routeAnimations: routes || []
            };
          } catch (e) {
            return segment;
          }
        })
      );

      setSegments(segmentsWithRoutes);
      setTransitions(transitionsData);
    } catch (error) {
      console.error("Failed to load segments/transitions:", error);
    }
  }, [mapId]);


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
      if (isViewMode) return;
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

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">

      {/* Map Canvas - Adjusted for VSCode-style UI panels */}
      <div
        ref={mapEl}
        className="absolute inset-0 transition-all duration-300"
        style={{
          left: (mapStatus === "archived" || isViewMode) ? "0" : (leftSidebarView ? "376px" : "56px"), // Hide sidebar when Archived or in View Mode
          right: (isViewMode ? "0" : (isPropertiesPanelOpen ? "360px" : "0")),
          // top: "60px",
          bottom: (!loading && detail?.isStoryMap !== false && mapStatus !== "archived" && !isViewMode) ? "200px" : "0", // Hide timeline when Archived or in View Mode
        }}
      />

      <ZoomControls
        zoomIn={handleZoomIn}
        zoomOut={handleZoomOut}
        isTimelineOpen={isTimelineOpen}
        currentZoom={currentZoom}
      />


      {/* Report Violation Dialog - Show for public maps */}
      {detail?.status === "published" && (
        <ReportViolationDialog
          mapId={mapId}
          mapName={detail?.name || "Untitled Map"}
          isOpen={showReportDialog}
          onClose={() => setShowReportDialog(false)}
        />
      )}

      {detail?.status === "published" && (
        <div className="fixed top-6 right-6 z-[1700] pointer-events-auto" style={{ zIndex: 1700 }}>
          <button
            onClick={() => {
              setShowReportDialog(true);
            }}
            className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 pointer-events-auto"
            title="Báo cáo vi phạm"
            style={{ zIndex: 1700 }}
          >
            <AlertTriangle className="w-6 h-6" strokeWidth={2.5} />
          </button>
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

    </main>
  );
}