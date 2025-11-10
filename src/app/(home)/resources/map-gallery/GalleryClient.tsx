"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";
gsap.registerPlugin(ScrollTrigger);

export type MapItem = {
  id: string;
  title: string;
  author: string;
  tags: string[];
  views: number;
  likes: number;
  updated: string; // ISO
  href: string;
  duplicateHref: string;
};

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
  "Education",
  "Environment",
  "Urban",
  "Disaster",
  "Transportation",
  "History",
  "Zones",
  "Analytics",
  "Tourism",
  "POI",
  "Raster",
  "Story",
] as const;
type TagKey = (typeof TAG_KEYS)[number];
const TAG_SET = new Set<string>(TAG_KEYS as unknown as string[]);

export default function GalleryClient({ maps }: { maps: MapItem[] }) {
  const { t } = useI18n();
  const tr = (k: string) => t("gallery", k);

  const [q, setQ] = useState("");
  const [tagKey, setTagKey] = useState<TagKey>("All");
  const [sort, setSort] = useState<SortKey>("popular");
  const [pageSize, setPageSize] = useState<12 | 18 | 24>(12);
  const [page, setPage] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);

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

  /** Lọc + sắp xếp */
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = maps.filter((m) => {
      const hit =
        !qq ||
        m.title.toLowerCase().includes(qq) ||
        m.author.toLowerCase().includes(qq) ||
        m.tags.some((t) => t.toLowerCase().includes(qq));
      const tagOk = tagKey === "All" || m.tags.includes(tagKey);
      return hit && tagOk;
    });

    list = list.sort((a, b) => {
      if (sort === "popular") return b.views - a.views;
      if (sort === "likes") return b.likes - a.likes;
      return +new Date(b.updated) - +new Date(a.updated);
    });

    return list;
  }, [maps, q, tagKey, sort]);

  /** Phân trang */
  const { pageItems, totalPages, from, to } = useMemo(() => {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safe = Math.min(page, pages);
    const start = (safe - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    return { pageItems: filtered.slice(start, end), totalPages: pages, from: start + 1, to: end };
  }, [filtered, page, pageSize]);

  /** Reset trang khi thay filter */
  useEffect(() => setPage(1), [q, tagKey, sort, pageSize]);

  /** Hiệu ứng vào màn hình */
  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set(
        [".gal-hero-eyebrow", ".gal-hero-title", ".gal-hero-sub", ".gal-controls", ".gal-tags", ".gal-meta"],
        { autoAlpha: 0, y: 16 }
      );
      gsap
        .timeline()
        .to(".gal-hero-eyebrow", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.5, ease: "power2.out" })
        .to(".gal-hero-title", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.7, ease: "power2.out" }, "<0.06")
        .to(".gal-hero-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".gal-controls", { autoAlpha: 1, y: 0, ...baseIn }, "<0.08")
        .to(".gal-tags", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".gal-meta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.04");

      ScrollTrigger.batch(".gal-tag-btn", {
        start: "top 95%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".gal-cta", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".gal-cta",
        start: "top 90%",
        onEnter: () => gsap.to(".gal-cta", { autoAlpha: 1, y: 0, ...baseIn }),
      });
    });

    return () => ctx.revert();
  }, []);

  /** Animate cards khi đổi bộ lọc/trang */
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cards = gsap.utils.toArray<HTMLElement>(".gal-card");
    if (!cards.length) return;
    gsap.fromTo(cards, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.55, ease: "power2.out", stagger: 0.08 });
  }, [pageItems, tagKey, sort, q, page]);

  /** Helper hiển thị tag an toàn (không crash nếu thiếu key i18n) */
  const renderTag = (tag: string) => (TAG_SET.has(tag) ? tr(`tag_${tag}`) : tag);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="gal-hero-eyebrow text-sm tracking-wide text-emerald-300/90">{tr("hero_eyebrow")}</p>
          <h1 className="gal-hero-title mt-2 text-3xl font-semibold sm:text-4xl">{tr("hero_title")}</h1>
          <p className="gal-hero-sub mt-3 max-w-2xl text-zinc-300">{tr("hero_sub")}</p>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      {/* Controls */}
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
              onChange={(e) => setPageSize(Number(e.target.value) as 12 | 18 | 24)}
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            >
              <option value={12}>{tr("page_size")}: 12</option>
              <option value={18}>{tr("page_size")}: 18</option>
              <option value={24}>{tr("page_size")}: 24</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="gal-tags mt-3 flex flex-wrap gap-2 opacity-0 translate-y-[16px]">
          {TAG_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setTagKey(k)}
              className={`gal-tag-btn opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tagKey === k ? "bg-emerald-500 text-zinc-950" : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"
              }`}
              aria-pressed={tagKey === k}
            >
              {tr(`tag_${k}`)}
            </button>
          ))}
        </div>

        {/* Meta */}
        <div className="gal-meta mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400 opacity-0 translate-y-[16px]">
          <span>
            {filtered.length} {tr("results")} • {tr("showing")} “{tr(`tag_${tagKey}`)}”
            {q ? ` • ${tr("searching_for")} “${q}”` : ""}
          </span>
          <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
            {filtered.length ? `${from}–${to}` : "0–0"} {tr("of")} {filtered.length}
          </span>
        </div>
      </section>

      {/* Results */}
      {pageItems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-8 text-center">
          <div className="text-lg font-medium">{tr("empty_title")}</div>
          <p className="mt-1 text-sm text-zinc-400">{tr("empty_sub")}</p>
          <div className="mt-4">
            <button
              onClick={() => {
                setQ("");
                setTagKey("All");
                setSort("popular");
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
              <article key={m.id} className="gal-card opacity-0 translate-y-[18px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5">
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/5">
                  <div className="h-full w-full bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
                </div>

                <h3 className="mt-3 text-base font-semibold leading-snug">{m.title}</h3>
                <div className="mt-1 text-xs text-zinc-400">
                  {tr("by")} {m.author} • {tr("updated")} {new Date(m.updated).toLocaleDateString()}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {m.tags.map((t) => (
                    <TagPill key={t}>{renderTag(t)}</TagPill>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <EyeIcon className="h-4 w-4 text-emerald-300" />
                    {fmt(m.views)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HeartIcon className="h-4 w-4 text-emerald-300" />
                    {fmt(m.likes)}
                  </span>
                </div>

                <div className="mt-4 flex gap-3">
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
                </div>
              </article>
            ))}
          </section>

          {/* Pagination */}
          <section className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-xs text-zinc-400">
              {filtered.length ? `${from}–${to}` : "0–0"} {tr("of")} {filtered.length} • {tr("page")} {Math.min(page, totalPages)} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  page <= 1 ? "cursor-not-allowed opacity-50 ring-white/10" : "ring-white/15 hover:bg-white/5"
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
                        page === n ? "bg-emerald-500 text-zinc-950" : "ring-1 ring-white/10 hover:bg-white/5"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                {totalPages > 7 && <span className="px-2 text-sm text-zinc-400">…</span>}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  page >= totalPages ? "cursor-not-allowed opacity-50 ring-white/10" : "ring-white/15 hover:bg-white/5"
                }`}
              >
                {tr("next")}
              </button>
            </div>
          </section>
        </>
      )}

      {/* CTA */}
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
