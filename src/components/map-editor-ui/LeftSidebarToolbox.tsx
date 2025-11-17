"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { BaseKey } from "@/types";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import type {
  Segment,
  TimelineTransition,
  CameraState,
  CreateSegmentRequest,
  CreateTransitionRequest,
  Zone,
  SegmentZone,
  CreateSegmentZoneRequest,
} from "@/lib/api-storymap";
import {
  parseCameraState,
  stringifyCameraState,
  getCurrentCameraState,
  applyCameraState,
  searchZones,
  getSegmentZones,
  createSegmentZone,
  deleteSegmentZone,
} from "@/lib/api-storymap";
import type { MapPoi } from "@/lib/api-poi";
import { updatePoiDisplayConfig, updatePoiInteractionConfig } from "@/lib/api-poi";
import type { LocationPoiDialogForm } from "@/types";
import { RichHTMLEditor } from "@/components/shared/RichHTMLEditor";

interface LeftSidebarToolboxProps {
  activeView: "explorer" | "segments" | "transitions" | "pois" | "zones" | null;
  onViewChange: (view: "explorer" | "segments" | "transitions" | "pois" | "zones" | null) => void;

  mapId?: string;
  features: FeatureData[];
  layers: LayerDTO[];
  segments: Segment[];
  transitions: TimelineTransition[];
  baseLayer: BaseKey;
  currentMap?: any;

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

  // POI support
  pois?: MapPoi[];
  onPoiVisibilityToggle?: (poiId: string, isVisible: boolean) => void;
  onDeletePoi?: (poiId: string) => void;
  onFocusPoi?: (poiId: string, lngLat: [number, number]) => void;
  onSavePoi?: (data: LocationPoiDialogForm, poiId?: string) => Promise<void>;
  onEditPoi?: (poi: MapPoi) => void;
}

type ViewType = "explorer" | "segments" | "transitions" | "pois" | "zones";
type FormMode = "list" | "create" | "edit";

export function LeftSidebarToolbox({
  activeView,
  onViewChange,
  mapId,
  features,
  layers,
  segments,
  transitions,
  baseLayer,
  currentMap,
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
  pois = [],
  onPoiVisibilityToggle,
  onDeletePoi,
  onFocusPoi,
  onSavePoi,
  onEditPoi,
}: LeftSidebarToolboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Form state for segments
  const [segmentFormMode, setSegmentFormMode] = useState<FormMode>("list");
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);

  // Form state for transitions
  const [transitionFormMode, setTransitionFormMode] = useState<FormMode>("list");
  const [editingTransition, setEditingTransition] = useState<TimelineTransition | null>(null);

  // Form state for POIs
  const [poiFormMode, setPoiFormMode] = useState<FormMode>("list");
  const [editingPoi, setEditingPoi] = useState<MapPoi | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  useEffect(() => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: activeView ? 0 : -280,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [activeView]);

  const handleIconClick = useCallback((view: ViewType) => {
    // Reset form modes when switching views
    setSegmentFormMode("list");
    setTransitionFormMode("list");
    setPoiFormMode("list");
    setEditingSegment(null);
    setEditingTransition(null);
    setEditingPoi(null);
    setIsPickingLocation(false);

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
    setSegmentFormMode("list");
    setEditingSegment(null);
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

  // POI form handlers
  const handleAddPoi = useCallback(() => {
    setEditingPoi(null);
    setPoiFormMode("create");
    setIsPickingLocation(false);
  }, []);

  const handleEditPoi = useCallback((poi: MapPoi) => {
    setEditingPoi(poi);
    setPoiFormMode("edit");
    setIsPickingLocation(false);
    if (onEditPoi) {
      onEditPoi(poi);
    }
  }, [onEditPoi]);

  const handleCancelPoiForm = useCallback(() => {
    setPoiFormMode("list");
    setEditingPoi(null);
    setIsPickingLocation(false);
    // Dispatch event to disable picking mode on map
    if (mapId) {
      window.dispatchEvent(
        new CustomEvent("poi:stopPickLocation", {
          detail: { mapId },
        })
      );
    }
  }, [mapId]);

  const handleSavePoiForm = useCallback(async (data: LocationPoiDialogForm) => {
    if (onSavePoi) {
      const wasEditing = !!editingPoi;
      const editedPoiId = editingPoi?.poiId;

      await onSavePoi(data, editingPoi?.poiId);
      setPoiFormMode("list");
      setEditingPoi(null);
      setIsPickingLocation(false);

      // Dispatch event to stop picking mode and notify of POI change
      if (mapId) {
        window.dispatchEvent(
          new CustomEvent("poi:stopPickLocation", {
            detail: { mapId },
          })
        );
        window.dispatchEvent(
          new CustomEvent(wasEditing ? "poi:updated" : "poi:created", {
            detail: { mapId, poiId: editedPoiId || "new" },
          })
        );
      }
    }
  }, [onSavePoi, editingPoi, mapId]);

  return (
    <>
      {/* Icon Bar */}
      <div className="fixed left-0 top-10 bottom-0 w-12 bg-zinc-950 border-r border-zinc-800 z-[2000] flex flex-col">
        <IconButton
          icon="mdi:layers-triple"
          label="Data Layers"
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
          icon="mdi:map-marker-multiple"
          label="POIs"
          isActive={activeView === "pois"}
          onClick={() => handleIconClick("pois")}
        />
        <IconButton
          icon="mdi:vector-polygon"
          label="Zones"
          isActive={activeView === "zones"}
          onClick={() => handleIconClick("zones")}
        />
      </div>

      {/* Content Panel (slides in/out) */}
      <div
        ref={panelRef}
        className="fixed left-12 top-10 bottom-0 w-[280px] bg-zinc-900/95 backdrop-blur-lg border-r border-zinc-800 z-[1999] overflow-hidden"
        style={{ transform: "translateX(-280px)" }}
      >
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4">
            <span className="font-semibold text-sm text-zinc-200 uppercase">
              {activeView === "explorer" && "Data Layers"}
              {activeView === "segments" && (segmentFormMode === "list" ? "Segments" : segmentFormMode === "create" ? "Create Segment" : "Edit Segment")}
              {activeView === "transitions" && (transitionFormMode === "list" ? "Transitions" : transitionFormMode === "create" ? "Create Transition" : "Edit Transition")}
              {activeView === "pois" && (poiFormMode === "list" ? "POIs" : poiFormMode === "create" ? "Create POI" : "Edit POI")}
              {activeView === "zones" && "Zones"}
            </span>

            <div className="flex items-center gap-1">
              {/* Back button for forms */}
              {((activeView === "segments" && segmentFormMode !== "list") ||
                (activeView === "transitions" && transitionFormMode !== "list") ||
                (activeView === "pois" && poiFormMode !== "list")) && (
                <button
                  onClick={() => {
                    if (activeView === "segments") handleCancelSegmentForm();
                    if (activeView === "transitions") handleCancelTransitionForm();
                    if (activeView === "pois") handleCancelPoiForm();
                  }}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title="Back to list"
                >
                  <Icon icon="mdi:arrow-left" className="w-4 h-4 text-zinc-400" />
                </button>
              )}

              {/* Close panel button (only show when in list mode) */}
              {((activeView === "segments" && segmentFormMode === "list") ||
                (activeView === "transitions" && transitionFormMode === "list") ||
                (activeView === "pois" && poiFormMode === "list") ||
                activeView === "explorer" ||
                activeView === "zones") && (
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
            {activeView === "explorer" && (
              <ExplorerView
                features={features}
                layers={layers}
                baseLayer={baseLayer}
                onSelectFeature={onSelectFeature}
                onSelectLayer={onSelectLayer}
                onBaseLayerChange={onBaseLayerChange}
                onFeatureVisibilityChange={onFeatureVisibilityChange}
                onLayerVisibilityChange={onLayerVisibilityChange}
                onDeleteFeature={onDeleteFeature}
              />
            )}

            {activeView === "segments" && segmentFormMode === "list" && (
              <SegmentsView
                segments={segments}
                onSegmentClick={onSegmentClick}
                onAddSegment={handleAddSegment}
                onEditSegment={handleEditSegment}
                onDeleteSegment={onDeleteSegment}
              />
            )}

            {activeView === "segments" && segmentFormMode !== "list" && (
              <SegmentFormView
                editing={editingSegment}
                mapId={mapId}
                currentMap={currentMap}
                onCancel={handleCancelSegmentForm}
                onSave={handleSaveSegmentForm}
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

            {activeView === "pois" && poiFormMode === "list" && (
              <PoisView
                pois={pois}
                mapId={mapId}
                onPoiVisibilityToggle={onPoiVisibilityToggle}
                onDeletePoi={onDeletePoi}
                onFocusPoi={onFocusPoi}
                onAddPoi={handleAddPoi}
                onEditPoi={handleEditPoi}
              />
            )}

            {activeView === "pois" && poiFormMode !== "list" && (
              <PoiFormView
                editing={editingPoi}
                currentMap={currentMap}
                isPickingLocation={isPickingLocation}
                onPickLocation={() => {
                  const newPickingState = !isPickingLocation;
                  setIsPickingLocation(newPickingState);

                  if (mapId) {
                    if (newPickingState) {
                      // Start picking
                      window.dispatchEvent(
                        new CustomEvent("poi:startPickLocation", {
                          detail: { mapId },
                        })
                      );
                    } else {
                      // Stop picking
                      window.dispatchEvent(
                        new CustomEvent("poi:stopPickLocation", {
                          detail: { mapId },
                        })
                      );
                    }
                  }
                }}
                onCancel={handleCancelPoiForm}
                onSave={handleSavePoiForm}
              />
            )}

            {activeView === "zones" && (
              <ZonesView />
            )}
          </div>
        </div>
      </div>
    </>
  );
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
        "w-12 h-12 flex items-center justify-center border-l-2 transition-all group relative",
        isActive
          ? "border-emerald-500 bg-zinc-800/50 text-emerald-500"
          : "border-transparent text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200"
      )}
      title={label}
    >
      <Icon icon={icon} className="w-6 h-6" />
      {/* Tooltip */}
      <div className="absolute left-14 px-2 py-1 bg-zinc-700 text-zinc-100 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
        {label}
      </div>
    </button>
  );
}

function ExplorerView({
  features,
  layers,
  baseLayer,
  onSelectFeature,
  onSelectLayer,
  onBaseLayerChange,
  onFeatureVisibilityChange,
  onLayerVisibilityChange,
  onDeleteFeature,
}: {
  features: FeatureData[];
  layers: LayerDTO[];
  baseLayer: BaseKey;
  onSelectFeature: (feature: FeatureData) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onBaseLayerChange: (key: BaseKey) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onDeleteFeature: (featureId: string) => void;
}) {
  return (
    <div className="p-3 space-y-4">
      {/* Base Layer Selection */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase">
          Base Layer
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => onBaseLayerChange("osm")}
            className={cn(
              "flex-1 py-2 px-2 rounded-md text-xs flex flex-col items-center justify-center gap-1 border transition-all",
              baseLayer === "osm"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
            )}
          >
            <Icon icon="mdi:map-outline" className="w-4 h-4" />
            <span>OSM</span>
          </button>
          <button
            onClick={() => onBaseLayerChange("sat")}
            className={cn(
              "flex-1 py-2 px-2 rounded-md text-xs flex flex-col items-center justify-center gap-1 border transition-all",
              baseLayer === "sat"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
            )}
          >
            <Icon icon="mdi:satellite-variant" className="w-4 h-4" />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => onBaseLayerChange("dark")}
            className={cn(
              "flex-1 py-2 px-2 rounded-md text-xs flex flex-col items-center justify-center gap-1 border transition-all",
              baseLayer === "dark"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
            )}
          >
            <Icon icon="mdi:moon-waning-crescent" className="w-4 h-4" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Layers List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase">
            Layers ({layers.length})
          </h4>
        </div>
        {layers.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">No layers</p>
        ) : (
          <div className="space-y-1">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-zinc-800/50 cursor-pointer group"
                onClick={() => onSelectLayer(layer)}
              >
                <Icon
                  icon="mdi:folder-outline"
                  className="w-4 h-4 text-zinc-400"
                />
                <span className="flex-1 text-sm text-zinc-300 truncate">
                  {layer.layerName}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerVisibilityChange(layer.id, !layer.isPublic);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icon
                    icon={layer.isPublic ? "mdi:eye" : "mdi:eye-off"}
                    className={cn(
                      "w-4 h-4",
                      layer.isPublic ? "text-emerald-500" : "text-zinc-500"
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features List */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase">
          Features ({features.length})
        </h4>
        {features.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-2">No features</p>
        ) : (
          <div className="space-y-1">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-zinc-800/50 cursor-pointer group"
                onClick={() => onSelectFeature(feature)}
              >
                <Icon
                  icon={getFeatureIcon(feature.type)}
                  className="w-4 h-4 text-zinc-400"
                />
                <span className="flex-1 text-sm text-zinc-300 truncate">
                  {feature.name}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFeatureVisibilityChange(
                        feature.featureId || feature.id,
                        !feature.isVisible
                      );
                    }}
                  >
                    <Icon
                      icon={feature.isVisible ? "mdi:eye" : "mdi:eye-off"}
                      className={cn(
                        "w-4 h-4",
                        feature.isVisible
                          ? "text-emerald-500"
                          : "text-zinc-500"
                      )}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFeature(feature.featureId || feature.id);
                    }}
                  >
                    <Icon
                      icon="mdi:delete-outline"
                      className="w-4 h-4 text-red-500 hover:text-red-400"
                    />
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

function SegmentsView({
  segments,
  onSegmentClick,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
}: {
  segments: Segment[];
  onSegmentClick: (segmentId: string) => void;
  onAddSegment: () => void;
  onEditSegment: (segment: Segment) => void;
  onDeleteSegment?: (segmentId: string) => void;
}) {
  return (
    <div className="p-3 space-y-2">
      {segments.length === 0 ? (
        <p className="text-xs text-zinc-500 italic py-2">No segments</p>
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div
              key={segment.segmentId}
              className="p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-all group"
            >
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => onSegmentClick(segment.segmentId)}
              >
                <Icon
                  icon="mdi:filmstrip-box"
                  className="w-4 h-4 text-emerald-500"
                />
                <span className="flex-1 font-medium text-sm text-zinc-200">
                  {segment.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSegment(segment);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                  title="Edit segment"
                >
                  <Icon icon="mdi:pencil" className="w-4 h-4 text-blue-400" />
                </button>
                {onDeleteSegment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete segment "${segment.name}"?`)) {
                        onDeleteSegment(segment.segmentId);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                    title="Delete segment"
                  >
                    <Icon icon="mdi:delete-outline" className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-400 flex items-center gap-3">
                <span>
                  <Icon icon="mdi:clock-outline" className="inline w-3 h-3 mr-1" />
                  {(segment.durationMs / 1000).toFixed(1)}s
                </span>
                {segment.description && (
                  <span className="text-zinc-500 italic truncate">
                    {segment.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Segment Button */}
      <button
        onClick={onAddSegment}
        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 rounded-md flex items-center justify-center gap-2 transition-colors"
      >
        <Icon icon="mdi:plus-circle-outline" className="w-5 h-5" />
        <span className="text-sm font-medium">Add Segment</span>
      </button>
    </div>
  );
}

function SegmentFormView({
  editing,
  mapId,
  currentMap,
  onCancel,
  onSave,
}: {
  editing: Segment | null;
  mapId?: string;
  currentMap?: any;
  onCancel: () => void;
  onSave: (data: CreateSegmentRequest) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");

  // Zone management state
  const [attachedZones, setAttachedZones] = useState<SegmentZone[]>([]);
  const [zoneSearchTerm, setZoneSearchTerm] = useState("");
  const [zoneSearchResults, setZoneSearchResults] = useState<Zone[]>([]);
  const [isSearchingZones, setIsSearchingZones] = useState(false);
  const [showZoneSearch, setShowZoneSearch] = useState(false);

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

  // Fetch existing zones when editing
  useEffect(() => {
    if (editing && mapId) {
      getSegmentZones(mapId, editing.segmentId)
        .then(zones => setAttachedZones(zones))
        .catch(err => console.error("Failed to load segment zones:", err));
    }
  }, [editing, mapId]);

  // Zone search handler with debouncing
  useEffect(() => {
    if (!zoneSearchTerm.trim()) {
      setZoneSearchResults([]);
      return;
    }

    setIsSearchingZones(true);
    const timeoutId = setTimeout(() => {
      searchZones(zoneSearchTerm)
        .then(results => {
          setZoneSearchResults(results);
          setIsSearchingZones(false);
        })
        .catch(err => {
          console.error("Zone search failed:", err);
          setZoneSearchResults([]);
          setIsSearchingZones(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [zoneSearchTerm]);

  const handleAddZone = async (zone: Zone) => {
    if (!editing || !mapId) return;

    try {
      const newSegmentZone = await createSegmentZone(mapId, editing.segmentId, {
        zoneId: zone.zoneId,
        displayOrder: attachedZones.length,
        isVisible: true,
        highlightBoundary: true,
        boundaryColor: "#3b82f6",
        boundaryWidth: 2,
        fillZone: true,
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        showLabel: true,
        fitBoundsOnEntry: false,
      });

      setAttachedZones(prev => [...prev, newSegmentZone]);
      setZoneSearchTerm("");
      setShowZoneSearch(false);
    } catch (error) {
      console.error("Failed to add zone:", error);
      alert("Failed to add zone. Please try again.");
    }
  };

  const handleRemoveZone = async (segmentZoneId: string) => {
    if (!editing || !mapId) return;

    try {
      await deleteSegmentZone(mapId, editing.segmentId, segmentZoneId);
      setAttachedZones(prev => prev.filter(z => z.segmentZoneId !== segmentZoneId));
    } catch (error) {
      console.error("Failed to remove zone:", error);
      alert("Failed to remove zone. Please try again.");
    }
  };

  const handleCaptureView = () => {
    if (!currentMap) {
      console.warn("No map instance available for capture");
      return;
    }
    if (typeof currentMap.getCenter !== "function" || typeof currentMap.getZoom !== "function") {
      console.error("Invalid map instance - missing required methods");
      return;
    }
    try {
      const captured = getCurrentCameraState(currentMap);
      if (captured) {
        setCameraState(captured);
      }
    } catch (error) {
      console.error("Failed to capture camera state:", error);
    }
  };

  const handlePreviewCamera = () => {
    if (currentMap) {
      applyCameraState(currentMap, cameraState, { duration: 1000 });
    }
  };

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
          <p className="text-[10px] text-zinc-400">
            Use current map position as segment start.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCaptureView}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center justify-center gap-1"
          >
            <span>📷</span>
            <span>Capture</span>
          </button>
          <button
            type="button"
            onClick={handlePreviewCamera}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center gap-1"
          >
            <span>👁️</span>
            <span>Preview</span>
          </button>
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

      {/* Zone Management - Only show when editing */}
      {editing && mapId && (
        <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
          <div>
            <h4 className="text-xs font-semibold text-white">Associated Zones</h4>
            <p className="text-[10px] text-zinc-400">
              Geographic areas to highlight in this segment
            </p>
          </div>

          {/* Attached zones list */}
          {attachedZones.length > 0 && (
            <div className="space-y-1">
              {attachedZones.map((segmentZone) => (
                <div
                  key={segmentZone.segmentZoneId}
                  className="flex items-center gap-2 bg-zinc-800 rounded-lg px-2 py-1.5 group"
                >
                  <Icon icon="mdi:vector-polygon" className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200 truncate">
                      {segmentZone.zone?.name || "Unknown Zone"}
                    </div>
                    {segmentZone.zone?.zoneType && (
                      <div className="text-[10px] text-zinc-500">
                        {segmentZone.zone.zoneType}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveZone(segmentZone.segmentZoneId)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
                    title="Remove zone"
                  >
                    <Icon icon="mdi:close" className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Zone search */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowZoneSearch(!showZoneSearch)}
              className="w-full px-2 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-1"
            >
              <Icon icon="mdi:plus-circle-outline" className="w-4 h-4" />
              <span>Add Zone</span>
            </button>

            {showZoneSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
                <div className="p-2">
                  <input
                    type="text"
                    value={zoneSearchTerm}
                    onChange={(e) => setZoneSearchTerm(e.target.value)}
                    placeholder="Search zones..."
                    className="w-full bg-zinc-900 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/80"
                    autoFocus
                  />
                </div>

                {/* Search results */}
                <div className="max-h-48 overflow-y-auto">
                  {isSearchingZones && (
                    <div className="px-3 py-2 text-xs text-zinc-400 text-center">
                      Searching...
                    </div>
                  )}

                  {!isSearchingZones && zoneSearchResults.length === 0 && zoneSearchTerm.trim() && (
                    <div className="px-3 py-2 text-xs text-zinc-500 text-center italic">
                      No zones found
                    </div>
                  )}

                  {!isSearchingZones && zoneSearchResults.length > 0 && (
                    <div className="py-1">
                      {zoneSearchResults.map((zone) => {
                        const isAlreadyAttached = attachedZones.some(
                          (sz) => sz.zoneId === zone.zoneId
                        );

                        return (
                          <button
                            key={zone.zoneId}
                            onClick={() => !isAlreadyAttached && handleAddZone(zone)}
                            disabled={isAlreadyAttached}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs transition-colors",
                              isAlreadyAttached
                                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                                : "hover:bg-zinc-700 text-zinc-200"
                            )}
                          >
                            <div className="font-medium">{zone.name}</div>
                            <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                              <span>{zone.zoneType}</span>
                              {isAlreadyAttached && (
                                <span className="text-blue-400">✓ Added</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

function PoisView({
  pois,
  mapId,
  onPoiVisibilityToggle,
  onDeletePoi,
  onFocusPoi,
  onAddPoi,
  onEditPoi,
}: {
  pois: MapPoi[];
  mapId?: string;
  onPoiVisibilityToggle?: (poiId: string, isVisible: boolean) => void;
  onDeletePoi?: (poiId: string) => void;
  onFocusPoi?: (poiId: string, lngLat: [number, number]) => void;
  onAddPoi?: () => void;
  onEditPoi?: (poi: MapPoi) => void;
}) {
  const [expandedPoiId, setExpandedPoiId] = useState<string | null>(null);
  const [displayConfig, setDisplayConfig] = useState({
    isVisible: undefined as boolean | undefined,
    zIndex: undefined as number | undefined,
    showTooltip: undefined as boolean | undefined,
    tooltipContent: undefined as string | undefined,
  });
  const [interactionConfig, setInteractionConfig] = useState({
    openSlideOnClick: undefined as boolean | undefined,
    playAudioOnClick: undefined as boolean | undefined,
    audioUrl: undefined as string | undefined,
    externalUrl: undefined as string | undefined,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const extractLngLat = (markerGeometry: string): [number, number] | null => {
    if (!markerGeometry) return null;
    try {
      const geom = JSON.parse(markerGeometry);
      if (geom.type === "Point" && geom.coordinates) {
        return [Number(geom.coordinates[0]), Number(geom.coordinates[1])];
      }
      if (geom.type === "GeometryCollection" && geom.geometries) {
        const point = geom.geometries.find((g: any) => g.type === "Point");
        if (point && point.coordinates) {
          return [Number(point.coordinates[0]), Number(point.coordinates[1])];
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <div className="p-3 space-y-2">
      {pois.length === 0 ? (
        <p className="text-xs text-zinc-500 italic py-2">No POIs</p>
      ) : (
        <div className="space-y-2">
          {pois.map((poi) => (
            <div
              key={poi.poiId}
              className="p-3 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Icon
                  icon="mdi:map-marker"
                  className="w-4 h-4 text-blue-400 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-200 truncate">
                    {poi.title}
                  </div>
                  {poi.subtitle && (
                    <div className="text-xs text-zinc-400 truncate">
                      {poi.subtitle}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Visibility toggle */}
                  {onPoiVisibilityToggle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPoiVisibilityToggle(poi.poiId, !poi.isVisible);
                      }}
                      className="p-1 hover:bg-zinc-700 rounded transition-all"
                      title={poi.isVisible ? "Hide POI" : "Show POI"}
                    >
                      <Icon
                        icon={poi.isVisible ? "mdi:eye" : "mdi:eye-off"}
                        className={cn(
                          "w-4 h-4",
                          poi.isVisible ? "text-emerald-500" : "text-zinc-500"
                        )}
                      />
                    </button>
                  )}
                  {/* Settings/Config toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const isExpanded = expandedPoiId === poi.poiId;
                      setExpandedPoiId(isExpanded ? null : poi.poiId);
                      if (!isExpanded) {
                        // Load current config when expanding
                        setDisplayConfig({
                          isVisible: poi.isVisible,
                          zIndex: poi.zIndex,
                          showTooltip: poi.showTooltip,
                          tooltipContent: poi.tooltipContent ?? undefined,
                        });
                        setInteractionConfig({
                          openSlideOnClick: poi.openSlideOnClick,
                          playAudioOnClick: poi.playAudioOnClick,
                          audioUrl: poi.audioUrl ?? undefined,
                          externalUrl: poi.externalUrl ?? undefined,
                        });
                      }
                    }}
                    className="p-1 hover:bg-zinc-700 rounded transition-all"
                    title="Configure POI"
                  >
                    <Icon
                      icon="mdi:cog"
                      className={cn(
                        "w-4 h-4",
                        expandedPoiId === poi.poiId ? "text-emerald-400" : "text-zinc-400"
                      )}
                    />
                  </button>
                  {/* Focus/Zoom to POI */}
                  {onFocusPoi && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const lngLat = extractLngLat(poi.markerGeometry);
                        if (lngLat) {
                          onFocusPoi(poi.poiId, lngLat);
                        }
                      }}
                      className="p-1 hover:bg-zinc-700 rounded transition-all"
                      title="Focus POI on map"
                    >
                      <Icon
                        icon="mdi:crosshairs-gps"
                        className="w-4 h-4 text-sky-400"
                      />
                    </button>
                  )}
                  {/* Edit */}
                  {onEditPoi && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPoi(poi);
                      }}
                      className="p-1 hover:bg-zinc-700 rounded transition-all"
                      title="Edit POI"
                    >
                      <Icon
                        icon="mdi:pencil"
                        className="w-4 h-4 text-blue-400"
                      />
                    </button>
                  )}
                  {/* Delete */}
                  {onDeletePoi && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete POI "${poi.title}"?`)) {
                          onDeletePoi(poi.poiId);
                        }
                      }}
                      className="p-1 hover:bg-zinc-700 rounded transition-all"
                      title="Delete POI"
                    >
                      <Icon
                        icon="mdi:delete-outline"
                        className="w-4 h-4 text-red-400"
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Configuration Section */}
              {expandedPoiId === poi.poiId && (
                <div className="border-t border-zinc-700 bg-zinc-900/50 p-3 mt-2">
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    {/* Display Config */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-400">
                        <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                        <span>Display Config</span>
                      </div>
                      <label className="flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!!displayConfig.isVisible}
                          onChange={(e) => setDisplayConfig({ ...displayConfig, isVisible: e.target.checked })}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-[11px]">Visible</span>
                      </label>
                      <label className="flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!!displayConfig.showTooltip}
                          onChange={(e) => setDisplayConfig({ ...displayConfig, showTooltip: e.target.checked })}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-[11px]">Show tooltip</span>
                      </label>
                      <div>
                        <label className="block text-zinc-400 mb-1 text-[10px]">Tooltip content</label>
                        <input
                          className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-white text-[11px] outline-none focus:ring-2 focus:ring-blue-500"
                          value={displayConfig.tooltipContent ?? ""}
                          onChange={(e) => setDisplayConfig({ ...displayConfig, tooltipContent: e.target.value })}
                          placeholder="Enter content..."
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1 text-[10px]">Z-Index</label>
                        <input
                          type="number"
                          className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-white text-[11px] outline-none focus:ring-2 focus:ring-blue-500"
                          value={Number.isFinite(displayConfig.zIndex as number) ? String(displayConfig.zIndex) : ""}
                          onChange={(e) => setDisplayConfig({ ...displayConfig, zIndex: e.target.value === "" ? undefined : Number(e.target.value) })}
                          placeholder="0"
                        />
                      </div>
                      <button
                        className="w-full px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium transition-colors disabled:opacity-50"
                        disabled={isSavingConfig}
                        onClick={async () => {
                          try {
                            setIsSavingConfig(true);
                            await updatePoiDisplayConfig(poi.poiId, displayConfig);
                            // Refresh POI list if available
                            if (onPoiVisibilityToggle) {
                              window.dispatchEvent(
                                new CustomEvent("poi:updated", {
                                  detail: { mapId, poiId: poi.poiId },
                                })
                              );
                            }
                          } catch (error) {
                            console.error("Failed to save display config:", error);
                            alert("Failed to save display config");
                          } finally {
                            setIsSavingConfig(false);
                          }
                        }}
                      >
                        💾 Save display
                      </button>
                    </div>

                    {/* Interaction Config */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400">
                        <Icon icon="mdi:cursor-pointer" className="w-3.5 h-3.5" />
                        <span>Interaction Config</span>
                      </div>
                      <label className="flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!!interactionConfig.openSlideOnClick}
                          onChange={(e) => setInteractionConfig({ ...interactionConfig, openSlideOnClick: e.target.checked })}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-[11px]">Open slide on click</span>
                      </label>
                      <label className="flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!!interactionConfig.playAudioOnClick}
                          onChange={(e) => setInteractionConfig({ ...interactionConfig, playAudioOnClick: e.target.checked })}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-[11px]">Play audio on click</span>
                      </label>
                      <div>
                        <label className="block text-zinc-400 mb-1 text-[10px]">Audio URL</label>
                        <input
                          className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-white text-[11px] outline-none focus:ring-2 focus:ring-purple-500"
                          value={interactionConfig.audioUrl ?? ""}
                          onChange={(e) => setInteractionConfig({ ...interactionConfig, audioUrl: e.target.value })}
                          placeholder="https://example.com/audio.mp3"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1 text-[10px]">External URL</label>
                        <input
                          className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-white text-[11px] outline-none focus:ring-2 focus:ring-purple-500"
                          value={interactionConfig.externalUrl ?? ""}
                          onChange={(e) => setInteractionConfig({ ...interactionConfig, externalUrl: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>
                      <button
                        className="w-full px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium transition-colors disabled:opacity-50"
                        disabled={isSavingConfig}
                        onClick={async () => {
                          try {
                            setIsSavingConfig(true);
                            await updatePoiInteractionConfig(poi.poiId, interactionConfig);
                            // Refresh POI list if available
                            if (onPoiVisibilityToggle) {
                              window.dispatchEvent(
                                new CustomEvent("poi:updated", {
                                  detail: { mapId, poiId: poi.poiId },
                                })
                              );
                            }
                          } catch (error) {
                            console.error("Failed to save interaction config:", error);
                            alert("Failed to save interaction config");
                          } finally {
                            setIsSavingConfig(false);
                          }
                        }}
                      >
                        💾 Save interaction
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add POI Button */}
      {onAddPoi && (
        <button
          onClick={onAddPoi}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center justify-center gap-2 transition-colors"
        >
          <Icon icon="mdi:plus-circle-outline" className="w-5 h-5" />
          <span className="text-sm font-medium">Add POI</span>
        </button>
      )}
    </div>
  );
}

function PoiFormView({
  editing,
  currentMap,
  isPickingLocation,
  onPickLocation,
  onCancel,
  onSave,
}: {
  editing: MapPoi | null;
  currentMap?: any;
  isPickingLocation: boolean;
  onPickLocation: () => void;
  onCancel: () => void;
  onSave: (data: LocationPoiDialogForm) => Promise<void>;
}) {
  const [title, setTitle] = useState(editing?.title || "");
  const [subtitle, setSubtitle] = useState(editing?.subtitle || "");
  const [storyContent, setStoryContent] = useState(editing?.storyContent || "");
  const [markerGeometry, setMarkerGeometry] = useState(editing?.markerGeometry || "");
  const [locationType, setLocationType] = useState<"PointOfInterest" | "Line" | "Polygon" | "TextOnly" | "MediaSpot" | "Custom">(
    editing?.locationType || "PointOfInterest"
  );
  const [iconType, setIconType] = useState(editing?.iconType || "📍");
  const [iconColor, setIconColor] = useState(editing?.iconColor || "#FF0000");
  const [iconSize, setIconSize] = useState(editing?.iconSize ?? 32);
  const [highlightOnEnter, setHighlightOnEnter] = useState(editing?.highlightOnEnter ?? false);
  const [showTooltip, setShowTooltip] = useState(editing?.showTooltip ?? true);
  const [tooltipContent, setTooltipContent] = useState(editing?.tooltipContent || "");
  const [isVisible, setIsVisible] = useState(editing?.isVisible ?? true);
  const [zIndex, setZIndex] = useState(editing?.zIndex ?? 100);
  const [displayOrder, setDisplayOrder] = useState(editing?.displayOrder ?? 0);
  const [openSlideOnClick, setOpenSlideOnClick] = useState(editing?.openSlideOnClick ?? false);
  const [slideContent, setSlideContent] = useState(editing?.slideContent || "");
  const [playAudioOnClick, setPlayAudioOnClick] = useState(editing?.playAudioOnClick ?? false);
  const [audioUrl, setAudioUrl] = useState(editing?.audioUrl || "");
  const [externalUrl, setExternalUrl] = useState(editing?.externalUrl || "");
  const [mediaResources, setMediaResources] = useState(editing?.mediaResources || "");
  const [entryEffect, setEntryEffect] = useState(editing?.entryEffect || "fade");
  const [exitEffect, setExitEffect] = useState(editing?.exitEffect || "fade");
  const [entryDelayMs, setEntryDelayMs] = useState(editing?.entryDelayMs ?? 0);
  const [entryDurationMs, setEntryDurationMs] = useState(editing?.entryDurationMs ?? 400);
  const [isSaving, setIsSaving] = useState(false);

  // Extract coordinates from markerGeometry for display
  const extractCoordinates = (geometry: string): { lng: number; lat: number } | null => {
    if (!geometry) return null;
    try {
      const parsed = JSON.parse(geometry);
      if (parsed.type === "Point" && Array.isArray(parsed.coordinates) && parsed.coordinates.length >= 2) {
        return {
          lng: Number(parsed.coordinates[0]),
          lat: Number(parsed.coordinates[1])
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  // Listen for location picked event
  useEffect(() => {
    const handleLocationPicked = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { lngLat } = customEvent.detail;

      console.log("[PoiFormView] Location picked:", lngLat);

      const geometry = JSON.stringify({
        type: "Point",
        coordinates: [lngLat[0], lngLat[1]],
      });

      setMarkerGeometry(geometry);
    };

    window.addEventListener("poi:locationPicked", handleLocationPicked);
    return () => {
      window.removeEventListener("poi:locationPicked", handleLocationPicked);
    };
  }, []);

  const hasLocation = Boolean(markerGeometry);
  const coordinates = extractCoordinates(markerGeometry);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setMarkerGeometry(JSON.stringify(json));
    } catch {
      alert("File không hợp lệ hoặc không phải JSON!");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }
    if (!markerGeometry) {
      alert("Please pick a location on the map");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        subtitle: subtitle?.trim() || undefined,
        storyContent: storyContent?.trim() || undefined,
        locationType,
        markerGeometry,
        displayOrder,
        iconType: iconType?.trim() || undefined,
        iconColor: iconColor || undefined,
        iconSize: iconSize || undefined,
        highlightOnEnter,
        showTooltip,
        tooltipContent: tooltipContent?.trim() || undefined,
        isVisible,
        zIndex,
        openSlideOnClick,
        slideContent: slideContent?.trim() || undefined,
        playAudioOnClick,
        audioUrl: audioUrl?.trim() || undefined,
        externalUrl: externalUrl?.trim() || undefined,
        mediaResources: mediaResources?.trim() || undefined,
        entryEffect: entryEffect || undefined,
        exitEffect: exitEffect || undefined,
        entryDelayMs: entryDelayMs || undefined,
        entryDurationMs: entryDurationMs || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm overflow-y-auto">
      {/* Location Selection */}
      <div>
        <label className="block text-white/60 mb-2">Vị trí trên bản đồ *</label>
        {hasLocation ? (
          <div className="bg-emerald-900/20 border border-emerald-500/50 rounded p-3 mb-2">
            <p className="text-emerald-300 text-xs mb-1">✅ Đã chọn vị trí</p>
            <textarea
              rows={3}
              value={markerGeometry}
              readOnly
              className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
            />
          </div>
        ) : (
          <div className="bg-blue-900/20 border border-blue-500/50 rounded p-3 mb-2">
            <p className="text-blue-300 text-xs mb-2">
              {isPickingLocation
                ? "🔄 Đang chờ bạn chọn vị trí trên bản đồ..."
                : "🗺️ Chưa chọn vị trí"}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPickLocation}
            disabled={isPickingLocation || isSaving}
            className={`px-3 py-1.5 rounded text-xs ${
              isPickingLocation
                ? "bg-yellow-600 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            } disabled:opacity-50`}
          >
            {isPickingLocation ? "Đang chọn..." : "Chọn trên bản đồ"}
          </button>
          <input
            type="file"
            accept=".json,.geojson"
            onChange={handleFileUpload}
            className="hidden"
            id="geojson-upload"
          />
          <label
            htmlFor="geojson-upload"
            className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs cursor-pointer"
          >
            Tải file GeoJSON
          </label>
        </div>
      </div>

      {/* Basic Info */}
      <div>
        <label className="block text-white/60 mb-1">Tiêu đề *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Cầu Sài Gòn"
          className="w-full rounded bg-zinc-800 px-3 py-2 outline-none text-white"
        />
      </div>

      <div>
        <label className="block text-white/60 mb-1">Phụ đề</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="VD: Điểm nhìn đẹp lúc hoàng hôn"
          className="w-full rounded bg-zinc-800 px-3 py-2 outline-none text-white"
        />
      </div>

      {/* Story Content */}
      <div>
        <label className="block text-white/60 mb-1">Nội dung câu chuyện</label>
        <textarea
          value={storyContent}
          onChange={(e) => setStoryContent(e.target.value)}
          rows={3}
          placeholder="Mô tả về địa điểm này..."
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
        />
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-white/60 mb-2">Loại vị trí</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "PointOfInterest", label: "POI" },
            { value: "MediaSpot", label: "Media" },
            { value: "TextOnly", label: "Text" },
            { value: "Line", label: "Line" },
            { value: "Polygon", label: "Polygon" },
            { value: "Custom", label: "Custom" },
          ] as const).map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setLocationType(type.value)}
              className={`px-3 py-2 rounded text-xs ${
                locationType === type.value
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Styling */}
      <div className="border-t border-zinc-700 pt-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Icon Styling</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 mb-1">Icon</label>
            <input
              type="text"
              value={iconType}
              onChange={(e) => setIconType(e.target.value)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-center text-2xl"
              placeholder="📍"
            />
          </div>
          <div>
            <label className="block text-white/60 mb-1">Color</label>
            <input
              type="color"
              value={iconColor}
              onChange={(e) => setIconColor(e.target.value)}
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-white/60 mb-1">
            Icon Size: {iconSize}px
          </label>
          <input
            type="range"
            min="16"
            max="64"
            value={iconSize}
            onChange={(e) => setIconSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Display Settings */}
      <div className="border-t border-zinc-700 pt-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Cài đặt hiển thị</h3>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={highlightOnEnter}
              onChange={(e) => setHighlightOnEnter(e.target.checked)}
            />
            <span className="text-sm text-zinc-300">Highlight khi vào</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
            />
            <span className="text-sm text-zinc-300">Hiển thị</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-zinc-400 mb-1 text-xs">Z-Index</label>
            <input
              type="number"
              value={zIndex}
              onChange={(e) => setZIndex(parseInt(e.target.value) || 0)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1 text-xs">Thứ tự hiển thị</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={showTooltip}
            onChange={(e) => setShowTooltip(e.target.checked)}
          />
          <span className="text-sm font-medium text-zinc-300">
            Hiển thị Tooltip (Rich HTML)
          </span>
        </label>
        {showTooltip && (
          <div className="space-y-2">
            <RichHTMLEditor
              value={tooltipContent}
              onChange={(html) => setTooltipContent(html)}
            />
          </div>
        )}
      </div>

      {/* Slide */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={openSlideOnClick}
            onChange={(e) => setOpenSlideOnClick(e.target.checked)}
          />
          <span className="text-sm font-medium text-zinc-300">
            Mở Slide khi click (Rich HTML)
          </span>
        </label>
        {openSlideOnClick && (
          <div className="space-y-2">
            <RichHTMLEditor
              value={slideContent}
              onChange={(html) => setSlideContent(html)}
            />
          </div>
        )}
      </div>

      {/* Audio */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={playAudioOnClick}
            onChange={(e) => setPlayAudioOnClick(e.target.checked)}
          />
          <span className="text-sm font-medium text-zinc-300">Phát Audio khi click</span>
        </label>
        {playAudioOnClick && (
          <input
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://example.com/audio.mp3"
            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
          />
        )}
      </div>

      {/* External URL */}
      <div>
        <label className="block text-white/60 mb-1">External URL</label>
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
        />
      </div>

      {/* Media Resources */}
      <div>
        <label className="block text-white/60 mb-1">Tài nguyên Media</label>
        <textarea
          value={mediaResources}
          onChange={(e) => setMediaResources(e.target.value)}
          rows={2}
          placeholder="URLs của hình ảnh, video... (mỗi URL một dòng)"
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
        />
      </div>

      {/* Animation Configuration */}
      <div className="border-t border-zinc-700 pt-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">⚡ Animation Effects</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white/60 mb-1 text-xs">Entry Effect</label>
            <select
              value={entryEffect}
              onChange={(e) => setEntryEffect(e.target.value)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="scale">Scale</option>
              <option value="slide-up">Slide Up</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 mb-1 text-xs">Exit Effect</label>
            <select
              value={exitEffect}
              onChange={(e) => setExitEffect(e.target.value)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="scale">Scale</option>
              <option value="slide-down">Slide Down</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-white/60 mb-1 text-xs">
              Entry Delay: {entryDelayMs}ms
            </label>
            <input
              type="range"
              min="0"
              max="2000"
              step="100"
              value={entryDelayMs}
              onChange={(e) => setEntryDelayMs(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-white/60 mb-1 text-xs">
              Entry Duration: {entryDurationMs}ms
            </label>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={entryDurationMs}
              onChange={(e) => setEntryDurationMs(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10">
        <button
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
          onClick={onCancel}
          disabled={isSaving}
        >
          Hủy
        </button>
        <button
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white"
          onClick={handleSubmit}
          disabled={!title.trim() || !markerGeometry || isSaving}
        >
          {isSaving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo mới"}
        </button>
      </div>
    </div>
  );
}

function ZonesView() {
  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-zinc-500 italic py-2">Zone management coming soon</p>
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
