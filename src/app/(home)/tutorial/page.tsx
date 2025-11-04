"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

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
  title: string;
  excerpt: string;
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
  return () => { tween.kill(); };
  }, [value, reduce]);

  return <div ref={ref} className={className} />;
}

export default function TutorialPage() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "All">("All");
  const [topic, setTopic] = useState<Topic | "All">("All");
  const gridRef = useRef<HTMLDivElement>(null);

  const TUTORIALS: Tutorial[] = useMemo(
    () => [
      {
        id: "t1",
        title: "Quickstart: Build your first map",
        excerpt: "Create a project, add layers, and publish in minutes.",
        level: "Beginner",
        durationMin: 12,
        topic: "Quickstart",
        href: "/resources/tutorials/quickstart-first-map",
        popular: true,
      },
      {
        id: "t2",
        title: "Story Maps: segments & playback",
        excerpt: "Turn routes into narratives with smooth timelines.",
        level: "Intermediate",
        durationMin: 18,
        topic: "Story Maps",
        href: "/resources/tutorials/story-maps-segments",
        popular: true,
      },
      {
        id: "t3",
        title: "Vector styling like a pro",
        excerpt: "Categories, numeric ramps, and symbol best practices.",
        level: "Intermediate",
        durationMin: 16,
        topic: "Styling",
        href: "/resources/tutorials/vector-styling-pro",
      },
      {
        id: "t4",
        title: "Import data from CSV & GeoJSON",
        excerpt: "Clean columns, set types, and validate geometry.",
        level: "Beginner",
        durationMin: 10,
        topic: "Data",
        href: "/resources/tutorials/import-csv-geojson",
      },
      {
        id: "t5",
        title: "Exports: on-brand PDFs & PNGs",
        excerpt: "Make presets, watermarks, and share with your org.",
        level: "Intermediate",
        durationMin: 14,
        topic: "Exports",
        href: "/resources/tutorials/export-presets",
      },
      {
        id: "t6",
        title: "REST API: create maps automatically",
        excerpt: "Use tokens to create, import layers, and trigger exports.",
        level: "Advanced",
        durationMin: 20,
        topic: "API",
        href: "/resources/tutorials/rest-api-create-map",
      },
      {
        id: "t7",
        title: "Collaboration & roles",
        excerpt: "Invite members, set permissions, and track history.",
        level: "Beginner",
        durationMin: 9,
        topic: "Collaboration",
        href: "/resources/tutorials/collaboration-roles",
      },
      {
        id: "t8",
        title: "Animated markers & route effects",
        excerpt: "Use timeline effects and easing for presentations.",
        level: "Advanced",
        durationMin: 17,
        topic: "Story Maps",
        href: "/resources/tutorials/animated-routes",
      },
      {
        id: "t9",
        title: "Custom palettes & brand tokens",
        excerpt: "Keep styling consistent with brand color systems.",
        level: "Intermediate",
        durationMin: 11,
        topic: "Styling",
        href: "/resources/tutorials/custom-palettes",
      },
    ],
    []
  );

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TUTORIALS.filter((t) => {
      const passLevel = level === "All" || t.level === level;
      const passTopic = topic === "All" || t.topic === topic;
      const passQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.excerpt.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q);
      return passLevel && passTopic && passQuery;
    });
  }, [TUTORIALS, query, level, topic]);

  // Page animations
  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const base = { ease: "power2.out", duration: prefersReduced || reduce ? 0 : 0.9 } as const;
  const ctx = gsap.context(() => {
      gsap.set([".tu-hero-title", ".tu-hero-sub", ".tu-hero-cta"], { autoAlpha: 0, y: 20 });
      gsap
        .timeline()
        .to(".tu-hero-title", { autoAlpha: 1, y: 0, ...base })
        .to(".tu-hero-sub", { autoAlpha: 1, y: 0, ...base }, "<0.08")
        .to(".tu-hero-cta", { autoAlpha: 1, y: 0, ...base }, "<0.08");

      gsap.utils.toArray<HTMLElement>(".tu-fade").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 16 });
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          onEnter: () =>
            gsap.to(el, {
              autoAlpha: 1,
              y: 0,
              duration: prefersReduced || reduce ? 0 : 0.7,
              ease: "power2.out",
            }),
        });
      });

      gsap.utils.toArray<HTMLElement>(".tu-stagger").forEach((wrap) => {
        const cards = wrap.querySelectorAll<HTMLElement>(".card");
        gsap.set(cards, { autoAlpha: 0, y: 18 });
        ScrollTrigger.create({
          trigger: wrap,
          start: "top 80%",
          onEnter: () =>
            gsap.to(cards, {
              autoAlpha: 1,
              y: 0,
              stagger: 0.08,
              duration: prefersReduced || reduce ? 0 : 0.7,
              ease: "power2.out",
            }),
        });
      });
    });

  return () => { ctx.revert(); };
  }, [reduce]);

  // Filter transition
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const items = q(".card");
  const tl = gsap.timeline();
    tl.to(items, { autoAlpha: 0, y: 8, duration: 0.15, ease: "power1.in" })
      .set({}, {}, "+=0.02")
      .fromTo(
        q(".card"),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.05 }
      );
  return () => { tl.kill(); };
  }, [level, topic, query]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 text-zinc-100">
      {/* HERO */}
      <section className="min-h-[28vh] md:min-h-[34vh] flex flex-col justify-end gap-4">
        <Pill>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Tutorials
        </Pill>
        <h1 className="tu-hero-title text-4xl md:text-6xl font-extrabold tracking-tight">
          Learn IMOS faster.
        </h1>
        <p className="tu-hero-sub max-w-2xl text-lg text-zinc-300">
          Hands-on guides for every level — from your first map to API automation.
        </p>
        <div className="tu-hero-cta">
          <form onSubmit={onSubmitSearch} className="mt-2 max-w-xl">
            <div className="flex items-center gap-2 rounded-xl ring-1 ring-white/15 bg-white/5 px-3 py-2">
              <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4a6 6 0 104.472 10.03l4.249 4.248 1.415-1.414-4.248-4.25A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tutorials, topics, or features…"
                className="flex-1 bg-transparent outline-none placeholder:text-zinc-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* FILTERS */}
      <section className="tu-fade mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <div className="text-sm font-semibold mb-2">Level</div>
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
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl p-4 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <div className="text-sm font-semibold mb-2">Topic</div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => {
              const active = topic === t;
              return (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm font-semibold transition",
                    active
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-white/5 hover:bg-white/10 text-zinc-200 ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED VIDEO + PATH */}
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
            <div className="text-sm text-emerald-400 font-semibold mb-1">Featured video</div>
            <h2 className="text-2xl md:text-3xl font-bold group-hover:text-emerald-300 transition">
              Quickstart: Build your first map
            </h2>
            <p className="mt-2 text-zinc-300">
              Create a project, add data, and publish a polished map — all in under 15 minutes.
            </p>
          </div>
        </Link>

        <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <h3 className="font-semibold text-lg">Learning Path — 30 minutes</h3>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">1</span>
              Create your first project
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">2</span>
              Import CSV/GeoJSON and style layers
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 text-xs">3</span>
              Export and share to your team
            </li>
          </ol>
          <Link
            href="/resources/tutorials/quickstart-first-map"
            className="mt-4 inline-block px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
          >
            Start path
          </Link>
        </div>
      </section>

      {/* TUTORIAL GRID */}
      <section className="mt-10">
        <div ref={gridRef} className="tu-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={[
                "card rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur transition",
                "hover:-translate-y-0.5 hover:ring-emerald-400/30",
                t.popular ? "ring-emerald-400/20" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400">{t.topic}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15">
                  {t.level}
                </span>
                {t.popular && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                    Popular
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{t.excerpt}</p>
              <div className="mt-4 text-xs text-zinc-400">{t.durationMin} min</div>
            </Link>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="tu-fade mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={325} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Total tutorials</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={980} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Minutes of content</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={128} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Downloadable assets</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={42} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Learning paths</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="tu-fade my-12">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Stuck on something? Ask the community.
          </h3>
          <p className="mt-2 opacity-90">Get answers fast and share your wins with others.</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/community"
              className="px-6 py-3 rounded-lg bg-white font-semibold hover:bg-zinc-100"
            >
              Go to Community
            </Link>
            <Link
              href="/resources/dev-docs"
              className="px-6 py-3 rounded-lg bg-black/10 hover:bg-black/15 font-semibold"
            >
              Developer Docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
