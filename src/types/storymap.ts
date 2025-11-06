import { Segment, SegmentZone, SegmentLayer, Location } from "@/lib/api-storymap";

/**
 * Extended segment type with UI state for timeline display
 * Note: Segment already includes zones, layers, locations from backend
 */
export type TimelineSegment = Segment & {
  expanded: boolean; // UI state for expand/collapse
};

/**
 * Props for segment-related dialogs
 */
export interface SegmentDialogProps {
  editing?: Segment;
  currentMap?: any; // Mapbox map instance
  onClose: () => void;
  onSave: (data: any) => void;
}

/**
 * Props for zone selection dialog
 */
export interface SelectZoneDialogProps {
  segmentId: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

/**
 * Props for sortable segment item
 */
export interface SortableSegmentItemProps {
  segment: TimelineSegment;
  isActive?: boolean;
  onSelect: () => void;
  onToggle: (id: string) => void;
  onEdit: (segment: Segment) => void;
  onDelete: (segment: Segment) => void;
  onAddZone: (segmentId: string) => void;
  onDeleteZone: (zone: SegmentZone) => void;
  onCaptureCamera?: (segment: Segment) => void;
}
