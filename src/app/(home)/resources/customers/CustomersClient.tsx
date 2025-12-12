"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";

gsap.registerPlugin(ScrollTrigger);

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M9.55 17.6 4.9 12.95l1.7-1.7 2.95 2.95 7.9-7.9 1.7 1.7-9.6 9.6Z" />
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

type Stat = { value: string; labelKey: string };
type MiniCase = { titleKey: string; summaryKey: string; href: string; pointsKeys: string[] };

export default function CustomersClient() {
  const { t } = useI18n();
  const tr = (k: string) => t("customers", k);
  const reduce = useReducedMotion();

  const LOGOS: string[] = [
    "EduGIS Lab",
    "Hanoi District 03",
    "FPT High School",
    "GeoLearn",
    "Thủ Đức Campus",
    "Open Study Maps",
  ];

  const STATS: Stat[] = [
    { value: "45%", labelKey: "stat_faster_prep" },
    { value: "10k+", labelKey: "stat_interactive_students" },
    { value: "30+", labelKey: "stat_maps_per_class" },
    { value: "99.9%", labelKey: "stat_uptime" },
  ];

  const MINI_CASES: MiniCase[] = [
    {
      titleKey: "mini_district_title",
      summaryKey: "mini_district_summary",
      href: "/resources/customers/district-03",
      pointsKeys: ["mini_district_p1", "mini_district_p2", "mini_district_p3"],
    },
    {
      titleKey: "mini_geolearn_title",
      summaryKey: "mini_geolearn_summary",
      href: "/resources/customers/geolearn-campus",
      pointsKeys: ["mini_geolearn_p1", "mini_geolearn_p2", "mini_geolearn_p3"],
    },
  ];

  useGsapHomeScroll({
    reduce,
    heroSelectors: {
      eyebrow: ".c-hero-eyebrow",
      title: ".c-hero-title",
      subtitle: ".c-hero-sub",
      cta: ".c-hero-cta",
    },
  });

  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: prefersReduced || reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      ScrollTrigger.batch(".c-logo", {
        start: "top 90%",
        onEnter: (els) =>
          gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      ScrollTrigger.batch(".c-stat", {
        start: "top 88%",
        onEnter: (els) =>
          gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
      });

      gsap.set(".c-case", { autoAlpha: 0, y: 20 });
      gsap.set(".c-quote", { autoAlpha: 0, y: 20 });
      ScrollTrigger.create({
        trigger: ".c-case",
        start: "top 85%",
        onEnter: () => gsap.to(".c-case", { autoAlpha: 1, y: 0, ...baseIn }),
      });
      ScrollTrigger.create({
        trigger: ".c-quote",
        start: "top 85%",
        onEnter: () => gsap.to(".c-quote", { autoAlpha: 1, y: 0, ...baseIn }),
      });

      ScrollTrigger.batch(".c-card", {
        start: "top 86%",
        onEnter: (els) =>
          gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 14 }),
      });

      gsap.set(".c-why-title", { autoAlpha: 0, y: 12 });
      ScrollTrigger.create({
        trigger: ".c-why-title",
        start: "top 88%",
        onEnter: () => gsap.to(".c-why-title", { autoAlpha: 1, y: 0, ...baseIn }),
      });
      ScrollTrigger.batch(".c-why-item", {
        start: "top 88%",
        onEnter: (els) =>
          gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.07, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".c-cta", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".c-cta",
        start: "top 90%",
        onEnter: () => gsap.to(".c-cta", { autoAlpha: 1, y: 0, ...baseIn }),
      });

      gsap.set(".c-footer-note", { autoAlpha: 0, y: 10 });
      ScrollTrigger.create({
        trigger: ".c-footer-note",
        start: "top 92%",
        onEnter: () => gsap.to(".c-footer-note", { autoAlpha: 1, y: 0, ...baseIn }),
      });
    });

    return () => ctx.revert();
  }, [reduce]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="c-hero-eyebrow opacity-0 translate-y-[18px] text-sm tracking-wide text-emerald-300/90">
            {tr("breadcrumb")}
          </p>
          <h1 className="c-hero-title opacity-0 translate-y-[18px] mt-2 text-3xl font-semibold sm:text-4xl">
            {tr("hero_title_prefix")} <span className="text-emerald-300">IMOS</span>
          </h1>
          <p className="c-hero-sub opacity-0 translate-y-[18px] mt-3 max-w-2xl text-zinc-300">
            {tr("hero_sub")}
          </p>
          <div className="c-hero-cta opacity-0 translate-y-[18px] mt-6 flex flex-wrap gap-3">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {tr("hero_cta_templates")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {tr("hero_cta_contact")}
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-10">
        <p className="text-xs uppercase tracking-widest text-zinc-400">{tr("trusted_by")}</p>
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="c-logo opacity-0 translate-y-[10px] flex h-14 items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 text-sm text-zinc-300"
            >
              {name}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.labelKey}
            className="c-stat opacity-0 translate-y-[12px] rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-5 ring-1 ring-emerald-500/10"
          >
            <div className="text-2xl font-semibold text-emerald-300">{s.value}</div>
            <div className="mt-1 text-sm text-zinc-400">{tr(s.labelKey)}</div>
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="c-case col-span-2 opacity-0 translate-y-[20px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {tr("case_badge")}
            </span>
            <span className="text-xs text-zinc-400">{tr("case_subject")}</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-snug">{tr("case_gh_title")}</h2>
          <p className="mt-2 max-w-2xl text-zinc-300">{tr("case_gh_desc")}</p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[tr("case_gh_p1"), tr("case_gh_p2"), tr("case_gh_p3"), tr("case_gh_p4")].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <Link
              href="/resources/customers/greenfield-high"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {tr("read_story")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/resources" className="text-sm text-emerald-300/90 underline-offset-4 hover:underline">
              {tr("view_all_resources")}
            </Link>
          </div>
        </article>

        <aside className="c-quote opacity-0 translate-y-[20px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 shadow-lg">
          <figure>
            <blockquote className="text-lg leading-relaxed text-zinc-200">“{tr("quote_text")}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400/30 to-emerald-200/20" />
              <div>
                <div className="text-sm font-medium text-zinc-100">{tr("quote_author")}</div>
                <div className="text-xs text-zinc-400">{tr("quote_role")}</div>
              </div>
            </figcaption>
          </figure>
        </aside>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {MINI_CASES.map((c) => (
          <article
            key={c.titleKey}
            className="c-card opacity-0 translate-y-[14px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6"
          >
            <h3 className="text-xl font-semibold leading-snug">{tr(c.titleKey)}</h3>
            <p className="mt-2 text-zinc-300">{tr(c.summaryKey)}</p>
            <ul className="mt-4 space-y-2">
              {c.pointsKeys.map((k) => (
                <li key={k} className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                  <span>{tr(k)}</span>
                </li>
              ))}
            </ul>
            <Link
              href={c.href}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline"
            >
              {tr("read_more")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </section>

      <section className="c-why mt-12 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
        <h2 className="c-why-title opacity-0 translate-y-[12px] text-xl font-semibold">
          {tr("why_title")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[tr("why_f1_h"), tr("why_f2_h"), tr("why_f3_h"), tr("why_f4_h")].map((h, i) => (
            <div
              key={h}
              className="c-why-item opacity-0 translate-y-[10px] rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-5"
            >
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">{h}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                {tr(["why_f1_p", "why_f2_p", "why_f3_p", "why_f4_p"][i])}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="c-cta mt-12 opacity-0 translate-y-[16px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">{tr("cta_title")}</h3>
            <p className="mt-1 text-zinc-300">{tr("cta_desc")}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/new-map"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {tr("cta_new_map")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              {tr("cta_pricing")}
            </Link>
          </div>
        </div>
      </section>

      <section className="c-footer-note mt-10 opacity-0 translate-y-[10px] text-center text-sm text-zinc-400">
        {tr("footer_q")}{" "}
        <Link href="/resources/faq" className="text-emerald-300 underline-offset-4 hover:underline">
          {tr("footer_kb")}
        </Link>{" "}
        {tr("footer_or")}{" "}
        <Link href="/support" className="text-emerald-300 underline-offset-4 hover:underline">
          {tr("footer_ticket")}
        </Link>
        .
      </section>
    </main>
  );
}
