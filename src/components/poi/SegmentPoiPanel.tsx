"use client";

import { useEffect, useState } from "react";
import type { GeoJsonObject, Point, GeometryCollection } from "geojson";
import {
  getSegmentPois,
  createSegmentPoi,
  deletePoi,
  updatePoi,
  type SegmentPoi,
  type CreatePoiReq,
} from "@/lib/api";

type Props = { mapId: string; segmentId: string };

type SegmentPoiForm = {
  title: string;
  subtitle?: string;
  markerGeometry: GeoJsonObject | null;
  highlightOnEnter?: boolean;
  shouldPin?: boolean;
};

function isPoint(g: GeoJsonObject): g is Point {
  return g.type === "Point";
}

type PickedPointDetail = {
  lngLat: [number, number];
  geojson: GeoJsonObject;
};

type Mode = "create" | "edit";

function parseGeometry(input: unknown): GeoJsonObject | null {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as GeoJsonObject;
    } catch {
      return null;
    }
  }
  if (typeof input === "object") return input as GeoJsonObject;
  return null;
}

function readBool(obj: unknown, key: string): boolean {
  if (typeof obj === "object" && obj !== null && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
  }
  return false;
}

function extractLngLat(geom: GeoJsonObject | null): [number, number] | null {
  if (!geom) return null;
  if (geom.type === "Point") {
    const c = (geom as Point).coordinates;
    return [c[0], c[1]];
  }
  if (geom.type === "GeometryCollection") {
    const gc = geom as GeometryCollection;
    const p = gc.geometries.find((g) => g.type === "Point") as Point | undefined;
    if (p) {
      const c = p.coordinates;
      return [c[0], c[1]];
    }
  }
  return null;
}

export default function SegmentPoiPanel({ mapId, segmentId }: Props) {
  const [list, setList] = useState<SegmentPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [waitingPick, setWaitingPick] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SegmentPoiForm>({
    title: "",
    subtitle: "",
    markerGeometry: null,
    highlightOnEnter: false,
    shouldPin: false,
  });

  const validPoint =
    !!form.markerGeometry &&
    (isPoint(form.markerGeometry) || form.markerGeometry.type === "GeometryCollection");

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getSegmentPois(mapId, segmentId);
      setList(data ?? []);
    } catch {
      setError("Không thể tải POI của segment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [mapId, segmentId]);

  useEffect(() => {
    const onPicked = (e: Event) => {
      if (!waitingPick) return;
      const ev = e as CustomEvent<PickedPointDetail>;
      setWaitingPick(false);
      setForm((prev) => ({ ...prev, markerGeometry: ev.detail.geojson }));
      setDialogOpen(true);
    };
    window.addEventListener("poi:pointSelectedForSegment", onPicked as EventListener);
    return () =>
      window.removeEventListener("poi:pointSelectedForSegment", onPicked as EventListener);
  }, [waitingPick]);

  const resetForm = () =>
    setForm({
      title: "",
      subtitle: "",
      markerGeometry: null,
      highlightOnEnter: false,
      shouldPin: false,
    });

  const startAdd = () => {
    setDialogOpen(false);
    setError(null);
    setMode("create");
    setEditingId(null);
    resetForm();
    setWaitingPick(true);
    window.dispatchEvent(
      new CustomEvent("poi:startAddSegmentPoi", { detail: { mapId, segmentId } })
    );
  };

  const startEdit = (p: SegmentPoi) => {
    setError(null);
    setMode("edit");
    setEditingId(p.poiId);
    const geometry = parseGeometry((p as unknown as { markerGeometry?: unknown }).markerGeometry);
    const title = (p as unknown as { title?: string }).title ?? "";
    const subtitle = (p as unknown as { subtitle?: string }).subtitle ?? "";
    const highlightOnEnter = readBool(p, "highlightOnEnter");
    const shouldPin = readBool(p, "shouldPin");
    setForm({
      title,
      subtitle,
      markerGeometry: geometry,
      highlightOnEnter,
      shouldPin,
    });
    setDialogOpen(true);
  };

  const focusPoi = (p: SegmentPoi) => {
    const geom = parseGeometry((p as unknown as { markerGeometry?: unknown }).markerGeometry);
    const lngLat = extractLngLat(geom);
    if (!lngLat) return;
    window.dispatchEvent(
      new CustomEvent("poi:focusSegmentPoi", {
        detail: {
          mapId,
          segmentId,
          poiId: p.poiId,
          lngLat,
          zoom: 15,
        },
      })
    );
  };

  const pickAgain = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setWaitingPick(true);
      window.dispatchEvent(
        new CustomEvent("poi:startAddSegmentPoi", { detail: { mapId, segmentId } })
      );
    }, 0);
  };

  const submit = async () => {
    if (!validPoint) return;
    try {
      setBusy(true);
      const payload: CreatePoiReq = {
        title: form.title.trim(),
        subtitle: form.subtitle?.trim() || undefined,
        markerGeometry: JSON.stringify(form.markerGeometry),
        highlightOnEnter: !!form.highlightOnEnter,
        shouldPin: !!form.shouldPin,
      };
      if (mode === "edit" && editingId) {
        await updatePoi(editingId, payload);
      } else {
        await createSegmentPoi(mapId, segmentId, payload);
      }
      setDialogOpen(false);
      setEditingId(null);
      setMode("create");
      resetForm();
      await reload();
    } catch {
      setError(mode === "edit" ? "Cập nhật POI thất bại" : "Tạo POI segment thất bại");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (poiId: string) => {
    if (!confirm("Xoá POI này?")) return;
    try {
      setBusy(true);
      await deletePoi(poiId);
      await reload();
    } catch {
      setError("Xoá POI thất bại");
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="bg-zinc-900/85 text-white rounded-lg p-3 ring-1 ring-white/15">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/60">POIs của Segment</div>
        <button
          onClick={startAdd}
          className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          disabled={!segmentId || busy}
          title="Thêm POI cho segment"
        >
          + Thêm POI
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-white/60">Đang tải…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-white/60">Chưa có POI nào trong segment này</div>
      ) : (
        <ul className="space-y-1 max-h-[30vh] overflow-auto">
          {list.map((p) => (
            <li
              key={p.poiId}
              className="bg-white/5 rounded p-2 flex justify-between items-center cursor-pointer hover:bg-white/10"
              onClick={() => focusPoi(p)}
              title="Bấm để tới vị trí POI trên bản đồ"
            >
              <div>
                <div className="font-medium text-sm">
                  {(p as unknown as { title?: string }).title ?? ""}
                </div>
                {(p as unknown as { subtitle?: string }).subtitle && (
                  <div className="text-xs text-white/60">
                    {(p as unknown as { subtitle?: string }).subtitle}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    stop(e);
                    startEdit(p);
                  }}
                  className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
                  disabled={busy}
                >
                  Sửa
                </button>
                <button
                  onClick={(e) => {
                    stop(e);
                    void remove(p.poiId);
                  }}
                  className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-60"
                  disabled={busy}
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {waitingPick && (
        <div className="mt-2 text-xs text-amber-300">Đang chờ bạn chọn một điểm trên bản đồ…</div>
      )}

      {dialogOpen && (
        <SegmentPoiDialog
          mode={mode}
          open={dialogOpen}
          busy={busy}
          form={form}
          onClose={() => {
            setDialogOpen(false);
            setWaitingPick(false);
            setEditingId(null);
            setMode("create");
          }}
          onChange={setForm}
          onSubmit={submit}
          onPickAgain={pickAgain}
        />
      )}

      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
    </div>
  );
}

function SegmentPoiDialog({
  mode,
  open,
  busy,
  form,
  onClose,
  onSubmit,
  onChange,
  onPickAgain,
}: {
  mode: "create" | "edit";
  open: boolean;
  busy: boolean;
  form: SegmentPoiForm;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: SegmentPoiForm) => void;
  onPickAgain: () => void;
}) {
  const setField = <K extends keyof SegmentPoiForm>(k: K, v: SegmentPoiForm[K]) =>
    onChange({ ...form, [k]: v });

  const validPoint =
    !!form.markerGeometry &&
    (isPoint(form.markerGeometry) || form.markerGeometry.type === "GeometryCollection");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[460px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
            <div className="font-semibold">{mode === "edit" ? "Cập nhật POI" : "Thêm POI cho Segment"}</div>
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
              <label className="block text-white/60 mb-1">Phụ đề (tùy chọn)</label>
              <input
                value={form.subtitle ?? ""}
                onChange={(e) => setField("subtitle", e.target.value)}
                placeholder="VD: Điểm nhìn đẹp"
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.highlightOnEnter}
                  onChange={(e) => setField("highlightOnEnter", e.target.checked)}
                />
                <span className="text-white/80 text-sm">Highlight khi vào segment</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.shouldPin}
                  onChange={(e) => setField("shouldPin", e.target.checked)}
                />
                <span className="text-white/80 text-sm">Pin trên bản đồ</span>
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-white/60">Hình học</div>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                  type="button"
                  onClick={onPickAgain}
                  disabled={busy}
                >
                  Chọn lại trên bản đồ
                </button>
              </div>
              <textarea
                rows={6}
                className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
                readOnly
                value={form.markerGeometry ? JSON.stringify(form.markerGeometry, null, 2) : ""}
              />
              {validPoint ? (
                <div className="text-emerald-400 text-xs">GeoJSON hợp lệ</div>
              ) : (
                <div className="text-white/50 text-xs">Yêu cầu Point hoặc GeometryCollection chứa Point.</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onClose}>
              Hủy
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              onClick={onSubmit}
              disabled={!form.title.trim() || !validPoint || busy}
            >
              {busy ? "Đang lưu..." : mode === "edit" ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
