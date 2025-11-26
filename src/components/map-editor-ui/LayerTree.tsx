"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LayerTreeNode } from "@/types/layers";
import type { LayerDTO } from "@/lib/api-maps";
import type { FeatureData } from "@/utils/mapUtils";
import { Icon } from "@/components/map-editor-ui/Icon";
import { cn } from "@/lib/utils";

interface LayerTreeProps {
  tree: LayerTreeNode[];
  onFeatureDrop: (featureId: string, targetLayerId: string | null) => Promise<void>;
  onLayerCollapse: (layerId: string, isCollapsed: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onSelectFeature: (feature: FeatureData) => void;
  onDeleteLayer: (layer: LayerDTO) => void;
  onDeleteFeature: (featureId: string) => void;
  totalLayerCount?: number;
}

export default function LayerTree({
  tree,
  onFeatureDrop,
  onLayerCollapse,
  onLayerVisibilityChange,
  onFeatureVisibilityChange,
  onSelectLayer,
  onSelectFeature,
  onDeleteLayer,
  onDeleteFeature,
  totalLayerCount,
}: LayerTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    // Find the dragged feature and target layer
    const draggedFeatureId = active.id as string;
    const targetId = over.id as string;

    // First, check if target is a layer
    let targetLayer = tree.find((node) => node.id === targetId);

    // If target is not a layer, it might be a feature - find its parent layer
    if (!targetLayer || targetLayer.type !== 'layer') {
      // Search for the feature in all layers to find its parent
      for (const layerNode of tree) {
        if (layerNode.type === 'layer' && layerNode.children) {
          const foundFeature = layerNode.children.find((child) => child.id === targetId);
          if (foundFeature) {
            targetLayer = layerNode;
            break;
          }
        }
      }
    }

    if (targetLayer && targetLayer.type === 'layer') {
      // Move feature to this layer
      await onFeatureDrop(draggedFeatureId, targetLayer.id);
    }
  };

  // Get all feature IDs for sortable context
  const featureIds: string[] = [];
  tree.forEach((layer) => {
    if (layer.children) {
      layer.children.forEach((feature) => {
        featureIds.push(feature.id);
      });
    }
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={featureIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {tree.map((layerNode) => (
            <LayerTreeItem
              key={layerNode.id}
              node={layerNode}
              activeId={activeId}
              onLayerCollapse={onLayerCollapse}
              onLayerVisibilityChange={onLayerVisibilityChange}
              onFeatureVisibilityChange={onFeatureVisibilityChange}
              onSelectLayer={onSelectLayer}
              onSelectFeature={onSelectFeature}
              onDeleteLayer={onDeleteLayer}
              onDeleteFeature={onDeleteFeature}
              totalLayerCount={totalLayerCount}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface LayerTreeItemProps {
  node: LayerTreeNode;
  activeId: string | null;
  onLayerCollapse: (layerId: string, isCollapsed: boolean) => void;
  onLayerVisibilityChange: (layerId: string, isVisible: boolean) => void;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onSelectLayer: (layer: LayerDTO) => void;
  onSelectFeature: (feature: FeatureData) => void;
  onDeleteLayer: (layer: LayerDTO) => void;
  onDeleteFeature: (featureId: string) => void;
  totalLayerCount?: number;
}

function LayerTreeItem({
  node,
  activeId,
  onLayerCollapse,
  onLayerVisibilityChange,
  onFeatureVisibilityChange,
  onSelectLayer,
  onSelectFeature,
  onDeleteLayer,
  onDeleteFeature,
  totalLayerCount,
}: LayerTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled: node.type === 'layer', // Only features are draggable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (node.type === 'layer') {
    const layer = node.data as LayerDTO;
    const isCollapsed = node.isCollapsed ?? false;
    const featureCount = node.children?.length || 0;

    return (
      <div ref={setNodeRef} style={style} className="space-y-0.5">
        {/* Layer Header */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded transition-colors group/layer",
            "hover:bg-zinc-800/60 cursor-pointer",
            !node.isVisible && "opacity-50"
          )}
          onClick={() => onSelectLayer(layer)}
        >
          {/* Collapse Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLayerCollapse(node.id, !isCollapsed);
            }}
            className="p-0.5 hover:bg-zinc-700 rounded flex-shrink-0"
          >
            <Icon
              icon={isCollapsed ? "mdi:chevron-right" : "mdi:chevron-down"}
              className="w-3.5 h-3.5 text-zinc-400"
            />
          </button>

          {/* Layer Icon */}
          <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="mdi:layers" className="w-3.5 h-3.5 text-blue-400" />
          </div>

          {/* Layer Name & Count */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-zinc-300 truncate font-medium">
              {node.name}
            </div>
            <div className="text-[10px] text-zinc-500">
              {featureCount} feature{featureCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover/layer:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLayerVisibilityChange(node.id, !node.isVisible);
              }}
              className="p-0.5 hover:bg-zinc-700 rounded"
              title="Toggle visibility"
            >
              <Icon
                icon={node.isVisible ? "mdi:eye" : "mdi:eye-off"}
                className={cn(
                  "w-3.5 h-3.5",
                  node.isVisible ? "text-emerald-400" : "text-zinc-600"
                )}
              />
            </button>
            {(!totalLayerCount || totalLayerCount > 1) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLayer(layer);
                }}
                className="p-0.5 hover:bg-red-900/50 rounded"
                title="Delete layer"
              >
                <Icon icon="mdi:delete" className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* Layer Children (Features) */}
        {!isCollapsed && node.children && node.children.length > 0 && (
          <div className="ml-5 space-y-0.5 border-l border-zinc-700/50 pl-2">
            {node.children.map((childNode) => (
              <FeatureTreeItem
                key={childNode.id}
                node={childNode}
                parentLayerVisible={node.isVisible}
                activeId={activeId}
                onFeatureVisibilityChange={onFeatureVisibilityChange}
                onSelectFeature={onSelectFeature}
                onDeleteFeature={onDeleteFeature}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

interface FeatureTreeItemProps {
  node: LayerTreeNode;
  parentLayerVisible: boolean;
  activeId: string | null;
  onFeatureVisibilityChange: (featureId: string, isVisible: boolean) => void;
  onSelectFeature: (feature: FeatureData) => void;
  onDeleteFeature: (featureId: string) => void;
}

function FeatureTreeItem({
  node,
  parentLayerVisible,
  activeId,
  onFeatureVisibilityChange,
  onSelectFeature,
  onDeleteFeature,
}: FeatureTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBeingDragged = activeId === node.id;
  const effectiveVisibility = parentLayerVisible && node.isVisible;

  // Get feature icon based on type
  const getFeatureIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'marker':
        return 'mdi:map-marker';
      case 'circle':
        return 'mdi:circle-outline';
      case 'polygon':
        return 'mdi:shape-polygon-plus';
      case 'rectangle':
        return 'mdi:rectangle-outline';
      case 'polyline':
      case 'line':
        return 'mdi:vector-polyline';
      default:
        return 'mdi:vector-square';
    }
  };

  const featureData = node.data as { type?: string };
  const featureType = featureData.type || 'unknown';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded transition-colors group/feature cursor-pointer",
        "hover:bg-zinc-800/60",
        !effectiveVisibility && "opacity-50",
        isBeingDragged && "opacity-50"
      )}
      onClick={() => onSelectFeature(node.data as FeatureData)}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover/feature:opacity-100 transition-opacity"
      >
        <Icon icon="mdi:drag-vertical" className="w-3.5 h-3.5 text-zinc-500" />
      </div>

      {/* Feature Icon */}
      <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <Icon
          icon={getFeatureIcon(featureType)}
          className="w-3.5 h-3.5 text-emerald-400"
        />
      </div>

      {/* Feature Name */}
      <span className="flex-1 text-xs text-zinc-300 truncate font-medium">
        {node.name}
      </span>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/feature:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFeatureVisibilityChange(node.id, !node.isVisible);
          }}
          className="p-0.5 hover:bg-zinc-700 rounded"
          title="Toggle visibility"
        >
          <Icon
            icon={node.isVisible ? "mdi:eye" : "mdi:eye-off"}
            className={cn(
              "w-3.5 h-3.5",
              node.isVisible ? "text-emerald-400" : "text-zinc-600"
            )}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFeature(node.id);
          }}
          className="p-0.5 hover:bg-zinc-700 rounded"
          title="Delete feature"
        >
          <Icon
            icon="mdi:delete-outline"
            className="w-3.5 h-3.5 text-red-400 hover:text-red-300"
          />
        </button>
      </div>
    </div>
  );
}
