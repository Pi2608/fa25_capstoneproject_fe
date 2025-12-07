"use client";

import { Icon } from "@/components/map-editor-ui/Icon";
import { LibraryView } from "@/components/map-editor-ui/LibraryView";
import { UserAsset } from "@/lib/api-library";

interface AssetPickerDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (asset: UserAsset) => void;
    initialTab?: "image" | "audio";
    title?: string;
}

export function AssetPickerDialog({
    open,
    onClose,
    onSelect,
    initialTab = "image",
    title = "Chọn Asset từ Library",
}: AssetPickerDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-zinc-950 rounded-2xl ring-1 ring-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="text-lg font-semibold text-white">{title}</div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
                    >
                        <Icon icon="mdi:close" className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    <LibraryView
                        onSelectAsset={(asset) => {
                            onSelect(asset);
                            onClose();
                        }}
                        initialTab={initialTab}
                    />
                </div>
            </div>
        </div>
    );
}
