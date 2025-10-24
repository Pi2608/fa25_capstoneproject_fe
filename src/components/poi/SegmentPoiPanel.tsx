"use client";

import { useEffect, useState } from "react";
import type { GeoJsonObject, Point } from "geojson";
import {
  getSegmentPois,
  createSegmentPoi,
  deletePoi,
  type SegmentPoi,
  type CreatePoiReq,
} from "@/lib/api";

type Props = {
  mapId: string;
  segmentId: string;
};

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
  geojson: GeoJsonObject; // thường là Feature<Point> hoặc Point
};

export default function SegmentPoiPanel({ mapId, segmentId }: Props) {
  const [list, setList] = useState<SegmentPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [waitingPick, setWaitingPick] = useState(false);
  const [form, setForm] = useState<SegmentPoiForm>({
    title: "",
    subtitle: "",
    markerGeometry: null,
    highlightOnEnter: false,
    shouldPin: false,
  });

  const validPoint =
    form.markerGeometry &&
    (isPoint(form.markerGeometry) ||
      form.markerGeometry.type === "GeometryCollection");

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getSegmentPois(mapId, segmentId);
      setList(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [mapId, segmentId]);

  // nhận tọa độ sau khi user click lên map
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

  const startPickOnMap = () => {
    setWaitingPick(true);
    window.dispatchEvent(
      new CustomEvent("poi:startAddSegmentPoi", { detail: { mapId, segmentId } })
    );
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
      await createSegmentPoi(mapId, segmentId, payload);
      setDialogOpen(false);
      setForm({
        title: "",
        subtitle: "",
        markerGeometry: null,
        highlightOnEnter: false,
        shouldPin: false,
      });
      await reload();
    } catch {
      setError("Tạo POI segment thất bại");
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

  return (
    <div className="bg-zinc-900/85 text-white rounded-lg p-3 ring-1 ring-white/15">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/60">POIs của Segment</div>
        <button
          onClick={startPickOnMap}
          className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          disabled={!segmentId || busy}
          title="Thêm POI cho segment (chọn vị trí rồi lưu)"
        >
          + Vẽ điểm
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-white/60">Đang tải…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-white/60">Chưa có POI nào trong segment này</div>
      ) : (
        <ul className="space-y-1 max-h-[30vh] overflow-auto">
          {list.map((p) => (
            <li key={p.poiId} className="bg-white/5 rounded p-2 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{p.title}</div>
                {p.subtitle && <div className="text-xs text-white/60">{p.subtitle}</div>}
              </div>
              <button
                onClick={() => void remove(p.poiId)}
                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500"
              >
                Xoá
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen && (
        <SegmentPoiDialog
          open={dialogOpen}
          busy={busy}
          form={form}
          onClose={() => setDialogOpen(false)}
          onChange={setForm}
          onSubmit={submit}
        />
      )}

      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
    </div>
  );
}

function SegmentPoiDialog({
  open,
  busy,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  busy: boolean;
  form: SegmentPoiForm;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: SegmentPoiForm) => void;
}) {
  const setField = <K extends keyof SegmentPoiForm>(k: K, v: SegmentPoiForm[K]) =>
    onChange({ ...form, [k]: v });

  const validPoint =
    form.markerGeometry &&
    (isPoint(form.markerGeometry) ||
      form.markerGeometry.type === "GeometryCollection");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[460px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
            <div className="font-semibold">Thêm POI cho Segment</div>
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
              <div className="text-white/60">Hình học (tự điền từ điểm vừa click)</div>
              <textarea
                rows={6}
                className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
                readOnly
                value={form.markerGeometry ? JSON.stringify(form.markerGeometry, null, 2) : ""}
              />
              {validPoint ? (
                <div className="text-emerald-400 text-xs">✅ GeoJSON hợp lệ</div>
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
              {busy ? "Đang lưu..." : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
