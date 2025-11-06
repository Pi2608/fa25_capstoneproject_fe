import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableSegmentItem from "@/components/storymap/items/SortableSegmentItem";
import { Segment, SegmentZone } from "@/lib/api-storymap";

type SegmentListProps = {
  segments: Segment[];
  loading: boolean;
  activeSegmentId: string | null;
  currentMap: any;
  onSelect: (segment: Segment) => void;
  onToggle: (segmentId: string) => void;
  onEdit: (segment: Segment) => void;
  onDelete: (segment: Segment) => void;
  onAddZone: (segmentId: string) => void;
  onDeleteZone: (zone: SegmentZone) => void;
  onAddLayer: (segmentId: string) => void;
  onDeleteLayer: (segmentLayerId: string) => void;
  onAddLocation: (segmentId: string) => void;
  onDeleteLocation: (locationId: string) => void;
  onCaptureCamera: (segment: Segment) => void;
  onViewOnMap: (segment: Segment) => Promise<void>;
  onDragEnd: (event: DragEndEvent) => void;
};

export default function SegmentList({
  segments,
  loading,
  activeSegmentId,
  currentMap,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onAddZone,
  onDeleteZone,
  onAddLayer,
  onDeleteLayer,
  onAddLocation,
  onDeleteLocation,
  onCaptureCamera,
  onViewOnMap,
  onDragEnd,
}: SegmentListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-zinc-500 py-8">Loading...</div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-zinc-500 py-8">No segments yet</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={segments.map(s => s.segmentId)} strategy={verticalListSortingStrategy}>
          {segments.map((segment) => (
            <SortableSegmentItem
              key={segment.segmentId}
              segment={segment as any}
              isActive={activeSegmentId === segment.segmentId}
              onSelect={() => onSelect(segment)}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddZone={onAddZone}
              onDeleteZone={onDeleteZone}
              onAddLayer={onAddLayer}
              onDeleteLayer={onDeleteLayer}
              onAddLocation={onAddLocation}
              onDeleteLocation={onDeleteLocation}
              onCaptureCamera={onCaptureCamera}
              onViewOnMap={onViewOnMap}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
