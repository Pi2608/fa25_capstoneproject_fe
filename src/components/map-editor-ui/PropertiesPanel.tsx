"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import type { Segment } from "@/lib/api-storymap";

type SelectedEntity = {
  type: "feature" | "layer" | "segment";
  data: FeatureData | LayerDTO | Segment;
};

interface PropertiesPanelProps {
  isOpen: boolean;
  selectedItem: SelectedEntity | null;
  onClose: () => void;
  onUpdate?: (updates: any) => Promise<void>;
}

export function PropertiesPanel({
  isOpen,
  selectedItem,
  onClose,
  onUpdate,
}: PropertiesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      if (isOpen) {
        gsap.fromTo(
          panelRef.current,
          { x: 360 },
          { x: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: 360,
        duration: 0.3,
        ease: "power2.in",
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  };

  if (!isOpen || !selectedItem) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-10 bottom-0 w-[280px] bg-zinc-900/95 backdrop-blur-lg border-l border-zinc-800 z-[1500] overflow-y-auto"
      style={{ transform: "translateX(360px)" }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Icon
            icon={getItemIcon(selectedItem.type)}
            className="w-5 h-5 text-zinc-400"
          />
          <h3 className="font-semibold text-sm text-zinc-200">Properties</h3>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          title="Close"
        >
          <Icon icon="mdi:close" className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {selectedItem.type === "feature" && (
          <FeaturePropertiesContent
            feature={selectedItem.data as FeatureData}
            onUpdate={onUpdate}
          />
        )}
        {selectedItem.type === "layer" && (
          <LayerPropertiesContent
            layer={selectedItem.data as LayerDTO}
            onUpdate={onUpdate}
          />
        )}
        {selectedItem.type === "segment" && (
          <SegmentPropertiesContent
            segment={selectedItem.data as Segment}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

function FeaturePropertiesContent({
  feature,
  onUpdate,
}: {
  feature: FeatureData;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Feature Info</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-200">{feature.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Type:</span>
            <span className="text-zinc-200 capitalize">{feature.type}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Visible:</span>
            <span className={cn("text-sm", feature.isVisible ? "text-emerald-500" : "text-zinc-500")}>
              {feature.isVisible ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 italic">
          Full style and attribute editing will be available in the next update.
        </p>
      </div>
    </div>
  );
}

function LayerPropertiesContent({
  layer,
  onUpdate,
}: {
  layer: LayerDTO;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Layer Info</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-200">{layer.layerName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Type:</span>
            <span className="text-zinc-200">{layer.layerType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Features:</span>
            <span className="text-zinc-200">{layer.featureCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Visible:</span>
            <span className={cn("text-sm", layer.isPublic ? "text-emerald-500" : "text-zinc-500")}>
              {layer.isPublic ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 italic">
          Layer configuration options will be expanded in future updates.
        </p>
      </div>
    </div>
  );
}

function SegmentPropertiesContent({
  segment,
  onUpdate,
}: {
  segment: Segment;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Segment Info</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-200">{segment.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Duration:</span>
            <span className="text-zinc-200">{(segment.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Order:</span>
            <span className="text-zinc-200">#{segment.displayOrder + 1}</span>
          </div>
        </div>
      </div>

      {segment.description && (
        <div className="border-t border-zinc-800 pt-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Description</h4>
          <p className="text-sm text-zinc-400">{segment.description}</p>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Contents</h4>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Zones:</span>
            <span className="text-zinc-200">{segment.zones?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Layers:</span>
            <span className="text-zinc-200">{segment.layers?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Locations:</span>
            <span className="text-zinc-200">{segment.locations?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 italic">
          Detailed segment editing is available in the left sidebar.
        </p>
      </div>
    </div>
  );
}

function getItemIcon(type: string): string {
  const iconMap: Record<string, string> = {
    feature: "mdi:vector-square",
    layer: "mdi:layers-outline",
    segment: "mdi:filmstrip-box",
  };

  return iconMap[type] || "mdi:information-outline";
}
