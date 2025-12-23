"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO } from "@/lib/api-maps";
import type { Segment } from "@/lib/api-storymap";
import { FeatureStyleEditor } from "./FeatureStyleEditor";
import { useI18n } from "@/i18n/I18nProvider";

type SelectedEntity = {
  type: "feature" | "layer" | "segment";
  data: FeatureData | LayerDTO | Segment;
};

interface PropertiesPanelProps {
  isOpen: boolean;
  selectedItem: SelectedEntity | null;
  onClose: () => void;
  onUpdate?: (updates: any) => Promise<void>;
  onSave?: () => void;
  hasChanges?: boolean;
  onChangeStatus?: (hasChanges: boolean) => void;
  onSaveReady?: (saveFn: () => Promise<void>) => void;
}

export function PropertiesPanel({
  isOpen,
  selectedItem,
  onClose,
  onUpdate,
  onSave,
  hasChanges = false,
  onChangeStatus,
  onSaveReady,
}: PropertiesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

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
          <h3 className="font-semibold text-sm text-zinc-100">{t('mapEditor', 'propertiesPanelTitle')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {selectedItem.type === "feature" && onSave && (
            <button
              onClick={onSave}
              disabled={!hasChanges}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                hasChanges
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
              title={hasChanges ? t('mapEditor', 'propertiesPanelSaveChanges') : t('mapEditor', 'propertiesPanelNoChanges')}
            >
              <Icon icon="mdi:content-save" className="w-3.5 h-3.5" />
              {hasChanges ? t('mapEditor', 'propertiesPanelSaveChanges') : t('mapEditor', 'propertiesPanelNoChanges')}
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title={t('common', 'close')}
          >
            <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
          </button>
        </div>
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
            onChangeStatus={onChangeStatus}
            onSaveReady={onSaveReady}
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
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-emerald-400" />
          {t('mapEditor', 'propertiesPanelLayerInfo')}
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelName')}</span>
            <span className="text-zinc-100 font-medium">{layer.layerName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelType')}</span>
            <span className="text-zinc-100">{layer.layerType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelFeatures')}</span>
            <span className="text-zinc-100">{layer.featureCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelVisible')}</span>
            <span className={cn("text-sm font-medium", layer.isPublic ? "text-emerald-400" : "text-zinc-500")}>
              {layer.isPublic ? t('mapEditor', 'propertiesPanelYes') : t('mapEditor', 'propertiesPanelNo')}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-300/80 italic">
          {t('mapEditor', 'propertiesPanelLayerNote')}
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
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-emerald-400" />
          {t('mapEditor', 'propertiesPanelSegmentInfo')}
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelName')}</span>
            <span className="text-zinc-100 font-medium">{segment.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelDuration')}</span>
            <span className="text-zinc-100">{(segment.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelOrder')}</span>
            <span className="text-zinc-100">#{segment.displayOrder + 1}</span>
          </div>
        </div>
      </div>

      {segment.description && (
        <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
          <h4 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
            <Icon icon="mdi:text" className="w-4 h-4 text-blue-400" />
            {t('mapEditor', 'propertiesPanelDescription')}
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed">{segment.description}</p>
        </div>
      )}

      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
        <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Icon icon="mdi:package-variant-closed" className="w-4 h-4 text-purple-400" />
          {t('mapEditor', 'propertiesPanelContents')}
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelZones')}</span>
            <span className="text-zinc-100 font-medium">{segment.zones?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelLayers')}</span>
            <span className="text-zinc-100 font-medium">{segment.layers?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{t('mapEditor', 'propertiesPanelLocations')}</span>
            <span className="text-zinc-100 font-medium">{segment.locations?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-300/80 italic">
          {t('mapEditor', 'propertiesPanelSegmentNote')}
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
