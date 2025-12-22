"use client";

import { useMemo } from "react";
import type { Segment, RouteAnimation } from "@/lib/api-storymap";
import { calculateEffectiveSegmentDuration } from "@/utils/segmentTiming";
import { cn } from "@/lib/utils";
import { Icon } from "../Icon";
import { useI18n } from "@/i18n/I18nProvider";

interface RouteTimingBarsProps {
  segments: Segment[];
  pixelsPerSecond: number;
  currentTime: number;
  onRouteClick?: (route: RouteAnimation, segmentId: string) => void;
}

interface RouteTimingData {
  route: RouteAnimation;
  segmentId: string;
  segmentName: string;
  absoluteStartTime: number; // Start time relative to timeline start (ms)
  absoluteEndTime: number; // End time relative to timeline start (ms)
  isOverlapping: boolean;
}

export function RouteTimingBars({
  segments,
  pixelsPerSecond,
  currentTime,
  onRouteClick,
}: RouteTimingBarsProps) {
  const { t } = useI18n();

  // Calculate absolute timing for all routes across segments
  const routeTimingData = useMemo<RouteTimingData[]>(() => {
    const allRoutes: RouteTimingData[] = [];
    let segmentStartTime = 0;

    segments.forEach((segment) => {
      const routes = segment.routeAnimations || [];
      const effectiveDuration = calculateEffectiveSegmentDuration(segment, routes);

      routes.forEach((route) => {
        const startTimeMs = route.startTimeMs ?? 0;
        const durationMs = route.durationMs;

        const absoluteStartTime = segmentStartTime + startTimeMs;
        const absoluteEndTime = absoluteStartTime + durationMs;

        allRoutes.push({
          route,
          segmentId: segment.segmentId,
          segmentName: segment.name,
          absoluteStartTime,
          absoluteEndTime,
          isOverlapping: false, // Will be calculated next
        });
      });

      segmentStartTime += effectiveDuration;
    });

    // Detect overlapping routes
    allRoutes.forEach((routeA, indexA) => {
      allRoutes.forEach((routeB, indexB) => {
        if (indexA !== indexB) {
          // Check if routes overlap in time
          const overlap =
            (routeA.absoluteStartTime < routeB.absoluteEndTime) &&
            (routeA.absoluteEndTime > routeB.absoluteStartTime);

          if (overlap) {
            routeA.isOverlapping = true;
          }
        }
      });
    });

    return allRoutes;
  }, [segments]);

  // Group overlapping routes into layers for vertical stacking
  const routeLayers = useMemo(() => {
    const layers: RouteTimingData[][] = [];
    const assigned = new Set<number>();

    routeTimingData.forEach((routeData, index) => {
      if (assigned.has(index)) return;

      // Find or create a layer for this route
      let layerIndex = 0;
      while (layerIndex < layers.length) {
        const layer = layers[layerIndex];

        // Check if this route overlaps with any route in this layer
        const hasConflict = layer.some((existingRoute) => {
          return (
            (routeData.absoluteStartTime < existingRoute.absoluteEndTime) &&
            (routeData.absoluteEndTime > existingRoute.absoluteStartTime)
          );
        });

        if (!hasConflict) {
          layer.push(routeData);
          assigned.add(index);
          break;
        }

        layerIndex++;
      }

      // Create new layer if no suitable layer found
      if (!assigned.has(index)) {
        layers.push([routeData]);
        assigned.add(index);
      }
    });

    return layers;
  }, [routeTimingData]);

  const maxLayers = routeLayers.length;
  const layerHeight = 20; // Height per layer in pixels
  const totalHeight = Math.max(maxLayers * layerHeight, 24); // Min 24px

  return (
    <div
      className="relative bg-zinc-900/30 border-b border-zinc-800/50"
      style={{ height: `${totalHeight}px` }}
    >
      {/* Layer backgrounds */}
      {routeLayers.map((_, layerIndex) => (
        <div
          key={layerIndex}
          className={cn(
            "absolute inset-x-0 border-b border-zinc-800/20",
            layerIndex % 2 === 0 ? "bg-zinc-900/20" : "bg-zinc-900/10"
          )}
          style={{
            top: `${layerIndex * layerHeight}px`,
            height: `${layerHeight}px`,
          }}
        />
      ))}

      {/* Route timing bars */}
      {routeLayers.map((layer, layerIndex) =>
        layer.map((routeData) => {
          const { route, segmentId, segmentName, absoluteStartTime, absoluteEndTime, isOverlapping } = routeData;

          const startX = (absoluteStartTime / 1000) * pixelsPerSecond + 16; // +16 for left padding
          const width = ((absoluteEndTime - absoluteStartTime) / 1000) * pixelsPerSecond;
          const top = layerIndex * layerHeight;

          // Check if route is currently playing
          const currentTimeMs = currentTime * 1000;
          const isActive = currentTimeMs >= absoluteStartTime && currentTimeMs <= absoluteEndTime;
          const isPast = currentTimeMs > absoluteEndTime;

          // Get icon emoji based on iconType
          const getIconEmoji = (iconType: string) => {
            const iconMap: Record<string, string> = {
              car: '🚗',
              walking: '🚶',
              bike: '🚴',
              plane: '✈️',
            };
            return iconMap[iconType] || '🚗';
          };

          return (
            <div
              key={`${segmentId}-${route.routeAnimationId}`}
              className={cn(
                "absolute rounded-md transition-all duration-200 cursor-pointer group",
                "border shadow-sm hover:shadow-md hover:z-10",
                isActive && "ring-2 ring-emerald-400 z-20",
                isPast && "opacity-60",
                isOverlapping && "border-yellow-500/50",
                !isActive && !isPast && "border-orange-500/40"
              )}
              style={{
                left: `${startX}px`,
                width: `${Math.max(width, 40)}px`, // Min width 40px for visibility
                top: `${top + 2}px`,
                height: `${layerHeight - 4}px`,
                backgroundColor: isActive
                  ? 'rgba(16, 185, 129, 0.3)' // emerald
                  : isPast
                  ? 'rgba(113, 113, 122, 0.2)' // zinc
                  : 'rgba(249, 115, 22, 0.25)', // orange
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onRouteClick) {
                  onRouteClick(route, segmentId);
                }
              }}
              title={`${route.fromName || t('mapEditor', 'routeStart')} → ${route.toName || t('mapEditor', 'routeEnd')}\n${t('mapEditor', 'routeSegment')} ${segmentName}\nStart: ${(absoluteStartTime / 1000).toFixed(1)}s\n${t('mapEditor', 'routeDuration')} ${(route.durationMs / 1000).toFixed(1)}s`}
            >
              {/* Route bar content */}
              <div className="h-full flex items-center justify-between px-1.5 overflow-hidden">
                {/* Left: Icon + Labels */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs flex-shrink-0">
                    {getIconEmoji(route.iconType || 'car')}
                  </span>

                  {width > 80 && (
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-medium text-white truncate">
                        {route.fromName || t('mapEditor', 'routeStart')} → {route.toName || t('mapEditor', 'routeEnd')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Duration badge */}
                {width > 60 && (
                  <div className={cn(
                    "px-1 py-0.5 rounded text-[8px] font-mono flex-shrink-0",
                    isActive ? "bg-emerald-500/30 text-emerald-200" : "bg-zinc-700/50 text-zinc-300"
                  )}>
                    {(route.durationMs / 1000).toFixed(1)}s
                  </div>
                )}
              </div>

              {/* Overlap indicator */}
              {isOverlapping && width > 40 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                  <Icon icon="mdi:layers-triple" className="w-2 h-2 text-zinc-900" />
                </div>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute inset-0 border-2 border-emerald-400 rounded-md animate-pulse pointer-events-none" />
              )}

              {/* Hover tooltip expansion */}
              <div className="absolute left-0 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap">
                  <div className="font-semibold">{route.fromName || t('mapEditor', 'routeStart')} → {route.toName || t('mapEditor', 'routeEnd')}</div>
                  <div className="text-zinc-400 text-[10px]">{t('mapEditor', 'routeSegment')} {segmentName}</div>
                  <div className="text-zinc-400 text-[10px]">
                    Start: {(absoluteStartTime / 1000).toFixed(1)}s | {t('mapEditor', 'routeDuration')} {(route.durationMs / 1000).toFixed(1)}s
                  </div>
                  {isOverlapping && (
                    <div className="text-yellow-400 text-[10px] mt-0.5">{t('mapEditor', 'routeOverlapsWarning')}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Empty state */}
      {routeTimingData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-zinc-500 italic">{t('mapEditor', 'routeNoTimingData')}</span>
        </div>
      )}
    </div>
  );
}
