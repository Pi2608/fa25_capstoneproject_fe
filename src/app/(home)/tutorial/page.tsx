"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useI18n } from "@/i18n/I18nProvider";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";

type Level = "Beginner" | "Intermediate" | "Advanced";
type Topic =
  | "Quickstart"
  | "Story Maps"
  | "Styling"
  | "Data"
  | "Exports"
  | "API"
  | "Collaboration";

type Tutorial = {
  id: string;
  titleKey: string;
  excerptKey: string;
  level: Level;
  durationMin: number;
  topic: Topic;
  href: string;
  popular?: boolean;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
      {children}
    </span>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = value.toLocaleString();
      return;
    }
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: value,
      duration: 1.2,
      ease: "power1.out",
      onUpdate: () => {
        el.textContent = Math.round(obj.v).toLocaleString();
      },
    });
    return () => tween.kill();
  }, [value, reduce]);

  return <div ref={ref} className={className} />;
}

export default function TutorialPage() {
  const reduce = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "All">("All");
  const [topic, setTopic] = useState<Topic | "All">("All");
  const { t } = useI18n();
  const tr = (k: string) => t("tutorials", k);

  useGsapHomeScroll({
    reduce,
    heroSelectors: {
      title: ".tu-hero-title",
      subtitle: ".tu-hero-sub",
      cta: ".tu-hero-cta",
    },
    fadeSelector: ".tu-fade",
    staggerSelector: ".tu-stagger",
    cardSelector: ".card",
  });

  const LEVEL_KEYS: Record<Level | "All", string> = {
    All: "level_all",
    Beginner: "level_beginner",
    Intermediate: "level_intermediate",
    Advanced: "level_advanced",
  };

  const TOPIC_KEYS: Record<Topic | "All", string> = {
    All: "topic_all",
    Quickstart: "topic_quickstart",
    "Story Maps": "topic_story_maps",
    Styling: "topic_styling",
    Data: "topic_data",
    Exports: "topic_exports",
    API: "topic_api",
    Collaboration: "topic_collaboration",
  };

  const LEVELS: (Level | "All")[] = ["All", "Beginner", "Intermediate", "Advanced"];
  const TOPICS: (Topic | "All")[] = [
    "All",
    "Quickstart",
    "Story Maps",
    "Styling",
    "Data",
    "Exports",
    "API",
    "Collaboration",
  ];

  const TUTORIALS: Tutorial[] = useMemo(
    () => [
      {
        id: "t1",
        titleKey: "t1_title",
        excerptKey: "t1_excerpt",
        level: "Beginner",
        durationMin: 12,
        topic: "Quickstart",
        href: "/resources/tutorials/quickstart-first-map",
        popular: true,
      },
      {
        id: "t2",
        titleKey: "t2_title",
        excerptKey: "t2_excerpt",
        level: "Intermediate",
        durationMin: 18,
        topic: "Story Maps",
        href: "/resources/tutorials/story-maps-segments",
        popular: true,
      },
      {
        id: "t3",
        titleKey: "t3_title",
        excerptKey: "t3_excerpt",
        level: "Intermediate",
        durationMin: 16,
        topic: "Styling",
        href: "/resources/tutorials/vector-styling-pro",
      },
      {
        id: "t4",
        titleKey: "t4_title",
        excerptKey: "t4_excerpt",
        level: "Beginner",
        durationMin: 10,
        topic: "Data",
        href: "/resources/tutorials/import-csv-geojson",
      },
      {
        id: "t5",
        titleKey: "t5_title",
        excerptKey: "t5_excerpt",
        level: "Intermediate",
        durationMin: 14,
        topic: "Exports",
        href: "/resources/tutorials/export-presets",
      },
      {
        id: "t6",
        titleKey: "t6_title",
        excerptKey: "t6_excerpt",
        level: "Advanced",
        durationMin: 20,
        topic: "API",
        href: "/resources/tutorials/rest-api-create-map",
      },
      {
        id: "t7",
        titleKey: "t7_title",
        excerptKey: "t7_excerpt",
        level: "Beginner",
        durationMin: 9,
        topic: "Collaboration",
        href: "/resources/tutorials/collaboration-roles",
      },
      {
        id: "t8",
        titleKey: "t8_title",
        excerptKey: "t8_excerpt",
        level: "Advanced",
        durationMin: 17,
        topic: "Story Maps",
        href: "/resources/tutorials/animated-routes",
      },
      {
        id: "t9",
        titleKey: "t9_title",
        excerptKey: "t9_excerpt",
        level: "Intermediate",
        durationMin: 11,
        topic: "Styling",
        href: "/resources/tutorials/custom-palettes",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TUTORIALS.filter((tu) => {
      const passLevel = level === "All" || tu.level === level;
      const passTopic = topic === "All" || tu.topic === topic;
      const textTitle = tr(tu.titleKey).toLowerCase();
      const textExcerpt = tr(tu.excerptKey).toLowerCase();
      const textTopic = tr(TOPIC_KEYS[tu.topic]).toLowerCase();
      const passQuery = !q || textTitle.includes(q) || textExcerpt.includes(q) || textTopic.includes(q);
      return passLevel && passTopic && passQuery;
    });
  }, [TUTORIALS, query, level, topic, t]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const qsel = gsap.utils.selector(el);
    const items = qsel(".card");
    const tl = gsap.timeline();
    tl.to(items, { autoAlpha: 0, y: 8, duration: 0.15, ease: "power1.in" })
      .set({}, {}, "+=0.02")
      .fromTo(
        qsel(".card"),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.05 }
      );
    return () => tl.kill();
  }, [level, topic, query]);

  const onSubmitSearch = (e: React.FormEvent) => e.preventDefault();

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 text-zinc-100">
      <section className="min-h-[28vh] md:min-h-[34vh] flex flex-col justify-end gap-4">
        <Pill>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {tr("pill_guides")}
        </Pill>
        <h1 className="tu-hero-title text-4xl md:text-6xl font-extrabold tracking-tight">
          {tr("hero_title")}
        </h1>
        <p className="tu-hero-sub max-w-2xl text-lg text-zinc-300">
          {tr("hero_desc")}
        </p>
        <div className="tu-hero-cta">
          <form onSubmit={onSubmitSearch} className="mt-2 max-w-xl">
            <div className="flex items-center gap-2 rounded-xl ring-1 ring-white/15 bg-white/5 px-3 py-2">
              <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M10 4a6 6 0 104.472 10.03l4.249 4.248 1.415-1.414-4.248-4.25A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("search_placeholder")}
                className="flex-1 bg-transparent outline-none placeholder:text-zinc-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  {tr("clear")}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="tu-fade mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <div className="text-sm font-semibold mb-2">{tr("filter_level")}</div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm font-semibold transition",
                    active
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-white/5 hover:bg-white/10 text-zinc-200 ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {tr(LEVEL_KEYS[l])}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <div className="text-sm font-semibold mb-2">{tr("filter_topic")}</div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((tp) => {
              const active = topic === tp;
              return (
                <button
                  key={tp}
                  onClick={() => setTopic(tp)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm font-semibold transition",
                    active
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-white/5 hover:bg-white/10 text-zinc-200 ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {tr(TOPIC_KEYS[tp])}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="tu-fade mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link
          href="/resources/tutorials/quickstart-first-map"
          className="group col-span-2 rounded-2xl overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-800/40 backdrop-blur hover:ring-emerald-400/30 transition"
        >
          <div className="aspect-video relative">
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-14 w-14 grid place-items-center rounded-full bg-white/90 text-zinc-900 group-hover:scale-105 transition">
                ▶
              </div>
            </div>
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(60%_60%_at_60%_40%,rgba(16,185,129,.4),transparent),radial-gradient(70%_70%_at_30%_70%,rgba(59,130,246,.25),transparent)]" />
          </div>
          <div className="p-6 md:p-8">
            <div className="text-sm text-emerald-400 font-semibold mb-1">{tr("featured_video")}</div>
            <h2 className="text-2xl md:text-3xl font-bold group-hover:text-emerald-300 transition">
              {tr("t1_title")}
            </h2>
            <p className="mt-2 text-zinc-300">
              {tr("t1_featured_excerpt")}
            </p>
          </div>
        </Link>

        <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <h3 className="font-semibold text-lg">{tr("path_title")}</h3>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">1</span>
              {tr("path_step1")}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">2</span>
              {tr("path_step2")}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">3</span>
              {tr("path_step3")}
            </li>
          </ol>
          <Link
            href="/resources/tutorials/quickstart-first-map"
            className="mt-4 inline-block px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
          >
            {tr("path_cta")}
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <div ref={gridRef} className="tu-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((tu) => (
            <Link
              key={tu.id}
              href={tu.href}
              className={[
                "card rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur transition",
                "hover:-translate-y-0.5 hover:ring-emerald-400/30",
                tu.popular ? "ring-emerald-400/20" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400">{tr(TOPIC_KEYS[tu.topic])}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15">
                  {tr(LEVEL_KEYS[tu.level])}
                </span>
                {tu.popular && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                    {tr("label_popular")}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{tr(tu.titleKey)}</h3>
              <p className="mt-2 text-sm text-zinc-300">{tr(tu.excerptKey)}</p>
              <div className="mt-4 text-xs text-zinc-400">
                {tu.durationMin} {tr("label_minutes")}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="tu-fade mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={325} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">{tr("stat_tutorials")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={980} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">{tr("stat_minutes")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={128} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">{tr("stat_assets")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={42} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">{tr("stat_paths")}</p>
          </div>
        </div>
      </section>

      <section className="tu-fade my-12">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {tr("cta_title")}
          </h3>
          <p className="mt-2 opacity-90">{tr("cta_desc")}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/community" className="px-6 py-3 rounded-lg bg-white font-semibold hover:bg-zinc-100">
              {tr("cta_go_community")}
            </Link>
            <Link href="/resources/dev-docs" className="px-6 py-3 rounded-lg bg-black/10 hover:bg-black/15 font-semibold">
              {tr("cta_dev_docs")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
