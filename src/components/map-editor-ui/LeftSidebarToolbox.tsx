"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type DragEvent } from "react";
import { gsap } from "gsap";
import { LocationForm } from "./forms/LocationForm";
import { ZoneForm } from "./forms/ZoneForm";
import { LayerForm } from "./forms/LayerForm";
import { RouteAnimationForm } from "./forms/RouteAnimationForm";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { useI18n } from "@/i18n/I18nProvider";
import type { BaseKey } from "@/types";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import { addLayerToMap, updateMapLayer, updateMapFeature, removeLayerFromMap, createMapFeature } from "@/lib/api-maps";
import {
  type Segment,
  type TimelineTransition,
  type CameraState,
  type CreateSegmentRequest,
  type CreateTransitionRequest,
  type CreateLocationRequest,
  type CreateSegmentZoneRequest,
  type AttachLayerRequest,
  type CreateRouteAnimationRequest,
  type Location,
  type Zone,
  deleteSegmentZone,
  deleteLocation,
  detachLayerFromSegment,
  deleteRouteAnimation,
  SegmentLayer,
  getRouteAnimationsBySegment,
  parseCameraState,
  getCurrentCameraState,
  stringifyCameraState,
  RouteAnimation,
  createLocation,
  createSegmentZone,
  attachLayerToSegment,
  updateLocation,
  createRouteAnimation,
  updateRouteAnimation,
  FrontendTransitionType,
  mapFromBackendTransitionType,
  mapToBackendTransitionType,
  searchZones,
} from "@/lib/api-storymap";
import { iconEmojiMap } from "@/constants/icons";

import { Icon } from "./Icon";
import { IconLibraryView } from "./IconLibraryView";
import { LibraryView } from "./LibraryView";

interface LeftSidebarToolboxProps {
  isStoryMap?: boolean; // When false, show Locations/Zones instead of Segments/Transitions
  activeView: "explorer" | "segments" | "transitions" | "icons" | "locations" | "zones" | "search" | "library" | null;
  onViewChange: (view: "explorer" | "segments" | "transitions" | "icons" | "locations" | "zones" | "search" | "library" | null) => void;


  features: FeatureData[];
  layers: LayerDTO[];
  segments: Segment[];
  transitions: TimelineTransition[];
  baseLayer: BaseKey;
  currentMap?: any;
  mapId?: string; // Required for adding locations, zones, and layers
  layerVisibility?: Record<string, boolean>; // Track layer visibility state
  isPlaying?: boolean; // Disable modify actions when timeline is playing

  onSelectFeature: (feature: FeatureData) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onBaseLayerChange: (key: BaseKey) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onDeleteFeature: (featureId: string) => void;
  onSegmentClick: (segmentId: string) => void;

  // Layer selection for drawing
  currentLayerId?: string | null;
  onLayerChange?: (layerId: string | null) => void;

  // Segment CRUD
  onSaveSegment: (data: CreateSegmentRequest, segmentId?: string) => Promise<void>;
  onDeleteSegment?: (segmentId: string) => void;

  // Transition CRUD
  onSaveTransition: (data: CreateTransitionRequest, transitionId?: string) => Promise<void>;
  onDeleteTransition?: (transitionId: string) => void;

  // Location, Zone, Layer handlers (optional - will use API directly if not provided)
  onAddLocation?: (data: CreateLocationRequest) => Promise<void>;
  onAddZone?: (data: CreateSegmentZoneRequest) => Promise<void>;
  onAddLayer?: (data: AttachLayerRequest) => Promise<void>;
}

type ViewType = "explorer" | "segments" | "transitions" | "icons" | "locations" | "zones" | "search" | "library";
type FormMode = "list" | "create" | "edit";

export function LeftSidebarToolbox({
  isStoryMap = true,
  activeView,
  onViewChange,
  features,
  layers,
  segments,
  transitions,
  baseLayer,
  currentMap,
  mapId,
  layerVisibility,
  isPlaying = false,
  onSelectFeature,
  onSelectLayer,
  onBaseLayerChange,
  onFeatureVisibilityChange,
  onLayerVisibilityChange,
  onDeleteFeature,
  onSegmentClick,
  onSaveSegment,
  onDeleteSegment,
  onSaveTransition,
  onDeleteTransition,
  onAddLocation,
  onAddZone,
  onAddLayer,
  currentLayerId,
  onLayerChange,
}: LeftSidebarToolboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { confirmDelete } = useConfirmDialogContext();
  const { t } = useI18n();

  // Form state for segments
  const [segmentFormMode, setSegmentFormMode] = useState<FormMode>("list");
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  // Form state for transitions
  const [transitionFormMode, setTransitionFormMode] = useState<FormMode>("list");
  const [editingTransition, setEditingTransition] = useState<TimelineTransition | null>(null);

  // Dialog state for locations, zones, and layers
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showLayerDialog, setShowLayerDialog] = useState(false);
  const [showRouteAnimationDialog, setShowRouteAnimationDialog] = useState(false);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] = useState<[number, number] | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteAnimation | null>(null);

  // Track which inline form is currently showing (replaces segment list)
  const [inlineFormMode, setInlineFormMode] = useState<"list" | "location" | "zone" | "layer" | "route">("list");

  // State for map-level location form (when isStoryMap = false)
  const [mapLocationFormMode, setMapLocationFormMode] = useState<"list" | "create" | "edit">("list");
  const [mapLocationCoordinates, setMapLocationCoordinates] = useState<[number, number] | null>(null);
  const [waitingForMapLocation, setWaitingForMapLocation] = useState(false);
  const [mapEditingLocation, setMapEditingLocation] = useState<Location | null>(null);

  // State for library location creation
  const [waitingForLibraryLocation, setWaitingForLibraryLocation] = useState(false);
  const [selectedAssetForLocation, setSelectedAssetForLocation] = useState<{ asset: import("@/lib/api-library").UserAsset; segmentId: string } | null>(null);

  // Listen for editLocation event from TimelineTrack
  useEffect(() => {
    const handleEditLocation = (e: Event) => {
      const customEvent = e as CustomEvent<{ location: Location; segmentId: string; mapId: string }>;
      const { location, segmentId, mapId: eventMapId } = customEvent.detail;

      // Find the segment that contains this location
      const segment = segments.find(s => s.segmentId === segmentId);
      if (segment) {
        setEditingSegment(segment);
        setEditingLocation(location);
        setInlineFormMode("location");

        // Extract coordinates from location if available
        if (location.markerGeometry) {
          try {
            const geo = JSON.parse(location.markerGeometry);
            if (geo.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
              setPickedCoordinates([geo.coordinates[0], geo.coordinates[1]]); // [lng, lat]
            }
          } catch (e) {
            console.error("Failed to parse location coordinates:", e);
            setPickedCoordinates(null);
          }
        } else {
          setPickedCoordinates(null);
        }

        // Switch to segments view if not already there
        if (activeView !== "segments") {
          onViewChange("segments");
        }
        setSegmentFormMode("list");
      }
    };

    window.addEventListener('editLocation', handleEditLocation);
    return () => {
      window.removeEventListener('editLocation', handleEditLocation);
    };
  }, [segments, activeView, onViewChange]);

  // Stop icon placement when switching away from icons tab
  useEffect(() => {
    if (activeView !== "icons") {
      // Dispatch event to stop icon placement
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("icon:stopPlacement"));
      }
    }
  }, [activeView]);

  // Listen for editRoute event from TimelineTrack
  useEffect(() => {
    const handleEditRoute = (e: Event) => {
      const customEvent = e as CustomEvent<{ route: RouteAnimation; segmentId: string; mapId: string }>;
      const { route, segmentId } = customEvent.detail;

      // Find the segment that contains this route
      const segment = segments.find(s => s.segmentId === segmentId);
      if (segment) {
        setEditingSegment(segment);
        setEditingRoute(route);
        setInlineFormMode("route");

        // Switch to segments view if not already there
        if (activeView !== "segments") {
          onViewChange("segments");
        }
        setSegmentFormMode("list");
      }
    };

    window.addEventListener('editRoute', handleEditRoute);
    return () => {
      window.removeEventListener('editRoute', handleEditRoute);
    };
  }, [segments, activeView, onViewChange]);

  // Handle map click when waiting for location
  useEffect(() => {
    if (!currentMap || !waitingForLocation || !editingSegment) {
      // Reset cursor when not waiting for location
      if (currentMap && !waitingForLocation) {
        const mapContainer = currentMap.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = '';
          mapContainer.style.removeProperty('cursor');
        }
      }
      return;
    }

    // Change cursor to crosshair when waiting for location
    const mapContainer = currentMap.getContainer();
    if (mapContainer) {
      mapContainer.style.cursor = 'crosshair';
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');
    }

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      setPickedCoordinates([lng, lat]); // [longitude, latitude]
      setWaitingForLocation(false);
      setShowLocationDialog(true);

      // Reset cursor after picking location
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };

    currentMap.on('click', handleMapClick);

    return () => {
      currentMap.off('click', handleMapClick);
      // Reset cursor when unmounting or waitingForLocation changes
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };
  }, [currentMap, waitingForLocation, editingSegment]);

  // Handle map click for map-level locations (when isStoryMap = false)
  useEffect(() => {
    if (!currentMap || !waitingForMapLocation) {
      // Reset cursor when not waiting
      if (currentMap && !waitingForMapLocation) {
        const mapContainer = currentMap.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = '';
          mapContainer.style.removeProperty('cursor');
        }
      }
      return;
    }

    // Change cursor to crosshair when waiting for location
    const mapContainer = currentMap.getContainer();
    if (mapContainer) {
      mapContainer.style.cursor = 'crosshair';
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');
    }

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      setMapLocationCoordinates([lng, lat]); // [longitude, latitude]
      setWaitingForMapLocation(false);

      // Reset cursor after picking location
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };

    currentMap.on('click', handleMapClick);

    return () => {
      currentMap.off('click', handleMapClick);
      // Reset cursor when unmounting
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };
  }, [currentMap, waitingForMapLocation]);

  // Handle map click for library location creation
  useEffect(() => {
    if (!currentMap || !waitingForLibraryLocation || !selectedAssetForLocation) {
      // Reset cursor when not waiting
      if (currentMap && !waitingForLibraryLocation) {
        const mapContainer = currentMap.getContainer();
        if (mapContainer) {
          mapContainer.style.cursor = '';
          mapContainer.style.removeProperty('cursor');
        }
      }
      return;
    }

    // Change cursor to crosshair when waiting for location
    const mapContainer = currentMap.getContainer();
    if (mapContainer) {
      mapContainer.style.cursor = 'crosshair';
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');
    }

    const handleMapClick = async (e: any) => {
      const { lat, lng } = e.latlng;
      setWaitingForLibraryLocation(false);

      // Reset cursor after picking location
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }

      // Create location with asset
      try {
        const { asset, segmentId } = selectedAssetForLocation;
        const markerGeometry = JSON.stringify({
          type: "Point",
          coordinates: [lng, lat]
        });

        const locationData: CreateLocationRequest = {
          title: asset.name.replace(/\.[^/.]+$/, ""), // Remove file extension
          locationType: "PointOfInterest",
          markerGeometry,
          iconUrl: asset.url,
          iconSize: 32,
          highlightOnEnter: false,
          displayOrder: 0,
          isVisible: true,
          showTooltip: true,
          segmentId,
        };

        if (mapId) {
          await createLocation(mapId, segmentId, locationData);
          window.dispatchEvent(new CustomEvent("locationCreated", {
            detail: { segmentId }
          }));
        }

        setSelectedAssetForLocation(null);
      } catch (error) {
        console.error("Failed to create location from asset:", error);
        toast.error(t("mapEditor", "cannotCreateLocation"));
      }
    };

    currentMap.on('click', handleMapClick);

    return () => {
      currentMap.off('click', handleMapClick);
      // Reset cursor when unmounting
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };
  }, [currentMap, waitingForLibraryLocation, selectedAssetForLocation, mapId]);

  useEffect(() => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: activeView ? 0 : -320,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [activeView]);

  const handleIconClick = useCallback((view: ViewType) => {
    // Reset form modes when switching views
    setSegmentFormMode("list");
    setTransitionFormMode("list");
    setEditingSegment(null);
    setEditingTransition(null);

    onViewChange(activeView === view ? null : view);
  }, [activeView, onViewChange]);

  // Segment form handlers
  const handleAddSegment = useCallback(() => {
    setEditingSegment(null);
    setSegmentFormMode("create");
  }, []);

  const handleEditSegment = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setSegmentFormMode("edit");
  }, []);


  const handleCancelSegmentForm = useCallback(() => {
    setSegmentFormMode("list");
    setEditingSegment(null);
  }, []);

  const handleSaveSegmentForm = useCallback(async (data: CreateSegmentRequest) => {
    await onSaveSegment(data, editingSegment?.segmentId);
    // If creating a new segment, keep it in edit mode so user can attach locations/zones/layers
    if (!editingSegment) {
      // After creating, we need to find the newly created segment
      // For now, just go back to list - user can edit it later to attach things
      setSegmentFormMode("list");
      setEditingSegment(null);
    } else {
      // If editing, stay in edit mode
      setSegmentFormMode("list");
      setEditingSegment(null);
    }
  }, [onSaveSegment, editingSegment]);

  // Transition form handlers
  const handleAddTransition = useCallback(() => {
    setEditingTransition(null);
    setTransitionFormMode("create");
  }, []);

  const handleEditTransition = useCallback((transition: TimelineTransition) => {
    setEditingTransition(transition);
    setTransitionFormMode("edit");
  }, []);

  const handleCancelTransitionForm = useCallback(() => {
    setTransitionFormMode("list");
    setEditingTransition(null);
  }, []);

  const handleSaveTransitionForm = useCallback(async (data: CreateTransitionRequest) => {
    await onSaveTransition(data, editingTransition?.timelineTransitionId);
    setTransitionFormMode("list");
    setEditingTransition(null);
  }, [onSaveTransition, editingTransition]);

  // Handlers for adding/updating location, zone, and layer
  const handleAddLocation = useCallback(async (data: CreateLocationRequest) => {
    if (!editingSegment?.segmentId || !mapId) return;

    try {
      if (editingLocation?.locationId) {
        // Update existing location
        await updateLocation(mapId, editingSegment.segmentId, editingLocation.locationId, data);
        window.dispatchEvent(new CustomEvent("locationUpdated", {
          detail: { segmentId: editingSegment.segmentId }
        }));
      } else {
        // Create new location
        const locationData = {
          ...data,
          segmentId: editingSegment.segmentId,
        };

        if (onAddLocation) {
          await onAddLocation(locationData);
        } else {
          await createLocation(mapId, editingSegment.segmentId, locationData);
        }

        window.dispatchEvent(new CustomEvent("locationCreated", {
          detail: { segmentId: editingSegment.segmentId }
        }));
      }

      setShowLocationDialog(false);
      setWaitingForLocation(false);
      setEditingLocation(null);
      setInlineFormMode("list");
      // CRITICAL FIX: Clear editing state to show updated location
      window.dispatchEvent(new Event("cancelLocationEdit"));
    } catch (error) {
      console.error("Failed to save location:", error);
      alert("Không thể lưu location. Vui lòng thử lại.");
    }
  }, [editingSegment, editingLocation, onAddLocation, mapId]);

  // Handler for creating location from library asset
  const handleCreateLocationFromAsset = useCallback((asset: import("@/lib/api-library").UserAsset, segmentId: string) => {
    setSelectedAssetForLocation({ asset, segmentId });
    setWaitingForLibraryLocation(true);

    // Show instruction to user
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showMapInstruction', {
        detail: { message: 'Click on the map to place the location marker' }
      }));
    }
  }, []);

  const handleCreateLocationFromIcon = useCallback((iconKey: string, segmentId: string) => {
    // This handler is for preset icons from IconLibraryView
    // The icon placement logic is already handled by the icon:startPlacement event
    // We just need to track that we're in icon placement mode if needed
    console.log('Creating location from icon:', iconKey, 'for segment:', segmentId);
  }, []);

  const handleAddZone = useCallback(async (data: CreateSegmentZoneRequest) => {
    if (!editingSegment?.segmentId) return;

    const zoneData = {
      ...data,
      segmentId: editingSegment.segmentId,
    };

    if (onAddZone) {
      await onAddZone(zoneData);
    } else if (mapId) {
      await createSegmentZone(mapId, editingSegment.segmentId, zoneData);
    }

    // Dispatch event to refresh segments
    window.dispatchEvent(new CustomEvent("zoneCreated", {
      detail: { segmentId: editingSegment.segmentId }
    }));

    setShowZoneDialog(false);
  }, [editingSegment, onAddZone, mapId]);

  const handleAddLayer = useCallback(async (data: AttachLayerRequest) => {
    if (!editingSegment?.segmentId) return;

    if (onAddLayer) {
      await onAddLayer(data);
    } else if (mapId) {
      await attachLayerToSegment(mapId, editingSegment.segmentId, data);
    }

    // Dispatch event to refresh segments
    window.dispatchEvent(new CustomEvent("layerCreated", {
      detail: { segmentId: editingSegment.segmentId }
    }));

    setShowLayerDialog(false);
  }, [editingSegment, onAddLayer, mapId]);

  return (
    <>
      {/* Icon Bar - Video Editor Style */}
      <div className="fixed left-0 top-10 bottom-0 w-14 bg-zinc-950/98 backdrop-blur-sm border-r border-zinc-800/80 z-[2000] flex flex-col shadow-lg">
        <div className="h-12 border-b border-zinc-800/80 flex items-center justify-center">
          <Icon icon="mdi:video-box" className="w-6 h-6 text-emerald-500" />
        </div>
        <div className="flex-1 flex flex-col py-2">
          <IconButton
            icon="mdi:layers-triple"
            label="Project"
            isActive={activeView === "explorer"}
            onClick={() => handleIconClick("explorer")}
          />
          {isStoryMap ? (
            <>
              <IconButton
                icon="mdi:filmstrip"
                label="Segments"
                isActive={activeView === "segments"}
                onClick={() => handleIconClick("segments")}
              />
              <IconButton
                icon="mdi:transition"
                label="Transitions"
                isActive={activeView === "transitions"}
                onClick={() => handleIconClick("transitions")}
              />
            </>
          ) : (
            <>
              <IconButton
                icon="mdi:map-marker"
                label="Locations"
                isActive={activeView === "locations"}
                onClick={() => handleIconClick("locations")}
              />
              {/* <IconButton
                icon="mdi:vector-polygon"
                label="Zones"
                isActive={activeView === "zones"}
                onClick={() => handleIconClick("zones")}
              /> */}
              <IconButton
                icon="mdi:map-search"
                label="Search"
                isActive={activeView === "search"}
                onClick={() => handleIconClick("search")}
              />
            </>
          )}
          <IconButton
            icon="mdi:toolbox-outline"
            label="Assets"
            isActive={activeView === "icons"}
            onClick={() => handleIconClick("icons")}
          />
          <IconButton
            icon="mdi:folder-multiple-image"
            label="Library"
            isActive={activeView === "library"}
            onClick={() => handleIconClick("library")}
          />
        </div>
      </div>


      {/* Content Panel (slides in/out) - Video Editor Style */}
      <div
        ref={panelRef}
        className="fixed left-14 top-10 bottom-0 w-[320px] bg-zinc-900/98 backdrop-blur-sm border-r border-zinc-800/80 z-[1999] overflow-hidden shadow-xl"
        style={{ transform: "translateX(-320px)" }}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header - Video Editor Style */}
          <div className="h-11 border-b border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-300 uppercase tracking-wider">
                {activeView === "explorer" && "PROJECT"}
                {activeView === "segments" && (
                  inlineFormMode === "location" ? (editingLocation ? "EDIT LOCATION" : "ADD LOCATION") :
                    inlineFormMode === "zone" ? "ADD ZONE" :
                      inlineFormMode === "layer" ? "ADD LAYER" :
                        inlineFormMode === "route" ? "ADD ROUTE" :
                          segmentFormMode === "list" ? "SEGMENTS" :
                            segmentFormMode === "create" ? "NEW SEGMENT" :
                              "EDIT SEGMENT"
                )}
                {activeView === "transitions" && (transitionFormMode === "list" ? "TRANSITIONS" : transitionFormMode === "create" ? "NEW TRANSITION" : "EDIT TRANSITION")}
                {activeView === "locations" && "LOCATIONS"}
                {activeView === "zones" && "ZONES"}
                {activeView === "search" && "SEARCH / TÌM KIẾM"}
                {activeView === "icons" && "ASSETS"}
                {activeView === "library" && "USER LIBRARY"}
              </span>
              {activeView === "segments" && segmentFormMode === "list" && (
                <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded">
                  {segments.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Back button for forms */}
              {((activeView === "segments" && (segmentFormMode !== "list" || inlineFormMode !== "list")) ||
                (activeView === "transitions" && transitionFormMode !== "list")) && (
                  <button
                    onClick={() => {
                      if (activeView === "segments") {
                        if (inlineFormMode !== "list") {
                          setInlineFormMode("list");
                        } else {
                          handleCancelSegmentForm();
                        }
                      }
                      if (activeView === "transitions") handleCancelTransitionForm();
                    }}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                    title="Back to list"
                  >
                    <Icon icon="mdi:arrow-left" className="w-4 h-4 text-zinc-400" />
                  </button>
                )}

              {/* Close panel button (only show when in list mode) */}
              {((activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "list") ||
                (activeView === "transitions" && transitionFormMode === "list") ||
                activeView === "explorer" ||
                activeView === "icons" ||
                activeView === "library") && (
                  <button
                    onClick={() => onViewChange(null)}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                    title="Close panel"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
                  </button>
                )}
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto scrollbar-dark">
            {activeView === "explorer" && (
              <ExplorerView
                features={features}
                layers={layers}
                baseLayer={baseLayer}
                mapId={mapId}
                layerVisibility={layerVisibility}
                onSelectFeature={onSelectFeature}
                onSelectLayer={onSelectLayer}
                onBaseLayerChange={onBaseLayerChange}
                onFeatureVisibilityChange={onFeatureVisibilityChange}
                onLayerVisibilityChange={onLayerVisibilityChange}
                onDeleteFeature={onDeleteFeature}
                currentLayerId={currentLayerId}
                onLayerChange={onLayerChange}
              />
            )}

            {activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "list" && (
              <SegmentsView
                segments={segments}
                isPlaying={isPlaying}
                onSegmentClick={onSegmentClick}
                onAddSegment={handleAddSegment}
                onEditSegment={handleEditSegment}
                onDeleteSegment={onDeleteSegment}
                onAddLocation={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment && currentMap) {
                    setEditingSegment(segment);
                    setWaitingForLocation(true);
                    setPickedCoordinates(null);
                    setShowLocationDialog(true);
                    setInlineFormMode("location");
                    // Show instruction message
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('showMapInstruction', {
                        detail: { message: 'Click on the map to place the location marker' }
                      }));
                    }
                  }
                }}
                onAddZone={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setShowZoneDialog(true);
                    setInlineFormMode("zone");
                  }
                }}
                onAddLayer={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setShowLayerDialog(true);
                    setInlineFormMode("layer");
                  }
                }}
                onAddRouteAnimation={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setEditingRoute(null); // CRITICAL: Reset editingRoute to null for new route
                    setShowRouteAnimationDialog(true);
                    setInlineFormMode("route");
                  }
                }}
                mapId={mapId}
              />
            )}

            {activeView === "segments" && segmentFormMode !== "list" && (
              <SegmentFormView
                editing={editingSegment}
                currentMap={currentMap}
                mapId={mapId}
                onCancel={handleCancelSegmentForm}
                onSave={handleSaveSegmentForm}
                onAddLocation={() => {
                  if (currentMap) {
                    setWaitingForLocation(true);
                    setPickedCoordinates(null);
                    setShowLocationDialog(true);
                    // Show instruction message
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('showMapInstruction', {
                        detail: { message: 'Click on the map to place the location marker' }
                      }));
                    }
                  }
                }}
                onAddZone={() => setShowZoneDialog(true)}
                onAddLayer={() => setShowLayerDialog(true)}
                onAddRouteAnimation={() => {
                  setEditingRoute(null); // CRITICAL: Reset editingRoute to null for new route
                  setShowRouteAnimationDialog(true);
                }}
              />
            )}

            {activeView === "transitions" && transitionFormMode === "list" && (
              <TransitionsView
                transitions={transitions}
                segments={segments}
                onAddTransition={handleAddTransition}
                onEditTransition={handleEditTransition}
                onDeleteTransition={onDeleteTransition}
              />
            )}

            {activeView === "transitions" && transitionFormMode !== "list" && (
              <TransitionFormView
                editing={editingTransition}
                segments={segments}
                onCancel={handleCancelTransitionForm}
                onSave={handleSaveTransitionForm}
              />
            )}
            {activeView === "icons" && (
              <IconLibraryView
                currentMap={currentMap}
                mapId={mapId}
                isStoryMap={isStoryMap}
                segments={segments}
                onCreateLocationFromAsset={handleCreateLocationFromIcon}
              />
            )}

            {activeView === "library" && (
              <LibraryView
                isStoryMap={isStoryMap}
                segments={segments}
                mapId={mapId}
                onCreateLocationFromAsset={handleCreateLocationFromAsset}
              />
            )}

            {/* Map Locations View - list mode (when isStoryMap = false) */}
            {activeView === "locations" && !isStoryMap && mapLocationFormMode === "list" && (
              <MapLocationsView
                mapId={mapId}
                currentMap={currentMap}
                onShowLocationForm={() => {
                  setMapLocationFormMode("create");
                  setWaitingForMapLocation(true);
                  setMapLocationCoordinates(null);
                  setMapEditingLocation(null);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('showMapInstruction', {
                      detail: { message: 'Click on the map to place the location marker' }
                    }));
                  }
                }}
                onEditLocation={(location) => {
                  setMapEditingLocation(location);
                  setMapLocationFormMode("edit");
                  setWaitingForMapLocation(false);
                  if (location.markerGeometry) {
                    try {
                      const geo = JSON.parse(location.markerGeometry);
                      if (geo.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
                        setMapLocationCoordinates([geo.coordinates[0], geo.coordinates[1]]);
                      } else {
                        setMapLocationCoordinates(null);
                      }
                    } catch (e) {
                      console.error("Failed to parse location coordinates:", e);
                      setMapLocationCoordinates(null);
                    }
                  } else {
                    setMapLocationCoordinates(null);
                  }
                }}
              />
            )}

            {/* Map Location Form - create/edit mode (when isStoryMap = false) */}
            {activeView === "locations" && !isStoryMap && mapLocationFormMode !== "list" && mapId && (
              <LocationForm
                segmentId={undefined}
                onSave={async (data: CreateLocationRequest) => {
                  try {
                    if (!data.markerGeometry) {
                      console.error("markerGeometry is required");
                      return;
                    }
                    const { createMapLocation, updateLocation } = await import("@/lib/api-location");

                    if (mapEditingLocation?.locationId) {
                      await updateLocation(mapEditingLocation.locationId, {
                        ...data,
                        mapId,
                      });
                      window.dispatchEvent(new CustomEvent("locationUpdated"));
                    } else {
                    await createMapLocation(mapId, {
                      ...data,
                      markerGeometry: data.markerGeometry, // Ensure it's not undefined
                    });
                    window.dispatchEvent(new CustomEvent("locationCreated"));
                    }
                    setMapLocationFormMode("list");
                    setWaitingForMapLocation(false);
                    setMapLocationCoordinates(null);
                    setMapEditingLocation(null);
                    // CRITICAL FIX: Clear editing state to show updated location
                    window.dispatchEvent(new Event("cancelLocationEdit"));
                  } catch (error) {
                    console.error("Failed to save location:", error);
                  }
                }}
                onCancel={() => {
                  setMapLocationFormMode("list");
                  setWaitingForMapLocation(false);
                  setMapLocationCoordinates(null);
                  setMapEditingLocation(null);
                  // CRITICAL FIX: Dispatch event to show location marker again
                  window.dispatchEvent(new Event("cancelLocationEdit"));
                }}
                onRepickLocation={() => {
                  setMapLocationCoordinates(null);
                  setWaitingForMapLocation(true);
                }}
                onCancelRepick={() => {
                  if (mapEditingLocation?.markerGeometry) {
                    try {
                      const geo = JSON.parse(mapEditingLocation.markerGeometry);
                      if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
                        setMapLocationCoordinates([geo.coordinates[0], geo.coordinates[1]]);
                      }
                    } catch (e) {
                      console.error("Failed to parse coordinates:", e);
                    }
                  }
                  setWaitingForMapLocation(false);
                }}
                initialCoordinates={mapLocationCoordinates}
                initialLocation={mapEditingLocation as any}
                isStoryMap={false}
                segments={[]}
                mapId={mapId}
              />
            )}

            {/* Map Zones View (when isStoryMap = false) */}
            {activeView === "zones" && !isStoryMap && (
              <MapZonesView mapId={mapId} />
            )}

            {/* Search Administrative Zones View */}
            {activeView === "search" && !isStoryMap && (
              <SearchZoneView mapId={mapId} currentMap={currentMap} />
            )}

            {/* Inline Forms for adding/editing location and zone */}
            {activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "location" && editingSegment && mapId && (
              <LocationForm
                segmentId={editingSegment.segmentId}
                onSave={handleAddLocation}
                onCancel={() => {
                  setShowLocationDialog(false);
                  setWaitingForLocation(false);
                  setPickedCoordinates(null);
                  setEditingLocation(null);
                  setInlineFormMode("list");
                  // CRITICAL FIX: Dispatch event to show location marker again
                  window.dispatchEvent(new Event("cancelLocationEdit"));
                }}
                onRepickLocation={() => {
                  setPickedCoordinates(null);
                  setWaitingForLocation(true);
                }}
                onCancelRepick={() => {
                  if (editingLocation?.markerGeometry) {
                    try {
                      const geo = JSON.parse(editingLocation.markerGeometry);
                      if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
                        setPickedCoordinates([geo.coordinates[0], geo.coordinates[1]]);
                      }
                    } catch (e) {
                      console.error("Failed to parse coordinates:", e);
                    }
                  }
                  setWaitingForLocation(false);
                }}
                initialCoordinates={pickedCoordinates}
                initialLocation={editingLocation}
                isStoryMap={isStoryMap}
                segments={segments}
                mapId={mapId}
                onCreateLocationFromAsset={handleCreateLocationFromAsset}
              />
            )}

            {activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "zone" && editingSegment && mapId && (
              <ZoneForm
                segmentId={editingSegment.segmentId}
                onSave={async (data: CreateSegmentZoneRequest) => {
                  await handleAddZone(data);
                  setInlineFormMode("list");
                }}
                onCancel={() => {
                  setShowZoneDialog(false);
                  setInlineFormMode("list");
                }}
              />
            )}

            {activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "layer" && editingSegment && mapId && (
              <LayerForm
                mapId={mapId}
                segmentId={editingSegment.segmentId}
                onSave={async (data: AttachLayerRequest) => {
                  if (onAddLayer) {
                    await onAddLayer(data);
                  } else {
                    await attachLayerToSegment(mapId, editingSegment.segmentId, data);
                  }
                  setInlineFormMode("list");
                }}
                onCancel={() => {
                  setShowLayerDialog(false);
                  setInlineFormMode("list");
                }}
              />
            )}

            {activeView === "segments" && segmentFormMode === "list" && inlineFormMode === "route" && editingSegment && mapId && (
              <RouteAnimationForm
                mapId={mapId}
                segmentId={editingSegment.segmentId}
                initialRoute={editingRoute || undefined}
                onSave={async (data: CreateRouteAnimationRequest) => {
                  try {
                    if (editingRoute && editingRoute.routeAnimationId) {
                      await updateRouteAnimation(mapId, editingSegment.segmentId, editingRoute.routeAnimationId, data);
                    } else {
                      await createRouteAnimation(mapId, editingSegment.segmentId, data);
                    }
                    window.dispatchEvent(new CustomEvent("routeAnimationChanged", {
                      detail: { segmentId: editingSegment.segmentId }
                    }));

                    setEditingRoute(null);
                    setInlineFormMode("list");
                  } catch (error) {
                    console.error("Failed to save route animation:", error);
                    alert("Không thể lưu route animation. Vui lòng thử lại.");
                    throw error; // Re-throw to let form handle error state
                  }
                }}
                onCancel={() => {
                  setEditingRoute(null);
                  setShowRouteAnimationDialog(false);
                  setInlineFormMode("list");
                }}
              />
            )}

          </div>
        </div>
      </div>

    </>
  );
}

function getZoneCenter(zone: Zone): [number, number] | null {
  if (zone.centroid) {
    const str = zone.centroid.trim();

    // TH1: centroid lưu dạng GeoJSON Point
    if (str.startsWith("{")) {
      try {
        const gj = JSON.parse(str);
        if (
          gj &&
          gj.type === "Point" &&
          Array.isArray(gj.coordinates) &&
          gj.coordinates.length >= 2
        ) {
          const lng = Number(gj.coordinates[0]);
          const lat = Number(gj.coordinates[1]);
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
            return [lng, lat];
          }
        }
      } catch {
        // ignore
      }
    }

    // TH2: centroid dạng "lat,lon" hoặc "lat lon"
    const parts = str.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = Number(parts[0]); // lat
      const b = Number(parts[1]); // lon
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        return [b, a]; // [lng, lat]
      }
    }
  }

  // Nếu không có centroid thì fallback sang boundingBox
  if (zone.boundingBox) {
    try {
      const bb = JSON.parse(zone.boundingBox);
      if (Array.isArray(bb) && bb.length >= 4) {
        const south = Number(bb[0]);
        const north = Number(bb[1]);
        const west = Number(bb[2]);
        const east = Number(bb[3]);

        if (
          !Number.isNaN(south) &&
          !Number.isNaN(north) &&
          !Number.isNaN(west) &&
          !Number.isNaN(east)
        ) {
          const lat = (south + north) / 2;
          const lng = (west + east) / 2;
          return [lng, lat];
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function getCenterFromMarkerGeometry(
  markerGeometry?: string | null
): [number, number] | null {
  if (!markerGeometry) return null;

  try {
    const geo = JSON.parse(markerGeometry);

    // Point: [lng, lat]
    if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
      const lng = Number(geo.coordinates[0]);
      const lat = Number(geo.coordinates[1]);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        return [lng, lat];
      }
      return null;
    }

    if (
      geo.type === "Polygon" &&
      Array.isArray(geo.coordinates) &&
      Array.isArray(geo.coordinates[0])
    ) {
      const ring = geo.coordinates[0];
      let sumLng = 0;
      let sumLat = 0;
      let count = 0;

      for (const coord of ring) {
        if (!Array.isArray(coord) || coord.length < 2) continue;
        const lng = Number(coord[0]);
        const lat = Number(coord[1]);
        if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
        sumLng += lng;
        sumLat += lat;
        count++;
      }

      if (count === 0) return null;
      return [sumLng / count, sumLat / count];
    }
  } catch (err) {
    console.error("getCenterFromMarkerGeometry error", err);
  }

  return null;
}

function IconButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-12 flex flex-col items-center justify-center gap-1 transition-all group relative",
        "border-l-2 border-transparent",
        isActive
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
          : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700"
      )}
      title={label}
    >
      <Icon icon={icon} className="w-5 h-5" />
      <span className="text-[9px] font-medium uppercase tracking-wider">
        {label}
      </span>
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500" />
      )}
    </button>
  );
}

function ExplorerView({
  features,
  layers,
  baseLayer,
  mapId,
  layerVisibility,
  onSelectFeature,
  onSelectLayer,
  onBaseLayerChange,
  onFeatureVisibilityChange,
  onLayerVisibilityChange,
  onDeleteFeature,
  currentLayerId,
  onLayerChange,
}: {
  features: FeatureData[];
  layers: LayerDTO[];
  baseLayer: BaseKey;
  mapId?: string;
  layerVisibility?: Record<string, boolean>;
  onSelectFeature: (feature: FeatureData) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onBaseLayerChange: (key: BaseKey) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onDeleteFeature: (featureId: string) => void;
  currentLayerId?: string | null;
  onLayerChange?: (layerId: string | null) => void;
}) {
  const { confirmDelete } = useConfirmDialogContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState("");
  const [isUpdatingLayer, setIsUpdatingLayer] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);
  const [draggingFeatureId, setDraggingFeatureId] = useState<string | null>(null);
  const [dropTargetLayerId, setDropTargetLayerId] = useState<string | null>(null);
  const [updatingFeatureId, setUpdatingFeatureId] = useState<string | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);

  const UNASSIGNED_KEY = "__unassigned__";
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const doesFeatureMatch = useCallback(
    (feature: FeatureData) =>
      normalizedQuery.length === 0 ||
      feature.name.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  );
  const doesLayerMatch = useCallback(
    (layer: LayerDTO) =>
      normalizedQuery.length === 0 ||
      layer.layerName.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  );

  useEffect(() => {
    setExpandedLayers(prev => {
      const next = { ...prev };
      layers.forEach(layer => {
        if (next[layer.id] === undefined) {
          next[layer.id] = true;
        }
      });
      return next;
    });
  }, [layers]);

  // Listen for feature hover events from map
  useEffect(() => {
    const handleFeatureHover = (e: Event) => {
      const customEvent = e as CustomEvent<{ featureId: string | null }>;
      setHoveredFeatureId(customEvent.detail?.featureId || null);
    };

    window.addEventListener('featureHover', handleFeatureHover);
    return () => {
      window.removeEventListener('featureHover', handleFeatureHover);
    };
  }, []);

  const featuresByLayer = useMemo(() => {
    const map = new Map<string, FeatureData[]>();
    layers.forEach(layer => map.set(layer.id, []));
    features.forEach(feature => {
      const key = feature.layerId || UNASSIGNED_KEY;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(feature);
    });
    if (!map.has(UNASSIGNED_KEY)) {
      map.set(UNASSIGNED_KEY, []);
    }
    return map;
  }, [features, layers]);

  const filteredFeatures = useMemo(
    () => features.filter(doesFeatureMatch),
    [features, doesFeatureMatch]
  );

  const visibleLayers = useMemo(
    () =>
      layers.filter(layer => {
        if (doesLayerMatch(layer)) return true;
        const assigned = featuresByLayer.get(layer.id) || [];
        return assigned.some(doesFeatureMatch);
      }),
    [layers, featuresByLayer, doesLayerMatch, doesFeatureMatch]
  );

  const unassignedFeatures = featuresByLayer.get(UNASSIGNED_KEY) || [];
  const unassignedLabelVariants = ["unassigned", "no layer", "chua co layer", "chua thuoc layer"];
  const unassignedMatchesQuery =
    normalizedQuery.length === 0 ||
    unassignedLabelVariants.some(label => label.includes(normalizedQuery));
  const visibleUnassignedFeatures = useMemo(
    () =>
      unassignedMatchesQuery
        ? unassignedFeatures
        : unassignedFeatures.filter(doesFeatureMatch),
    [unassignedFeatures, doesFeatureMatch, unassignedMatchesQuery]
  );

  const toggleLayerExpanded = (layerId: string) => {
    setExpandedLayers(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const resetDragState = () => {
    setDraggingFeatureId(null);
    setDropTargetLayerId(null);
  };

  const handleFeatureDragStart = (
    event: DragEvent<HTMLDivElement>,
    feature: FeatureData
  ) => {
    if (!mapId || !feature.featureId) {
      event.preventDefault();
      return;
    }
    const featurePersistedId = feature.featureId || feature.id;
    setDraggingFeatureId(featurePersistedId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", featurePersistedId);
  };

  const handleFeatureDragEnd = () => {
    resetDragState();
  };

  const handleLayerDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetId: string
  ) => {
    if (!draggingFeatureId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetLayerId !== targetId) {
      setDropTargetLayerId(targetId);
    }
  };

  const handleLayerDragLeave = (targetId: string) => {
    if (dropTargetLayerId === targetId) {
      setDropTargetLayerId(null);
    }
  };

  const handleLayerDrop = async (targetLayerId: string | null) => {
    if (!mapId || !draggingFeatureId) {
      resetDragState();
      return;
    }

    const feature = features.find(
      f => (f.featureId || f.id) === draggingFeatureId
    );
    if (!feature || !feature.featureId) {
      resetDragState();
      return;
    }

    const normalizedTarget = targetLayerId;
    if ((feature.layerId || null) === normalizedTarget) {
      resetDragState();
      return;
    }

    try {
      setUpdatingFeatureId(feature.featureId);
      await updateMapFeature(mapId, feature.featureId, {
        layerId: normalizedTarget,
      });
      window.dispatchEvent(
        new CustomEvent("featureLayerUpdated", {
          detail: { featureId: feature.featureId },
        })
      );
    } catch (error) {
      console.error("Failed to move feature to layer:", error);
      alert("Không thể di chuyển feature. Vui lòng thử lại.");
    } finally {
      setUpdatingFeatureId(null);
      resetDragState();
    }
  };

  const renderFeatureRow = (feature: FeatureData, subtitle?: string) => {
    const isDraggable = Boolean(mapId && feature.featureId);
    const isUpdating = updatingFeatureId === feature.featureId;
    const isHovered = hoveredFeatureId === (feature.featureId || feature.id);
    return (
      <div
        key={feature.id}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group/item transition-all",
          isHovered
            ? "bg-emerald-500/20 border border-emerald-500/50 shadow-sm"
            : "hover:bg-zinc-800/60 border border-transparent"
        )}
        onClick={() => onSelectFeature(feature)}
        draggable={isDraggable}
        onDragStart={event => handleFeatureDragStart(event, feature)}
        onDragEnd={handleFeatureDragEnd}
        title={
          isDraggable
            ? "Kéo thả để chuyển layer"
            : "Feature cần được lưu trước khi kéo"
        }
      >
        <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Icon
            icon={getFeatureIcon(feature.type)}
            className="w-3.5 h-3.5 text-emerald-400"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-zinc-300 truncate font-medium block">
            {feature.name}
          </span>
          {subtitle && (
            <span className="text-[10px] text-zinc-500 truncate block">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isUpdating && (
            <Icon
              icon="mdi:loading"
              className="w-3.5 h-3.5 text-emerald-400 animate-spin"
            />
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFeatureVisibilityChange(
                  feature.featureId || feature.id,
                  !feature.isVisible
                );
              }}
              className="p-0.5 hover:bg-zinc-700 rounded"
            >
              <Icon
                icon={feature.isVisible ? "mdi:eye" : "mdi:eye-off"}
                className={cn(
                  "w-3.5 h-3.5",
                  feature.isVisible ? "text-emerald-400" : "text-zinc-600"
                )}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFeature(feature.featureId || feature.id);
              }}
              className="p-0.5 hover:bg-zinc-700 rounded"
            >
              <Icon
                icon="mdi:delete-outline"
                className="w-3.5 h-3.5 text-red-400 hover:text-red-300"
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCreateLayer = async () => {
    if (!mapId) return;

    try {
      // Generate default layer name
      const layerNumber = layers.length + 1;
      const defaultName = `Layer ${layerNumber}`;

      // Create empty GeoJSON FeatureCollection
      const emptyGeoJSON = {
        type: "FeatureCollection",
        features: []
      };

      await addLayerToMap(mapId, {
        layerName: defaultName,
        layerData: JSON.stringify(emptyGeoJSON),
        layerTypeId: "GeoJSON",
        isVisible: true,
        zIndex: 1
      });

      // Dispatch event to refresh layers
      window.dispatchEvent(new CustomEvent("layerCreated"));
    } catch (error) {
      console.error("Failed to create layer:", error);
      alert("Không thể tạo layer. Vui lòng thử lại.");
    }
  };

  const handleStartEditLayerName = (layer: LayerDTO) => {
    setEditingLayerId(layer.id);
    setEditingLayerName(layer.layerName);
  };

  const handleSaveLayerName = async () => {
    if (!mapId || !editingLayerId || !editingLayerName.trim()) {
      setEditingLayerId(null);
      setEditingLayerName("");
      return;
    }

    setIsUpdatingLayer(true);
    try {
      await updateMapLayer(mapId, editingLayerId, {
        layerName: editingLayerName.trim()
      });

      // Dispatch event to refresh layers
      window.dispatchEvent(new CustomEvent("layerCreated"));

      setEditingLayerId(null);
      setEditingLayerName("");
    } catch (error) {
      console.error("Failed to update layer name:", error);
      toast.error("Không thể cập nhật tên layer. Vui lòng thử lại.");
    } finally {
      setIsUpdatingLayer(false);
    }
  };

  const handleCancelEditLayerName = () => {
    setEditingLayerId(null);
    setEditingLayerName("");
  };

  const handleDeleteLayer = async (layerId: string) => {
    confirmDelete(
      async () => {
        if (!mapId) return;
        try {
          await removeLayerFromMap(mapId, layerId);

          // Dispatch event to refresh layers and map detail
          window.dispatchEvent(new CustomEvent("layerDeleted", {
            detail: { layerId }
          }));

          // Clear current layer if it was deleted
          if (onLayerChange && currentLayerId === layerId) {
            onLayerChange(null);
          }
        } catch (error) {
          console.error("Failed to delete layer:", error);
          toast.error("Không thể xóa layer. Vui lòng thử lại.");
        }
      },
      {
        title: t("mapEditor", "deleteLayerTitle"),
        message: `${t("mapEditor", "deleteLayerMessage")} ${t("mapEditor", "deleteLayerWarning")}`,
        itemType: "layer"
      }
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-zinc-800/80">
        <div className="relative">
          <Icon icon="mdi:magnify" className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-dark p-2 space-y-3">

        {/* Base Layer Selection */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase">
            Map Base Layer
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              // { key: "osm" as BaseKey, label: "OSM", icon: "mdi:map-outline" },
              { key: "sat" as BaseKey, label: "Satellite", icon: "mdi:satellite-variant" },
              { key: "dark" as BaseKey, label: "Dark", icon: "mdi:moon-waning-crescent" },
              { key: "positron" as BaseKey, label: "Light", icon: "mdi:brightness-7" },
              { key: "dark-matter" as BaseKey, label: "Dark Matter", icon: "mdi:weather-night" },
              { key: "terrain" as BaseKey, label: "Terrain", icon: "mdi:terrain" },
              { key: "toner" as BaseKey, label: "Toner", icon: "mdi:circle-outline" },
              // { key: "watercolor" as BaseKey, label: "Watercolor", icon: "mdi:palette" },
              // { key: "topo" as BaseKey, label: "Topo", icon: "mdi:map-marker-radius" },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => onBaseLayerChange(key)}
                className={cn(
                  "py-2 px-2 rounded-md text-xs flex flex-col items-center justify-center gap-1 border transition-all",
                  baseLayer === key
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
                )}
                title={label}
              >
                <Icon icon={icon} className="w-4 h-4" />
                <span className="text-[10px] leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Layers & Features Tree */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Layers & Features
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <span>{visibleLayers.length} layers</span>
              <span>•</span>
              <span>{filteredFeatures.length} features</span>
              {mapId && (
                <button
                  onClick={handleCreateLayer}
                  className="p-1 hover:bg-zinc-700/50 rounded transition-colors"
                  title="Tạo layer mới"
                >
                  <Icon icon="mdi:plus" className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
            </div>
          </div>
          {visibleLayers.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-zinc-500 italic">Không có layer nào</p>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleLayers.map(layer => {
                const assignedFeatures = featuresByLayer.get(layer.id) || [];
                const layerMatches = doesLayerMatch(layer);
                const isExpanded = expandedLayers[layer.id] ?? true;
                const featuresToShow =
                  layerMatches || normalizedQuery.length === 0
                    ? assignedFeatures
                    : assignedFeatures.filter(doesFeatureMatch);
                const dropActive = dropTargetLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    className={cn(
                      "rounded border border-transparent bg-zinc-900/40",
                      dropActive && "border-emerald-500/50 bg-emerald-500/10"
                    )}
                    onDragOver={event => handleLayerDragOver(event, layer.id)}
                    onDragLeave={() => handleLayerDragLeave(layer.id)}
                    onDrop={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleLayerDrop(layer.id);
                    }}
                  >
                    <div
                      className={cn(
                        "group/item flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/60 cursor-pointer transition-colors",
                        currentLayerId === layer.id &&
                        "bg-emerald-500/20 border border-emerald-500/50"
                      )}
                      onClick={() => {
                        if (editingLayerId !== layer.id) {
                          onSelectLayer(layer);
                          if (onLayerChange) {
                            onLayerChange(layer.id);
                          }
                        }
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerExpanded(layer.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-800/80 transition-colors"
                        title={isExpanded ? "Thu gọn" : "Mở rộng"}
                      >
                        <Icon
                          icon={isExpanded ? "mdi:chevron-down" : "mdi:chevron-right"}
                          className="w-3.5 h-3.5 text-zinc-500"
                        />
                      </button>
                      <div
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
                          currentLayerId === layer.id
                            ? "bg-emerald-500/20"
                            : "bg-blue-500/20"
                        )}
                      >
                        <Icon
                          icon={
                            currentLayerId === layer.id
                              ? "mdi:folder-check"
                              : "mdi:folder-outline"
                          }
                          className={cn(
                            "w-3.5 h-3.5",
                            currentLayerId === layer.id
                              ? "text-emerald-400"
                              : "text-blue-400"
                          )}
                        />
                      </div>
                      {editingLayerId === layer.id ? (
                        <input
                          type="text"
                          value={editingLayerName}
                          onChange={(e) => setEditingLayerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveLayerName();
                            } else if (e.key === "Escape") {
                              handleCancelEditLayerName();
                            }
                          }}
                          onBlur={handleSaveLayerName}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 text-xs text-zinc-300 font-medium bg-zinc-700 border border-emerald-500/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          autoFocus
                          disabled={isUpdatingLayer}
                        />
                      ) : (
                        <span
                          className="flex-1 text-xs text-zinc-300 truncate font-medium"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleStartEditLayerName(layer);
                          }}
                          title="Double click để đổi tên"
                        >
                          {layer.layerName}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-semibold min-w-[32px] text-right">
                        {assignedFeatures.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentVisibility = layerVisibility?.[layer.id] ?? true;
                          onLayerVisibilityChange(layer.id, !currentVisibility);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:bg-zinc-700 rounded"
                        title={(layerVisibility?.[layer.id] ?? true) ? "Ẩn layer" : "Hiện layer"}
                      >
                        <Icon
                          icon={(layerVisibility?.[layer.id] ?? true) ? "mdi:eye" : "mdi:eye-off"}
                          className={cn(
                            "w-3.5 h-3.5",
                            (layerVisibility?.[layer.id] ?? true) ? "text-emerald-400" : "text-zinc-600"
                          )}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLayer(layer.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:bg-zinc-700 rounded"
                        title="Delete layer"
                      >
                        <Icon
                          icon="mdi:trash-can-outline"
                          className="w-3.5 h-3.5 text-red-400"
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pl-8 pr-2 pb-2 space-y-0.5">
                        {featuresToShow.length === 0 ? (
                          <p className="text-[11px] text-zinc-500 italic">
                            {assignedFeatures.length === 0
                              ? "Chưa có feature"
                              : "Không có feature khớp tìm kiếm"}
                          </p>
                        ) : (
                          featuresToShow.map(feature => renderFeatureRow(feature))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Unassigned features */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Features chưa có layer
            </h4>
            <span className="text-[10px] text-zinc-600">{visibleUnassignedFeatures.length}</span>
          </div>
          <div
            className={cn(
              "rounded border border-dashed border-zinc-700 px-2 py-2",
              dropTargetLayerId === UNASSIGNED_KEY && "border-emerald-500/60 bg-emerald-500/10"
            )}
            onDragOver={event => handleLayerDragOver(event, UNASSIGNED_KEY)}
            onDragLeave={() => handleLayerDragLeave(UNASSIGNED_KEY)}
            onDrop={event => {
              event.preventDefault();
              event.stopPropagation();
              handleLayerDrop(null);
            }}
          >
            {visibleUnassignedFeatures.length === 0 ? (
              <p className="text-[11px] text-zinc-500 italic">
                {unassignedFeatures.length === 0
                  ? "Trống"
                  : "Không có feature"}
              </p>
            ) : (
              <div className="space-y-0.5">
                {visibleUnassignedFeatures.map(feature =>
                  renderFeatureRow(feature, "Chưa thuộc layer")
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentsView({
  segments,
  isPlaying,
  onSegmentClick,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
  onAddLocation,
  onAddZone,
  onAddLayer,
  onAddRouteAnimation,
  mapId,
}: {
  segments: Segment[];
  isPlaying?: boolean;
  onSegmentClick: (segmentId: string) => void;
  onAddSegment: () => void;
  onEditSegment: (segment: Segment) => void;
  onDeleteSegment?: (segmentId: string) => void;
  onAddLocation?: (segmentId: string) => void;
  onAddZone?: (segmentId: string) => void;
  onAddLayer?: (segmentId: string) => void;
  onAddRouteAnimation?: (segmentId: string) => void;
  mapId?: string;
}) {
  const { confirmDelete } = useConfirmDialogContext();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSegments = segments.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteSegment = (segmentId: string, segmentName: string) => {
    confirmDelete(
      async () => {
        if (onDeleteSegment) {
          onDeleteSegment(segmentId);
        }
      },
      {
        title: "Delete Segment",
        message: `Are you sure you want to delete segment "${segmentName}"? This action will remove all associated locations, zones, layers, and route animations. This cannot be undone.`,
        itemType: "segment"
      }
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-zinc-800/80">
        <div className="relative">
          <Icon icon="mdi:magnify" className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search segments..."
            className="w-full pl-8 pr-2 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-dark p-2">
        {filteredSegments.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <Icon icon="mdi:filmstrip-off" className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
            <p className="text-xs text-zinc-500 italic">No segments</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredSegments.map((segment) => (
              <div
                key={segment.segmentId}
                className="group/item p-2.5 rounded-lg border border-zinc-800/50 hover:border-zinc-700/80 hover:bg-zinc-800/30 transition-all cursor-pointer"
                onClick={() => onSegmentClick(segment.segmentId)}
              >
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon
                      icon="mdi:filmstrip-box"
                      className="w-4 h-4 text-emerald-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-zinc-200 truncate">
                        {segment.name}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPlaying) {
                              onEditSegment(segment);
                            }
                          }}
                          disabled={isPlaying}
                          className={cn(
                            "p-1 rounded",
                            isPlaying
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-zinc-700"
                          )}
                          title={isPlaying ? "Cannot edit while playing" : "Edit segment"}
                        >
                          <Icon icon="mdi:pencil" className={cn("w-3.5 h-3.5", isPlaying ? "text-zinc-600" : "text-blue-400")} />
                        </button>
                        {onDeleteSegment && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isPlaying) {
                                handleDeleteSegment(segment.segmentId, segment.name);
                              }
                            }}
                            disabled={isPlaying}
                            className={cn(
                              "p-1 rounded",
                              isPlaying
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-zinc-700"
                            )}
                            title={isPlaying ? "Cannot delete while playing" : "Delete segment"}
                          >
                            <Icon icon="mdi:delete-outline" className={cn("w-3.5 h-3.5", isPlaying ? "text-zinc-600" : "text-red-400")} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Icon icon="mdi:clock-outline" className="w-3 h-3" />
                        {(segment.durationMs / 1000).toFixed(1)}s
                      </span>
                      {segment.description && (
                        <span className="truncate italic">
                          {segment.description}
                        </span>
                      )}
                    </div>

                    {/* Display attached items - Compact badges */}
                    {(segment.zones?.length > 0 || segment.locations?.length > 0 || segment.layers?.length > 0) && (
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        {segment.locations && segment.locations.length > 0 && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/15 rounded text-[9px] text-emerald-400 border border-emerald-500/20">
                            <Icon icon="mdi:map-marker" className="w-2.5 h-2.5" />
                            <span className="font-medium">{segment.locations.length}</span>
                          </div>
                        )}
                        {segment.zones && segment.zones.length > 0 && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/15 rounded text-[9px] text-blue-400 border border-blue-500/20">
                            <Icon icon="mdi:shape" className="w-2.5 h-2.5" />
                            <span className="font-medium">{segment.zones.length}</span>
                          </div>
                        )}
                        {segment.layers && segment.layers.length > 0 && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/15 rounded text-[9px] text-purple-400 border border-purple-500/20">
                            <Icon icon="mdi:layers" className="w-2.5 h-2.5" />
                            <span className="font-medium">{segment.layers.length}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {mapId && (onAddLocation || onAddZone || onAddLayer || onAddRouteAnimation) && (
                      <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center gap-1.5 flex-wrap">
                        {onAddLocation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddLocation(segment.segmentId);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-emerald-600/40 to-emerald-500/30 hover:from-emerald-600/60 hover:to-emerald-500/50 border border-emerald-500/40 hover:border-emerald-400/60 text-emerald-300 hover:text-emerald-100 transition-all text-[10px] font-semibold shadow-sm hover:shadow-md"
                            title="Add location"
                          >
                            <Icon icon="mdi:map-marker" className="w-3.5 h-3.5" />
                            <span>Location</span>
                          </button>
                        )}
                        {onAddZone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddZone(segment.segmentId);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-blue-600/40 to-blue-500/30 hover:from-blue-600/60 hover:to-blue-500/50 border border-blue-500/40 hover:border-blue-400/60 text-blue-300 hover:text-blue-100 transition-all text-[10px] font-semibold shadow-sm hover:shadow-md"
                            title="Add zone"
                          >
                            <Icon icon="mdi:shape" className="w-3.5 h-3.5" />
                            <span>Zone</span>
                          </button>
                        )}
                        {onAddLayer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddLayer(segment.segmentId);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-purple-600/40 to-purple-500/30 hover:from-purple-600/60 hover:to-purple-500/50 border border-purple-500/40 hover:border-purple-400/60 text-purple-300 hover:text-purple-100 transition-all text-[10px] font-semibold shadow-sm hover:shadow-md"
                            title="Attach layer"
                          >
                            <Icon icon="mdi:layers" className="w-3.5 h-3.5" />
                            <span>Layer</span>
                          </button>
                        )}
                        {onAddRouteAnimation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddRouteAnimation(segment.segmentId);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-orange-600/40 to-orange-500/30 hover:from-orange-600/60 hover:to-orange-500/50 border border-orange-500/40 hover:border-orange-400/60 text-orange-300 hover:text-orange-100 transition-all text-[10px] font-semibold shadow-sm hover:shadow-md"
                            title="Add route animation"
                          >
                            <Icon icon="mdi:route" className="w-3.5 h-3.5" />
                            <span>Route</span>
                          </button>
                        )}
                        {mapId && (
                          <PlayRouteButton
                            segmentId={segment.segmentId}
                            mapId={mapId}
                            compact={true}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Segment Button - Fixed at bottom */}
      <div className="p-2 border-t border-zinc-800/80 bg-zinc-950/30">
        <button
          onClick={onAddSegment}
          className="w-full py-2 px-3 bg-emerald-600/90 hover:bg-emerald-600 rounded-md flex items-center justify-center gap-2 transition-colors text-sm font-medium text-white"
        >
          <Icon icon="mdi:plus-circle-outline" className="w-4 h-4" />
          <span>New Segment</span>
        </button>
      </div>

    </div>
  );
}

// Component to display and manage segment items (zones, locations, layers, routes)
export function SegmentItemsList({
  segmentId,
  mapId,
  segment,
  onAddLocation,
  onAddZone,
  onAddLayer,
  onAddRouteAnimation,
}: {
  segmentId: string;
  mapId: string;
  segment: Segment;
  onAddLocation: () => void;
  onAddZone: () => void;
  onAddLayer: () => void;
  onAddRouteAnimation?: () => void;
}) {
  const { confirmDelete } = useConfirmDialogContext();
  const [routeAnimations, setRouteAnimations] = useState<RouteAnimation[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // Load route animations on mount or when segmentId changes
  const loadRouteAnimations = useCallback(() => {
    if (!mapId || !segmentId) return;

    setIsLoadingRoutes(true);

    getRouteAnimationsBySegment(mapId, segmentId)
      .then((routes) => {
        setRouteAnimations(routes || []);
      })
      .catch((e) => {
        console.error("Failed to load route animations:", e);
      })
      .finally(() => {
        setIsLoadingRoutes(false);
      });
  }, [mapId, segmentId]);

  useEffect(() => {
    loadRouteAnimations();
  }, [loadRouteAnimations]);

  // Listen for route animation changes to refresh the list
  useEffect(() => {
    const handleRouteAnimationChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ segmentId: string }>;
      if (customEvent.detail?.segmentId === segmentId) {
        loadRouteAnimations();
      }
    };

    window.addEventListener('routeAnimationChanged', handleRouteAnimationChanged);
    return () => {
      window.removeEventListener('routeAnimationChanged', handleRouteAnimationChanged);
    };
  }, [segmentId, loadRouteAnimations]);

  const handleDeleteZone = async (segmentZoneId: string) => {
    confirmDelete(
      async () => {
        try {
          await deleteSegmentZone(mapId, segmentId, segmentZoneId);
          // Dispatch event to refresh segments
          window.dispatchEvent(new CustomEvent("zoneDeleted", {
            detail: { segmentId }
          }));
        } catch (e) {
          console.error("Failed to delete zone:", e);
          toast.error("Failed to remove zone");
        }
      },
      {
        title: t("mapEditor", "removeZoneFromSegmentTitle"),
        message: t("mapEditor", "removeZoneFromSegmentMessage"),
        itemType: "zone"
      }
    );
  };

  const handleDeleteLocation = async (locationId: string) => {
    confirmDelete(
      async () => {
        try {
          await deleteLocation(mapId, segmentId, locationId);
          // Dispatch event to refresh segments
          window.dispatchEvent(new CustomEvent("locationDeleted", {
            detail: { segmentId }
          }));
        } catch (e) {
          console.error("Failed to delete location:", e);
          toast.error("Failed to remove location");
        }
      },
      {
        title: t("mapEditor", "removeLocationFromSegmentTitle"),
        message: t("mapEditor", "removeLocationFromSegmentMessage"),
        itemType: "location"
      }
    );
  };

  const handleDeleteLayer = async (layerId: string) => {
    confirmDelete(
      async () => {
        try {
          await detachLayerFromSegment(mapId, segmentId, layerId);
          // Dispatch event to refresh segments
          window.dispatchEvent(new CustomEvent("layerDeleted", {
            detail: { segmentId }
          }));
        } catch (e) {
          console.error("Failed to delete layer:", e);
          toast.error("Failed to remove layer");
        }
      },
      {
        title: t("mapEditor", "removeLayerFromSegmentTitle"),
        message: t("mapEditor", "removeLayerFromSegmentMessage"),
        itemType: "layer"
      }
    );
  };

  const handleDeleteRoute = async (routeAnimationId: string) => {
    confirmDelete(
      async () => {
        try {
          await deleteRouteAnimation(mapId, segmentId, routeAnimationId);
          setRouteAnimations(prev => prev.filter(r => r.routeAnimationId !== routeAnimationId));
        } catch (e) {
          console.error("Failed to delete route:", e);
          toast.error("Failed to delete route animation");
        }
      },
      {
        title: t("mapEditor", "deleteRouteAnimationTitle"),
        message: t("mapEditor", "deleteRouteAnimationMessage"),
        itemType: "route animation"
      }
    );
  };

  const zones = segment.zones || [];
  const locations = segment.locations || [];
  const layers = segment.layers || [];

  return (
    <div className="p-3 space-y-3 overflow-y-auto scrollbar-dark">
      {/* Locations */}
      {locations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="mdi:map-marker" className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-300">Locations</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px]">
              {locations.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {locations.map((location) => (
              <div
                key={location.locationId}
                className="p-2 rounded-lg border border-zinc-700/80 hover:border-zinc-600 group bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Show actual icon or default marker */}
                      {location.iconUrl ? (
                        <img src={location.iconUrl} alt="" className="w-3 h-3 object-contain flex-shrink-0" />
                      ) : location.iconType ? (
                        <span className="text-sm flex-shrink-0">
                          {iconEmojiMap[location.iconType] || location.iconType || "📍"}
                        </span>
                      ) : (
                        <Icon icon="mdi:map-marker" className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-white truncate">
                        {location.title || "Unnamed Location"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLocation(location.locationId || "")}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                    title="Remove location"
                  >
                    <Icon icon="mdi:delete-outline" className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zones */}
      {zones.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="mdi:shape" className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-zinc-300">Zones</span>
            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
              {zones.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {zones.map((segmentZone) => (
              <div
                key={segmentZone.segmentZoneId}
                className="p-2 rounded-lg border border-zinc-700/80 hover:border-zinc-600 group bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon icon="mdi:shape" className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white truncate">
                        {segmentZone.zone?.name || "Unnamed Zone"}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap ml-5">
                      {segmentZone.fillZone && (
                        <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded">
                          Fill
                        </span>
                      )}
                      {segmentZone.highlightBoundary && (
                        <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded">
                          Boundary
                        </span>
                      )}
                      {segmentZone.showLabel && (
                        <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded">
                          Label
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteZone(segmentZone.segmentZoneId)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                    title="Remove zone"
                  >
                    <Icon icon="mdi:delete-outline" className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layers */}
      {layers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="mdi:layers" className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-zinc-300">Layers</span>
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
              {layers.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {layers.map((segmentLayer: SegmentLayer) => (
              <div
                key={segmentLayer.segmentLayerId}
                className="p-2 rounded-lg border border-zinc-700/80 hover:border-zinc-600 group bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon icon="mdi:layers" className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white truncate">
                        {segmentLayer.layerId || "Unnamed Layer"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLayer(segmentLayer.layerId)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                    title="Remove layer"
                  >
                    <Icon icon="mdi:delete-outline" className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routes */}
      {isLoadingRoutes ? (
        <div className="text-center py-4">
          <p className="text-xs text-zinc-500">Loading routes...</p>
        </div>
      ) : routeAnimations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="mdi:route" className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-zinc-300">Routes</span>
            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px]">
              {routeAnimations.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {routeAnimations.map((route) => (
              <div
                key={route.routeAnimationId}
                className="p-2 rounded-lg border border-zinc-700/80 hover:border-zinc-600 group bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon icon="mdi:route" className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white truncate">
                        {route.fromName || "From"} → {route.toName || "To"}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap ml-5">
                      <span className="px-1 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] rounded">
                        {(route.durationMs / 1000).toFixed(1)}s
                      </span>
                      <span className="px-1 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] rounded">
                        {route.iconType}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRoute(route.routeAnimationId)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                    title="Delete route"
                  >
                    <Icon icon="mdi:delete-outline" className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {locations.length === 0 && zones.length === 0 && layers.length === 0 && !isLoadingRoutes && routeAnimations.length === 0 && (
        <div className="text-center py-8">
          <Icon icon="mdi:inbox-outline" className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">No items attached</p>
        </div>
      )}

    </div>
  );
}

// Component to play route animation without camera state
function PlayRouteButton({
  segmentId,
  mapId,
  compact = false
}: {
  segmentId: string;
  mapId: string;
  compact?: boolean;
}) {
  const [isPlayingRoute, setIsPlayingRoute] = useState(false);

  useEffect(() => {
    // Listen for stop events
    const handleStop = () => {
      setIsPlayingRoute(false);
    };

    window.addEventListener('routeAnimationStopped', handleStop);
    return () => {
      window.removeEventListener('routeAnimationStopped', handleStop);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        if (isPlayingRoute) {
          setIsPlayingRoute(false);
          // Stop animation by dispatching stop event
          window.dispatchEvent(new CustomEvent('stopRouteAnimation'));
        } else {
          try {
            setIsPlayingRoute(true);
            const animations = await getRouteAnimationsBySegment(mapId, segmentId);
            if (animations && animations.length > 0) {
              // Trigger route animation playback
              window.dispatchEvent(new CustomEvent('playRouteAnimation', {
                detail: { segmentId, animations }
              }));
            } else {
              alert("Không có route animation nào trong segment này");
              setIsPlayingRoute(false);
            }
          } catch (e) {
            console.error("Failed to play route animation:", e);
            alert("Lỗi khi play route animation");
            setIsPlayingRoute(false);
          }
        }
      }}
      className={compact
        ? "flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 hover:text-green-300 transition-all"
        : "px-2 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium flex items-center justify-center gap-1"
      }
      title="Play route animation (không zoom camera)"
    >
      <Icon icon={isPlayingRoute ? "mdi:stop" : "mdi:play"} className={compact ? "w-3 h-3" : "w-4 h-4"} />
      {compact && <span className="text-[10px] font-medium">{isPlayingRoute ? "Stop" : "Play"}</span>}
      {!compact && <span>{isPlayingRoute ? "Stop" : "Play Route"}</span>}
    </button>
  );
}

function SegmentFormView({
  editing,
  currentMap,
  mapId,
  onCancel,
  onSave,
  onAddLocation,
  onAddZone,
  onAddLayer,
  onAddRouteAnimation,
}: {
  editing: Segment | null;
  currentMap?: any;
  mapId?: string;
  onCancel: () => void;
  onSave: (data: CreateSegmentRequest) => Promise<void>;
  onAddLocation: () => void;
  onAddZone: () => void;
  onAddLayer: () => void;
  onAddRouteAnimation?: () => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<Location[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  type SearchMode = "location" | "zone";

  const [searchMode, setSearchMode] = useState<SearchMode>("location");

  const [zoneSearchQuery, setZoneSearchQuery] = useState("");
  const [zoneResults, setZoneResults] = useState<Zone[]>([]);
  const [isSearchingZone, setIsSearchingZone] = useState(false);

  const extractCameraState = useCallback(
    (source?: Segment | null): CameraState | null => {
      if (!source?.cameraState) return null;
      if (typeof source.cameraState === "string") {
        const parsed = parseCameraState(source.cameraState);
        return parsed ?? null;
      }
      if (typeof source.cameraState === "object") {
        return source.cameraState as CameraState;
      }
      return null;
    },
    []
  );

  const [cameraState, setCameraState] = useState<CameraState>(() => {
    const fromEditing = extractCameraState(editing);
    if (fromEditing) return fromEditing;
    if (currentMap) {
      try {
        const current = getCurrentCameraState(currentMap);
        if (current) return current;
      } catch (error) {
        console.warn("Failed to get current camera state:", error);
      }
    }
    return {
      center: [106.63, 10.82],
      zoom: 12,
      bearing: 0,
      pitch: 0,
    };
  });

  const [autoAdvance, setAutoAdvance] = useState(editing?.autoAdvance ?? true);
  const [durationMs, setDurationMs] = useState(editing?.durationMs || 6000);
  const [isSaving, setIsSaving] = useState(false);

  // Automatically capture camera state when component mounts or map changes
  // Only auto-capture if not editing an existing segment (to preserve existing camera state)
  useEffect(() => {
    const fromEditing = extractCameraState(editing);
    if (fromEditing) {
      setCameraState(fromEditing);
    }
  }, [editing?.segmentId, editing?.cameraState, extractCameraState]);

  useEffect(() => {
    if (!currentMap) return;
    if (typeof currentMap.getCenter !== "function" || typeof currentMap.getZoom !== "function") {
      return;
    }

    const captureCamera = () => {
      try {
        const captured = getCurrentCameraState(currentMap);
        if (captured) {
          setCameraState(captured);
        }
      } catch (error) {
        console.error("Failed to capture camera state:", error);
      }
    };

    if (!editing?.cameraState) {
      captureCamera();
    }

    const handleMapMove = () => {
      captureCamera();
    };

    currentMap.on("moveend", handleMapMove);
    currentMap.on("zoomend", handleMapMove);

    return () => {
      if (currentMap) {
        currentMap.off("moveend", handleMapMove);
        currentMap.off("zoomend", handleMapMove);
      }
    };
  }, [currentMap, editing?.cameraState]);


  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      console.log('=== Segment Submit Debug ===');
      console.log('durationMs state value:', durationMs);
      console.log('autoAdvance:', autoAdvance);
      console.log('Full save data:', {
        name,
        description,
        cameraState: stringifyCameraState(cameraState),
        playbackMode: autoAdvance ? "Auto" : "Manual",
        durationMs,
        autoAdvance,
      });

      await onSave({
        name,
        description,
        cameraState: stringifyCameraState(cameraState),
        playbackMode: autoAdvance ? "Auto" : "Manual",
        durationMs,
        autoAdvance,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* Segment Name */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Segment name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
          placeholder="e.g., Explore District 1"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 resize-none"
          placeholder="Brief description..."
        />
      </div>

      {/* Camera View */}
      <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
        <div>
          <h4 className="text-xs font-semibold text-white">Camera view</h4>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <div className="text-zinc-500 mb-0.5 text-[10px]">Center</div>
            <div className="text-white font-mono text-[11px]">
              {cameraState.center[0].toFixed(4)}, {cameraState.center[1].toFixed(4)}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <div className="text-zinc-500 mb-0.5 text-[10px]">Zoom</div>
            <div className="text-white font-mono text-[11px]">
              {cameraState.zoom.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Playback */}
      <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
        <div>
          <h4 className="text-xs font-semibold text-white">Playback</h4>
          <p className="text-[10px] text-zinc-400">
            Control how long this segment is visible.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={e => setAutoAdvance(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
          />
          Auto advance to next segment
        </label>

        {autoAdvance && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Duration (seconds)</label>
            <input
              type="number"
              value={durationMs / 1000}
              onChange={e => {
                const inputValue = e.target.value;
                const parsedValue = parseInt(inputValue);
                const finalValue = Math.max(1, parsedValue || 1) * 1000;
                console.log('Duration input changed:', {
                  inputValue,
                  parsedValue,
                  finalValue,
                });
                setDurationMs(finalValue);
              }}
              min={1}
              max={60}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
            />
          </div>
        )}
      </div>


      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || isSaving}
          className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : editing ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}

function TransitionsView({
  transitions,
  segments,
  onAddTransition,
  onEditTransition,
  onDeleteTransition,
}: {
  transitions: TimelineTransition[];
  segments: Segment[];
  onAddTransition: () => void;
  onEditTransition: (transition: TimelineTransition) => void;
  onDeleteTransition?: (transitionId: string) => void;
}) {
  const { confirmDelete } = useConfirmDialogContext();
  const { t } = useI18n();

  const handleDeleteTransition = (transitionId: string) => {
    confirmDelete(
      async () => {
        if (onDeleteTransition) {
          onDeleteTransition(transitionId);
        }
      },
      {
        title: t("mapEditor", "deleteTransitionTitle"),
        message: t("mapEditor", "deleteTransitionMessage"),
        itemType: "transition"
      }
    );
  };

  return (
    <div className="p-3 space-y-2">
      {transitions.length === 0 ? (
        <p className="text-xs text-zinc-500 italic py-2">No transitions</p>
      ) : (
        <div className="space-y-2">
          {transitions.map((transition) => {
            const fromSegment = segments.find(
              (s) => s.segmentId === transition.fromSegmentId
            );
            const toSegment = segments.find(
              (s) => s.segmentId === transition.toSegmentId
            );

            return (
              <div
                key={transition.timelineTransitionId}
                className="p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 group"
              >
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-zinc-300 truncate">
                      {fromSegment?.name || "Unknown"}
                    </span>
                    <Icon
                      icon="mdi:arrow-right"
                      className="text-blue-500 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-zinc-300 truncate">
                      {toSegment?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditTransition(transition)}
                      className="p-1 hover:bg-zinc-700 rounded"
                      title="Edit transition"
                    >
                      <Icon icon="mdi:pencil" className="w-4 h-4 text-blue-400" />
                    </button>
                    {onDeleteTransition && (
                      <button
                        onClick={() => {
                          handleDeleteTransition(transition.timelineTransitionId);
                        }}
                        className="p-1 hover:bg-zinc-700 rounded"
                        title="Delete transition"
                      >
                        <Icon icon="mdi:delete-outline" className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                    {transition.cameraAnimationType}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">
                    {(transition.durationMs / 1000).toFixed(1)}s
                  </span>
                  {transition.showOverlay && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                      Overlay
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Transition Button */}
      <button
        onClick={onAddTransition}
        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center justify-center gap-2 transition-colors"
      >
        <Icon icon="mdi:plus-circle-outline" className="w-5 h-5" />
        <span className="text-sm font-medium">Create Transition</span>
      </button>

    </div>
  );
}

function TransitionFormView({
  editing,
  segments,
  onCancel,
  onSave,
}: {
  editing: TimelineTransition | null;
  segments: Segment[];
  onCancel: () => void;
  onSave: (data: CreateTransitionRequest) => Promise<void>;
}) {
  const [fromSegmentId, setFromSegmentId] = useState(editing?.fromSegmentId || "");
  const [toSegmentId, setToSegmentId] = useState(editing?.toSegmentId || "");
  const [transitionName, setTransitionName] = useState(editing?.transitionName || "");
  const [durationMs, setDurationMs] = useState(editing?.durationMs || 3000);
  const [transitionType, setTransitionType] = useState<FrontendTransitionType>(
    editing?.transitionType ? mapFromBackendTransitionType(editing.transitionType) : "Ease"
  );

  const [animateCamera, setAnimateCamera] = useState(editing?.animateCamera ?? true);
  const [cameraAnimationType, setCameraAnimationType] = useState<"Jump" | "Ease" | "Fly">(
    editing?.cameraAnimationType || "Ease"
  );
  const [cameraAnimationDurationMs, setCameraAnimationDurationMs] = useState(
    editing?.cameraAnimationDurationMs || 2000
  );

  const [showOverlay, setShowOverlay] = useState(editing?.showOverlay ?? false);
  const [overlayContent, setOverlayContent] = useState(editing?.overlayContent || "");

  const [autoTrigger, setAutoTrigger] = useState(editing?.autoTrigger ?? true);
  const [requireUserAction, setRequireUserAction] = useState(editing?.requireUserAction ?? false);

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!fromSegmentId || !toSegmentId) return;

    setIsSaving(true);
    try {
      await onSave({
        fromSegmentId,
        toSegmentId,
        transitionName: transitionName || undefined,
        durationMs,
        transitionType: mapToBackendTransitionType(transitionType),
        animateCamera,
        cameraAnimationType,
        cameraAnimationDurationMs,
        showOverlay,
        overlayContent: overlayContent || undefined,
        autoTrigger,
        requireUserAction,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* From Segment */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">From segment *</label>
        <select
          value={fromSegmentId}
          onChange={e => setFromSegmentId(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
        >
          <option value="">Select segment...</option>
          {segments.map(seg => (
            <option key={seg.segmentId} value={seg.segmentId}>
              {seg.name}
            </option>
          ))}
        </select>
      </div>

      {/* To Segment */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">To segment *</label>
        <select
          value={toSegmentId}
          onChange={e => setToSegmentId(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
        >
          <option value="">Select segment...</option>
          {segments.map(seg => (
            <option key={seg.segmentId} value={seg.segmentId}>
              {seg.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transition Name */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Transition name</label>
        <input
          type="text"
          value={transitionName}
          onChange={e => setTransitionName(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
          placeholder="e.g. Smooth zoom to city"
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Duration (ms)</label>
        <input
          type="number"
          value={durationMs}
          onChange={e => setDurationMs(Math.max(100, parseInt(e.target.value) || 100))}
          min={100}
          step={100}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
        />
      </div>

      {/* Transition Type */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Transition curve</label>
        <select
          value={transitionType}
          onChange={e => setTransitionType(e.target.value as FrontendTransitionType)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
        >
          <option value="Jump">Jump (instant)</option>
          <option value="Linear">Linear (constant speed)</option>
          <option value="Ease">Ease (smooth)</option>
          <option value="EaseIn">Ease In (slow start)</option>
          <option value="EaseOut">Ease Out (slow end)</option>
          <option value="EaseInOut">Ease In Out (smooth both ends)</option>
        </select>
      </div>

      {/* Animate Camera */}
      <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
        <label className="flex items-center gap-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={animateCamera}
            onChange={e => setAnimateCamera(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-blue-500 focus:ring-blue-500"
          />
          Animate camera
        </label>

        {animateCamera && (
          <>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Camera animation type</label>
              <select
                value={cameraAnimationType}
                onChange={e => setCameraAnimationType(e.target.value as any)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
              >
                <option value="Jump">Jump</option>
                <option value="Ease">Ease</option>
                <option value="Fly">Fly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Camera duration (ms)</label>
              <input
                type="number"
                value={cameraAnimationDurationMs}
                onChange={e => setCameraAnimationDurationMs(Math.max(100, parseInt(e.target.value) || 100))}
                min={100}
                step={100}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
              />
            </div>
          </>
        )}
      </div>

      {/* Show Overlay */}
      <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
        <label className="flex items-center gap-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={showOverlay}
            onChange={e => setShowOverlay(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-purple-500 focus:ring-purple-500"
          />
          Show overlay
        </label>

        {showOverlay && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Overlay content</label>
            <textarea
              value={overlayContent}
              onChange={e => setOverlayContent(e.target.value)}
              rows={3}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80 resize-none"
              placeholder="Explain what's happening..."
            />
          </div>
        )}
      </div>

      {/* Auto Trigger */}
      <label className="flex items-center gap-2 text-xs text-zinc-200">
        <input
          type="checkbox"
          checked={autoTrigger}
          onChange={e => setAutoTrigger(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
        />
        Auto trigger (starts when previous segment finishes)
      </label>

      {/* Require User Action */}
      <label className="flex items-center gap-2 text-xs text-zinc-200">
        <input
          type="checkbox"
          checked={requireUserAction}
          onChange={e => setRequireUserAction(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-orange-500 focus:ring-orange-500"
        />
        Require user action (show continue button)
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!fromSegmentId || !toSegmentId || isSaving}
          className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : editing ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}

function getFeatureIcon(type: string): string {
  const typeMap: Record<string, string> = {
    marker: "mdi:map-marker",
    line: "mdi:vector-polyline",
    polygon: "mdi:shape-polygon-plus",
    circle: "mdi:circle-outline",
    rectangle: "mdi:square-outline",
  };

  return typeMap[type.toLowerCase()] || "mdi:map-marker";
}

// Map Locations View - for non-StoryMap mode (locations directly on map, not via segments)
function MapLocationsView({
  mapId,
  currentMap,
  onShowLocationForm,
  onEditLocation,
}: {
  mapId?: string;
  currentMap?: any;
  onShowLocationForm?: () => void;
  onEditLocation?: (location: Location) => void;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    if (!mapId) return;

    try {
      setLoading(true);
      const { getMapLocations } = await import("@/lib/api-location");
      const data = await getMapLocations(mapId);
      setLocations((data || []) as unknown as Location[]);
    } catch (error) {
      console.error("Failed to load map locations:", error);
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Listen for location changes
  useEffect(() => {
    const handleLocationChange = () => {
      loadLocations();
    };

    window.addEventListener("locationCreated", handleLocationChange);
    window.addEventListener("locationUpdated", handleLocationChange);
    window.addEventListener("locationDeleted", handleLocationChange);

    return () => {
      window.removeEventListener("locationCreated", handleLocationChange);
      window.removeEventListener("locationUpdated", handleLocationChange);
      window.removeEventListener("locationDeleted", handleLocationChange);
    };
  }, [loadLocations]);

  const handleAddLocation = () => {
    if (onShowLocationForm) {
      onShowLocationForm();
    }
  };

  const handleLocationClick = (location: Location) => {
    // Zoom to location on map
    if (currentMap && location.markerGeometry) {
      try {
        const geo = JSON.parse(location.markerGeometry);
        if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
          const [lng, lat] = geo.coordinates;
          currentMap.setView([lat, lng], 16, { animate: true });
        }
      } catch (e) {
        console.error("Failed to parse location geometry:", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400">
        <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {/* Add Location Button */}
      <button
        onClick={handleAddLocation}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
      >
        <Icon icon="mdi:plus" className="w-4 h-4" />
        Add Location
      </button>

      {locations.length === 0 ? (
        <div className="p-4 text-center text-zinc-500 text-sm">
          <Icon icon="mdi:map-marker-off" className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No locations yet</p>
          <p className="text-xs mt-1 text-zinc-600">Click the button above to add a location</p>
        </div>
      ) : (
        <div className="space-y-1">
          {locations.map((location) => (
            <div
              key={location.locationId}
              className="flex items-center gap-2 p-2 rounded-md bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-zinc-700/50 group"
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center text-lg cursor-pointer"
                onClick={() => handleLocationClick(location)}
                title="Zoom to location"
              >
                {location.iconUrl ? (
                  <img src={location.iconUrl} alt={location.title} className="w-6 h-6 object-contain" />
                ) : location.iconType ? (
                  iconEmojiMap[location.iconType] || location.iconType || "📍"
                ) : (
                  "📍"
                )}
              </div>

              {/* Info */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleLocationClick(location)}
              >
                <div className="text-sm font-medium text-zinc-200 truncate">
                  {location.title || "Untitled Location"}
                </div>
                {location.subtitle && (
                  <div className="text-xs text-zinc-500 truncate">{location.subtitle}</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Play Audio Button */}
                {(location as any).audioUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const audio = new Audio((location as any).audioUrl);
                      audio.play().catch(err => console.warn('Audio play failed:', err));
                    }}
                    className="p-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
                    title="Play audio"
                  >
                    <Icon icon="mdi:play" className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Edit Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditLocation?.(location);
                  }}
                  className="p-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                  title="Edit location"
                >
                  <Icon icon="mdi:pencil" className="w-3.5 h-3.5" />
                </button>

                {/* Delete Button */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm("Bạn có chắc muốn xóa location này?")) return;
                    try {
                      const { deleteLocation } = await import("@/lib/api-location");
                      await deleteLocation(location.locationId);
                      window.dispatchEvent(new CustomEvent("locationDeleted"));
                    } catch (err) {
                      console.error("Failed to delete location:", err);
                    }
                  }}
                  className="p-1.5 rounded bg-red-600/80 hover:bg-red-500 text-white transition-colors"
                  title="Delete location"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Map Zones View - for non-StoryMap mode (zones directly on map, not via segments)
function MapZonesView({ mapId }: { mapId?: string }) {
  const { confirmDelete } = useConfirmDialogContext();
  const { t } = useI18n();
  const [zones, setZones] = useState<import("@/lib/api-maps").MapZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadZones = async () => {
    if (!mapId) return;
    setLoading(true);
    setError(null);
    try {
      const { getMapZones } = await import("@/lib/api-maps");
      const data = await getMapZones(mapId);
      setZones(data || []);
    } catch (err) {
      console.error("Failed to load map zones:", err);
      setError("Không thể tải danh sách zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, [mapId]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => loadZones();
    window.addEventListener("refreshMapZones", handleRefresh);
    return () => window.removeEventListener("refreshMapZones", handleRefresh);
  }, [mapId]);

  const handleCreateZone = async (data: import("@/lib/api-maps").CreateMapZoneRequest) => {
    if (!mapId) return;
    try {
      const { createMapZone } = await import("@/lib/api-maps");
      await createMapZone(mapId, data);
      setShowForm(false);
      loadZones();
      // Dispatch event to refresh zones on map
      window.dispatchEvent(new CustomEvent("refreshMapZones"));
    } catch (err) {
      console.error("Failed to create map zone:", err);
      throw err;
    }
  };

  const handleDeleteZone = async (mapZoneId: string) => {
    confirmDelete(
      async () => {
        if (!mapId) return;
        try {
          const { deleteMapZone } = await import("@/lib/api-maps");
          await deleteMapZone(mapId, mapZoneId);
          loadZones();
          // Dispatch event to refresh zones on map
          window.dispatchEvent(new CustomEvent("refreshMapZones"));
        } catch (err) {
          console.error("Failed to delete map zone:", err);
          toast.error("Không thể xóa zone. Vui lòng thử lại.");
        }
      },
      {
        title: t("mapEditor", "deleteZoneTitle"),
        message: t("mapEditor", "deleteZoneMessage"),
        itemType: "zone"
      }
    );
  };

  if (showForm) {
    return (
      <MapZoneFormWrapper
        mapId={mapId || ""}
        onSave={handleCreateZone}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Add button */}
      <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-medium">Zones ({zones.length})</span>
        <button
          onClick={() => setShowForm(true)}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center gap-1"
          disabled={!mapId}
        >
          <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
          Thêm Zone
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-dark">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <div className="text-xs text-zinc-400">Đang tải...</div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-xs">{error}</div>
        ) : zones.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm">
            <Icon icon="mdi:vector-polygon" className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Chưa có zone nào</p>
            <p className="text-xs mt-1 text-zinc-600">
              Nhấn "Thêm Zone" để thêm zone vào bản đồ
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {zones.map((zone) => (
              <div
                key={zone.mapZoneId}
                className="p-2 hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-xs truncate">
                      {zone.zone?.name || "Zone"}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
                      {zone.zone?.zoneType && (
                        <span>{zone.zone.zoneType}</span>
                      )}
                      {zone.highlightBoundary && (
                        <span
                          className="w-3 h-3 rounded border"
                          style={{ borderColor: zone.boundaryColor || "#FFD700" }}
                        />
                      )}
                      {zone.fillZone && (
                        <span
                          className="w-3 h-3 rounded"
                          style={{
                            backgroundColor: zone.fillColor || "#FFD700",
                            opacity: zone.fillOpacity || 0.3
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteZone(zone.mapZoneId)}
                    className="p-1 hover:bg-red-600/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t("mapEditor", "deleteZoneTooltip")}
                  >
                    <Icon icon="mdi:delete-outline" className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function SearchZoneView({ mapId, currentMap }: { mapId?: string; currentMap?: any }) {
  const [zones, setZones] = useState<import("@/lib/api-storymap").Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<import("@/lib/api-storymap").Zone | null>(null);
  const [qName, setQName] = useState("");
  const [qCity, setQCity] = useState("");
  const [qState, setQState] = useState("");
  const [qCountry, setQCountry] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const hasAnyQuery = useMemo(() => {
    return !!(qName.trim() || qCity.trim() || qState.trim() || qCountry.trim());
  }, [qName, qCity, qState, qCountry]);

  const handleSearch = async () => {
    if (!hasAnyQuery) {
      setZones([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchZones({
        name: qName.trim(),
        city: qCity.trim(),
        state: qState.trim(),
        country: qCountry.trim(),
      } as any);
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
      setZones([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToMap = async () => {
    if (!selectedZone || !currentMap || !mapId) {
      return;
    }

    setIsAdding(true);
    try {
      const { convertZoneToFeatureRequest, getZoneCenter } = await import("@/utils/zoneToFeature");
      const { createMapFeature } = await import("@/lib/api-maps");

      const featureRequest = convertZoneToFeatureRequest(selectedZone, mapId, null);
      if (!featureRequest) {
        alert("Failed to convert zone to feature. Unsupported geometry type.");
        return;
      }

      await createMapFeature(mapId, featureRequest);

      window.dispatchEvent(new Event("layerCreated"));

      const center = getZoneCenter(selectedZone);
      if (center) {
        currentMap.setView([center[1], center[0]], 10, { animate: true });
      }

      setSelectedZone(null);
      setQName("");
      setQCity("");
      setQState("");
      setQCountry("");
      setZones([]);
    } catch (error) {
      console.error("Failed to add zone to map:", error);
      alert("Failed to add zone to map. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const getGeometryType = (geometry: string): string => {
    try {
      const geoJson = JSON.parse(geometry);
      return geoJson.type || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">Name</div>
            <input
              type="text"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="VD: Đồng Tháp"
              className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              disabled={isSearching || isAdding}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">City</div>
            <input
              type="text"
              value={qCity}
              onChange={(e) => setQCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="VD: Cao Lãnh"
              className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              disabled={isSearching || isAdding}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">State</div>
            <input
              type="text"
              value={qState}
              onChange={(e) => setQState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="VD: Đồng Tháp"
              className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              disabled={isSearching || isAdding}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">Country</div>
            <input
              type="text"
              value={qCountry}
              onChange={(e) => setQCountry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="VD: Việt Nam"
              className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              disabled={isSearching || isAdding}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={isSearching || !hasAnyQuery || isAdding}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSearching ? (
              <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Icon icon="mdi:magnify" className="w-4 h-4 mr-1" />
                Tìm kiếm
              </>
            )}
          </button>

          <button
            onClick={() => {
              setQName("");
              setQCity("");
              setQState("");
              setQCountry("");
              setZones([]);
              setSelectedZone(null);
            }}
            disabled={isSearching || isAdding || !hasAnyQuery}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs transition-colors disabled:opacity-50"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-dark">
        {zones.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            <Icon icon="mdi:map-search" className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{hasAnyQuery ? "Không tìm thấy zone nào" : "Nhập từ khóa để tìm kiếm"}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {zones.map((zone) => {
              const geometryType = getGeometryType(zone.geometry);
              const isSelected = selectedZone?.zoneId === zone.zoneId;

              return (
                <button
                  key={zone.zoneId}
                  onClick={() => setSelectedZone(zone)}
                  disabled={isAdding}
                  className={`w-full text-left p-2 hover:bg-zinc-800/50 transition-colors disabled:opacity-50 ${
                    isSelected ? "bg-blue-900/30 border-l-4 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-xs truncate">{zone.name}</div>

                      {zone.description && (
                        <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{zone.description}</div>
                      )}

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                          {zone.zoneType}
                        </span>
                        {zone.adminLevel !== undefined && (
                          <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                            Level {zone.adminLevel}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                          {geometryType}
                        </span>
                      </div>
                    </div>

                    {isSelected && <Icon icon="mdi:check-circle" className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedZone && (
        <div className="p-3 border-t border-zinc-800">
          <button
            onClick={handleAddToMap}
            disabled={isAdding}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Đang thêm...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:plus-circle" className="w-4 h-4" />
                <span>Thêm "{selectedZone.name}" vào bản đồ</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper to dynamically load MapZoneForm
function MapZoneFormWrapper({
  mapId,
  onSave,
  onCancel,
}: {
  mapId: string;
  onSave: (data: import("@/lib/api-maps").CreateMapZoneRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [FormComponent, setFormComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import("@/components/map-editor-ui/forms/MapZoneForm").then((mod) => {
      setFormComponent(() => mod.MapZoneForm);
    });
  }, []);

  if (!FormComponent) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    );
  }

  return <FormComponent mapId={mapId} onSave={onSave} onCancel={onCancel} />;
}