"use client";

import { useState, useEffect } from "react";
import { CreateLocationRequest, Location } from "@/lib/api-storymap";
import { LocationType } from "@/types/location";
import { Icon } from "@/components/map-editor-ui/Icon";

type TabType = "basic" | "icon" | "display" | "media";

// Simple Markdown to HTML converter for preview
function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let currentParagraph: string[] = [];
  
  const processParagraph = () => {
    if (currentParagraph.length > 0) {
      let para = currentParagraph.join(' ');
      
      // Process inline formatting before wrapping in <p>
      // Images ![alt](url) - do this first (only if it's a standalone line, not in paragraph)
      // Note: Images in paragraphs will be handled as block elements
      para = para.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        const escapedAlt = alt.replace(/"/g, '&quot;');
        const escapedUrl = url.replace(/"/g, '&quot;');
        return `<img src="${escapedUrl}" alt="${escapedAlt}" class="max-w-full h-auto max-h-32 rounded border border-zinc-700 my-2 inline-block align-middle" loading="lazy" onerror="this.style.opacity='0.5';">`;
      });
      
      // Links [text](url) - do this before bold/italic
      para = para.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:text-emerald-300 underline">$1</a>');
      
      // Bold (**text** or __text__)
      para = para.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
      para = para.replace(/__(.+?)__/g, '<strong class="font-semibold text-white">$1</strong>');
      
      // Italic (*text* or _text_) - only if not already part of bold
      para = para.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic">$1</em>');
      
      result.push(`<p class="my-2 text-zinc-200">${para}</p>`);
      currentParagraph = [];
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      processParagraph();
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      continue;
    }
    
    // Headers
    if (line.startsWith('### ')) {
      processParagraph();
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      const text = line.substring(4);
      result.push(`<h3 class="text-base font-bold mt-3 mb-1 text-white">${text}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      processParagraph();
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      const text = line.substring(3);
      result.push(`<h2 class="text-lg font-bold mt-4 mb-2 text-white">${text}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      processParagraph();
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      const text = line.substring(2);
      result.push(`<h1 class="text-xl font-bold mt-4 mb-2 text-white">${text}</h1>`);
      continue;
    }
    
    // Images ![alt](url)
    if (line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)) {
      processParagraph();
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (match) {
        const alt = match[1] || '';
        const url = match[2];
        // Escape HTML trong alt và url để tránh XSS
        const escapedAlt = alt.replace(/"/g, '&quot;');
        const escapedUrl = url.replace(/"/g, '&quot;');
        result.push(`<div class="my-3 flex justify-center"><img src="${escapedUrl}" alt="${escapedAlt}" class="max-w-full h-auto max-h-64 rounded-lg border border-zinc-700 shadow-lg object-contain" loading="lazy" onerror="this.style.opacity='0.5'; this.title='Không thể tải ảnh';"></div>`);
      }
      continue;
    }
    
    // Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      processParagraph();
      if (!inList) {
        result.push('<ul class="list-disc ml-4 my-2 space-y-1">');
        inList = true;
      }
      let itemText = line.substring(2);
      
      // Process inline formatting in list items
      itemText = itemText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:text-emerald-300 underline">$1</a>');
      itemText = itemText.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
      itemText = itemText.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic">$1</em>');
      
      result.push(`<li class="text-zinc-200">${itemText}</li>`);
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
    currentParagraph.push(line);
  }
  
  processParagraph();
  if (inList) {
    result.push('</ul>');
  }
  
  return result.join('');
}

interface LocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  segmentId: string;
  currentMap?: any;
  initialCoordinates?: [number, number] | null;
  initialLocation?: Location | null;
  waitingForLocation?: boolean;
  setWaitingForLocation?: (waiting: boolean) => void;
}

export default function LocationDialog({
  isOpen,
  onClose,
  onSave,
  segmentId,
  currentMap,
  initialCoordinates,
  initialLocation,
}: LocationDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  
  // Basic tab
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("PointOfInterest");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);

  // Icon tab
  const [iconType, setIconType] = useState("📍");
  const [iconUrl, setIconUrl] = useState("");
  const [iconColor, setIconColor] = useState("#FF0000");
  const [iconSize, setIconSize] = useState(32);

  // Display tab
  const [showTooltip, setShowTooltip] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");
  const [openPopupOnClick, setOpenPopupOnClick] = useState(true);
  const [popupContent, setPopupContent] = useState("");

  // Media tab
  const [mediaUrls, setMediaUrls] = useState("");
  const [playAudioOnClick, setPlayAudioOnClick] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens or load initial location for editing
  useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        // Edit mode
        setTitle(initialLocation.title || "");
        setSubtitle(initialLocation.subtitle || "");
        setDescription(initialLocation.description || "");
        setLocationType(initialLocation.locationType || "PointOfInterest");
        
        if (initialLocation.markerGeometry) {
          try {
            const geoJson = JSON.parse(initialLocation.markerGeometry);
            if (geoJson.type === "Point" && geoJson.coordinates) {
              setCoordinates(geoJson.coordinates as [number, number]);
            }
          } catch (e) {
            console.error("Failed to parse marker geometry:", e);
          }
        }
        
        setIconType(initialLocation.iconType || "📍");
        setIconUrl(initialLocation.iconUrl || "");
        setIconColor(initialLocation.iconColor || "#FF0000");
        setIconSize(initialLocation.iconSize || 32);
        setShowTooltip(initialLocation.showTooltip ?? true);
        setTooltipContent(initialLocation.tooltipContent || "");
        setOpenPopupOnClick(initialLocation.openPopupOnClick ?? false);
        setPopupContent(initialLocation.popupContent || "");
        setMediaUrls((initialLocation as any).mediaUrls || "");
        setPlayAudioOnClick(initialLocation.playAudioOnClick ?? false);
        setAudioUrl(initialLocation.audioUrl || "");
        setExternalUrl(initialLocation.externalUrl || "");
      } else {
        // Create mode
        setActiveTab("basic");
        setTitle("");
        setSubtitle("");
        setDescription("");
        setLocationType("PointOfInterest");
        setCoordinates(initialCoordinates || null);
        setIconType("📍");
        setIconUrl("");
        setIconColor("#FF0000");
        setIconSize(32);
        setShowTooltip(true);
        setTooltipContent("");
        setOpenPopupOnClick(true);
        setPopupContent("");
        setMediaUrls("");
        setPlayAudioOnClick(false);
        setAudioUrl("");
        setExternalUrl("");
      }
    }
  }, [isOpen, initialCoordinates, initialLocation]);

  // Show temporary marker when coordinates are set
  useEffect(() => {
    if (!currentMap || !isOpen || !coordinates) return;

    const L = (window as any).L;
    if (!L) return;

    const [lng, lat] = coordinates;
    const tempMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'temp-location-marker',
        html: `<div style="font-size: ${iconSize}px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${iconType}</div>`,
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize],
      }),
    });
    tempMarker.addTo(currentMap);

    return () => {
      currentMap.removeLayer(tempMarker);
    };
  }, [currentMap, isOpen, coordinates, iconType, iconSize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Vui lòng nhập tên địa điểm");
      return;
    }

    if (!coordinates) {
      alert("Vui lòng chọn vị trí trên bản đồ");
      return;
    }

    setSaving(true);
    try {
      const markerGeometry = JSON.stringify({
        type: "Point",
        coordinates: coordinates,
      });

      const data: CreateLocationRequest = {
        segmentId,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        locationType,
        markerGeometry,
        iconType: iconType || undefined,
        iconUrl: iconUrl.trim() || undefined,
        iconColor,
        iconSize,
        displayOrder: 0,
        highlightOnEnter: false,
        showTooltip,
        tooltipContent: tooltipContent.trim() || title.trim(),
        openPopupOnClick,
        popupContent: popupContent.trim() || description.trim() || undefined,
        mediaUrls: mediaUrls.trim() || undefined,
        playAudioOnClick,
        audioUrl: audioUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        isVisible: true,
        zIndex: 100,
      };

      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to save location:", error);
      alert("Lỗi khi lưu địa điểm. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "basic", label: "Thông tin", icon: "📍" },
    { id: "icon", label: "Icon", icon: "🎨" },
    { id: "display", label: "Hiển thị", icon: "👁️" },
    { id: "media", label: "Media", icon: "🖼️" },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between bg-zinc-800/50">
          <h3 className="text-base font-semibold text-white">
            {initialLocation ? "Chỉnh sửa Location" : "Thêm Location/POI"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700 bg-zinc-800/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Basic Tab */}
            {activeTab === "basic" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Tên địa điểm *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="Tên location"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Phụ đề</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="Mô tả ngắn"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Mô tả</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 resize-none"
                    placeholder="Mô tả chi tiết..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Loại địa điểm</label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as LocationType)}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                  >
                    <option value="PointOfInterest">Point of Interest</option>
                    <option value="MediaSpot">Media Spot</option>
                    <option value="TextOnly">Text Only</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <label className="block text-xs text-zinc-400 mb-2">Tọa độ *</label>
                  {coordinates ? (
                    <div className="text-xs text-zinc-300 font-mono bg-zinc-900 rounded px-2 py-1.5">
                      📍 Lng: {coordinates[0].toFixed(6)}, Lat: {coordinates[1].toFixed(6)}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic">
                      Chưa chọn vị trí. Click trên bản đồ để chọn.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Icon Tab */}
            {activeTab === "icon" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Icon Emoji/Text</label>
                    <input
                      type="text"
                      value={iconType}
                      onChange={(e) => setIconType(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="📍"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Icon URL</label>
                    <input
                      type="text"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Màu icon</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={iconColor}
                        onChange={(e) => setIconColor(e.target.value)}
                        className="w-10 h-9 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={iconColor}
                        onChange={(e) => setIconColor(e.target.value)}
                        className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Kích thước: <strong className="text-white">{iconSize}px</strong>
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="64"
                      value={iconSize}
                      onChange={(e) => setIconSize(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Display Tab */}
            {activeTab === "display" && (
              <>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTooltip}
                      onChange={(e) => setShowTooltip(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-zinc-300">Hiển thị tooltip (nhãn trên marker)</span>
                  </label>

                  {showTooltip && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Nội dung tooltip</label>
                      <input
                        type="text"
                        value={tooltipContent}
                        onChange={(e) => setTooltipContent(e.target.value)}
                        className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                        placeholder="Để trống = dùng tên địa điểm"
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-zinc-700 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={openPopupOnClick}
                        onChange={(e) => setOpenPopupOnClick(e.target.checked)}
                        className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-zinc-300">Mở popup khi click</span>
                    </label>

                    {openPopupOnClick && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Nội dung popup (Markdown)</label>
                          <textarea
                            value={popupContent}
                            onChange={(e) => setPopupContent(e.target.value)}
                            rows={6}
                            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                            placeholder="**Tên địa điểm**&#10;&#10;![Mô tả ảnh](https://example.com/image.jpg)&#10;&#10;Mô tả chi tiết...&#10;&#10;- Điểm nổi bật 1&#10;- Điểm nổi bật 2&#10;&#10;[Xem thêm](https://example.com)"
                          />
                          <p className="text-[10px] text-zinc-500 mt-1">
                            💡 Markdown: **bold**, *italic*, [link](url), ![alt](image-url), - list, # heading
                          </p>
                        </div>
                        
                        {/* Preview */}
                        <div className="border-t border-zinc-700 pt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon icon="mdi:eye-outline" className="w-4 h-4 text-zinc-400" />
                            <label className="text-xs text-zinc-400 font-medium">Preview</label>
                          </div>
                          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-h-[100px] max-h-[200px] overflow-y-auto">
                            {popupContent.trim() ? (
                              <div 
                                className="text-sm text-zinc-200 prose prose-invert max-w-none prose-headings:text-white prose-p:text-zinc-200 prose-strong:text-white prose-a:text-emerald-400 prose-ul:text-zinc-200"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(popupContent) }}
                              />
                            ) : (
                              <p className="text-xs text-zinc-500 italic">Preview sẽ hiển thị ở đây...</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Media Tab */}
            {activeTab === "media" && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Media URLs (mỗi dòng một URL)</label>
                  <textarea
                    value={mediaUrls}
                    onChange={(e) => setMediaUrls(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-700 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playAudioOnClick}
                      onChange={(e) => setPlayAudioOnClick(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-zinc-300">Phát audio khi click</span>
                  </label>

                  {playAudioOnClick && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Audio URL</label>
                      <input
                        type="text"
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Link ngoài (External URL)</label>
                    <input
                      type="text"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 bg-zinc-800/30">
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !coordinates}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (initialLocation ? "Đang lưu..." : "Đang thêm...") : (initialLocation ? "Lưu" : "Thêm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
