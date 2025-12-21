"use client";

import { useState, useEffect, useRef } from "react";
import { CreateLocationRequest, Location, Segment } from "@/lib/api-storymap";
import { LocationType } from "@/types/location";
import { Icon } from "@/components/map-editor-ui/Icon";
import { IconLibraryView } from "@/components/map-editor-ui/IconLibraryView";
import { UserAsset, getUserAssets } from "@/lib/api-library";

type TabType = "basic" | "icon" | "display";

interface LocationFormProps {
  segmentId?: string;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  onCancel: () => void;
  initialCoordinates?: [number, number] | null;
  initialLocation?: Location | null;
  isLoading?: boolean;
  onRepickLocation?: () => void;
  onCancelRepick?: () => void;
  isStoryMap?: boolean;
  segments?: Segment[];
  mapId?: string;
  onCreateLocationFromAsset?: (asset: UserAsset, segmentId: string) => void;
}

export function LocationForm({
  segmentId,
  onSave,
  onCancel,
  initialCoordinates,
  initialLocation,
  isLoading = false,
  onRepickLocation,
  onCancelRepick,
  isStoryMap = false,
  segments = [],
  mapId,
  onCreateLocationFromAsset,
}: LocationFormProps) {
  const params = useParams() as { mapId?: string };
  const mapIdFromUrl = params?.mapId;

  const [activeTab, setActiveTab] = useState<TabType>("basic");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tooltipContent, setTooltipContent] = useState("");
  const [locationType, setLocationType] =
    useState<LocationType>("PointOfInterest");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [highlightOnEnter, setHighlightOnEnter] = useState(false);
  const [saving, setSaving] = useState(false);

  // Media state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioAssets, setAudioAssets] = useState<UserAsset[]>([]);
  const [audioAssetsLoading, setAudioAssetsLoading] = useState(false);
  const [selectedAudioAssetId, setSelectedAudioAssetId] = useState<string>("");

  // simple audio preview
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [iconUrl, setIconUrl] = useState("");
  const [iconType, setIconType] = useState(""); // For preset icons (e.g., "plane", "car")
  const [iconSize, setIconSize] = useState(32);
  const [audioUrl, setAudioUrl] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Selected icon state
  const [selectedIconKey, setSelectedIconKey] = useState<string>("");

  // Helper function to get MDI icon from preset key
  const getIconForKey = (key: string): string => {
    const iconMap: Record<string, string> = {
      // Travel & Movement
      plane: "mdi:airplane",
      car: "mdi:car",
      bus: "mdi:bus",
      train: "mdi:train",
      ship: "mdi:ferry",
      bike: "mdi:bike",
      walk: "mdi:walk",
      route: "mdi:routes",
      from: "mdi:map-marker-radius",
      to: "mdi:map-marker-check",
      // Places & POI
      home: "mdi:home-outline",
      office: "mdi:office-building-outline",
      school: "mdi:school-outline",
      hospital: "mdi:hospital-building",
      restaurant: "mdi:silverware-fork-knife",
      coffee: "mdi:coffee-outline",
      shop: "mdi:storefront-outline",
      park: "mdi:tree-outline",
      museum: "mdi:bank-outline",
      hotel: "mdi:bed-outline",
      // People & Events
      person: "mdi:account",
      group: "mdi:account-group",
      info: "mdi:information-outline",
      warning: "mdi:alert-outline",
      danger: "mdi:alert-octagon-outline",
      star: "mdi:star-outline",
      photo: "mdi:image-outline",
      camera: "mdi:camera-outline",
      note: "mdi:note-text-outline",
      chat: "mdi:chat-outline",
      // Minerals & Resources
      gold: "mdi:gold",
      diamond: "mdi:diamond-stone",
      crystal: "mdi:diamond",
      oil: "mdi:oil",
      coal: "mdi:cube-outline",
      iron: "mdi:hammer-wrench",
      copper: "mdi:lightning-bolt",
      silver: "mdi:circle-outline",
      gem: "mdi:sack",
      mine: "mdi:pickaxe",
      // History & Landmarks
      mountain: "mdi:terrain",
      river: "mdi:water",
      lake: "mdi:water-circle",
      forest: "mdi:tree",
      desert: "mdi:weather-sunny",
      volcano: "mdi:volcano",
      island: "mdi:island",
      beach: "mdi:beach",
      castle: "mdi:castle",
      temple: "mdi:temple-hindu",
      monument: "mdi:monument",
      tomb: "mdi:tombstone",
      ruin: "mdi:castle",
      battlefield: "mdi:sword",
      "ancient-city": "mdi:city-variant",
    };
    return iconMap[key] || "mdi:map-marker";
  };

  useEffect(() => {
    // Prioritize initialCoordinates over initialLocation.markerGeometry
    if (initialCoordinates !== undefined && initialCoordinates !== null) {
      setCoordinates(initialCoordinates);
    } else if (initialLocation && !coordinates) {
      if (initialLocation.markerGeometry) {
        try {
          const geo = JSON.parse(initialLocation.markerGeometry);
          if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
            setCoordinates([geo.coordinates[0], geo.coordinates[1]]);
          }
        } catch (e) {
          console.error("Failed to parse coordinates:", e);
        }
      }
    }

    if (initialLocation) {
      setTitle(initialLocation.title || "");
      setSubtitle(initialLocation.subtitle || "");
      setTooltipContent(initialLocation.tooltipContent || "");
      setLocationType(initialLocation.locationType || "PointOfInterest");
      setIsVisible(initialLocation.isVisible !== false);
      setHighlightOnEnter(initialLocation.highlightOnEnter ?? false);

      // Handle icon: priority iconType > iconUrl (mutual exclusivity)
      const hasIconType = initialLocation.iconType && initialLocation.iconType.trim() !== "";
      const hasIconUrl = initialLocation.iconUrl && initialLocation.iconUrl.trim() !== "";

      if (hasIconType) {
        // If has preset icon, use it and clear URL
        setIconType(initialLocation.iconType || "");
        setIconUrl(""); // Clear URL to maintain mutual exclusivity
        setSelectedIconKey(initialLocation.iconType || "");
      } else if (hasIconUrl) {
        // If only has URL, use it
        setIconType("");
        setIconUrl(initialLocation.iconUrl || "");
        setSelectedIconKey("");
      } else {
        // No icon
        setIconType("");
        setIconUrl("");
        setSelectedIconKey("");
      }

      setIconSize(initialLocation.iconSize || 32);
      setAudioUrl(initialLocation.audioUrl || "");
    }
  }, [initialLocation, initialCoordinates]);

  useEffect(() => {
    if (activeTab !== "media") return;

    let cancelled = false;

    (async () => {
      try {
        setAudioAssetsLoading(true);

        const res = await getUserAssets({ page: 1, pageSize: 200 });

        const audios = (res.assets ?? []).filter((a) => a.type === "audio");

        if (!cancelled) setAudioAssets(audios);
      } catch (e) {
        console.error("Failed to load audio assets", e);
        if (!cancelled) setAudioAssets([]);
      } finally {
        if (!cancelled) setAudioAssetsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Handle icon file preview
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconUrl(""); // Clear URL when file is selected
      setIconType(""); // Clear iconType when uploading custom file
      setSelectedIconKey("");
      const reader = new FileReader();
      reader.onload = (e) => setIconPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Handle audio file change
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(""); // Clear URL when file is selected
    }
  };

  const handleIconSelect = (iconKey: string, iconUrl?: string) => {
    setSelectedIconKey(iconKey);

    // Check if it's a preset icon (not an asset)
    if (iconKey.startsWith("asset:")) {
      // It's an uploaded asset, use iconUrl
      if (iconUrl) {
        setIconUrl(iconUrl);
        setIconPreview(iconUrl);
        setIconFile(null);
        setIconType(""); // Clear iconType when using custom asset
      }
    } else {
      // It's a preset icon, use iconType
      setIconType(iconKey);
      setIconUrl(""); // Clear iconUrl when using preset
      setIconFile(null);
      setIconPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !coordinates) return;

    setSaving(true);
    try {
      // Simplified logic: always send both iconType and iconUrl based on current state
      const hasIconType = iconType.trim() !== "";
      const hasIconFile = iconFile !== null;
      const hasIconUrl = iconUrl.trim() !== "";

      // Determine final values with clear mutual exclusivity
      let finalIconType: string;
      let finalIconUrl: string;

      if (hasIconType) {
        // Using preset icon → send iconType and clear iconUrl
        finalIconType = iconType.trim();
        finalIconUrl = ""; // Always clear iconUrl when using preset
      } else if (hasIconFile || hasIconUrl) {
        // Using custom icon → clear iconType and send iconUrl
        finalIconType = ""; // Always clear iconType when using custom
        finalIconUrl = iconUrl.trim();
      } else {
        // No icon → clear both (for delete case)
        finalIconType = "";
        finalIconUrl = "";
      }

      const data: CreateLocationRequest = {
        segmentId: segmentId, // CRITICAL: Must include segmentId to maintain segment association
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        tooltipContent: tooltipContent.trim() || undefined,
        locationType,
        markerGeometry: JSON.stringify({
          type: "Point",
          coordinates: coordinates,
        }),
        displayOrder: initialLocation?.displayOrder ?? 0,
        highlightOnEnter: highlightOnEnter,
        showTooltip: !!tooltipContent.trim(),
        isVisible,
        // Media fields
        iconFile: iconFile || undefined,
        audioFile: audioFile || undefined,
        // Always send both to ensure proper clearing
        iconType: finalIconType,
        iconUrl: finalIconUrl,
        iconSize: iconSize,
        audioUrl: audioUrl.trim() || undefined,
      };

      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "basic", label: "Thông tin", icon: "📍" },
    { id: "media", label: "Icon & Media", icon: "🎨" },
    { id: "display", label: "Hiển thị", icon: "👁️" },
  ];

  return (
    <div className="p-3 space-y-3 border-b border-zinc-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {initialLocation ? "Chỉnh sửa Location" : "Thêm Location/POI"}
        </h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={saving}
        >
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={saving}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${activeTab === tab.id
              ? "text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400"
              : "text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {activeTab === "basic" && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Tên địa điểm *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Tên location"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phụ đề</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Mô tả ngắn"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Risk Text</label>
              <textarea
                value={tooltipContent}
                onChange={(e) => setTooltipContent(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                placeholder="Nhập nội dung Risk Text..."
                rows={3}
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Loại địa điểm
              </label>
              <select
                value={locationType}
                onChange={(e) =>
                  setLocationType(e.target.value as LocationType)
                }
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={saving}
              >
                <option value="PointOfInterest">Point of Interest</option>
                <option value="Landmark">Landmark</option>
                <option value="Route">Route</option>
                <option value="Event">Event</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400 mb-1">Tọa độ</label>
              {coordinates ? (
                <div className="flex items-center justify-between gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
                  <div className="text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">📍</span>{" "}
                    {coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}
                  </div>
                  {onRepickLocation && (
                    <button
                      type="button"
                      onClick={onRepickLocation}
                      disabled={saving}
                      className="px-2 py-1 text-[10px] bg-emerald-600/80 hover:bg-emerald-600 text-white rounded transition-colors"
                    >
                      Chọn lại
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2 bg-zinc-800/50 rounded border border-zinc-700 border-dashed space-y-2">
                  <div className="text-xs text-zinc-500 text-center">
                    👆 Click vào bản đồ để chọn vị trí
                  </div>
                  {onCancelRepick && (
                    <button
                      type="button"
                      onClick={onCancelRepick}
                      disabled={saving}
                      className="w-full px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                    >
                      Hủy chọn lại
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === "media" && (
          <div className="space-y-3">
            {/* Icon Image Upload */}
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Ảnh đại diện (Icon)</label>

              {/* Preset Icon Preview */}
              {iconType && !iconFile && (
                <div className="flex items-center gap-2 p-2 bg-emerald-900/20 rounded text-xs border border-emerald-700/50">
                  <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                    <Icon icon={getIconForKey(iconType)} className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-emerald-300 text-xs font-medium">Preset Icon: {iconType}</div>
                    <div className="text-emerald-500 text-[10px]">Icon từ thư viện</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIconType("");
                      setIconUrl("");
                      setIconFile(null);
                      setIconPreview(null);
                      setSelectedIconKey("");
                    }}
                    className="px-2 py-1 text-[10px] bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors"
                    title="Xóa icon"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Current Icon Preview */}
              {(iconPreview || iconUrl) && !iconFile && !iconType && (
                <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded text-xs border border-zinc-700">
                  <img
                    src={iconPreview || iconUrl}
                    alt="Current icon"
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-zinc-300 text-xs">Icon hiện tại</div>
                    {iconUrl && (
                      <div className="text-zinc-500 text-[10px] truncate max-w-[180px]" title={iconUrl}>
                        {iconUrl}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIconType("");
                      setIconUrl("");
                      setIconFile(null);
                      setIconPreview(null);
                      setSelectedIconKey("");
                    }}
                    className="px-2 py-1 text-[10px] bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors"
                    title="Xóa icon"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconFileChange}
                  className="hidden"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  disabled={saving}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors flex items-center justify-center gap-1"
                >
                  {iconUrl || iconPreview ? "Thay đổi" : "Upload ảnh"}
                </button>

              </div>

              {/* New Upload Preview */}
              {iconFile && (
                <div className="flex items-center gap-2 p-2 bg-emerald-900/20 rounded text-xs border border-emerald-700/50">
                  {iconPreview && (
                    <img src={iconPreview} alt="Preview" className="w-8 h-8 rounded object-cover" />
                  )}
                  <span className="flex-1 truncate text-emerald-300 font-medium">{iconFile.name}</span>
                  <span className="text-[10px] text-emerald-400">Mới</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIconType("");
                      setIconUrl("");
                      setIconFile(null);
                      setIconPreview(null);
                      setSelectedIconKey("");
                    }}
                    className="p-1 hover:bg-zinc-700 rounded"
                  >
                    <Icon icon="mdi:close" className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              )}

              <div className="text-xs text-zinc-500">hoặc nhập URL:</div>
              <input
                type="url"
                value={iconUrl}
                onChange={(e) => {
                  setIconUrl(e.target.value);
                  setIconFile(null);
                  setIconPreview(null);
                  setIconType(""); // Clear iconType when using custom URL
                  setSelectedIconKey("");
                }}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="https://example.com/icon.png"
                disabled={saving}
              />

              {/* set icon size */}
              <div className="text-xs text-zinc-500">Kích thước hiển thị (px):</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={iconSize}
                  onChange={(e) => setIconSize(Number(e.target.value))}
                  className="w-20 bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={saving}
                  min={1}
                />
              </div>
            </div>

            {/* Audio Upload */}
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Audio (phát khi click)</label>
              {/* Audio assets from Library */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-zinc-500">Audio trong thư viện</div>

                  {audioUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAudioUrl("");
                        setSelectedAudioAssetId("");
                      }}
                      className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>

                {audioAssetsLoading ? (
                  <div className="text-xs text-zinc-500">Đang tải audio…</div>
                ) : audioAssets.length === 0 ? (
                  <div className="text-xs text-zinc-600">
                    Chưa có audio trong Library.
                  </div>
                ) : (
                  <div className="max-h-32 overflow-y-auto scrollbar-dark space-y-1">
                    {audioAssets.map((a) => {
                      const active = selectedAudioAssetId === a.id || audioUrl === a.url;

                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-2 p-2 rounded border ${active ? "border-emerald-600/60 bg-emerald-600/10" : "border-zinc-700 bg-zinc-800/40"
                            }`}
                          title={a.name} // hover hiện tên file
                        >
                          <button
                            type="button"
                            onClick={() => {
                              // chọn audio từ asset -> dùng URL, clear file upload
                              setAudioUrl(a.url);
                              setAudioFile(null);
                              setSelectedAudioAssetId(a.id);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="text-xs text-zinc-200 truncate">{a.name}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{a.mimeType ?? "audio"}</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!audioPreviewRef.current) return;
                              audioPreviewRef.current.src = a.url;
                              audioPreviewRef.current.play().catch(() => { });
                            }}
                            className="px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 text-white"
                            title="Nghe thử"
                          >
                            Play
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* single hidden audio element for preview */}
                <audio ref={audioPreviewRef} />
              </div>

              <div className="flex gap-2">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileChange}
                  className="hidden"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={saving}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors flex items-center justify-center gap-1"
                >
                  Upload audio
                </button>
              </div>
              {audioFile && (
                <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded text-xs">
                  <Icon icon="mdi:music" className="w-4 h-4 text-emerald-400" />
                  <span className="flex-1 truncate text-zinc-300">{audioFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAudioFile(null)}
                    className="p-1 hover:bg-zinc-700 rounded"
                  >
                    <Icon icon="mdi:close" className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              )}
              <div className="text-xs text-zinc-500">hoặc nhập URL:</div>
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => { setAudioUrl(e.target.value); setAudioFile(null); }}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="https://example.com/audio.mp3"
                disabled={saving}
              />
            </div>

            {/* Icon Selection Section - Merged from previous Icon tab */}
            <div className="space-y-2 pt-2 border-t border-zinc-700/50">
              <label className="block text-xs text-zinc-400 mb-1">Chọn icon</label>
              {/* Icon Library - Embedded */}
              <div className="border-t border-zinc-800 pt-3 -mx-3">
                <div className="max-h-96 overflow-y-auto scrollbar-dark">
                  <IconLibraryView
                    currentMap={undefined}
                    mapId={mapId}
                    isStoryMap={false}
                    segments={[]}
                    onSelectIcon={handleIconSelect}
                    selectedIconKey={selectedIconKey}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === "display" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={saving}
              />
              <span className="text-xs text-zinc-300">
                Hiển thị trên bản đồ
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightOnEnter}
                onChange={(e) => setHighlightOnEnter(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={saving}
              />
              <span className="text-xs text-zinc-300">
                Highlight khi vào segment
              </span>
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !coordinates}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}