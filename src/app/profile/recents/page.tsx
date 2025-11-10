"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { convertPresetToNewFormat } from "@/utils/mapApiHelpers";
import {
  createMap,
  createMapFromTemplate,
  deleteMap,
  getMyMaps,
  MapDto,
  updateMap,
  UpdateMapRequest,
} from "@/lib/api-maps";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name";
type SortOrder = "asc" | "desc";

type Sample = {
  key: string;
  title: string;
  author: string;
  lastViewed: string;
  blurb: string;
  templateId?: string;
  preset?: {
    name: string;
    description?: string;
    baseMapProvider?: "OSM" | "Satellite" | "Dark";
    initialLatitude: number;
    initialLongitude: number;
    initialZoom: number;
  };
};

const SAMPLES: Sample[] = [
  {
    key: "reservoir-precip",
    title: "Ví dụ: Mực nước hồ chứa & Lượng mưa",
    author: "Yen Nhi Dang",
    lastViewed: "Xem gần nhất 3 tháng trước",
    blurb: "Kết hợp lớp mực nước hồ chứa với lượng mưa tích luỹ.",
    preset: {
      name: "Mực nước hồ chứa & Lượng mưa",
      baseMapProvider: "OSM",
      initialLatitude: 15.95,
      initialLongitude: 107.8,
      initialZoom: 5,
    },
  },
  {
    key: "sandy-inundation",
    title: "Ví dụ: Vùng ngập do bão Sandy",
    author: "Yen Nhi Dang",
    lastViewed: "Xem gần nhất 3 tháng trước",
    blurb: "Vùng nước dâng lịch sử để minh hoạ rủi ro nhanh.",
    preset: {
      name: "Vùng ngập bão Sandy",
      baseMapProvider: "OSM",
      initialLatitude: 40.71,
      initialLongitude: -74.0,
      initialZoom: 10,
    },
  },
  {
    key: "bike-collisions",
    title: "Ví dụ: Va chạm xe đạp – Toronto",
    author: "Yen Nhi Dang",
    lastViewed: "Xem gần nhất 3 tháng trước",
    blurb: "Tập điểm phục vụ phân tích an toàn va chạm xe đạp.",
    preset: {
      name: "Va chạm xe đạp Toronto",
      baseMapProvider: "OSM",
      initialLatitude: 43.65,
      initialLongitude: -79.38,
      initialZoom: 11,
    },
  },
  {
    key: "sales-territories",
    title: "Ví dụ: Lãnh thổ bán hàng",
    author: "Yen Nhi Dang",
    lastViewed: "Xem gần nhất 3 tháng trước",
    blurb: "Ranh giới lãnh thổ và phân vùng khu vực.",
    preset: {
      name: "Lãnh thổ bán hàng",
      baseMapProvider: "OSM",
      initialLatitude: 39.5,
      initialLongitude: -98.35,
      initialZoom: 4,
    },
  },
  {
    key: "getting-started",
    title: "Bắt đầu với Felt",
    author: "Yen Nhi Dang",
    lastViewed: "Xem gần nhất 3 tháng trước",
    blurb: "Mẫu khởi động với lớp điểm và vùng cơ bản.",
    preset: {
      name: "Bắt đầu",
      baseMapProvider: "OSM",
      initialLatitude: 21.03,
      initialLongitude: 105.85,
      initialZoom: 11,
    },
  },
];

function Thumb({ src, fallbackKey }: { src?: string | null; fallbackKey: string }) {
  const palette: Record<string, string> = {
    "reservoir-precip": "from-cyan-700 to-emerald-700",
    "sandy-inundation": "from-amber-600 to-rose-600",
    "bike-collisions": "from-fuchsia-700 to-indigo-700",
    "sales-territories": "from-emerald-700 to-teal-700",
    "getting-started": "from-zinc-700 to-zinc-800",
  };
  if (src) {
    return (
      <div className="h-32 w-full rounded-lg border border-white/10 overflow-hidden bg-zinc-900/40">
        <img src={src} alt="preview" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  const bg = palette[fallbackKey] ?? "from-zinc-700 to-zinc-800";
  return (
    <div className={`h-32 w-full rounded-lg border border-white/10 bg-gradient-to-br ${bg} grid place-items-center`}>
      <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm" />
    </div>
  );
}

type EditState = {
  open: boolean;
  map?: MapDto | null;
  name: string;
  description: string;
  previewLocal?: string | null;
  previewFile?: File | null;
  saving: boolean;
  error?: string | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function RecentsPage() {
  const router = useRouter();

  const [maps, setMaps] = useState<MapDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditState>({
    open: false,
    map: null,
    name: "",
    description: "",
    previewLocal: null,
    previewFile: null,
    saving: false,
    error: null,
  });

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const viewBtnRef = useRef<HTMLButtonElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (viewMenuRef.current?.contains(t)) return;
      if (viewBtnRef.current?.contains(t)) return;
      setViewOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [viewOpen]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const container = target.closest("[data-menu-container]");
      if (!container) setMenuOpenId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpenId(null);
    }
    if (menuOpenId) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [menuOpenId]);

  const loadMyMaps = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getMyMaps();
      setMaps(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không thể tải danh sách bản đồ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyMaps();
  }, [loadMyMaps]);

  const clickNewMap = useCallback(async () => {
    const center = { lat: 10.78, lng: 106.69 };
    const zoom = 13;

    const latDiff = 180 / Math.pow(2, zoom);
    const lngDiff = 360 / Math.pow(2, zoom);
    const defaultBounds = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [center.lng - lngDiff / 2, center.lat - latDiff / 2],
          [center.lng + lngDiff / 2, center.lat - latDiff / 2],
          [center.lng + lngDiff / 2, center.lat + latDiff / 2],
          [center.lng - lngDiff / 2, center.lat + latDiff / 2],
          [center.lng - lngDiff / 2, center.lat - latDiff / 2],
        ],
      ],
    });
    const viewState = JSON.stringify({ center: [center.lat, center.lng], zoom });

    const created = await createMap({
      name: "Bản đồ chưa đặt tên",
      description: "",
      isPublic: false,
      defaultBounds,
      viewState,
      baseMapProvider: "OSM",
      workspaceId: null,
    });

    router.push(`/maps/${created.mapId}?created=1&name=${encodeURIComponent("Bản đồ chưa đặt tên")}`);
  }, [router]);

  const sortedMaps = useMemo(() => {
    const arr = [...maps];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      const aTime = new Date(
        sortKey === "recentlyModified" ? (a.updatedAt ?? a.createdAt ?? 0) : (a.createdAt ?? 0)
      ).getTime();
      const bTime = new Date(
        sortKey === "recentlyModified" ? (b.updatedAt ?? b.createdAt ?? 0) : (b.createdAt ?? 0)
      ).getTime();
      return aTime - bTime;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [maps, sortKey, sortOrder]);

  const createFromSample = async (s: Sample) => {
    setActionErr(null);
    setBusyKey(s.key);
    try {
      if (s.templateId) {
        const r = await createMapFromTemplate({
          templateId: s.templateId,
          customName: (s.title ?? s.preset?.name ?? "Bản đồ mới từ mẫu").trim(),
          workspaceId: null,
        });
        router.push(`/maps/${r.mapId}`);
      } else if (s.preset) {
        const presetData = convertPresetToNewFormat(s.preset);
        const r2 = await createMap({
          name: s.preset.name,
          description: s.blurb,
          isPublic: false,
          ...presetData,
          workspaceId: null,
        });
        router.push(`/maps/${r2.mapId}`);
      } else {
        router.push("/maps/new");
      }
    } catch {
      setActionErr("Không thể tạo bản đồ từ mẫu này.");
    } finally {
      setBusyKey(null);
    }
  };

  const openEdit = (m: MapDto) => {
    setMenuOpenId(null);
    setEdit({
      open: true,
      map: m,
      name: m.name ?? "",
      description: m.description ?? "",
      previewLocal: m.previewImageUrl ?? null,
      previewFile: null,
      saving: false,
      error: null,
    });
  };

  const closeEdit = () => {
    setEdit((e) => ({ ...e, open: false, error: null, saving: false }));
  };

  const handleImagePick = async (file: File | null) => {
    if (!file) {
      setEdit((e) => ({ ...e, previewFile: null, previewLocal: null }));
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setEdit((e) => ({ ...e, previewFile: file, previewLocal: dataUrl }));
  };

  const saveEdit = async () => {
    if (!edit.map) return;
    setEdit((e) => ({ ...e, saving: true, error: null }));
    try {
      const body: UpdateMapRequest = {
        name: edit.name?.trim() ?? "",
        description: edit.description ?? "",
        previewImageUrl: edit.previewLocal ?? null,
      };
      await updateMap(edit.map.id, body);
      setMaps((ms) =>
        ms.map((m) =>
          m.id === edit.map!.id
            ? {
              ...m,
              name: body.name ?? m.name,
              description: body.description ?? m.description,
              previewImageUrl: body.previewImageUrl ?? m.previewImageUrl,
            }
            : m
        )
      );
      closeEdit();
    } catch (e) {
      setEdit((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Lưu thay đổi thất bại.",
        saving: false,
      }));
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    setMenuOpenId(null);
    const ok = confirm("Xoá bản đồ này?");
    if (!ok) return;
    setDeletingId(mapId);
    try {
      await deleteMap(mapId);
      setMaps((ms) => ms.filter((m) => m.id !== mapId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xoá bản đồ thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  if (err) return <div className="max-w-3xl px-4 text-red-400">{err}</div>;

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">Gần đây</h1>
        <div className="flex items-center gap-2 relative">
          <div className="relative z-50">
            <button
              ref={viewBtnRef}
              onClick={() => setViewOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              aria-haspopup="menu"
              aria-expanded={viewOpen}
            >
              Hiển thị ▾
            </button>

            {viewOpen && (
              <div
                ref={viewMenuRef}
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-zinc-900/95 shadow-2xl p-2 z-50 pointer-events-auto"
              >
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">
                  HIỂN THỊ MỤC THEO DẠNG
                </div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    role="menuitem"
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${viewMode === m ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => { setViewMode(m); setViewOpen(false); }}
                  >
                    {m === "grid" ? "Lưới" : "Danh sách"}
                  </button>
                ))}

                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">
                  SẮP XẾP THEO
                </div>
                {([
                  ["recentlyModified", "Chỉnh sửa gần đây"],
                  ["dateCreated", "Ngày tạo"],
                  ["name", "Tên"],
                ] as readonly [SortKey, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    role="menuitem"
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortKey === k ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => { setSortKey(k); setViewOpen(false); }}
                  >
                    {label}
                  </button>
                ))}

                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">
                  THỨ TỰ
                </div>
                {(["desc", "asc"] as const).map((o) => (
                  <button
                    key={o}
                    role="menuitem"
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortOrder === o ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => { setSortOrder(o); setViewOpen(false); }}
                  >
                    {o === "desc" ? "Giảm dần" : "Tăng dần"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={clickNewMap}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            Tạo bản đồ
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Bản đồ của bạn</h2>

        {sortedMaps.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-zinc-400 mb-4">Bạn chưa có bản đồ nào.</p>
            <button
              onClick={clickNewMap}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
            >
              Tạo bản đồ mới
            </button>
          </div>
        )}

        {sortedMaps.length > 0 && viewMode === "grid" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedMaps.map((m) => (
              <li
                key={m.id}
                className="group relative rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4"
                title={m.name}
              >
                <div className="absolute right-2 top-2 z-10" data-menu-container>
                  <button
                    aria-label="Thao tác khác"
                    title="Thao tác khác"
                    className="h-8 w-8 grid place-items-center rounded-md hover:bg-white/10 border border-white/10 text-lg leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId((id) => (id === m.id ? null : m.id));
                    }}
                  >
                    ⋯
                  </button>
                  {menuOpenId === m.id && (
                    <div
                      className="absolute right-0 mt-2 w-44 rounded-md border border-white/10 bg-zinc-900/95 shadow-lg"
                      onMouseLeave={() => setMenuOpenId(null)}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        disabled={deletingId === m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMap(m.id);
                        }}
                      >
                        {deletingId === m.id ? "Đang xoá..." : "Xoá bản đồ"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between -mt-1 mb-2 pr-10">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                      onClick={() => openEdit(m)}
                    >
                      Sửa chi tiết
                    </button>
                  </div>
                </div>

                <div
                  className="h-32 w-full mb-3 cursor-pointer"
                  onClick={() => router.push(`/maps/${m.id}`)}
                >
                  <Thumb src={m.previewImageUrl ?? undefined} fallbackKey={m.id} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name || "Chưa đặt tên"}</div>
                    <div className="text-xs text-zinc-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <button
                    className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => router.push(`/maps/${m.id}`)}
                  >
                    Mở
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {sortedMaps.length > 0 && viewMode === "list" && (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-zinc-300">
                <tr>
                  <th className="text-left px-3 py-2">Tên</th>
                  <th className="text-left px-3 py-2">Ngày tạo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedMaps.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="px-3 py-2">
                      <button
                        className="text-emerald-300 hover:underline"
                        onClick={() => router.push(`/maps/${m.id}`)}
                      >
                        {m.name || "Chưa đặt tên"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1 relative" data-menu-container>
                        <button
                          className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                          onClick={() => openEdit(m)}
                        >
                          Sửa chi tiết
                        </button>
                        <button
                          className="text-xl leading-none px-2 py-1 rounded hover:bg-white/5"
                          title="Thao tác khác"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((id) => (id === m.id ? null : m.id));
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpenId === m.id && (
                          <div
                            className="absolute right-0 mt-1 w-40 rounded-md border border-white/10 bg-zinc-900/95 shadow-lg z-10"
                            onMouseLeave={() => setMenuOpenId(null)}
                          >
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                              disabled={deletingId === m.id}
                              onClick={() => handleDeleteMap(m.id)}
                            >
                              {deletingId === m.id ? "Đang xoá..." : "Xoá bản đồ"}
                            </button>
                          </div>
                        )}
                        <button
                          className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                          onClick={() => router.push(`/maps/${m.id}`)}
                        >
                          Mở
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Ví dụ</h2>
        {actionErr && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200">
            {actionErr}
          </div>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SAMPLES.map((s) => (
            <li key={s.key} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <Thumb fallbackKey={s.key} />
              <div className="mt-3">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-zinc-400">{s.author}</div>
              </div>
              <p className="mt-2 text-sm text-zinc-300 line-clamp-2">{s.blurb}</p>
              <div className="mt-2 text-xs text-zinc-400">{s.lastViewed}</div>
              <div className="mt-3">
                <button
                  onClick={() => createFromSample(s)}
                  disabled={busyKey === s.key}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-70"
                >
                  {busyKey === s.key ? "Đang tạo…" : "Dùng mẫu này"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {edit.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Sửa chi tiết bản đồ</h3>
              <button className="text-zinc-300 hover:text-white" onClick={closeEdit}>
                ✕
              </button>
            </div>

            {edit.error && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200">
                {edit.error}
              </div>
            )}

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-zinc-300">Tên bản đồ</span>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={edit.name}
                  onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                  maxLength={150}
                />
              </label>

              <label className="block">
                <span className="text-sm text-zinc-300">Mô tả</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50"
                  rows={3}
                  value={edit.description}
                  onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
                  maxLength={1000}
                />
              </label>

              <div>
                <div className="text-sm text-zinc-300 mb-1">Ảnh xem trước</div>
                <div className="flex items-start gap-3">
                  <div className="h-24 w-40 rounded-md border border-white/10 overflow-hidden bg-zinc-800">
                    {edit.previewLocal ? (
                      <img src={edit.previewLocal} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-zinc-500">
                        Chưa có ảnh
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-block">
                      <span className="px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer text-sm">
                        Chọn tệp
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f) {
                            const dataUrl = await fileToDataUrl(f);
                            setEdit((s) => ({ ...s, previewFile: f, previewLocal: dataUrl }));
                          } else {
                            setEdit((s) => ({ ...s, previewFile: null, previewLocal: null }));
                          }
                        }}
                      />
                    </label>
                    <button
                      className="text-xs text-zinc-400 hover:text-zinc-200 text-left"
                      onClick={() => setEdit((s) => ({ ...s, previewLocal: null, previewFile: null }))}
                    >
                      Gỡ ảnh
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-400">PNG/JPG, khuyến nghị ≤ 2MB.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                onClick={closeEdit}
                disabled={edit.saving}
              >
                Hủy
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400 disabled:opacity-70"
                onClick={saveEdit}
                disabled={edit.saving}
              >
                {edit.saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
