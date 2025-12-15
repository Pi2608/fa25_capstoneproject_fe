"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyDraftMaps, MapDto, MapStatus, publishMap } from "@/lib/api-maps";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

type DraftItem = MapDto & {
  status?: MapStatus | string;
  mapId?: string;
  mapName?: string;
};

export default function DraftsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const mine = await getMyDraftMaps();
      const normalized: DraftItem[] = mine.map((m) => {
        const anyM = m as any;
        return {
          ...m,
          mapId: anyM.mapId ?? anyM.id,
          mapName: anyM.mapName ?? anyM.name,
        };
      });
      setItems(normalized);
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
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
    return arr;
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

  if (loading) {
    return (
      <div suppressHydrationWarning className={`min-h-[60vh] animate-pulse px-4 ${themeClasses.textMuted}`}>
        {t("drafts.loading")}
      </div>
    );
  }

  if (err) {
    return <div suppressHydrationWarning className={`max-w-3xl px-4 ${isDark ? "text-red-400" : "text-red-600"}`}>{err}</div>;
  }

  return (
    <div className="min-w-0 relative px-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className={`text-2xl sm:text-3xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
          {t("drafts.title")}
        </h1>
      </div>

      {sorted.length === 0 ? (
        <div className={`rounded-xl border p-6 text-center ${themeClasses.panel}`}>
          <p className={themeClasses.textMuted}>{t("drafts.empty")}</p>
          <div className="mt-4">
            <button
              onClick={() => router.push("/maps/new")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400"
            >
              {t("drafts.btn_new_map")}
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((m) => {
            const mapId = m.mapId as string;
            const mapName = m.mapName || t("drafts.untitled");
            return (
              <li
                key={mapId}
                className={`group relative rounded-xl border transition p-4 ${themeClasses.panel} ${isDark ? "hover:bg-zinc-800/60" : "hover:bg-gray-50"}`}
              >
                <div className="mb-3">
                  <div className={`text-xs inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                    isDark 
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200" 
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}>
                    {t("drafts.badge_draft")}
                  </div>
                </div>

                <div
                  className="h-32 w-full mb-3 cursor-pointer"
                  onClick={() => router.push(`/maps/${mapId}`)}
                >
                  <div className={`h-full w-full rounded-lg border overflow-hidden grid place-items-center ${
                    isDark 
                      ? "border-white/10 bg-zinc-900/40" 
                      : "border-gray-200 bg-gray-100"
                  }`}>
                    <div className={`h-16 w-16 rounded-full backdrop-blur-sm ${
                      isDark ? "bg-white/10" : "bg-white/20"
                    }`} />
                  </div>
                </div>

                {/* Hàng dưới: bên trái flex-1, nút bên phải không bị xuống dòng */}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                      {mapName}
                    </div>
                    <div className={`text-xs ${themeClasses.textMuted}`}>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      className={`text-xs px-2 py-1 rounded border ${themeClasses.button}`}
                      onClick={() => router.push(`/maps/${mapId}`)}
                    >
                      {t("drafts.btn_open")}
                    </button>

                    <button
                      className="text-xs px-2 py-1 rounded bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap"
                      disabled={publishingId === mapId}
                      onClick={() => onPublish(mapId)}
                    >
                      {publishingId === mapId ? "Publishing…" : "Publish map"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
