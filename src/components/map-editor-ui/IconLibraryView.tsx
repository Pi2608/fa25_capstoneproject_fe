"use client";

import { useState, useEffect } from "react";
import { Icon } from "./Icon";
import { Segment } from "@/lib/api-storymap";
import { UserAsset, getUserAssets } from "@/lib/api-library";
import { cn } from "@/lib/utils";

interface IconLibraryViewProps {
  currentMap?: any;
  mapId?: string;
  isStoryMap?: boolean;
  segments?: Segment[];
  onCreateLocationFromAsset?: (iconKey: string, segmentId: string) => void;
  onSelectIcon?: (iconKey: string, iconUrl?: string) => void; // For direct icon selection (LocationForm)
  selectedIconKey?: string; // For showing which icon is selected
}

export function IconLibraryView({
  currentMap,
  mapId,
  isStoryMap = false,
  segments = [],
  onCreateLocationFromAsset,
  onSelectIcon,
  selectedIconKey,
}: IconLibraryViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedIconKey || null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Auto-select first segment if available
  useEffect(() => {
    if (isStoryMap && segments.length > 0 && !selectedSegmentId) {
      setSelectedSegmentId(segments[0].segmentId);
    }
  }, [isStoryMap, segments, selectedSegmentId]);

  // Load user assets
  useEffect(() => {
    const loadAssets = async () => {
      setLoadingAssets(true);
      try {
        const data = await getUserAssets("image");
        setUserAssets(data);
      } catch (error) {
        console.error("Failed to load user assets:", error);
      } finally {
        setLoadingAssets(false);
      }
    };
    loadAssets();
  }, []);

  // Update selected ID when prop changes
  useEffect(() => {
    if (selectedIconKey) {
      setSelectedId(selectedIconKey);
    }
  }, [selectedIconKey]);

  const startIconPlacement = (iconKey: string) => {
    if (typeof window === "undefined") return;

    // For StoryMap, require segment selection
    if (isStoryMap && onCreateLocationFromAsset) {
      if (!selectedSegmentId) {
        alert("Vui lòng chọn Segment trước khi tạo Location");
        return;
      }

      // Dispatch event with segment info for StoryMap
      window.dispatchEvent(
        new CustomEvent("icon:startPlacement", {
          detail: {
            iconKey,
            segmentId: selectedSegmentId,
            isStoryMap: true
          },
        })
      );
    } else {
      // Regular map placement
      window.dispatchEvent(
        new CustomEvent("icon:startPlacement", {
          detail: { iconKey },
        })
      );
    }
  };

  const stopIconPlacement = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("icon:stopPlacement"));
  };

  const handleIconClick = (iconKey: string) => {
    // If onSelectIcon is provided, use it (LocationForm mode)
    if (onSelectIcon) {
      setSelectedId(iconKey);
      onSelectIcon(iconKey);
      return;
    }

    // Otherwise, dispatch placement event (sidebar mode)
    setSelectedId((prev) => {
      const next = prev === iconKey ? null : iconKey;
      if (next) {
        startIconPlacement(next);
      } else {
        stopIconPlacement();
      }
      return next;
    });
  };

  const handleAssetClick = (asset: UserAsset) => {
    const iconKey = `asset:${asset.id}`;

    // If onSelectIcon is provided, use it (LocationForm mode)
    if (onSelectIcon) {
      setSelectedId(iconKey);
      onSelectIcon(iconKey, asset.url);
      return;
    }

    // For StoryMap sidebar mode, require segment selection
    if (isStoryMap && !selectedSegmentId) {
      alert("Vui lòng chọn Segment trước khi tạo Location");
      return;
    }

    // Trigger icon placement with asset URL (sidebar mode)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("icon:startPlacement", {
          detail: {
            iconKey,
            iconUrl: asset.url,
            segmentId: selectedSegmentId,
            isStoryMap: isStoryMap
          },
        })
      );
    }
  };

  const categories: {
    title: string;
    items: { id: string; icon: string; label: string }[];
  }[] = [
    {
      title: "Travel & Movement",
      items: [
        { id: "plane", icon: "mdi:airplane", label: "Plane" },
        { id: "car", icon: "mdi:car", label: "Car" },
        { id: "bus", icon: "mdi:bus", label: "Bus" },
        { id: "train", icon: "mdi:train", label: "Train" },
        { id: "ship", icon: "mdi:ferry", label: "Ship" },
        { id: "bike", icon: "mdi:bike", label: "Bike" },
        { id: "walk", icon: "mdi:walk", label: "Walk" },
        { id: "route", icon: "mdi:routes", label: "Route" },
        { id: "from", icon: "mdi:map-marker-radius", label: "From" },
        { id: "to", icon: "mdi:map-marker-check", label: "To" },
      ],
    },
    {
      title: "Places & POI",
      items: [
        { id: "home", icon: "mdi:home-outline", label: "Home" },
        { id: "office", icon: "mdi:office-building-outline", label: "Office" },
        { id: "school", icon: "mdi:school-outline", label: "School" },
        { id: "hospital", icon: "mdi:hospital-building", label: "Hospital" },
        { id: "restaurant", icon: "mdi:silverware-fork-knife", label: "Food" },
        { id: "coffee", icon: "mdi:coffee-outline", label: "Coffee" },
        { id: "shop", icon: "mdi:storefront-outline", label: "Shop" },
        { id: "park", icon: "mdi:tree-outline", label: "Park" },
        { id: "museum", icon: "mdi:bank-outline", label: "Museum" },
        { id: "hotel", icon: "mdi:bed-outline", label: "Hotel" },
      ],
    },
    {
      title: "People & Events",
      items: [
        { id: "person", icon: "mdi:account", label: "Person" },
        { id: "group", icon: "mdi:account-group", label: "Group" },
        { id: "info", icon: "mdi:information-outline", label: "Info" },
        { id: "warning", icon: "mdi:alert-outline", label: "Warning" },
        { id: "danger", icon: "mdi:alert-octagon-outline", label: "Danger" },
        { id: "star", icon: "mdi:star-outline", label: "Highlight" },
        { id: "photo", icon: "mdi:image-outline", label: "Photo spot" },
        { id: "camera", icon: "mdi:camera-outline", label: "Camera" },
        { id: "note", icon: "mdi:note-text-outline", label: "Note" },
        { id: "chat", icon: "mdi:chat-outline", label: "Comment" },
      ],
    },
    {
      title: "Minerals & Resources",
      items: [
        { id: "gold", icon: "mdi:gold", label: "Gold" },
        { id: "diamond", icon: "mdi:diamond-stone", label: "Diamond" },
        { id: "crystal", icon: "mdi:diamond", label: "Crystal" },
        { id: "oil", icon: "mdi:oil", label: "Oil" },
        { id: "coal", icon: "mdi:cube-outline", label: "Coal" },
        { id: "iron", icon: "mdi:hammer-wrench", label: "Iron" },
        { id: "copper", icon: "mdi:lightning-bolt", label: "Copper" },
        { id: "silver", icon: "mdi:circle-outline", label: "Silver" },
        { id: "gem", icon: "mdi:sack", label: "Gem" },
        { id: "mine", icon: "mdi:pickaxe", label: "Mine" },
      ],
    },
    {
      title: "History & Landmarks",
      items: [
        { id: "mountain", icon: "mdi:terrain", label: "Mountain" },
        { id: "river", icon: "mdi:water", label: "River" },
        { id: "lake", icon: "mdi:water-circle", label: "Lake" },
        { id: "forest", icon: "mdi:tree", label: "Forest" },
        { id: "desert", icon: "mdi:weather-sunny", label: "Desert" },
        { id: "volcano", icon: "mdi:volcano", label: "Volcano" },
        { id: "island", icon: "mdi:island", label: "Island" },
        { id: "beach", icon: "mdi:beach", label: "Beach" },
        { id: "castle", icon: "mdi:castle", label: "Castle" },
        { id: "temple", icon: "mdi:temple-hindu", label: "Temple" },
        { id: "monument", icon: "mdi:monument", label: "Monument" },
        { id: "tomb", icon: "mdi:tombstone", label: "Tomb" },
        { id: "ruin", icon: "mdi:castle", label: "Ruin" },
        { id: "battlefield", icon: "mdi:sword", label: "Battlefield" },
        { id: "ancient-city", icon: "mdi:city-variant", label: "Ancient City" },
      ],
    },
  ];

  return (
    <div className="p-3 space-y-4 text-xs">
      {!onSelectIcon && (
        <div className="border-b border-zinc-800 pb-4">
          <p className="text-zinc-400 text-[11px]">
            Thư viện icon – hiện tại chỉ là UI chọn icon, chưa gắn logic tool hay map.
          </p>
        </div>
      )}

      {/* Segment Selector (StoryMap only) */}
      {isStoryMap && segments.length > 0 && !onSelectIcon && (
        <div className="pb-4 border-b border-zinc-800">
          <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-2 tracking-wide">
            Select Segment *
          </label>
          <select
            value={selectedSegmentId}
            onChange={(e) => setSelectedSegmentId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            {segments.map((segment) => (
              <option key={segment.segmentId} value={segment.segmentId}>
                {segment.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500 mt-1">
            Chọn segment để link location vào
          </p>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat.title} className="space-y-2">
          <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
            {cat.title}
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {cat.items.map((item) => {
              const isActive = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleIconClick(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 transition-all text-[10px]",
                    isActive
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                  )}
                  title={item.label}
                >
                  <Icon icon={item.icon} className="w-4 h-4" />
                  <span className="truncate w-full text-center">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* User Assets Section */}
      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
          Your Uploaded Assets
        </h4>
        {loadingAssets ? (
          <div className="text-center py-4 text-zinc-500 text-xs">Đang tải...</div>
        ) : userAssets.length === 0 ? (
          <div className="text-center py-4 text-zinc-500 text-xs">
            Chưa có asset nào. Upload ảnh ở tab Library.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {userAssets.map((asset) => {
              const iconKey = `asset:${asset.id}`;
              const isActive = selectedId === iconKey;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleAssetClick(asset)}
                  className={cn(
                    "group relative aspect-square bg-zinc-800 rounded border overflow-hidden transition-all",
                    isActive
                      ? "border-emerald-500 ring-2 ring-emerald-500/50"
                      : "border-zinc-700 hover:border-emerald-500"
                  )}
                  title={asset.name}
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className={cn(
                    "absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    <Icon icon="mdi:map-marker-plus" className="w-6 h-6 text-emerald-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
