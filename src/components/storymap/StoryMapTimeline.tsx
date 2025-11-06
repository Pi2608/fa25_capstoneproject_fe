"use client";

import { useEffect, useState, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from "@dnd-kit/sortable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentDialog from "@/components/storymap/dialogs/SegmentDialog";
import SelectZoneDialog from "@/components/storymap/dialogs/SelectZoneDialog";
import SelectLayerDialog from "@/components/storymap/dialogs/SelectLayerDialog";
import CreateLocationDialog from "@/components/storymap/dialogs/CreateLocationDialog";
import SortableSegmentItem from "@/components/storymap/items/SortableSegmentItem";
import { useSegments } from "@/hooks/useSegments";
import {  Segment,  SegmentZone, CreateSegmentRequest, CreateSegmentZoneRequest, getCurrentCameraState, AttachLayerRequest, attachLayerToSegment, detachLayerFromSegment, CreateLocationRequest, createLocation, deleteLocation, createSegmentZone, deleteSegmentZone} from "@/lib/api-storymap";
import { TimelineSegment } from "@/types/storymap";

type Props = {
  mapId: string;
  currentMap?: any;
  onSegmentSelect?: (segment: Segment) => void;
};

// ==================== MAIN COMPONENT ====================
export default function StoryMapTimeline({ mapId, currentMap, onSegmentSelect }: Props) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Track current segment layers for cleanup
  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  
  // Dialogs
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | undefined>();
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showLayerDialog, setShowLayerDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<SegmentZone | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const {
    segments,
    loading,
    loadSegments,
    addSegment,
    editSegment,
    removeSegment,
    reorder,
    toggleExpanded,
    updateCameraState,
    updateSegmentsState,
  } = useSegments(mapId);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await loadSegments();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);
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
    try {
      await removeSegment(confirmDelete.segmentId);
      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete segment:", error);
    }
  };

  const handleAddZone = async (data: CreateSegmentZoneRequest) => {
    try {
      const newZone = await createSegmentZone(mapId, data.segmentId!, data);
      setShowZoneDialog(false);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === data.segmentId) {
          return {
            ...seg,
            zones: [...seg.zones, newZone]
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === data.segmentId) {
        const updatedSegment = segments.find(s => s.segmentId === data.segmentId);
        if (updatedSegment) {
          const updated = {
            ...updatedSegment,
            zones: [...updatedSegment.zones, newZone]
          };
          await handleViewSegment(updated);
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
          const updated = {
            ...updatedSegment,
            zones: updatedSegment.zones.filter(z => z.segmentZoneId !== confirmDeleteZone.segmentZoneId)
          };
          await handleViewSegment(updated);
        }
      }
      
      setConfirmDeleteZone(null);
    } catch (error) {
      console.error("Failed to delete zone:", error);
    }
  };

  const handleAddLayer = async (data: AttachLayerRequest) => {
    try {
      const newLayer = await attachLayerToSegment(mapId, targetSegmentId, data);
      setShowLayerDialog(false);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === targetSegmentId) {
          return {
            ...seg,
            layers: [...seg.layers, newLayer]
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === targetSegmentId) {
        const updatedSegment = segments.find(s => s.segmentId === targetSegmentId);
        if (updatedSegment) {
          const updated = {
            ...updatedSegment,
            layers: [...updatedSegment.layers, newLayer]
          };
          await handleViewSegment(updated);
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
        const updatedSegment = {
          ...segment,
          layers: segment.layers.filter(l => l.segmentLayerId !== segmentLayerId)
        };
        await handleViewSegment(updatedSegment);
      }
    } catch (error) {
      console.error("Failed to delete layer:", error);
    }
  };

  const handleAddLocation = async (data: CreateLocationRequest) => {
    try {
      const newLocation = await createLocation(mapId, targetSegmentId, data);
      setShowLocationDialog(false);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === targetSegmentId) {
          return {
            ...seg,
            locations: [...seg.locations, newLocation]
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === targetSegmentId) {
        const updatedSegment = segments.find(s => s.segmentId === targetSegmentId);
        if (updatedSegment) {
          const updated = {
            ...updatedSegment,
            locations: [...updatedSegment.locations, newLocation]
          };
          await handleViewSegment(updated);
        }
      }
    } catch (error) {
      console.error("Failed to add location:", error);
      throw error;
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    const segment = segments.find(s => s.locations.some(l => (l.poiId || l.locationId) === locationId));
    if (!segment) return;

    try {
      await deleteLocation(mapId, segment.segmentId, locationId);
      
      updateSegmentsState(segs => segs.map(seg => {
        if (seg.segmentId === segment.segmentId) {
          return {
            ...seg,
            locations: seg.locations.filter(l => (l.poiId || l.locationId) !== locationId)
          };
        }
        return seg;
      }));
      
      if (activeSegmentId === segment.segmentId) {
        const updatedSegment = {
          ...segment,
          locations: segment.locations.filter(l => (l.poiId || l.locationId) !== locationId)
        };
        await handleViewSegment(updatedSegment);
      }
    } catch (error) {
      console.error("Failed to delete location:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex((s) => s.segmentId === active.id);
      const newIndex = segments.findIndex((s) => s.segmentId === over.id);
      const newOrder = arrayMove(segments, oldIndex, newIndex);
      
      try {
        await reorder(newOrder);
      } catch (error) {
        console.error("Failed to reorder:", error);
      }
    }
  };

  const handleCaptureCamera = async (segment: Segment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available for capture");
      return;
    }
    
    if (typeof currentMap.getCenter !== 'function' || typeof currentMap.getZoom !== 'function') {
      console.error("❌ Invalid map instance - missing required methods");
      return;
    }
    
    try {
      const capturedState = getCurrentCameraState(currentMap);
      
      await updateCameraState(segment.segmentId, capturedState);
    } catch (error) {
      console.error("❌ Failed to capture camera:", error);
      console.error("Map instance:", currentMap);
    }
  };

  const handleViewSegment = useCallback(async (segment: TimelineSegment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    try {
      const L = (await import("leaflet")).default;

      currentSegmentLayers.forEach(layer => {
        try {
          currentMap.removeLayer(layer);
        } catch (e) {
          console.warn("Failed to remove layer:", e);
        }
      });
      
      const newLayers: any[] = [];
      
      const allBounds: any[] = [];
      
      setCurrentSegmentLayers(newLayers);

      if (segment.zones && segment.zones.length > 0) {

        for (const segmentZone of segment.zones) {
          const zone = segmentZone.zone;
          if (!zone) continue;

          if (!zone.geometry || zone.geometry.trim() === '') {
            console.warn(`⚠️ Zone ${zone.zoneId} has no geometry`);
            continue;
          }

          try {
            let geoJsonData;
            try {
              geoJsonData = JSON.parse(zone.geometry);
            } catch (parseError) {
              continue;
            }

            const geoJsonLayer = L.geoJSON(geoJsonData, {
              style: () => {
                const style: any = {};
                
                if (segmentZone.fillZone) {
                  style.fillColor = segmentZone.fillColor || '#FFD700';
                  style.fillOpacity = segmentZone.fillOpacity || 0.3;
                } else {
                  style.fillOpacity = 0;
                }

                if (segmentZone.highlightBoundary) {
                  style.color = segmentZone.boundaryColor || '#FFD700';
                  style.weight = segmentZone.boundaryWidth || 2;
                } else {
                  style.weight = 0;
                }

                return style;
              },
            });

            geoJsonLayer.addTo(currentMap);
            newLayers.push(geoJsonLayer);

            const layerBounds = geoJsonLayer.getBounds();
            if (layerBounds.isValid()) {
              allBounds.push(layerBounds);
            }

            if (segmentZone.showLabel) {
              try {
                let labelPosition;
                
                if (zone.centroid) {
                  const centroid = JSON.parse(zone.centroid);
                  labelPosition = [centroid.coordinates[1], centroid.coordinates[0]];
                } else {
                  const center = layerBounds.getCenter();
                  labelPosition = [center.lat, center.lng];
                }

                // Create a marker with custom icon (text label)
                const labelMarker = L.marker(labelPosition as [number, number], {
                  icon: L.divIcon({
                    className: 'zone-label',
                    html: `<div style="
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 14px;
                      font-weight: 500;
                      white-space: nowrap;
                      border: 2px solid rgba(255, 255, 255, 0.8);
                    ">${segmentZone.labelOverride || zone.name}</div>`,
                    iconSize: undefined,
                  }),
                });
                labelMarker.addTo(currentMap);
                newLayers.push(labelMarker);
              } catch (labelError) {
                console.error(`Failed to add label for zone ${zone.zoneId}:`, labelError);
              }
            }

          } catch (error) {
            console.error(`❌ Failed to render zone ${zone.zoneId}:`, error);
          }
        }
      }
      if (segment.locations && segment.locations.length > 0) {
        
        for (const location of segment.locations) {
          try {
            if (location.isVisible === false) {
              continue;
            }

            if (!location.markerGeometry) {
              console.warn(`⚠️ Location ${location.poiId || location.locationId} has no geometry`);
              continue;
            }

            let geoJsonData;
            try {
              geoJsonData = JSON.parse(location.markerGeometry);
            } catch (parseError) {
              console.error(`❌ Failed to parse geometry for location ${location.poiId || location.locationId}:`, parseError);
              continue;
            }

            const coords = geoJsonData.coordinates;
            const latLng: [number, number] = [coords[1], coords[0]];

            const iconHtml = `<div style="
              font-size: ${location.iconSize || 32}px;
              text-align: center;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
              color: ${location.iconColor || '#FF0000'};
            ">${location.iconType || '📍'}</div>`;

            const marker = L.marker(latLng, {
              icon: L.divIcon({
                className: 'location-marker',
                html: iconHtml,
                iconSize: [location.iconSize || 32, location.iconSize || 32],
                iconAnchor: [(location.iconSize || 32) / 2, location.iconSize || 32],
              }),
              zIndexOffset: location.zIndex || 100,
            });

            if (location.showTooltip && location.tooltipContent) {
              marker.bindTooltip(location.tooltipContent, {
                permanent: false,
                direction: 'top',
                className: 'location-tooltip',
                opacity: 0.95,
              });
            }

            if (location.openPopupOnClick && location.popupContent) {
              const popupHtml = `
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${location.title}</h3>
                  ${location.subtitle ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">${location.subtitle}</p>` : ''}
                  <p style="margin: 0; font-size: 14px;">${location.popupContent}</p>
                </div>
              `;
              marker.bindPopup(popupHtml);
            }

            marker.addTo(currentMap);
            newLayers.push(marker);
            
            allBounds.push(L.latLngBounds([latLng, latLng]));

          } catch (error) {
            console.error(`❌ Failed to render location ${location.poiId || location.locationId}:`, error);
          }
        }

        console.log(`✅ Rendered ${segment.locations.length} locations`);
      }

      if (segment.cameraState) {
        let parsedCamera;
        if (typeof segment.cameraState === 'string') {
          try {
            parsedCamera = JSON.parse(segment.cameraState);
          } catch (e) {
            console.error("❌ Failed to parse camera state:", e);
            return;
          }
        } else {
          parsedCamera = segment.cameraState;
        }
        
        if (!parsedCamera || !parsedCamera.center || !Array.isArray(parsedCamera.center) || parsedCamera.center.length < 2) {
          console.error("❌ Invalid camera state structure:", parsedCamera);
          return;
        }
        
        const currentZoom = currentMap.getZoom();
        const targetZoom = parsedCamera.zoom || 10;
        const targetCenter = parsedCamera.center;
        
        if (Math.abs(currentZoom - targetZoom) > 1 || currentSegmentLayers.length > 0) {
          const midZoom = Math.min(currentZoom, targetZoom) - 2;
          
          currentMap.flyTo(
            [targetCenter[1], targetCenter[0]],
            midZoom,
            {
              duration: 0.8,
              animate: true,
            }
          );
          
          setTimeout(() => {
            currentMap.flyTo(
              [targetCenter[1], targetCenter[0]],
              targetZoom,
              {
                duration: 1.2,
                animate: true,
              }
            );
          }, 800);
        } else {
          currentMap.flyTo(
            [targetCenter[1], targetCenter[0]],
            targetZoom,
            {
              duration: 1.5,
              animate: true,
            }
          );
        }
        
      } else if (allBounds.length > 0) {
        try {
          const combinedBounds = allBounds[0];
          for (let i = 1; i < allBounds.length; i++) {
            combinedBounds.extend(allBounds[i]);
          }
          
          currentMap.fitBounds(combinedBounds, {
            padding: [80, 80],
            animate: true,
            duration: 1.5,
            maxZoom: 15,
          });
          console.log(`📦 Auto-fitted bounds to show ${allBounds.length} elements (no camera state)`);
        } catch (error) {
          console.error("❌ Failed to fit bounds:", error);
        }
      } else {
        console.warn("⚠️ Empty segment: no camera state and no zones/locations");
      }

      if (newLayers.length > 0) {
        setCurrentSegmentLayers(newLayers);
      }      
    } catch (error) {
      console.error("❌ Failed to view segment on map:", error);
    }
  }, [currentMap, currentSegmentLayers, setCurrentSegmentLayers]);

  // Auto-play effect - play through segments
  useEffect(() => {
    if (!isPlaying || segments.length === 0) return;

    let timeoutId: NodeJS.Timeout;

    const playNextSegment = async () => {
      if (currentPlayIndex >= segments.length) {
        setIsPlaying(false);
        setCurrentPlayIndex(0);
        return;
      }

      const segment = segments[currentPlayIndex];
      setActiveSegmentId(segment.segmentId);
      await handleViewSegment(segment);
      onSegmentSelect?.(segment);
      
      const duration = segment.durationMs || 5000;
      timeoutId = setTimeout(() => {
        setCurrentPlayIndex(prev => prev + 1);
      }, duration);
    };

    playNextSegment();
    
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentPlayIndex, segments.length]); // Remove handleViewSegment from deps!

  const handlePlayPreview = () => {
    if (segments.length === 0) return;
    
    setCurrentPlayIndex(0);
    setIsPlaying(true);
  };

  const handleStopPreview = () => {
    setIsPlaying(false);
    setCurrentPlayIndex(0);
  };

  const handleClearMap = () => {
    if (!currentMap) return;
    
    console.log(`🧹 Clearing ${currentSegmentLayers.length} layers from map...`);
    currentSegmentLayers.forEach(layer => {
      try {
        currentMap.removeLayer(layer);
      } catch (e) {
        console.warn("Failed to remove layer:", e);
      }
    });
    
    setCurrentSegmentLayers([]);
    setActiveSegmentId(null);
    console.log("✅ Map cleared");
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <div className="flex gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlayPreview}
                disabled={segments.length === 0}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Play preview of all segments"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Play Preview
              </button>
            ) : (
              <button
                onClick={handleStopPreview}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm flex items-center gap-1"
                title="Stop preview"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop
              </button>
            )}
            <button
              onClick={handleClearMap}
              disabled={currentSegmentLayers.length === 0}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear all layers from map"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
            <button
              onClick={() => {
                setEditingSegment(undefined);
                setShowSegmentDialog(true);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm"
            >
              + Segment
            </button>
          </div>
        </div>
        {isPlaying && (
          <div className="mt-2 text-sm text-zinc-400">
            Playing segment {currentPlayIndex + 1} of {segments.length}
          </div>
        )}
      </div>

      {/* Segment list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-zinc-500 py-8">Loading...</div>
        ) : segments.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">No segments yet</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segments.map(s => s.segmentId)} strategy={verticalListSortingStrategy}>
              {segments.map((segment) => (
                <SortableSegmentItem
                  key={segment.segmentId}
                  segment={segment}
                  isActive={activeSegmentId === segment.segmentId}
                  onSelect={() => {
                    setActiveSegmentId(segment.segmentId);
                    onSegmentSelect?.(segment);
                  }}
                  onToggle={toggleExpanded}
                  onEdit={(seg) => {
                    setEditingSegment(seg);
                    setShowSegmentDialog(true);
                  }}
                  onDelete={(seg) => setConfirmDelete(seg)}
                  onAddZone={(segId) => {
                    setTargetSegmentId(segId);
                    setShowZoneDialog(true);
                  }}
                  onDeleteZone={(zone) => setConfirmDeleteZone(zone)}
                  onAddLayer={(segId) => {
                    setTargetSegmentId(segId);
                    setShowLayerDialog(true);
                  }}
                  onDeleteLayer={handleDeleteLayer}
                  onAddLocation={(segId) => {
                    setTargetSegmentId(segId);
                    setShowLocationDialog(true);
                  }}
                  onDeleteLocation={handleDeleteLocation}
                  onCaptureCamera={handleCaptureCamera}
                  onViewOnMap={handleViewSegment}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      {showSegmentDialog && (
        <SegmentDialog
          editing={editingSegment}
          currentMap={currentMap}
          onClose={() => {
            setShowSegmentDialog(false);
            setEditingSegment(undefined);
          }}
          onSave={editingSegment ? handleUpdateSegment : handleCreateSegment}
        />
      )}

      {showZoneDialog && (
        <SelectZoneDialog
          segmentId={targetSegmentId}
          onClose={() => setShowZoneDialog(false)}
          onSave={handleAddZone}
        />
      )}

      {showLayerDialog && (
        <SelectLayerDialog
          segmentId={targetSegmentId}
          onClose={() => setShowLayerDialog(false)}
          onSave={handleAddLayer}
        />
      )}

      {showLocationDialog && (
        <CreateLocationDialog
          segmentId={targetSegmentId}
          currentMap={currentMap}
          onClose={() => setShowLocationDialog(false)}
          onSave={handleAddLocation}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteSegment}
        title="Delete Segment"
        message={confirmDelete ? `Delete "${confirmDelete.name}"?` : ""}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteZone}
        onClose={() => setConfirmDeleteZone(null)}
        onConfirm={handleDeleteZone}
        title="Remove Zone"
        message="Remove this zone from segment?"
        variant="warning"
      />
    </div>
  );
}
