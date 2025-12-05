"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useI18n } from "@/i18n/I18nProvider";
import { getHomeStats, type HomeStatsResponse } from "@/lib/api-home";
import { getCommunityPosts, type CommunityPostSummaryResponse } from "@/lib/api-community";

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

const COMMUNITY_STATS_FALLBACK: HomeStatsResponse = {
  organizationCount: 14820,
  templateCount: 128,
  totalMaps: 325,
  monthlyExports: 42,
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
    return () => {
      tween.kill();
    };
  }, [value, reduce]);

  return <div ref={ref} className={className} />;
}

export default function CommunityPage() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [topic, setTopic] = useState<Topic>("All");
  const [email, setEmail] = useState<string>("");
  const cardsRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<HomeStatsResponse | null>(null);
  const [posts, setPosts] = useState<CommunityPostSummaryResponse[] | null>(null);

  const TOPIC_LABEL: Record<Topic, string> = useMemo(
    () => ({
      All: t("community", "topic_all"),
      Product: t("community", "topic_product"),
      Tutorial: t("community", "topic_tutorial"),
      Stories: t("community", "topic_stories"),
      Education: t("community", "topic_education"),
      Business: t("community", "topic_business"),
    }),
    [t]
  );

  const POSTS: Post[] = useMemo(() => {
    if (!posts || posts.length === 0) return [];

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      topic: (p.topic as Exclude<Topic, "All">) || "Education",
      date: new Date(p.publishedAt ?? "").toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      readMin: 6,
      href: `/community/${p.slug}`,
    }));
  }, [posts]);

  const EVENTS: EventItem[] = useMemo(
    () => [
      {
        id: "e1",
        date: "Apr 10",
        title: t("community", "event1_title"),
        type: "Webinar",
        href: "/resources/webinars/story-maps-reporting",
      },
      {
        id: "e2",
        date: "Apr 25",
        title: t("community", "event2_title"),
        type: "Release",
        href: "/resources/blog/release-data-layers-v2",
      },
      {
        id: "e3",
        date: "May 08",
        title: t("community", "event3_title"),
        type: "Showcase",
        href: "/resources/map-gallery",
      },
    ],
    [t]
  );

  const topics: Topic[] = ["All", "Product", "Tutorial", "Stories", "Education", "Business"];

  const filtered = useMemo(
    () => (topic === "All" ? POSTS : POSTS.filter((p) => p.topic === topic)),
    [POSTS, topic]
  );

  useEffect(() => {
    let cancelled = false;

    getHomeStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch(() => {
        // giữ fallback nếu lỗi
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCommunityPosts(topic === "All" ? undefined : topic)
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
        }
      })
      .catch(() => {
        // nếu lỗi thì giữ rỗng, UI vẫn hoạt động
      });

    return () => {
      cancelled = true;
    };
  }, [topic]);

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
          onEnter: () =>
            gsap.to(el, { autoAlpha: 1, y: 0, duration: prefersReduced || reduce ? 0 : 0.7, ease: "power2.out" }),
        });
      });
      gsap.utils.toArray<HTMLElement>(".cm-stagger").forEach((wrap) => {
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
    return () => {
      ctx.revert();
    };
  }, [reduce]);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const items = q(".card");
    const tl = gsap.timeline();
    tl.to(items, { autoAlpha: 0, y: 8, duration: 0.15, ease: "power1.in" })
      .set({}, {}, "+=0.02")
      .fromTo(q(".card"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.05 });
    return () => {
      tl.kill();
    };
  }, [topic]);

  const onSubscribe = () => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      alert(t("community", "newsletter_invalid"));
      return;
    }
    alert(t("community", "newsletter_thanks"));
    setEmail("");
  };

  const typeLabel = (tp: EventItem["type"]) =>
    tp === "Webinar"
      ? t("community", "type_webinar")
      : tp === "Release"
      ? t("community", "type_release")
      : t("community", "type_showcase");

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 text-zinc-100">
      <section className="min-h-[30vh] md:min-h-[36vh] flex flex-col justify-end gap-4">
        <h1 className="cm-hero-title text-4xl md:text-6xl font-extrabold tracking-tight">
          {t("community", "hero_title")}
        </h1>
        <p className="cm-hero-sub max-w-2xl text-lg text-zinc-300">
          {t("community", "hero_subtitle")}
        </p>
        <div className="cm-hero-cta flex items-center gap-3">
          <Link
            href="/resources/blog"
            className="inline-block px-5 py-2.5 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
          >
            {t("community", "cta_read")}
          </Link>
          <Link
            href="/resources/map-gallery"
            className="inline-block px-5 py-2.5 rounded-lg ring-1 ring-white/15 hover:bg-white/5 transition"
          >
            {t("community", "cta_gallery")}
          </Link>
        </div>
      </section>

      <section className="cm-fade mt-8">
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {topics.map((tpc) => {
              const active = topic === tpc;
              return (
                <button
                  key={tpc}
                  onClick={() => setTopic(tpc)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm font-semibold transition",
                    active ? "bg-emerald-500 text-zinc-950" : "bg-white/5 hover:bg-white/10 text-zinc-200 ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {TOPIC_LABEL[tpc]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="cm-fade mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {POSTS[0] && (
          <Link
            href={POSTS[0].href}
            className="group col-span-2 rounded-2xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-800/40 backdrop-blur hover:ring-emerald-400/30 transition"
          >
            <div className="text-sm text-emerald-400 font-semibold mb-2">{t("community", "featured")}</div>
            <h2 className="text-2xl md:text-3xl font-bold group-hover:text-emerald-300 transition">{POSTS[0].title}</h2>
            <p className="mt-2 text-zinc-300 max-w-2xl">{POSTS[0].excerpt}</p>
            <div className="mt-4 text-xs text-zinc-400">
              {POSTS[0].date} • {POSTS[0].readMin} {t("community", "minutes")} {t("community", "read")}
            </div>
          </Link>
        )}

        <div className="rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur">
          <h3 className="font-semibold text-lg">{t("community", "nl_title")}</h3>
          <p className="mt-1 text-sm text-zinc-300">{t("community", "nl_desc")}</p>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg bg-black/30 ring-1 ring-white/15 px-3 py-2 outline-none focus:ring-emerald-400/40"
              placeholder={t("community", "nl_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              aria-label="Email"
            />
            <button
              onClick={onSubscribe}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
            >
              {t("community", "nl_button")}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div ref={cardsRef} className="cm-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              className="card rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 backdrop-blur hover:-translate-y-0.5 hover:ring-emerald-400/30 transition"
            >
              <div className="text-xs font-bold text-emerald-400">{TOPIC_LABEL[p.topic]}</div>
              <h3 className="mt-1 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-zinc-300">{p.excerpt}</p>
              <div className="mt-4 text-xs text-zinc-400">
                {p.date} • {p.readMin} {t("community", "minutes")} {t("community", "read")}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="cm-fade mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp
              value={stats?.organizationCount ?? COMMUNITY_STATS_FALLBACK.organizationCount}
              className="text-3xl font-extrabold tracking-tight"
            />
            <p className="mt-1 text-sm text-zinc-300">{t("community", "stat_members")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp
              value={stats?.totalMaps ?? COMMUNITY_STATS_FALLBACK.totalMaps}
              className="text-3xl font-extrabold tracking-tight"
            />
            <p className="mt-1 text-sm text-zinc-300">{t("community", "stat_posts")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp
              value={stats?.templateCount ?? COMMUNITY_STATS_FALLBACK.templateCount}
              className="text-3xl font-extrabold tracking-tight"
            />
            <p className="mt-1 text-sm text-zinc-300">{t("community", "stat_templates")}</p>
          </div>
          <div className="rounded-2xl px-6 py-5 bg-white/5 ring-1 ring-white/10 text-center">
            <CountUp
              value={stats?.monthlyExports ?? COMMUNITY_STATS_FALLBACK.monthlyExports}
              className="text-3xl font-extrabold tracking-tight"
            />
            <p className="mt-1 text-sm text-zinc-300">{t("community", "stat_collections")}</p>
          </div>
        </div>
      </section>

      <section className="cm-fade mt-12">
        <h2 className="text-2xl font-bold">{t("community", "whats_happening")}</h2>
        <div className="mt-4 rounded-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur p-4 md:p-5">
          <ol className="relative border-l border-white/10 pl-6">
            {EVENTS.map((ev) => (
              <li key={ev.id} className="mb-6 last:mb-0">
                <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full bg-emerald-500" />
                <div className="text-xs text-zinc-400">
                  {ev.date} • {typeLabel(ev.type)}
                </div>
                <Link href={ev.href} className="font-semibold hover:text-emerald-300 transition">
                  {ev.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cm-fade my-12">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">{t("community", "share_title")}</h3>
          <p className="mt-2 opacity-90">{t("community", "share_desc")}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/resources/map-gallery" className="px-6 py-3 rounded-lg bg-black/10 hover:bg-black/15 font-semibold">
              {t("community", "share_btn_gallery")}
            </Link>
            <Link href="/resources/map-gallery/submit" className="px-6 py-3 rounded-lg bg-white font-semibold hover:bg-zinc-100">
              {t("community", "share_btn_submit")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
