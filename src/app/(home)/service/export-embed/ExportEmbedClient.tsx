"use client";

import Link from "next/link";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

type Feature = { title: string; desc: string };
type Preset = { title: string; desc: string; ratio: string };

export default function ExportEmbedClient({
  features,
  formats,
  presets,
  embedSnippets,
  controls,
  faqs,
}: {
  features: Feature[];
  formats: [string, string][];
  presets: Preset[];
  embedSnippets: { iframe: string; react: string; rest: string; signed: string };
  controls: [string, string][];
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
    return () => ctx.revert();
  }, []);

  return (
    <main className="relative mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_420px_at_12%_-4%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_380px_at_88%_-6%,rgba(16,185,129,0.08),transparent)]" />
      <section className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-8 ring-1 ring-emerald-500/10" data-reveal>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Export & Embed
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">Publish beautiful maps anywhere</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">Export pixel-perfect PNG/PDF or embed live maps with permissions, tokens, and brand controls.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">Start now</Link>
            <Link href="/resources/developer-docs" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">Read docs</Link>
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
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" aria-hidden><path fill="currentColor" d="M4 4h16v2H4V4Zm0 7h16v2H4v-2Zm0 7h16v2H4v-2Z" /></svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6" data-reveal-stagger>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6" data-reveal-item>
          <div className="text-sm tracking-wide text-emerald-300/90">Formats</div>
          <ul className="mt-4 space-y-3">
            {formats.map(([k, d]) => (
              <li key={k} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-white">{k}</div>
                <div className="mt-1 text-sm text-zinc-400">{d}</div>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl ring-1 ring-white/10 bg-black/60 p-4 text-[12px] leading-5 text-zinc-200">{embedSnippets.rest}</div>
        </div>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6" data-reveal-item>
          <div className="text-sm tracking-wide text-emerald-300/90">Print presets</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4" data-reveal-stagger>
            {presets.map((p) => (
              <div key={p.title} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4" data-reveal-item>
                <div className="text-base font-semibold text-white">{p.title}</div>
                <div className="text-xs text-zinc-500">{p.ratio}</div>
                <p className="mt-1 text-sm text-zinc-400">{p.desc}</p>
                <div className="mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="h-full w-2/3 rounded-full bg-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6" data-reveal-stagger>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">Embed via iframe</h3>
          <p className="mt-1 text-sm text-zinc-400">Drop-in embed with theme, controls, and legend switches.</p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200 whitespace-pre overflow-x-auto">{embedSnippets.iframe}</pre>
          <div className="mt-3 text-xs text-zinc-500">Use domain allowlist and tokens for private maps.</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">Embed in React</h3>
          <p className="mt-1 text-sm text-zinc-400">Control props for filters, legend, and search. Works with SSR.</p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200 whitespace-pre overflow-x-auto">{embedSnippets.react}</pre>
          <div className="mt-3 text-xs text-zinc-500">Pass short-lived tokens or integrate SSO for seamless auth.</div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6" data-reveal>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10 lg:col-span-2" data-reveal>
          <h3 className="text-lg font-semibold text-white">Viewer controls</h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4" data-reveal-stagger>
            {controls.map(([k, d]) => (
              <div key={k} className="rounded-2xl ring-1 ring-white/10 bg-zinc-900/60 p-4" data-reveal-item>
                <div className="text-base font-semibold text-white">{k}</div>
                <div className="mt-1 text-sm text-zinc-400">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal>
          <h3 className="text-lg font-semibold text-white">Security</h3>
          <ul className="mt-3 space-y-3 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />Domain allowlist for embeds</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />Signed URLs with expiration</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />Role and row-level permissions</li>
          </ul>
          <pre className="mt-4 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">{embedSnippets.signed}</pre>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6" data-reveal-stagger>
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
          <h3 className="text-lg font-semibold text-white">Ready to export or embed?</h3>
          <p className="mt-1 text-sm text-zinc-300">Use presets for quick prints or embed live maps with one line of code.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Start free</Link>
            <Link href="/pricing" className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:border-emerald-400/70">See pricing</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
