import { useState, useCallback } from "react";
import {
  getSegments,
  getSegmentZones,
  getSegmentLayers,
  getSegmentLocations,
  createSegment,
  updateSegment,
  deleteSegment,
  createSegmentZone,
  deleteSegmentZone,
  reorderSegments,
  CreateSegmentRequest,
  CreateSegmentZoneRequest,
} from "@/lib/api-storymap-v2";
import { TimelineSegment } from "@/types/storymap";

/**
 * Custom hook to manage story map segments
 */
export function useSegments(mapId: string) {
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load all segments with their related data
   */
  const loadSegments = useCallback(async () => {
    console.log("🔄 Loading segments for mapId:", mapId);
    setLoading(true);
    setError(null);
    
    try {
      const segs = await getSegments(mapId);
      console.log("📦 Raw segments received:", segs);
      
      // Safety check: ensure segs is an array
      if (!Array.isArray(segs)) {
        console.warn("getSegments returned non-array:", segs);
        setSegments([]);
        return;
      }
      
      // Enrich segments with zones, layers, and locations
      const enriched = await Promise.all(
        segs.map(async (seg) => {
          const [zones, layers, locations] = await Promise.all([
            getSegmentZones(mapId, seg.segmentId),
            getSegmentLayers(mapId, seg.segmentId),
            getSegmentLocations(mapId, seg.segmentId),
          ]);
          return {
            ...seg,
            zones,
            layers,
            locations,
            expanded: false,
          };
        })
      );
      
      console.log("✅ Enriched segments:", enriched);
      setSegments(enriched);
    } catch (err) {
      console.error("❌ Failed to load segments:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  /**
   * Create a new segment
   */
  const addSegment = async (data: CreateSegmentRequest) => {
    try {
      await createSegment(mapId, data);
      await loadSegments();
    } catch (err) {
      console.error("Failed to create segment:", err);
      throw err;
    }
  };

  /**
   * Update an existing segment
   */
  const editSegment = async (segmentId: string, data: CreateSegmentRequest) => {
    try {
      await updateSegment(mapId, segmentId, data);
      await loadSegments();
    } catch (err) {
      console.error("Failed to update segment:", err);
      throw err;
    }
  };

  /**
   * Delete a segment
   */
  const removeSegment = async (segmentId: string) => {
    try {
      await deleteSegment(mapId, segmentId);
      await loadSegments();
    } catch (err) {
      console.error("Failed to delete segment:", err);
      throw err;
    }
  };

  /**
   * Add a zone to a segment
   */
  const addZoneToSegment = async (data: CreateSegmentZoneRequest) => {
    try {
      await createSegmentZone(mapId, data.segmentId!, data);
      await loadSegments();
    } catch (err) {
      console.error("Failed to add zone:", err);
      throw err;
    }
  };

  /**
   * Remove a zone from a segment
   */
  const removeZoneFromSegment = async (segmentId: string, zoneId: string) => {
    try {
      await deleteSegmentZone(mapId, segmentId, zoneId);
      await loadSegments();
    } catch (err) {
      console.error("Failed to delete zone:", err);
      throw err;
    }
  };

  /**
   * Reorder segments
   */
  const reorder = async (newOrder: TimelineSegment[]) => {
    const oldSegments = segments;
    setSegments(newOrder); // Optimistic update
    
    try {
      await reorderSegments(mapId, newOrder.map(s => s.segmentId));
    } catch (err) {
      console.error("Failed to reorder:", err);
      setSegments(oldSegments); // Rollback on error
      throw err;
    }
  };

  /**
   * Toggle expanded state of a segment
   */
  const toggleExpanded = (segmentId: string) => {
    setSegments(segments.map(s => 
      s.segmentId === segmentId ? { ...s, expanded: !s.expanded } : s
    ));
  };

  return {
    segments,
    loading,
    error,
    loadSegments,
    addSegment,
    editSegment,
    removeSegment,
    addZoneToSegment,
    removeZoneFromSegment,
    reorder,
    toggleExpanded,
  };
}
