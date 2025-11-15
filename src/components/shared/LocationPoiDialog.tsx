"use client";

import React, { useState, useEffect, useRef } from "react";
import type { GeoJsonObject } from "geojson";
import type {
    LocationPoiDialogForm,
    LocationPoiDialogMode,
} from "@/types";

export type LocationPoiDialogProps = {
    open: boolean;
    busy?: boolean;
    mode: LocationPoiDialogMode;
    form: LocationPoiDialogForm;
    titleText?: string;
    submitLabel?: string;
    isPickingLocation?: boolean;
    currentMap?: any;
    onPickLocation?: () => void;

    onClose: () => void;
    onSubmit: () => void;
    onChange: (form: LocationPoiDialogForm) => void;
};

export default function LocationPoiDialog({
    open,
    busy = false,
    mode,
    form,
    titleText = mode === "location" ? "Tạo Location" : "Tạo POI",
    submitLabel = busy ? "Đang lưu..." : "Tạo mới",
    isPickingLocation = false,
    currentMap,
    onPickLocation,
    onClose,
    onSubmit,
    onChange,
}: LocationPoiDialogProps) {
    const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
    const [tempMarker, setTempMarker] = useState<any>(null);

    const hasLocation = !!form.markerGeometry;
    const isLocationMode = mode === "location";
    useEffect(() => {
        if (!currentMap || mode !== "location" || !open || hasLocation) return;

        const handleMapClick = async (e: any) => {
            const { lat, lng } = e.latlng;
            setSelectedPoint([lat, lng]);

            const L = (await import("leaflet")).default;

            if (tempMarker) {
                currentMap.removeLayer(tempMarker);
            }

            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: "temp-location-marker",
                    html: `<div style="
            font-size: 32px;
            text-align: center;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          ">📍</div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                }),
            });
            marker.addTo(currentMap);
            setTempMarker(marker);

            const geoJson = {
                type: "Point",
                coordinates: [lng, lat], // [lng, lat]
            };
            onChange({
                ...form,
                markerGeometry: JSON.stringify(geoJson),
            });
        };

        currentMap.on("click", handleMapClick);

        return () => {
            currentMap.off("click", handleMapClick);
            if (tempMarker) {
                currentMap.removeLayer(tempMarker);
            }
        };
    }, [currentMap, mode, open, hasLocation, tempMarker, form, onChange]);

    useEffect(() => {
        if (!open && tempMarker && currentMap) {
            currentMap.removeLayer(tempMarker);
            setTempMarker(null);
        }
    }, [open, tempMarker, currentMap]);

    const setField = <K extends keyof LocationPoiDialogForm>(
        key: K,
        val: LocationPoiDialogForm[K]
    ) => {
        onChange({ ...form, [key]: val });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text) as GeoJsonObject;
            setField("markerGeometry", JSON.stringify(json));
        } catch {
            alert("File không hợp lệ hoặc không phải JSON!");
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-zinc-900 rounded-xl text-white w-[600px] max-h-[90vh] shadow-2xl ring-1 ring-white/10 flex flex-col">
                <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
                    <div className="font-semibold">{titleText}</div>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                    {/* Location Selection */}
                    <div>
                        <label className="block text-white/60 mb-2">Vị trí trên bản đồ *</label>
                        {hasLocation ? (
                            <div className="bg-emerald-900/20 border border-emerald-500/50 rounded p-3 mb-2">
                                <p className="text-emerald-300 text-xs mb-1">✅ Đã chọn vị trí</p>
                                <textarea
                                    rows={3}
                                    value={form.markerGeometry}
                                    readOnly
                                    className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
                                />
                            </div>
                        ) : (
                            <div className="bg-blue-900/20 border border-blue-500/50 rounded p-3 mb-2">
                                <p className="text-blue-300 text-xs mb-2">
                                    {isPickingLocation
                                        ? "🔄 Đang chờ bạn chọn vị trí trên bản đồ..."
                                        : isLocationMode
                                            ? "🗺️ Click trên bản đồ để chọn vị trí"
                                            : "🗺️ Chưa chọn vị trí"}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            {isLocationMode && !hasLocation ? (
                                <div className="text-xs text-blue-400 animate-pulse">
                                    📍 Đã bật chế độ chọn vị trí - Click trên bản đồ để chọn
                                </div>
                            ) : !isLocationMode && onPickLocation ? (
                                <button
                                    type="button"
                                    onClick={onPickLocation}
                                    disabled={isPickingLocation || busy}
                                    className={`px-3 py-1.5 rounded text-xs ${isPickingLocation
                                            ? "bg-yellow-600 text-white"
                                            : "bg-blue-600 hover:bg-blue-500 text-white"
                                        } disabled:opacity-50`}
                                >
                                    {isPickingLocation ? "Đang chọn..." : "Chọn trên bản đồ"}
                                </button>
                            ) : null}
                            <input
                                type="file"
                                accept=".json,.geojson"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="geojson-upload"
                            />
                            <label
                                htmlFor="geojson-upload"
                                className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs cursor-pointer"
                            >
                                Tải file GeoJSON
                            </label>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div>
                        <label className="block text-white/60 mb-1">Tiêu đề *</label>
                        <input
                            value={form.title}
                            onChange={(e) => setField("title", e.target.value)}
                            placeholder="VD: Cầu Sài Gòn"
                            className="w-full rounded bg-zinc-800 px-3 py-2 outline-none text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-white/60 mb-1">Phụ đề</label>
                        <input
                            value={form.subtitle ?? ""}
                            onChange={(e) => setField("subtitle", e.target.value)}
                            placeholder="VD: Điểm nhìn đẹp lúc hoàng hôn"
                            className="w-full rounded bg-zinc-800 px-3 py-2 outline-none text-white"
                        />
                    </div>

                    {/* Description (Location) or Story Content (POI) */}
                    {isLocationMode ? (
                        <div>
                            <label className="block text-white/60 mb-1">Mô tả</label>
                            <textarea
                                value={form.description || ""}
                                onChange={(e) => setField("description", e.target.value)}
                                rows={3}
                                placeholder="Mô tả về địa điểm này..."
                                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-white/60 mb-1">Nội dung câu chuyện</label>
                            <textarea
                                value={form.storyContent || ""}
                                onChange={(e) => setField("storyContent", e.target.value)}
                                rows={3}
                                placeholder="Mô tả về địa điểm này..."
                                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                            />
                        </div>
                    )}

                    {/* Location Type */}
                    <div>
                        <label className="block text-white/60 mb-2">Loại vị trí</label>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { value: "PointOfInterest", label: "POI" },
                                { value: "MediaSpot", label: "Media" },
                                { value: "TextOnly", label: "Text" },
                                { value: "Line", label: "Line" },
                                { value: "Polygon", label: "Polygon" },
                                { value: "Custom", label: "Custom" },
                            ] as const).map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setField("locationType", type.value)}
                                    className={`px-3 py-2 rounded text-xs ${form.locationType === type.value
                                            ? "bg-emerald-600 text-white"
                                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Icon Styling (Location only) */}
                    {isLocationMode && (
                        <div className="border-t border-zinc-700 pt-4">
                            <h3 className="text-sm font-medium text-zinc-300 mb-3">Icon Styling</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white/60 mb-1">Icon</label>
                                    <input
                                        type="text"
                                        value={form.iconType || "📍"}
                                        onChange={(e) => setField("iconType", e.target.value)}
                                        className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-center text-2xl"
                                        placeholder="📍"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/60 mb-1">Color</label>
                                    <input
                                        type="color"
                                        value={form.iconColor || "#FF0000"}
                                        onChange={(e) => setField("iconColor", e.target.value)}
                                        className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="mt-2">
                                <label className="block text-white/60 mb-1">
                                    Icon Size: {form.iconSize || 32}px
                                </label>
                                <input
                                    type="range"
                                    min="16"
                                    max="64"
                                    value={form.iconSize || 32}
                                    onChange={(e) => setField("iconSize", parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Display Settings */}
                    <div className="border-t border-zinc-700 pt-4">
                        <h3 className="text-sm font-medium text-zinc-300 mb-3">Cài đặt hiển thị</h3>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.highlightOnEnter ?? false}
                                    onChange={(e) => setField("highlightOnEnter", e.target.checked)}
                                />
                                <span className="text-sm text-zinc-300">Highlight khi vào</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.isVisible ?? true}
                                    onChange={(e) => setField("isVisible", e.target.checked)}
                                />
                                <span className="text-sm text-zinc-300">Hiển thị</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-zinc-400 mb-1 text-xs">Z-Index</label>
                                <input
                                    type="number"
                                    value={form.zIndex ?? 100}
                                    onChange={(e) => setField("zIndex", parseInt(e.target.value) || 0)}
                                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 mb-1 text-xs">Thứ tự hiển thị</label>
                                <input
                                    type="number"
                                    value={form.displayOrder ?? 0}
                                    onChange={(e) => setField("displayOrder", parseInt(e.target.value) || 0)}
                                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tooltip */}
                    <div>
                        <label className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={form.showTooltip ?? true}
                                onChange={(e) => setField("showTooltip", e.target.checked)}
                            />
                            <span className="text-sm font-medium text-zinc-300">
                                Hiển thị Tooltip (Rich HTML)
                            </span>
                        </label>
                        {form.showTooltip && (
                            <div className="space-y-2">
                                <RichHTMLEditor
                                    value={form.tooltipContent || ""}
                                    onChange={(html) => setField("tooltipContent", html)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Popup (Location) or Slide (POI) */}
                    {isLocationMode ? (
                        <div>
                            <label className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    checked={form.openPopupOnClick ?? false}
                                    onChange={(e) => setField("openPopupOnClick", e.target.checked)}
                                />
                                <span className="text-sm font-medium text-zinc-300">
                                    Mở Popup khi click (Rich HTML)
                                </span>
                            </label>
                            {form.openPopupOnClick && (
                                <div className="space-y-2">
                                    <RichHTMLEditor
                                        value={form.popupContent || ""}
                                        onChange={(html) => setField("popupContent", html)}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    checked={form.openSlideOnClick ?? false}
                                    onChange={(e) => setField("openSlideOnClick", e.target.checked)}
                                />
                                <span className="text-sm font-medium text-zinc-300">
                                    Mở Slide khi click (Rich HTML)
                                </span>
                            </label>
                            {form.openSlideOnClick && (
                                <div className="space-y-2">
                                    <RichHTMLEditor
                                        value={form.slideContent || ""}
                                        onChange={(html) => setField("slideContent", html)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio */}
                    <div>
                        <label className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={form.playAudioOnClick ?? false}
                                onChange={(e) => setField("playAudioOnClick", e.target.checked)}
                            />
                            <span className="text-sm font-medium text-zinc-300">Phát Audio khi click</span>
                        </label>
                        {form.playAudioOnClick && (
                            <input
                                type="url"
                                value={form.audioUrl || ""}
                                onChange={(e) => setField("audioUrl", e.target.value)}
                                placeholder="https://example.com/audio.mp3"
                                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                            />
                        )}
                    </div>

                    {/* External URL */}
                    <div>
                        <label className="block text-white/60 mb-1">External URL</label>
                        <input
                            type="url"
                            value={form.externalUrl || ""}
                            onChange={(e) => setField("externalUrl", e.target.value)}
                            placeholder="https://example.com"
                            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                        />
                    </div>

                    {/* Media Resources */}
                    {isLocationMode ? (
                        <div>
                            <label className="block text-white/60 mb-1">Media URLs</label>
                            <textarea
                                value={form.mediaUrls || ""}
                                onChange={(e) => setField("mediaUrls", e.target.value)}
                                rows={2}
                                placeholder="URLs của hình ảnh, video... (mỗi URL một dòng)"
                                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-white/60 mb-1">Tài nguyên Media</label>
                            <textarea
                                value={form.mediaResources || ""}
                                onChange={(e) => setField("mediaResources", e.target.value)}
                                rows={2}
                                placeholder="URLs của hình ảnh, video... (mỗi URL một dòng)"
                                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none"
                            />
                        </div>
                    )}
                    {/* Animation Configuration */}
                    <div className="border-t border-zinc-700 pt-4">
                        <h3 className="text-sm font-medium text-zinc-300 mb-3">⚡ Animation Effects</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-white/60 mb-1 text-xs">Entry Effect</label>
                                <select
                                    value={form.entryEffect || "fade"}
                                    onChange={(e) => setField("entryEffect", e.target.value)}
                                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm"
                                >
                                    <option value="none">None</option>
                                    <option value="fade">Fade</option>
                                    <option value="scale">Scale</option>
                                    <option value="slide-up">Slide Up</option>
                                    <option value="bounce">Bounce</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-white/60 mb-1 text-xs">Exit Effect</label>
                                <select
                                    value={form.exitEffect || "fade"}
                                    onChange={(e) => setField("exitEffect", e.target.value)}
                                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white text-sm"
                                >
                                    <option value="none">None</option>
                                    <option value="fade">Fade</option>
                                    <option value="scale">Scale</option>
                                    <option value="slide-down">Slide Down</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                                <label className="block text-white/60 mb-1 text-xs">
                                    Entry Delay: {form.entryDelayMs || 0}ms
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2000"
                                    step="100"
                                    value={form.entryDelayMs || 0}
                                    onChange={(e) => setField("entryDelayMs", parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-white/60 mb-1 text-xs">
                                    Entry Duration: {form.entryDurationMs || 400}ms
                                </label>
                                <input
                                    type="range"
                                    min="100"
                                    max="2000"
                                    step="100"
                                    value={form.entryDurationMs || 400}
                                    onChange={(e) => setField("entryDurationMs", parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10">
                    <button
                        className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Hủy
                    </button>
                    <button
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white"
                        onClick={onSubmit}
                        disabled={!form.title.trim() || !form.markerGeometry || busy}
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Rich HTML Editor Component
function RichHTMLEditor({
    value,
    onChange,
}: {
    value: string;
    onChange: (html: string) => void;
}) {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    return (
        <div className="border border-zinc-700 rounded overflow-hidden">
            {/* Toolbar */}
            <div className="bg-zinc-800 border-b border-zinc-700 p-2 flex gap-1 flex-wrap">
                <button
                    type="button"
                    onClick={() => document.execCommand("bold")}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                    title="Bold (Ctrl+B)"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onClick={() => document.execCommand("italic")}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                    title="Italic (Ctrl+I)"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    onClick={() => document.execCommand("underline")}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                    title="Underline (Ctrl+U)"
                >
                    <u>U</u>
                </button>
                <div className="w-px bg-zinc-600 mx-1"></div>
                <button
                    type="button"
                    onClick={() => {
                        const url = prompt("Enter URL:");
                        if (url) document.execCommand("createLink", false, url);
                    }}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                    title="Insert Link"
                >
                    🔗
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    document.execCommand(
                                        "insertImage",
                                        false,
                                        event.target?.result as string
                                    );
                                };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                    }}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                    title="Insert Image"
                >
                    🖼️
                </button>
            </div>
            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                onPaste={(e) => {
                    // Handle image paste
                    const items = e.clipboardData.items;
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf("image") !== -1) {
                            e.preventDefault();
                            const blob = items[i].getAsFile();
                            if (blob) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = `<img src="${event.target?.result}" style="max-width: 100%; height: auto;" />`;
                                    document.execCommand("insertHTML", false, img);
                                };
                                reader.readAsDataURL(blob);
                            }
                            break;
                        }
                    }
                }}
                className="w-full min-h-[100px] px-3 py-2 bg-zinc-900 text-white text-sm outline-none"
                style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
            />
            <p className="text-xs text-zinc-500 px-2 py-1">
                💡 Bạn có thể dán hình ảnh trực tiếp (Ctrl+V) hoặc dùng nút 🖼️
            </p>
        </div>
    );
}

