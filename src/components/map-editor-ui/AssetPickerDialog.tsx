"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/map-editor-ui/Icon";
import { LibraryView } from "@/components/map-editor-ui/LibraryView";
import { UserAsset } from "@/lib/api-library";
import { Segment } from "@/lib/api-storymap";

interface AssetPickerDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (asset: UserAsset) => void;
    initialTab?: "image" | "audio";
    title?: string;
    isStoryMap?: boolean;
    segments?: Segment[];
    mapId?: string;
    onCreateLocationFromAsset?: (asset: UserAsset, segmentId: string) => void;
}

export function AssetPickerDialog({
    open,
    onClose,
    onSelect,
    initialTab = "image",
    title = "Chọn Asset từ Library",
    isStoryMap = false,
    segments = [],
    mapId,
    onCreateLocationFromAsset,
}: AssetPickerDialogProps) {
    const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");

    // Auto-select first segment if available
    useEffect(() => {
        if (isStoryMap && segments.length > 0 && !selectedSegmentId) {
            setSelectedSegmentId(segments[0].segmentId);
        }
    }, [isStoryMap, segments, selectedSegmentId]);

    const handleCreateLocation = (asset: UserAsset) => {
        if (!onCreateLocationFromAsset) return;

        // For StoryMap, require segment selection
        if (isStoryMap && !selectedSegmentId) {
            alert("Vui lòng chọn Segment trước khi tạo Location");
            return;
        }

        onCreateLocationFromAsset(asset, selectedSegmentId);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-zinc-950 rounded-2xl ring-1 ring-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-lg font-semibold text-white">{title}</div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
                        >
                            <Icon icon="mdi:close" className="w-5 h-5" />
                        </button>
                    </div>

                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    <LibraryView
                        onSelectAsset={(asset) => {
                            onSelect(asset);
                            onClose();
                        }}
                        initialTab={initialTab}
                        isStoryMap={isStoryMap}
                        segments={segments}
                        mapId={mapId}
                        onCreateLocationFromAsset={onCreateLocationFromAsset ? handleCreateLocation : undefined}
                    />
                </div>
            </div>
        </div>
    );
}
