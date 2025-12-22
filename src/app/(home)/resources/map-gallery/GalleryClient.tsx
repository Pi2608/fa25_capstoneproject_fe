"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/contexts/ToastContext";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getPublishedGalleryMaps,
  getPublishedGalleryMapById,
  getPublishedGalleryMapByMapId,
  duplicateMapFromGallery,
  incrementGalleryMapView,
  toggleGalleryMapLike,
  MapGalleryCategory,
  MapGalleryDetailResponse,
  MapGallerySummaryResponse,
} from "@/lib/api-map-gallery";
import { getMapById } from "@/lib/api-maps";
import { getMyOrganizations, MyOrganizationDto } from "@/lib/api-organizations";
import { getWorkspacesByOrganization } from "@/lib/api-workspaces";
import type { Workspace } from "@/types/workspace";

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
  const { showToast } = useToast();
  const router = useRouter();

  const [maps, setMaps] = useState<MapGallerySummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detail, setDetail] = useState<GalleryMapDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mapIdQuery, setMapIdQuery] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [likedMaps, setLikedMaps] = useState<Set<string>>(new Set());
  const [likingMap, setLikingMap] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [tagKey, setTagKey] = useState<TagKey>("All");
  const [sort, setSort] = useState<SortKey>("popular");
  const [pageSize, setPageSize] = useState<12 | 18 | 24>(12);
  const [page, setPage] = useState(1);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Workspace Selector Popup State
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{ galleryId: string; mapId: string; isStoryMap: boolean } | null>(null);
  const [organizations, setOrganizations] = useState<MyOrganizationDto[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // GSAP hook cho hero + fade + card grid
  useGsapHomeScroll({
    heroSelectors: {
      title: ".gal-hero-title",
      subtitle: ".gal-hero-sub",
      cta: ".gal-controls",
    },
    // Các block fade-in thêm (eyebrow, tags, meta, CTA)
    fadeSelector: ".gal-hero-eyebrow, .gal-tags, .gal-meta, .gal-cta",
    fadeStart: "top 90%",
    // Stagger cho grid card gallery
    stagger: {
      container: ".gal-card-grid",
      card: ".gal-card",
      start: "top 80%",
    },
  });

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

        // Fetch individual map details to get correct isStoryMap value
        const mapsWithDetails = await Promise.all(
          data.map(async (map) => {
            try {
              const mapDetail = await getMapById(map.mapId);
              return {
                ...map,
                isStoryMap: mapDetail.isStoryMap,
              };
            } catch (error) {
              // If fetching map details fails, keep original map data
              console.error(`Failed to fetch details for map ${map.mapId}:`, error);
              return map;
            }
          })
        );

        if (!isMounted) return;

        setMaps(mapsWithDetails);
      } catch (err: any) {
        if (!isMounted) return;
        setLoadError(err?.message || t("gallery.error_load_maps"));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [tagKey, q, featuredOnly, t]);

  const handleSelectByGalleryId = async (galleryId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await getPublishedGalleryMapById(galleryId);
      setDetail(d);
      // Increment view count
      try {
        await incrementGalleryMapView(galleryId);
      } catch (err) {
        // Silently fail view count increment
        console.error("Failed to increment view:", err);
      }
    } catch (err: any) {
      setDetailError(err?.message || t("gallery.error_load_detail"));
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
      // Increment view count
      try {
        await incrementGalleryMapView(d.id);
      } catch (err) {
        console.error("Failed to increment view:", err);
      }
    } catch (err: any) {
      setDetailError(err?.message || t("gallery.error_load_detail"));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDuplicate = async (galleryId: string, mapId: string, map: MapGallerySummaryResponse) => {
    // Check if this is a story map
    if (map.isStoryMap) {
      // Story map requires workspace, show workspace selector
      setPendingDuplicate({ galleryId, mapId, isStoryMap: true });
      setShowWorkspaceSelector(true);

      // Load organizations
      setLoadingOrgs(true);
      try {
        const orgsRes = await getMyOrganizations();
        const orgList = orgsRes.organizations || [];
        setOrganizations(orgList);

        if (orgList.length === 0) {
          // No organizations, redirect to create organization
          setShowWorkspaceSelector(false);
          showToast("info", "You need to create an organization first to duplicate story maps");
          router.push("/profile/organizations/new");
          return;
        }
      } catch (error) {
        showToast("info", "Vui lòng tạo tổ chức để nhân bản bản đồ câu chuyện");
        setShowWorkspaceSelector(false);
      } finally {
        setLoadingOrgs(false);
      }
      return;
    }

    // Normal map, duplicate directly
    setDuplicating(galleryId);
    setDuplicateError(null);
    try {
      const result = await duplicateMapFromGallery(galleryId, {});
      // Redirect to the new map
      window.location.href = `/maps/${result.mapId}`;
    } catch (err: any) {
      setDuplicating(null);

      // Check if error is 401 Unauthorized
      if (err?.status === 401) {
        showToast("error", t("gallery.error_duplicate_unauthorized"));
      } else {
        const errorMessage = err?.message || t("gallery.error_duplicate");
        setDuplicateError(errorMessage);
        showToast("error", errorMessage);
      }
    }
  };

  const handleLike = async (galleryId: string) => {
    setLikingMap(galleryId);
    try {
      const result = await toggleGalleryMapLike(galleryId);
      
      // Update local liked state
      setLikedMaps((prev) => {
        const newSet = new Set(prev);
        if (result.isLiked) {
          newSet.add(galleryId);
        } else {
          newSet.delete(galleryId);
        }
        return newSet;
      });

      // Update like count in maps list
      setMaps((prevMaps) =>
        prevMaps.map((m) =>
          m.id === galleryId
            ? { ...m, likeCount: m.likeCount + (result.isLiked ? 1 : -1) }
            : m
        )
      );

      // Update detail if open
      if (detail && detail.id === galleryId) {
        setDetail({
          ...detail,
          likeCount: detail.likeCount + (result.isLiked ? 1 : -1),
        });
      }

      showToast(
        "success",
        result.isLiked ? t("gallery.liked") : t("gallery.unliked")
      );
    } catch (err: any) {
      if (err?.status === 401) {
        showToast("error", t("gallery.error_like_unauthorized"));
      } else {
        showToast("error", err?.message || t("gallery.error_like"));
      }
    } finally {
      setLikingMap(null);
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

  // Load workspaces when organization is selected
  useEffect(() => {
    if (!selectedOrgId) {
      setWorkspaces([]);
      setSelectedWorkspaceId("");
      return;
    }

    const loadWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const ws = await getWorkspacesByOrganization(selectedOrgId);
        setWorkspaces(ws || []);
        setSelectedWorkspaceId("");
      } catch (error) {
        showToast("error", t("gallery.workspace_selector_load_error"));
        setWorkspaces([]);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    loadWorkspaces();
  }, [selectedOrgId, showToast]);

  const handleConfirmDuplicate = async () => {
    if (!pendingDuplicate || !selectedWorkspaceId) {
      showToast("error", t("gallery.workspace_selector_error"));
      return;
    }

    setDuplicating(pendingDuplicate.galleryId);
    setShowWorkspaceSelector(false);
    try {
      const result = await duplicateMapFromGallery(pendingDuplicate.galleryId, {
        workspaceId: selectedWorkspaceId,
      });
      showToast("success", t("gallery.workspace_selector_success"));
      // Redirect to the new map - story map goes to storymap player
      if (pendingDuplicate.isStoryMap) {
        window.location.href = `/maps/${result.mapId}`;
      } else {
        window.location.href = `/maps/${result.mapId}`;
      }
    } catch (err: any) {
      setDuplicating(null);

      // Check if error is 401 Unauthorized
      if (err?.status === 401) {
        showToast("error", t("gallery.error_duplicate_unauthorized"));
      } else {
        const errorMessage = err?.message || t("gallery.error_duplicate");
        showToast("error", errorMessage);
      }
    } finally {
      setPendingDuplicate(null);
      setSelectedOrgId("");
      setSelectedWorkspaceId("");
    }
  };

  const handleCancelWorkspaceSelector = () => {
    setShowWorkspaceSelector(false);
    setPendingDuplicate(null);
    setSelectedOrgId("");
    setSelectedWorkspaceId("");
  };

  const renderTagFilterLabel = (key: TagKey) => {
    if (key === "All") return t("gallery.tag_All");
    return t(`gallery.category_${key}`);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="gal-hero-eyebrow text-sm tracking-wide text-emerald-300/90">
            {t("gallery.hero_eyebrow")}
          </p>
          <h1 className="gal-hero-title mt-2 text-3xl font-semibold sm:text-4xl">
            {t("gallery.hero_title")}
          </h1>
          <p className="gal-hero-sub mt-3 max-w-2xl text-zinc-300">
            {t("gallery.hero_sub")}
          </p>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="gal-controls mt-6 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("gallery.search_placeholder")}
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
              <option value="popular">{t("gallery.sort_popular")}</option>
              <option value="newest">{t("gallery.sort_newest")}</option>
              <option value="likes">{t("gallery.sort_likes")}</option>
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
              <option value={12}>{t("gallery.page_size")}: 12</option>
              <option value={18}>{t("gallery.page_size")}: 18</option>
              <option value={24}>{t("gallery.page_size")}: 24</option>
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
            <span>{t("gallery.featured_only")}</span>
          </label>
        </div>

        <div className="gal-tags mt-3 flex flex-wrap gap-2">
          {TAG_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setTagKey(k)}
              className={`gal-tag-btn rounded-full px-3 py-1.5 text-xs font-medium transition ${tagKey === k
                  ? "bg-emerald-500 text-zinc-950"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"
                }`}
              aria-pressed={tagKey === k}
            >
              {renderTagFilterLabel(k)}
            </button>
          ))}
        </div>

        <div className="gal-meta mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span>
            {sorted.length} {t("gallery.results")} • {t("gallery.showing")} “
            {renderTagFilterLabel(tagKey)}”
            {q ? ` • ${t("gallery.searching_for")} “${q}”` : ""}
            {featuredOnly ? ` • ${t("gallery.featured_badge")}` : ""}
          </span>
          <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
            {sorted.length ? `${from}–${to}` : "0–0"} {t("gallery.of")}{" "}
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
          {t("gallery.loading_maps")}
        </section>
      ) : pageItems.length === 0 ? (
        <EmptyState
          illustration="map"
          title={t("gallery.empty_title")}
          description={t("gallery.empty_sub")}
          action={{
            label: t("gallery.reset_filters"),
            onClick: () => {
              setQ("");
              setTagKey("All");
              setSort("popular");
              setFeaturedOnly(false);
            },
          }}
        />
      ) : (
        <>
          <section className="gal-card-grid mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((m) => (
              <article
                key={m.id}
                className="gal-card rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5"
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
                  {t("gallery.by")} {m.authorName} • {t("gallery.updated")}{" "}
                  {new Date(m.publishedAt ?? m.createdAt).toLocaleDateString()}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <TagPill>{t(`gallery.category_${m.category}`)}</TagPill>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${m.isStoryMap
                    ? "border-purple-400/30 bg-purple-500/10 text-purple-300"
                    : "border-blue-400/30 bg-blue-500/10 text-blue-300"
                  }`}>
                    {m.isStoryMap ? "Story Map" : "Normal Map - Bản đồ thường"}
                  </span>
                  {m.isFeatured && (
                    <TagPill>{t("gallery.featured_badge")}</TagPill>
                  )}
                  {m.tags.map((tag) => (
                    <TagPill key={tag}>{tag}</TagPill>
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
                  <button
                    type="button"
                    onClick={() => handleLike(m.id)}
                    disabled={likingMap === m.id}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                      likedMaps.has(m.id)
                        ? "border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-400/70"
                        : "border-zinc-700/70 bg-zinc-900 text-zinc-200 hover:border-emerald-400/70"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <HeartIcon className={`h-4 w-4 ${likedMaps.has(m.id) ? "fill-red-400" : ""}`} />
                    {likingMap === m.id ? "..." : fmt(m.likeCount)}
                  </button>

                  {/* View button - different routes for story maps vs normal maps */}
                  {m.isStoryMap ? (
                    <Link
                      href={`/storymap/${m.mapId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-400"
                    >
                      ▶ {t("gallery.play_storymap")}
                    </Link>
                  ) : (
                    <Link
                      href={{
                        pathname: "/maps/publish",
                        query: { mapId: m.mapId, view: "true" },
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                    >
                      {t("gallery.view_map")}
                    </Link>
                  )}

                  {/* Duplicate button - available for both story maps and normal maps */}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(m.id, m.mapId, m)}
                    disabled={duplicating === m.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CopyIcon className="h-4 w-4" />
                    {duplicating === m.id ? t("gallery.duplicating") : t("gallery.duplicate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectByGalleryId(m.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-emerald-400/70"
                  >
                    {t("gallery.button_details")}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-xs text-zinc-400">
              {sorted.length ? `${from}–${to}` : "0–0"} {t("gallery.of")}{" "}
              {sorted.length} • {t("gallery.page")} {Math.min(page, totalPages)} /{" "}
              {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${page <= 1
                    ? "cursor-not-allowed opacity-50 ring-white/10"
                    : "ring-white/15 hover:bg-white/5"
                  }`}
              >
                {t("gallery.prev")}
              </button>

              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`h-9 w-9 rounded-lg text-sm ${page === n
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
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${page >= totalPages
                    ? "cursor-not-allowed opacity-50 ring-white/10"
                    : "ring-white/15 hover:bg-white/5"
                  }`}
              >
                {t("gallery.next")}
              </button>
            </div>
          </section>
        </>
      )}

      <section className="mt-10 rounded-2xl border border-emerald-500/20 bg-zinc-900/70 p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{t("gallery.detail_title")}</h3>
            {detailLoading && (
              <p className="mt-2 text-sm text-zinc-400">{t("gallery.loading_detail")}</p>
            )}
            {detailError && (
              <p className="mt-2 text-sm text-red-300">{detailError}</p>
            )}
            {!detailLoading && !detail && !detailError && (
              <p className="mt-2 text-sm text-zinc-400">
                {t("gallery.detail_empty")}
              </p>
            )}
            {detail && !detailLoading && (
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div className="text-base font-medium">{detail.mapName}</div>
                <div className="text-xs text-zinc-400">
                  {t("gallery.detail_author")}: {detail.authorName} •{" "}
                  {(detail.publishedAt || detail.createdAt) &&
                    new Date(
                      detail.publishedAt || detail.createdAt
                    ).toLocaleDateString()}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">
                  {detail.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <TagPill>{t(`gallery.category_${detail.category}`)}</TagPill>
                  {detail.isFeatured && (
                    <TagPill>{t("gallery.featured_badge")}</TagPill>
                  )}
                  {detail.tags.map((tag) => (
                    <TagPill key={tag}>{tag}</TagPill>
                  ))}
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                  {t("gallery.detail_views")}: {fmt(detail.viewCount)} •{" "}
                  {t("gallery.detail_likes")}: {fmt(detail.likeCount)}
                </div>
                <div className="mt-2 text-xs text-zinc-400 break-all">
                  {t("gallery.detail_gallery_id")}: {detail.id}
                  <br />
                  {t("gallery.detail_map_id")}: {detail.mapId}
                </div>
              </div>
            )}
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-950/70 p-4 text-sm">
            <div className="font-medium text-zinc-100">
              {t("gallery.search_by_map_id_title")}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {t("gallery.search_by_map_id_desc")}
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={mapIdQuery}
                onChange={(e) => setMapIdQuery(e.target.value)}
                placeholder={t("gallery.search_by_map_id_placeholder")}
                className="w-full rounded-xl border border-zinc-700/70 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
              />
              <button
                type="button"
                onClick={handleSearchByMapId}
                className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                {t("gallery.search_by_map_id_button")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="gal-cta mt-10 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">{t("gallery.cta_title")}</h3>
            <p className="mt-1 text-zinc-300">{t("gallery.cta_sub")}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/resources/map-gallery/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {t("gallery.cta_submit")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/resources/blog"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              {t("gallery.cta_blog")}
            </Link>
          </div>
        </div>
      </section>

      {/* Workspace Selector Popup */}
      {showWorkspaceSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-zinc-900 shadow-2xl p-6">
            <h3 className="text-xl font-semibold text-zinc-100 mb-2">
              {t("gallery.workspace_selector_title")}
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              {t("gallery.workspace_selector_desc")}
            </p>

            {loadingOrgs ? (
              <div className="text-center text-zinc-400 py-8">{t("gallery.workspace_selector_loading_orgs")}</div>
            ) : (
              <div className="space-y-4">
                {/* Organization Selector */}
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-2">
                    {t("gallery.workspace_selector_org_label")}
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-400/60"
                  >
                    <option value="">{t("gallery.workspace_selector_org_placeholder")}</option>
                    {organizations.map((org) => (
                      <option key={org.orgId} value={org.orgId}>
                        {org.orgName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workspace Selector */}
                {selectedOrgId && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-200 mb-2">
                      {t("gallery.workspace_selector_ws_label")}
                    </label>
                    {loadingWorkspaces ? (
                      <div className="text-sm text-zinc-400 py-2">{t("gallery.workspace_selector_ws_loading")}</div>
                    ) : workspaces.length === 0 ? (
                      <div className="text-sm text-zinc-400 py-2">
                        {t("gallery.workspace_selector_ws_empty")}
                      </div>
                    ) : (
                      <select
                        value={selectedWorkspaceId}
                        onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-400/60"
                      >
                        <option value="">{t("gallery.workspace_selector_ws_placeholder")}</option>
                        {workspaces.map((ws) => (
                          <option key={ws.workspaceId} value={ws.workspaceId}>
                            {ws.workspaceName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={handleCancelWorkspaceSelector}
                    className="px-4 py-2 rounded-xl border border-zinc-700/70 bg-zinc-900 text-sm font-medium text-zinc-200 hover:border-zinc-600"
                  >
                    {t("gallery.workspace_selector_cancel")}
                  </button>
                  <button
                    onClick={handleConfirmDuplicate}
                    disabled={!selectedWorkspaceId}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("gallery.workspace_selector_confirm")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
