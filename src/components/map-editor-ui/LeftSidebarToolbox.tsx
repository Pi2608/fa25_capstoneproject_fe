"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { BaseKey, LocationType } from "@/types";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import { addLayerToMap, getMapFeatures, updateMapFeature, type MapFeatureResponse } from "@/lib/api-maps";
import DeleteLayerDialog from "@/components/dialogs/DeleteLayerDialog";
import { handleDeleteLayerWithFeatures } from "@/utils/mapUtils";
import LayerTree from "@/components/map-editor-ui/LayerTree";
import { buildLayerTree, filterLayerTree } from "@/utils/layerTreeUtils";
import {
  type Segment,
  type TimelineTransition,
  type CameraState,
  type CreateSegmentRequest,
  type CreateTransitionRequest,
  type CreateLocationRequest,
  type CreateSegmentZoneRequest,
  type AttachLayerRequest,
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
  getZones,
  searchZones,
  getMapLocations,
  searchRouteWithMultipleLocations,
  createRouteAnimation,
  updateRouteAnimation,
  type CreateRouteAnimationRequest,
} from "@/lib/api-storymap";

interface LeftSidebarToolboxProps {
  activeView: "explorer" | "segments" | "transitions" | "icons" | null;
  onViewChange: (view: "explorer" | "segments" | "transitions" | "icons" | null) => void;


  features: FeatureData[];
  layers: LayerDTO[];
  segments: Segment[];
  transitions: TimelineTransition[];
  baseLayer: BaseKey;
  currentMap?: any;
  mapId?: string; // Required for adding locations, zones, and layers
  layerVisibility: Record<string, boolean>;
  featureVisibility: Record<string, boolean>;

  onSelectFeature: (feature: FeatureData) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onBaseLayerChange: (key: BaseKey) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onDeleteFeature: (featureId: string) => void;
  onSegmentClick: (segmentId: string) => void;

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

  // Refresh handler to reload layers without page reload
  onRefreshLayers?: () => Promise<void>;
}

type ViewType = "explorer" | "segments" | "transitions" | "icons";
type FormMode = "list" | "create" | "edit";
type PanelMode = "add-location" | "add-zone" | "add-layer" | "add-route" | null;

export function LeftSidebarToolbox({
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
  featureVisibility,
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
  onRefreshLayers,
}: LeftSidebarToolboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Form state for segments
  const [segmentFormMode, setSegmentFormMode] = useState<FormMode>("list");
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  // Form state for transitions
  const [transitionFormMode, setTransitionFormMode] = useState<FormMode>("list");
  const [editingTransition, setEditingTransition] = useState<TimelineTransition | null>(null);

  // Panel mode for next-step panels (location, zone, layer, route)
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] = useState<[number, number] | null>(null);

  // Handle map click when waiting for location
  useEffect(() => {
    if (!currentMap || !waitingForLocation || !editingSegment) return;

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      setPickedCoordinates([lng, lat]); // [longitude, latitude]
      setWaitingForLocation(false);
      setPanelMode("add-location"); // Open panel instead of dialog
    };

    currentMap.on('click', handleMapClick);

    return () => {
      currentMap.off('click', handleMapClick);
    };
  }, [currentMap, waitingForLocation, editingSegment]);

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
    // Reset form modes and panel modes when switching views
    setSegmentFormMode("list");
    setTransitionFormMode("list");
    setEditingSegment(null);
    setEditingTransition(null);
    setPanelMode(null);

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

  // Handlers for adding location, zone, and layer
  const handleAddLocation = useCallback(async (data: CreateLocationRequest) => {
    if (!editingSegment?.segmentId) return;

    const locationData = {
      ...data,
      segmentId: editingSegment.segmentId,
    };

    if (onAddLocation) {
      await onAddLocation(locationData);
    } else if (mapId) {
      // Use API directly if handler not provided
      const { createLocation } = await import("@/lib/api-storymap");
      await createLocation(mapId, editingSegment.segmentId, locationData);
    }

    setPanelMode(null); // Close panel
    setWaitingForLocation(false);
    setPickedCoordinates(null);

    // Trigger callback to refresh segments so the location appears
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshSegments'));
    }
  }, [editingSegment, onAddLocation, mapId]);

  const handleAddZone = useCallback(async (data: CreateSegmentZoneRequest) => {
    if (!editingSegment?.segmentId) return;

    const zoneData = {
      ...data,
      segmentId: editingSegment.segmentId,
    };

    if (onAddZone) {
      await onAddZone(zoneData);
    } else if (mapId) {
      // Use API directly if handler not provided
      const { createSegmentZone } = await import("@/lib/api-storymap");
      await createSegmentZone(mapId, editingSegment.segmentId, zoneData);
    }

    setPanelMode(null); // Close panel

    // Trigger callback to refresh segments so the zone appears
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshSegments'));
    }
  }, [editingSegment, onAddZone, mapId]);

  const handleAddLayer = useCallback(async (data: AttachLayerRequest) => {
    if (!editingSegment?.segmentId) return;

    if (onAddLayer) {
      await onAddLayer(data);
    } else if (mapId) {
      // Use API directly if handler not provided
      const { attachLayerToSegment } = await import("@/lib/api-storymap");
      await attachLayerToSegment(mapId, editingSegment.segmentId, data);
    }

    setPanelMode(null); // Close panel

    // Trigger refresh to show attached layer
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshSegments'));
    }
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
          <IconButton
            icon="mdi:toolbox-outline"
            label="Assets"
            isActive={activeView === "icons"}
            onClick={() => handleIconClick("icons")}
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
                {panelMode === "add-location" && "ADD LOCATION"}
                {panelMode === "add-zone" && "ADD ZONE"}
                {panelMode === "add-layer" && "ATTACH LAYER"}
                {panelMode === "add-route" && "ADD ROUTE ANIMATION"}
                {!panelMode && activeView === "explorer" && "PROJECT"}
                {!panelMode && activeView === "segments" && (segmentFormMode === "list" ? "SEGMENTS" : segmentFormMode === "create" ? "NEW SEGMENT" : "EDIT SEGMENT")}
                {!panelMode && activeView === "transitions" && (transitionFormMode === "list" ? "TRANSITIONS" : transitionFormMode === "create" ? "NEW TRANSITION" : "EDIT TRANSITION")}
                {!panelMode && activeView === "icons" && "ASSETS"}
              </span>
              {activeView === "explorer" && (
                <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded">
                  {features.length + layers.length}
                </span>
              )}
              {activeView === "segments" && segmentFormMode === "list" && (
                <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded">
                  {segments.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Back button for panel modes and forms */}
              {panelMode ? (
                <button
                  onClick={() => {
                    setPanelMode(null);
                    setWaitingForLocation(false);
                    setPickedCoordinates(null);
                  }}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Back"
                >
                  <Icon icon="mdi:arrow-left" className="w-4 h-4 text-zinc-400" />
                </button>
              ) : ((activeView === "segments" && segmentFormMode !== "list") ||
                (activeView === "transitions" && transitionFormMode !== "list")) && (
                  <button
                    onClick={() => {
                      if (activeView === "segments") handleCancelSegmentForm();
                      if (activeView === "transitions") handleCancelTransitionForm();
                    }}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                    title="Back to list"
                  >
                    <Icon icon="mdi:arrow-left" className="w-4 h-4 text-zinc-400" />
                  </button>
                )}

              {/* Close panel button (only show when in list mode and no panel mode) */}
              {!panelMode && ((activeView === "segments" && segmentFormMode === "list") ||
                (activeView === "transitions" && transitionFormMode === "list") ||
                activeView === "explorer" ||
                activeView === "icons") && (
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
          <div className="flex-1 overflow-y-auto">
            {/* Next-step panels for adding location, zone, layer, route */}
            {panelMode === "add-location" && editingSegment && mapId && (
              <LocationPanelView
                segmentId={editingSegment.segmentId}
                currentMap={currentMap}
                initialCoordinates={pickedCoordinates}
                onSave={handleAddLocation}
                onCancel={() => {
                  setPanelMode(null);
                  setWaitingForLocation(false);
                  setPickedCoordinates(null);
                }}
                waitingForLocation={waitingForLocation}
                setWaitingForLocation={setWaitingForLocation}
              />
            )}

            {panelMode === "add-zone" && editingSegment && mapId && (
              <ZonePanelView
                segmentId={editingSegment.segmentId}
                onSave={handleAddZone}
                onCancel={() => setPanelMode(null)}
              />
            )}

            {panelMode === "add-layer" && editingSegment && mapId && (
              <LayerPanelView
                mapId={mapId}
                segmentId={editingSegment.segmentId}
                attachedLayerIds={editingSegment.layers?.map(l => l.layerId) || []}
                layers={layers}
                onSave={handleAddLayer}
                onCancel={() => setPanelMode(null)}
              />
            )}

            {panelMode === "add-route" && editingSegment && mapId && (
              <RouteAnimationView
                mapId={mapId}
                segmentId={editingSegment.segmentId}
                currentMap={currentMap}
                onSave={async () => {
                  setPanelMode(null);
                  // Refresh segments without page reload
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('refreshSegments'));
                  }
                }}
                onCancel={() => setPanelMode(null)}
              />
            )}


            {!panelMode && activeView === "explorer" && (
              <ExplorerView
                features={features}
                layers={layers}
                baseLayer={baseLayer}
                layerVisibility={layerVisibility}
                featureVisibility={featureVisibility}
                mapId={mapId}
                onSelectFeature={onSelectFeature}
                onSelectLayer={onSelectLayer}
                onBaseLayerChange={onBaseLayerChange}
                onFeatureVisibilityChange={onFeatureVisibilityChange}
                onLayerVisibilityChange={onLayerVisibilityChange}
                onDeleteFeature={onDeleteFeature}
                onRefreshLayers={onRefreshLayers}
              />
            )}

            {!panelMode && activeView === "segments" && segmentFormMode === "list" && (
              <SegmentsView
                segments={segments}
                onSegmentClick={onSegmentClick}
                onAddSegment={handleAddSegment}
                onEditSegment={handleEditSegment}
                onDeleteSegment={onDeleteSegment}
                onAddLocation={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment && currentMap) {
                    setEditingSegment(segment);
                    setPanelMode("add-location");
                    setPickedCoordinates(null);
                  }
                }}
                onAddZone={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setPanelMode("add-zone");
                  }
                }}
                onAddLayer={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setPanelMode("add-layer");
                  }
                }}
                onAddRouteAnimation={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setPanelMode("add-route");
                  }
                }}
                mapId={mapId}
              />
            )}

            {!panelMode && activeView === "segments" && segmentFormMode !== "list" && (
              <SegmentFormView
                editing={editingSegment}
                currentMap={currentMap}
                mapId={mapId}
                onCancel={handleCancelSegmentForm}
                onSave={handleSaveSegmentForm}
                onAddLocation={() => {
                  if (currentMap) {
                    // IMPORTANT: Ensure editingSegment is set
                    // When creating a new segment, we can't add locations yet
                    if (!editingSegment) {
                      if (typeof window !== 'undefined') {
                        alert('Please save the segment first before adding locations.');
                      }
                      return;
                    }
                    setPanelMode("add-location");
                    setPickedCoordinates(null);
                  }
                }}
                onAddZone={() => setPanelMode("add-zone")}
                onAddLayer={() => setPanelMode("add-layer")}
                onAddRouteAnimation={() => setPanelMode("add-route")}
              />
            )}

            {!panelMode && activeView === "transitions" && transitionFormMode === "list" && (
              <TransitionsView
                transitions={transitions}
                segments={segments}
                onAddTransition={handleAddTransition}
                onEditTransition={handleEditTransition}
                onDeleteTransition={onDeleteTransition}
              />
            )}

            {!panelMode && activeView === "transitions" && transitionFormMode !== "list" && (
              <TransitionFormView
                editing={editingTransition}
                segments={segments}
                onCancel={handleCancelTransitionForm}
                onSave={handleSaveTransitionForm}
              />
            )}
            {!panelMode && activeView === "icons" && <IconLibraryView />}

          </div>
        </div>
      </div>

    </>
  );
}

// Panel view components that replace modals
function LocationPanelView({
  segmentId,
  currentMap,
  initialCoordinates,
  onSave,
  onCancel,
  waitingForLocation,
  setWaitingForLocation,
}: {
  segmentId: string;
  currentMap?: any;
  initialCoordinates: [number, number] | null;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  onCancel: () => void;
  waitingForLocation: boolean;
  setWaitingForLocation: (waiting: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("PointOfInterest");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(initialCoordinates);
  const [iconType, setIconType] = useState("📍");
  const [iconUrl, setIconUrl] = useState("");
  const [iconColor, setIconColor] = useState("#FF0000");
  const [iconSize, setIconSize] = useState(32);
  const [showTooltip, setShowTooltip] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");
  const [openPopupOnClick, setOpenPopupOnClick] = useState(true);
  const [popupContent, setPopupContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [playAudioOnClick, setPlayAudioOnClick] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Update coordinates when initialCoordinates change
  useEffect(() => {
    if (initialCoordinates) {
      setCoordinates(initialCoordinates);
    }
  }, [initialCoordinates]);

  // Show temporary marker on map when coordinates are set
  useEffect(() => {
    if (!currentMap || !coordinates) return;

    const L = (window as any).L;
    if (!L) return;

    const [lng, lat] = coordinates;
    const tempMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'temp-location-marker',
        html: `<div style="font-size: ${iconSize}px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${iconType}</div>`,
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize],
      }),
    });
    tempMarker.addTo(currentMap);

    return () => {
      currentMap.removeLayer(tempMarker);
    };
  }, [currentMap, coordinates, iconType, iconSize]);

  const handlePickLocation = () => {
    setWaitingForLocation(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showMapInstruction', {
        detail: { message: 'Click on the map to place the location marker' }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a location title");
      return;
    }

    if (!coordinates) {
      alert("Please select a location on the map");
      return;
    }

    setSaving(true);
    try {
      const markerGeometry = JSON.stringify({
        type: "Point",
        coordinates: coordinates,
      });

      const data: CreateLocationRequest = {
        segmentId,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        locationType,
        markerGeometry,
        iconType: iconType || undefined,
        iconUrl: iconUrl.trim() || undefined,
        iconColor,
        iconSize,
        displayOrder: 0,
        highlightOnEnter: false,
        showTooltip,
        tooltipContent: tooltipContent.trim() || title.trim(),
        openPopupOnClick,
        popupContent: popupContent.trim() || description.trim() || undefined,
        mediaUrls: mediaUrls.trim() || undefined,
        playAudioOnClick,
        audioUrl: audioUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        isVisible: true,
        zIndex: 100,
      };

      await onSave(data);
    } catch (error) {
      console.error("Failed to save location:", error);
      alert("Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Pick location button */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
        <label className="block text-xs font-medium text-zinc-300 mb-2">
          Location Coordinates *
        </label>
        {coordinates ? (
          <div className="space-y-2">
            <div className="text-xs text-zinc-400 font-mono bg-zinc-900 rounded px-3 py-2">
              Lng: {coordinates[0].toFixed(6)}, Lat: {coordinates[1].toFixed(6)}
            </div>
            <button
              type="button"
              onClick={handlePickLocation}
              className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-xs text-emerald-400 transition-colors"
            >
              Pick different location
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePickLocation}
            disabled={waitingForLocation}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium text-white disabled:opacity-50"
          >
            {waitingForLocation ? "Click on map..." : "Pick location on map"}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Location name"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Subtitle
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Brief tagline"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description"
            rows={3}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* Icon settings */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-white">Icon</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Emoji</label>
              <input
                type="text"
                value={iconType}
                onChange={(e) => setIconType(e.target.value)}
                placeholder="📍"
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Color</label>
              <input
                type="color"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                className="w-full h-8 rounded border border-zinc-600 bg-zinc-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 mb-1">Icon URL (optional)</label>
            <input
              type="text"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Tooltip & Popup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showTooltip"
              checked={showTooltip}
              onChange={(e) => setShowTooltip(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-600 text-emerald-600"
            />
            <label htmlFor="showTooltip" className="text-xs text-zinc-300 cursor-pointer">
              Show Tooltip (label above marker)
            </label>
          </div>
          {showTooltip && (
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Tooltip Content (optional)</label>
              <input
                type="text"
                value={tooltipContent}
                onChange={(e) => setTooltipContent(e.target.value)}
                placeholder={title || "Will use title if empty"}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="openPopupOnClick"
              checked={openPopupOnClick}
              onChange={(e) => setOpenPopupOnClick(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-600 text-emerald-600"
            />
            <label htmlFor="openPopupOnClick" className="text-xs text-zinc-300 cursor-pointer">
              Open popup on click
            </label>
          </div>
          {openPopupOnClick && (
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Popup Content (HTML supported)</label>
              <textarea
                value={popupContent}
                onChange={(e) => setPopupContent(e.target.value)}
                placeholder={description || "Will use description if empty"}
                rows={3}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500 resize-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Media */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Media URLs (one per line)
            </label>
            <textarea
              value={mediaUrls}
              onChange={(e) => setMediaUrls(e.target.value)}
              placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
              rows={2}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500 resize-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="playAudioOnClick"
              checked={playAudioOnClick}
              onChange={(e) => setPlayAudioOnClick(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-600 text-emerald-600"
            />
            <label htmlFor="playAudioOnClick" className="text-xs text-zinc-300 cursor-pointer">
              Play audio on click
            </label>
          </div>
          {playAudioOnClick && (
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Audio URL</label>
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] text-zinc-400 mb-1">External Link URL</label>
            <input
              type="text"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !coordinates}
            className="flex-1 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Location"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ZonePanelView({
  segmentId,
  onSave,
  onCancel,
}: {
  segmentId: string;
  onSave: (data: CreateSegmentZoneRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Configuration for zone highlighting
  const [highlightBoundary, setHighlightBoundary] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState("#FFD700");
  const [boundaryWidth, setBoundaryWidth] = useState(2);
  const [fillZone, setFillZone] = useState(true);
  const [fillColor, setFillColor] = useState("#FFD700");
  const [fillOpacity, setFillOpacity] = useState(0.3);
  const [showLabel, setShowLabel] = useState(true);
  const [labelOverride, setLabelOverride] = useState("");

  // Load zones on mount
  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZones();
      setZones(data || []);
    } catch (error) {
      console.error("Failed to load zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadZones();
      return;
    }

    setLoading(true);
    try {
      const results = await searchZones(searchTerm);
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedZone) {
      alert("Please select a zone");
      return;
    }

    setSaving(true);
    try {
      const data: CreateSegmentZoneRequest = {
        segmentId,
        zoneId: selectedZone.zoneId,
        highlightBoundary,
        boundaryColor: highlightBoundary ? boundaryColor : undefined,
        boundaryWidth: highlightBoundary ? boundaryWidth : undefined,
        fillZone,
        fillColor: fillZone ? fillColor : undefined,
        fillOpacity: fillZone ? fillOpacity : undefined,
        showLabel,
        labelOverride: showLabel && labelOverride.trim() ? labelOverride : undefined,
        isVisible: true,
        displayOrder: 0,
      };

      await onSave(data);
    } catch (error) {
      console.error("Failed to add zone:", error);
      alert("Failed to add zone. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Search Zones
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              placeholder="Search by name..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-800 text-white placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
            >
              🔍
            </button>
          </div>
        </div>

        {/* Zone List */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Available Zones ({zones.length})
          </label>
          <div className="max-h-48 overflow-y-auto border border-zinc-700 rounded bg-zinc-800/50">
            {loading ? (
              <div className="p-6 text-center text-zinc-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-1.5"></div>
                <div className="text-xs">Loading...</div>
              </div>
            ) : zones.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">
                No zones found
              </div>
            ) : (
              <div className="divide-y divide-zinc-700">
                {zones.map((zone) => (
                  <button
                    key={zone.zoneId}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    className={`w-full text-left px-2.5 py-2 hover:bg-zinc-700/50 transition-colors ${
                      selectedZone?.zoneId === zone.zoneId ? 'bg-emerald-900/30 border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{zone.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {zone.zoneType}
                        </div>
                      </div>
                      {selectedZone?.zoneId === zone.zoneId && (
                        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        {selectedZone && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded p-2.5 space-y-2.5">
            <h4 className="text-xs font-medium text-white">Display Config</h4>

            {/* Boundary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="highlightBoundary"
                  checked={highlightBoundary}
                  onChange={(e) => setHighlightBoundary(e.target.checked)}
                  className="w-3 h-3 rounded border-zinc-600 text-emerald-600"
                />
                <label htmlFor="highlightBoundary" className="text-xs text-zinc-300 cursor-pointer">
                  Highlight Boundary
                </label>
              </div>
              {highlightBoundary && (
                <div className="grid grid-cols-2 gap-2 ml-5">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Color</label>
                    <input
                      type="color"
                      value={boundaryColor}
                      onChange={(e) => setBoundaryColor(e.target.value)}
                      className="w-full h-7 rounded border border-zinc-600 bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Width</label>
                    <input
                      type="number"
                      value={boundaryWidth}
                      onChange={(e) => setBoundaryWidth(Number(e.target.value))}
                      min={1}
                      max={10}
                      className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fill */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fillZone"
                  checked={fillZone}
                  onChange={(e) => setFillZone(e.target.checked)}
                  className="w-3 h-3 rounded border-zinc-600 text-emerald-600"
                />
                <label htmlFor="fillZone" className="text-xs text-zinc-300 cursor-pointer">
                  Fill Zone
                </label>
              </div>
              {fillZone && (
                <div className="grid grid-cols-2 gap-2 ml-5">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Color</label>
                    <input
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="w-full h-7 rounded border border-zinc-600 bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Opacity</label>
                    <input
                      type="number"
                      value={fillOpacity}
                      onChange={(e) => setFillOpacity(Number(e.target.value))}
                      min={0}
                      max={1}
                      step={0.1}
                      className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showLabel"
                  checked={showLabel}
                  onChange={(e) => setShowLabel(e.target.checked)}
                  className="w-3 h-3 rounded border-zinc-600 text-emerald-600"
                />
                <label htmlFor="showLabel" className="text-xs text-zinc-300 cursor-pointer">
                  Show Label
                </label>
              </div>
              {showLabel && (
                <div className="ml-5">
                  <input
                    type="text"
                    value={labelOverride}
                    onChange={(e) => setLabelOverride(e.target.value)}
                    placeholder={selectedZone.name}
                    className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white placeholder-zinc-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 p-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !selectedZone}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Zone"}
        </button>
      </div>
    </form>
  );
}

function LayerPanelView({
  mapId,
  segmentId,
  attachedLayerIds,
  layers,
  onSave,
  onCancel,
}: {
  mapId: string;
  segmentId: string;
  attachedLayerIds: string[];
  layers: LayerDTO[];
  onSave: (data: AttachLayerRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedLayer, setSelectedLayer] = useState<LayerDTO | null>(null);
  const [saving, setSaving] = useState(false);

  // Configuration
  const [isVisible, setIsVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [zIndex, setZIndex] = useState(0);

  // Filter out already attached layers
  const availableLayers = layers.filter(
    (layer) => !attachedLayerIds.includes(layer.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLayer) {
      alert("Please select a layer");
      return;
    }

    setSaving(true);
    try {
      const data: AttachLayerRequest = {
        layerId: selectedLayer.id,
        isVisible,
        opacity,
        zIndex,
        displayOrder: 0,
      };

      await onSave(data);
    } catch (error) {
      console.error("Failed to attach layer:", error);
      alert("Failed to attach layer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Layer Selection */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Available Layers ({availableLayers.length})
          </label>
          <div className="max-h-64 overflow-y-auto border border-zinc-700 rounded bg-zinc-800/50">
            {availableLayers.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs">
                {attachedLayerIds.length > 0
                  ? "All layers are already attached"
                  : "No layers found in this map"}
              </div>
            ) : (
              <div className="divide-y divide-zinc-700">
                {availableLayers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayer(layer)}
                    className={`w-full text-left px-2.5 py-2 hover:bg-zinc-700/50 transition-colors ${
                      selectedLayer?.id === layer.id
                        ? 'bg-emerald-900/30 border-l-2 border-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-white truncate">{layer.layerName}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {layer.layerType}
                        </div>
                      </div>
                      {selectedLayer?.id === layer.id && (
                        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        {selectedLayer && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded p-2.5 space-y-3">
            <h4 className="text-xs font-medium text-white">Display Settings</h4>

            {/* Visibility */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="layerVisible"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-3 h-3 rounded border-zinc-600 text-emerald-600"
              />
              <label htmlFor="layerVisible" className="text-xs text-zinc-300 cursor-pointer">
                Visible in segment
              </label>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-xs text-zinc-300 mb-1.5">
                Opacity: {(opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                min={0}
                max={1}
                step={0.1}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Z-Index */}
            <div>
              <label className="block text-xs text-zinc-300 mb-1.5">
                Z-Index (layer order)
              </label>
              <input
                type="number"
                value={zIndex}
                onChange={(e) => setZIndex(Number(e.target.value))}
                min={-100}
                max={100}
                className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
              />
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Higher values appear on top
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 p-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !selectedLayer}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {saving ? "Attaching..." : "Attach Layer"}
        </button>
      </div>
    </form>
  );
}

function RouteAnimationView({
  mapId,
  segmentId,
  currentMap,
  onSave,
  onCancel,
}: {
  mapId: string;
  segmentId: string;
  currentMap?: any;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  // Helper function to parse coordinates
  const parseLocationCoords = (location: Location): { lat: number; lng: number } | null => {
    if (!location.markerGeometry) return null;
    try {
      const geoJson = typeof location.markerGeometry === "string"
        ? JSON.parse(location.markerGeometry)
        : location.markerGeometry;
      if (geoJson.type === "Point" && geoJson.coordinates?.length >= 2) {
        return { lng: geoJson.coordinates[0], lat: geoJson.coordinates[1] };
      }
    } catch (e) {
      console.error("Failed to parse location geometry:", e);
    }
    return null;
  };

  const [locations, setLocations] = useState<Location[]>([]);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [waypointLocationIds, setWaypointLocationIds] = useState<string[]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeType, setRouteType] = useState<"road" | "straight">("road");
  const [iconType, setIconType] = useState<"car" | "walking" | "bike" | "plane" | "custom">("car");
  const [iconUrl, setIconUrl] = useState("");
  const [routeColor, setRouteColor] = useState("#666666");
  const [visitedColor, setVisitedColor] = useState("#3b82f6");
  const [routeWidth, setRouteWidth] = useState(4);
  const [durationMs, setDurationMs] = useState(5000);
  const [showLocationInfoOnArrival, setShowLocationInfoOnArrival] = useState(true);
  const [locationInfoDisplayDurationMs, setLocationInfoDisplayDurationMs] = useState<number | undefined>();
  const [cameraStateBefore, setCameraStateBefore] = useState("");
  const [cameraStateAfter, setCameraStateAfter] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load locations
  useEffect(() => {
    setLoading(true);
    getMapLocations(mapId)
      .then((locs) => setLocations(locs || []))
      .catch((e) => console.error("Failed to load locations:", e))
      .finally(() => setLoading(false));
  }, [mapId]);

  const handleSearchRoute = async () => {
    if (!fromLocationId || !toLocationId) {
      alert("Please select start and end locations");
      return;
    }

    const allLocationIds = [fromLocationId, ...waypointLocationIds.filter(id => id), toLocationId];
    if (allLocationIds.length < 2) {
      alert("Need at least 2 points to create route");
      return;
    }

    setSearching(true);
    try {
      const result = await searchRouteWithMultipleLocations(allLocationIds, routeType);
      if (result?.routePath) {
        const geoJson = typeof result.routePath === "string" ? JSON.parse(result.routePath) : result.routePath;
        if (geoJson.type === "LineString" && geoJson.coordinates) {
          setRoutePath(geoJson.coordinates as [number, number][]);
        }
      } else {
        alert("No route found between these locations");
      }
    } catch (error: any) {
      console.error("Failed to search route:", error);
      alert(error?.message || "Error finding route");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fromLocation = locations.find(l => l.locationId === fromLocationId);
    const toLocation = locations.find(l => l.locationId === toLocationId);
    const fromCoords = fromLocation ? parseLocationCoords(fromLocation) : null;
    const toCoords = toLocation ? parseLocationCoords(toLocation) : null;

    if (!fromCoords || !toCoords || routePath.length === 0) {
      alert("Please search for a route before saving");
      return;
    }

    setSaving(true);
    try {
      const geoJson = { type: "LineString", coordinates: routePath };

      let waypointsJson: string | undefined;
      const validWaypoints = waypointLocationIds.filter(id => id);
      if (validWaypoints.length > 0) {
        const waypoints = validWaypoints.map(locId => {
          const loc = locations.find(l => l.locationId === locId);
          const coords = loc ? parseLocationCoords(loc) : null;
          return {
            locationId: locId,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
            name: loc?.title || "Unnamed",
            segmentId
          };
        });
        waypointsJson = JSON.stringify(waypoints);
      }

      const data: CreateRouteAnimationRequest = {
        segmentId,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        fromName: fromLocation?.title,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        toName: toLocation?.title,
        routePath: JSON.stringify(geoJson),
        waypoints: waypointsJson,
        iconType,
        iconUrl: iconUrl || undefined,
        iconWidth: 32,
        iconHeight: 32,
        routeColor,
        visitedColor,
        routeWidth,
        durationMs,
        autoPlay: true,
        loop: false,
        isVisible: true,
        zIndex: 1000,
        displayOrder: 0,
        toLocationId: toLocationId || undefined,
        showLocationInfoOnArrival,
        locationInfoDisplayDurationMs,
        cameraStateBefore: cameraStateBefore || undefined,
        cameraStateAfter: cameraStateAfter || undefined,
      };

      await createRouteAnimation(mapId, segmentId, data);
      await onSave();
    } catch (error) {
      console.error("Failed to save route animation:", error);
      alert("Failed to save route animation");
    } finally {
      setSaving(false);
    }
  };

  const availableFromLocations = locations.filter(l => l.locationId !== toLocationId);
  const availableToLocations = locations.filter(l => l.locationId !== fromLocationId);
  const usedIds = [fromLocationId, toLocationId, ...waypointLocationIds].filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* From/To Locations */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">From *</label>
            <select
              value={fromLocationId}
              onChange={(e) => setFromLocationId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-white"
              required
            >
              <option value="">Select start location</option>
              {availableFromLocations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>{loc.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">To *</label>
            <select
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-white"
              required
            >
              <option value="">Select end location</option>
              {availableToLocations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>{loc.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Waypoints */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-zinc-300">Waypoints</label>
            <button
              type="button"
              onClick={() => setWaypointLocationIds([...waypointLocationIds, ""])}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              + Add
            </button>
          </div>
          {waypointLocationIds.map((wpId, idx) => (
            <div key={idx} className="flex gap-1 mb-1">
              <select
                value={wpId}
                onChange={(e) => {
                  const newWaypoints = [...waypointLocationIds];
                  newWaypoints[idx] = e.target.value;
                  setWaypointLocationIds(newWaypoints);
                }}
                className="flex-1 px-2 py-1 text-xs border border-zinc-700 rounded bg-zinc-800 text-white"
              >
                <option value="">Select waypoint</option>
                {locations.filter(l => !usedIds.includes(l.locationId) || l.locationId === wpId).map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.title}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setWaypointLocationIds(waypointLocationIds.filter((_, i) => i !== idx))}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Route Type & Search */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Route Type</label>
          <div className="flex gap-2">
            <select
              value={routeType}
              onChange={(e) => setRouteType(e.target.value as "road" | "straight")}
              className="flex-1 px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-white"
            >
              <option value="road">Road</option>
              <option value="straight">Straight Line</option>
            </select>
            <button
              type="button"
              onClick={handleSearchRoute}
              disabled={searching || !fromLocationId || !toLocationId}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
            >
              {searching ? "..." : "Find"}
            </button>
          </div>
          {routePath.length > 0 && (
            <p className="text-xs text-emerald-400 mt-1">✓ Route found ({routePath.length} points)</p>
          )}
        </div>

        {/* Icon & Style */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded p-2 space-y-2">
          <h4 className="text-xs font-medium text-white">Appearance</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Icon</label>
              <select
                value={iconType}
                onChange={(e) => setIconType(e.target.value as any)}
                className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
              >
                <option value="car">🚗 Car</option>
                <option value="walking">🚶 Walking</option>
                <option value="bike">🚲 Bike</option>
                <option value="plane">✈️ Plane</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Duration (ms)</label>
              <input
                type="number"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                min={1000}
                max={30000}
                step={500}
                className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
              />
            </div>
          </div>

          {iconType === "custom" && (
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Icon URL</label>
              <input
                type="text"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Route Color</label>
              <input
                type="color"
                value={routeColor}
                onChange={(e) => setRouteColor(e.target.value)}
                className="w-full h-7 rounded border border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-0.5">Visited Color</label>
              <input
                type="color"
                value={visitedColor}
                onChange={(e) => setVisitedColor(e.target.value)}
                className="w-full h-7 rounded border border-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Camera States */}
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-zinc-400 mb-0.5">Camera Before (JSON)</label>
            <textarea
              value={cameraStateBefore}
              onChange={(e) => setCameraStateBefore(e.target.value)}
              placeholder='{"center": [lng, lat], "zoom": 10}'
              rows={2}
              className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 mb-0.5">Camera After (JSON)</label>
            <textarea
              value={cameraStateAfter}
              onChange={(e) => setCameraStateAfter(e.target.value)}
              placeholder='{"center": [lng, lat], "zoom": 15}'
              rows={2}
              className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white font-mono"
            />
          </div>
        </div>

        {/* Location Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showInfo"
              checked={showLocationInfoOnArrival}
              onChange={(e) => setShowLocationInfoOnArrival(e.target.checked)}
              className="w-3 h-3 rounded border-zinc-600"
            />
            <label htmlFor="showInfo" className="text-xs text-zinc-300">Show info on arrival</label>
          </div>
          {showLocationInfoOnArrival && (
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">
                Display duration (ms) - Leave empty for manual close
              </label>
              <input
                type="number"
                value={locationInfoDisplayDurationMs || ""}
                onChange={(e) => setLocationInfoDisplayDurationMs(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g., 5000"
                min="0"
                className="w-full px-2 py-1 text-xs border border-zinc-600 rounded bg-zinc-800 text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 p-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || routePath.length === 0}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add Route"}
        </button>
      </div>
    </form>
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
  layerVisibility,
  featureVisibility,
  mapId,
  onSelectFeature,
  onSelectLayer,
  onBaseLayerChange,
  onFeatureVisibilityChange,
  onLayerVisibilityChange,
  onDeleteFeature,
  onRefreshLayers,
}: {
  features: FeatureData[];
  layers: LayerDTO[];
  baseLayer: BaseKey;
  layerVisibility: Record<string, boolean>;
  featureVisibility: Record<string, boolean>;
  mapId?: string;
  onSelectFeature: (feature: FeatureData) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onBaseLayerChange: (key: BaseKey) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onDeleteFeature: (featureId: string) => void;
  onRefreshLayers?: () => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showInlineLayerInput, setShowInlineLayerInput] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [showDeleteLayerDialog, setShowDeleteLayerDialog] = useState(false);
  const [layerToDelete, setLayerToDelete] = useState<LayerDTO | null>(null);
  const [allFeatures, setAllFeatures] = useState<MapFeatureResponse[]>([]);
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(new Set());

  const handleAddLayer = async (layerName: string) => {
    if (!mapId) return;

    try {
      // Create a new empty layer with valid empty GeoJSON FeatureCollection
      const emptyGeoJSON = JSON.stringify({
        type: 'FeatureCollection',
        features: []
      });

      await addLayerToMap(mapId, {
        layerName: layerName,
        isVisible: true,
        zIndex: layers.length,
        layerData: emptyGeoJSON,
        layerTypeId: "1"
      });

      // Refresh layers
      if (onRefreshLayers) {
        await onRefreshLayers();
      }
    } catch (error) {
      console.error("Failed to add layer:", error);
      alert("Failed to add layer. Please try again.");
      throw error;
    }
  };

  const handleDeleteLayerClick = async (layer: LayerDTO) => {
    if (!mapId) return;

    // Load all features to check how many belong to this layer
    try {
      const featuresResponse = await getMapFeatures(mapId);
      setAllFeatures(featuresResponse);
      setLayerToDelete(layer);
      setShowDeleteLayerDialog(true);
    } catch (error) {
      console.error("Failed to load features:", error);
      alert("Failed to load layer features. Please try again.");
    }
  };

  const handleConfirmDeleteLayer = async (options: { action: 'delete-features' | 'move-to-default'; targetLayerId?: string }) => {
    if (!mapId || !layerToDelete) return;

    try {
      await handleDeleteLayerWithFeatures(mapId, layerToDelete.id, options, allFeatures);

      // Refresh layers
      if (onRefreshLayers) {
        await onRefreshLayers();
      }
    } catch (error) {
      console.error("Failed to delete layer:", error);
      alert("Failed to delete layer. Please try again.");
      throw error;
    }
  };

  // Handler for feature drag-and-drop to different layer
  const handleFeatureDrop = async (featureId: string, targetLayerId: string | null) => {
    if (!mapId) return;

    try {
      // Update the feature's layerId in the database
      await updateMapFeature(mapId, featureId, {
        layerId: targetLayerId,
      });

      // Refresh layers
      if (onRefreshLayers) {
        await onRefreshLayers();
      }
    } catch (error) {
      console.error("Failed to move feature to layer:", error);
      alert("Failed to move feature. Please try again.");
    }
  };

  // Handler for layer collapse/expand
  const handleLayerCollapse = (layerId: string, isCollapsed: boolean) => {
    setCollapsedLayers((prev) => {
      const newSet = new Set(prev);
      if (isCollapsed) {
        newSet.add(layerId);
      } else {
        newSet.delete(layerId);
      }
      return newSet;
    });
  };

  // Build layer tree
  const layerTree = buildLayerTree(
    layers,
    features,
    layerVisibility,
    featureVisibility,
    collapsedLayers
  );

  // Filter tree based on search query
  const filteredTree = filterLayerTree(layerTree, searchQuery);

  // Keep filtered features for search results display
  const filteredFeatures = searchQuery
    ? features.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

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

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
      {/* Base Layer Selection */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase">
          Base Layer
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "osm" as BaseKey, label: "OSM", icon: "mdi:map-outline" },
            { key: "sat" as BaseKey, label: "Satellite", icon: "mdi:satellite-variant" },
            { key: "dark" as BaseKey, label: "Dark", icon: "mdi:moon-waning-crescent" },
            { key: "positron" as BaseKey, label: "Light", icon: "mdi:brightness-7" },
            { key: "dark-matter" as BaseKey, label: "Dark Matter", icon: "mdi:weather-night" },
            { key: "terrain" as BaseKey, label: "Terrain", icon: "mdi:terrain" },
            { key: "toner" as BaseKey, label: "Toner", icon: "mdi:circle-outline" },
            { key: "watercolor" as BaseKey, label: "Watercolor", icon: "mdi:palette" },
            { key: "topo" as BaseKey, label: "Topo", icon: "mdi:map-marker-radius" },
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

      {/* Layers & Features Tree - Video Editor Style with Hierarchy */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Layers & Features
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">
              {layers.length} layer{layers.length !== 1 ? 's' : ''}, {features.length} feature{features.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowInlineLayerInput(true)}
              className="p-1 rounded hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 transition-colors"
              title="Add Layer"
            >
              <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline Layer Input */}
        {showInlineLayerInput && (
          <div className="mx-1 mb-2 p-2 bg-zinc-800/80 border border-zinc-700 rounded-lg">
            <input
              type="text"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              placeholder="Enter layer name..."
              autoFocus
              className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLayerName.trim()) {
                  handleAddLayer(newLayerName);
                  setShowInlineLayerInput(false);
                  setNewLayerName("");
                } else if (e.key === 'Escape') {
                  setShowInlineLayerInput(false);
                  setNewLayerName("");
                }
              }}
            />
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={async () => {
                  if (!newLayerName.trim()) return;
                  await handleAddLayer(newLayerName);
                  setShowInlineLayerInput(false);
                  setNewLayerName("");
                }}
                disabled={!newLayerName.trim()}
                className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
              >
                ✓ Add Layer
              </button>
              <button
                onClick={() => {
                  setShowInlineLayerInput(false);
                  setNewLayerName("");
                }}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium rounded transition-colors"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        )}

        {filteredTree.length === 0 ? (
          <div className="px-2 py-4 text-center">
            <p className="text-xs text-zinc-500 italic">No layers or features</p>
          </div>
        ) : (
          <LayerTree
            tree={filteredTree}
            onFeatureDrop={handleFeatureDrop}
            onLayerCollapse={handleLayerCollapse}
            onLayerVisibilityChange={onLayerVisibilityChange}
            onFeatureVisibilityChange={onFeatureVisibilityChange}
            onSelectLayer={onSelectLayer}
            onSelectFeature={onSelectFeature}
            onDeleteLayer={handleDeleteLayerClick}
            onDeleteFeature={onDeleteFeature}
            totalLayerCount={layers.length}
          />
        )}
      </div>

      {/* Keep legacy features list for search compatibility */}
      {searchQuery && filteredFeatures.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Search Results
            </h4>
            <span className="text-[10px] text-zinc-600">{filteredFeatures.length}</span>
          </div>
          <div className="space-y-0.5">
            {filteredFeatures.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/60 cursor-pointer group/item transition-colors"
                onClick={() => onSelectFeature(feature)}
              >
                <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    icon={getFeatureIcon(feature.type)}
                    className="w-3.5 h-3.5 text-emerald-400"
                  />
                </div>
                <span className="flex-1 text-xs text-zinc-300 truncate font-medium">
                  {feature.name}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentVisibility = featureVisibility[feature.id] ?? feature.isVisible;
                      onFeatureVisibilityChange(
                        feature.featureId || feature.id,
                        !currentVisibility
                      );
                    }}
                    className="p-0.5 hover:bg-zinc-700 rounded"
                  >
                    <Icon
                      icon={(featureVisibility[feature.id] ?? feature.isVisible) ? "mdi:eye" : "mdi:eye-off"}
                      className={cn(
                        "w-3.5 h-3.5",
                        (featureVisibility[feature.id] ?? feature.isVisible)
                          ? "text-emerald-400"
                          : "text-zinc-600"
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
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Delete Layer Dialog */}
      <DeleteLayerDialog
        isOpen={showDeleteLayerDialog}
        onClose={() => {
          setShowDeleteLayerDialog(false);
          setLayerToDelete(null);
        }}
        onConfirm={handleConfirmDeleteLayer}
        layerName={layerToDelete?.layerName || ""}
        featureCount={allFeatures.filter(f => f.layerId === layerToDelete?.id).length}
        defaultLayerId={
          layers.find(l => l.layerName.toLowerCase().includes('default'))?.id ||
          layers[0]?.id ||
          ""
        }
        totalLayerCount={layers.length}
      />
    </div>
  );
}

function SegmentsView({
  segments,
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSegments = segments.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <div className="flex-1 overflow-y-auto p-2">
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
                            onEditSegment(segment);
                          }}
                          className="p-1 hover:bg-zinc-700 rounded"
                          title="Edit segment"
                        >
                          <Icon icon="mdi:pencil" className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        {onDeleteSegment && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete segment "${segment.name}"?`)) {
                                onDeleteSegment(segment.segmentId);
                              }
                            }}
                            className="p-1 hover:bg-zinc-700 rounded"
                            title="Delete segment"
                          >
                            <Icon icon="mdi:delete-outline" className="w-3.5 h-3.5 text-red-400" />
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

                    {/* Quick action buttons - Compact style */}
                    {mapId && (onAddLocation || onAddZone || onAddLayer || onAddRouteAnimation) && (
                      <div className="mt-1.5 pt-1.5 border-t border-zinc-800/50 flex items-center gap-1 flex-wrap">
                        {onAddLocation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddLocation(segment.segmentId);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all text-[9px] font-medium"
                            title="Add location"
                          >
                            <Icon icon="mdi:plus" className="w-2.5 h-2.5" />
                            <Icon icon="mdi:map-marker" className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {onAddZone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddZone(segment.segmentId);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300 transition-all text-[9px] font-medium"
                            title="Add zone"
                          >
                            <Icon icon="mdi:plus" className="w-2.5 h-2.5" />
                            <Icon icon="mdi:shape" className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {onAddLayer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddLayer(segment.segmentId);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 transition-all text-[9px] font-medium"
                            title="Attach layer"
                          >
                            <Icon icon="mdi:plus" className="w-2.5 h-2.5" />
                            <Icon icon="mdi:layers" className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {onAddRouteAnimation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddRouteAnimation(segment.segmentId);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 text-orange-400 hover:text-orange-300 transition-all text-[9px] font-medium"
                            title="Add route"
                          >
                            <Icon icon="mdi:plus" className="w-2.5 h-2.5" />
                            <Icon icon="mdi:route" className="w-2.5 h-2.5" />
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
  const [routeAnimations, setRouteAnimations] = useState<RouteAnimation[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // Load route animations on mount or when segmentId changes
  useEffect(() => {
    let cancelled = false;
    
    setIsLoadingRoutes(true);
    setRouteAnimations([]); // Reset when segment changes
    
    getRouteAnimationsBySegment(mapId, segmentId)
      .then((routes) => {
        if (!cancelled) {
          setRouteAnimations(routes || []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Failed to load route animations:", e);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRoutes(false);
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [mapId, segmentId]); // Only depend on mapId and segmentId

  const handleDeleteZone = async (segmentZoneId: string) => {
    if (!window.confirm("Remove this zone from segment?")) return;
    try {
      await deleteSegmentZone(mapId, segmentId, segmentZoneId);
      // Trigger refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refreshSegments'));
      }
    } catch (e) {
      console.error("Failed to delete zone:", e);
      alert("Failed to remove zone");
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!window.confirm("Remove this location from segment?")) return;
    try {
      await deleteLocation(mapId, segmentId, locationId);
      // Trigger refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refreshSegments'));
      }
    } catch (e) {
      console.error("Failed to delete location:", e);
      alert("Failed to remove location");
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    if (!window.confirm("Remove this layer from segment?")) return;
    try {
      await detachLayerFromSegment(mapId, segmentId, layerId);
      // Trigger refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refreshSegments'));
      }
    } catch (e) {
      console.error("Failed to delete layer:", e);
      alert("Failed to remove layer");
    }
  };

  const handleDeleteRoute = async (routeAnimationId: string) => {
    if (!window.confirm("Delete this route animation?")) return;
    try {
      await deleteRouteAnimation(mapId, segmentId, routeAnimationId);
      setRouteAnimations(prev => prev.filter(r => r.routeAnimationId !== routeAnimationId));
    } catch (e) {
      console.error("Failed to delete route:", e);
      alert("Failed to delete route animation");
    }
  };

  const zones = segment.zones || [];
  const locations = segment.locations || [];
  const layers = segment.layers || [];

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
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
                      <Icon icon="mdi:map-marker" className="w-3 h-3 text-emerald-400 flex-shrink-0" />
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

  const [cameraState, setCameraState] = useState<CameraState>(() => {
    if (editing?.cameraState) {
      if (typeof editing.cameraState === "string") {
        const parsed = parseCameraState(editing.cameraState);
        if (parsed) return parsed;
      } else if (editing.cameraState && typeof editing.cameraState === "object") {
        return editing.cameraState as CameraState;
      }
    }
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
    if (!currentMap) return;
    if (typeof currentMap.getCenter !== "function" || typeof currentMap.getZoom !== "function") {
      return;
    }

    // If editing an existing segment with camera state, don't auto-capture
    if (editing?.cameraState) {
      return;
    }

    // Capture initial camera state
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

    // Capture immediately
    captureCamera();

    // Also capture when map moves/zooms
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
              onChange={e =>
                setDurationMs(Math.max(1, parseInt(e.target.value) || 1) * 1000)
              }
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
                          if (window.confirm("Delete this transition?")) {
                            onDeleteTransition(transition.timelineTransitionId);
                          }
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
  const [transitionType, setTransitionType] = useState<"Jump" | "Ease" | "Linear">(
    editing?.transitionType || "Ease"
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
        transitionType,
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
          onChange={e => setTransitionType(e.target.value as any)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/80"
        >
          <option value="Jump">Jump</option>
          <option value="Ease">Ease</option>
          <option value="Linear">Linear</option>
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

function IconLibraryView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const startIconPlacement = (iconKey: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("icon:startPlacement", {
        detail: { iconKey },
      })
    );
  };

  const stopIconPlacement = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("icon:stopPlacement"));
  };

  const categories: {
    title: string;
    items: { id: string; icon: string; label: string }[];
  }[] = [
      {
        title: "Travel & Movement",
        items: [
          { id: "plane", icon: "mdi:airplane", label: "Plane" },
          { id: "car", icon: "mdi:car", label: "Car" },
          { id: "bus", icon: "mdi:bus", label: "Bus" },
          { id: "train", icon: "mdi:train", label: "Train" },
          { id: "ship", icon: "mdi:ferry", label: "Ship" },
          { id: "bike", icon: "mdi:bike", label: "Bike" },
          { id: "walk", icon: "mdi:walk", label: "Walk" },
          { id: "route", icon: "mdi:routes", label: "Route" },
          { id: "from", icon: "mdi:map-marker-radius", label: "From" },
          { id: "to", icon: "mdi:map-marker-check", label: "To" },
        ],
      },
      {
        title: "Places & POI",
        items: [
          { id: "home", icon: "mdi:home-outline", label: "Home" },
          { id: "office", icon: "mdi:office-building-outline", label: "Office" },
          { id: "school", icon: "mdi:school-outline", label: "School" },
          { id: "hospital", icon: "mdi:hospital-building", label: "Hospital" },
          { id: "restaurant", icon: "mdi:silverware-fork-knife", label: "Food" },
          { id: "coffee", icon: "mdi:coffee-outline", label: "Coffee" },
          { id: "shop", icon: "mdi:storefront-outline", label: "Shop" },
          { id: "park", icon: "mdi:tree-outline", label: "Park" },
          { id: "museum", icon: "mdi:bank-outline", label: "Museum" },
          { id: "hotel", icon: "mdi:bed-outline", label: "Hotel" },
        ],
      },
      {
        title: "People & Events",
        items: [
          { id: "person", icon: "mdi:account", label: "Person" },
          { id: "group", icon: "mdi:account-group", label: "Group" },
          { id: "info", icon: "mdi:information-outline", label: "Info" },
          { id: "warning", icon: "mdi:alert-outline", label: "Warning" },
          { id: "danger", icon: "mdi:alert-octagon-outline", label: "Danger" },
          { id: "star", icon: "mdi:star-outline", label: "Highlight" },
          { id: "photo", icon: "mdi:image-outline", label: "Photo spot" },
          { id: "camera", icon: "mdi:camera-outline", label: "Camera" },
          { id: "note", icon: "mdi:note-text-outline", label: "Note" },
          { id: "chat", icon: "mdi:chat-outline", label: "Comment" },
        ],
      },
      {
        title: "Minerals & Resources",
        items: [
          { id: "gold", icon: "mdi:gold", label: "Gold" },
          { id: "silver", icon: "mdi:silverware-variant", label: "Silver" },
          { id: "coal", icon: "mdi:fire", label: "Coal" },
          { id: "oil", icon: "mdi:oil-lamp", label: "Oil" },
          { id: "gas", icon: "mdi:gas-station", label: "Natural Gas" },
          { id: "iron", icon: "mdi:anvil", label: "Iron" },
          { id: "copper", icon: "mdi:pickaxe", label: "Copper" },
          { id: "diamond", icon: "mdi:gem", label: "Diamond" },
          { id: "stone", icon: "mdi:cube-outline", label: "Stone" },
          { id: "mining", icon: "mdi:pickaxe", label: "Mining" },
        ],
      },
      {
        title: "Industries",
        items: [
          { id: "factory", icon: "mdi:factory", label: "Factory" },
          { id: "power-plant", icon: "mdi:lightning-bolt-outline", label: "Power Plant" },
          { id: "refinery", icon: "mdi:barrel", label: "Refinery" },
          { id: "warehouse", icon: "mdi:warehouse", label: "Warehouse" },
          { id: "construction", icon: "mdi:hard-hat", label: "Construction" },
          { id: "shipyard", icon: "mdi:ship", label: "Shipyard" },
          { id: "airport", icon: "mdi:airport", label: "Airport" },
          { id: "port", icon: "mdi:anchor", label: "Port" },
          { id: "textile", icon: "mdi:tshirt-crew-outline", label: "Textile" },
          { id: "agriculture", icon: "mdi:sprout", label: "Agriculture" },
        ],
      },
      {
        title: "Geography & History",
        items: [
          { id: "mountain", icon: "mdi:terrain", label: "Mountain" },
          { id: "river", icon: "mdi:water", label: "River" },
          { id: "lake", icon: "mdi:water-circle", label: "Lake" },
          { id: "forest", icon: "mdi:tree", label: "Forest" },
          { id: "desert", icon: "mdi:weather-sunny", label: "Desert" },
          { id: "volcano", icon: "mdi:volcano", label: "Volcano" },
          { id: "island", icon: "mdi:island", label: "Island" },
          { id: "beach", icon: "mdi:beach", label: "Beach" },
          { id: "castle", icon: "mdi:castle", label: "Castle" },
          { id: "temple", icon: "mdi:temple-hindu", label: "Temple" },
          { id: "monument", icon: "mdi:monument", label: "Monument" },
          { id: "tomb", icon: "mdi:tombstone", label: "Tomb" },
          { id: "ruin", icon: "mdi:castle", label: "Ruin" },
          { id: "battlefield", icon: "mdi:sword", label: "Battlefield" },
          { id: "ancient-city", icon: "mdi:city-variant", label: "Ancient City" },
        ],
      },
    ];

  return (
    <div className="p-3 space-y-4 text-xs">
      <p className="text-zinc-400 text-[11px]">
        Thư viện icon – hiện tại chỉ là UI chọn icon, chưa gắn logic tool hay map.
      </p>

      {categories.map((cat) => (
        <div key={cat.title} className="space-y-2">
          <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
            {cat.title}
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {cat.items.map((item) => {
              const isActive = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedId((prev) => {
                      const next = prev === item.id ? null : item.id;
                      if (next) {
                        startIconPlacement(next);
                      } else {
                        stopIconPlacement();
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 transition-all text-[10px]",
                    isActive
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                  )}
                  title={item.label}
                >
                  <Icon icon={item.icon} className="w-4 h-4" />
                  <span className="truncate w-full text-center">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
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