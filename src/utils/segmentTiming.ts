import type { Segment, RouteAnimation } from "@/lib/api-storymap";

export function calculateMaxRouteEndTime(routeAnimations: RouteAnimation[]): number {
  if (!routeAnimations || routeAnimations.length === 0) {
    return 0;
  }

  let maxEndTime = 0;

  for (const route of routeAnimations) {
    let routeEndTime: number;

    if (route.endTimeMs !== undefined && route.endTimeMs !== null) {
      // Priority 1: Use explicit endTimeMs if provided
      routeEndTime = route.endTimeMs;
    } else if (route.startTimeMs != null) {
      // Priority 2: Time-based mode (startTimeMs can be 0, meaning "start at t=0")
      const startTime = route.startTimeMs; // Can be 0
      routeEndTime = startTime + route.durationMs;
    } else {
      // Priority 3: Sequential mode (startTimeMs = null/undefined)
      // Routes run in sync with segment, no offset
      routeEndTime = route.durationMs;
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
