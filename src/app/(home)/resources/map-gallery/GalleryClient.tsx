"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export type MapItem = {
  id: string;
  title: string;
  author: string;
  tags: string[];
  views: number;
  likes: number;
  updated: string;
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
      <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
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
const formatNumber = (n: number) => Intl.NumberFormat().format(n);

type SortKey = "popular" | "newest" | "likes";
const TAGS = ["All", "Education", "Environment", "Urban", "Disaster", "Transportation", "History", "Zones", "Analytics", "Tourism", "POI", "Raster", "Story Maps"] as const;

export default function GalleryClient({ maps }: { maps: MapItem[] }) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("All");
  const [sort, setSort] = useState<SortKey>("popular");

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(() => {
    let list = maps.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q));
      const matchesTag = tag === "All" || m.tags.includes(tag);
      return matchesSearch && matchesTag;
    });

    list = list.sort((a, b) => {
      if (sort === "popular") return b.views - a.views;
      if (sort === "likes") return b.likes - a.likes;
      return +new Date(b.updated) - +new Date(a.updated);
    });

    return list;
  }, [maps, search, tag, sort]);

  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".gal-controls", ".gal-tags", ".gal-meta"], { autoAlpha: 0, y: 16 });
      gsap
        .timeline()
        .to(".gal-controls", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.6, ease: "power2.out" })
        .to(".gal-tags", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".gal-meta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06");

      ScrollTrigger.batch(".gal-tag-btn", {
        start: "top 95%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cards = gsap.utils.toArray<HTMLElement>(".gal-card");
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.55, ease: "power2.out", stagger: 0.08 }
    );
  }, [items, tag, sort, search]);

  return (
    <>
      <div className="gal-controls rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10 opacity-0 translate-y-[16px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search maps (Ctrl K)…"
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 pr-24 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                Ctrl K
              </span>
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="sr-only">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            >
              <option value="popular">Sort: Most popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="likes">Sort: Most liked</option>
            </select>
          </div>
        </div>

        <div className="gal-tags mt-3 flex flex-wrap gap-2 opacity-0 translate-y-[16px]">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`gal-tag-btn opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition
                ${tag === t
                  ? "bg-emerald-500 text-zinc-950"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"}`}
              aria-pressed={tag === t}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="gal-meta mt-3 text-xs text-zinc-400 opacity-0 translate-y-[16px]">
          {items.length} result{items.length !== 1 ? "s" : ""} · Showing “{tag}”
          {search ? ` · Search: “${search}”` : ""}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-8 text-center">
          <div className="text-lg font-medium">No maps found</div>
          <p className="mt-1 text-sm text-zinc-400">Try a different tag or search term.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <article key={m.id} className="gal-card opacity-0 translate-y-[18px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/5">
                <div className="h-full w-full bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
              </div>

              <h3 className="mt-3 text-base font-semibold leading-snug">{m.title}</h3>
              <div className="mt-1 text-xs text-zinc-400">
                By {m.author} • Updated {new Date(m.updated).toLocaleDateString()}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {m.tags.map((t) => (
                  <TagPill key={t}>{t}</TagPill>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <EyeIcon className="h-4 w-4 text-emerald-300" />
                  {formatNumber(m.views)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <HeartIcon className="h-4 w-4 text-emerald-300" />
                  {formatNumber(m.likes)}
                </span>
              </div>

              <div className="mt-4 flex gap-3">
                <Link
                  href={m.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  View map
                </Link>
                <Link
                  href={m.duplicateHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70"
                >
                  <CopyIcon className="h-4 w-4" />
                  Duplicate
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
