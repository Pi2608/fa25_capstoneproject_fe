"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { Workspace } from "@/types/workspace";
import { formatDate } from "@/utils/formatUtils";
import { getOrganizationById, OrganizationDetailDto } from "@/lib/api-organizations";
import { createMap, deleteMap } from "@/lib/api-maps";
import { getWorkspaceById, getWorkspaceMaps, removeMapFromWorkspace } from "@/lib/api-workspaces";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name" | "author";

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

export default function WorkspaceDetailPage() {
  const p = useParams<{ orgId: string; workspaceid: string }>();
  const orgId = p?.orgId ?? "";
  const workspaceId = p?.workspaceid ?? "";
  const router = useRouter();
  const { showToast } = useToast();

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [deleteMapOpen, setDeleteMapOpen] = useState<{
    open: boolean;
    mapId?: string;
    mapName?: string;
  }>({ open: false });
  const [deleteMapLoading, setDeleteMapLoading] = useState(false);

  const handleCreateMap = useCallback(async () => {
    try {
      const center = { lat: 10.78, lng: 106.69 };
      const zoom = 13;
      const latDiff = 180 / Math.pow(2, zoom);
      const lngDiff = 360 / Math.pow(2, zoom);
      const defaultBounds = JSON.stringify({
        type: "Polygon",
        coordinates: [[
          [center.lng - lngDiff / 2, center.lat - latDiff / 2],
          [center.lng + lngDiff / 2, center.lat - latDiff / 2],
          [center.lng + lngDiff / 2, center.lat + latDiff / 2],
          [center.lng - lngDiff / 2, center.lat + latDiff / 2],
          [center.lng - lngDiff / 2, center.lat - latDiff / 2],
        ]],
      });
      const viewState = JSON.stringify({ center: [center.lat, center.lng], zoom });

      const created = await createMap({
        name: "Untitled Map",
        description: "",
        isPublic: false,
        defaultBounds,
        viewState,
        baseMapProvider: "OSM",
        workspaceId,
      });
      router.push(`/maps/${created.mapId}?created=1`);
    } catch (e) {
      showToast("error", safeMessage(e));
    }
  }, [router, showToast, workspaceId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [orgRes, workspaceRes, mapsRes] = await Promise.all([
        getOrganizationById(orgId),
        getWorkspaceById(workspaceId),
        getWorkspaceMaps(workspaceId),
      ]);
      setOrg(orgRes.organization);
      setWorkspace(workspaceRes);
      // Ensure maps is always an array
      const mapsArray = Array.isArray(mapsRes) ? mapsRes : ((mapsRes as any)?.maps || []);
      setMaps(mapsArray);
    } catch (e) {
      setErr(safeMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspaceId]);

  useEffect(() => {
    if (orgId && workspaceId) void loadData();
  }, [orgId, workspaceId, loadData]);

  const sortedMaps = useMemo(() => {
    const arr = [...maps];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      if (sortKey === "author") {
        return (a.ownerId || "").localeCompare(b.ownerId || "", undefined, { sensitivity: "base" });
      }
      const ad = new Date(a.createdAt ?? 0).getTime();
      const bd = new Date(b.createdAt ?? 0).getTime();
      return ad - bd;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [maps, sortKey, sortOrder]);


  const handleDeleteMap = useCallback(async () => {
    if (!deleteMapOpen.mapId) return;

    setDeleteMapLoading(true);
    try {
      await deleteMap(deleteMapOpen.mapId);
      showToast("success", "Xóa map thành công!");
      setDeleteMapOpen({ open: false });
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    } finally {
      setDeleteMapLoading(false);
    }
  }, [deleteMapOpen.mapId, showToast, loadData]);

  const handleRemoveMapFromWorkspace = useCallback(async (mapId: string) => {
    try {
      await removeMapFromWorkspace(workspaceId, mapId);
      showToast("success", "Đã gỡ map khỏi workspace!");
      await loadData();
    } catch (e) {
      showToast("error", safeMessage(e));
    }
  }, [workspaceId, showToast, loadData]);

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  if (err || !org || !workspace) return <div className="max-w-3xl px-4 text-red-400">{err ?? "Không tìm thấy workspace."}</div>;

  return (
    <div className="min-w-0 relative px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/profile/organizations/${orgId}/workspaces`)}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">{workspace.workspaceName}</h1>
            <p className="text-sm text-zinc-400">{org.orgName}</p>
            {workspace.description && (
              <p className="text-sm text-zinc-500 mt-1">{workspace.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleCreateMap()}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            New Map
          </button>
        </div>
      </div>

      {/* View Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-white/10" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-sm text-zinc-100"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="dateCreated">Date created</option>
            <option value="recentlyModified">Recently modified</option>
            <option value="name">Name</option>
            <option value="author">Author</option>
          </select>
          <button
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Maps List */}
      {sortedMaps.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">No maps in this workspace</h3>
          <p className="text-zinc-400 mb-4">Create your first map to get started</p>
          <button
            onClick={() => void handleCreateMap()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Map
          </button>
        </div>
      )}

      {sortedMaps.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedMaps.map((map) => (
            <div
              key={map.id}
              className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4"
            >
              <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{map.name || "Untitled"}</div>
                  <div className="text-xs text-zinc-400">
                    {map.createdAt ? formatDate(map.createdAt) : "—"}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    className="p-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
                    onClick={() => router.push(`/maps/${map.id}`)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="p-1 rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-xs text-orange-300"
                    onClick={() => void handleRemoveMapFromWorkspace(map.id)}
                    title="Remove from project"
                  >
                    📤
                  </button>
                  <button
                    className="p-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300"
                    onClick={() => {
                      setDeleteMapOpen({
                        open: true,
                        mapId: map.id,
                        mapName: map.name || "Untitled",
                      });
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => router.push(`/maps/${map.id}`)}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                >
                  Open Map
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sortedMaps.length > 0 && viewMode === "list" && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Author</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sortedMaps.map((map) => (
                <tr key={map.id} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <button
                      className="text-emerald-300 hover:underline"
                      onClick={() => router.push(`/maps/${map.id}`)}
                    >
                      {map.name || "Untitled"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{map.ownerId || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {map.createdAt ? formatDate(map.createdAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => router.push(`/maps/${map.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300"
                        onClick={() => void handleRemoveMapFromWorkspace(map.id)}
                      >
                        Remove
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300"
                        onClick={() => {
                          setDeleteMapOpen({
                            open: true,
                            mapId: map.id,
                            mapName: map.name || "Untitled",
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Map Modal */}
      {deleteMapOpen.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-4">Delete Map</h2>
            <p className="text-sm text-zinc-300 mb-6">
              Are you sure you want to delete the map <span className="font-semibold">{deleteMapOpen.mapName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setDeleteMapOpen({ open: false })}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteMap()}
                disabled={deleteMapLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteMapLoading ? "Deleting..." : "Delete Map"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
