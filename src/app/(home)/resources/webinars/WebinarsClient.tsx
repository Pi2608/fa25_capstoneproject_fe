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
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 5v14l11-7L8 5Z" />
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
function Tag(props: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
      {props.children}
    </span>
  );
}

type Upcoming = {
  title: string;
  date: string;
  time: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  tags: string[];
  href: string;
};

type OnDemand = {
  title: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  tags: string[];
  href: string;
};

const UPCOMING: Upcoming[] = [
  {
    title: "Story Maps for Classrooms: Build a narrative in 30 minutes",
    date: "Oct 12, 2025",
    time: "19:00–20:00 (GMT+7)",
    duration: "60 min",
    level: "Beginner",
    tags: ["Story Maps", "Education"],
    href: "/webinar/story-maps-classroom",
  },
  {
    title: "Layer Styling Best Practices: From GeoJSON to polished maps",
    date: "Oct 26, 2025",
    time: "19:00–20:00 (GMT+7)",
    duration: "60 min",
    level: "Intermediate",
    tags: ["Layers", "Styling"],
    href: "/webinar/layer-styling",
  },
  {
    title: "Dashboards 101: KPIs, charts, and spatial filters",
    date: "Nov 9, 2025",
    time: "19:00–20:00 (GMT+7)",
    duration: "60 min",
    level: "Beginner",
    tags: ["Dashboards"],
    href: "/webinar/dashboards-101",
  },
];

const ON_DEMAND: OnDemand[] = [
  {
    title: "Import & Clean Field Data (GeoJSON / KML)",
    duration: "38 min",
    level: "Beginner",
    tags: ["Data", "Import"],
    href: "/webinar/on-demand/import-clean-data",
  },
  {
    title: "Collaborate with Organizations & Roles",
    duration: "41 min",
    level: "Intermediate",
    tags: ["Organizations", "Collaboration"],
    href: "/webinar/on-demand/org-collaboration",
  },
  {
    title: "Export & Embed: Share maps anywhere",
    duration: "32 min",
    level: "Beginner",
    tags: ["Export", "Embed"],
    href: "/webinar/on-demand/export-embed",
  },
  {
    title: "Advanced Styling Recipes for Thematic Maps",
    duration: "47 min",
    level: "Advanced",
    tags: ["Styling", "Thematic"],
    href: "/webinar/on-demand/advanced-styling",
  },
];

export default function WebinarsClient() {
  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".wb-hero-eyebrow", ".wb-hero-title", ".wb-hero-sub", ".wb-hero-cta"], { autoAlpha: 0, y: 18 });
      gsap
        .timeline()
        .to(".wb-hero-eyebrow", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.5, ease: "power2.out" })
        .to(".wb-hero-title", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.65, ease: "power2.out" }, "<0.06")
        .to(".wb-hero-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".wb-hero-cta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06");

      gsap.set(".wb-subscribe", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".wb-subscribe",
        start: "top 92%",
        onEnter: () => gsap.to(".wb-subscribe", { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: () => gsap.set(".wb-subscribe", { autoAlpha: 0, y: 16 }),
      });

      ScrollTrigger.batch(".wb-upcoming-card", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 14 }),
      });

      ScrollTrigger.batch(".wb-ondemand-card", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
      });

      ScrollTrigger.batch(".wb-speaker", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      ScrollTrigger.batch(".wb-faq", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".wb-final-cta", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".wb-final-cta",
        start: "top 92%",
        onEnter: () => gsap.to(".wb-final-cta", { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: () => gsap.set(".wb-final-cta", { autoAlpha: 0, y: 16 }),
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="wb-hero-eyebrow opacity-0 translate-y-[18px] text-sm tracking-wide text-emerald-300/90">
            Resources / Webinars
          </p>
          <h1 className="wb-hero-title opacity-0 translate-y-[18px] mt-2 text-3xl font-semibold sm:text-4xl">
            Live & On-Demand Webinars
          </h1>
          <p className="wb-hero-sub opacity-0 translate-y-[18px] mt-3 max-w-2xl text-zinc-300">
            Learn mapping workflows—from story maps and layer styling to dashboards and collaboration.
            Join live for Q&amp;A or watch the recordings anytime.
          </p>
          <div className="wb-hero-cta opacity-0 translate-y-[18px] mt-6 flex flex-wrap gap-3">
            <Link
              href="#upcoming"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              See upcoming <CalendarIcon className="h-4 w-4" />
            </Link>
            <Link
              href="#on-demand"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              Watch on-demand <PlayIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="wb-subscribe mt-8 opacity-0 translate-y-[16px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 via-emerald-400/10 to-transparent p-5 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold">Get reminders & calendar invites</h3>
            <p className="mt-1 text-sm text-zinc-300">No spam—just upcoming sessions and recordings.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/resources/webinars/subscribe" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
              Subscribe
            </Link>
            <Link href="/resources/webinars/ics" className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70">
              Add to calendar (.ics)
            </Link>
          </div>
        </div>
      </section>

      <section id="upcoming" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">Upcoming webinars</h2>
          <Link href="/resources/webinars/archive" className="text-sm text-emerald-300/90 underline-offset-4 hover:underline">
            View past webinars
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          {UPCOMING.map((w) => (
            <article key={w.title} className="wb-upcoming-card opacity-0 translate-y-[14px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <CalendarIcon className="h-4 w-4 text-emerald-300" />
                <span>{w.date}</span>
                <span className="mx-2 text-zinc-600">•</span>
                <ClockIcon className="h-4 w-4 text-emerald-300" />
                <span>{w.time}</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold">{w.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Tag>{w.level}</Tag>
                <Tag>{w.duration}</Tag>
                {w.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <div className="mt-4">
                <Link href={w.href} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                  Register now
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="on-demand" className="mt-12">
        <h2 className="text-xl font-semibold">On-demand library</h2>
        <p className="mt-1 text-sm text-zinc-400">Watch recordings anytime.</p>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ON_DEMAND.map((v) => (
            <article key={v.title} className="wb-ondemand-card opacity-0 translate-y-[12px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="aspect-[16/9] w-full rounded-xl bg-zinc-800/80 ring-1 ring-white/5" />
              <h3 className="mt-3 text-base font-semibold leading-snug">{v.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Tag>{v.level}</Tag>
                <Tag>{v.duration}</Tag>
                {v.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <Link href={v.href} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 underline-offset-4 hover:underline">
                Watch now <PlayIcon className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
        <h2 className="text-xl font-semibold">Speakers</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Lan Pham", role: "Education Lead", bio: "Story Maps and curriculum design." },
            { name: "Minh Tran", role: "GIS Engineer", bio: "Data layers, styling, and performance." },
            { name: "Quang Nguyen", role: "Product Specialist", bio: "Dashboards and collaboration." },
          ].map((s) => (
            <div key={s.name} className="wb-speaker opacity-0 translate-y-[10px] flex items-start gap-4 rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-5">
              <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400/30 to-emerald-200/20 ring-1 ring-emerald-400/20" />
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-zinc-400">{s.role}</div>
                <p className="mt-1 text-sm text-zinc-300">{s.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ["How do I register?", "Open any upcoming webinar and click “Register now”. You’ll receive a confirmation email and a calendar invite."],
            ["Will recordings be available?", "Yes. All sessions are recorded and added to the on-demand library within 24–48 hours."],
            ["Is it free?", "Most webinars are free. Some advanced trainings may require a paid plan or seat."],
            ["Timezones?", "Times are shown in your local timezone when you open the registration page."],
          ].map(([q, a]) => (
            <div key={q} className="wb-faq opacity-0 translate-y-[10px] rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="font-medium">{q}</div>
              <p className="mt-1 text-sm text-zinc-300">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wb-final-cta mt-12 opacity-0 translate-y-[16px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">Want a specific topic?</h3>
            <p className="mt-1 text-zinc-300">Propose a webinar and we’ll schedule it.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/resources/webinars/request" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              Request a webinar
            </Link>
            <Link href="/resources" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              Browse all resources
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
