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

interface DrawingToolsBarProps {
  mapRef: React.MutableRefObject<MapWithPM | null>;
}

/**
 * Drawing tools bar component with all map editing tools
 */
export const DrawingToolsBar: React.FC<DrawingToolsBarProps> = ({ mapRef }) => {
  const isDisabled = !mapRef.current;

  return (
    <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
      <ToolButton
        title="Vẽ điểm"
        onClick={() => enableDraw(mapRef, "Marker")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Vẽ đường"
        onClick={() => enableDraw(mapRef, "Line")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5" cy="7" r="2" />
          <circle cx="19" cy="17" r="2" />
          <path d="M7 8.5 17 15.5" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Vẽ vùng"
        onClick={() => enableDraw(mapRef, "Polygon")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Vẽ hình chữ nhật"
        onClick={() => enableDraw(mapRef, "Rectangle")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="6" width="14" height="12" rx="1.5" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Vẽ hình tròn"
        onClick={() => enableDraw(mapRef, "Circle")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Thêm chữ"
        onClick={() => enableDraw(mapRef, "Text")}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16M12 6v12" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Cắt polygon"
        onClick={() => enableCutPolygon(mapRef)}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5.5" cy="8" r="2" />
          <circle cx="5.5" cy="16" r="2" />
          <path d="M8 9l12 8M8 15l12-8" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Xoay đối tượng"
        onClick={() => toggleRotate(mapRef)}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 11a8 8 0 1 1-2.2-5.5" />
          <path d="M20 4v7h-7" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Di chuyển đối tượng"
        onClick={() => toggleDrag(mapRef)}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
      </ToolButton>

      <ToolButton
        title="Chỉnh sửa đối tượng"
        onClick={() => toggleEdit(mapRef)}
        disabled={isDisabled}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </ToolButton>
    </div>
  );
};
