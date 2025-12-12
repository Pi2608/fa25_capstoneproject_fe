"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getHomeStats,
  type HomeStatsResponse,
} from "@/lib/api-home";
import {
  getCommunityPosts,
  type CommunityPostSummaryResponse,
} from "@/lib/api-community";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";

type Topic =
  | "All"
  | "Product"
  | "Tutorial"
  | "Stories"
  | "Education"
  | "Business";

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
  const [posts, setPosts] = useState<CommunityPostSummaryResponse[] | null>(
    null
  );

  // DÙNG CHUNG HOOK SCROLL
  useGsapHomeScroll({
    reduce,
    heroSelectors: {
      title: ".cm-hero-title",
      subtitle: ".cm-hero-sub",
      cta: ".cm-hero-cta",
    },
    fadeSelector: ".cm-fade",
    stagger: {
      container: ".cm-stagger",
      card: ".card",
    },
  });

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

  const topics: Topic[] = [
    "All",
    "Product",
    "Tutorial",
    "Stories",
    "Education",
    "Business",
  ];

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

  // Animation khi đổi topic (giữ nguyên, không liên quan ScrollTrigger)
  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const items = q(".card");
    const tl = gsap.timeline();
    tl.to(items, {
      autoAlpha: 0,
      y: 8,
      duration: 0.15,
      ease: "power1.in",
    })
      .set({}, {}, "+=0.02")
      .fromTo(
        q(".card"),
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
          stagger: 0.05,
        }
      );
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
                    active
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-white/5 hover:bg-white/10 text-zinc-200 ring-1 ring-white/10",
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
            <div className="text-sm text-emerald-400 font-semibold mb-2">
              {t("community", "featured")}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold group-hover:text-emerald-300 transition">
              {POSTS[0].title}
            </h2>
            <p className="mt-2 text-zinc-300 max-w-2xl">
              {POSTS[0].excerpt}
            </p>
            <div className="mt-4 text-xs text-zinc-400">
              {POSTS[0].date} • {POSTS[0].readMin}{" "}
              {t("community", "minutes")} {t("community", "read")}
            </div>
          </Link>
        )}
      </section>


      <section className="cm-fade my-12">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950">
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t("community", "share_title")}
          </h3>
          <p className="mt-2 opacity-90">
            {t("community", "share_desc")}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/resources/map-gallery"
              className="px-6 py-3 rounded-lg bg-black/10 hover:bg-black/15 font-semibold"
            >
              {t("community", "share_btn_gallery")}
            </Link>
            <Link
              href="/resources/map-gallery/submit"
              className="px-6 py-3 rounded-lg bg-white font-semibold hover:bg-zinc-100"
            >
              {t("community", "share_btn_submit")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
