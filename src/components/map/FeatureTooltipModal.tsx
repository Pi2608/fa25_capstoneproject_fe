"use client";

import { useEffect, useMemo } from "react";
import { Icon } from '@iconify/react';
import { getFeatureIcon } from "@/utils/featureIcons";
import { useI18n } from "@/i18n/I18nProvider";
import type { FeatureData } from "@/utils/mapUtils";
import { serializeFeature } from "@/utils/mapUtils";

interface FeatureTooltipModalProps {
  visible: boolean;
  x: number;
  y: number;
  featureId: string | null;
  features: FeatureData[];
  onClose: () => void;
}

export default function FeatureTooltipModal({
  visible,
  x,
  y,
  featureId,
  features,
  onClose,
}: FeatureTooltipModalProps) {
  const { t } = useI18n();

  // Find the feature from state - this ensures we always have the latest data
  const feature = useMemo(() => {
    if (!featureId) return null;
    return features.find(f => f.featureId === featureId) || null;
  }, [featureId, features]);

  // Get geometry type from layer
  const geometryType = useMemo(() => {
    if (!feature?.layer) return 'Point';
    const { geometryType: geoType } = serializeFeature(feature.layer);
    return geoType;
  }, [feature]);

  // Translate feature type names
  const getTranslatedFeatureType = (type: string): string => {
    const typeKey = type.toLowerCase();
    const typeMap: Record<string, string> = {
      point: t('mapEditor', 'featureTypePoint'),
      linestring: t('mapEditor', 'featureTypeLine'),
      polygon: t('mapEditor', 'featureTypePolygon'),
      circle: t('mapEditor', 'featureTypeCircle'),
      rectangle: t('mapEditor', 'featureTypeRectangle'),
    };
    return typeMap[typeKey] || type;
  };

  // Translate the feature name if it matches a geometry type
  const displayName = feature?.name && ['Point', 'LineString', 'Polygon', 'Circle', 'Rectangle', 'Line'].includes(feature.name)
    ? getTranslatedFeatureType(feature.name)
    : (feature?.name || 'Unnamed Feature');

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target?.closest(".feature-tooltip-modal")) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Add a small delay before attaching click listener
    // to prevent immediate closure from the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);

    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="feature-tooltip-modal fixed z-[10000] bg-zinc-900/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[400px]"
      style={{ left: `${x}px`, top: `${y}px` }}
      suppressHydrationWarning={true}
    >
      {/* Header with feature name */}
      <div className="mb-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Icon
              icon={getFeatureIcon(geometryType)}
              className="w-5 h-5 text-emerald-400"
            />
          </div>
          <h3 className="text-base font-semibold text-white truncate">
            {displayName}
          </h3>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        {feature?.description ? (
          <div>
            <div className="text-xs text-white/50 mb-1">{t('mapEditor', 'tooltipDescription')}</div>
            <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap break-words">
              {feature.description}
            </p>
          </div>
        ) : (
          <div className="text-sm text-white/40 italic">
            {t('mapEditor', 'tooltipNoDescription')}
          </div>
        )}
      </div>

      {/* Close hint */}
      <div className="mt-3 pt-2 border-t border-white/10 text-xs text-white/30 text-center">
        {t('mapEditor', 'tooltipCloseHint')}
      </div>
    </div>
  );
}
