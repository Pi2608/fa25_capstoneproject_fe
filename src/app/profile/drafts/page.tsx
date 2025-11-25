"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyDraftMaps, MapDto, MapStatus, publishMap } from "@/lib/api-maps";
import { useI18n } from "@/i18n/I18nProvider";

type DraftItem = MapDto & { status?: MapStatus | string };

export default function DraftsPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const mine = await getMyDraftMaps();
      setItems(mine as DraftItem[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("drafts.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    return arr.reverse();
  }, [items]);

  const onPublish = async (mapId: string) => {
    setPublishingId(mapId);
    try {
      await publishMap(mapId);
      setItems((prev) => prev.filter((x) => x.mapId !== mapId));
    } catch (e) {
      alert(e instanceof Error ? e.message : t("drafts.publish_failed"));
    } finally {
      setPublishingId(null);
    }
  };

  if (loading)
    return (
      <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">
        {t("drafts.loading")}
      </div>
    );
  if (err) return <div className="max-w-3xl px-4 text-red-400">{err}</div>;

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">{t("drafts.title")}</h1>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-zinc-400">{t("drafts.empty")}</p>
          <div className="mt-4">
            <button
              onClick={() => router.push("/maps/new")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
            >
              {t("drafts.btn_new_map")}
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((m) => (
            <li
              key={m.mapId}
              className="group relative rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4"
            >
              <div className="mb-3">
                <div className="text-xs inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-500/10 text-amber-200 px-2 py-0.5">
                  {t("drafts.badge_draft")}
                </div>
              </div>

              <div
                className="h-32 w-full mb-3 cursor-pointer"
                onClick={() => router.push(`/maps/${m.mapId}`)}
              >
                <div className="h-full w-full rounded-lg border border-white/10 overflow-hidden bg-zinc-900/40 grid place-items-center">
                  <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {m.mapName || t("drafts.untitled")}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => router.push(`/maps/${m.mapId}`)}
                  >
                    {t("drafts.btn_open")}
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400 disabled:opacity-60"
                    disabled={publishingId === m.mapId}
                    onClick={() => onPublish(m.mapId)}
                  >
                    {publishingId === m.mapId
                      ? t("drafts.publishing")
                      : t("drafts.btn_publish")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
