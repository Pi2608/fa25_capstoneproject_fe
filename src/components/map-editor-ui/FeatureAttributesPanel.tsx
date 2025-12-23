"use client";

import { useState, useEffect } from "react";
import { Icon } from "./Icon";
import type { FeatureData } from "@/utils/mapUtils";

interface FeatureAttributesPanelProps {
    feature: FeatureData | null;
    isOpen: boolean;
    onClose: () => void;
}

export function FeatureAttributesPanel({
    feature,
    isOpen,
    onClose,
}: FeatureAttributesPanelProps) {
    const [customAttributes, setCustomAttributes] = useState<Record<string, string>>({});
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [featureType, setFeatureType] = useState("");

    // Load custom attributes from feature when it changes
    useEffect(() => {
        if (!feature) {
            setCustomAttributes({});
            setName("");
            setDescription("");
            setFeatureType("");
            return;
        }

        setName(feature.name || "");
        setDescription(feature.description || "");
        setFeatureType(feature.type || "");

        // Load properties (custom attributes only)
        if (feature.layer?.feature?.properties) {
            const props = feature.layer.feature.properties;
            const customProps: Record<string, string> = {};

            // If props is a string, try to parse
            let parsedProps = props;
            if (typeof props === 'string') {
                try {
                    parsedProps = JSON.parse(props);
                } catch (e) {
                    console.warn('Failed to parse properties string:', e);
                    parsedProps = {};
                }
            }

            Object.keys(parsedProps).forEach((key) => {
                // Exclude standard fields
                if (!["name", "description", "zIndex"].includes(key)) {
                    customProps[key] = String(parsedProps[key]);
                }
            });
            setCustomAttributes(customProps);
        } else {
            setCustomAttributes({});
        }
    }, [feature]);

    if (!isOpen || !feature) return null;

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[1600] w-80 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <Icon icon="mdi:information-outline" className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">Thông tin Feature</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-700 rounded transition-colors"
                    title="Đóng"
                >
                    <Icon icon="mdi:close" className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="space-y-2">
                    <div>
                        <span className="text-xs text-zinc-400 block mb-0.5">Tên</span>
                        <span className="text-sm text-zinc-200 font-medium">{name || "Không có tên"}</span>
                    </div>

                    <div>
                        <span className="text-xs text-zinc-400 block mb-0.5">Loại</span>
                        <span className="text-sm text-zinc-300">{featureType || "Không xác định"}</span>
                    </div>

                    {description && (
                        <div>
                            <span className="text-xs text-zinc-400 block mb-0.5">Mô tả</span>
                            <p className="text-sm text-zinc-300">{description}</p>
                        </div>
                    )}
                </div>

                {/* Custom Attributes */}
                <div className="border-t border-zinc-700 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon icon="mdi:tag-multiple" className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-medium text-zinc-300">Thuộc tính tùy chỉnh</h4>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(customAttributes).length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Chưa có thuộc tính tùy chỉnh.</p>
                        ) : (
                            Object.entries(customAttributes).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2 bg-zinc-800 rounded p-2 hover:bg-zinc-750 transition-colors">
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <span className="text-xs text-zinc-400 font-medium truncate">{key}</span>
                                        <span className="text-xs text-zinc-200 truncate">{value}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
