"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit2, X, Check, Image as ImageIcon } from "lucide-react";
import { 
  getMapLegendItems, 
  createMapLegendItem, 
  updateMapLegendItem, 
  deleteMapLegendItem,
  type LayerDTO
} from "@/lib/api-maps";
import type { Segment, Location } from "@/lib/api-storymap";
import type { FeatureData } from "@/utils/mapUtils";
import { iconEmojiMap, iconLabelMap } from "@/constants/icons";
import { MapLocation } from "@/lib/api-location";

// Custom Legend Item Type
export type CustomLegendItem = {
  id: string;
  emoji: string;
  label: string;
  description?: string;
  iconUrl?: string;
  color?: string;
};

// Emoji Picker for Legend
const EMOJI_OPTIONS = [
  "📍", "🏛️", "🏠", "🏢", "🏫", "🏥", "🏪", "🏨", "⛪", "🕌",
  "🌳", "🌲", "🌴", "🌊", "⛰️", "🏔️", "🗻", "🌋", "🏝️", "🏜️",
  "🚗", "🚌", "🚆", "✈️", "🚢", "🚲", "🏍️", "🚶", "🛤️", "🛣️",
  "⭐", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤",
  "📅", "🎬", "🎯", "🎪", "🎭", "🎨", "🎵", "🍴", "☕", "🛒",
  "💡", "⚡", "🔥", "💧", "🌡️", "🚧", "⚠️", "❗", "❓", "✅",
];

// Icon Emoji Map for Route Animations
const ROUTE_ICON_MAP: Record<string, { emoji: string; label: string }> = {
  car: { emoji: "🚗", label: "Ô tô" },
  walking: { emoji: "🚶", label: "Đi bộ" },
  bike: { emoji: "🚴", label: "Xe đạp" },
  plane: { emoji: "✈️", label: "Máy bay" },
  bus: { emoji: "🚌", label: "Xe buýt" },
  train: { emoji: "🚆", label: "Tàu hỏa" },
  motorcycle: { emoji: "🏍️", label: "Xe máy" },
  boat: { emoji: "⛵", label: "Thuyền" },
  truck: { emoji: "🚛", label: "Xe tải" },
  helicopter: { emoji: "🚁", label: "Trực thăng" },
  custom: { emoji: "📍", label: "Tùy chỉnh" },
};

// Location Type Icons
const LOCATION_TYPE_ICON_MAP: Record<string, { emoji: string; label: string }> = {
  PointOfInterest: { emoji: "📍", label: "Điểm quan tâm" },
  Landmark: { emoji: "🏛️", label: "Địa danh" },
  Route: { emoji: "🛤️", label: "Tuyến đường" },
  Event: { emoji: "📅", label: "Sự kiện" },
  Custom: { emoji: "⭐", label: "Tùy chỉnh" },
};

// Legend Item Component
function LegendItem({ 
  emoji, 
  label, 
  count, 
  tooltip, 
  iconUrl,
  color,
  onEdit,
  onDelete,
  editable = false
}: { 
  emoji: string; 
  label: string; 
  count?: number; 
  tooltip?: string;
  iconUrl?: string;
  color?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  editable?: boolean;
}) {
  return (
    <div 
      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-700/50 transition-colors group relative"
      title={tooltip}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={label} className="w-5 h-5 object-contain" />
      ) : color ? (
        <div 
          className="w-4 h-4 rounded border border-zinc-600" 
          style={{ backgroundColor: color }}
        />
      ) : (
        <span className="text-lg">{emoji}</span>
      )}
      <span className="text-xs text-zinc-300 truncate max-w-[100px]">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-zinc-500 ml-auto">({count})</span>
      )}
      {editable && (
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-1 hover:bg-zinc-600 rounded text-zinc-400 hover:text-white"
            title="Chỉnh sửa"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-1 hover:bg-red-600 rounded text-zinc-400 hover:text-white"
            title="Xóa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
      {tooltip && !editable && (
        <div className="absolute left-full ml-2 hidden group-hover:block z-50 bg-zinc-800 text-xs text-white px-2 py-1 rounded shadow-lg whitespace-nowrap border border-zinc-600">
          {tooltip}
        </div>
      )}
    </div>
  );
}

// Custom Legend Item Editor Modal
function CustomLegendEditor({
  isOpen,
  onClose,
  onSave,
  editingItem,
  availableIcons,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: CustomLegendItem) => void;
  editingItem?: CustomLegendItem | null;
  availableIcons: Array<{ iconUrl: string; label: string; emoji: string; isCustom?: boolean; isFromLocation?: boolean }>;
}) {
  const [emoji, setEmoji] = useState(editingItem?.emoji || "📍");
  const [label, setLabel] = useState(editingItem?.label || "");
  const [description, setDescription] = useState(editingItem?.description || "");
  const [iconUrl, setIconUrl] = useState(editingItem?.iconUrl || "");
  const [color, setColor] = useState(editingItem?.color || "");
  const [selectedEmoji, setSelectedEmoji] = useState(""); // For standard icons without URL
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [iconType, setIconType] = useState<"emoji" | "location" | "url">(
    editingItem?.iconUrl ? "location" : "emoji"
  );
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setEmoji(editingItem.emoji || "📍");
      setLabel(editingItem.label || "");
      setDescription(editingItem.description || "");
      setIconUrl(editingItem.iconUrl || "");
      setColor(editingItem.color || "");
      // Check if using custom URL or standard emoji
      if (editingItem.iconUrl) {
        setIconType("location");
        setSelectedEmoji("");
      } else if (editingItem.emoji && editingItem.emoji !== "📍") {
        // Might be a standard icon emoji
        setIconType("location");
        setSelectedEmoji(editingItem.emoji);
      } else {
        setIconType("emoji");
        setSelectedEmoji("");
      }
    } else {
      setEmoji("📍");
      setLabel("");
      setDescription("");
      setIconUrl("");
      setColor("");
      setIconType("emoji");
      setSelectedEmoji("");
    }
  }, [editingItem, isOpen]);

  const handleSave = () => {
    if (!label.trim()) return;
    
    // Determine which emoji to use
    let finalEmoji = emoji;
    if (iconType === "location") {
      finalEmoji = selectedEmoji || "📍";
    } else if (iconType === "url") {
      finalEmoji = "📍";
    }
    
    onSave({
      id: editingItem?.id || `custom-${Date.now()}`,
      emoji: finalEmoji,
      label: label.trim(),
      description: description.trim() || undefined,
      iconUrl: (iconType === "location" || iconType === "url") && iconUrl.trim() ? iconUrl.trim() : undefined,
      color: color || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h3 className="text-white font-medium">
            {editingItem ? "Chỉnh sửa chú giải" : "Thêm chú giải mới"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Horizontal Layout */}
        <div className="p-4">
          <div className="flex gap-6">
            {/* Left Column - Icon Selection */}
            <div className="flex-1 space-y-4">
              {/* Icon Type Toggle */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Loại biểu tượng</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setIconType("emoji")}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors ${
                      iconType === "emoji" 
                        ? "bg-blue-600 text-white" 
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="text-base">😀</span> Emoji
                  </button>
                  <button
                    onClick={() => setIconType("location")}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors ${
                      iconType === "location" 
                        ? "bg-blue-600 text-white" 
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                    disabled={availableIcons.length === 0}
                    title={availableIcons.length === 0 ? "Chưa có icon nào từ Location" : "Chọn từ icon Location"}
                  >
                    <span className="text-base">📍</span> Location
                  </button>
                  <button
                    onClick={() => setIconType("url")}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors ${
                      iconType === "url" 
                        ? "bg-blue-600 text-white" 
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" /> URL
                  </button>
                </div>
              </div>

              {/* Emoji Picker */}
              {iconType === "emoji" && (
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">Chọn emoji</label>
                  <div className="p-2 bg-zinc-800 border border-zinc-600 rounded-lg grid grid-cols-10 gap-1 max-h-[180px] overflow-y-auto">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={`p-2 rounded hover:bg-zinc-700 text-lg ${emoji === e ? "bg-blue-600" : ""}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Icon Picker - Icons from locations (both URL and iconType) */}
              {iconType === "location" && (
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">Icon từ Location ({availableIcons.filter(i => i.isFromLocation).length} icon)</label>
                  <div className="p-2 bg-zinc-800 border border-zinc-600 rounded-lg max-h-[220px] overflow-y-auto">
                    {availableIcons.some(i => i.isFromLocation) ? (
                      <div className="grid grid-cols-5 gap-2">
                        {availableIcons.filter(i => i.isFromLocation).map((icon, idx) => (
                          <button
                            key={`loc-${icon.iconUrl || icon.emoji}-${idx}`}
                            onClick={() => { 
                              if (icon.iconUrl) {
                                setIconUrl(icon.iconUrl);
                                setSelectedEmoji("");
                              } else {
                                setIconUrl("");
                                setSelectedEmoji(icon.emoji);
                                setEmoji(icon.emoji);
                              }
                              if (!label) setLabel(icon.label);
                            }}
                            className={`p-2 rounded hover:bg-zinc-700 flex flex-col items-center gap-1 ${
                              (icon.iconUrl && iconUrl === icon.iconUrl) || (!icon.iconUrl && selectedEmoji === icon.emoji) 
                                ? "bg-blue-600" : ""
                            }`}
                            title={icon.label}
                          >
                            {icon.iconUrl ? (
                              <img src={icon.iconUrl} alt={icon.label} className="w-8 h-8 object-contain" />
                            ) : (
                              <span className="text-2xl">{icon.emoji}</span>
                            )}
                            <span className="text-[10px] text-zinc-400 truncate w-full text-center">{icon.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-zinc-500 text-sm">
                        Chưa có icon nào từ Location.<br/>
                        <span className="text-xs">Thêm Location với iconType hoặc iconUrl để hiển thị ở đây.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Custom URL Input */}
              {iconType === "url" && (
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">URL hình ảnh</label>
                  <input
                    type="url"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://example.com/icon.png"
                    className="w-full py-2 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {iconUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Xem trước:</span>
                      <img src={iconUrl} alt="Preview" className="w-8 h-8 object-contain rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>
              )}

              {/* Color (optional) */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Màu sắc (tùy chọn)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color || "#3388ff"}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3388ff"
                    className="flex-1 py-2 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {color && (
                    <button
                      onClick={() => setColor("")}
                      className="p-2 hover:bg-zinc-700 rounded text-zinc-400"
                      title="Xóa màu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Label & Description */}
            <div className="flex-1 space-y-4">
              {/* Label */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Tên chú giải *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ví dụ: Trạm xe buýt"
                  className="w-full py-2 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  maxLength={50}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Mô tả (tùy chọn)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về biểu tượng này..."
                  className="w-full py-2 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  rows={3}
                  maxLength={200}
                />
              </div>

              {/* Preview */}
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="text-xs text-zinc-500 mb-2">Xem trước:</div>
                <div className="flex items-center gap-3">
                  {(iconType === "location" || iconType === "url") && iconUrl ? (
                    <img src={iconUrl} alt={label} className="w-8 h-8 object-contain" />
                  ) : iconType === "location" && selectedEmoji ? (
                    <span className="text-2xl">{selectedEmoji}</span>
                  ) : color ? (
                    <div className="w-6 h-6 rounded border border-zinc-600" style={{ backgroundColor: color }} />
                  ) : (
                    <span className="text-2xl">{emoji}</span>
                  )}
                  <div>
                    <span className="text-sm text-zinc-200 block">{label || "Tên chú giải"}</span>
                    {description && (
                      <span className="text-xs text-zinc-400">{description}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {editingItem ? "Cập nhật" : "Thêm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main MapEditorLegend Component Props
export interface MapEditorLegendProps {
  mapId: string;
  segments: Segment[];
  layers: LayerDTO[];
  features: FeatureData[];
  isCollapsed: boolean;
  onToggle: () => void;
  isVisible?: boolean;
  isEditMode?: boolean;
  className?: string;
  /** Map-level locations (for regular maps that don't use segments) */
  mapLocations?: MapLocation[];
}

// Map Legend Component for Editor Page
export default function MapEditorLegend({ 
  mapId,
  segments, 
  layers,
  features,
  isCollapsed, 
  onToggle,
  isVisible = true,
  isEditMode = true,
  className = "",
  mapLocations = [],
}: MapEditorLegendProps) {
  // Custom legend items state
  const [customItems, setCustomItems] = useState<CustomLegendItem[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomLegendItem | null>(null);
  const [isLoadingLegend, setIsLoadingLegend] = useState(false);

  // Load custom items from API
  useEffect(() => {
    if (!mapId) return;
    
    const loadItems = async () => {
      setIsLoadingLegend(true);
      try {
        const items = await getMapLegendItems(mapId);
        setCustomItems(items.map(item => ({
          id: item.legendItemId,
          emoji: item.emoji,
          label: item.label,
          description: item.description,
          iconUrl: item.iconUrl,
          color: item.color,
        })));
      } catch (e) {
        console.warn("Failed to load custom legend items from API:", e);
        // Fallback to localStorage for backwards compatibility
        try {
          const stored = localStorage.getItem(`map-legend-${mapId}`);
          if (stored) {
            setCustomItems(JSON.parse(stored));
          }
        } catch (err) {
          console.warn("Failed to load from localStorage:", err);
        }
      } finally {
        setIsLoadingLegend(false);
      }
    };
    
    loadItems();
  }, [mapId]);

  // Handle add/update item
  const handleAddItem = async (item: CustomLegendItem) => {
    if (!mapId) return;
    
    try {
      const existing = customItems.find(i => i.id === item.id);
      if (existing && !item.id.startsWith("custom-")) {
        // Update existing (from API)
        await updateMapLegendItem(mapId, item.id, {
          label: item.label,
          description: item.description,
          emoji: item.emoji,
          iconUrl: item.iconUrl,
          color: item.color,
        });
        setCustomItems(customItems.map(i => i.id === item.id ? item : i));
      } else {
        // Create new
        const response = await createMapLegendItem(mapId, {
          label: item.label,
          description: item.description,
          emoji: item.emoji,
          iconUrl: item.iconUrl,
          color: item.color,
        });
        setCustomItems([...customItems, { ...item, id: response.legendItemId }]);
        // Clean up localStorage after successful API save
        try {
          localStorage.removeItem(`map-legend-${mapId}`);
        } catch {}
      }
    } catch (e) {
      console.error("Failed to save legend item:", e);
      // Fallback to localStorage
      const existing = customItems.find(i => i.id === item.id);
      if (existing) {
        const newItems = customItems.map(i => i.id === item.id ? item : i);
        setCustomItems(newItems);
        try {
          localStorage.setItem(`map-legend-${mapId}`, JSON.stringify(newItems));
        } catch {}
      } else {
        const newItems = [...customItems, item];
        setCustomItems(newItems);
        try {
          localStorage.setItem(`map-legend-${mapId}`, JSON.stringify(newItems));
        } catch {}
      }
    }
    setEditingItem(null);
  };

  const handleEditItem = (item: CustomLegendItem) => {
    setEditingItem(item);
    setShowEditor(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!mapId) return;
    if (!confirm("Bạn có chắc muốn xóa mục chú giải này?")) return;
    
    try {
      if (!id.startsWith("custom-")) {
        await deleteMapLegendItem(mapId, id);
      }
      setCustomItems(customItems.filter(i => i.id !== id));
      // Also update localStorage if it exists
      try {
        const stored = localStorage.getItem(`map-legend-${mapId}`);
        if (stored) {
          const items = JSON.parse(stored).filter((i: CustomLegendItem) => i.id !== id);
          localStorage.setItem(`map-legend-${mapId}`, JSON.stringify(items));
        }
      } catch {}
    } catch (e) {
      console.error("Failed to delete legend item:", e);
      // Fallback to localStorage only delete
      setCustomItems(customItems.filter(i => i.id !== id));
      try {
        localStorage.setItem(`map-legend-${mapId}`, JSON.stringify(customItems.filter(i => i.id !== id)));
      } catch {}
    }
  };

  // Collect all unique custom icon URLs from locations (for icon picker)
  const availableIcons = useMemo(() => {
    const iconList: Array<{ iconUrl: string; label: string; emoji: string; isCustom?: boolean; isFromLocation?: boolean }> = [];
    const addedUrls = new Set<string>();
    const addedEmojis = new Set<string>();
    const addedLocationEmojis = new Set<string>(); // Track emojis from locations separately
    
    // 1. Add standard Location Type icons first
    Object.entries(LOCATION_TYPE_ICON_MAP).forEach(([type, info]) => {
      if (!addedEmojis.has(info.emoji)) {
        addedEmojis.add(info.emoji);
        iconList.push({
          iconUrl: "", // No URL for standard icons, will use emoji
          label: info.label,
          emoji: info.emoji,
          isCustom: false,
        });
      }
    });
    
    // 2. Add standard Route Animation icons
    Object.entries(ROUTE_ICON_MAP).forEach(([type, info]) => {
      // Skip if already added (some emojis might overlap)
      if (!addedEmojis.has(info.emoji)) {
        addedEmojis.add(info.emoji);
        iconList.push({
          iconUrl: "",
          label: info.label,
          emoji: info.emoji,
          isCustom: false,
        });
      }
    });

    // Helper function to process a location (works with both Location and MapLocation types)
    const processLocation = (loc: { iconUrl?: string; iconType?: string; title?: string; locationType?: string }) => {
      // Custom URL icons
      if (loc.iconUrl && !addedUrls.has(loc.iconUrl)) {
        addedUrls.add(loc.iconUrl);
        iconList.push({
          iconUrl: loc.iconUrl,
          label: loc.title || loc.locationType || "Custom Icon",
          emoji: "📍",
          isCustom: true,
          isFromLocation: true,
        });
      }
      // IconType mapped to emoji (e.g., "restaurant" -> "🍽️")
      if (loc.iconType && loc.iconType.trim() && !loc.iconUrl) {
        const trimmedIconType = loc.iconType.trim();
        const emoji = iconEmojiMap[trimmedIconType];
        if (emoji && !addedLocationEmojis.has(emoji)) {
          addedLocationEmojis.add(emoji);
          iconList.push({
            iconUrl: "",
            label: iconLabelMap[trimmedIconType] || loc.title || trimmedIconType,
            emoji: emoji,
            isCustom: false,
            isFromLocation: true,
          });
        }
      }
    };
    
    // 3. Collect icons from map-level locations (for regular maps)
    mapLocations.forEach((loc) => {
      processLocation(loc);
    });
    
    // 4. Collect icons from segment locations (for storymaps)
    segments.forEach(seg => {
      seg.locations?.forEach((loc) => {
        processLocation(loc);
      });
      
      // 5. Collect custom icons from route animations
      seg.routeAnimations?.forEach((ra: any) => {
        if (ra.iconUrl && !addedUrls.has(ra.iconUrl)) {
          addedUrls.add(ra.iconUrl);
          iconList.push({
            iconUrl: ra.iconUrl,
            label: ra.name || "Route Icon",
            emoji: "🚗",
            isCustom: true,
          });
        }
      });
    });
    
    return iconList;
  }, [segments, mapLocations]);

  if (!isVisible) return null;

  // Don't render if no custom items and not in edit mode
  if (customItems.length === 0 && !isEditMode) return null;

  return (
    <div className={`absolute top-15 right-4 z-[1000] select-none ${className}`}>
      <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] max-w-[250px]">
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 transition-colors"
        >
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <span>📋</span> Chú giải
          </span>
          <span className="text-zinc-400 text-xs">
            {isCollapsed ? "▼" : "▲"}
          </span>
        </button>

        {/* Content */}
        {!isCollapsed && (
          <div className="px-2 py-2 space-y-3 max-h-[350px] overflow-y-auto">
            {/* Custom Legend Items Section */}
            <div>
              {isEditMode && (
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 px-2 mb-1 flex items-center justify-between">
                  <span>Chú giải</span>
                  <button
                    onClick={() => { setEditingItem(null); setShowEditor(true); }}
                    className="p-0.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                    title="Thêm chú giải mới"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {customItems.map((item) => (
                <LegendItem
                  key={item.id}
                  emoji={item.emoji}
                  label={item.label}
                  iconUrl={item.iconUrl}
                  color={item.color}
                  tooltip={item.description}
                  editable={isEditMode}
                  onEdit={() => handleEditItem(item)}
                  onDelete={() => handleDeleteItem(item.id)}
                />
              ))}
              {customItems.length === 0 && isEditMode && (
                <div className="text-xs text-zinc-500 px-2 py-1 italic">
                  Nhấn + để thêm chú giải
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Legend Editor Modal */}
      <CustomLegendEditor
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditingItem(null); }}
        onSave={handleAddItem}
        editingItem={editingItem}
        availableIcons={availableIcons}
      />
    </div>
  );
}
