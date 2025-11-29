"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple, FeatureGroup } from "leaflet";
import type L from "leaflet";
import { debounce, rafThrottle, BatchUpdater } from "@/utils/performance";
import { type FeatureData, extractLayerStyle, applyLayerStyle, handleLayerVisibilityChange, handleFeatureVisibilityChange, getFeatureType as getFeatureTypeUtil, updateFeatureInDB, deleteFeatureFromDB, loadFeaturesToMap, loadLayerToMap, type ExtendedLayer, saveFeature,} from "@/utils/mapUtils";
import {  getFeatureName,  getFeatureBounds,  formatCoordinates,  copyToClipboard,  findFeatureIndex,  removeFeatureFromGeoJSON} from "@/utils/zoneOperations";
import * as mapHelpers from "@/utils/mapHelpers";

import type { BaseKey, Layer, LeafletMouseEvent, LeafletMapClickEvent, MapWithPM, PMCreateEvent, LayerStyle, PathLayer, LocationType, GeomanLayer} from "@/types";

interface CircleLayer extends Layer {
  setRadius(radius: number): void;
}
import { getSegments, reorderSegments, type Segment, type TimelineTransition, getTimelineTransitions, getRouteAnimationsBySegment, updateSegment, createSegment, deleteSegment, createTimelineTransition, deleteTimelineTransition, type Location } from "@/lib/api-storymap";
import { getMapDetail, type MapDetail, updateMap, type UpdateMapRequest, type UpdateMapFeatureRequest, uploadGeoJsonToMap, updateLayerData, MapStatus, updateMapFeature, LayerDTO, getMapFeatureById, type BaseLayer} from "@/lib/api-maps";
import { createMapLocation, deleteLocation, getMapLocations } from "@/lib/api-location";

import { MapControls } from "@/components/map";
import { LeftSidebarToolbox, TimelineWorkspace, PropertiesPanel, DrawingToolsBar, ActiveUsersIndicator } from "@/components/map-editor-ui";
import PublishButton from "@/components/map-editor/PublishButton";
import ZoneContextMenu from "@/components/map/ZoneContextMenu";
import { CopyFeatureDialog } from "@/components/features";
import SequentialRoutePlaybackWrapper from "@/components/storymap/SequentialRoutePlaybackWrapper";

import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { useMapCollaboration, type MapSelection } from "@/hooks/useMapCollaboration";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import { useLayerStyles } from "@/hooks/useLayerStyles";
import { useCollaborationVisualization } from "@/hooks/useCollaborationVisualization";
import { useFeatureManagement } from "@/hooks/useFeatureManagement";
import { usePoiMarkers } from "@/hooks/usePoiMarkers";
import type { FeatureCollection, Feature as GeoJSONFeature, Position } from "geojson";
import { SaveIcon, UploadIcon } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { FullScreenLoading } from "@/components/common/FullScreenLoading";


const normalizeMapStatus = (status: unknown): MapStatus => {
  if (typeof status === "string") {
    const normalized = status.toLowerCase();
    if (normalized === "published") return "Published";
    if (normalized === "archived") return "Archived";
    if (normalized === "draft") return "Draft";
  }
  if (status === 1) return "Published";
  if (status === 2) return "Archived";
  return "Draft";
};

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
  const [mapStatus, setMapStatus] = useState<MapStatus>("Draft");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { showToast } = useToast();

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
  const [leftSidebarView, setLeftSidebarView] = useState<"explorer" | "segments" | "transitions" | "icons" | null>("explorer");
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "feature" | "layer" | "segment";
    data: FeatureData | LayerDTO | Segment;
  } | null>(null);

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number>(10);

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
    // NOTE: resetAllSelections from hook is not used - we have a custom implementation below
    // resetAllSelections,
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
    handlePolygonCut,
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

  // Use POI markers hook for POI rendering and lifecycle management
  const { poiMarkersRef } = usePoiMarkers({
    mapId,
    mapRef,
    isMapReady,
    setPoiTooltipModal,
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

  const visibilityBatchUpdater = useMemo(
    () => new BatchUpdater<boolean>((updates) => {
      const newVisibility: Record<string, boolean> = {};
      updates.forEach((value, key) => {
        newVisibility[key] = value;
      });
      setFeatureVisibility(prev => ({ ...prev, ...newVisibility }));
    }, 16),
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
        setMapStatus(normalizeMapStatus(m.status));
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

    window.addEventListener("layerCreated", handleLayerCreated);
    return () => {
      window.removeEventListener("layerCreated", handleLayerCreated);
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
  }, [isMapReady, handleFeatureCreate, handleSketchEdit, handleSketchDragEnd, handleSketchRotateEnd, handlePolygonCut]);

  useEffect(() => {
    if (!mapRef.current || !detail?.layers || detail.layers.length === 0 || !isMapReady) return;
    const map = mapRef.current;

    let alive = true;

    (async () => {
      setLayers((detail.layers));

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

      // Sort segments by displayOrder to ensure correct order after reorder
      const sortedSegments = segmentsWithRoutes.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        // Fallback to createdAt if displayOrder is the same
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

      setSegments(sortedSegments);
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

    const iconLabelMap: Record<string, string> = {
      plane: "Plane", car: "Car", bus: "Bus", train: "Train", ship: "Ship", bike: "Bike", walk: "Walk", route: "Route", from: "From", to: "To",
      home: "Home", office: "Office", school: "School", hospital: "Hospital", restaurant: "Food", coffee: "Coffee", shop: "Shop", park: "Park", museum: "Museum", hotel: "Hotel",
      person: "Person", group: "Group", info: "Info", warning: "Warning", danger: "Danger", star: "Highlight", photo: "Photo spot", camera: "Camera", note: "Note", chat: "Comment",
      gold: "Gold", silver: "Silver", coal: "Coal", oil: "Oil", gas: "Natural Gas", iron: "Iron", copper: "Copper", diamond: "Diamond", stone: "Stone", mining: "Mining",
      factory: "Factory", "power-plant": "Power Plant", refinery: "Refinery", warehouse: "Warehouse", construction: "Construction", shipyard: "Shipyard", airport: "Airport", port: "Port", textile: "Textile", agriculture: "Agriculture",
      mountain: "Mountain", river: "River", lake: "Lake", forest: "Forest", desert: "Desert", volcano: "Volcano", island: "Island", beach: "Beach", castle: "Castle", temple: "Temple", monument: "Monument", tomb: "Tomb", ruin: "Ruin", battlefield: "Battlefield", "ancient-city": "Ancient City",
    };
    const iconEmojiMap: Record<string, string> = {
      plane: "✈️",
      car: "🚗",
      bus: "🚌",
      train: "🚆",
      ship: "🚢",
      bike: "🚲",
      walk: "🚶",
      route: "📍",
      from: "🅰️",
      to: "🅱️",
      home: "🏠",
      office: "🏢",
      school: "🏫",
      hospital: "🏥",
      restaurant: "🍽️",
      coffee: "☕",
      shop: "🛒",
      park: "🌳",
      museum: "🏛️",
      hotel: "🏨",
      person: "👤",
      group: "👥",
      info: "ℹ️",
      warning: "⚠️",
      danger: "❗",
      star: "⭐",
      photo: "📷",
      camera: "📸",
      note: "📝",
      chat: "💬",
      gold: "🥇",
      silver: "🥈",
      coal: "🪨",
      oil: "🛢️",
      gas: "⛽",
      iron: "⚙️",
      copper: "🟧",
      diamond: "💎",
      stone: "🪨",
      mining: "⛏️",
      factory: "🏭",
      "power-plant": "🔌",
      refinery: "🏭",
      warehouse: "📦",
      construction: "🏗️",
      shipyard: "🏗️",
      airport: "🛫",
      port: "⚓",
      textile: "🧵",
      agriculture: "🌾",
      mountain: "⛰️",
      river: "🌊",
      lake: "💧",
      forest: "🌲",
      desert: "🏜️",
      volcano: "🌋",
      island: "🏝️",
      beach: "🏖️",
      castle: "🏰",
      temple: "🛕",
      monument: "🗿",
      tomb: "🪦",
      ruin: "🏚️",
      battlefield: "⚔️",
      "ancient-city": "🏛️",
    };

    const labelToIconKeyMap: Record<string, string> = {};
    Object.entries(iconLabelMap).forEach(([key, label]) => {
      if (!labelToIconKeyMap[label]) {
        labelToIconKeyMap[label] = key;
      }
    });

    const parseIconKeyFromStoryContent = (storyContent?: string | null) => {
      if (!storyContent) return null;
      try {
        const parsed = JSON.parse(storyContent);
        if (parsed && typeof parsed === "object" && typeof parsed.iconKey === "string") {
          return parsed.iconKey;
        }
      } catch (parseErr) {
        console.warn("[Icon] Failed to parse icon metadata from storyContent:", parseErr);
      }
      return null;
    };

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
              iconType: currentIconKey,
              displayOrder: 0,
              isVisible: true,
              highlightOnEnter: false,
              showTooltip: false,
              openPopupOnClick: false,
              storyContent: JSON.stringify({
                source: "iconPlacement",
                iconKey: currentIconKey,
                iconLabel,
              }),
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


    const loadExistingIcons = async () => {
      if (!mapRef.current || !mapIdRef.current || !isMapReady) return;

      try {
        const locations = await getMapLocations(mapIdRef.current);

        if (!locations || locations.length === 0) return;

        const L = (await import("leaflet")).default;

        if (!iconLayerGroupRef.current) {
          iconLayerGroupRef.current = L.layerGroup().addTo(mapRef.current);
        }

        const existingLocationIds = new Set<string>();
        iconMarkersRef.current.forEach((marker, id) => {
          const locationId = (marker as any)._locationId || id.replace('icon-', '');
          if (locationId) {
            existingLocationIds.add(locationId);
          }
        });

        const iconLocations = locations.filter(
          (loc) =>
            loc.markerGeometry &&
            loc.isVisible !== false &&
            loc.locationId &&
            !existingLocationIds.has(loc.locationId)
        );

        for (const location of iconLocations) {
          try {
            const iconKeyFromMetadata = parseIconKeyFromStoryContent(location.storyContent);
            const labelKey = location.title ?? "";
            const iconKey =
              iconKeyFromMetadata ||
              location.iconType ||
              labelToIconKeyMap[labelKey] ||
              null;

            if (!iconKey) {
              continue;
            }

            const geoJson = JSON.parse(location.markerGeometry);
            if (geoJson.type !== "Point" || !geoJson.coordinates) continue;

            const [lng, lat] = geoJson.coordinates;

            const emoji = iconEmojiMap[iconKey as keyof typeof iconEmojiMap] ?? "📍";

            const iconCacheKey = `icon-${iconKey}`;
            if (!(mapRef.current as any)._iconCache) {
              (mapRef.current as any)._iconCache = new Map<string, L.DivIcon>();
            }

            let icon: L.DivIcon;
            if ((mapRef.current as any)._iconCache.has(iconCacheKey)) {
              icon = (mapRef.current as any)._iconCache.get(iconCacheKey);
            } else {
              icon = L.divIcon({
                className: `custom-marker-icon icon-marker icon-${iconKey}`,
                html: `<div style="font-size:24px; line-height:24px;">${emoji}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              });
              (mapRef.current as any)._iconCache.set(iconCacheKey, icon);
            }

            // Create marker
            const marker = L.marker([lat, lng], {
              icon,
              draggable: true,
              pane: "markerPane",
              zIndexOffset: 0,
              keyboard: false,
              riseOnHover: false,
              autoPan: false,
            });

            // Store marker ID using locationId from API
            const markerId = `icon-${location.locationId}`;
            iconMarkersRef.current.set(markerId, marker);
            iconMetadataRef.current.set(markerId, {
              lat,
              lng,
              iconKey,
              timestamp: Date.now() - 10000, // Mark as existing (not recently added)
            });

            // Store locationId on marker for deletion
            (marker as any)._locationId = location.locationId;

            // Add drag handlers
            let dragTimeout: NodeJS.Timeout | null = null;
            marker.on("drag", () => {
              if (dragTimeout) return;
              dragTimeout = setTimeout(() => {
                dragTimeout = null;
              }, 16);
            });

            marker.on("dragend", () => {
              const latlng = marker.getLatLng();
              iconMetadataRef.current.set(markerId, {
                lat: latlng.lat,
                lng: latlng.lng,
                iconKey,
                timestamp: Date.now(),
              });
            });

            // Add context menu for deletion
            marker.on("contextmenu", (event: any) => {
              if (event.originalEvent) {
                event.originalEvent.preventDefault();
                event.originalEvent.stopPropagation();
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
                  btn.addEventListener("click", async () => {
                    await deleteLocation(location.locationId);
                    iconMarkersRef.current.delete(markerId);
                    iconMetadataRef.current.delete(markerId);

                    if (iconLayerGroupRef.current?.hasLayer(marker)) {
                      iconLayerGroupRef.current.removeLayer(marker);
                    }
                    if (mapRef.current?.hasLayer(marker)) {
                      mapRef.current.removeLayer(marker);
                    }
                    mapRef.current?.closePopup();
                  });
                }
              }, 0);
            });

            // Add to layer group
            iconLayerGroupRef.current.addLayer(marker);
          } catch (err) {
            console.error(`[Icon] Failed to load icon for location ${location.locationId}:`, err);
          }
        }

        // Update icon visibility after loading
        if (mapRef.current) {
          updateIconVisibility(mapRef.current);
        }
      } catch (err) {
        console.error("[Icon] Failed to load existing icons:", err);
      }
    };

    // Load existing icons when map is ready
    if (isMapReady && mapIdRef.current) {
      loadExistingIcons();
    }

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

      // Apply selection style
      (leafletLayer as any).setStyle({
        color: '#ff6600',
        weight: 4,
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

      // Reload segments and sort by displayOrder
      const updatedSegments = await getSegments(mapId);
      const sortedSegments = updatedSegments.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      setSegments(sortedSegments);
    } catch (error) {
      showToast("error", "Failed to save segment");
    }
  }, [mapId, showToast]);

  // Delete segment
  const handleDeleteSegment = useCallback(async (segmentId: string) => {
    if (!mapId) return;

    try {
      await deleteSegment(mapId, segmentId);
      showToast("success", "Segment deleted successfully");

      // Reload segments and sort by displayOrder
      const updatedSegments = await getSegments(mapId);
      const sortedSegments = updatedSegments.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      setSegments(sortedSegments);
    } catch (error) {
      showToast("error", "Failed to delete segment");
    }
  }, [mapId, showToast]);

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
        // Sort newOrder by displayOrder to ensure consistency
        const sortedNewOrder = [...newOrder].sort((a, b) => {
          if (a.displayOrder !== b.displayOrder) {
            return a.displayOrder - b.displayOrder;
          }
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });
        setSegments(sortedNewOrder);
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

  const handleSkipForward = useCallback((seconds: number) => {
    const totalDuration = segments.reduce((sum, seg) => sum + seg.durationMs, 0) / 1000;
    setCurrentPlaybackTime((prev) => Math.min(totalDuration, prev + seconds));
  }, [segments]);

  const handleSkipBackward = useCallback((seconds: number) => {
    setCurrentPlaybackTime((prev) => Math.max(0, prev - seconds));
  }, []);

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

    // Calculate base time from completed segments
    let baseTime = 0;
    for (let i = 0; i < currentPlayback.currentPlayIndex && i < currentSegments.length; i++) {
      baseTime += currentSegments[i].durationMs / 1000;
    }

    // Only set initial time when segment changes (not on every render)
    if (lastSegmentIndexRef.current !== currentPlayback.currentPlayIndex) {
    setCurrentPlaybackTime(baseTime);
      lastSetTimeRef.current = baseTime;
      lastSegmentIndexRef.current = currentPlayback.currentPlayIndex;
    }

    // Start smooth time progression using requestAnimationFrame for better performance
    const startTime = Date.now();
    const currentSegmentDuration = currentSegments[currentPlayback.currentPlayIndex]?.durationMs || 0;
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

  const onUpdateLayer = useCallback(async (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => {
    if (!detail || !mapRef.current) return;
  }, [detail]);

  const onUpdateFeature = useCallback(async (featureId: string, updates: UpdateMapFeatureRequest) => {
    if (!detail) return;

    try {
      await updateMapFeature(detail.id, featureId, updates);

      // Update local state
      setFeatures(prev => prev.map(f =>
        f.featureId === featureId
          ? { ...f, name: updates.name || f.name }
          : f
      ));
    } catch (error) {
    }
  }, [detail]);

  // Apply style visually to layer
  const onApplyStyle = useCallback((layer: Layer, styleOptions: LayerStyle) => {
    if (!layer || !('setStyle' in layer)) return;

    // Apply style
    (layer as unknown as PathLayer).setStyle(styleOptions);

    // Update original style ref
    originalStylesRef.current.set(layer, {
      ...styleOptions
    });
  }, []);

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

  const applyPresetStyleToFeature = useCallback(async (featureId: string, layerType: string, presetName: string) => {
    if (!detail) return;
  }, [detail]);

  const applyCustomStyleToFeature = useCallback(async (featureId: string, styleOptions: {
    color?: string;
    fillColor?: string;
    weight?: number;
    opacity?: number;
    fillOpacity?: number;
    radius?: number;
    dashArray?: string;
  }) => {
    if (!detail) return;
  }, [detail]);

  const applyStyleToLayer = useCallback(async (layerId: string, styleOptions: {
    color?: string;
    fillColor?: string;
    weight?: number;
    opacity?: number;
    fillOpacity?: number;
  }) => {
    if (!detail) return;
  }, [detail]);

  const getCurrentFeatureStyle = useCallback((featureId: string) => {
    const feature = features.find(f => f.id === featureId);
    if (!feature) return {};

    return extractLayerStyle(feature.layer);
  }, [features]);

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
      showToast("error", e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setIsSaving(false);
    }
  }, [detail, name, baseKey, showToast]);


  if (loading) return <FullScreenLoading message="Đang tải..." overlay={false} />;
  if (err || !detail) return <FullScreenLoading message={err ?? "Không tải được bản đồ"} overlay={false} />;

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
                      const newName = editingMapName.trim() || "Untitled Map";
                      if (newName !== name) {
                        try {
                          setIsSaving(true);
                          await updateMap(detail.id, { name: newName });
                          setName(newName);
                          showToast("success", "Đã đổi tên bản đồ");
                        } catch (error) {
                          showToast("error", "Không thể đổi tên bản đồ");
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
                    const newName = editingMapName.trim() || "Untitled Map";
                    if (newName !== name) {
                      try {
                        setIsSaving(true);
                        await updateMap(detail.id, { name: newName });
                        setName(newName);
                        showToast("success", "Đã đổi tên bản đồ");
                      } catch (error) {
                        showToast("error", "Không thể đổi tên bản đồ");
                      } finally {
                        setIsSaving(false);
                      }
                    }
                    setIsEditingMapName(false);
                    setEditingMapName("");
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-white text-black text-sm font-medium w-52 border-2 border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Untitled Map"
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
                  title="Double click để đổi tên"
                >
                  {name || "Untitled Map"}
                </span>
              )}
            </div>
            <DrawingToolsBar mapRef={mapRef} />
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
                        showToast("info", "Đang tải file lên...");

                        // Backend tự động tạo layer mới, chỉ cần truyền mapId
                        const result = await uploadGeoJsonToMap(mapId, file);

                        showToast("info", "Đang load dữ liệu...");

                        // Refresh toàn bộ map detail để lấy layer mới
                        const updatedDetail = await getMapDetail(mapId);
                        setDetail(updatedDetail);

                        showToast("success", `Tải lên thành công! Đã thêm ${result.featuresAdded} đối tượng vào layer "${result.layerId}".`);

                        // Clear the input
                        e.target.value = '';
                      } catch (error) {
                        console.error("Upload error:", error);
                        showToast("error", error instanceof Error ? error.message : "Tải file thất bại");
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
                  title="Upload GeoJSON/KML/GPX file to add as layer"
                >
                  <UploadIcon className="w-4 h-4" />
                  Upload
                </label>
                
                <div className="h-5 w-px bg-zinc-600/50" />
                
                <button
                  className="rounded-md px-3 py-1.5 text-xs font-medium bg-transparent hover:bg-zinc-700/50 text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  onClick={saveMap}
                  disabled={isSaving || !mapRef.current}
                  title="Lưu thông tin bản đồ và vị trí hiển thị"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
                
                <div className="h-5 w-px bg-zinc-600/50" />
                
                <PublishButton mapId={mapId} status={mapStatus} onStatusChange={setMapStatus} />
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
          left: leftSidebarView ? "376px" : "56px", // Icon bar (56px) + panel (320px) when open
          right: isPropertiesPanelOpen ? "360px" : "0",
          // top: "60px",
          bottom: "200px", // Space for timeline workspace
        }}
      />

      {/* NEW: VSCode-style Left Sidebar */}
      <LeftSidebarToolbox
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

      {/* NEW: Right Properties Panel */}
      <PropertiesPanel
        isOpen={isPropertiesPanelOpen}
        selectedItem={selectedEntity}
        onClose={() => setIsPropertiesPanelOpen(false)}
        onUpdate={handleUpdateFeature}
      />

      {/* NEW: Bottom Timeline Workspace */}
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
        // onSkipForward={handleSkipForward}
        // onSkipBackward={handleSkipBackward}
        onSegmentClick={handleSegmentClick}
        onRefreshSegments={async () => {
          try {
            // Reload segments with enhanced details (includes locations, routes, zones, layers)
            const [segmentsData, transitionsData] = await Promise.all([
              getSegments(mapId),
              getTimelineTransitions(mapId),
            ]);

            // Load route animations for each segment (GetSegmentsAsync doesn't include routes)
            const segmentsWithRoutes = await Promise.all(
              segmentsData.map(async (segment) => {
                try {
                  // Fetch route animations for this segment
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

            // Sort segments by displayOrder to ensure correct order
            const sortedSegments = segmentsWithRoutes.sort((a, b) => {
              if (a.displayOrder !== b.displayOrder) {
                return a.displayOrder - b.displayOrder;
              }
              return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            });

            // Force new array reference to ensure React re-renders
            setSegments([...sortedSegments]);
            setTransitions([...transitionsData]);
          } catch (error) {
            console.error("Failed to refresh segments:", error);
          }
        }}
      />

      <MapControls
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