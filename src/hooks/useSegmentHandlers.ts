import { useState } from "react";
import {
  Segment,
  SegmentZone,
  CreateSegmentRequest,
  CreateSegmentZoneRequest,
  AttachLayerRequest,
  CreateLocationRequest,
  createSegmentZone,
  deleteSegmentZone,
  attachLayerToSegment,
  detachLayerFromSegment,
  createLocation,
  deleteLocation,
  deleteRouteAnimation,
} from "@/lib/api-storymap";

type UseSegmentHandlersProps = {
  mapId: string;
  segments: Segment[];
  activeSegmentId: string | null;
  updateSegmentsState: (updater: (segs: Segment[]) => Segment[]) => void;
  addSegment: (data: CreateSegmentRequest) => Promise<void>;
  editSegment: (id: string, data: CreateSegmentRequest) => Promise<void>;
  removeSegment: (id: string) => Promise<void>;
  onViewSegment: (segment: Segment) => Promise<void>;
};

export function useSegmentHandlers({
  mapId,
  segments,
  activeSegmentId,
  updateSegmentsState,
  addSegment,
  editSegment,
  removeSegment,
  onViewSegment,
}: UseSegmentHandlersProps) {
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | undefined>();
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showLayerDialog, setShowLayerDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<SegmentZone | null>(null);

  // ==================== SEGMENT CRUD ====================
  const handleCreateSegment = async (data: CreateSegmentRequest) => {
    try {
      await addSegment(data);
      setShowSegmentDialog(false);
    } catch (error) {
      console.error("Failed to create segment:", error);
    }
  };

  const handleUpdateSegment = async (data: CreateSegmentRequest) => {
    if (!editingSegment) return;
    try {
      await editSegment(editingSegment.segmentId, data);
      setShowSegmentDialog(false);
      setEditingSegment(undefined);
    } catch (error) {
      console.error("Failed to update segment:", error);
    }
  };

  const handleDeleteSegment = async () => {
    if (!confirmDelete) return;

    // Count all child resources
    const locationsCount = confirmDelete.locations?.length || 0;
    const zonesCount = confirmDelete.zones?.length || 0;
    const routesCount = confirmDelete.routeAnimations?.length || 0;
    const totalCount = locationsCount + zonesCount + routesCount;

    if (totalCount > 0) {
      const items = [];
      if (locationsCount > 0) items.push(`${locationsCount} location(s)`);
      if (zonesCount > 0) items.push(`${zonesCount} zone(s)`);
      if (routesCount > 0) items.push(`${routesCount} route(s)`);

      const confirmMessage = `⚠️ Cảnh báo: Segment này có ${items.join(', ')}.\n\nKhi xóa segment, tất cả các items bên trong cũng sẽ bị xóa theo.\n\nBạn có chắc chắn muốn tiếp tục?`;

      if (!window.confirm(confirmMessage)) {
        setConfirmDelete(null);
        return;
      }

      // Delete all child resources first
      try {
        // Delete all locations
        for (const location of confirmDelete.locations || []) {
          await deleteLocation(mapId, confirmDelete.segmentId, location.locationId);
        }

        // Delete all zones
        for (const zone of confirmDelete.zones || []) {
          await deleteSegmentZone(mapId, confirmDelete.segmentId, zone.segmentZoneId);
        }

        // Delete all routes
        for (const route of confirmDelete.routeAnimations || []) {
          await deleteRouteAnimation(mapId, confirmDelete.segmentId, route.routeAnimationId);
        }

        // Update segments state to remove all child resources
        updateSegmentsState(segs => segs.map(seg => {
          if (seg.segmentId === confirmDelete.segmentId) {
            return { ...seg, locations: [], zones: [], routeAnimations: [] };
          }
          return seg;
        }));

        // Refresh view if this segment is active
        if (activeSegmentId === confirmDelete.segmentId) {
          await onViewSegment({ ...confirmDelete, locations: [], zones: [], routeAnimations: [] });
        }
      } catch (error) {
        console.error("Failed to delete child resources:", error);
        alert("Không thể xóa các resources bên trong segment. Vui lòng thử lại.");
        setConfirmDelete(null);
        return;
      }
    }

    try {
      await removeSegment(confirmDelete.segmentId);
      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete segment:", error);
      alert("Không thể xóa segment. Vui lòng thử lại.");
    }
  };

  // ==================== ZONE HANDLERS ====================
  const handleAddZone = async (data: CreateSegmentZoneRequest) => {
    try {
      const newZone = await createSegmentZone(mapId, data.segmentId!, data);
      setShowZoneDialog(false);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === data.segmentId) {
          return { ...seg, zones: [...seg.zones, newZone] };
        }
        return seg;
      }));
      
      if (activeSegmentId === data.segmentId) {
        const updatedSegment = segments.find(s => s.segmentId === data.segmentId);
        if (updatedSegment) {
          await onViewSegment({ ...updatedSegment, zones: [...updatedSegment.zones, newZone] });
        }
      }
    } catch (error) {
      console.error("Failed to add zone:", error);
    }
  };

  const handleDeleteZone = async () => {
    if (!confirmDeleteZone) return;
    try {
      await deleteSegmentZone(mapId, confirmDeleteZone.segmentId, confirmDeleteZone.segmentZoneId);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === confirmDeleteZone.segmentId) {
          return {
            ...seg,
            zones: seg.zones.filter(z => z.segmentZoneId !== confirmDeleteZone.segmentZoneId)
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === confirmDeleteZone.segmentId) {
        const updatedSegment = segments.find(s => s.segmentId === confirmDeleteZone.segmentId);
        if (updatedSegment) {
          await onViewSegment({
            ...updatedSegment,
            zones: updatedSegment.zones.filter(z => z.segmentZoneId !== confirmDeleteZone.segmentZoneId)
          });
        }
      }
      
      setConfirmDeleteZone(null);
    } catch (error) {
      console.error("Failed to delete zone:", error);
    }
  };

  // ==================== LAYER HANDLERS ====================
  const handleAddLayer = async (data: AttachLayerRequest) => {
    try {
      const newLayer = await attachLayerToSegment(mapId, targetSegmentId, data);
      setShowLayerDialog(false);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === targetSegmentId) {
          return { ...seg, layers: [...seg.layers, newLayer] };
        }
        return seg;
      }));
      
      if (activeSegmentId === targetSegmentId) {
        const updatedSegment = segments.find(s => s.segmentId === targetSegmentId);
        if (updatedSegment) {
          await onViewSegment({ ...updatedSegment, layers: [...updatedSegment.layers, newLayer] });
        }
      }
    } catch (error) {
      console.error("Failed to add layer:", error);
      throw error;
    }
  };

  const handleDeleteLayer = async (segmentLayerId: string) => {
    const segment = segments.find(s => s.layers.some(l => l.segmentLayerId === segmentLayerId));
    if (!segment) return;
    
    const layer = segment.layers.find(l => l.segmentLayerId === segmentLayerId);
    if (!layer) return;

    try {
      await detachLayerFromSegment(mapId, segment.segmentId, layer.layerId);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === segment.segmentId) {
          return {
            ...seg,
            layers: seg.layers.filter(l => l.segmentLayerId !== segmentLayerId)
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === segment.segmentId) {
        await onViewSegment({
          ...segment,
          layers: segment.layers.filter(l => l.segmentLayerId !== segmentLayerId)
        });
      }
    } catch (error) {
      console.error("Failed to delete layer:", error);
    }
  };

  // ==================== LOCATION HANDLERS ====================
  const handleAddLocation = async (data: CreateLocationRequest) => {
    try {
      const newLocation = await createLocation(mapId, targetSegmentId, data);
      setShowLocationDialog(false);
      setWaitingForLocation(false);
      
      // Update segments state với location mới
      let updatedSegment: Segment | undefined;
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === targetSegmentId) {
          updatedSegment = { ...seg, locations: [...(seg.locations || []), newLocation] };
          return updatedSegment;
        }
        return seg;
      }));
      
      // Luôn luôn render location mới trên map nếu segment đang được view
      // hoặc view lại segment để render location mới
      if (updatedSegment) {
        // Nếu segment đang active, re-render với location mới
        if (activeSegmentId === targetSegmentId) {
          await onViewSegment(updatedSegment);
        } else {
          // Nếu segment chưa active, view segment để render location mới
          // Hoặc chỉ thêm location vào map mà không cần view toàn bộ segment
          await onViewSegment(updatedSegment);
        }
      }
    } catch (error) {
      console.error("Failed to add location:", error);
      throw error;
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    const segment = segments.find(s => s.locations.some(l => l.locationId === locationId));
    if (!segment) return;

    try {
      await deleteLocation(mapId, segment.segmentId, locationId);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === segment.segmentId) {
          return {
            ...seg,
            locations: seg.locations.filter(l => l.locationId !== locationId)
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === segment.segmentId) {
        await onViewSegment({
          ...segment,
          locations: segment.locations.filter(l => l.locationId !== locationId)
        });
      }
    } catch (error) {
      console.error("Failed to delete location:", error);
    }
  };

  // ==================== DIALOG OPENERS ====================
  const openCreateSegmentDialog = () => {
    setEditingSegment(undefined);
    setShowSegmentDialog(true);
  };

  const openEditSegmentDialog = (segment: Segment) => {
    setEditingSegment(segment);
    setShowSegmentDialog(true);
  };

  const openDeleteSegmentDialog = (segment: Segment) => {
    setConfirmDelete(segment);
  };

  const openAddZoneDialog = (segmentId: string) => {
    setTargetSegmentId(segmentId);
    setShowZoneDialog(true);
  };

  const openDeleteZoneDialog = (zone: SegmentZone) => {
    setConfirmDeleteZone(zone);
  };

  const openAddLayerDialog = (segmentId: string) => {
    setTargetSegmentId(segmentId);
    setShowLayerDialog(true);
  };

  const openAddLocationDialog = (segmentId: string) => {
    setTargetSegmentId(segmentId);
    setWaitingForLocation(true);
    setShowLocationDialog(true);
  };

  return {
    // Dialog state
    showSegmentDialog,
    setShowSegmentDialog,
    editingSegment,
    showZoneDialog,
    setShowZoneDialog,
    showLayerDialog,
    setShowLayerDialog,
    showLocationDialog,
    setShowLocationDialog,
    waitingForLocation,
    setWaitingForLocation,
    targetSegmentId,
    confirmDelete,
    setConfirmDelete,
    confirmDeleteZone,
    setConfirmDeleteZone,
    
    // Handlers
    handleCreateSegment,
    handleUpdateSegment,
    handleDeleteSegment,
    handleAddZone,
    handleDeleteZone,
    handleAddLayer,
    handleDeleteLayer,
    handleAddLocation,
    handleDeleteLocation,
    
    // Dialog openers
    openCreateSegmentDialog,
    openEditSegmentDialog,
    openDeleteSegmentDialog,
    openAddZoneDialog,
    openDeleteZoneDialog,
    openAddLayerDialog,
    openAddLocationDialog,
  };
}
