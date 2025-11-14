"use client";

import React, { Fragment, useEffect, useState } from "react";

import type { GeoJsonObject, Point, GeometryCollection } from "geojson";
import { createMapPoi, CreatePoiReq, deletePoi, getMapPois, MapPoi, updatePoi, updatePoiDisplayConfig, updatePoiInteractionConfig } from "@/lib/api-poi";
import LocationPoiDialog from "@/components/shared/LocationPoiDialog";
import type { LocationPoiDialogForm, LocationType } from "@/types";

type Props = { mapId: string };

type MapPoiExt = MapPoi & {
  isVisible?: boolean;
  zIndex?: number;
  showTooltip?: boolean;
  tooltipContent?: string | null;
  openSlideOnClick?: boolean;
  playAudioOnClick?: boolean;
  audioUrl?: string | null;
  externalUrl?: string | null;
};

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

type PanelProps = Props & {
  isOpen: boolean;
};

export default function MapPoiPanel({ mapId, isOpen }: PanelProps) {
  const [pois, setPois] = useState<MapPoiExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null);
  const [expandedPoiId, setExpandedPoiId] = useState<string | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [waitingForLocation, setWaitingForLocation] = useState(false);

  const [displayConfig, setDisplayConfig] = useState({
    isVisible: undefined as boolean | undefined,
    zIndex: undefined as number | undefined,
    showTooltip: undefined as boolean | undefined,
    tooltipContent: undefined as string | undefined,
  });

  const [interactionConfig, setInteractionConfig] = useState({
    openSlideOnClick: undefined as boolean | undefined,
    playAudioOnClick: undefined as boolean | undefined,
    audioUrl: undefined as string | undefined,
    externalUrl: undefined as string | undefined,
  });

  const [form, setForm] = useState<LocationPoiDialogForm>({
    title: "",
    subtitle: "",
    storyContent: "",
    locationType: "PointOfInterest",
    markerGeometry: "",
    iconType: "📍",
    iconColor: "#FF0000",
    iconSize: 32,
    highlightOnEnter: false,
    showTooltip: true,
    tooltipContent: "",
    openSlideOnClick: false,
    slideContent: "",
    playAudioOnClick: false,
    audioUrl: "",
    externalUrl: "",
    displayOrder: 0,
    isVisible: true,
    zIndex: 100,
    mediaResources: "",
    entryEffect: "fade",
    entryDelayMs: 0,
    entryDurationMs: 400,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = (await getMapPois(mapId)) as unknown as MapPoiExt[];
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
    const data = (await getMapPois(mapId)) as unknown as MapPoiExt[];
    setPois(data ?? []);
  };

  const openCreate = () => {
    // Reset form
    setForm({
      title: "",
      subtitle: "",
      storyContent: "",
      locationType: "PointOfInterest",
      markerGeometry: "",
      iconType: "📍",
      iconColor: "#FF0000",
      iconSize: 32,
      highlightOnEnter: false,
      showTooltip: true,
      tooltipContent: "",
      openSlideOnClick: false,
      slideContent: "",
      playAudioOnClick: false,
      audioUrl: "",
      externalUrl: "",
      displayOrder: 0,
      isVisible: true,
      zIndex: 100,
      mediaResources: "",
      entryEffect: "fade",
      entryDelayMs: 0,
      entryDurationMs: 400,
    });
    setEditingPoiId(null);
    setError(null);
    // Không mở dialog ngay, mà bật chế độ chọn vị trí
    setWaitingForLocation(true);
    setIsPickingLocation(true);
    setDialogOpen(false);
    // Dispatch event để map component biết cần bật picking mode
    window.dispatchEvent(
      new CustomEvent("poi:startPickLocation", {
        detail: { mapId },
      })
    );
  };

  // Lắng nghe sự kiện khi user chọn vị trí trên map
  useEffect(() => {
    const handleLocationPicked = async (e: Event) => {
      // Chỉ xử lý khi đang chờ chọn vị trí
      if (!waitingForLocation && !isPickingLocation) {
        return;
      }
      
      const customEvent = e as CustomEvent;
      const { lngLat } = customEvent.detail;
      
      // Cập nhật markerGeometry trong form
      const markerGeometry = JSON.stringify({
        type: "Point",
        coordinates: [lngLat[0], lngLat[1]], // [lng, lat]
      });
      
      setForm(prev => ({
        ...prev,
        markerGeometry,
      }));
      
      // Tắt chế độ chọn vị trí và mở dialog
      setIsPickingLocation(false);
      setWaitingForLocation(false);
      setDialogOpen(true);
    };

    window.addEventListener("poi:locationPicked", handleLocationPicked);
    return () => {
      window.removeEventListener("poi:locationPicked", handleLocationPicked);
    };
  }, [waitingForLocation, isPickingLocation]);

  const openEdit = (p: MapPoiExt) => {
    setEditingPoiId(p.poiId);
    setForm({
      title: p.title,
      subtitle: p.subtitle ?? "",
      storyContent: p.storyContent ?? "",
      markerGeometry: p.markerGeometry ?? "",
      locationType: (p.locationType as LocationType) ?? "PointOfInterest",
      highlightOnEnter: !!p.highlightOnEnter,
      showTooltip: p.showTooltip ?? true,
      tooltipContent: p.tooltipContent ?? "",
      openSlideOnClick: p.openSlideOnClick ?? false,
      slideContent: p.slideContent ?? "",
      playAudioOnClick: p.playAudioOnClick ?? false,
      audioUrl: p.audioUrl ?? "",
      externalUrl: p.externalUrl ?? "",
      displayOrder: p.displayOrder ?? 0,
      isVisible: p.isVisible ?? true,
      zIndex: p.zIndex ?? 100,
      mediaResources: p.mediaResources ?? "",
    });
    setDialogOpen(true);
    setIsPickingLocation(false);
  };

  const toggleExpand = (p: MapPoiExt) => {
    const next = expandedPoiId === p.poiId ? null : p.poiId;
    setExpandedPoiId(next);
    if (next) {
      setDisplayConfig({
        isVisible: p.isVisible,
        zIndex: p.zIndex,
        showTooltip: p.showTooltip,
        tooltipContent: p.tooltipContent ?? undefined,
      });
      setInteractionConfig({
        openSlideOnClick: p.openSlideOnClick,
        playAudioOnClick: p.playAudioOnClick,
        audioUrl: p.audioUrl ?? undefined,
        externalUrl: p.externalUrl ?? undefined,
      });
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.markerGeometry) {
      setError("Vui lòng chọn vị trí trên bản đồ");
      return;
    }
    try {
      setBusy(true);
      // Convert LocationPoiDialogForm to CreatePoiReq
      const payload: CreatePoiReq = {
        title: form.title,
        subtitle: form.subtitle || undefined,
        storyContent: form.storyContent || undefined,
        locationType: form.locationType || "PointOfInterest",
        markerGeometry: form.markerGeometry,
        displayOrder: form.displayOrder ?? 0,
        highlightOnEnter: form.highlightOnEnter ?? false,
        showTooltip: form.showTooltip ?? true,
        tooltipContent: form.tooltipContent || undefined,
        openSlideOnClick: form.openSlideOnClick ?? false,
        slideContent: form.slideContent || undefined,
        playAudioOnClick: form.playAudioOnClick ?? false,
        audioUrl: form.audioUrl || undefined,
        externalUrl: form.externalUrl || undefined,
        isVisible: form.isVisible ?? true,
        zIndex: form.zIndex ?? 100,
        mediaResources: form.mediaResources || undefined,
      };
      
      if (editingPoiId) {
        await updatePoi(editingPoiId, payload);
      } else {
        await createMapPoi(mapId, payload);
      }
      await refresh();
      
      // Lưu editingPoiId trước khi reset
      const wasEditing = !!editingPoiId;
      const editedPoiId = editingPoiId;
      
      setDialogOpen(false);
      setEditingPoiId(null);
      setIsPickingLocation(false);
      setWaitingForLocation(false);
      // Dispatch event để tắt picking mode
      window.dispatchEvent(
        new CustomEvent("poi:stopPickLocation", {
          detail: { mapId },
        })
      );
      // Dispatch event để refresh POIs trên map
      window.dispatchEvent(
        new CustomEvent(wasEditing ? "poi:updated" : "poi:created", {
          detail: { mapId, poiId: editedPoiId || "new" },
        })
      );
      setForm({
        title: "",
        subtitle: "",
        storyContent: "",
        locationType: "PointOfInterest",
        markerGeometry: "",
        iconType: "📍",
        iconColor: "#FF0000",
        iconSize: 32,
        highlightOnEnter: false,
        showTooltip: true,
        tooltipContent: "",
        openSlideOnClick: false,
        slideContent: "",
        playAudioOnClick: false,
        audioUrl: "",
        externalUrl: "",
        displayOrder: 0,
        isVisible: true,
        zIndex: 100,
        mediaResources: "",
        entryEffect: "fade",
        entryDelayMs: 0,
        entryDurationMs: 400,
      });
    } catch (err) {
      console.error("Failed to save POI:", err);
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
      // Dispatch event để refresh POIs trên map
      window.dispatchEvent(
        new CustomEvent("poi:deleted", {
          detail: { mapId, poiId },
        })
      );
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

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-[420px] bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl z-[1000]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-white">POI Panel</h2>
        </div>
        <button
          onClick={openCreate}
          disabled={waitingForLocation}
          className={`px-3 py-1.5 ${
            waitingForLocation 
              ? "bg-yellow-600 hover:bg-yellow-500" 
              : "bg-emerald-600 hover:bg-emerald-500"
          } text-white rounded-lg text-sm font-medium flex items-center gap-1 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {waitingForLocation ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            )}
          </svg>
          {waitingForLocation ? "Đang chọn..." : "Tạo POI"}
        </button>
      </div>

      {/* POI Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Thông báo khi đang chờ chọn vị trí */}
        {waitingForLocation && (
          <div className="mb-4 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-blue-300 font-medium text-sm mb-1">
                  Vui lòng chọn một địa điểm trên bản đồ
                </p>
                <p className="text-blue-400 text-xs">
                  Click vào bất kỳ đâu trên bản đồ để đặt POI của bạn
                </p>
              </div>
              <button
                onClick={() => {
                  setWaitingForLocation(false);
                  setIsPickingLocation(false);
                  window.dispatchEvent(
                    new CustomEvent("poi:stopPickLocation", {
                      detail: { mapId },
                    })
                  );
                }}
                className="flex-shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
                title="Hủy"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2"></div>
              <div>Đang tải...</div>
            </div>
          </div>
        ) : pois.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="mb-2">Chưa có POI nào</p>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
              >
                Tạo POI đầu tiên
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
          {pois.map((p) => (
            <Fragment key={p.poiId}>
              <li className="bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  title="Bấm để tới vị trí POI trên bản đồ"
                  onClick={() => focusPoi(p)}
                >
                  {/* POI Icon */}
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>

                  {/* POI Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate">{p.title}</div>
                    {p.subtitle && (
                      <div className="text-xs text-zinc-400 truncate">{p.subtitle}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async (e) => {
                        stop(e);
                        try {
                          setBusy(true);
                          await updatePoiDisplayConfig(p.poiId, { isVisible: !Boolean(p.isVisible) });
                          await refresh();
                        } catch {
                          setError("Cập nhật hiển thị thất bại");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="p-2 rounded hover:bg-zinc-700 transition-colors"
                      title={p.isVisible ? "Ẩn POI" : "Hiện POI"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {(p.isVisible ?? true) ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        stop(e);
                        setExpandedPoiId(expandedPoiId === p.poiId ? null : p.poiId);
                        if (expandedPoiId !== p.poiId) {
                          setDisplayConfig({
                            isVisible: p.isVisible,
                            zIndex: p.zIndex,
                            showTooltip: p.showTooltip,
                            tooltipContent: p.tooltipContent ?? undefined,
                          });
                          setInteractionConfig({
                            openSlideOnClick: p.openSlideOnClick,
                            playAudioOnClick: p.playAudioOnClick,
                            audioUrl: p.audioUrl ?? undefined,
                            externalUrl: p.externalUrl ?? undefined,
                          });
                        }
                      }}
                      className="p-2 rounded hover:bg-zinc-700 transition-colors"
                      title="Cấu hình POI"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        stop(e);
                        openEdit(p);
                      }}
                      className="p-2 rounded hover:bg-zinc-700 transition-colors"
                      title="Sửa POI"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        stop(e);
                        void handleDelete(p.poiId);
                      }}
                      className="p-2 rounded hover:bg-red-600/20 text-red-400"
                      title="Xoá POI"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Configuration Section */}
                {expandedPoiId === p.poiId && (
                  <div className="border-t border-zinc-700 bg-zinc-900/50 p-3">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      {/* Display Config */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Cấu hình hiển thị</span>
                        </div>
                        <label className="flex items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={!!displayConfig.isVisible}
                            onChange={(e) => setDisplayConfig({ ...displayConfig, isVisible: e.target.checked })}
                            className="rounded"
                          />
                          Hiển thị POI
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={!!displayConfig.showTooltip}
                            onChange={(e) => setDisplayConfig({ ...displayConfig, showTooltip: e.target.checked })}
                            className="rounded"
                          />
                          Hiện tooltip
                        </label>
                        <div>
                          <label className="block text-zinc-400 mb-1.5">Nội dung tooltip</label>
                          <input
                            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={displayConfig.tooltipContent ?? ""}
                            onChange={(e) => setDisplayConfig({ ...displayConfig, tooltipContent: e.target.value })}
                            placeholder="Nhập nội dung..."
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 mb-1.5">Z-Index</label>
                          <input
                            type="number"
                            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={Number.isFinite(displayConfig.zIndex as number) ? String(displayConfig.zIndex) : ""}
                            onChange={(e) => setDisplayConfig({ ...displayConfig, zIndex: e.target.value === "" ? undefined : Number(e.target.value) })}
                            placeholder="0"
                          />
                        </div>
                        <button
                          className="w-full px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                          onClick={async (e) => {
                            stop(e);
                            try {
                              setBusy(true);
                              await updatePoiDisplayConfig(p.poiId, displayConfig);
                              await refresh();
                            } catch {
                              setError("Lưu hiển thị thất bại");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          💾 Lưu hiển thị
                        </button>
                      </div>

                      {/* Interaction Config */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                          <span>Cấu hình tương tác</span>
                        </div>
                        <label className="flex items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={!!interactionConfig.openSlideOnClick}
                            onChange={(e) => setInteractionConfig({ ...interactionConfig, openSlideOnClick: e.target.checked })}
                            className="rounded"
                          />
                          Mở slide khi click
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={!!interactionConfig.playAudioOnClick}
                            onChange={(e) => setInteractionConfig({ ...interactionConfig, playAudioOnClick: e.target.checked })}
                            className="rounded"
                          />
                          Phát audio khi click
                        </label>
                        <div>
                          <label className="block text-zinc-400 mb-1.5">Audio URL</label>
                          <input
                            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500"
                            value={interactionConfig.audioUrl ?? ""}
                            onChange={(e) => setInteractionConfig({ ...interactionConfig, audioUrl: e.target.value })}
                            placeholder="https://example.com/audio.mp3"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 mb-1.5">External URL</label>
                          <input
                            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500"
                            value={interactionConfig.externalUrl ?? ""}
                            onChange={(e) => setInteractionConfig({ ...interactionConfig, externalUrl: e.target.value })}
                            placeholder="https://example.com"
                          />
                        </div>
                        <button
                          className="w-full px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                          onClick={async (e) => {
                            stop(e);
                            try {
                              setBusy(true);
                              await updatePoiInteractionConfig(p.poiId, interactionConfig);
                              await refresh();
                            } catch {
                              setError("Lưu tương tác thất bại");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          💾 Lưu tương tác
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            </Fragment>
          ))}
        </ul>
        )}
      </div>

      {/* Dialogs */}
      {dialogOpen && (
        <LocationPoiDialog
          open={dialogOpen}
          busy={busy}
          mode="poi"
          form={form}
          isPickingLocation={isPickingLocation}
          titleText={editingPoiId ? "Sửa POI" : "Thêm POI"}
          submitLabel={busy ? "Đang lưu..." : editingPoiId ? "Cập nhật" : "Tạo mới"}
          onClose={() => {
            setDialogOpen(false);
            setEditingPoiId(null);
            setIsPickingLocation(false);
            setWaitingForLocation(false);
            // Dispatch event để tắt picking mode
            window.dispatchEvent(
              new CustomEvent("poi:stopPickLocation", {
                detail: { mapId },
              })
            );
          }}
          onChange={(f) => setForm(f)}
          onSubmit={() => void handleSubmit()}
          onPickLocation={() => {
            setIsPickingLocation(true);
            window.dispatchEvent(
              new CustomEvent("poi:startPickLocation", {
                detail: { mapId },
              })
            );
          }}
        />
      )}

      {error && (
        <div className="px-3 pb-3">
          <div className="bg-red-500/10 border border-red-500/50 rounded-md p-2">
            <div className="text-red-400 text-xs">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

