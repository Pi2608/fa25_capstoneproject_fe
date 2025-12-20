"use client";

import { useEffect } from "react";
import { injectZoneHighlightStyles } from "@/utils/zoneHighlightEffects";

/**
 * Component to inject zone highlight CSS styles globally
 * Mounts once in root layout to ensure styles are available
 */
export function ZoneHighlightStyles() {
  useEffect(() => {
    injectZoneHighlightStyles();
  }, []);

  return null; // This component doesn't render anything
}
