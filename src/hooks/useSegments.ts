import { useState, useCallback, useRef } from "react";
import {
    getSegments,
    createSegment,
    updateSegment,
    deleteSegment,
    reorderSegments,
    CreateSegmentRequest,
    CameraState,
    stringifyCameraState,
} from "@/lib/api-storymap";
import { TimelineSegment } from "@/types/storymap";

export function useSegments(mapId: string) {
    const [segments, setSegments] = useState<TimelineSegment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const loadingRef = useRef(false);


    const loadSegments = useCallback(async () => {  
        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const segs = await getSegments(mapId);

            if (!Array.isArray(segs)) {
                console.warn("getSegments returned non-array:", segs);
                setSegments([]);
                return;
            }

            const enriched = segs.map((seg) => ({
                ...seg,
                expanded: false,
            }));

            setSegments(enriched);
        } catch (err) {
            console.error("❌ Failed to load segments:", err);
            setError(err as Error);
        } finally {
            setLoading(false);
            loadingRef.current = false;
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

    /**
     * Update the camera state of a segment
     */
    const updateCameraState = async (segmentId: string, cameraState: CameraState) => {
        try {
            const segment = segments.find(s => s.segmentId === segmentId);
            if (!segment) {
                throw new Error("Segment not found");
            }

            await updateSegment(mapId, segmentId, {
                name: segment.name,
                description: segment.description,
                cameraState: stringifyCameraState(cameraState),
                playbackMode: segment.autoAdvance ? "Auto" : "Manual",
            });

            await loadSegments();
        } catch (err) {
            console.error("Failed to update camera state:", err);
            throw err;
        }
    };

    /**
     * Update segments state directly (for optimistic updates)
     */
    const updateSegmentsState = (updater: (segments: TimelineSegment[]) => TimelineSegment[]) => {
        setSegments(updater);
    };

    return {
        segments,
        loading,
        error,
        loadSegments,
        addSegment,
        editSegment,
        removeSegment,
        reorder,
        toggleExpanded,
        updateCameraState,
        updateSegmentsState,
    };
}
