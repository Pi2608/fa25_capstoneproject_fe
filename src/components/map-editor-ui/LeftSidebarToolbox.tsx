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
  CreateLocationRequest,
  CreateSegmentZoneRequest,
  AttachLayerRequest,
} from "@/lib/api-storymap";
import {
  parseCameraState,
  stringifyCameraState,
  getCurrentCameraState,
  applyCameraState,
} from "@/lib/api-storymap";
import LocationDialog from "@/components/storymap/LocationDialog";
import ZoneSelectionDialog from "@/components/storymap/ZoneSelectionDialog";
import LayerAttachDialog from "@/components/storymap/LayerAttachDialog";

interface LeftSidebarToolboxProps {
  activeView: "explorer" | "segments" | "transitions" | null;
  onViewChange: (view: "explorer" | "segments" | "transitions" | null) => void;

  features: FeatureData[];
  layers: LayerDTO[];
  segments: Segment[];
  transitions: TimelineTransition[];
  baseLayer: BaseKey;
  currentMap?: any;
  mapId?: string; // Required for adding locations, zones, and layers

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
}

type ViewType = "explorer" | "segments" | "transitions";
type FormMode = "list" | "create" | "edit";

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
}: LeftSidebarToolboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
  const [waitingForLocation, setWaitingForLocation] = useState(false);

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
    
    setShowLocationDialog(false);
    setWaitingForLocation(false);
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
    
    setShowZoneDialog(false);
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
    
    setShowLayerDialog(false);
  }, [editingSegment, onAddLayer, mapId]);

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
            </span>

            <div className="flex items-center gap-1">
              {/* Back button for forms */}
              {((activeView === "segments" && segmentFormMode !== "list") ||
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

              {/* Close panel button (only show when in list mode) */}
              {((activeView === "segments" && segmentFormMode === "list") ||
                (activeView === "transitions" && transitionFormMode === "list") ||
                activeView === "explorer") && (
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
                onAddLocation={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setShowLocationDialog(true);
                  }
                }}
                onAddZone={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setShowZoneDialog(true);
                  }
                }}
                onAddLayer={(segmentId: string) => {
                  const segment = segments.find(s => s.segmentId === segmentId);
                  if (segment) {
                    setEditingSegment(segment);
                    setShowLayerDialog(true);
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
                onAddLocation={() => setShowLocationDialog(true)}
                onAddZone={() => setShowZoneDialog(true)}
                onAddLayer={() => setShowLayerDialog(true)}
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
          </div>
        </div>
      </div>

      {/* Dialogs for adding location, zone, and layer */}
      {editingSegment && mapId && (
        <>
          <LocationDialog
            isOpen={showLocationDialog}
            onClose={() => {
              setShowLocationDialog(false);
              setWaitingForLocation(false);
            }}
            onSave={handleAddLocation}
            segmentId={editingSegment.segmentId}
            currentMap={currentMap}
            waitingForLocation={waitingForLocation}
            setWaitingForLocation={setWaitingForLocation}
          />

          <ZoneSelectionDialog
            isOpen={showZoneDialog}
            onClose={() => setShowZoneDialog(false)}
            onSave={handleAddZone}
            segmentId={editingSegment.segmentId}
          />

          <LayerAttachDialog
            isOpen={showLayerDialog}
            onClose={() => setShowLayerDialog(false)}
            onSave={handleAddLayer}
            mapId={mapId}
            segmentId={editingSegment.segmentId}
            attachedLayerIds={editingSegment.layers?.map(l => l.layerId) || []}
          />
        </>
      )}
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
  onAddLocation,
  onAddZone,
  onAddLayer,
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
  mapId?: string;
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
              
              {/* Quick action buttons for adding location/zone/layer */}
              {mapId && (onAddLocation || onAddZone || onAddLayer) && (
                <div className="mt-2 pt-2 border-t border-zinc-700/50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onAddLocation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddLocation(segment.segmentId);
                      }}
                      className="flex-1 px-2 py-1 text-[10px] rounded bg-emerald-600/80 hover:bg-emerald-600 text-white flex items-center justify-center gap-1"
                      title="Add location"
                    >
                      <Icon icon="mdi:map-marker" className="w-3 h-3" />
                      <span>Location</span>
                    </button>
                  )}
                  {onAddZone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddZone(segment.segmentId);
                      }}
                      className="flex-1 px-2 py-1 text-[10px] rounded bg-blue-600/80 hover:bg-blue-600 text-white flex items-center justify-center gap-1"
                      title="Add zone"
                    >
                      <Icon icon="mdi:shape" className="w-3 h-3" />
                      <span>Zone</span>
                    </button>
                  )}
                  {onAddLayer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddLayer(segment.segmentId);
                      }}
                      className="flex-1 px-2 py-1 text-[10px] rounded bg-purple-600/80 hover:bg-purple-600 text-white flex items-center justify-center gap-1"
                      title="Attach layer"
                    >
                      <Icon icon="mdi:layers" className="w-3 h-3" />
                      <span>Layer</span>
                    </button>
                  )}
                </div>
              )}
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
  currentMap,
  mapId,
  onCancel,
  onSave,
  onAddLocation,
  onAddZone,
  onAddLayer,
}: {
  editing: Segment | null;
  currentMap?: any;
  mapId?: string;
  onCancel: () => void;
  onSave: (data: CreateSegmentRequest) => Promise<void>;
  onAddLocation: () => void;
  onAddZone: () => void;
  onAddLayer: () => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");

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

      {/* Attach Location, Zone, or Layer - Only show when editing an existing segment */}
      {editing && editing.segmentId && (
        <div className="border border-zinc-700/80 rounded-lg px-3 py-2 space-y-2 bg-zinc-900/60">
          <div>
            <h4 className="text-xs font-semibold text-white">Attach to Segment</h4>
            <p className="text-[10px] text-zinc-400">
              Add locations, zones, or layers to this segment
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onAddLocation}
              className="px-2 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1"
              title="Add location/POI marker"
            >
              <Icon icon="mdi:map-marker" className="w-4 h-4" />
              <span>Location</span>
            </button>
            <button
              type="button"
              onClick={onAddZone}
              className="px-2 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-1"
              title="Add zone"
            >
              <Icon icon="mdi:shape" className="w-4 h-4" />
              <span>Zone</span>
            </button>
            <button
              type="button"
              onClick={onAddLayer}
              className="px-2 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center justify-center gap-1"
              title="Attach layer"
            >
              <Icon icon="mdi:layers" className="w-4 h-4" />
              <span>Layer</span>
            </button>
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
