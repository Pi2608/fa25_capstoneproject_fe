"use client";

import Link from "next/link";
import { useLayoutEffect, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";
import { getCommunityPosts, type CommunityPostSummaryResponse } from "@/lib/api-community";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";

gsap.registerPlugin(ScrollTrigger);

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h2V2Zm14 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10h18ZM7 14h4v4H7v-4Z"
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
    <span className="topic-pill inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
      {children}
    </span>
  );
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
};

export default function BlogClient({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  const [posts, setPosts] = useState<CommunityPostSummaryResponse[]>([]);

  const topicParamRaw = (searchParams?.topic as string) || "All";
  const activeTopic = topicParamRaw;

  useGsapHomeScroll({
    reduce,
    heroSelectors: {
      title: ".bh-title",
      subtitle: ".bh-sub",
      cta: ".bh-cta",
    },
  });

  useEffect(() => {
    let cancelled = false;

    const fetchPosts = async () => {
      try {
        const data = await getCommunityPosts();
        if (!cancelled) {
          setPosts(data);
        }
      } catch (err) {
        console.error("Failed to load community posts", err);
      }
    };

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const topics = Array.from(
    new Set(
      posts
        .map((p) => p.topic)
        .filter((t): t is string => !!t && t.trim().length > 0),
    ),
  );
  const topicFilters = ["All", ...topics];

  const list =
    activeTopic === "All"
      ? posts
      : posts.filter((p) => p.topic === activeTopic);

  const featured = list[0];
  const others = featured ? list.filter((p) => p.slug !== featured.slug) : [];

  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: prefersReduced || reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      ScrollTrigger.batch(".topic-chip", {
        start: "top 90%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.06,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".featured-card", { autoAlpha: 0, y: 20 });
      ScrollTrigger.create({
        trigger: ".featured-card",
        start: "top 85%",
        onEnter: () =>
          gsap.to(".featured-card", { autoAlpha: 1, y: 0, ...baseIn }),
      });

      ScrollTrigger.batch(".post-card", {
        start: "top 85%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.08,
            ...baseIn,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, { autoAlpha: 0, y: 16 }),
      });

      ScrollTrigger.batch(".section-title", {
        start: "top 88%",
        onEnter: (els) =>
          gsap.to(els, { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: (els) =>
          gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set([".subscribe-card", ".cta-banner"], {
        autoAlpha: 0,
        y: 16,
      });
      ScrollTrigger.create({
        trigger: ".subscribe-card",
        start: "top 85%",
        onEnter: () =>
          gsap.to(".subscribe-card", { autoAlpha: 1, y: 0, ...baseIn }),
      });
      ScrollTrigger.create({
        trigger: ".cta-banner",
        start: "top 90%",
        onEnter: () =>
          gsap.to(".cta-banner", { autoAlpha: 1, y: 0, ...baseIn }),
      });
    });

    return () => ctx.revert();
  }, [reduce]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="blog-hero relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="bh-sub text-sm tracking-wide text-emerald-300/90">
            {t("blog.breadcrumb")}
          </p>
          <h1 className="bh-title mt-2 text-3xl font-semibold sm:text-4xl">
            {t("blog.hero_title")}
          </h1>
          <p className="bh-sub mt-3 max-w-2xl text-zinc-300">
            {t("blog.hero_sub")}
          </p>
          <div className="mt-6">
            <Link
              href="#latest"
              className="bh-cta inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {t("blog.hero_cta")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10">
        <div className="section-title text-sm font-medium">
          {t("blog.topics")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {topicFilters.map((topic) => {
            const href =
              topic === "All"
                ? "/resources/blog"
                : `/resources/blog?topic=${encodeURIComponent(topic)}`;
            const active = topic === activeTopic;
            return (
              <Link
                key={topic}
                href={href}
                className={`topic-chip opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {topic === "All" ? t("blog.filter_all") : topic}
              </Link>
            );
          })}
        </div>
      </section>

      {featured && (
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="featured-card col-span-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <div className="aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent ring-1 ring-white/5" />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {featured.topic && <TagPill>{featured.topic}</TagPill>}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-snug">
              {featured.title}
            </h2>
            <p className="mt-2 text-zinc-300">{featured.excerpt}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-emerald-300" />
                {fmtDate(featured.publishedAt ?? featured.createdAt)}
              </span>
            </div>
            <div className="mt-4">
              <Link
                href={`/resources/blog/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                {t("blog.read_post")}
              </Link>
            </div>
          </article>

          <aside className="subscribe-card rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <h3 className="text-lg font-semibold">
              {t("blog.subscribe_title")}
            </h3>
            <p className="mt-1 text-sm text-zinc-300">
              {t("blog.subscribe_desc")}
            </p>
            <form
              className="mt-4 space-y-3"
              action="/resources/blog/subscribe"
              method="post"
            >
              <input
                name="email"
                type="email"
                required
                placeholder={t("blog.subscribe_placeholder")}
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <button className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                {t("blog.subscribe_button")}
              </button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">
              {t("blog.subscribe_note")}
            </p>
          </aside>
        </section>
      )}

      <section id="latest" className="mt-10">
        <h2 className="section-title text-xl font-semibold opacity-0 translate-y-[12px]">
          {t("blog.latest_posts")}
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((p) => {
            const date = fmtDate(p.publishedAt ?? p.createdAt);
            return (
              <article
                key={p.slug}
                className="post-card opacity-0 translate-y-[16px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5"
              >
                <div className="aspect-[16/9] w-full rounded-xl bg-zinc-800/70 ring-1 ring-white/5" />
                <h3 className="mt-2 text-base font-semibold leading-snug">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-300">{p.excerpt}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4 text-emerald-300" />
                    {date}
                  </span>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/resources/blog/${p.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline"
                  >
                    {t("blog.read_more")} <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="cta-banner mt-12 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">
              {t("blog.cta_title")}
            </h3>
            <p className="mt-1 text-zinc-300">{t("blog.cta_desc")}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/resources/blog/request"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {t("blog.cta_request")}
            </Link>
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              {t("blog.cta_more_resources")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
