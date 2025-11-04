"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

type Feature = { title: string; desc: string };
type Step = { k: string; t: string; d: string };
type Kpi = { label: string; value: string; sub: string };
type Preset = { title: string; desc: string; href: string };

function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M12 3A10 10 0 0 0 2 13h2a8 8 0 1 1 16 0h2A10 10 0 0 0 12 3Zm-1 7v6h2v-6h-2Z" /></svg>;
}
function GridIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" /></svg>;
}
function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z" /></svg>;
}
function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 8-8L19 7l-9.4 9.6Z" /></svg>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">{children}</span>;
}

export default function DashboardsClient({
  features,
  steps,
  kpis,
  presets,
  integrations,
  interactions,
  faqs,
}: {
  features: Feature[];
  steps: Step[];
  kpis: Kpi[];
  presets: Preset[];
  integrations: string[];
  interactions: Feature[];
  faqs: [string, string][];
}) {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const base = { duration: reduce ? 0 : 0.6, ease: "power2.out", clearProps: "transform,opacity" } as const;
  const ctx = gsap.context(() => {
      gsap.set("[data-reveal]", { autoAlpha: 0, y: 18 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...base }),
        onLeaveBack: (els) => gsap.to(els, { autoAlpha: 0, y: 18, duration: reduce ? 0 : 0.3 }),
      });
      document.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((parent) => {
        const items = parent.querySelectorAll<HTMLElement>("[data-reveal-item]");
        gsap.set(items, { autoAlpha: 0, y: 14 });
        ScrollTrigger.create({
          trigger: parent,
          start: "top 92%",
          onEnter: () => gsap.to(items, { autoAlpha: 1, y: 0, stagger: 0.06, ...base }),
          onLeaveBack: () => gsap.to(items, { autoAlpha: 0, y: 14, stagger: 0.04, duration: reduce ? 0 : 0.3 }),
        });
      });
    });
  return () => { ctx.revert(); };
  }, []);

  return (
    <main className="relative mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_420px_at_12%_-4%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_380px_at_88%_-6%,rgba(16,185,129,0.08),transparent)]" />
      <section className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-8 ring-1 ring-emerald-500/10" data-reveal>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <GaugeIcon className="h-3.5 w-3.5" />
            Dashboards
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">Maps, charts, and KPIs that move together</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Compose fast, real-time dashboards with cross-filtering and drill-through. Connect data once, then publish securely.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              Start now
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/resources/webinars" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              Watch webinar
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 hover:bg-white/10 transition" data-reveal-item>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <GridIcon className="h-4 w-4 text-emerald-400" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3" data-reveal>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6 lg:col-span-2" data-reveal>
          <div className="flex flex-wrap items-center gap-2" data-reveal-stagger>
            <Pill>District = All</Pill>
            <Pill>Date: Last 7 days</Pill>
            <Pill>Type: Incidents</Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4" data-reveal-stagger>
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4" data-reveal-item>
                <div className="text-xs text-zinc-400">{k.label}</div>
                <div className="mt-1 text-2xl font-extrabold text-white">{k.value}</div>
                <div className="text-xs text-zinc-500">{k.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" data-reveal-stagger>
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-3" data-reveal-item>
              <div className="mb-2 text-sm text-zinc-400">Incidents by district</div>
              <div className="aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
            </div>
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-3" data-reveal-item>
              <div className="mb-2 text-sm text-zinc-400">Trend last 7 days</div>
              <div className="aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6" data-reveal>
          <div className="text-sm text-zinc-400">Live map</div>
          <div className="mt-2 aspect-[9/12] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="h-full w-full bg-[radial-gradient(120%_80%_at_50%_0%,rgba(16,185,129,0.15),transparent)]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-xs font-medium text-emerald-300 hover:border-emerald-400/70">Filter selection</button>
            <button className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-emerald-400">Drill-through</button>
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10" data-reveal>
        <p className="text-sm tracking-wide text-emerald-300/90">Workflow</p>
        <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Build in four steps</h2>
        <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal-stagger>
          {steps.map((s, i) => (
            <li key={s.k} className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5" data-reveal-item>
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">{i + 1}</span>
                {s.k}
              </div>
              <h3 className="mt-2 text-base font-semibold text-white">{s.t}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" data-reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm tracking-wide text-emerald-300/90">Kickstart</p>
            <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Popular dashboard presets</h2>
          </div>
          <Link href="/templates" className="hidden rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70 sm:inline-flex">
            View all templates
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {presets.map((t) => (
            <article key={t.title} className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5" data-reveal-item>
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/5">
                <div className="h-full w-full bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
              </div>
              <h3 className="mt-3 text-base font-semibold leading-snug text-white">{t.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{t.desc}</p>
              <div className="mt-4">
                <Link href={t.href} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                  Use preset
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2" data-reveal-stagger>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">Why it’s fast</h3>
          <ul className="mt-3 space-y-3 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />Server-side aggregation, spatial indexes, and overviews with tile-based delivery.</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />Client cache and optimistic interactions for sub-200 ms feedback.</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />WebGL rendering for large vector layers and smooth panning.</li>
          </ul>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              ["Median filter", "≤ 180 ms"],
              ["Cache hits", "85–97%"],
              ["Uptime", "99.95%"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-400">{k}</div>
                <div className="mt-1 text-xl font-extrabold text-white">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">Integrations</h3>
          <p className="mt-1 text-sm text-zinc-400">Bring your data, keep your stack.</p>
          <div className="mt-3 flex flex-wrap gap-2" data-reveal-stagger>
            {integrations.map((i) => (
              <Pill key={i}>{i}</Pill>
            ))}
          </div>
          <div className="mt-5">
            <div className="rounded-2xl ring-1 ring-white/10 bg-black/60 p-4 text-[12px] leading-5 text-zinc-200">{`POST /api/dashboards
{
  "title": "Ops Command",
  "widgets": ["map","kpi","bar","line","table"],
  "permissions": {"view": ["team:ops"], "edit": ["role:Admin"]}
}`}</div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2" data-reveal-stagger>
        {interactions.map((f) => (
          <div key={f.title} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
            <h3 className="text-base font-semibold text-white">{f.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{f.desc}</p>
            <div className="mt-3 aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2" data-reveal-stagger>
        <div className="rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">FAQ</h3>
          <div className="mt-3 space-y-4 text-sm">
            {faqs.map(([q, a]) => (
              <div key={q}>
                <div className="font-medium text-zinc-100">{q}</div>
                <p className="mt-1 text-zinc-400">{a}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-b from-emerald-500/10 to-transparent p-6 ring-1 ring-emerald-500/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">Ready to build a dashboard?</h3>
          <p className="mt-1 text-sm text-zinc-300">Start from a preset or an empty canvas. Invite teammates anytime.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Start free</Link>
            <Link href="/pricing" className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:border-emerald-400/70">See pricing</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
