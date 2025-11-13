"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple, FeatureGroup } from "leaflet";
import type L from "leaflet";
import type {
  BaseKey,
  Layer,
  LeafletMouseEvent,
  LeafletMapClickEvent,
  MapWithPM,
  PMCreateEvent,
  LayerStyle,
  PathLayer,
  LayerWithOptions,
  GeomanLayer,
} from "@/types";
import {
  getMapDetail,
  type MapDetail,
  updateMap,
  type UpdateMapRequest,
  type UpdateMapFeatureRequest,
  uploadGeoJsonToMap,
  updateLayerData,
  MapStatus,
  updateMapFeature,
  LayerDTO,
} from "@/lib/api-maps";
import {
  type FeatureData,
  serializeFeature,
  extractLayerStyle,
  handleLayerVisibilityChange,
  handleFeatureVisibilityChange,
  getFeatureType as getFeatureTypeUtil,
  saveFeature,
  updateFeatureInDB,
  deleteFeatureFromDB,
  loadFeaturesToMap,
  loadLayerToMap,
  type ExtendedLayer,
} from "@/utils/mapUtils";
import {
  getFeatureName,
  getFeatureBounds,
  formatCoordinates,
  copyToClipboard,
  findFeatureIndex,
  removeFeatureFromGeoJSON
} from "@/utils/zoneOperations";
import { StylePanel, DataLayersPanel, MapControls } from "@/components/map";
import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { StoryMapTimeline } from "@/components/storymap";
import { PublishButton } from "@/components/map-editor";
import ZoneContextMenu from "@/components/map/ZoneContextMenu";
import { CopyFeatureDialog } from "@/components/features";
import MapPoiPanel from "@/components/poi/PoiPanel";

import { useToast } from "@/contexts/ToastContext";
import type { FeatureCollection, Feature as GeoJSONFeature } from "geojson";



export default function EditMapPage() {
  const params = useParams<{ mapId: string }>();
  const sp = useSearchParams();
  const mapId = params?.mapId ?? "";

  const [isMapReady, setIsMapReady] = useState(false);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("Draft");

  const [busySaveMeta, setBusySaveMeta] = useState<boolean>(false);
  const [busySaveView, setBusySaveView] = useState<boolean>(false);
  const { showToast } = useToast();

  const [name, setName] = useState<string>("");
  const [baseKey, setBaseKey] = useState<BaseKey>("osm");
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showDataLayersPanel, setShowDataLayersPanel] = useState(true);
  const [showSegmentPanel, setShowSegmentPanel] = useState(false);
  const [showPoiPanel, setShowPoiPanel] = useState(false);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<FeatureData | LayerDTO | null>(null);
  const [layers, setLayers] = useState<LayerDTO[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [featureVisibility, setFeatureVisibility] = useState<Record<string, boolean>>({})

  // New state for multi-selection and hover interaction
  const [currentLayer, setCurrentLayer] = useState<Layer | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<Layer>>(new Set());
  const [hoveredLayer, setHoveredLayer] = useState<Layer | null>(null);

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
  const sketchRef = useRef<FeatureGroup | null>(null);
  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());
  const originalStylesRef = useRef<Map<Layer, LayerStyle>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());


  // Helper: Store original style
  const storeOriginalStyle = useCallback((layer: Layer) => {
    if (originalStylesRef.current.has(layer)) return;

    const style: LayerStyle = {};
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Check if layer has options property at runtime
      const unknownLayer = layer as unknown;
      const hasOptions = (
        unknownLayer !== null &&
        typeof unknownLayer === 'object' &&
        'options' in unknownLayer &&
        typeof (unknownLayer as { options: unknown }).options === 'object'
      );

      if (hasOptions) {
        const layerWithOptions = unknownLayer as LayerWithOptions;
        const options = layerWithOptions.options || {};
        style.color = options.color || '#3388ff';
        style.weight = options.weight || 3;
        style.opacity = options.opacity || 1.0;
        style.fillColor = options.fillColor || options.color || '#3388ff';
        style.fillOpacity = options.fillOpacity || 0.2;
        style.dashArray = options.dashArray || '';
      } else {
        // Default style for layers without options
        style.color = '#3388ff';
        style.weight = 3;
        style.opacity = 1.0;
        style.fillColor = '#3388ff';
        style.fillOpacity = 0.2;
        style.dashArray = '';
      }
    }
    originalStylesRef.current.set(layer, style);
  }, []);

  // Helper: Apply hover highlight
  const applyHoverStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      (layer as unknown as PathLayer).setStyle({
        weight: 5,
        dashArray: '',
        fillOpacity: 0.6
      });

      // Bring to front
      const pathLayer = layer as unknown as PathLayer;
      if ('bringToFront' in layer && pathLayer.bringToFront) {
        pathLayer.bringToFront();
      }
    }
  }, []);

  // Helper: Reset to original style
  const resetToOriginalStyle = useCallback((layer: Layer) => {
    // Skip Markers - they don't use path styles and should keep their icon
    // Check if it's a Marker by checking for the marker-specific methods
    if ('getIcon' in layer && 'setIcon' in layer) {
      // It's a Marker, don't reset style
      return;
    }

    const originalStyle = originalStylesRef.current.get(layer);

    // For PathLayers (Polygon, Line, Circle, etc.)
    if (originalStyle && 'setStyle' in layer && typeof layer.setStyle === 'function') {
      (layer as unknown as PathLayer).setStyle(originalStyle);
    }
  }, []);

  // Helper: Apply selection style
  const applySelectionStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      (layer as unknown as PathLayer).setStyle({
        color: '#ff6600',
        weight: 4,
        fillOpacity: 0.5
      });
    }
  }, []);

  // Helper: Apply multi-selection style
  const applyMultiSelectionStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      (layer as unknown as PathLayer).setStyle({
        color: '#ff0000',
        weight: 4,
        fillOpacity: 0.5
      });
    }
  }, []);

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
      }
    }
  }, [selectedLayers, features, resetToOriginalStyle, applySelectionStyle, applyMultiSelectionStyle]);

  // Handle layer hover
  const handleLayerHover = useCallback((layer: Layer | null, isEntering: boolean) => {
    if (!layer) return;

    if (isEntering) {
      // Don't apply hover style if already selected
      if (!selectedLayers.has(layer)) {
        storeOriginalStyle(layer);
        applyHoverStyle(layer);
      }
      setHoveredLayer(layer);
    } else {
      if (!selectedLayers.has(layer)) {
        resetToOriginalStyle(layer);
      }
      setHoveredLayer(null);
    }
  }, [selectedLayers, storeOriginalStyle, applyHoverStyle, resetToOriginalStyle]);

  const handleLayerDelete = useCallback((layer: Layer) => {
    if (currentLayer === layer) {
      setCurrentLayer(null);
      setSelectedLayer(null);
      setShowStylePanel(false);
    }

    const newSelected = new Set(selectedLayers);
    newSelected.delete(layer);
    setSelectedLayers(newSelected);

    // Clear from refs
    originalStylesRef.current.delete(layer);
  }, [currentLayer, selectedLayers]);

  // Reset all selections (for base layer clicks)
  const resetAllSelections = useCallback(() => {
    selectedLayers.forEach(layer => resetToOriginalStyle(layer));
    setSelectedLayers(new Set());
    setCurrentLayer(null);
    setSelectedLayer(null);
    setShowStylePanel(false);
  }, [selectedLayers, resetToOriginalStyle]);

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
        if (key === "sat") {
          layer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, attribution: "Tiles © Esri" });
        } else if (key === "dark") {
          layer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, attribution: "© OpenStreetMap contributors © CARTO" });
        } else {
          layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap contributors" });
        }
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
  }, []); // Empty deps - only depends on baseKey via useEffect

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
        setBaseKey(m.baseLayer === "Satellite" ? "sat" : m.baseLayer === "Dark" ? "dark" : "osm");
        setMapStatus(m.status || "Draft");
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
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;
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
      if (!alive) return;
      setIsMapReady(true);

      applyBaseLayer(detail.baseLayer === "Satellite" ? "sat" : detail.baseLayer === "Dark" ? "dark" : "osm");

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

      map.on("pm:create", async (e: PMCreateEvent) => {
        const extLayer = e.layer as ExtendedLayer;
        sketch.addLayer(e.layer);

        // Áp dụng custom marker icon cho markers (giờ an toàn hơn)
        if (extLayer instanceof L.Marker && customMarkerIcon) {
          extLayer.setIcon(customMarkerIcon);
        }

        // Store original style
        storeOriginalStyle(e.layer);

        // Attach hover and click event listeners
        e.layer.on('mouseover', () => handleLayerHover(e.layer, true));
        e.layer.on('mouseout', () => handleLayerHover(e.layer, false));
        e.layer.on('click', (event: LeafletMouseEvent) => {
          // Stop propagation to prevent base layer click from firing
          if (event.originalEvent) {
            event.originalEvent.stopPropagation();
          }
          handleLayerClick(e.layer, event.originalEvent.shiftKey);
        });

        const type = getFeatureTypeUtil(extLayer);
        const serialized = serializeFeature(extLayer);
        const { geometryType, coordinates, text, annotationType } = serialized;
        const layerStyle = extractLayerStyle(extLayer);

        const localId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newFeature: FeatureData = {
          id: localId,
          name: `${type} ${features.length + 1}`,
          type,
          layer: extLayer,
          isVisible: true,
        };


        // Save to database
        // Note: saveFeature already handles adding to features state (optimistic update)
        try {
          const savedFeature = await saveFeature(detail.id, "", extLayer, features, setFeatures);

          if (savedFeature) {
            // Attach edit/drag/rotate event listeners for the saved feature
            e.layer.on('pm:edit', async () => {
              if (savedFeature.featureId) {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(savedFeature.featureId, now);

                try {
                  // Reset to original style first to remove selection styling
                  resetToOriginalStyle(e.layer);
                  await updateFeatureInDB(detail.id, savedFeature.featureId, savedFeature);
                } catch (error) {
                  console.error("Error updating feature after edit:", error);
                }
              }
            });

            e.layer.on('pm:dragend', async () => {
              if (savedFeature.featureId) {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(savedFeature.featureId, now);

                try {
                  resetToOriginalStyle(e.layer);
                  await updateFeatureInDB(detail.id, savedFeature.featureId, savedFeature);
                } catch (error) {
                  console.error("Error updating feature after drag:", error);
                }
              }
            });

            e.layer.on('pm:rotateend', async () => {
              if (savedFeature.featureId) {
                const now = Date.now();
                const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                if (now - lastUpdate < 1000) return;
                lastUpdateRef.current.set(savedFeature.featureId, now);

                try {
                  await updateFeatureInDB(detail.id, savedFeature.featureId, savedFeature);
                } catch (error) {
                  console.error("Error updating feature after rotation:", error);
                }
              }
            });

            // Update visibility for the saved feature
            setFeatureVisibility(prev => ({
              ...prev,
              [savedFeature.id]: true,
              ...(savedFeature.featureId ? { [savedFeature.featureId]: true } : {})
            }));
          } else {
            setFeatures(prev => [...prev, newFeature]);
            setFeatureVisibility(prev => ({
              ...prev,
              [newFeature.id]: true
            }));
          }
        } catch (error) {
          console.error("Error saving to database:", error);
          // Only add to features if save failed
          setFeatures(prev => [...prev, newFeature]);
          setFeatureVisibility(prev => ({
            ...prev,
            [newFeature.id]: true
          }));
        }

        // Enable dragging and editing via Geoman
        if ('pm' in e.layer && e.layer.pm) {
          (e.layer as GeomanLayer).pm.enable({
            draggable: true,
            allowEditing: true,
            allowSelfIntersection: true,
          });
        }
      });


      sketch.on("pm:edit", async (e: { layer: Layer; shape: string }) => {
        const extLayer = e.layer as ExtendedLayer;

        const editedFeature = features.find(f => f.layer === extLayer);
        if (editedFeature && editedFeature.featureId) {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(editedFeature.featureId) || 0;
          if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
          lastUpdateRef.current.set(editedFeature.featureId, now);

          try {
            await updateFeatureInDB(detail.id, editedFeature.featureId, editedFeature);

            const serialized = serializeFeature(extLayer);
            const { geometryType, coordinates, text } = serialized;
            const layerStyle = extractLayerStyle(extLayer);

            setFeatures(prev => prev.map(f =>
              f.id === editedFeature.id || f.featureId === editedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            ));
          } catch (error) {
            console.error("Error updating feature:", error);
          }
        }
      });

      sketch.on("pm:dragend", async (e: { layer: Layer; shape: string }) => {
        const extLayer = e.layer as ExtendedLayer;

        const draggedFeature = features.find(f => f.layer === extLayer);
        if (draggedFeature && draggedFeature.featureId) {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(draggedFeature.featureId) || 0;
          if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
          lastUpdateRef.current.set(draggedFeature.featureId, now);

          try {
            await updateFeatureInDB(detail.id, draggedFeature.featureId, draggedFeature);

            setFeatures(prev => prev.map(f =>
              f.id === draggedFeature.id || f.featureId === draggedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            ));
          } catch (error) {
            console.error("Error updating feature after drag:", error);
          }
        }
        resetToOriginalStyle(e.layer);
      });

      sketch.on("pm:rotateend", async (e: { layer: Layer }) => {
        const extLayer = e.layer as ExtendedLayer;

        const rotatedFeature = features.find(f => f.layer === extLayer);
        if (rotatedFeature && rotatedFeature.featureId) {
          const now = Date.now();
          const lastUpdate = lastUpdateRef.current.get(rotatedFeature.featureId) || 0;
          if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
          lastUpdateRef.current.set(rotatedFeature.featureId, now);

          try {
            await updateFeatureInDB(detail.id, rotatedFeature.featureId, rotatedFeature);

            setFeatures(prev => prev.map(f =>
              f.id === rotatedFeature.id || f.featureId === rotatedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            ));
          } catch (error) {
            console.error("Error updating feature after rotation:", error);
          }
        }
      });

    })();
    return () => {
      alive = false;
      mapRef.current?.remove();
      setIsMapReady(false);
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

            // Attach hover and click event listeners
            feature.layer.on('mouseover', () => handleLayerHover(feature.layer, true));
            feature.layer.on('mouseout', () => handleLayerHover(feature.layer, false));
            feature.layer.on('click', (event: LeafletMouseEvent) => {
              // Stop propagation to prevent base layer click from firing
              if (event.originalEvent) {
                event.originalEvent.stopPropagation();
              }
              handleLayerClick(feature.layer, event.originalEvent.shiftKey);
            });

            // Attach edit/drag/rotate event listeners for database updates
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
        const isVisible = layer.isPublic ?? true;
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

  useEffect(() => {
    if (!mapRef.current || !sketchRef.current) return;

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
  }, [featureVisibility, features]);

  useEffect(() => {
    applyBaseLayer(baseKey);
  }, [baseKey, applyBaseLayer]);

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

      // Thay đổi cursor thành crosshair
      const mapContainer = map.getContainer();
      mapContainer.style.cursor = 'crosshair';

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

        // Reset cursor và tắt picking mode
        mapContainer.style.cursor = '';
        isPickingPoi = false;

        if (clickHandler) {
          map.off('click', clickHandler);
          clickHandler = null;
        }
      };

      map.on('click', clickHandler);
    };

    window.addEventListener('poi:startPickLocation', handleStartPickLocation);

    return () => {
      window.removeEventListener('poi:startPickLocation', handleStartPickLocation);
      if (clickHandler && mapRef.current) {
        mapRef.current.off('click', clickHandler);
      }
    };
  }, []);

  // Layer feature click handler for highlighting
  useEffect(() => {
    const handleLayerFeatureClick = (e: CustomEvent) => {
      const { leafletLayer } = e.detail;

      if (!leafletLayer || !('setStyle' in leafletLayer)) return;

      // Store original style if not already stored
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

  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") => {
    // Map Geoman shapes to GeometryTypeEnum:
    // Marker/CircleMarker -> Point (GeometryTypeEnum.Point = 0)
    // Line -> LineString (GeometryTypeEnum.LineString = 1)
    // Polygon -> Polygon (GeometryTypeEnum.Polygon = 2)
    // Circle (large) -> Circle (GeometryTypeEnum.Circle = 3)
    // Rectangle -> Rectangle (GeometryTypeEnum.Rectangle = 4)
    mapRef.current?.pm.enableDraw(shape);
  };
  const toggleEdit = () => mapRef.current?.pm.toggleGlobalEditMode();
  const toggleDelete = () => mapRef.current?.pm.toggleGlobalRemovalMode();
  const toggleDrag = () => mapRef.current?.pm.toggleGlobalDragMode();
  const enableCutPolygon = () => mapRef.current?.pm.enableGlobalCutMode();
  const toggleRotate = () => mapRef.current?.pm?.toggleGlobalRotateMode?.();

  // Map control functions
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  // Context menu handlers
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

  const handleCopyToExistingLayer = useCallback(() => {
    openCopyFeatureDialog("existing");
  }, [openCopyFeatureDialog]);

  const handleCopyToNewLayer = useCallback(() => {
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

  const clearSketch = useCallback(async () => {
    if (!detail) return;

    // Delete all features from database
    for (const feature of features) {
      if (feature.featureId) {
        try {
          await deleteFeatureFromDB(detail.id, feature.featureId);
        } catch (error) {
          console.error("Error deleting from DB:", error);
        }
      }
    }

    sketchRef.current?.clearLayers();
    setFeatures([]);
    setFeatureVisibility({});
  }, [detail, features]);

  const onLayerVisibilityChange = useCallback(async (layerId: string, isVisible: boolean) => {
    if (!detail?.id || !mapRef.current) return;

    const layerData = layers.find(l => l.id === layerId);

    await handleLayerVisibilityChange(
      detail.id,
      layerId,
      isVisible,
      mapRef.current as any,
      dataLayerRefs,
      setLayerVisibility,
      layerData
    );
  }, [detail?.id, layers]);

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
  }, []);

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
        console.error("Error deleting from database:", error);
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

  const saveMeta = useCallback(async () => {
    if (!detail) return;
    setBusySaveMeta(true);
    try {
      const body: UpdateMapRequest = {
        name: (name ?? "").trim() || "Untitled Map",
        baseLayer: baseKey === "osm" ? "OSM" : baseKey === "sat" ? "Satellite" : "Dark",
      };
      await updateMap(detail.id, body);
      showToast("success", "Đã lưu thông tin bản đồ.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveMeta(false);
    }
  }, [detail, name, baseKey, showToast]);

  const saveView = useCallback(async () => {
    if (!detail || !mapRef.current) {
      console.warn("saveView: detail or mapRef.current is null");
      return;
    }
    const map = mapRef.current;
    if (!map) {
      console.warn("saveView: map is null");
      return;
    }
    setBusySaveView(true);
    try {
      // Check if map is still valid
      if (!map.getCenter || typeof map.getCenter !== 'function') {
        console.warn("saveView: map.getCenter is not a function");
        showToast("error", "Bản đồ chưa sẵn sàng");
        return;
      }
      const c = map.getCenter();
      if (!c) {
        console.warn("saveView: map.getCenter() returned null");
        showToast("error", "Bản đồ chưa sẵn sàng");
        return;
      }
      const zoom = map.getZoom ? map.getZoom() : 10;
      const view = { center: [c.lat, c.lng] as [number, number], zoom };
      const body: UpdateMapRequest = { viewState: JSON.stringify(view) };
      await updateMap(detail.id, body);
      showToast("success", "Đã lưu vị trí hiển thị.");
    } catch (e) {
      console.error("saveView error:", e);
      showToast("error", e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusySaveView(false);
    }
  }, [detail, showToast]);

  const GuardBtn: React.FC<
    React.PropsWithChildren<{ title: string; onClick?: () => void; disabled?: boolean }>
  > = ({ title, onClick, disabled, children }) => {
    return (
      <button
        className="px-2 py-1.5 rounded-md bg-transparent text-white text-xs hover:bg-emerald-500/20"
        title={title}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  };

  if (loading) return <main className="h-screen w-screen grid place-items-center text-zinc-400">Đang tải…</main>;
  if (err || !detail) return <main className="h-screen w-screen grid place-items-center text-red-300">{err ?? "Không tải được bản đồ"}</main>;

  return (
    <main className="relative h-screen w-screen overflow-hidden text-white">
      <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
        <div className="pointer-events-auto bg-black/70 backdrop-blur-md ring-1 ring-white/15 shadow-xl py-1 px-3">
          <div className="grid grid-cols-3 place-items-stretch gap-2">
            <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-2.5 py-1.5 rounded-md bg-white text-black text-sm font-medium w-52"
                placeholder="Untitled Map"
              />
              <PublishButton mapId={mapId} status={mapStatus} onStatusChange={setMapStatus} />
            </div>
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
              <GuardBtn title="Vẽ điểm" onClick={() => enableDraw("Marker")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ đường" onClick={() => enableDraw("Line")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="7" r="2" />
                  <circle cx="19" cy="17" r="2" />
                  <path d="M7 8.5 17 15.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ vùng" onClick={() => enableDraw("Polygon")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ hình chữ nhật" onClick={() => enableDraw("Rectangle")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="12" rx="1.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Vẽ hình tròn" onClick={() => enableDraw("Circle")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Thêm chữ" onClick={() => enableDraw("Text")} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M12 6v12" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Cắt polygon" onClick={enableCutPolygon} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="8" r="2" />
                  <circle cx="5.5" cy="16" r="2" />
                  <path d="M8 9l12 8M8 15l12-8" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Xoay đối tượng" onClick={toggleRotate} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 1-2.2-5.5" />
                  <path d="M20 4v7h-7" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Di chuyển đối tượng" onClick={toggleDrag} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                </svg>
              </GuardBtn>
              <GuardBtn title="Chỉnh sửa đối tượng" onClick={toggleEdit} disabled={!mapRef.current}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </GuardBtn>
            </div>
            <div className="flex items-center justify-end gap-1.5 overflow-x-auto no-scrollbar">
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
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 cursor-pointer"
                title="Upload GeoJSON/KML/GPX file to add as layer"
              >
                Upload File
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
              {/* Story Map Buttons */}
              {mapStatus === "Published" && (
                <>
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1"
                    onClick={() => window.open(`/storymap/control/${mapId}`, '_blank')}
                    title="Open control panel (presenter view)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Control
                  </button>
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 flex items-center gap-1"
                    onClick={() => window.open(`/storymap/${mapId}`, '_blank')}
                    title="Open viewer (audience view)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    View
                  </button>
                </>
              )}
              <button
                className="rounded-lg p-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600"
                onClick={() => {
                  localStorage.removeItem('skipDeleteConfirm');
                  showToast("info", "Delete confirmations re-enabled");
                }}
                title="Re-enable delete confirmation dialogs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>
            </div>
          </div>
          {/* Toast messages are handled globally via ToastProvider */}
        </div>
      </div>

      <div ref={mapEl} className="absolute inset-0" />

      <DataLayersPanel
        features={features}
        layers={layers}
        showDataLayersPanel={showDataLayersPanel}
        setShowDataLayersPanel={setShowDataLayersPanel}
        map={mapRef.current as any}
        dataLayerRefs={dataLayerRefs}
        onLayerVisibilityChange={onLayerVisibilityChange}
        onFeatureVisibilityChange={onFeatureVisibilityChange}
        onSelectLayer={onSelectLayer}
        onDeleteFeature={onDeleteFeature}
        onBaseLayerChange={setBaseKey}
        currentBaseLayer={baseKey}
        onFeatureHover={handleLayerHover}
        hoveredLayer={hoveredLayer}
        selectedLayers={selectedLayers}
      />

      <StylePanel
        selectedLayer={selectedLayer}
        showStylePanel={showStylePanel}
        setShowStylePanel={setShowStylePanel}
        onUpdateLayer={onUpdateLayer}
        onUpdateFeature={onUpdateFeature}
        onApplyStyle={onApplyStyle}
      />

      <MapControls
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        showPoiPanel={showPoiPanel}
        onTogglePoiPanel={() => {
          setShowPoiPanel(!showPoiPanel);
          if (!showPoiPanel) setShowSegmentPanel(false);
        }}
        showStoryMapPanel={showSegmentPanel}
        onToggleStoryMapPanel={() => {
          setShowSegmentPanel(!showSegmentPanel);
          if (!showSegmentPanel) setShowPoiPanel(false);
        }}
      />

      {/* Right Panel - POI or Story Map Timeline */}
      {detail && showPoiPanel && <MapPoiPanel mapId={detail.id} isOpen={showPoiPanel} />}

      {showSegmentPanel && detail && (
        <div className="fixed left-0 right-0 bottom-0 z-[1000] pointer-events-none">
          <div className="pointer-events-auto">
            <StoryMapTimeline
              mapId={detail.id}
              currentMap={mapRef.current}
              onSegmentSelect={(segment) => {
                console.log("Segment selected:", segment);
              }}
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
        
        /* Custom marker icon styles for consistency */
        .custom-marker-icon,
        .custom-default-marker {
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
          transition: transform 0.1s ease;
        }
        
        .custom-marker-icon:hover,
        .custom-default-marker:hover {
          transform: scale(1.1);
        }
      `}</style>
    </main>
  );
}