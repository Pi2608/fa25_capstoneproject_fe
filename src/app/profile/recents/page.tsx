"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { convertPresetToNewFormat } from "@/utils/mapApiHelpers";
import {
  createMap,
  createMapFromTemplate,
  createDefaultMap,
  deleteMap,
  getMyRecentMaps,
  getMapDetail,
  MapDto,
  updateMap,
  UpdateMapRequest,
} from "@/lib/api-maps";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

type ViewMode = "grid" | "list";

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
    title: "Example: Reservoir Levels & Precipitation",
    author: "Yen Nhi Dang",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Combine reservoir level overlays with accumulated precipitation.",
    preset: {
      name: "Reservoir Levels & Precip",
      baseMapProvider: "OSM",
      initialLatitude: 15.95,
      initialLongitude: 107.8,
      initialZoom: 5,
    },
  },
  {
    key: "sandy-inundation",
    title: "Example: Hurricane Sandy Inundation Zone",
    author: "Yen Nhi Dang",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Historic storm surge zones for quick risk illustration.",
    preset: {
      name: "Sandy Inundation Zone",
      baseMapProvider: "OSM",
      initialLatitude: 40.71,
      initialLongitude: -74.0,
      initialZoom: 10,
    },
  },
  {
    key: "bike-collisions",
    title: "Example: City of Toronto Bike Collisions",
    author: "Yen Nhi Dang",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Point dataset for bicycle collision safety analysis.",
    preset: {
      name: "Toronto Bike Collisions",
      baseMapProvider: "OSM",
      initialLatitude: 43.65,
      initialLongitude: -79.38,
      initialZoom: 11,
    },
  },
  {
    key: "sales-territories",
    title: "Example: Sales Territories",
    author: "Yen Nhi Dang",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Territory boundaries and regional assignments.",
    preset: {
      name: "Sales Territories",
      baseMapProvider: "OSM",
      initialLatitude: 39.5,
      initialLongitude: -98.35,
      initialZoom: 4,
    },
  },
  {
    key: "getting-started",
    title: "Getting started with Felt",
    author: "Yen Nhi Dang",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Onboarding sample with basic point and area layers.",
    preset: {
      name: "Getting Started",
      baseMapProvider: "OSM",
      initialLatitude: 21.03,
      initialLongitude: 105.85,
      initialZoom: 11,
    },
  },
];

function Thumb({ src, fallbackKey, isDark }: { src?: string | null; fallbackKey: string; isDark: boolean }) {
  const palette: Record<string, string> = {
    "reservoir-precip": "from-cyan-700 to-emerald-700",
    "sandy-inundation": "from-amber-600 to-rose-600",
    "bike-collisions": "from-fuchsia-700 to-indigo-700",
    "sales-territories": "from-emerald-700 to-teal-700",
    "getting-started": "from-zinc-700 to-zinc-800",
  };
  if (src) {
    return (
      <div className={`h-32 w-full rounded-lg border overflow-hidden ${isDark ? "border-white/10 bg-zinc-900/40" : "border-gray-200 bg-gray-100"}`}>
        <img src={src} alt="preview" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  const bg = palette[fallbackKey] ?? "from-zinc-700 to-zinc-800";
  return (
    <div className={`h-32 w-full rounded-lg border bg-gradient-to-br ${bg} grid place-items-center ${isDark ? "border-white/10" : "border-gray-200"}`}>
      <div className={`h-16 w-16 rounded-full backdrop-blur-sm ${isDark ? "bg-white/10" : "bg-white/20"}`} />
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

type PublishedMap = MapDto & {
  publishedAt?: string | null;
  workspaceId?: string | null;
  orgId?: string | null;
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
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [maps, setMaps] = useState<PublishedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    map: PublishedMap | null;
  }>({
    open: false,
    map: null,
  });

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
      const base = await getMyRecentMaps(20);

      // Map directly from API response without needing to fetch details
      const recentMaps = base.map((m: any) => ({
        id: m.id ?? m.mapId ?? "",
        name: m.name ?? m.mapName ?? "Untitled Map",
        description: m.description ?? "",
        isPublic: m.isPublic ?? false,
        previewImage: m.previewImage ?? m.previewImageUrl ?? null,
        createdAt: m.createdAt ?? m.lastActivityAt ?? null,
        updatedAt: m.updatedAt ?? null,
        lastActivityAt: m.lastActivityAt ?? m.createdAt ?? null,
        ownerId: m.ownerId ?? null,
        ownerName: m.ownerName ?? null,
        isOwner: m.isOwner ?? true,
        workspaceName: m.workspaceName ?? null,
        publishedAt: m.publishedAt ?? (m.status === "Published" || m.status === "published" ? m.createdAt : null),
        workspaceId: m.workspaceId ?? m.workspace_id ?? null,
        orgId: m.organizationId ?? m.orgId ?? m.org_id ?? null,
        status: m.status ?? "Draft",
      })) as PublishedMap[];

      setMaps(recentMaps);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load your maps.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyMaps();
  }, [loadMyMaps]);

  const clickNewMap = useCallback(async () => {
    const created = await createDefaultMap({
      name: "Untitled Map",
      workspaceId: null,
    });

    router.push(`/maps/${created.mapId}`);
  }, [router]);

  const createFromSample = async (s: Sample) => {
    setActionErr(null);
    setBusyKey(s.key);
    try {
      if (s.templateId) {
        const r = await createMapFromTemplate({
          templateId: s.templateId,
          customName: (s.title ?? s.preset?.name ?? "Bản đồ mới từ template").trim(),
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
      setActionErr("Could not create a map from this template.");
    } finally {
      setBusyKey(null);
    }
  };

  const openEdit = (m: PublishedMap) => {
    setMenuOpenId(null);
    setEdit({
      open: true,
      map: m,
      name: m.name ?? "",
      description: m.description ?? "",
      previewLocal: (m as any).previewImage ?? null,
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
      await updateMap((edit.map as any).id, body);
      setMaps((ms) =>
        ms.map((m) =>
          m.id === (edit.map as any).id
            ? ({
              ...m,
              name: body.name ?? "",
              description: body.description ?? "",
              previewImage: body.previewImageUrl ?? "",
            } as PublishedMap)
            : m
        )
      );
      closeEdit();
    } catch (e) {
      setEdit((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Failed to save changes.",
        saving: false,
      }));
    }
  };

  const handleDeleteMap = async (map: PublishedMap) => {
    setMenuOpenId(null);
    setDeletingId(map.id);
    try {
      await deleteMap(map.id);
      setMaps((ms) => ms.filter((m) => m.id !== map.id));
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Không thể xóa bản đồ. Vui lòng thử lại sau."
      );
    } finally {
      setDeletingId(null);
      setConfirmDelete({ open: false, map: null });
    }
  };

  const openDeleteConfirm = (map: PublishedMap) => {
    setMenuOpenId(null);
    setConfirmDelete({ open: true, map });
  };

  const closeDeleteConfirm = () => {
    if (deletingId) return;
    setConfirmDelete({ open: false, map: null });
  };

  const handleOpenCreateSession = useCallback(
    (map: PublishedMap) => {
      if (!map.workspaceId || !map.orgId) {
        alert("Map này chưa nằm trong workspace/organization nên không tạo session được.");
        return;
      }
      const search = new URLSearchParams({
        workspaceId: map.workspaceId,
        mapId: map.id,
      });
      router.push(`/profile/organizations/${map.orgId}/sessions/create?${search.toString()}`);
    },
    [router]
  );

  if (loading) return <div className={`min-h-[60vh] animate-pulse px-4 ${themeClasses.textMuted}`}>Loading…</div>;
  if (err) return <div className={`max-w-3xl px-4 ${isDark ? "text-red-400" : "text-red-600"}`}>{err}</div>;

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className={`text-2xl sm:text-3xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Recents</h1>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setViewOpen((v) => !v)}
              className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`}
            >
              View ▾
            </button>
            {viewOpen && (
              <div
                className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-xl p-2 backdrop-blur-md ${themeClasses.panel}`}
                onMouseLeave={() => setViewOpen(false)}
              >
                <div className={`px-2 py-1 text-xs uppercase tracking-wide ${themeClasses.textMuted}`}>
                  Show items as
                </div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-white/5 ${viewMode === m ? (isDark ? "text-emerald-300" : "text-emerald-600") : (isDark ? "text-zinc-200" : "text-gray-700")
                      }`}
                    onClick={() => setViewMode(m)}
                  >
                    {m === "grid" ? "Grid" : "List"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={clickNewMap}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400"
          >
            New map
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className={`mb-3 text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Recent maps</h2>

        {maps.length === 0 && (
          <div className={`rounded-xl border p-6 text-center ${themeClasses.panel}`}>
            <p className={`mb-4 ${themeClasses.textMuted}`}>You have no maps yet.</p>
            <button
              onClick={clickNewMap}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400"
            >
              Create a map
            </button>
          </div>
        )}

        {maps.length > 0 && viewMode === "grid" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {maps.map((m) => (
              <li
                key={m.id}
                className={`group relative rounded-3xl border transition-all duration-200 p-4 ${m.publishedAt || (m as any).status === "Published"
                  ? (isDark ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-zinc-950/40 hover:border-emerald-400 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.5)]" : "border-emerald-500/60 bg-gradient-to-b from-emerald-50/40 to-white hover:border-emerald-400")
                  : (isDark ? "border-white/10 bg-zinc-900/40 hover:border-white/20" : "border-gray-200 bg-white hover:border-gray-300")
                  }`}
                title={m.name}
              >
                <div className="absolute top-5 right-6 z-10" data-menu-container>
                  <button
                    aria-label="More actions"
                    title="More actions"
                    className={`h-6 w-6 flex items-center justify-center text-lg leading-none ${isDark ? "text-zinc-100 hover:text-emerald-300" : "text-gray-700 hover:text-emerald-600"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId((id) => (id === m.id ? null : m.id));
                    }}
                  >
                    ⋯
                  </button>
                  {menuOpenId === m.id && (
                    <div
                      className={`absolute right-0 mt-2 w-44 rounded-xl border shadow-xl backdrop-blur-md ${themeClasses.panel}`}
                      onMouseLeave={() => setMenuOpenId(null)}
                    >
                      <button
                        className={`w-full text-left px-3 py-2 text-sm ${isDark ? "text-red-400 hover:bg-red-500/10 hover:text-red-300" : "text-red-600 hover:bg-red-50 hover:text-red-700"} disabled:opacity-60`}
                        disabled={deletingId === m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(m);
                        }}
                      >
                        {deletingId === m.id ? "Đang xóa..." : "Xóa bản đồ"}
                      </button>
                    </div>
                  )}
                </div>

                {(m.publishedAt || (m as any).status === "published") ? (
                  <div className={`mb-4 h-28 w-full rounded-2xl border flex items-center justify-center text-sm font-medium ${isDark
                      ? "border-emerald-500/40 bg-[radial-gradient(circle_at_0_0,#22c55e33,transparent_55%),radial-gradient(circle_at_100%_0,#22c55e22,transparent_55%)] bg-emerald-950/40 text-emerald-300"
                      : "border-emerald-500/60 bg-emerald-50/40 text-emerald-700"
                    }`}>
                    Đã publish
                  </div>
                ) : m.status === "archived" ? (
                  <div className={`mb-4 h-28 w-full rounded-2xl border flex items-center justify-center text-sm font-medium ${isDark
                      ? "border-slate-500/40 bg-[radial-gradient(circle_at_0_0,#64748b33,transparent_55%),radial-gradient(circle_at_100%_0,#64748b22,transparent_55%)] bg-slate-950/40 text-slate-300"
                      : "border-slate-500/60 bg-slate-50/40 text-slate-700"
                    }`}>
                    Archived
                  </div>
                ) : (
                  <div className={`mb-4 h-28 w-full rounded-2xl border flex items-center justify-center text-sm font-medium ${isDark
                      ? "border-blue-500/40 bg-[radial-gradient(circle_at_0_0,#3b82f633,transparent_55%),radial-gradient(circle_at_100%_0,#3b82f622,transparent_55%)] bg-blue-950/40 text-blue-300"
                      : "border-blue-500/60 bg-blue-50/40 text-blue-700"
                    }`}>
                    Draft
                  </div>
                )}

                <div className="min-w-0 mb-3">
                  <div className={`truncate font-semibold ${isDark ? "text-zinc-50" : "text-gray-900"}`}>
                    {m.name || "Untitled"}
                  </div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>
                    {m.publishedAt
                      ? `Publish: ${new Date(m.publishedAt).toLocaleDateString()}`
                      : m.createdAt
                        ? `Created: ${new Date(m.createdAt).toLocaleDateString()}`
                        : "—"}
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <button
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${themeClasses.button}`}
                    onClick={() => router.push(`/maps/${m.id}`)}
                  >
                    Mở map
                  </button>
                  {m.workspaceId && m.orgId && (
                    <button
                      className="w-full px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400"
                      onClick={() => handleOpenCreateSession(m)}
                    >
                      Tạo session
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {maps.length > 0 && viewMode === "list" && (
          <div className={`rounded-xl border overflow-hidden ${themeClasses.panel}`}>
            <table className="w-full text-sm">
              <thead className={`${isDark ? "bg-white/5" : "bg-gray-50"} ${themeClasses.tableHeader}`}>
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className={`divide-y ${themeClasses.tableBorder}`}>
                {maps.map((m) => (
                  <tr key={m.id} className={isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}>
                    <td className={`px-3 py-2 ${themeClasses.tableCell}`}>
                      <button
                        className={`hover:underline ${isDark ? "text-emerald-300" : "text-emerald-600"}`}
                        onClick={() => router.push(`/maps/${m.id}`)}
                      >
                        {m.name || "Untitled"}
                      </button>
                    </td>
                    <td className={`px-3 py-2 ${themeClasses.textMuted}`}>
                      {m.publishedAt
                        ? new Date(m.publishedAt).toLocaleString()
                        : m.createdAt
                          ? new Date(m.createdAt).toLocaleString()
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1 relative" data-menu-container>
                        <button
                          className={`text-xs px-2 py-1 rounded border ${themeClasses.button}`}
                          onClick={() => openEdit(m)}
                        >
                          Edit details
                        </button>
                        <button
                          className={`text-xl leading-none px-2 py-1 rounded ${isDark ? "hover:bg-white/5" : "hover:bg-gray-100"} ${isDark ? "text-zinc-200" : "text-gray-700"}`}
                          title="More actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((id) => (id === m.id ? null : m.id));
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpenId === m.id && (
                          <div
                            className={`absolute right-0 mt-1 w-40 rounded-xl border shadow-lg z-10 backdrop-blur-md ${themeClasses.panel}`}
                            onMouseLeave={() => setMenuOpenId(null)}
                          >
                            <button
                              className={`w-full text-left px-3 py-2 text-sm disabled:opacity-60 ${isDark ? "text-red-400 hover:bg-red-500/10 hover:text-red-300" : "text-red-600 hover:bg-red-50 hover:text-red-700"}`}
                              disabled={deletingId === m.id}
                              onClick={() => openDeleteConfirm(m)}
                            >
                              {deletingId === m.id ? "Đang xóa..." : "Xóa bản đồ"}
                            </button>
                          </div>
                        )}

                        <button
                          className={`text-xs px-2 py-1 rounded border ${themeClasses.button}`}
                          onClick={() => router.push(`/maps/${m.id}`)}
                        >
                          Mở map
                        </button>
                        {m.workspaceId && m.orgId && (
                          <button
                            className="text-xs px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-400"
                            onClick={() => handleOpenCreateSession(m)}
                          >
                            Tạo session
                          </button>
                        )}
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
        <h2 className={`mb-3 text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Examples</h2>
        {actionErr && (
          <div className={`mb-3 rounded-lg border px-3 py-2 ${isDark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
            {actionErr}
          </div>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SAMPLES.map((s) => (
            <li key={s.key} className={`rounded-xl border p-4 ${themeClasses.panel}`}>
              <Thumb fallbackKey={s.key} isDark={isDark} />
              <div className="mt-3">
                <div className={`font-semibold truncate ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{s.title}</div>
                <div className={`text-xs ${themeClasses.textMuted}`}>{s.author}</div>
              </div>
              <p className={`mt-2 text-sm line-clamp-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>{s.blurb}</p>
              <div className={`mt-2 text-xs ${themeClasses.textMuted}`}>{s.lastViewed}</div>
              <div className="mt-3">
                <button
                  onClick={() => createFromSample(s)}
                  disabled={busyKey === s.key}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-70"
                >
                  {busyKey === s.key ? "Creating…" : "Use this template"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {confirmDelete.open && confirmDelete.map && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${themeClasses.panel}`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>Xóa bản đồ?</h3>
            <p className={`text-sm mb-4 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
              Bạn có chắc chắn muốn xóa{" "}
              <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {confirmDelete.map.name?.trim() || "bản đồ này"}
              </span>
              ? Hành động này{" "}
              <span className={`font-medium ${isDark ? "text-red-400" : "text-red-600"}`}>không thể hoàn tác</span>.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={closeDeleteConfirm}
                disabled={!!deletingId}
                className={`px-3 py-1.5 rounded-lg border text-sm disabled:opacity-60 ${isDark ? "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700" : "border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                Hủy
              </button>
              <button
                onClick={() => confirmDelete.map && handleDeleteMap(confirmDelete.map)}
                disabled={deletingId === confirmDelete.map.id}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingId === confirmDelete.map.id ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {edit.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className={`w-full max-w-lg rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Edit map details</h3>
              <button className={`${isDark ? "text-zinc-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`} onClick={closeEdit}>
                ✕
              </button>
            </div>

            {edit.error && (
              <div className={`mb-3 rounded-lg border px-3 py-2 ${isDark ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
                {edit.error}
              </div>
            )}

            <div className="space-y-3">
              <label className="block">
                <span className={`text-sm ${themeClasses.textMuted}`}>Map name</span>
                <input
                  className={`mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 ${themeClasses.input}`}
                  value={edit.name}
                  onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                  maxLength={150}
                />
              </label>

              <label className="block">
                <span className={`text-sm ${themeClasses.textMuted}`}>Description</span>
                <textarea
                  className={`mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/50 ${themeClasses.input}`}
                  rows={3}
                  value={edit.description}
                  onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
                  maxLength={1000}
                />
              </label>

              <div>
                <div className={`text-sm mb-1 ${themeClasses.textMuted}`}>Preview image</div>
                <div className="flex items-start gap-3">
                  <div className={`h-24 w-40 rounded-md border overflow-hidden ${isDark ? "bg-zinc-800 border-white/10" : "bg-gray-100 border-gray-200"}`}>
                    {edit.previewLocal ? (
                      <img src={edit.previewLocal} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className={`h-full w-full grid place-items-center text-xs ${themeClasses.textMuted}`}>
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-block">
                      <span className={`px-3 py-1.5 rounded-md border cursor-pointer text-sm ${themeClasses.button}`}>
                        Choose file
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f) {
                            await handleImagePick(f);
                          } else {
                            setEdit((s) => ({ ...s, previewFile: null, previewLocal: null }));
                          }
                        }}
                      />
                    </label>
                    <button
                      className={`text-xs text-left ${themeClasses.textMuted} hover:${isDark ? "text-zinc-200" : "text-gray-900"}`}
                      onClick={() => setEdit((s) => ({ ...s, previewLocal: null, previewFile: null }))}
                    >
                      Remove image
                    </button>
                  </div>
                </div>
                <p className={`mt-1 text-xs ${themeClasses.textMuted}`}>PNG/JPG, khuyến nghị ≤ 2MB.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className={`px-3 py-1.5 rounded-md border ${themeClasses.button}`}
                onClick={closeEdit}
                disabled={edit.saving}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-70"
                onClick={saveEdit}
                disabled={edit.saving}
              >
                {edit.saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
