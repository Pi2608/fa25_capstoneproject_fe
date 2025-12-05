"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getPublishedGalleryMaps,
  getPublishedGalleryMapById,
  getPublishedGalleryMapByMapId,
  MapGalleryCategory,
  MapGalleryDetailResponse,
  MapGallerySummaryResponse,
} from "@/lib/api-map-gallery";

gsap.registerPlugin(ScrollTrigger);

type MapItem = MapGallerySummaryResponse & {
  href: string;
  duplicateHref: string;
};

type GalleryMapDetail = MapGalleryDetailResponse;

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 5c5.05 0 9.27 3.11 10.76 7.5C21.27 16.89 17.05 20 12 20S2.73 16.89 1.24 12.5C2.73 8.11 6.95 5 12 5Zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
      />
    </svg>
  );
}

function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 21s-6.72-4.14-9.19-8.21C.67 9.64 2.64 6 6.23 6c2.01 0 3.19 1.12 3.77 2.06.58-.94 1.76-2.06 3.77-2.06 3.59 0 5.56 3.64 3.42 6.79C18.72 16.86 12 21 12 21Z"
      />
    </svg>
  );
}

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"
      />
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z" />
    </svg>
  );
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
      {children}
    </span>
  );
}

const fmt = (n: number) => Intl.NumberFormat().format(n);
type SortKey = "popular" | "newest" | "likes";

const TAG_KEYS = [
  "All",
  "general",
  "business",
  "planning",
  "logistics",
  "research",
  "operations",
  "education",
] as const;

type TagKey = (typeof TAG_KEYS)[number];

const CATEGORY_BY_TAG: Record<TagKey, MapGalleryCategory | undefined> = {
  All: undefined,
  general: "general",
  business: "business",
  planning: "planning",
  logistics: "logistics",
  research: "research",
  operations: "operations",
  education: "education",
};

export default function GalleryClient() {
  const { t } = useI18n();
  const tr = (k: string) => t("gallery", k);

  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detail, setDetail] = useState<GalleryMapDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mapIdQuery, setMapIdQuery] = useState("");

  const [q, setQ] = useState("");
  const [tagKey, setTagKey] = useState<TagKey>("All");
  const [sort, setSort] = useState<SortKey>("popular");
  const [pageSize, setPageSize] = useState<12 | 18 | 24>(12);
  const [page, setPage] = useState(1);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const category = CATEGORY_BY_TAG[tagKey];
        const search = q.trim() || undefined;
        const featured = featuredOnly ? true : undefined;

        const data = await getPublishedGalleryMaps({
          category,
          search,
          featured,
        });

        if (!isMounted) return;

        const mapped: MapItem[] = data.map((m: MapGallerySummaryResponse) => ({
          ...m,
          href: `/maps/${m.mapId}`,
          duplicateHref: `/maps/${m.mapId}/duplicate`,
        }));

        setMaps(mapped);
      } catch (err: any) {
        if (!isMounted) return;
        setLoadError(err?.message || "Failed to load gallery maps");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [tagKey, q, featuredOnly]);

  const handleSelectByGalleryId = async (galleryId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await getPublishedGalleryMapById(galleryId);
      setDetail(d);
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load map detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearchByMapId = async () => {
    const id = mapIdQuery.trim();
    if (!id) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await getPublishedGalleryMapByMapId(id);
      setDetail(d);
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load map detail");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "ArrowRight") setPage((p) => p + 1);
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sorted = useMemo(() => {
    const list = [...maps];
    return list.sort((a, b) => {
      if (sort === "popular") return b.viewCount - a.viewCount;
      if (sort === "likes") return b.likeCount - a.likeCount;
      const da = a.publishedAt ?? a.createdAt;
      const db = b.publishedAt ?? b.createdAt;
      return +new Date(db) - +new Date(da);
    });
  }, [maps, sort]);

  const { pageItems, totalPages, from, to } = useMemo(() => {
    const total = sorted.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safe = Math.min(page, pages);
    const start = (safe - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    return { pageItems: sorted.slice(start, end), totalPages: pages, from: start + 1, to: end };
  }, [sorted, page, pageSize]);

  useEffect(() => setPage(1), [q, tagKey, sort, pageSize, featuredOnly]);

  useLayoutEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set(
        [".gal-hero-eyebrow", ".gal-hero-title", ".gal-hero-sub", ".gal-controls", ".gal-tags", ".gal-meta"],
        { autoAlpha: 0, y: 16 }
      );
      gsap
        .timeline()
        .to(".gal-hero-eyebrow", {
          autoAlpha: 1,
          y: 0,
          duration: reduce ? 0 : 0.5,
          ease: "power2.out",
        })
        .to(
          ".gal-hero-title",
          {
            autoAlpha: 1,
            y: 0,
            duration: reduce ? 0 : 0.7,
            ease: "power2.out",
          },
          "<0.06"
        )
        .to(
          ".gal-hero-sub",
          {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          },
          "<0.06"
        )
        .to(
          ".gal-controls",
          {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          },
          "<0.08"
        )
        .to(
          ".gal-tags",
          {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          },
          "<0.06"
        )
        .to(
          ".gal-meta",
          {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          },
          "<0.04"
        );

      ScrollTrigger.batch(".gal-tag-btn", {
        start: "top 95%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.05,
            ...baseIn,
          }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".gal-cta", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".gal-cta",
        start: "top 90%",
        onEnter: () =>
          gsap.to(".gal-cta", {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          }),
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cards = gsap.utils.toArray<HTMLElement>(".gal-card");
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: reduce ? 0 : 0.55,
        ease: "power2.out",
        stagger: 0.08,
      }
    );
  }, [pageItems, tagKey, sort, q, page, featuredOnly]);

  const renderTagFilterLabel = (key: TagKey) => {
    if (key === "All") return tr("tag_All");
    return tr(`category_${key}`);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="gal-hero-eyebrow text-sm tracking-wide text-emerald-300/90">
            {tr("hero_eyebrow")}
          </p>
          <h1 className="gal-hero-title mt-2 text-3xl font-semibold sm:text-4xl">
            {tr("hero_title")}
          </h1>
          <p className="gal-hero-sub mt-3 max-w-2xl text-zinc-300">
            {tr("hero_sub")}
          </p>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="gal-controls mt-6 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10 opacity-0 translate-y-[16px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("search_placeholder")}
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 pr-24 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                Ctrl K
              </span>
            </div>
          </div>

          <div className="sm:col-span-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            >
              <option value="popular">{tr("sort_popular")}</option>
              <option value="newest">{tr("sort_newest")}</option>
              <option value="likes">{tr("sort_likes")}</option>
            </select>
          </div>

          <div className="sm:col-span-1">
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value) as 12 | 18 | 24)
              }
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            >
              <option value={12}>{tr("page_size")}: 12</option>
              <option value={18}>{tr("page_size")}: 18</option>
              <option value={24}>{tr("page_size")}: 24</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => setFeaturedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
            />
            <span>{tr("featured_only")}</span>
          </label>
        </div>

        <div className="gal-tags mt-3 flex flex-wrap gap-2 opacity-0 translate-y-[16px]">
          {TAG_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setTagKey(k)}
              className={`gal-tag-btn opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tagKey === k
                  ? "bg-emerald-500 text-zinc-950"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"
              }`}
              aria-pressed={tagKey === k}
            >
              {renderTagFilterLabel(k)}
            </button>
          ))}
        </div>

        <div className="gal-meta mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400 opacity-0 translate-y-[16px]">
          <span>
            {sorted.length} {tr("results")} • {tr("showing")} “
            {renderTagFilterLabel(tagKey)}”
            {q ? ` • ${tr("searching_for")} “${q}”` : ""}
            {featuredOnly ? ` • ${tr("featured_badge")}` : ""}
          </span>
          <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
            {sorted.length ? `${from}–${to}` : "0–0"} {tr("of")}{" "}
            {sorted.length}
          </span>
        </div>
      </section>

      {loadError && (
        <section className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {loadError}
        </section>
      )}

      {loading ? (
        <section className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
          Loading gallery maps...
        </section>
      ) : pageItems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-8 text-center">
          <div className="text-lg font-medium">{tr("empty_title")}</div>
          <p className="mt-1 text-sm text-zinc-400">{tr("empty_sub")}</p>
          <div className="mt-4">
            <button
              onClick={() => {
                setQ("");
                setTagKey("All");
                setSort("popular");
                setFeaturedOnly(false);
              }}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              {tr("reset_filters")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((m) => (
              <article
                key={m.id}
                className="gal-card opacity-0 translate-y-[18px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5"
              >
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/5">
                  {m.previewImage ? (
                    <img
                      src={m.previewImage}
                      alt={m.mapName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
                  )}
                </div>

                <h3 className="mt-3 text-base font-semibold leading-snug">
                  {m.mapName}
                </h3>
                <div className="mt-1 text-xs text-zinc-400">
                  {tr("by")} {m.authorName} • {tr("updated")}{" "}
                  {new Date(m.publishedAt ?? m.createdAt).toLocaleDateString()}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <TagPill>{tr(`category_${m.category}`)}</TagPill>
                  {m.isFeatured && (
                    <TagPill>{tr("featured_badge")}</TagPill>
                  )}
                  {m.tags.map((t) => (
                    <TagPill key={t}>{t}</TagPill>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <EyeIcon className="h-4 w-4 text-emerald-300" />
                    {fmt(m.viewCount)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HeartIcon className="h-4 w-4 text-emerald-300" />
                    {fmt(m.likeCount)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={m.href}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                  >
                    {tr("view_map")}
                  </Link>
                  <Link
                    href={m.duplicateHref}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70"
                  >
                    <CopyIcon className="h-4 w-4" />
                    {tr("duplicate")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSelectByGalleryId(m.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-emerald-400/70"
                  >
                    Details
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-xs text-zinc-400">
              {sorted.length ? `${from}–${to}` : "0–0"} {tr("of")}{" "}
              {sorted.length} • {tr("page")} {Math.min(page, totalPages)} /{" "}
              {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  page <= 1
                    ? "cursor-not-allowed opacity-50 ring-white/10"
                    : "ring-white/15 hover:bg-white/5"
                }`}
              >
                {tr("prev")}
              </button>

              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`h-9 w-9 rounded-lg text-sm ${
                        page === n
                          ? "bg-emerald-500 text-zinc-950"
                          : "ring-1 ring-white/10 hover:bg-white/5"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                {totalPages > 7 && (
                  <span className="px-2 text-sm text-zinc-400">…</span>
                )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  page >= totalPages
                    ? "cursor-not-allowed opacity-50 ring-white/10"
                    : "ring-white/15 hover:bg-white/5"
                }`}
              >
                {tr("next")}
              </button>
            </div>
          </section>
        </>
      )}

      <section className="mt-10 rounded-2xl border border-emerald-500/20 bg-zinc-900/70 p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Selected map detail</h3>
            {detailLoading && (
              <p className="mt-2 text-sm text-zinc-400">Loading detail...</p>
            )}
            {detailError && (
              <p className="mt-2 text-sm text-red-300">{detailError}</p>
            )}
            {!detailLoading && !detail && !detailError && (
              <p className="mt-2 text-sm text-zinc-400">
                Choose a map card or search by Map ID to see detail here.
              </p>
            )}
            {detail && !detailLoading && (
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div className="text-base font-medium">{detail.mapName}</div>
                <div className="text-xs text-zinc-400">
                  Author: {detail.authorName} •{" "}
                  {(detail.publishedAt || detail.createdAt) &&
                    new Date(
                      detail.publishedAt || detail.createdAt
                    ).toLocaleDateString()}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">
                  {detail.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <TagPill>{tr(`category_${detail.category}`)}</TagPill>
                  {detail.isFeatured && (
                    <TagPill>{tr("featured_badge")}</TagPill>
                  )}
                  {detail.tags.map((t) => (
                    <TagPill key={t}>{t}</TagPill>
                  ))}
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                  Views: {fmt(detail.viewCount)} • Likes:{" "}
                  {fmt(detail.likeCount)}
                </div>
                <div className="mt-2 text-xs text-zinc-400 break-all">
                  Gallery ID: {detail.id}
                  <br />
                  Map ID: {detail.mapId}
                </div>
              </div>
            )}
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-950/70 p-4 text-sm">
            <div className="font-medium text-zinc-100">
              Find detail by Map ID
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Paste a Map ID to load its gallery detail using public API.
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={mapIdQuery}
                onChange={(e) => setMapIdQuery(e.target.value)}
                placeholder="Map ID..."
                className="w-full rounded-xl border border-zinc-700/70 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
              />
              <button
                type="button"
                onClick={handleSearchByMapId}
                className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Load detail by Map ID
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="gal-cta mt-10 opacity-0 translate-y-[16px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">{tr("cta_title")}</h3>
            <p className="mt-1 text-zinc-300">{tr("cta_sub")}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/resources/map-gallery/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {tr("cta_submit")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/resources/blog"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              {tr("cta_blog")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
