"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M11 3h2v10l3.5-3.5 1.4 1.4L12 17.7 6.1 10.9l1.4-1.4L11 13V3Zm-6 16h14v2H5v-2Z" />
    </svg>
  );
}
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M9.55 17.6 4.9 12.95l1.7-1.7 2.95 2.95 7.9-7.9 1.7 1.7-9.6 9.6Z" />
    </svg>
  );
}
function PlugIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M7 2h2v6h6V2h2v6h3v2h-3.1a7 7 0 1 1-7.8 7H6v-2h3.1A7 7 0 0 1 16 10H7V2Z" />
    </svg>
  );
}
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M11 7h2v2h-2V7Zm0 4h2v6h-2v-6Zm1-9a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export default function QgisPluginClient() {
  useLayoutEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".qg-hero-eyebrow", ".qg-hero-title", ".qg-hero-sub", ".qg-hero-cta"], { autoAlpha: 0, y: 18 });
      gsap
        .timeline()
        .to(".qg-hero-eyebrow", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.5, ease: "power2.out" })
        .to(".qg-hero-title", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.65, ease: "power2.out" }, "<0.06")
        .to(".qg-hero-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
        .to(".qg-hero-cta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06");

      ScrollTrigger.batch(".qg-info-card", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 14 }),
      });

      gsap.set(".qg-install", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".qg-install",
        start: "top 88%",
        onEnter: () => gsap.to(".qg-install", { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: () => gsap.set(".qg-install", { autoAlpha: 0, y: 16 }),
      });

      ScrollTrigger.batch(".qg-quick-item", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
      });

      ScrollTrigger.batch(".qg-ss", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, scale: 1, y: 0, stagger: 0.05, duration: reduce ? 0 : 0.5, ease: "power2.out" }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, scale: 0.98, y: 8 }),
      });

      ScrollTrigger.batch(".qg-faq-item, .qg-release-item", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
        onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 10 }),
      });

      gsap.set(".qg-cta", { autoAlpha: 0, y: 16 });
      ScrollTrigger.create({
        trigger: ".qg-cta",
        start: "top 92%",
        onEnter: () => gsap.to(".qg-cta", { autoAlpha: 1, y: 0, ...baseIn }),
        onLeaveBack: () => gsap.set(".qg-cta", { autoAlpha: 0, y: 16 }),
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="qg-hero-eyebrow opacity-0 translate-y-[18px] text-sm tracking-wide text-emerald-300/90">Resources / QGIS Plugin</p>
          <h1 className="qg-hero-title opacity-0 translate-y-[18px] mt-2 text-3xl font-semibold sm:text-4xl">QGIS Plugin</h1>
          <p className="qg-hero-sub opacity-0 translate-y-[18px] mt-3 max-w-2xl text-zinc-300">
            Sync your QGIS projects to the cloud, publish layers, keep styles in step, and share maps in minutes.
          </p>
          <div className="qg-hero-cta opacity-0 translate-y-[18px] mt-6 flex flex-wrap gap-3">
            <Link href="/downloads/qgis-plugin/latest.zip" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
              Download .zip <DownloadIcon className="h-4 w-4" />
            </Link>
            <Link href="/resources/qgis-plugin/install" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70">
              Install via QGIS Plugin Manager
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="qg-info-card opacity-0 translate-y-[14px] rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-300">
            <PlugIcon className="h-5 w-5" />
            <div className="text-sm font-semibold">Compatibility</div>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> QGIS 3.x on Windows, macOS, Linux</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Internet connection for sync & sign-in</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> IMOS account</li>
          </ul>
        </div>
        <div className="qg-info-card opacity-0 translate-y-[14px] rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-300">
            <InfoIcon className="h-5 w-5" />
            <div className="text-sm font-semibold">What it does</div>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Push QGIS layers and styles to IMOS</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Pull updates from the cloud into a local project</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Keep symbology and layer order in sync</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Publish web maps and share links or embeds</li>
          </ul>
        </div>
        <div className="qg-info-card opacity-0 translate-y-[14px] rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-300">
            <InfoIcon className="h-5 w-5" />
            <div className="text-sm font-semibold">Benefits</div>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> No manual exports or file juggling</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Consistent styles across desktop and web</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-5 w-5 text-emerald-300" /> Faster handoffs to teammates and stakeholders</li>
          </ul>
        </div>
      </section>

      <section className="qg-install mt-10 opacity-0 translate-y-[16px] rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold">Install</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>Open QGIS → Plugins → Manage and Install…</li>
          <li>Select <span className="font-medium">Install from ZIP</span> and choose the downloaded file, or add the IMOS repository URL.</li>
          <li>Search for <span className="font-medium">IMOS</span> and click <span className="font-medium">Install</span>.</li>
          <li>Restart QGIS if prompted, then open the plugin from the Plugins menu or toolbar.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <code className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-zinc-300">Repository URL: /resources/qgis-plugin/repo.xml</code>
          <Link href="/resources/qgis-plugin/install" className="rounded-lg border border-emerald-500/40 bg-zinc-900 px-3 py-1.5 font-medium text-emerald-300 hover:border-emerald-400/70">Full install guide</Link>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold">Quick start</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ["Sign in", "Use your IMOS account inside the plugin."],
            ["Pick a project", "Create a new cloud project or select an existing one."],
            ["Choose layers", "Select which layers and styles to include."],
            ["Sync", "Push data and styles; pull updates when teammates publish."],
            ["Publish", "Create a web map and get a shareable link or embed."],
            ["Share", "Send to colleagues, students, or embed on your site/LMS."],
          ].map(([h, p]) => (
            <div key={h} className="qg-quick-item opacity-0 translate-y-[12px] rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckIcon className="h-5 w-5" />
                <span className="text-sm font-semibold">{h}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Screenshots</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="qg-ss opacity-0 translate-y-[8px] scale-[0.98] aspect-[16/10] w-full rounded-xl bg-zinc-800/80 ring-1 ring-white/5" />
          ))}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <div className="mt-4 space-y-4 text-sm text-zinc-300">
            {[
              ["Is the plugin free?", "Yes. Sync and publishing are included with your IMOS plan."],
              ["Which QGIS versions are supported?", "QGIS 3.x on Windows, macOS, and Linux. Keep QGIS updated for best results."],
              ["Does it upload my data or just styles?", "You can sync layers and styles. Choose exactly what you publish each time."],
              ["Can I roll back changes?", "Use project history on the web to review versions and restore when needed."],
            ].map(([q, a]) => (
              <div key={q} className="qg-faq-item opacity-0 translate-y-[10px]">
                <div className="font-medium">{q}</div>
                <p className="mt-1">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-6">
          <h2 className="text-xl font-semibold">Release notes</h2>
          <ul className="mt-3 space-y-3 text-sm text-zinc-300">
            {[
              ["v1.2.0", "Improved style sync and large layer uploads."],
              ["v1.1.0", "Added project picker and sign-in with SSO."],
              ["v1.0.0", "Initial release with push/pull and publish."],
            ].map(([v, d]) => (
              <li key={v} className="qg-release-item opacity-0 translate-y-[10px]">
                <div className="font-medium">{v}</div>
                <div>{d}</div>
              </li>
            ))}
          </ul>
          <Link href="/resources/qgis-plugin/changelog" className="mt-3 inline-block text-sm font-medium text-emerald-300 underline-offset-4 hover:underline">
            Full changelog
          </Link>
        </div>

        <div className="qg-cta opacity-0 translate-y-[16px] rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 via-emerald-400/10 to-transparent p-6 ring-1 ring-emerald-500/10">
          <h2 className="text-xl font-semibold">Need help?</h2>
          <p className="mt-2 text-sm text-zinc-300">Read the Developer Docs or open a support ticket and we’ll get you unstuck.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/resources/developer-docs" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">Developer Docs</Link>
            <Link href="/support" className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/70">Contact Support</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
