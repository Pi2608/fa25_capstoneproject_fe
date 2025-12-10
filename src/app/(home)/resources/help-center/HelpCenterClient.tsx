"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";
import type { FaqItem } from "@/lib/api-support";
import { getFaqSuggestions, searchFaqs } from "@/lib/api-support";
import { useReducedMotion } from "@/hooks/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

type NavItem = { href: string; labelKey: string };
type Tile = { href: string; titleKey: string; descKey: string };

export default function HelpCenterClient() {
  const { t } = useI18n();
  const tr = (k: string) => t("help", k);

  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FaqItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounced = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const LEFT_GROUP_1_TITLE = tr("sec_start");
  const LEFT_GROUP_1: NavItem[] = [
    { href: "#welcome", labelKey: "nav_welcome" },
    { href: "#what-is", labelKey: "nav_what_is" },
    { href: "#create-map", labelKey: "nav_create_map" },
    { href: "#tour-interface", labelKey: "nav_tour_interface" },
    { href: "#workspace", labelKey: "nav_workspace" },
    { href: "#shortcuts", labelKey: "nav_shortcuts" },
  ];

  const LEFT_GROUP_2_TITLE = tr("sec_upload_anything");
  const LEFT_GROUP_2: NavItem[] = [
    { href: "#files", labelKey: "nav_files" },
    { href: "#urls", labelKey: "nav_urls" },
    { href: "#sheets", labelKey: "nav_sheets" },
    { href: "#raster", labelKey: "nav_raster" },
    { href: "#cloud", labelKey: "nav_cloud" },
    { href: "#sql", labelKey: "nav_sql" },
    { href: "#refresh", labelKey: "nav_refresh" },
  ];

  const TILES: Tile[] = [
    { href: "#what-is", titleKey: "tile_what_is_title", descKey: "tile_what_is_desc" },
    { href: "#create-map", titleKey: "tile_create_map_title", descKey: "tile_create_map_desc" },
    { href: "#tour-interface", titleKey: "tile_tour_title", descKey: "tile_tour_desc" },
  ];

  useHelpCenterAnimations({ touched, loading });

  useEffect(() => {
    getFaqSuggestions(8).then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    if (!touched) return;
    setLoading(true);
    searchFaqs(debounced)
      .then((res) => setResults(res))
      .finally(() => setLoading(false));
  }, [debounced, touched]);

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

  return (
    <main className="relative mx-auto max-w-7xl px-4 md:px-6 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.08),transparent)]" />

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-3">
          <nav className="hc-left sticky top-20 space-y-6">
            <div>
              <div className="hc-hero-eyebrow text-xs font-semibold tracking-wide text-zinc-400 mb-2 opacity-0 translate-y-[18px]">
                {LEFT_GROUP_1_TITLE}
              </div>
              <ul className="space-y-1">
                {LEFT_GROUP_1.map(({ href, labelKey }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300 opacity-0 -translate-x-[10px]"
                    >
                      {tr(labelKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400 mb-2">
                {LEFT_GROUP_2_TITLE}
              </div>
              <ul className="space-y-1">
                {LEFT_GROUP_2.map(({ href, labelKey }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300 opacity-0 -translate-x-[10px]"
                    >
                      {tr(labelKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        <section className="col-span-12 md:col-span-6 lg:col-span-6">
          <div className="mb-5">
            <div className="hc-search relative opacity-0 translate-y-[18px]">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setTouched(true);
                }}
                placeholder={`${tr("search_placeholder")}   Ctrl + K`}
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-3 pr-24 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                Ctrl K
              </span>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      setTouched(true);
                    }}
                    className="hc-suggest-chip opacity-0 translate-y-[10px] rounded-full bg-white/5 hover:bg:white/10 text-sm px-3 py-1.5 ring-1 ring-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {touched ? (
            <div className="space-y-3">
              {loading && <div className="h-16 animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10" />}
              {!loading && results.length === 0 && (
                <p className="text-zinc-400">{tr("no_results")}</p>
              )}
              {results.map((item) => (
                <details
                  key={item.faqId}
                  className="faq-item group rounded-xl ring-1 ring-white/10 bg-white/5 px-5 py-4 open:bg-white/10"
                >
                  <summary className="cursor-pointer list-none select-none">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400">
                          <path fill="currentColor" d="M11 7h2v6h-2zm0 8h2v2h-2z" />
                        </svg>
                      </span>
                      <h3 className="text-base font-semibold text-white">{item.question}</h3>
                    </div>
                  </summary>
                  <div className="mt-3 pl-9 text-sm leading-6 text-zinc-300">
                    <div className="mb-2">
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide ring-1 ring-white/10">
                        {item.category}
                      </span>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: item.answer ?? "" }} />
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <article className="hc-article prose prose-invert max-w-none">
              <h1 id="welcome" className="scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("welcome_title")}
              </h1>
              <p>{tr("welcome_lead")}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose mt-6">
                {TILES.map(({ href, titleKey, descKey }) => (
                  <a
                    key={href}
                    href={href}
                    className="hc-article-tile opacity-0 translate-y-[12px] rounded-xl ring-1 ring-white/10 bg-white/5 hover:bg-white/10 p-4"
                  >
                    <div className="font-semibold">{tr(titleKey)}</div>
                    <p className="text-sm text-zinc-400 mt-1">{tr(descKey)}</p>
                  </a>
                ))}
              </div>

              <h2 id="what-is" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("what_is_title")}
              </h2>
              <p>{tr("what_is_p1")}</p>

              <h2 id="create-map" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("create_map_title")}
              </h2>
              <ol>
                <li>{tr("create_map_step1")}</li>
                <li>{tr("create_map_step2")}</li>
                <li>{tr("create_map_step3")}</li>
              </ol>

              <h2 id="tour-interface" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("tour_interface_title")}
              </h2>
              <p>{tr("tour_interface_p1")}</p>

              <h2 id="workspace" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("workspace_title")}
              </h2>
              <p>{tr("workspace_p1")}</p>

              <h2 id="shortcuts" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("shortcuts_title")}
              </h2>
              <ul>
                <li>
                  <kbd>Ctrl</kbd> + <kbd>K</kbd>: {tr("shortcut_search")}
                </li>
                <li>
                  <kbd>?</kbd>: {tr("shortcut_help")}
                </li>
              </ul>

              <h2 id="files" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("files_title")}
              </h2>
              <p>{tr("files_p1")}</p>

              <h2 id="urls" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("urls_title")}
              </h2>
              <p>{tr("urls_p1")}</p>

              <h2 id="sheets" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("sheets_title")}
              </h2>
              <p>{tr("sheets_p1")}</p>

              <h2 id="raster" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("raster_title")}
              </h2>
              <p>{tr("raster_p1")}</p>

              <h2 id="cloud" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("cloud_title")}
              </h2>
              <p>{tr("cloud_p1")}</p>

              <h2 id="sql" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("sql_title")}
              </h2>
              <p>{tr("sql_p1")}</p>

              <h2 id="refresh" className="mt-10 scroll-mt-24 opacity-0 translate-y-[12px]">
                {tr("refresh_title")}
              </h2>
              <p>{tr("refresh_p1")}</p>
            </article>
          )}
        </section>

        <aside className="col-span-12 md:col-span-3 lg:col-span-3">
          <div className="sticky top-20 space-y-6">
            <div className="hc-right-card opacity-0 translate-y-[12px] rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-2">{tr("qs_title")}</div>
              <ul className="space-y-1 text-sm">
                <li>
                  <a href="#what-is" className="text-emerald-400 hover:underline">
                    {tr("qs_learn")}
                  </a>
                </li>
                <li>
                  <a href="#create-map" className="hover:underline">
                    {tr("qs_first_map")}
                  </a>
                </li>
                <li>
                  <a href="#tour-interface" className="hover:underline">
                    {tr("qs_more_resources")}
                  </a>
                </li>
              </ul>
            </div>

            <div className="hc-right-card opacity-0 translate-y-[12px] rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-3">{tr("feedback_title")}</div>
              <div className="flex gap-2">
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">
                  🙂 {tr("feedback_yes")}
                </button>
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">
                  😐 {tr("feedback_ok")}
                </button>
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">
                  🙁 {tr("feedback_no")}
                </button>
              </div>
            </div>

            <div className="hc-right-card opacity-0 translate-y-[12px] rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-2">{tr("quick_links")}</div>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link href="/resources/developer-docs" className="hover:underline">
                    {tr("ql_developer_docs")}
                  </Link>
                </li>
                <li>
                  <Link href="/resources/map-gallery" className="hover:underline">
                    {tr("ql_map_gallery")}
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:underline">
                    {tr("ql_pricing")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function useHelpCenterAnimations({ touched, loading }: { touched: boolean; loading: boolean }) {
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".hc-hero-eyebrow", ".hc-hero-title", ".hc-search"], { autoAlpha: 0, y: 18 });
      gsap
        .timeline()
        .to(".hc-hero-eyebrow", {
          autoAlpha: 1,
          y: 0,
          duration: reduce ? 0 : 0.55,
          ease: "power2.out",
        })
        .to(
          ".hc-hero-title",
          {
            autoAlpha: 1,
            y: 0,
            duration: reduce ? 0 : 0.7,
            ease: "power2.out",
          },
          "<0.06",
        )
        .to(
          ".hc-search",
          {
            autoAlpha: 1,
            y: 0,
            ...baseIn,
          },
          "<0.06",
        );

      ScrollTrigger.batch(".hc-suggest-chip", {
        start: "top 95%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.06,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, {
            autoAlpha: 0,
            y: 10,
          }),
      });

      ScrollTrigger.batch(".hc-left a", {
        start: "top 90%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            x: 0,
            stagger: 0.04,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, {
            autoAlpha: 0,
            x: -10,
          }),
      });

      ScrollTrigger.batch(".hc-right-card", {
        start: "top 92%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.08,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, {
            autoAlpha: 0,
            y: 12,
          }),
      });

      ScrollTrigger.batch(".hc-article h1, .hc-article h2", {
        start: "top 88%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.05,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, {
            autoAlpha: 0,
            y: 10,
          }),
      });

      ScrollTrigger.batch(".hc-article-tile", {
        start: "top 90%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.06,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, {
            autoAlpha: 0,
            y: 12,
          }),
      });
    });

    return () => ctx.revert();
  }, [reduce]);

  useEffect(() => {
    if (!touched || loading) return;
    const items = gsap.utils.toArray<HTMLElement>(".faq-item");
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: reduce ? 0 : 0.45,
        ease: "power2.out",
        stagger: 0.06,
      },
    );
  }, [touched, loading, reduce]);
}

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
