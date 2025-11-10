"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";

gsap.registerPlugin(ScrollTrigger);

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h2V2Zm14 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10h18ZM7 14h4v4H7v-4Z" />
    </svg>
  );
}
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm1 5v4.59l3.3 3.3-1.4 1.41L11 12.41V7h2Z" />
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

/** === Types & data keys (i18n) === */
type Category = "Product" | "Tutorial" | "Stories" | "Education" | "Business";
type CategoryFilter = "All" | Category;
type TagKey =
  | "StoryMaps" | "Templates" | "Layers" | "Styling" | "Organizations"
  | "Dashboards" | "Analytics" | "Export" | "Embed" | "SSO" | "SCIM"
  | "Security" | "Compliance" | "Performance" | "Scaling" | "CaseStudy" | "ROI";

type Post = {
  slug: string;
  titleKey: string;
  excerptKey: string;
  date: string;
  readMins: number;
  category: Category;
  tags: TagKey[];
  featured?: boolean;
};

const POSTS: Post[] = [
  { slug: "story-maps-hello", titleKey: "p_story_maps_hello_title", excerptKey: "p_story_maps_hello_excerpt", date: "2025-09-01", readMins: 4, category: "Product", tags: ["StoryMaps","Templates"], featured: true },
  { slug: "style-geojson-better", titleKey: "p_style_geojson_better_title", excerptKey: "p_style_geojson_better_excerpt", date: "2025-08-21", readMins: 6, category: "Tutorial", tags: ["Layers","Styling"] },
  { slug: "district-03-templates", titleKey: "p_district_03_templates_title", excerptKey: "p_district_03_templates_excerpt", date: "2025-08-10", readMins: 5, category: "Stories", tags: ["Organizations","Templates"] },
  { slug: "dashboards-101", titleKey: "p_dashboards_101_title", excerptKey: "p_dashboards_101_excerpt", date: "2025-07-30", readMins: 7, category: "Education", tags: ["Dashboards","Analytics"] },
  { slug: "export-embed-fast", titleKey: "p_export_embed_fast_title", excerptKey: "p_export_embed_fast_excerpt", date: "2025-07-12", readMins: 3, category: "Product", tags: ["Export","Embed"] },
  { slug: "enterprise-sso-scim", titleKey: "p_enterprise_sso_scim_title", excerptKey: "p_enterprise_sso_scim_excerpt", date: "2025-09-12", readMins: 6, category: "Business", tags: ["SSO","SCIM","Security"] },
  { slug: "data-governance-audit-logs", titleKey: "p_data_governance_title", excerptKey: "p_data_governance_excerpt", date: "2025-08-28", readMins: 6, category: "Business", tags: ["Compliance","Security"] },
  { slug: "scale-performance-tiles", titleKey: "p_scale_performance_title", excerptKey: "p_scale_performance_excerpt", date: "2025-08-05", readMins: 7, category: "Business", tags: ["Performance","Scaling"] },
  { slug: "case-urban-planning-firm", titleKey: "p_case_urban_planning_title", excerptKey: "p_case_urban_planning_excerpt", date: "2025-07-25", readMins: 5, category: "Business", tags: ["CaseStudy","ROI"] },
];

/** Helpers */
const CATEGORY_FILTERS: CategoryFilter[] = ["All","Product","Tutorial","Stories","Education","Business"];
const isCategoryFilter = (v: string): v is CategoryFilter => (CATEGORY_FILTERS as readonly string[]).includes(v);

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));

export default function BlogClient({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { t } = useI18n();
  const tr = (k: string) => t("blog", k);

  // label maps
  const CAT_LABEL = (c: Category): string => tr({
    Product: "cat_product",
    Tutorial: "cat_tutorial",
    Stories: "cat_stories",
    Education: "cat_education",
    Business: "cat_business",
  }[c]);

  const CAT_FILTER_LABEL = (c: CategoryFilter): string =>
    c === "All" ? tr("filter_all") : CAT_LABEL(c);

  const TAG_LABEL = (k: TagKey): string => tr({
    StoryMaps: "tag_story_maps",
    Templates: "tag_templates",
    Layers: "tag_layers",
    Styling: "tag_styling",
    Organizations: "tag_organizations",
    Dashboards: "tag_dashboards",
    Analytics: "tag_analytics",
    Export: "tag_export",
    Embed: "tag_embed",
    SSO: "tag_sso",
    SCIM: "tag_scim",
    Security: "tag_security",
    Compliance: "tag_compliance",
    Performance: "tag_performance",
    Scaling: "tag_scaling",
    CaseStudy: "tag_case_study",
    ROI: "tag_roi",
  }[k]);

  const catParamRaw = (searchParams?.cat as string) || "All";
  const activeCat: CategoryFilter = isCategoryFilter(catParamRaw) ? catParamRaw : "All";
  const list = activeCat === "All" ? POSTS : POSTS.filter((p) => p.category === activeCat);
  const featured = list.find((p) => p.featured) ?? list[0];
  const others = list.filter((p) => p.slug !== featured?.slug);

  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".bh-title", ".bh-sub", ".bh-cta"], { autoAlpha: 0, y: 18 });
      gsap.timeline()
        .to(".bh-title", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.9, ease: "power2.out" })
        .to(".bh-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.08")
        .to(".bh-cta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.08");

      ScrollTrigger.batch(".topic-chip", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".featured-card", { autoAlpha: 0, y: 20 });
      ScrollTrigger.create({
        trigger: ".featured-card",
        start: "top 85%",
        onEnter: () => gsap.to(".featured-card", { autoAlpha: 1, y: 0, ...baseIn }),
      });

      ScrollTrigger.batch(".post-card", {
        start: "top 85%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 16 }),
      });

      ScrollTrigger.batch(".section-title", {
        start: "top 88%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set([".subscribe-card", ".cta-banner"], { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".subscribe-card",
        start: "top 85%",
        onEnter: () => gsap.to(".subscribe-card", { autoAlpha: 1, y: 0, ...baseIn }),
      });
      ScrollTrigger.create({
        trigger: ".cta-banner",
        start: "top 90%",
        onEnter: () => gsap.to(".cta-banner", { autoAlpha: 1, y: 0, ...baseIn }),
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      {/* HERO */}
      <section className="blog-hero relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="bh-sub text-sm tracking-wide text-emerald-300/90">{tr("breadcrumb")}</p>
          <h1 className="bh-title mt-2 text-3xl font-semibold sm:text-4xl">{tr("hero_title")}</h1>
          <p className="bh-sub mt-3 max-w-2xl text-zinc-300">{tr("hero_sub")}</p>
          <div className="mt-6">
            <Link href="#latest" className="bh-cta inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              {tr("hero_cta")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      {/* TOPICS */}
      <section className="mt-8 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10">
        <div className="section-title text-sm font-medium">{tr("topics")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((c) => {
            const href = c === "All" ? "/resources/blog" : `/resources/blog?cat=${c}`;
            const active = c === activeCat;
            return (
              <Link
                key={c}
                href={href}
                className={`topic-chip opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-emerald-500 text-zinc-950" : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {CAT_FILTER_LABEL(c)}
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED + SUBSCRIBE */}
      {featured && (
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="featured-card col-span-2 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <div className="aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent ring-1 ring-white/5" />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <TagPill>{CAT_LABEL(featured.category)}</TagPill>
              {featured.tags.map((t) => (
                <TagPill key={t}>{TAG_LABEL(t)}</TagPill>
              ))}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-snug">{tr(featured.titleKey)}</h2>
            <p className="mt-2 text-zinc-300">{tr(featured.excerptKey)}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-emerald-300" />
                {fmtDate(featured.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-4 w-4 text-emerald-300" />
                {featured.readMins} {tr("minutes_read")}
              </span>
            </div>
            <div className="mt-4">
              <Link href={`/resources/blog/${featured.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                {tr("read_post")}
              </Link>
            </div>
          </article>

          <aside className="subscribe-card rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <h3 className="text-lg font-semibold">{tr("subscribe_title")}</h3>
            <p className="mt-1 text-sm text-zinc-300">{tr("subscribe_desc")}</p>
            <form className="mt-4 space-y-3" action="/resources/blog/subscribe" method="post">
              <input
                name="email"
                type="email"
                required
                placeholder={tr("subscribe_placeholder")}
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <button className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                {tr("subscribe_button")}
              </button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">{tr("subscribe_note")}</p>
          </aside>
        </section>
      )}

      {/* LATEST */}
      <section id="latest" className="mt-10">
        <h2 className="section-title text-xl font-semibold opacity-0 translate-y-[12px]">{tr("latest_posts")}</h2>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((p) => (
            <article key={p.slug} className="post-card opacity-0 translate-y-[16px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="aspect-[16/9] w-full rounded-xl bg-zinc-800/70 ring-1 ring-white/5" />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <TagPill>{CAT_LABEL(p.category)}</TagPill>
                {p.tags.map((t) => (
                  <TagPill key={t}>{TAG_LABEL(t)}</TagPill>
                ))}
              </div>
              <h3 className="mt-2 text-base font-semibold leading-snug">{tr(p.titleKey)}</h3>
              <p className="mt-1 text-sm text-zinc-300">{tr(p.excerptKey)}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-emerald-300" />
                  {fmtDate(p.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-4 w-4 text-emerald-300" />
                  {p.readMins} {tr("minutes_read")}
                </span>
              </div>
              <div className="mt-3">
                <Link href={`/resources/blog/${p.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline">
                  {tr("read_more")} <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-banner mt-12 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">{tr("cta_title")}</h3>
            <p className="mt-1 text-zinc-300">{tr("cta_desc")}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/resources/blog/request" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              {tr("cta_request")}
            </Link>
            <Link href="/resources" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              {tr("cta_more_resources")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
