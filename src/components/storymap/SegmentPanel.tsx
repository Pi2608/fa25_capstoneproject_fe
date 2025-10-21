"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSegments,
  getSegmentZones,
  createSegment,
  updateSegment,
  deleteSegment,
  deleteSegmentZone,
  createSegmentZone,
  updateSegmentZone,
} from "@/lib/api";
import type {
  Segment,
  SegmentZone,
  CreateSegmentZoneReq,
  UpdateSegmentZoneReq,
} from "@/lib/api";
import SegmentPoiPanel from "@/components/poi/SegmentPoiPanel";
import ZoneContextMenu, { LayerPickerDialog } from "@/components/map/ZoneContextMenu";
import PoiPanel from "@/components/poi/PoiPanel";

import type {
  GeoJsonObject,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";


type LayerLite = { id: string; name: string };

type Props = {
  mapId: string;
  layers?: LayerLite[];
  currentLayerId?: string;
  onZoomZone?: (zone: SegmentZone) => void;
  onCopyZoneToExistingLayer?: (zone: SegmentZone, layerId: string) => void;
  onCopyZoneToNewLayer?: (zone: SegmentZone) => void;
};

type MaybeGeom = {
  geometry?: unknown;
  zoneGeometry?: unknown;
  displayOrder?: unknown;
  description?: unknown;
};

type ZoneEventDetail = {
  mapId: string;
  segmentId: string;
  zone: SegmentZone;
  geometry?: GeoJsonObject | null;
  layerId?: string;
};

type ZoneForm = {
  name: string;
  description?: string;
  zoneType: "area" | "line" | "point";
  isPrimary: boolean;
  displayOrder?: number;
  zoneGeometry: GeoJsonObject | null;
};

type ServerSegmentZone = SegmentZone & {
  name?: string | null;
  description?: string | null;
  zoneGeometry?: unknown;
  displayOrder?: number | null;
  isPrimary?: boolean | null;
};


function isPoint(g: GeoJsonObject): g is Point {
  return g.type === "Point";
}
function isLineString(g: GeoJsonObject): g is LineString {
  return g.type === "LineString";
}
function isPolygon(g: GeoJsonObject): g is Polygon {
  return g.type === "Polygon";
}
function isMultiLineString(g: GeoJsonObject): g is MultiLineString {
  return g.type === "MultiLineString";
}
function isMultiPolygon(g: GeoJsonObject): g is MultiPolygon {
  return g.type === "MultiPolygon";
}
function isGeometryCollection(g: GeoJsonObject): g is GeometryCollection {
  return g.type === "GeometryCollection";
}


function parseGeo(raw: unknown): GeoJsonObject | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as GeoJsonObject;
    } catch {
      return null;
    }
  }
  return raw as GeoJsonObject;
}

function normalizeGeometry(z: SegmentZone): GeoJsonObject | null {
  const mz = z as unknown as MaybeGeom;
  return parseGeo(mz.zoneGeometry ?? mz.geometry ?? null);
}

function getDisplayOrder(z: SegmentZone): number {
  const d = (z as unknown as { displayOrder?: unknown }).displayOrder;
  return typeof d === "number" ? d : 0;
}

function getZoneName(z?: SegmentZone | null): string {
  if (!z) return "Zone không tên";
  const s = z as ServerSegmentZone;
  return s.name ?? "Zone không tên";
}

function getZoneDescription(z: SegmentZone): string | undefined {
  const s = z as ServerSegmentZone;
  return s.description ?? undefined;
}

function getCenterFromGeo(geo: GeoJsonObject | null): [number, number] | null {
  if (!geo) return null;
  const mix = (arr: number[]) => (Math.min(...arr) + Math.max(...arr)) / 2;

  if (isPoint(geo)) {
    const [lng, lat] = geo.coordinates;
    return typeof lat === "number" && typeof lng === "number" ? [lat, lng] : null;
  }
  if (isLineString(geo)) {
    if (!geo.coordinates.length) return null;
    const lats = geo.coordinates.map((c) => c[1]);
    const lngs = geo.coordinates.map((c) => c[0]);
    return [mix(lats), mix(lngs)];
  }
  if (isPolygon(geo)) {
    const rings = geo.coordinates;
    if (!rings.length || !rings[0]?.length) return null;
    const all = rings.flat();
    const lats = all.map((c) => c[1]);
    const lngs = all.map((c) => c[0]);
    return [mix(lats), mix(lngs)];
  }
  if (isMultiLineString(geo)) {
    const all = geo.coordinates.flat();
    if (!all.length) return null;
    const lats = all.map((c) => c[1]);
    const lngs = all.map((c) => c[0]);
    return [mix(lats), mix(lngs)];
  }
  if (isMultiPolygon(geo)) {
    const all = geo.coordinates.flat(2);
    if (!all.length) return null;
    const lats = all.map((c) => c[1]);
    const lngs = all.map((c) => c[0]);
    return [mix(lats), mix(lngs)];
  }
  if (isGeometryCollection(geo)) {
    const centers: [number, number][] = [];
    for (const geom of geo.geometries) {
      const c = getCenterFromGeo(geom as GeoJsonObject);
      if (c) centers.push(c);
    }
    if (!centers.length) return null;
    const lats = centers.map((c) => c[0]);
    const lngs = centers.map((c) => c[1]);
    return [mix(lats), mix(lngs)];
  }
  return null;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Xoá",
  cancelText = "Hủy",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[6000]">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[420px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">{title}</div>
          <div className="px-4 py-4 text-sm text-white/80">{message}</div>
          <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              className={`px-3 py-1.5 rounded ${danger ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function stringifyGeo(geo: GeoJsonObject | null): string | undefined {
  return geo ? JSON.stringify(geo) : undefined;
}


export default function SegmentPanel({
  mapId,
  layers = [],
  currentLayerId,
  onZoomZone,
  onCopyZoneToExistingLayer,
  onCopyZoneToNewLayer,
}: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [zones, setZones] = useState<SegmentZone[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [confirmZone, setConfirmZone] = useState<SegmentZone | null>(null);
  const [confirmSegment, setConfirmSegment] = useState<Segment | null>(null);

  const [loadingSeg, setLoadingSeg] = useState(false);
  const [loadingZone, setLoadingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [menu, setMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    zone: SegmentZone | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    zone: null,
  });

  const [layerDialogVisible, setLayerDialogVisible] = useState(false);

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<SegmentZone | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>({
    name: "",
    description: "",
    zoneType: "area",
    isPrimary: false,
    zoneGeometry: null,
  });

  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segmentForm, setSegmentForm] = useState<{ name: string; summary?: string }>({
    name: "",
    summary: "",
  });

  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => getDisplayOrder(a) - getDisplayOrder(b)),
    [zones]
  );

  const loadSegments = async () => {
    try {
      setLoadingSeg(true);
      setError(null);
      const list = await getSegments(mapId);
      const sorted = [...(list ?? [])].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      );
      setSegments(sorted);
      setSelectedSegmentId((prev) => {
        if (!prev) return sorted[0]?.segmentId ?? "";
        return sorted.some((s) => s.segmentId === prev) ? prev : sorted[0]?.segmentId ?? "";
      });
    } catch {
      setError("Không tải được danh sách segment");
    } finally {
      setLoadingSeg(false);
    }
  };

  useEffect(() => {
    void loadSegments();
  }, [mapId]);

  /* -------- load zones with cleanup ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedSegmentId) {
        setZones([]);
        return;
      }
      try {
        setLoadingZone(true);
        const list = await getSegmentZones(mapId, selectedSegmentId);
        if (!alive) return;
        setZones(list ?? []);
      } catch {
        if (!alive) return;
        setZones([]);
      } finally {
        if (!alive) return;
        setLoadingZone(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mapId, selectedSegmentId]);

  /* -------- segment actions ---------- */
  const openCreateSegment = () => {
    setEditingSegment(null);
    setSegmentForm({ name: "", summary: "" });
    setSegmentDialogOpen(true);
  };

  const openEditSegment = () => {
    const seg = segments.find((s) => s.segmentId === selectedSegmentId);
    if (!seg) return;
    setEditingSegment(seg);
    setSegmentForm({ name: seg.name ?? "", summary: seg.summary ?? "" });
    setSegmentDialogOpen(true);
  };

  const submitSegment = async (data: { name: string; summary?: string }) => {
    try {
      setBusy(true);
      if (editingSegment) {
        await updateSegment(mapId, editingSegment.segmentId, data);
      } else {
        await createSegment(mapId, data);
      }
      await loadSegments();
      setSegmentDialogOpen(false);
    } catch {
      setError("Lưu segment thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSegment = async () => {
    const current = segments.find((s) => s.segmentId === selectedSegmentId);
    if (!current) return;
    setConfirmSegment(current);
  };

  /* -------- zone actions ---------- */
  const handleOpenZoneMenu = (e: React.MouseEvent, zone: SegmentZone) => {
    e.preventDefault();
    setMenu({ visible: true, x: e.clientX, y: e.clientY, zone });
  };
  const handleCloseMenu = () => setMenu((m) => ({ ...m, visible: false }));

  const handleZoomZone = (zone: SegmentZone | null) => {
    const z = zone ?? menu.zone;
    if (!z) return;
    if (onZoomZone) {
      onZoomZone(z);
      return;
    }
    const geometry = normalizeGeometry(z);
    const evt = new CustomEvent<ZoneEventDetail>("storymap:zoomToZone", {
      detail: { mapId, segmentId: selectedSegmentId, zone: z, geometry },
    });
    window.dispatchEvent(evt);
  };

  const handleCopyCoords = async (zone: SegmentZone | null) => {
    const z = zone ?? menu.zone;
    if (!z) return;
    const geometry = normalizeGeometry(z);
    if (!geometry) return;

    let value: unknown = geometry;
    if (isGeometryCollection(geometry)) {
      value = geometry.geometries;
    } else if (
      isPoint(geometry) ||
      isLineString(geometry) ||
      isPolygon(geometry) ||
      isMultiLineString(geometry) ||
      isMultiPolygon(geometry)
    ) {
      value = geometry.coordinates;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(value));
    } catch {
      /* noop */
    }
  };

  const handleCopyToExistingLayer = (zone: SegmentZone | null) => {
    const z = zone ?? menu.zone;
    if (!z) return;
    if (layers.length > 0) {
      setLayerDialogVisible(true);
      return;
    }
    const evt = new CustomEvent<ZoneEventDetail>("storymap:copyZoneToExistingLayer", {
      detail: { mapId, segmentId: selectedSegmentId, zone: z },
    });
    window.dispatchEvent(evt);
  };

  const handleCopyToNewLayer = (zone: SegmentZone | null) => {
    const z = zone ?? menu.zone;
    if (!z) return;
    if (onCopyZoneToNewLayer) {
      onCopyZoneToNewLayer(z);
    } else {
      const evt = new CustomEvent<ZoneEventDetail>("storymap:copyZoneToNewLayer", {
        detail: { mapId, segmentId: selectedSegmentId, zone: z },
      });
      window.dispatchEvent(evt);
    }
  };

  const handleDeleteZone = async (zone: SegmentZone | null) => {
    const z = zone ?? menu.zone;
    if (!z) return;
    setConfirmZone(z);
  };

  const openCreateZone = () => {
    setEditingZone(null);
    setZoneForm({
      name: "",
      description: "",
      zoneType: "area",
      isPrimary: false,
      displayOrder: zones.length,
      zoneGeometry: null,
    });
    setZoneDialogOpen(true);
  };

  const openEditZone = (zone: SegmentZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: getZoneName(zone),
      description: getZoneDescription(zone) ?? "",
      zoneType: "area",
      isPrimary: (zone as ServerSegmentZone).isPrimary ?? false,
      displayOrder: getDisplayOrder(zone),
      zoneGeometry: normalizeGeometry(zone),
    });
    setZoneDialogOpen(true);
  };

  const submitZone = async (form: ZoneForm) => {
    if (!selectedSegmentId) return;
    try {
      setBusy(true);

      const zoneTypeMap: Record<ZoneForm["zoneType"], CreateSegmentZoneReq["zoneType"]> = {
        area: "Area",
        line: "Line",
        point: "Point",
      };

      const center = getCenterFromGeo(form.zoneGeometry);
      const focusCameraState = center ? JSON.stringify({ center, zoom: 14 }) : undefined;

      const payload: CreateSegmentZoneReq = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        zoneType: zoneTypeMap[form.zoneType],
        zoneGeometry: stringifyGeo(form.zoneGeometry) ?? "{}", // BE expects string
        displayOrder: typeof form.displayOrder === "number" ? form.displayOrder : undefined,
        isPrimary: form.isPrimary,
        ...(focusCameraState ? { focusCameraState } : {}),
      };

      if (editingZone) {
        const updatePayload: UpdateSegmentZoneReq = { ...payload };
        await updateSegmentZone(mapId, selectedSegmentId, editingZone.segmentZoneId, updatePayload);
      } else {
        await createSegmentZone(mapId, selectedSegmentId, payload);
      }
      const list = await getSegmentZones(mapId, selectedSegmentId);
      setZones(list ?? []);
      setZoneDialogOpen(false);
    } catch {
      setError(editingZone ? "Sửa zone thất bại" : "Tạo zone thất bại");
    } finally {
      setBusy(false);
    }
  };

  const swapZoneOrder = async (a: SegmentZone, b: SegmentZone) => {
    const ao = getDisplayOrder(a);
    const bo = getDisplayOrder(b);
    try {
      setBusy(true);
      const pa: UpdateSegmentZoneReq = { displayOrder: bo };
      const pb: UpdateSegmentZoneReq = { displayOrder: ao };
      await Promise.all([
        updateSegmentZone(mapId, selectedSegmentId, a.segmentZoneId, pa),
        updateSegmentZone(mapId, selectedSegmentId, b.segmentZoneId, pb),
      ]);
      const list = await getSegmentZones(mapId, selectedSegmentId);
      setZones(list ?? []);
    } catch {
      setError("Đổi thứ tự thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleMoveUp = async (z: SegmentZone) => {
    const idx = sortedZones.findIndex((x) => x.segmentZoneId === z.segmentZoneId);
    if (idx <= 0) return;
    await swapZoneOrder(sortedZones[idx], sortedZones[idx - 1]);
  };

  const handleMoveDown = async (z: SegmentZone) => {
    const idx = sortedZones.findIndex((x) => x.segmentZoneId === z.segmentZoneId);
    if (idx < 0 || idx >= sortedZones.length - 1) return;
    await swapZoneOrder(sortedZones[idx], sortedZones[idx + 1]);
  };

  const availableLayers = useMemo(
    () => layers.filter((l) => !currentLayerId || l.id !== currentLayerId),
    [layers, currentLayerId]
  );

  const handleLayerDialogSelect = (layerId: string) => {
    const z = menu.zone;
    if (!z) return;

    if (onCopyZoneToExistingLayer) {
      onCopyZoneToExistingLayer(z, layerId);
    } else {
      const evt = new CustomEvent<ZoneEventDetail>("storymap:copyZoneToExistingLayerSelected", {
        detail: { mapId, segmentId: selectedSegmentId, zone: z, layerId },
      });
      window.dispatchEvent(evt);
    }
    setLayerDialogVisible(false);
  };

  /* ---------------------- RENDER ---------------------- */
  return (
    <>
      {/* PANEL – giữ pointer-events-none để không block map */}
      <div className="absolute right-3 top-16 z-[3100] pointer-events-none">
        <div className="pointer-events-auto rounded-xl bg-zinc-900/85 text-white shadow-2xl ring-1 ring-white/15 w-[380px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="font-semibold text-sm">Segments &amp; Zones</div>
            <span className="text-xs text-white/60">StoryMap</span>
          </div>

          <div className="p-3 space-y-4">
            {/* SEGMENTS */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-white/60">Danh sách Segment</div>
                <div className="flex gap-1">
                  <button
                    onClick={openCreateSegment}
                    className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                  >
                    + Thêm
                  </button>
                  <button
                    onClick={openEditSegment}
                    disabled={!selectedSegmentId}
                    className="text-[11px] px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={handleDeleteSegment}
                    disabled={!selectedSegmentId}
                    className="text-[11px] px-2 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-60"
                  >
                    Xoá
                  </button>
                </div>
              </div>

              {loadingSeg ? (
                <div className="text-sm text-white/60">Đang tải…</div>
              ) : segments.length === 0 ? (
                <div className="text-sm text-white/60">Chưa có segment nào</div>
              ) : (
                <select
                  className="w-full rounded-md bg-zinc-800 text-white text-sm px-2 py-1.5"
                  value={selectedSegmentId}
                  onChange={(e) => setSelectedSegmentId(e.target.value)}
                >
                  {segments.map((s) => (
                    <option key={s.segmentId} value={s.segmentId}>
                      {s.name || "Segment không tên"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ZONES */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-white/60">Danh sách Zone</div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                    disabled={!selectedSegmentId || busy}
                    onClick={openCreateZone}
                  >
                    + Thêm Zone
                  </button>
                  <div className="text-[11px] text-white/50">
                    {loadingZone ? "Đang tải…" : `Tổng: ${zones.length}`}
                  </div>
                </div>
              </div>

              {zones.length === 0 ? (
                <div className="text-sm text-white/60">Chưa có zone trong segment này</div>
              ) : (
                <ul className="space-y-2 max-h-[40vh] overflow-auto no-scrollbar">
                  {sortedZones.map((z) => (
                    <li
                      key={z.segmentZoneId}
                      className="rounded-lg bg-white/5 p-2 hover:bg-white/10 transition-colors group"
                      onClick={() => handleZoomZone(z)}
                      onContextMenu={(e) => handleOpenZoneMenu(e, z)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{getZoneName(z)}</div>
                          {getZoneDescription(z) && (
                            <div className="text-xs text-white/70 mt-0.5 line-clamp-2">
                              {getZoneDescription(z)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleMoveUp(z);
                            }}
                            title="Move Up"
                          >
                            ↑
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleMoveDown(z);
                            }}
                            title="Move Down"
                          >
                            ↓
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleZoomZone(z);
                            }}
                            title="Zoom to Zone"
                          >
                            🔍
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCopyCoords(z);
                            }}
                            title="Copy Geometry JSON"
                          >
                            📍
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditZone(z);
                            }}
                            title="Edit Zone"
                          >
                            ✏️
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToExistingLayer(z);
                            }}
                            title="Copy to Existing Layer"
                          >
                            📁
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToNewLayer(z);
                            }}
                            title="Copy to New Layer"
                          >
                            ➕
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-600/80 hover:bg-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteZone(z);
                            }}
                            title="Delete Zone"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedSegmentId && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <SegmentPoiPanel mapId={mapId} segmentId={selectedSegmentId} />
              </div>
            )}
            {error && <div className="text-red-300 text-xs">{error}</div>}
          </div>
        </div>
      </div>

      <ZoneContextMenu
        visible={menu.visible}
        x={menu.x}
        y={menu.y}
        zoneName={menu.zone ? getZoneName(menu.zone) : "Zone"}
        onClose={handleCloseMenu}
        onZoomToFit={() => handleZoomZone(menu.zone)}
        onCopyCoordinates={() => void handleCopyCoords(menu.zone)}
        onCopyToExistingLayer={() => handleCopyToExistingLayer(menu.zone)}
        onCopyToNewLayer={() => handleCopyToNewLayer(menu.zone)}
        onDeleteZone={() => void handleDeleteZone(menu.zone)}
      />

      <LayerPickerDialog
        visible={layerDialogVisible}
        layers={availableLayers}
        currentLayerId={currentLayerId ?? ""}
        onSelect={(layerId) => handleLayerDialogSelect(layerId)}
        onClose={() => setLayerDialogVisible(false)}
      />

      <AddZoneDialog
        visible={zoneDialogOpen}
        initial={zoneForm}
        editing={!!editingZone}
        onCancel={() => setZoneDialogOpen(false)}
        onSubmit={submitZone}
        onChange={(f) => setZoneForm(f)}
      />

      <AddSegmentDialog
        visible={segmentDialogOpen}
        initial={segmentForm}
        editing={!!editingSegment}
        onCancel={() => setSegmentDialogOpen(false)}
        onSubmit={submitSegment}
        onChange={(f) => setSegmentForm(f)}
      />
      <ConfirmDialog
        open={!!confirmZone}
        title="Xoá Zone"
        message={`Bạn có chắc muốn xoá “${getZoneName(confirmZone ?? null)}”? Hành động này không thể hoàn tác.`}
        confirmText="Xoá"
        danger
        onCancel={() => setConfirmZone(null)}
        onConfirm={async () => {
          if (!confirmZone) return;
          try {
            setBusy(true);
            await deleteSegmentZone(mapId, selectedSegmentId, confirmZone.segmentZoneId);
            const list = await getSegmentZones(mapId, selectedSegmentId);
            setZones(list ?? []);
          } catch {
            setError("Xoá zone thất bại");
          } finally {
            setBusy(false);
            setConfirmZone(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmSegment}
        title="Xoá Segment"
        message={`Xoá segment “${confirmSegment?.name || "Segment không tên"}”? Toàn bộ zone bên trong cũng sẽ bị xoá.`}
        confirmText="Xoá"
        danger
        onCancel={() => setConfirmSegment(null)}
        onConfirm={async () => {
          if (!confirmSegment) return;
          try {
            setBusy(true);
            await deleteSegment(mapId, confirmSegment.segmentId);
            await loadSegments();
            setZones([]);
          } catch {
            setError("Xoá segment thất bại");
          } finally {
            setBusy(false);
            setConfirmSegment(null);
          }
        }}
      />

    </>
  );
}

/* ---------------------- AddZoneDialog --------------------- */

function AddZoneDialog({
  visible,
  initial,
  editing,
  onCancel,
  onSubmit,
  onChange,
}: {
  visible: boolean;
  initial: ZoneForm;
  editing?: boolean;
  onCancel: () => void;
  onSubmit: (form: ZoneForm) => void;
  onChange: (form: ZoneForm) => void;
}) {
  const [local, setLocal] = useState<ZoneForm>(initial);

  useEffect(() => setLocal(initial), [initial, visible]);

  const setField = <K extends keyof ZoneForm>(key: K, val: ZoneForm[K]) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange(next);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as GeoJsonObject;
      setField("zoneGeometry", json);
    } catch {
      alert("File không phải JSON hợp lệ!");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[5000] pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[460px] rounded-xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold">{editing ? "Sửa Zone" : "Tạo Zone mới"}</div>
            <button className="text-white/60 hover:text-white" onClick={onCancel}>
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <div>
              <label className="block text-white/60 mb-1">Tên Zone</label>
              <input
                value={local.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                placeholder="VD: Vùng Bình Thạnh Riverside"
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Mô tả</label>
              <textarea
                rows={2}
                value={local.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                className="w-full rounded bg-zinc-800 px-2 py-2 outline-none"
                placeholder="Mô tả ngắn gọn về zone..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/60 mb-1">Loại Zone</label>
                <select
                  value={local.zoneType}
                  onChange={(e) => setField("zoneType", e.target.value as ZoneForm["zoneType"])}
                  className="w-full rounded bg-zinc-800 px-2 py-2"
                >
                  <option value="area">Khu vực (Polygon)</option>
                  <option value="line">Đường (LineString)</option>
                  <option value="point">Điểm (Point)</option>
                </select>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={local.displayOrder ?? 0}
                  onChange={(e) => setField("displayOrder", Number(e.target.value))}
                  className="w-full rounded bg-zinc-800 px-2 py-2"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={local.isPrimary}
                onChange={(e) => setField("isPrimary", e.target.checked)}
              />
              <span className="text-white/80">Là Zone chính</span>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-white/60">Hình học (GeoJSON)</div>
                <input type="file" accept=".json,.geojson" onChange={handleFileUpload} className="text-xs" />
              </div>

              <textarea
                rows={6}
                className="w-full rounded bg-zinc-800 px-2 py-2 font-mono text-xs"
                placeholder="Dán GeoJSON tại đây hoặc chọn file…"
                value={local.zoneGeometry ? JSON.stringify(local.zoneGeometry, null, 2) : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  try {
                    setField("zoneGeometry", v ? (JSON.parse(v) as GeoJsonObject) : null);
                  } catch {
                  }
                }}
              />
              {local.zoneGeometry ? (
                <div className="text-emerald-400 text-xs">✅ GeoJSON hợp lệ</div>
              ) : (
                <div className="text-white/50 text-xs">Bạn có thể tải file .geojson hoặc dán nội dung vào ô trên.</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
              Hủy
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              onClick={() => onSubmit(local)}
              disabled={!local.name.trim()}
            >
              {editing ? "Lưu thay đổi" : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- AddSegmentDialog --------------------- */

function AddSegmentDialog({
  visible,
  initial,
  editing,
  onCancel,
  onSubmit,
  onChange,
}: {
  visible: boolean;
  initial: { name: string; summary?: string };
  editing?: boolean;
  onCancel: () => void;
  onSubmit: (data: { name: string; summary?: string }) => void;
  onChange: (data: { name: string; summary?: string }) => void;
}) {
  const [local, setLocal] = useState(initial);

  useEffect(() => setLocal(initial), [initial, visible]);

  const setField = <K extends keyof typeof local>(key: K, val: (typeof local)[K]) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange(next);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[5000] pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-zinc-900 text-white w-[420px] rounded-xl ring-1 ring-white/10 shadow-2xl">
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
            <div className="font-semibold">{editing ? "Sửa Segment" : "Thêm Segment mới"}</div>
            <button onClick={onCancel} className="text-white/60 hover:text-white">
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <div>
              <label className="block text-white/60 mb-1">Tên Segment</label>
              <input
                className="w-full rounded bg-zinc-800 p-2 outline-none"
                placeholder="VD: Khám phá cầu Sài Gòn"
                value={local.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-white/60 mb-1">Mô tả (tùy chọn)</label>
              <textarea
                rows={2}
                className="w-full rounded bg-zinc-800 p-2 outline-none"
                placeholder="Mô tả ngắn gọn..."
                value={local.summary ?? ""}
                onChange={(e) => setField("summary", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10">
            <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
              Hủy
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              onClick={() => onSubmit(local)}
              disabled={!local.name.trim()}
            >
              {editing ? "Lưu thay đổi" : "Tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
