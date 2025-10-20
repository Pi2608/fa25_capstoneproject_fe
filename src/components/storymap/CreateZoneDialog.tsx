"use client";

import { useEffect, useState } from "react";
import type { GeoJsonObject as GJObject } from "geojson";

export type ZoneDraft = {
  geometry: GJObject;
  defaultName?: string;
};

export default function CreateZoneDialog({
  open,
  draft,
  busy,
  onCancel,
  onCreate,
}: {
  open: boolean;
  draft: ZoneDraft | null;
  busy?: boolean;
  onCancel: () => void;
  onCreate: (data: { name: string; description?: string; isPrimary: boolean; geometry: GJObject }) => void;
}) {
  const [name, setName] = useState(draft?.defaultName ?? "");
  const [desc, setDesc] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    setName(draft?.defaultName ?? "");
    setDesc("");
    setIsPrimary(false);
  }, [draft?.defaultName]);

  if (!open || !draft?.geometry) return null;

  return (
    <div className="fixed inset-0 z-[5000]">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[460px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold">Tạo Zone mới</div>
            <button className="text-white/60 hover:text-white" onClick={onCancel}>✕</button>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <div>
              <label className="block text-white/60 mb-1">Tên Zone</label>
              <input
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Vùng bờ tây sông Sài Gòn"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Mô tả</label>
              <textarea
                rows={2}
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ghi chú ngắn…"
              />
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
              <span className="text-white/80">Là Zone chính</span>
            </label>

            <div className="text-xs text-white/50">
              Hình học lấy từ nét vẽ (GeoJSON type: <b>{draft.geometry.type}</b>).
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>Hủy</button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              disabled={!name.trim() || busy}
              onClick={() => onCreate({ name: name.trim(), description: desc.trim() || undefined, isPrimary, geometry: draft.geometry })}
            >
              {busy ? "Đang tạo…" : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
