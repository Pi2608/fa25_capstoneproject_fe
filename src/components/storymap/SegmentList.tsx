import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (loading) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-zinc-500">
        Loading segments...
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-zinc-500">
        No segments yet – click &quot;+ Segment&quot; to create one.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="w-full overflow-x-auto">
        <SortableContext
          items={segments.map((s) => s.segmentId)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-row gap-4 px-4 py-3">
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
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}
