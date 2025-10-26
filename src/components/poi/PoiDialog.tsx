"use client";

import { useEffect, useState } from "react";
import type { GeoJsonObject, Point } from "geojson";

export type PoiForm = {
  title: string;
  subtitle?: string;
  markerGeometry: GeoJsonObject | null; 
  displayOrder?: number;
  highlightOnEnter?: boolean;
  shouldPin?: boolean;
};

function isPoint(g: GeoJsonObject): g is Point {
  return g.type === "Point";
}

export default function PoiDialog({
  open,
  initial,
  editing = false,
  onCancel,
  onSubmit,
  onChange,
}: {
  open: boolean;
  initial: PoiForm;
  editing?: boolean;
  onCancel: () => void;
  onSubmit: (form: PoiForm) => void;
  onChange?: (form: PoiForm) => void;
}) {
  const [local, setLocal] = useState<PoiForm>(initial);

  useEffect(() => {
    setLocal(initial);
  }, [initial, open]);

  const setField = <K extends keyof PoiForm>(key: K, val: PoiForm[K]) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange?.(next);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as GeoJsonObject;
      setField("markerGeometry", json);
    } catch {
      alert("File không phải GeoJSON hợp lệ.");
    }
  };

  if (!open) return null;

  const validPoint =
    local.markerGeometry &&
    (isPoint(local.markerGeometry) || local.markerGeometry.type === "GeometryCollection");

  return (
    <div className="fixed inset-0 z-[5200]">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[460px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold">{editing ? "Sửa POI" : "Thêm POI"}</div>
            <button className="text-white/60 hover:text-white" onClick={onCancel}>✕</button>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <div>
              <label className="block text-white/60 mb-1">Tiêu đề</label>
              <input
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                value={local.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="VD: Cầu Sài Gòn"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Phụ đề (tuỳ chọn)</label>
              <input
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                value={local.subtitle ?? ""}
                onChange={(e) => setField("subtitle", e.target.value)}
                placeholder="VD: Điểm nhìn đẹp lúc hoàng hôn"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!local.highlightOnEnter}
                  onChange={(e) => setField("highlightOnEnter", e.target.checked)}
                />
                <span className="text-white/80 text-sm">Highlight khi vào segment</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!local.shouldPin}
                  onChange={(e) => setField("shouldPin", e.target.checked)}
                />
                <span className="text-white/80 text-sm">Pin trên bản đồ</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-white/60">Hình học (GeoJSON – thường là <b>Point</b>)</div>
                <input type="file" accept=".json,.geojson" onChange={handleUpload} className="text-xs" />
              </div>

              <textarea
                rows={6}
                className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
                placeholder='Ví dụ: {"type":"Point","coordinates":[106.73,10.80]}'
                value={local.markerGeometry ? JSON.stringify(local.markerGeometry, null, 2) : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  try {
                    setField("markerGeometry", v ? (JSON.parse(v) as GeoJsonObject) : null);
                  } catch {
                    // ignore typing while invalid
                  }
                }}
              />
              {validPoint ? (
                <div className="text-emerald-400 text-xs">✅ GeoJSON hợp lệ</div>
              ) : (
                <div className="text-white/50 text-xs">Yêu cầu Point hoặc GeometryCollection chứa Point.</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
              Hủy
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              disabled={!local.title.trim() || !validPoint}
              onClick={() => onSubmit(local)}
            >
              {editing ? "Lưu thay đổi" : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
