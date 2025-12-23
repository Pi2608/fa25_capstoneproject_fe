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

/**
 * Calculate the end time of a single route (when it finishes playing)
 * @param route - Route animation
 * @returns End time in milliseconds
 */
function calculateRouteEndTime(route: RouteAnimation): number {
  if (route.endTimeMs !== undefined && route.endTimeMs !== null) {
    // Priority 1: Use explicit endTimeMs if provided
    return route.endTimeMs;
  } else if (route.startTimeMs != null) {
    // Priority 2: Time-based mode (startTimeMs can be 0, meaning "start at t=0")
    return route.startTimeMs + route.durationMs;
  } else if (route.startDelayMs != null) {
    // Priority 3: Delay-based mode
    return route.startDelayMs + route.durationMs;
  } else {
    // Priority 4: Sequential mode (no offset)
    return route.durationMs;
  }
}

/**
 * Find the maximum end time among all routes in segment
 * @param segment - Segment which contains route animations
 * @returns Maximum end time of any route (0 if no routes)
 */
export function getMaxRouteDuration(segment: Segment): number {
  // Check if segment doesn't have route animations
  if (!segment.routeAnimations || segment.routeAnimations.length === 0) {
    return 0;
  }

  let maxEndTime = 0;

  for (const route of segment.routeAnimations) {
    const routeEndTime = calculateRouteEndTime(route);
    maxEndTime = Math.max(maxEndTime, routeEndTime);
  }

  return maxEndTime;
}

/**
 * Calculate and return new segment duration after adding a new route
 * New segment duration = max end time among all routes (including the new one)
 *
 * @param segment - Current segment
 * @param newRoute - New route data (can have startTimeMs, startDelayMs, or neither)
 * @returns New segment duration
 */
export function extendSegmentDuration(
  segment: Segment,
  newRoute: { durationMs: number; startTimeMs?: number; startDelayMs?: number; endTimeMs?: number }
): number {
  const currentSegmentDuration = segment.durationMs || 5000;

  // Find the longest route end time currently in the segment
  const currentMaxEndTime = getMaxRouteDuration(segment);

  // Calculate end time of the new route
  const newRouteEndTime = calculateRouteEndTime(newRoute as RouteAnimation);

  // New segment duration = max end time of all routes (including new one)
  const maxEndTime = Math.max(currentMaxEndTime, newRouteEndTime);

  // Return the maximum between current segment duration and max route end time
  return Math.max(currentSegmentDuration, maxEndTime);
}

/**
 * Calculate and return new segment duration after EDITING an existing route
 * Replaces old route with new route, then finds the longest route
 *
 * @param segment - Current segment
 * @param oldRoute - Old route data (before edit)
 * @param newRoute - New route data (after edit)
 * @returns New segment duration
 */
export function updateSegmentDurationOnEdit(
  segment: Segment,
  oldRoute: { durationMs: number; startTimeMs?: number; startDelayMs?: number; endTimeMs?: number },
  newRoute: { durationMs: number; startTimeMs?: number; startDelayMs?: number; endTimeMs?: number }
): number {
  const currentSegmentDuration = segment.durationMs || 5000;

  // Check if segment doesn't have route animations
  if (!segment.routeAnimations || segment.routeAnimations.length === 0) {
    // No routes in segment, return new route end time
    const newRouteEndTime = calculateRouteEndTime(newRoute as RouteAnimation);
    return Math.max(currentSegmentDuration, newRouteEndTime);
  }

  // Calculate old and new route end times
  const oldRouteEndTime = calculateRouteEndTime(oldRoute as RouteAnimation);
  const newRouteEndTime = calculateRouteEndTime(newRoute as RouteAnimation);

  // Find max end time among all routes, replacing old with new
  let maxEndTime = 0;

  for (const route of segment.routeAnimations) {
    const routeEndTime = calculateRouteEndTime(route);

    // If this is the old route being edited, use new end time instead
    if (routeEndTime === oldRouteEndTime) {
      maxEndTime = Math.max(maxEndTime, newRouteEndTime);
    } else {
      maxEndTime = Math.max(maxEndTime, routeEndTime);
    }
  }

  // Return the maximum between current segment duration and max route end time
  return Math.max(currentSegmentDuration, maxEndTime);
}
