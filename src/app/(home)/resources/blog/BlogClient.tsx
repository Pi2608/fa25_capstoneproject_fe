"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readMins: number;
  category: "Product" | "Tutorial" | "Stories" | "Education" | "Business";
  tags: string[];
  featured?: boolean;
};

const POSTS: Post[] = [
  { slug: "story-maps-hello", title: "Hello, Story Maps: turn lessons into easy narratives", excerpt: "A few segments, a couple of photos, and your places come together as a story learners can follow.", date: "2025-09-01", readMins: 4, category: "Product", tags: ["Story Maps", "Templates"], featured: true },
  { slug: "style-geojson-better", title: "Make your GeoJSON shine with simple styling", excerpt: "Color, stroke, order. Tiny tweaks, big readability gains.", date: "2025-08-21", readMins: 6, category: "Tutorial", tags: ["Layers", "Styling"] },
  { slug: "district-03-templates", title: "Story: District 03 cut prep time with shared templates", excerpt: "A lightweight library helped new teachers get going on day one.", date: "2025-08-10", readMins: 5, category: "Stories", tags: ["Organizations", "Templates"] },
  { slug: "dashboards-101", title: "Dashboards 101: just the signals you need", excerpt: "A few KPIs and spatial filters are enough to get everyone on the same page.", date: "2025-07-30", readMins: 7, category: "Education", tags: ["Dashboards", "Analytics"] },
  { slug: "export-embed-fast", title: "Export & Embed: share maps anywhere in seconds", excerpt: "Handout-ready PDF/PNG and simple embeds for your site or LMS.", date: "2025-07-12", readMins: 3, category: "Product", tags: ["Export", "Embed"] },
  { slug: "enterprise-sso-scim", title: "Enterprise basics: SSO (SAML/OAuth) and SCIM provisioning", excerpt: "Sign in once, manage users centrally, and keep access in sync as teams change.", date: "2025-09-12", readMins: 6, category: "Business", tags: ["SSO", "SCIM", "Security"] },
  { slug: "data-governance-audit-logs", title: "Data governance for teams: audit logs, access reviews, retention", excerpt: "See who did what, review sharing regularly, and keep data around just as long as you need.", date: "2025-08-28", readMins: 6, category: "Business", tags: ["Compliance", "Security"] },
  { slug: "scale-performance-tiles", title: "Performance at scale: serving millions of features smoothly", excerpt: "Vector tiling, smart simplification, and caching that keeps large maps snappy.", date: "2025-08-05", readMins: 7, category: "Business", tags: ["Performance", "Scaling"] },
  { slug: "case-urban-planning-firm", title: "Case study: an urban planning firm sped up proposals by 40%", excerpt: "Reusable layers, branded exports, and quick dashboards made reviews faster for clients.", date: "2025-07-25", readMins: 5, category: "Business", tags: ["Case Study", "ROI"] },
];

const CATEGORY_LABELS: Record<Post["category"], string> = {
  Product: "Product",
  Tutorial: "Tutorial",
  Stories: "Stories",
  Education: "Education",
  Business: "Business",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

type SearchParams = { [k: string]: string | string[] | undefined };
const CATEGORY_FILTERS = ["All", "Product", "Tutorial", "Stories", "Education", "Business"] as const;
type CategoryFilter = typeof CATEGORY_FILTERS[number];
function isCategoryFilter(v: string): v is CategoryFilter {
  return (CATEGORY_FILTERS as readonly string[]).includes(v);
}

export default function BlogClient({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
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
      <section className="blog-hero relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="bh-sub text-sm tracking-wide text-emerald-300/90">Resources / Blog</p>
          <h1 className="bh-title mt-2 text-3xl font-semibold sm:text-4xl">Friendly updates and real-world mapping stories</h1>
          <p className="bh-sub mt-3 max-w-2xl text-zinc-300">Short reads with practical tips, product news, and examples from classrooms and companies alike.</p>
          <div className="mt-6">
            <Link href="#latest" className="bh-cta inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              Start reading <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4 ring-1 ring-emerald-500/10">
        <div className="section-title text-sm font-medium">Topics</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(CATEGORY_FILTERS).map((c) => {
            const href = c === "All" ? "/resources/blog" : `/resources/blog?cat=${c}`;
            const active = c === activeCat;
            return (
              <Link
                key={c}
                href={href}
                className={`topic-chip opacity-0 translate-y-[10px] rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-emerald-500 text-zinc-950" : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70"}`}
                aria-current={active ? "page" : undefined}
              >
                {c}
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
              <TagPill>{CATEGORY_LABELS[featured.category]}</TagPill>
              {featured.tags.map((t) => (
                <TagPill key={t}>{t}</TagPill>
              ))}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-snug">{featured.title}</h2>
            <p className="mt-2 text-zinc-300">{featured.excerpt}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-emerald-300" />
                {fmtDate(featured.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-4 w-4 text-emerald-300" />
                {featured.readMins} min read
              </span>
            </div>
            <div className="mt-4">
              <Link href={`/resources/blog/${featured.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                Read article
              </Link>
            </div>
          </article>

          <aside className="subscribe-card rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <h3 className="text-lg font-semibold">Subscribe for updates</h3>
            <p className="mt-1 text-sm text-zinc-300">A short monthly note: useful tips, product highlights, and stories from teams.</p>
            <form className="mt-4 space-y-3" action="/resources/blog/subscribe" method="post">
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <button className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Subscribe</button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">No spam. Unsubscribe anytime.</p>
          </aside>
        </section>
      )}

      <section id="latest" className="mt-10">
        <h2 className="section-title text-xl font-semibold opacity-0 translate-y-[12px]">Latest posts</h2>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((p) => (
            <article key={p.slug} className="post-card opacity-0 translate-y-[16px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="aspect-[16/9] w-full rounded-xl bg-zinc-800/70 ring-1 ring-white/5" />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <TagPill>{CATEGORY_LABELS[p.category]}</TagPill>
                {p.tags.map((t) => (
                  <TagPill key={t}>{t}</TagPill>
                ))}
              </div>
              <h3 className="mt-2 text-base font-semibold leading-snug">{p.title}</h3>
              <p className="mt-1 text-sm text-zinc-300">{p.excerpt}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-emerald-300" />
                  {fmtDate(p.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-4 w-4 text-emerald-300" />
                  {p.readMins} min read
                </span>
              </div>
              <div className="mt-3">
                <Link href={`/resources/blog/${p.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline">
                  Read more <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-banner mt-12 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">Want us to cover a topic?</h3>
            <p className="mt-1 text-zinc-300">Tell us what would help your class or company.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/resources/blog/request" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              Request an article
            </Link>
            <Link href="/resources" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              See more resources
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
