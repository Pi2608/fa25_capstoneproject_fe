"use client";

import React from "react";
import type { MapWithPM, BaseKey } from "../types/mapTypes";

interface MapToolbarProps {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  baseKey: BaseKey;
  setBaseKey: (key: BaseKey) => void;
  mapRef: React.RefObject<MapWithPM | null>;
  showFeaturePropertiesPanel: boolean;
  setShowFeaturePropertiesPanel: (show: boolean) => void;
  onSaveView: () => void;
  onClearSketch: () => void;
  onSaveMeta: () => void;
  busySaveView: boolean;
  busySaveMeta: boolean;
}

export default function MapToolbar({
  name,
  setName,
  description,
  setDescription,
  baseKey,
  setBaseKey,
  mapRef,
  showFeaturePropertiesPanel,
  setShowFeaturePropertiesPanel,
  onSaveView,
  onClearSketch,
  onSaveMeta,
  busySaveView,
  busySaveMeta,
}: MapToolbarProps) {
  const enableDraw = (shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text") => {
    mapRef.current?.pm.enableDraw(shape);
  };

  const enableCutPolygon = () => {
    mapRef.current?.pm.enableGlobalCutMode();
  };

  const toggleRotate = () => {
    mapRef.current?.pm.toggleGlobalRotateMode?.();
  };

  const GuardBtn: React.FC<
    React.PropsWithChildren<{ can: boolean; title: string; onClick?: () => void; disabled?: boolean }>
  > = ({ can, title, onClick, disabled, children }) => {
    if (!can) return null;
    return (
      <button
        className="px-3 py-2 rounded-md bg-transparent text-white text-sm hover:bg-emerald-500"
        title={title}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="absolute top-0 left-0 z-[3000] w-full pointer-events-none">
      <div className="pointer-events-auto bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl py-2 px-4">
        <div className="grid grid-cols-3 place-items-stretch gap-2">
          {/* Left Section - Map Info */}
          <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-56"
              placeholder="Tên bản đồ"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-2 rounded-md bg-white text-black text-sm font-medium w-72"
              placeholder="Mô tả (tuỳ chọn)"
            />
          </div>

          {/* Center Section - Drawing Tools */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowFeaturePropertiesPanel(!showFeaturePropertiesPanel)}
              className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center gap-2"
              title="Feature Properties"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Properties
            </button>

            <GuardBtn can={!!mapRef.current} title="Vẽ điểm" onClick={() => enableDraw("Marker")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                <circle cx="12" cy="11" r="2.5" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Vẽ đường" onClick={() => enableDraw("Line")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="7" r="2" />
                <circle cx="19" cy="17" r="2" />
                <path d="M7 8.5 17 15.5" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Vẽ vùng" onClick={() => enableDraw("Polygon")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Vẽ hình chữ nhật" onClick={() => enableDraw("Rectangle")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="6" width="14" height="12" rx="1.5" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Vẽ hình tròn" onClick={() => enableDraw("Circle")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8.5" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Thêm chữ" onClick={() => enableDraw("Text")}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M12 6v12" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Cắt polygon" onClick={enableCutPolygon}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5.5" cy="8" r="2" />
                <circle cx="5.5" cy="16" r="2" />
                <path d="M8 9l12 8M8 15l12-8" />
              </svg>
            </GuardBtn>

            <GuardBtn can={!!mapRef.current} title="Xoay đối tượng" onClick={toggleRotate}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11a8 8 0 1 1-2.2-5.5" />
                <path d="M20 4v7h-7" />
              </svg>
            </GuardBtn>
          </div>

          {/* Right Section - Settings & Save */}
          <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">Base</span>
              <select
                value={baseKey}
                onChange={(e) => setBaseKey(e.target.value as BaseKey)}
                className="px-2 py-2 rounded-md bg-white text-black text-sm"
              >
                <option value="osm">OSM</option>
                <option value="sat">Satellite</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <button
              className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
              onClick={onSaveView}
              disabled={busySaveView || !mapRef.current}
              title="Lưu tâm & zoom hiện tại"
            >
              {busySaveView ? "Đang lưu view…" : "Save view"}
            </button>

            <button
              className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-zinc-800 hover:bg-zinc-700"
              onClick={onClearSketch}
              disabled={!mapRef.current}
            >
              Xoá vẽ
            </button>

            <button
              className="rounded-xl px-3.5 py-2 text-sm font-semibold bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:opacity-60"
              onClick={onSaveMeta}
              disabled={busySaveMeta}
            >
              {busySaveMeta ? "Đang lưu…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
