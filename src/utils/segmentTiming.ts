/**
 * Segment Timing Utilities
 *
 * Helper functions for calculating effective segment durations
 * that account for route animations.
 */

import type { Segment, RouteAnimation } from "@/lib/api-storymap";

/**
 * Calculate the maximum end time of all route animations in a segment
 *
 * @param routeAnimations - Array of route animations for a segment
 * @returns Maximum end time in milliseconds, or 0 if no routes
 */
export function calculateMaxRouteEndTime(routeAnimations: RouteAnimation[]): number {
  if (!routeAnimations || routeAnimations.length === 0) {
    return 0;
  }

  let maxEndTime = 0;

  for (const route of routeAnimations) {
    // Calculate when this route animation actually ends
    const startTime = route.startTimeMs ?? 0;

    // FIXED: Account for ALL timing components in route execution
    // For time-based mode (when startTimeMs is set):
    //   - Use endTimeMs if specified
    //   - Otherwise use startTime + durationMs
    // For sequential mode (when startTimeMs is null/undefined):
    //   - Must account for cameraStateBefore animation (1000ms if exists)
    //   - Must account for startDelayMs
    //   - Must account for route animation duration
    //   - Must account for cameraStateAfter animation (1000ms if exists)
    //   - Must account for location popup display time

    let routeEndTime: number;

    if (route.endTimeMs !== undefined && route.endTimeMs !== null) {
      // Use explicit endTimeMs if provided
      routeEndTime = route.endTimeMs;
    } else if (route.startTimeMs !== undefined && route.startTimeMs !== null) {
      // Time-based mode: just add duration to start time
      routeEndTime = startTime + route.durationMs;
    } else {
      // Sequential mode: routes run sequentially FROM START OF SEGMENT
      // IMPORTANT: In sequential mode, ALL routes run one after another starting from time 0
      // So we need to accumulate the time for THIS route and ALL previous routes

      // For now, just return the duration of this single route
      // The accumulation will be handled by summing all routes sequentially
      let totalTime = 0;

      // Camera before animation (if exists)
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

/**
 * Calculate the effective duration of a segment including route animations
 *
 * This ensures that the segment doesn't end before all route animations complete.
 *
 * @param segment - The segment
 * @param routeAnimations - Array of route animations for this segment (optional, uses segment.routeAnimations if not provided)
 * @returns Effective duration in milliseconds
 */
export function calculateEffectiveSegmentDuration(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): number {
  const baseDuration = segment.durationMs || 5000;

  // Use provided routeAnimations or fallback to segment.routeAnimations
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  // Effective duration is the maximum of:
  // 1. The segment's base duration
  // 2. The time needed for all route animations to complete
  return Math.max(baseDuration, maxRouteEndTime);
}

/**
 * Calculate total timeline duration including all segments and their route animations
 *
 * @param segments - Array of segments (should have routeAnimations property populated)
 * @returns Total duration in milliseconds
 */
export function calculateTotalTimelineDuration(segments: Segment[]): number {
  let totalDuration = 0;

  for (const segment of segments) {
    const effectiveDuration = calculateEffectiveSegmentDuration(segment);
    totalDuration += effectiveDuration;
  }

  return totalDuration;
}

/**
 * Check if a segment has route animations that extend beyond its base duration
 *
 * This can be used to show warnings in the UI.
 *
 * @param segment - The segment
 * @param routeAnimations - Array of route animations (optional, uses segment.routeAnimations if not provided)
 * @returns True if routes extend beyond segment duration
 */
export function hasExtendedRouteAnimations(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): boolean {
  const baseDuration = segment.durationMs || 5000;
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  return maxRouteEndTime > baseDuration;
}

/**
 * Calculate the extension time (how much route animations extend beyond segment duration)
 *
 * @param segment - The segment
 * @param routeAnimations - Array of route animations (optional, uses segment.routeAnimations if not provided)
 * @returns Extension time in milliseconds (0 if routes don't extend)
 */
export function calculateRouteExtensionTime(
  segment: Segment,
  routeAnimations?: RouteAnimation[]
): number {
  const baseDuration = segment.durationMs || 5000;
  const routes = routeAnimations || segment.routeAnimations || [];
  const maxRouteEndTime = calculateMaxRouteEndTime(routes);

  return Math.max(0, maxRouteEndTime - baseDuration);
}
