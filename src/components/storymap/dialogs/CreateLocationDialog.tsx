"use client";

import { useState, useEffect } from "react";
import LocationPoiDialog from "@/components/shared/LocationPoiDialog";
import type { CreateLocationRequest } from "@/lib/api-storymap";
import type { LocationPoiDialogForm } from "@/types";

interface CreateLocationDialogProps {
  segmentId: string;
  currentMap?: any; // Leaflet map instance
  onClose: () => void;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  onWaitingStateChange?: (waiting: boolean) => void;
}

export default function CreateLocationDialog({ 
  segmentId, 
  currentMap, 
  onClose, 
  onSave,
  onWaitingStateChange,
}: CreateLocationDialogProps) {
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [waitingForLocation, setWaitingForLocation] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [tempMarker, setTempMarker] = useState<any>(null);
  const [form, setForm] = useState<LocationPoiDialogForm>({
    title: "",
    subtitle: "",
    description: "",
    locationType: "PointOfInterest",
    markerGeometry: "",
    iconType: "📍",
    iconColor: "#FF0000",
    iconSize: 32,
    displayOrder: 0,
    highlightOnEnter: false,
    showTooltip: true,
    tooltipContent: "",
    openPopupOnClick: true,
    popupContent: "",
    isVisible: true,
    zIndex: 100,
  });

  // Notify parent khi state waiting thay đổi
  useEffect(() => {
    onWaitingStateChange?.(waitingForLocation);
  }, [waitingForLocation, onWaitingStateChange]);

  // Thay đổi cursor khi waitingForLocation thay đổi
  useEffect(() => {
    if (!currentMap) return;

    const mapContainer = currentMap.getContainer();
    
    if (waitingForLocation) {
      // Thay đổi cursor thành crosshair (dấu cộng) khi đang chờ chọn vị trí
      mapContainer.style.cursor = 'crosshair';
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');
    } else {
      // Reset cursor về mặc định
      mapContainer.style.cursor = '';
      mapContainer.style.removeProperty('cursor');
    }

    return () => {
      // Reset cursor khi cleanup
      if (mapContainer) {
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
    };
  }, [currentMap, waitingForLocation]);

  // Khi component mount, enable map click để chọn vị trí
  useEffect(() => {
    if (!currentMap || !waitingForLocation) return;

    const handleMapClick = async (e: any) => {
      const { lat, lng } = e.latlng;
      setSelectedPoint([lat, lng]);

      // Import Leaflet dynamically
      const L = (await import("leaflet")).default;

      // Remove previous temp marker
      if (tempMarker) {
        currentMap.removeLayer(tempMarker);
      }

      // Add temporary marker at clicked location
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "temp-location-marker",
          html: `<div style="
            font-size: 32px;
            text-align: center;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          ">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      });
      marker.addTo(currentMap);
      setTempMarker(marker);

      // Update form với location đã chọn
      const geoJson = {
        type: "Point",
        coordinates: [lng, lat], // [lng, lat]
      };
      
      setForm(prev => ({
        ...prev,
        markerGeometry: JSON.stringify(geoJson),
      }));

      // Đóng chế độ chọn và mở dialog
      setWaitingForLocation(false);
      setDialogOpen(true);
      onWaitingStateChange?.(false);
    };

    currentMap.on("click", handleMapClick);

    return () => {
      currentMap.off("click", handleMapClick);
      if (tempMarker) {
        currentMap.removeLayer(tempMarker);
      }
    };
  }, [currentMap, waitingForLocation, tempMarker, onWaitingStateChange]);

  const handleSubmit = async () => {
    if (!form.markerGeometry) {
      alert("Vui lòng chọn vị trí trên bản đồ");
      return;
    }

    setSaving(true);
    try {
      const locationData: CreateLocationRequest = {
        segmentId,
        title: form.title,
        subtitle: form.subtitle || undefined,
        description: form.description || undefined,
        locationType: form.locationType,
        markerGeometry: form.markerGeometry,
        iconType: form.iconType,
        iconColor: form.iconColor,
        iconSize: form.iconSize,
        displayOrder: form.displayOrder,
        highlightOnEnter: form.highlightOnEnter || false,
        showTooltip: form.showTooltip ?? true,
        tooltipContent: form.tooltipContent || form.title,
        openPopupOnClick: form.openPopupOnClick ?? true,
        popupContent: form.popupContent || form.description,
        isVisible: form.isVisible ?? true,
        zIndex: form.zIndex ?? 100,
      };

      await onSave(locationData);
      
      // Cleanup temp marker
      if (tempMarker && currentMap) {
        currentMap.removeLayer(tempMarker);
        setTempMarker(null);
      }
      
      // Reset cursor
      if (currentMap) {
        const mapContainer = currentMap.getContainer();
        mapContainer.style.cursor = '';
        mapContainer.style.removeProperty('cursor');
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to create location:", error);
      alert("Failed to create location");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Cleanup temp marker
    if (tempMarker && currentMap) {
      currentMap.removeLayer(tempMarker);
      setTempMarker(null);
    }
    
    // Reset cursor
    if (currentMap) {
      const mapContainer = currentMap.getContainer();
      mapContainer.style.cursor = '';
      mapContainer.style.removeProperty('cursor');
    }
    
    setWaitingForLocation(false);
    setDialogOpen(false);
    onWaitingStateChange?.(false);
    onClose();
  };

  // Khi đang chờ chọn vị trí, không render gì
  // Thông báo sẽ được hiển thị trong storymap panel
  if (waitingForLocation) {
    return null;
  }

  // Hiển thị dialog khi đã chọn vị trí
  return (
    <LocationPoiDialog
      open={dialogOpen}
      busy={saving}
      mode="location"
      form={form}
      titleText="Tạo Location"
      submitLabel={saving ? "Creating..." : "Create Location"}
      currentMap={currentMap}
      onClose={handleClose}
      onSubmit={handleSubmit}
      onChange={setForm}
    />
  );
}
