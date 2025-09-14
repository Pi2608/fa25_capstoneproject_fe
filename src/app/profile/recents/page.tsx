"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyMaps,
  type MapDto,
} from "@/lib/api";

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "name";
type SortOrder = "asc" | "desc";

export default function RecentsPage() {
  const router = useRouter();

  const [maps, setMaps] = useState<MapDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await getMyMaps();
        if (!alive) return;
        setMaps(res);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không tải được danh sách bản đồ.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const clickNewMap = useCallback(() => {
    router.push("/maps/new");
  }, [router]);

  const sortedMaps = useMemo(() => {
    const arr = [...maps];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      const aTime = new Date(a.createdAt ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? 0).getTime();
      return aTime - bTime;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [maps, sortKey, sortOrder]);

  if (loading) {
    return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  }
  if (err) {
    return <div className="max-w-3xl px-4 text-red-400">{err}</div>;
  }

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">Recents</h1>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setViewOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            >
              View ▾
            </button>
            {viewOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl p-2"
                onMouseLeave={() => setViewOpen(false)}
              >
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Show items as</div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${viewMode === m ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => setViewMode(m)}
                  >
                    {m === "grid" ? "Grid" : "List"}
                  </button>
                ))}
                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Sort by</div>
                {(
                  [
                    ["recentlyModified", "Recently modified"],
                    ["dateCreated", "Date created"],
                    ["name", "Name"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortKey === k ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}
                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Order</div>
                {(["desc", "asc"] as SortOrder[]).map((o) => (
                  <button
                    key={o}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortOrder === o ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => setSortOrder(o)}
                  >
                    {o === "desc" ? "Descending" : "Ascending"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={clickNewMap}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            New map
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Your maps</h2>

        {sortedMaps.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-zinc-400 mb-4">Bạn chưa có bản đồ nào.</p>
            <button
              onClick={clickNewMap}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
            >
              Create a map
            </button>
          </div>
        )}

        {sortedMaps.length > 0 && viewMode === "grid" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedMaps.map((m) => (
              <li
                key={m.id}
                className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4 cursor-pointer"
                onClick={() => router.push(`/maps/${m.id}`)}
                title={m.name}
              >
                <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                  Preview
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name || "Untitled"}</div>
                    <div className="text-xs text-zinc-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/maps/${m.id}`);
                    }}
                  >
                    Edit
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
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Created</th>
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
                        {m.name || "Untitled"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => router.push(`/maps/${m.id}`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
