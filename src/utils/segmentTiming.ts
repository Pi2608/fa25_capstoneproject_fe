import type { Segment, RouteAnimation } from "@/lib/api-storymap";

export function calculateMaxRouteEndTime(routeAnimations: RouteAnimation[]): number {
  if (!routeAnimations || routeAnimations.length === 0) {
    return 0;
  }

  let maxEndTime = 0;

  for (const route of routeAnimations) {
    const startTime = route.startTimeMs ?? 0;
    let routeEndTime: number;

    if (route.endTimeMs !== undefined && route.endTimeMs !== null) {
      // Use explicit endTimeMs if provided
      routeEndTime = route.endTimeMs;
    } else if (route.startTimeMs !== undefined && route.startTimeMs !== null) {
      // Time-based mode: just add duration to start time
      routeEndTime = startTime + route.durationMs;
    } else {
      let totalTime = 0;

      if (route.cameraStateBefore) {
        totalTime += 1000; // cameraAnimationDurationMs from useSequentialRoutePlayback
      }

      // Start delay
      if (route.startDelayMs && route.startDelayMs > 0) {
        totalTime += route.startDelayMs;
      }

      // Route animation duration
      totalTime += route.durationMs;

      // Camera after animation (if exists)
      if (route.cameraStateAfter) {
        totalTime += 1000; // cameraAnimationDurationMs from useSequentialRoutePlayback
      }

      // Location popup display time (if enabled)
      if (route.showLocationInfoOnArrival && route.locationInfoDisplayDurationMs) {
        totalTime += route.locationInfoDisplayDurationMs;
      }

      routeEndTime = totalTime;
    }

    maxEndTime = Math.max(maxEndTime, routeEndTime);
  }

  return maxEndTime;
}

export function calculateEffectiveSegmentDuration(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): number {
  const baseDuration = segment.durationMs || 5000;

  // Use provided routeAnimations or fallback to segment.routeAnimations
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  return Math.max(baseDuration, maxRouteEndTime);
}

export function calculateTotalTimelineDuration(segments: Segment[]): number {
  let totalDuration = 0;

  for (const segment of segments) {
    const effectiveDuration = calculateEffectiveSegmentDuration(segment);
    totalDuration += effectiveDuration;
  }

  return totalDuration;
}

export function hasExtendedRouteAnimations(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): boolean {
  const baseDuration = segment.durationMs || 5000;
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  return maxRouteEndTime > baseDuration;
}

export function calculateRouteExtensionTime(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): number {
  const baseDuration = segment.durationMs || 5000;
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  return Math.max(0, maxRouteEndTime - baseDuration);
}
