"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

type Topic = "All" | "Product" | "Tutorial" | "Stories" | "Education" | "Business";

type Post = {
  id: string;
  title: string;
  excerpt: string;
  topic: Exclude<Topic, "All">;
  date: string;
  readMin: number;
  href: string;
};

type EventItem = {
  id: string;
  date: string;
  title: string;
  type: "Webinar" | "Release" | "Showcase";
  href: string;
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

export default function CommunityPage() {
  const reduce = useReducedMotion();
  const [topic, setTopic] = useState<Topic>("All");
  const [email, setEmail] = useState("");
  const cardsRef = useRef<HTMLDivElement>(null);

  const POSTS: Post[] = useMemo(
    () => [
      {
        id: "p1",
        title: "How schools use Story Maps for field trips",
        excerpt: "A lightweight workflow for planning, collecting notes, and presenting routes.",
        topic: "Education",
        date: "Mar 12, 2025",
        readMin: 6,
        href: "/resources/blog/story-maps-field-trips",
      },
      {
        id: "p2",
        title: "Vector styling best practices",
        excerpt: "Symbols, category palettes, and performance tips for large datasets.",
        topic: "Tutorial",
        date: "Mar 5, 2025",
        readMin: 7,
        href: "/resources/blog/vector-styling-pro",
      },
      {
        id: "p3",
        title: "From spreadsheets to polished maps in 10 minutes",
        excerpt: "Import CSV, clean columns, and publish with a one-click template.",
        topic: "Product",
        date: "Feb 27, 2025",
        readMin: 5,
        href: "/resources/blog/csv-to-map",
      },
      {
        id: "p4",
        title: "A city’s tree inventory — lessons learned",
        excerpt: "A showcase of data standards and volunteer contributions.",
        topic: "Stories",
        date: "Feb 19, 2025",
        readMin: 8,
        href: "/resources/blog/city-tree-inventory",
      },
      {
        id: "p5",
        title: "Teaching GIS with templates",
        excerpt: "Scaffold assignments so students focus on reasoning, not boilerplate.",
        topic: "Education",
        date: "Feb 10, 2025",
        readMin: 6,
        href: "/resources/blog/teach-gis-templates",
      },
      {
        id: "p6",
        title: "Export presets your stakeholders will love",
        excerpt: "Create on-brand PDF/PNG presets and share across the org.",
        topic: "Product",
        date: "Jan 30, 2025",
        readMin: 5,
        href: "/resources/blog/export-presets",
      },
    ],
    []
  );

  const EVENTS: EventItem[] = useMemo(
    () => [
      {
        id: "e1",
        date: "Apr 10",
        title: "Live Webinar — Story Maps for reporting",
        type: "Webinar",
        href: "/resources/webinars/story-maps-reporting",
      },
      {
        id: "e2",
        date: "Apr 25",
        title: "Release — Data Layers v2",
        type: "Release",
        href: "/resources/blog/release-data-layers-v2",
      },
      {
        id: "e3",
        date: "May 08",
        title: "Showcase — Urban Planning gallery",
        type: "Showcase",
        href: "/resources/map-gallery",
      },
    ],
    []
  );

  const topics: Topic[] = ["All", "Product", "Tutorial", "Stories", "Education", "Business"];

  const filtered = useMemo(
    () => (topic === "All" ? POSTS : POSTS.filter((p) => p.topic === topic)),
    [POSTS, topic]
  );

  // Page animations
  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const base = { ease: "power2.out", duration: prefersReduced || reduce ? 0 : 0.9 } as const;
    const ctx = gsap.context(() => {
      gsap.set([".cm-hero-title", ".cm-hero-sub", ".cm-hero-cta"], { autoAlpha: 0, y: 20 });
      gsap
        .timeline()
        .to(".cm-hero-title", { autoAlpha: 1, y: 0, ...base })
        .to(".cm-hero-sub", { autoAlpha: 1, y: 0, ...base }, "<0.08")
        .to(".cm-hero-cta", { autoAlpha: 1, y: 0, ...base }, "<0.08");

      gsap.utils.toArray<HTMLElement>(".cm-fade").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 16 });
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: prefersReduced || reduce ? 0 : 0.7, ease: "power2.out" }),
        });
      });

      gsap.utils.toArray<HTMLElement>(".cm-stagger").forEach((wrap) => {
        const cards = wrap.querySelectorAll<HTMLElement>(".card");
        gsap.set(cards, { autoAlpha: 0, y: 18 });
        ScrollTrigger.create({
          trigger: wrap,
          start: "top 80%",
          onEnter: () =>
            gsap.to(cards, { autoAlpha: 1, y: 0, stagger: 0.08, duration: prefersReduced || reduce ? 0 : 0.7, ease: "power2.out" }),
        });
      });
    });

    return () => ctx.revert();
  }, [reduce]);

  // Animate when filter changes
  useEffect(() => {
    const el = cardsRef.current;
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
    return () => tl.kill();
  }, [topic]);

  const onSubscribe = () => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      alert("Please enter a valid email.");
      return;
    }
    alert("Thanks! We'll keep you posted.");
    setEmail("");
  };

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 text-zinc-100">
      {/* HERO */}
      <section className="min-h-[30vh] md:min-h-[36vh] flex flex-col justify-end gap-4">
        <Pill>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Community
        </Pill>
        <h1 className="cm-hero-title text-4xl md:text-6xl font-extrabold tracking-tight">
          Learn together. Build together.
        </h1>
        <p className="cm-hero-sub max-w-2xl text-lg text-zinc-300">
          Tips, tutorials, showcases, and updates from the IMOS community — whether you teach, plan, or explore.
        </p>
        <div className="cm-hero-cta flex items-center gap-3">
          <Link
            href="/resources/blog"
            className="inline-block px-5 py-2.5 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
          >
            Start reading
          </Link>
          <Link
            href="/resources/map-gallery"
            className="inline-block px-5 py-2.5 rounded-lg ring-1 ring-white/15 hover:bg-white/5 transition"
          >
            Map gallery
          </Link>
        </div>
      </section>

      {/* TOPICS */}
      <section className="cm-fade mt-8">
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {topics.map((t) => {
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

      {/* FEATURE + NEWSLETTER */}
      <section className="cm-fade mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link
          href={POSTS[0].href}
          className="group col-span-2 rounded-2xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-800/40 backdrop-blur hover:ring-emerald-400/30 transition"
        >
          <div className="text-sm text-emerald-400 font-semibold mb-2">Featured</div>
          <h2 className="text-2xl md:text-3xl font-bold group-hover:text-emerald-300 transition">
            {POSTS[0].title}
          </h2>
          <p className="mt-2 text-zinc-300 max-w-2xl">{POSTS[0].excerpt}</p>
          <div className="mt-4 text-xs text-zinc-400">
            {POSTS[0].date} • {POSTS[0].readMin} min read
          </div>
        </Link>

        <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <h3 className="font-semibold text-lg">Subscribe for updates</h3>
          <p className="mt-1 text-sm text-zinc-300">
            Short monthly notes: tips, templates, and tutorials.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg bg-black/30 ring-1 ring-white/15 px-3 py-2 outline-none focus:ring-emerald-400/40"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
            <button
              onClick={onSubscribe}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
            >
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* POSTS GRID */}
      <section className="mt-10">
        <div ref={cardsRef} className="cm-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              className="card rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur hover:-translate-y-0.5 hover:ring-emerald-400/30 transition"
            >
              <div className="text-xs font-bold text-emerald-400">{p.topic}</div>
              <h3 className="mt-1 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{p.excerpt}</p>
              <div className="mt-4 text-xs text-zinc-400">
                {p.date} • {p.readMin} min read
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="cm-fade mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={14820} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Community members</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={325} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Tutorials & posts</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={128} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Shared templates</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp value={42} className="text-3xl font-extrabold tracking-tight" />
            <p className="mt-1 text-sm text-zinc-300">Community showcases</p>
          </div>
        </div>
      </section>

      {/* EVENTS / TIMELINE */}
      <section className="cm-fade mt-12">
        <h2 className="text-2xl font-bold">What’s happening</h2>
        <div className="mt-4 rounded-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur p-4 md:p-5">
          <ol className="relative border-l border-white/10 pl-6">
            {EVENTS.map((ev) => (
              <li key={ev.id} className="mb-6 last:mb-0">
                <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full bg-emerald-500" />
                <div className="text-xs text-zinc-400">{ev.date} • {ev.type}</div>
                <Link href={ev.href} className="font-semibold hover:text-emerald-300 transition">
                  {ev.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="cm-fade my-12">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">Share your map with the community</h3>
          <p className="mt-2 opacity-90">
            Submit your project and inspire others. We feature great ideas every month.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/resources/map-gallery" className="px-6 py-3 rounded-lg bg-black/10 hover:bg-black/15 font-semibold">
              Browse gallery
            </Link>
            <Link href="/resources/map-gallery/submit" className="px-6 py-3 rounded-lg bg-white font-semibold hover:bg-zinc-100">
              Submit a map
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
