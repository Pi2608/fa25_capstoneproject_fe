import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { UserAsset, getUserAssets, uploadUserAsset, deleteUserAsset } from "@/lib/api-library";

interface LibraryViewProps {
    onSelectAsset?: (asset: UserAsset) => void;
    initialTab?: "image" | "audio";
}

export function LibraryView({ onSelectAsset, initialTab = "image" }: LibraryViewProps) {
    const [activeTab, setActiveTab] = useState<"image" | "audio">(initialTab);
    const [assets, setAssets] = useState<UserAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadAssets();
    }, [activeTab]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const data = await getUserAssets(activeTab);
            setAssets(data);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const newAsset = await uploadUserAsset(file, activeTab);
            setAssets([newAsset, ...assets]);
        } catch (error) {
            console.error("Failed to upload asset:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa file này không?")) return;

        try {
            await deleteUserAsset(assetId);
            setAssets(assets.filter(a => a.id !== assetId));
        } catch (error) {
            console.error("Failed to delete asset:", error);
            alert("Failed to delete asset.");
        }
    };

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        // You might want to show a toast here
        alert("Copied URL to clipboard!");
    };

    return (
        <div className="h-full flex flex-col bg-zinc-900 text-white">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
                <button
                    onClick={() => setActiveTab("image")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === "image"
                        ? "border-emerald-500 text-emerald-500"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Icon icon="mdi:image" className="w-4 h-4" />
                        <span>IMAGES</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab("audio")}
                    className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === "audio"
                        ? "border-emerald-500 text-emerald-500"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Icon icon="mdi:music" className="w-4 h-4" />
                        <span>AUDIO</span>
                    </div>
                </button>
            </div>

            {/* Upload Area */}
            <div className="p-4 border-b border-zinc-800">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={activeTab === "image" ? "image/*" : "audio/*"}
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-dashed border-zinc-600 hover:border-zinc-500 transition-all flex items-center justify-center gap-2 text-xs"
                >
                    {uploading ? (
                        <span>Uploading...</span>
                    ) : (
                        <>
                            <Icon icon="mdi:upload" className="w-4 h-4" />
                            <span>Upload New {activeTab === "image" ? "Image" : "Audio"}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">Loading...</div>
                ) : assets.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">
                        No assets found. Upload one to get started.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {assets.map((asset) => (
                            <div
                                key={asset.id}
                                className="group relative bg-zinc-800 rounded border border-zinc-700 overflow-hidden hover:border-emerald-500/50 transition-colors"
                                role={onSelectAsset ? "button" : undefined}
                                onClick={onSelectAsset ? () => onSelectAsset(asset) : undefined}
                            >
                                {/* Preview */}
                                <div className="aspect-square bg-zinc-900 flex items-center justify-center overflow-hidden">
                                    {asset.type === "image" ? (
                                        <img
                                            src={asset.url}
                                            alt={asset.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Icon icon="mdi:music" className="w-8 h-8 text-zinc-600" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-2">
                                    <div className="text-[10px] text-zinc-300 truncate" title={asset.name}>
                                        {asset.name}
                                    </div>
                                    <div className="text-[9px] text-zinc-500 mt-0.5">
                                        {(asset.size / 1024).toFixed(1)} KB
                                    </div>
                                </div>

                                {/* Actions Overlay */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyUrl(asset.url);
                                        }}
                                        className="p-1.5 bg-zinc-900/90 text-zinc-300 hover:text-white rounded shadow-sm"
                                        title="Copy URL"
                                    >
                                        <Icon icon="mdi:content-copy" className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(asset.id);
                                        }}
                                        className="p-1.5 bg-zinc-900/90 text-red-400 hover:text-red-300 rounded shadow-sm"
                                        title="Delete"
                                    >
                                        <Icon icon="mdi:trash-can-outline" className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
