"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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

export default function CustomersClient() {
  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".c-hero-eyebrow", ".c-hero-title", ".c-hero-sub", ".c-hero-cta"], { autoAlpha: 0, y: 18 });
      gsap.timeline()
        .to(".c-hero-eyebrow", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.6, ease: "power2.out" })
        .to(".c-hero-title", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.8, ease: "power2.out" }, "<0.06")
        .to(".c-hero-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".c-hero-cta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06");

      ScrollTrigger.batch(".c-logo", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      ScrollTrigger.batch(".c-stat", {
        start: "top 88%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
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
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
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
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.07, ...baseIn }),
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
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="c-hero-eyebrow opacity-0 translate-y-[18px] text-sm tracking-wide text-emerald-300/90">Resources / Customers</p>
          <h1 className="c-hero-title opacity-0 translate-y-[18px] mt-2 text-3xl font-semibold sm:text-4xl">
            Stories from teams using <span className="text-emerald-300">IMOS</span>
          </h1>
          <p className="c-hero-sub opacity-0 translate-y-[18px] mt-3 max-w-2xl text-zinc-300">
            Built for educators and organizations. See how schools create interactive lesson maps, story
            maps, and classroom projects aligned to curriculum.
          </p>
          <div className="c-hero-cta opacity-0 translate-y-[18px] mt-6 flex flex-wrap gap-3">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Explore templates <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Talk to us
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-10">
        <p className="text-xs uppercase tracking-widest text-zinc-400">Trusted by education teams</p>
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6">
          {["EduGIS Lab", "Hanoi District 03", "FPT High School", "GeoLearn", "Thủ Đức Campus", "Open Study Maps"].map(
            (name) => (
              <div
                key={name}
                className="c-logo opacity-0 translate-y-[10px] flex h-14 items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-3 text-sm text-zinc-300"
              >
                {name}
              </div>
            ),
          )}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[{ value: "45%", label: "faster lesson prep" }, { value: "10k+", label: "students engaged" }, { value: "30+", label: "maps per class" }, { value: "99.9%", label: "platform uptime" }].map(
          (s) => (
            <div key={s.label} className="c-stat opacity-0 translate-y-[12px] rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-5 ring-1 ring-emerald-500/10">
              <div className="text-2xl font-semibold text-emerald-300">{s.value}</div>
              <div className="mt-1 text-sm text-zinc-400">{s.label}</div>
            </div>
          ),
        )}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="c-case col-span-2 opacity-0 translate-y-[20px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Case study
            </span>
            <span className="text-xs text-zinc-400">History & Geography</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-snug">Greenfield High School: From static maps to interactive <em>Story Maps</em></h2>
          <p className="mt-2 max-w-2xl text-zinc-300">
            Teachers transformed lessons by linking Locations and Zones to historical events, embedding media, and sequencing Segments into a narrative students could explore.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              "Curriculum-aligned templates for quick starts",
              "Zones & Tags to highlight regions and themes",
              "Story Map Segments with images and videos",
              "Export to PDF/PNG for handouts",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <Link href="/resources/customers/greenfield-high" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              Read the story <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/resources" className="text-sm text-emerald-300/90 underline-offset-4 hover:underline">
              Browse all resources
            </Link>
          </div>
        </article>

        <aside className="c-quote opacity-0 translate-y-[20px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 shadow-lg">
          <figure>
            <blockquote className="text-lg leading-relaxed text-zinc-200">
              IMOS made our geography units come alive. Students explored places, timelines, and cause–effect through interactive maps instead of static slides.”
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400/30 to-emerald-200/20" />
              <div>
                <div className="text-sm font-medium text-zinc-100">Ms. Nguyen Thanh</div>
                <div className="text-xs text-zinc-400">Head of Social Studies, Greenfield High</div>
              </div>
            </figcaption>
          </figure>
        </aside>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {[
          {
            title: "District 03 School Network: Shared templates for teachers",
            summary:
              "Organization owners curated shared Story Map templates aligned to local standards, so new teachers could start in minutes.",
            href: "/resources/customers/district-03",
            points: ["Org roles: Owner → Admin → Member", "Invite educators, manage permissions", "Usage quotas visible per plan"],
          },
          {
            title: "GeoLearn Campus: From fieldwork to classroom projects",
            summary:
              "Students imported GeoJSON from field surveys, styled layers, and embedded maps into reports with shareable widgets.",
            href: "/resources/customers/geolearn-campus",
            points: ["Upload GeoJSON / KML for lessons", "Layer styling & order control", "Embed maps in LMS pages"],
          },
        ].map((c) => (
          <article key={c.title} className="c-card opacity-0 translate-y-[14px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
            <h3 className="text-xl font-semibold leading-snug">{c.title}</h3>
            <p className="mt-2 text-zinc-300">{c.summary}</p>
            <ul className="mt-4 space-y-2">
              {c.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <Link href={c.href} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline">
              Read more <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </section>

      <section className="c-why mt-12 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
        <h2 className="c-why-title opacity-0 translate-y-[12px] text-xl font-semibold">Why education teams choose us</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { h: "Story Maps", p: "Sequence events into Segments with notes and media so lessons read like a narrative." },
            { h: "Classroom templates", p: "Curriculum-aligned starts for geography & history units." },
            { h: "Easy exports", p: "PDF/PNG for handouts; GeoJSON/KML when you need the data." },
            { h: "Collaborate", p: "Invite teachers, set roles, and share across organizations." },
          ].map((f) => (
            <div key={f.h} className="c-why-item opacity-0 translate-y-[10px] rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">{f.h}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{f.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="c-cta mt-12 opacity-0 translate-y-[16px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">Ready to create your first lesson map?</h3>
            <p className="mt-1 text-zinc-300">Start from a template or build from scratch in minutes.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/new-map" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              New map <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              View plans
            </Link>
          </div>
        </div>
      </section>

      <section className="c-footer-note mt-10 opacity-0 translate-y-[10px] text-center text-sm text-zinc-400">
        Have questions? Visit our{" "}
        <Link href="/resources/faq" className="text-emerald-300 underline-offset-4 hover:underline">
          Knowledge Base
        </Link>{" "}
        or{" "}
        <Link href="/support" className="text-emerald-300 underline-offset-4 hover:underline">
          open a support ticket
        </Link>
        .
      </section>
    </main>
  );
}
