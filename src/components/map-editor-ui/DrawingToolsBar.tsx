import React from "react";
import { ToolButton } from "./ToolButton";
import type { MapWithPM } from "@/types";
import {
  enableDraw,
  toggleEdit,
  toggleDelete,
  toggleDrag,
  enableCutPolygon,
  toggleRotate,
} from "@/utils/mapHelpers";
import {
  MapPin,
  Move,
  Hexagon,
  RectangleHorizontal,
  Circle,
  Type,
  Scissors,
  RotateCw,
  Pencil,
  LineChart,
  Slash,
  Highlighter,
  PenTool,
  Ruler,
  Square,
} from "lucide-react";

interface DrawingToolsBarProps {
  mapRef: React.MutableRefObject<MapWithPM | null>;
  onStartMeasurement?: (mode: 'distance' | 'area') => void;
}

/**
 * Drawing tools bar component with all map editing tools
 */
export const DrawingToolsBar: React.FC<DrawingToolsBarProps> = ({ 
  mapRef,
  onStartMeasurement,
}) => {
  const isDisabled = !mapRef.current;

  return (
    <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
      <ToolButton
        title="Vẽ điểm"
        onClick={() => enableDraw(mapRef, "Marker")}
        disabled={isDisabled}
      >
        <MapPin size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Vẽ đường"
        onClick={() => enableDraw(mapRef, "Line")}
        disabled={isDisabled}
      >
        <Slash size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Vẽ vùng"
        onClick={() => enableDraw(mapRef, "Polygon")}
        disabled={isDisabled}
      >
        <Hexagon size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Vẽ hình chữ nhật"
        onClick={() => enableDraw(mapRef, "Rectangle")}
        disabled={isDisabled}
      >
        <RectangleHorizontal size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Vẽ hình tròn"
        onClick={() => enableDraw(mapRef, "Circle")}
        disabled={isDisabled}
      >
        <Circle size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Thêm chữ"
        onClick={() => enableDraw(mapRef, "Text")}
        disabled={isDisabled}
      >
        <Type size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Vẽ Marker (đường đen)"
        onClick={() => enableDraw(mapRef, "FreehandMarker")}
        disabled={isDisabled}
      >
        <PenTool size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Tô sáng (Highlighter vàng)"
        onClick={() => enableDraw(mapRef, "FreehandHighlighter")}
        disabled={isDisabled}
      >
        <Highlighter size={18} strokeWidth={1.8} />
      </ToolButton>

      {/* <ToolButton
        title="Cắt polygon"
        onClick={() => enableCutPolygon(mapRef)}
        disabled={isDisabled}
      >
        <Scissors size={18} strokeWidth={1.8} />
      </ToolButton> */}

      <ToolButton
        title="Xoay đối tượng"
        onClick={() => toggleRotate(mapRef)}
        disabled={isDisabled}
      >
        <RotateCw size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Di chuyển đối tượng"
        onClick={() => toggleDrag(mapRef)}
        disabled={isDisabled}
      >
        <Move size={18} strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        title="Chỉnh sửa đối tượng"
        onClick={() => toggleEdit(mapRef)}
        disabled={isDisabled}
      >
        <Pencil size={18} strokeWidth={1.8} />
      </ToolButton>

      {/* {onStartMeasurement && (
        <>
          <ToolButton
            title="Measure Distance (M)"
            onClick={() => onStartMeasurement('distance')}
            disabled={isDisabled}
          >
            <Ruler size={18} strokeWidth={1.8} />
          </ToolButton>

          <ToolButton
            title="Measure Area (M)"
            onClick={() => onStartMeasurement('area')}
            disabled={isDisabled}
          >
            <Square size={18} strokeWidth={1.8} />
          </ToolButton>
        </>
      )} */}
    </div>
  );
};
