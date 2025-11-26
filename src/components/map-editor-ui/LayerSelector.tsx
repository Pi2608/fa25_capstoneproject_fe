import React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { LayerDTO } from "@/lib/api-maps";

interface LayerSelectorProps {
  layers: LayerDTO[];
  currentLayerId: string | null;
  onLayerChange: (layerId: string | null) => void;
}

/**
 * Component để chọn layer trước khi vẽ feature
 * Giúp giáo viên dễ dàng tổ chức features vào các layer
 */
export const LayerSelector: React.FC<LayerSelectorProps> = ({
  layers,
  currentLayerId,
  onLayerChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedLayer = layers.find((l) => l.id === currentLayerId);
  const hasLayers = layers.length > 0;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
          "border",
          currentLayerId
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600",
          !hasLayers && "opacity-50 cursor-not-allowed"
        )}
        disabled={!hasLayers}
        title={
          hasLayers
            ? currentLayerId
              ? `Layer: ${selectedLayer?.layerName || "Unknown"}`
              : "Chọn layer để vẽ feature (hoặc để trống)"
            : "Chưa có layer nào. Hãy tạo layer trước."
        }
      >
        <Icon
          icon={currentLayerId ? "mdi:folder-check" : "mdi:folder-outline"}
          className="w-4 h-4"
        />
        <span className="max-w-[120px] truncate">
          {currentLayerId ? selectedLayer?.layerName || "Unknown" : "Không chọn layer"}
        </span>
        <Icon
          icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
          className="w-3.5 h-3.5"
        />
      </button>

      {isOpen && hasLayers && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          <div className="p-1.5">
            {/* Option: No layer */}
            <button
              onClick={() => {
                onLayerChange(null);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                !currentLayerId
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
              <span>Không chọn layer</span>
              {!currentLayerId && (
                <Icon icon="mdi:check" className="w-3.5 h-3.5 ml-auto text-emerald-400" />
              )}
            </button>

            <div className="h-px bg-zinc-700 my-1" />

            {/* Layer list */}
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => {
                  onLayerChange(layer.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                  currentLayerId === layer.id
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <Icon icon="mdi:folder" className="w-4 h-4 text-blue-400" />
                <span className="flex-1 truncate">{layer.layerName}</span>
                {currentLayerId === layer.id && (
                  <Icon icon="mdi:check" className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

