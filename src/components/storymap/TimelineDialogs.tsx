import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentDialog from "@/components/storymap/dialogs/SegmentDialog";
import SelectZoneDialog from "@/components/storymap/dialogs/SelectZoneDialog";
import SelectLayerDialog from "@/components/storymap/dialogs/SelectLayerDialog";
import CreateLocationDialog from "@/components/storymap/dialogs/CreateLocationDialog";
import { Segment, SegmentZone, CreateSegmentRequest, CreateSegmentZoneRequest, AttachLayerRequest, CreateLocationRequest } from "@/lib/api-storymap";

type TimelineDialogsProps = {
  currentMap: any;
  
  // Segment dialog
  showSegmentDialog: boolean;
  editingSegment?: Segment;
  onCloseSegmentDialog: () => void;
  onSaveSegment: (data: CreateSegmentRequest) => void;
  
  // Zone dialog
  showZoneDialog: boolean;
  targetSegmentId: string;
  onCloseZoneDialog: () => void;
  onSaveZone: (data: CreateSegmentZoneRequest) => void;
  
  // Layer dialog
  showLayerDialog: boolean;
  onCloseLayerDialog: () => void;
  onSaveLayer: (data: AttachLayerRequest) => Promise<void>;
  
  // Location dialog
  showLocationDialog: boolean;
  onCloseLocationDialog: () => void;
  onSaveLocation: (data: CreateLocationRequest) => Promise<void>;
  onWaitingStateChange?: (waiting: boolean) => void;
  
  // Delete confirmations
  confirmDelete: Segment | null;
  onCloseConfirmDelete: () => void;
  onConfirmDelete: () => void;
  
  confirmDeleteZone: SegmentZone | null;
  onCloseConfirmDeleteZone: () => void;
  onConfirmDeleteZone: () => void;
};

export default function TimelineDialogs({
  currentMap,
  showSegmentDialog,
  editingSegment,
  onCloseSegmentDialog,
  onSaveSegment,
  showZoneDialog,
  targetSegmentId,
  onCloseZoneDialog,
  onSaveZone,
  showLayerDialog,
  onCloseLayerDialog,
  onSaveLayer,
  showLocationDialog,
  onCloseLocationDialog,
  onSaveLocation,
  onWaitingStateChange,
  confirmDelete,
  onCloseConfirmDelete,
  onConfirmDelete,
  confirmDeleteZone,
  onCloseConfirmDeleteZone,
  onConfirmDeleteZone,
}: TimelineDialogsProps) {
  return (
    <>
      {/* Segment Dialog */}
      {showSegmentDialog && (
        <SegmentDialog
          editing={editingSegment}
          currentMap={currentMap}
          onClose={onCloseSegmentDialog}
          onSave={onSaveSegment}
        />
      )}

      {/* Zone Dialog */}
      {showZoneDialog && (
        <SelectZoneDialog
          segmentId={targetSegmentId}
          onClose={onCloseZoneDialog}
          onSave={onSaveZone}
        />
      )}

      {/* Layer Dialog */}
      {showLayerDialog && (
        <SelectLayerDialog
          segmentId={targetSegmentId}
          onClose={onCloseLayerDialog}
          onSave={onSaveLayer}
        />
      )}

      {/* Location Dialog */}
      {showLocationDialog && (
        <CreateLocationDialog
          segmentId={targetSegmentId}
          currentMap={currentMap}
          onClose={onCloseLocationDialog}
          onSave={onSaveLocation}
          onWaitingStateChange={onWaitingStateChange}
        />
      )}

      {/* Delete Segment Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={onCloseConfirmDelete}
        onConfirm={onConfirmDelete}
        title="Delete Segment"
        message={confirmDelete ? `Delete "${confirmDelete.name}"?` : ""}
        variant="danger"
      />

      {/* Delete Zone Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteZone}
        onClose={onCloseConfirmDeleteZone}
        onConfirm={onConfirmDeleteZone}
        title="Remove Zone"
        message={
          confirmDeleteZone
            ? `Remove "${confirmDeleteZone.zone?.name ?? "this zone"}" from segment?`
            : ""
        }
        variant="warning"
      />
    </>
  );
}
