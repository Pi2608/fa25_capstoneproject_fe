"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import type { Segment } from "@/lib/api-storymap";
import { FeatureStyleEditor } from "./FeatureStyleEditor";

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
          { x: 400, opacity: 0, scale: 0.95 },
          { x: 0, opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }
        );
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: 400,
        opacity: 0,
        scale: 0.95,
        duration: 0.25,
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
      className="fixed right-2 top-12 h-[50vh] w-[320px] bg-zinc-900/95 backdrop-blur-lg border border-zinc-700/50 rounded-2xl shadow-2xl z-[2000] overflow-hidden flex flex-col"
      style={{ transform: "translateX(400px)", opacity: 0 }}
    >
      {/* Header */}
      <div className="bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-700/50 p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon
            icon={getItemIcon(selectedItem.type)}
            className="w-5 h-5 text-emerald-400"
          />
          <h3 className="font-semibold text-sm text-zinc-100">Properties</h3>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Close"
        >
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3f3f46 transparent'
        }}
      >
        {selectedItem.type === "feature" && onUpdate && (
          <FeatureStyleEditor
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

function LayerPropertiesContent({
  layer,
  onUpdate,
}: {
  layer: LayerDTO;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-emerald-400" />
          Layer Info
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-100 font-medium">{layer.layerName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Type:</span>
            <span className="text-zinc-100">{layer.layerType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Features:</span>
            <span className="text-zinc-100">{layer.featureCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Visible:</span>
            <span className={cn("text-sm font-medium", layer.isPublic ? "text-emerald-400" : "text-zinc-500")}>
              {layer.isPublic ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-300/80 italic">
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
      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-emerald-400" />
          Segment Info
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-100 font-medium">{segment.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Duration:</span>
            <span className="text-zinc-100">{(segment.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Order:</span>
            <span className="text-zinc-100">#{segment.displayOrder + 1}</span>
          </div>
        </div>
      </div>

      {segment.description && (
        <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
          <h4 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
            <Icon icon="mdi:text" className="w-4 h-4 text-blue-400" />
            Description
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed">{segment.description}</p>
        </div>
      )}

      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:package-variant-closed" className="w-4 h-4 text-purple-400" />
          Contents
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Zones:</span>
            <span className="text-zinc-100 font-medium">{segment.zones?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Layers:</span>
            <span className="text-zinc-100 font-medium">{segment.layers?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Locations:</span>
            <span className="text-zinc-100 font-medium">{segment.locations?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-300/80 italic">
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
