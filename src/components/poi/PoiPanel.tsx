"use client";

import { useEffect, useState } from "react";
import type React from "react";
import {
  getMapPois,
  createMapPoi,
  deletePoi,
  updatePoi,
  type CreatePoiReq,
} from "@/lib/api";
import type { GeoJsonObject, Point, GeometryCollection } from "geojson";

type MapPoi = {
  poiId: string;
  mapId: string;
  title: string;
  subtitle?: string;
  markerGeometry: string;
  highlightOnEnter?: boolean;
  shouldPin?: boolean;
  createdAt?: string;
};

type Props = { mapId: string };

function extractLngLatFromGeometryString(s: string): [number, number] | null {
  if (!s) return null;
  try {
    const g = JSON.parse(s) as GeoJsonObject;
    if (g.type === "Point") {
      const c = (g as Point).coordinates;
      return [Number(c[0]), Number(c[1])];
    }
    if (g.type === "GeometryCollection") {
      const gc = g as GeometryCollection;
      const p = gc.geometries.find((x) => x.type === "Point") as Point | undefined;
      if (p) {
        const c = p.coordinates;
        return [Number(c[0]), Number(c[1])];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default function MapPoiPanel({ mapId }: Props) {
  const [pois, setPois] = useState<MapPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePoiReq>({
    title: "",
    subtitle: "",
    markerGeometry: "",
    highlightOnEnter: false,
    shouldPin: false,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = (await getMapPois(mapId)) as unknown as MapPoi[];
        setPois(data ?? []);
      } catch {
        setError("Không thể tải POI của bản đồ");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [mapId]);

  const refresh = async () => {
    const data = (await getMapPois(mapId)) as unknown as MapPoi[];
    setPois(data ?? []);
  };

  const openCreate = () => {
    setEditingPoiId(null);
    setForm({
      title: "",
      subtitle: "",
      markerGeometry: "",
      highlightOnEnter: false,
      shouldPin: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (p: MapPoi) => {
    setEditingPoiId(p.poiId);
    setForm({
      title: p.title,
      subtitle: p.subtitle ?? "",
      markerGeometry: p.markerGeometry ?? "",
      highlightOnEnter: !!p.highlightOnEnter,
      shouldPin: !!p.shouldPin,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      setBusy(true);
      if (editingPoiId) {
        await updatePoi(editingPoiId, form);
      } else {
        await createMapPoi(mapId, form);
      }
      await refresh();
      setDialogOpen(false);
      setEditingPoiId(null);
      setForm({
        title: "",
        subtitle: "",
        markerGeometry: "",
        highlightOnEnter: false,
        shouldPin: false,
      });
    } catch {
      setError(editingPoiId ? "Cập nhật POI thất bại" : "Tạo POI thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (poiId: string): Promise<void> => {
    if (!confirm("Xoá POI này?")) return;
    try {
      setBusy(true);
      await deletePoi(poiId);
      await refresh();
    } catch {
      setError("Xoá POI thất bại");
    } finally {
      setBusy(false);
    }
  };

  const focusPoi = (p: MapPoi) => {
    const lngLat = extractLngLatFromGeometryString(p.markerGeometry);
    if (!lngLat) return;
    window.dispatchEvent(
      new CustomEvent("poi:focusMapPoi", {
        detail: {
          mapId,
          poiId: p.poiId,
          lngLat,           // [lng, lat]
          zoom: 15,         // zoom vừa phải, có thể đổi
        },
      })
    );
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="bg-zinc-900/85 text-white rounded-lg p-3 mt-2 ring-1 ring-white/15">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-white/60">POIs của Map</div>
        <button
          onClick={openCreate}
          className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
        >
          + Thêm POI
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-white/60">Đang tải…</div>
      ) : pois.length === 0 ? (
        <div className="text-sm text-white/60">Chưa có POI nào trong bản đồ</div>
      ) : (
        <ul className="space-y-1 max-h-[30vh] overflow-auto">
          {pois.map((p) => (
            <li
              key={p.poiId}
              className="bg-white/5 rounded p-2 flex justify-between items-center cursor-pointer hover:bg-white/10"
              title="Bấm để tới vị trí POI trên bản đồ"
              onClick={() => focusPoi(p)}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{p.title}</div>
                {p.subtitle && (
                  <div className="text-xs text-white/60 truncate">{p.subtitle}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    stop(e);
                    openEdit(p);
                  }}
                  className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                >
                  Sửa
                </button>
                <button
                  onClick={(e) => {
                    stop(e);
                    void handleDelete(p.poiId);
                  }}
                  className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500"
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen && (
        <AddPoiDialog
          open={dialogOpen}
          busy={busy}
          form={form}
          titleText={editingPoiId ? "Sửa POI" : "Thêm POI"}
          submitLabel={busy ? "Đang lưu..." : editingPoiId ? "Cập nhật" : "Tạo mới"}
          onClose={() => {
            setDialogOpen(false);
            setEditingPoiId(null);
          }}
          onChange={(f) => setForm(f)}
          onSubmit={() => void handleSubmit()}
        />
      )}

      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
    </div>
  );
}

function AddPoiDialog({
  open,
  busy,
  form,
  titleText,
  submitLabel,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  busy: boolean;
  form: CreatePoiReq;
  titleText: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: CreatePoiReq) => void;
}) {
  const setField = <K extends keyof CreatePoiReq>(key: K, val: CreatePoiReq[K]) => {
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
      <div className="relative bg-zinc-900 rounded-xl text-white w-[460px] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
          <div className="font-semibold">{titleText}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-white/60 mb-1">Tiêu đề</label>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="VD: Cầu Sài Gòn"
              className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
            />
          </div>

          <div>
            <label className="block text-white/60 mb-1">Phụ đề</label>
            <input
              value={form.subtitle ?? ""}
              onChange={(e) => setField("subtitle", e.target.value)}
              placeholder="VD: Điểm nhìn đẹp lúc hoàng hôn"
              className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.highlightOnEnter ?? false}
                onChange={(e) => setField("highlightOnEnter", e.target.checked)}
              />
              Highlight khi vào bản đồ
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.shouldPin ?? false}
                onChange={(e) => setField("shouldPin", e.target.checked)}
              />
              Pin trên bản đồ
            </label>
          </div>

          <div>
            <label className="block text-white/60 mb-1">Hình học GeoJSON</label>
            <input type="file" accept=".json,.geojson" onChange={handleFileUpload} />
            <textarea
              rows={5}
              value={form.markerGeometry ?? ""}
              onChange={(e) => setField("markerGeometry", e.target.value)}
              placeholder='{"type":"Point","coordinates":[106.73,10.80]}'
              className="w-full mt-2 rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onClose}>
              Hủy
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              onClick={onSubmit}
              disabled={!form.title.trim() || !form.markerGeometry || busy}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
