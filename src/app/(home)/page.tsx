"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useLayoutEffect, ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getOrganizationNumber, GetOrganizationNumberResDto } from "@/lib/api-organizations";
import { getMapTemplates } from "@/lib/api-maps";

gsap.registerPlugin(ScrollTrigger);

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
      {children}
    </span>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !done) {
            done = true;
            setReady(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    if (reduce) {
      el.textContent = value.toLocaleString();
      return;
    }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: value,
      duration: 1.2,
      ease: "power1.out",
      onUpdate: () => {
        el.textContent = Math.round(obj.v).toLocaleString();
      },
    });
  }, [value, ready, reduce]);

  return <div ref={ref} className={className} />;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl px-6 py-5 bg-gray-50 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10 text-center">
      <CountUp value={value} className="text-3xl font-extrabold tracking-tight" />
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const reduce = useReducedMotion();
  const [orgCount, setOrgCount] = useState<number>(0);
  const [tplCount, setTplCount] = useState<number>(0);
  const mouseRAF = useRef<number>(0);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const [orgRes, tplRes] = await Promise.allSettled([getOrganizationNumber(), getMapTemplates()]);
        if (cancel) return;
        const orgs =
          orgRes.status === "fulfilled" && orgRes.value && typeof orgRes.value === "object"
            ? (orgRes.value as GetOrganizationNumberResDto).organizationNumber ?? 0
            : 0;
        const tpls = tplRes.status === "fulfilled" && Array.isArray(tplRes.value) ? tplRes.value.length : 0;
        setOrgCount(orgs);
        setTplCount(tpls);
      } catch {
        setOrgCount(0);
        setTplCount(0);
      }
    };
    load();
    return () => {
      cancel = true;
    };
  }, []);

  // hiệu ứng “cursor light”
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      if (mouseRAF.current) cancelAnimationFrame(mouseRAF.current);
      mouseRAF.current = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
        document.documentElement.style.setProperty("--my", `${e.clientY}px`);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (mouseRAF.current) cancelAnimationFrame(mouseRAF.current);
    };
  }, [reduce]);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      const prev = (window.history.scrollRestoration ?? "auto") as string;
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
      return () => {
        // @ts-ignore
        window.history.scrollRestoration = prev;
      };
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  // GSAP in-view animations
  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const base = { ease: "power2.out", duration: prefersReduced || reduce ? 0 : 0.9 } as const;

    const ctx = gsap.context(() => {
      gsap.set([".hero-title", ".hero-subtitle", ".hero-cta"], { autoAlpha: 0, y: 20 });
      gsap
        .timeline()
        .to(".hero-title", { autoAlpha: 1, y: 0, ...base })
        .to(".hero-subtitle", { autoAlpha: 1, y: 0, ...base }, "<0.08")
        .to(".hero-cta", { autoAlpha: 1, y: 0, ...base }, "<0.08");

      gsap.utils.toArray<HTMLElement>(".fade-in").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 20 });
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          onEnter: () =>
            gsap.to(el, {
              autoAlpha: 1,
              y: 0,
              duration: prefersReduced || reduce ? 0 : 0.7,
              ease: "power2.out",
            }),
        });
      });

      gsap.utils.toArray<HTMLElement>(".stagger-card").forEach((container) => {
        const cards = container.querySelectorAll<HTMLElement>(".card");
        gsap.set(cards, { autoAlpha: 0, y: 18 });
        ScrollTrigger.create({
          trigger: container,
          start: "top 80%",
          onEnter: () =>
            gsap.to(cards, {
              autoAlpha: 1,
              y: 0,
              stagger: 0.08,
              duration: prefersReduced || reduce ? 0 : 0.7,
              ease: "power2.out",
            }),
        });
      });
    });
    return () => ctx.revert();
  }, [reduce]);

  return (
    <main className="relative min-h-screen text-gray-900 dark:text-white transition-colors">
      {/* nền động */}
      <div className="bg-scene" aria-hidden />
      <div className="gridlines" aria-hidden />
      <div className="beam beam-a" aria-hidden />
      <div className="beam beam-b" aria-hidden />
      <div className="mesh-blob blob-a" aria-hidden />
      <div className="mesh-blob blob-b" aria-hidden />
      <div className="mesh-blob blob-c" aria-hidden />
      <div className="cursor-light" aria-hidden />
      <div className="vignette" aria-hidden />
      <div className="noise" aria-hidden />

      {/* HERO */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[64vh] md:min-h-[72vh] flex flex-col items-center justify-center text-center gap-6">
          <Pill>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Build maps in minutes
          </Pill>
          <h1 className="hero-title text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-600">
              Create maps
            </span>
            . <span className="text-gray-900 dark:text-white">Customize easily.</span>
          </h1>
          <p className="hero-subtitle text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
            Build interactive, high-quality maps in minutes — perfect for planning, reporting,
            teaching, and exploration.
          </p>
          <div className="hero-cta flex items-center gap-3">
            <Link
              href="/service"
              className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold shadow hover:bg-emerald-400 transition"
            >
              Start now
            </Link>
            <Link
              href="/resources/webinars"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg ring-1 ring-black/10 dark:ring-white/15"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch demo
            </Link>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Free plan available • No credit card required
          </div>
        </section>
      </div>

      {/* marquee */}
      <section className="relative z-10 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="overflow-hidden rounded-2xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
            <div className="relative flex items-center gap-12 whitespace-nowrap px-6 py-3 marquee">
              {["EduTech", "GeoGov", "FieldLab", "GreenMaps", "CivilWorks", "OpenGIS"]
                .concat(["EduTech", "GeoGov", "FieldLab", "GreenMaps", "CivilWorks", "OpenGIS"])
                .map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">{b}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="Maps created" value={12480} />
          <StatCard label="Organizations" value={orgCount} />
          <StatCard label="Templates" value={tplCount} />
          <StatCard label="Monthly exports" value={8421} />
        </div>
      </section>

      {/* features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        <div className="text-center space-y-6 fade-in">
          <h2 className="text-3xl font-bold section-title">Why teams choose IMOS</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Powerful GIS features with a clean UI: build, style, animate, and export — all in your
            browser.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 stagger-card">
          {[
            ["No-code Map Builder", "Draw, style, and organize layers visually with precision tools."],
            ["Story Maps & Timeline", "Turn maps into narratives with segments, zones, and playback."],
            ["Team Collaboration", "Invite members, set roles, comment, and track history."],
            ["Cloud & External Sources", "Upload GeoJSON or connect WMS/WFS, PostGIS, S3."],
            ["Fast Exports", "Generate PDF/PNG/GeoJSON with admin-approved workflows."],
            ["Secure by Design", "RBAC, audit logs, MFA for admins, and encrypted storage."],
          ].map(([title, desc], idx) => (
            <div
              key={idx}
              className="card rounded-2xl p-6 ring-1 ring-black/5 dark:ring-white/10 bg-gray-50 dark:bg-white/5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                  <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z" />
                  </svg>
                </span>
                <h3 className="font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* templates */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">Featured Templates</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose from many ready-to-use templates.
          </p>
          <div className="stagger-card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
            {[
              ["Urban Planning", "/templates/urban-planning"],
              ["Field Survey", "/templates/field-survey"],
              ["Research Report", "/templates/research-report"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href as string}
                className="card rounded-xl p-6 h-44 flex items-center justify-center font-bold text-lg bg-gray-50 hover:bg-gray-100 dark:bg-white/10 dark:hover:bg-white/20 transition"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* how it works + dev quotes */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">How it works</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Three simple steps to a complete map.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ["Choose a template", "Start from a pre-made template or a blank page."],
            ["Customize the map", "Add data, markers, layers, and personalize the look."],
            ["Export & Share", "Download or embed the map anywhere with one click."],
          ].map(([t, d], i) => (
            <div
              key={i}
              className="fade-in rounded-2xl p-6 bg-gray-50 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10"
            >
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                Step {i + 1}
              </div>
              <h4 className="font-semibold mb-1">{t}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* dev API + testimonials */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="rounded-2xl p-6 ring-1 ring-black/5 dark:ring-white/10 bg-gray-50 dark:bg-white/5">
            <h3 className="font-semibold mb-3">Developer-friendly APIs</h3>
            <pre className="rounded-xl p-4 text-sm overflow-auto bg-black text-gray-100">{`POST /api/maps
{
  "name": "Field Survey 2025",
  "visibility": "public",
  "layers": [
    { "type": "Point", "geometry": [106.7, 10.8], "props": { "label": "Site A" } }
  ]
}`}</pre>
            <p className="mt-3 text-sm text-gray-500">
              Use our REST endpoints to automate creation, import GeoJSON, and trigger exports.
            </p>
          </div>
          <div className="rounded-2xl p-6 ring-1 ring-black/5 dark:ring-white/10 bg-gray-50 dark:bg-white/5">
            <h3 className="font-semibold mb-3">What users say</h3>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
              {[
                ["“IMOS cut our reporting time in half.”", "CivilWorks"],
                ["“Story Maps made lessons engaging instantly.”", "EduTech"],
                ["“Exports are crisp and on-brand.”", "GreenMaps"],
              ].map(([q, by], idx) => (
                <figure
                  key={idx}
                  className="min-w-[80%] md:min-w-[60%] snap-center rounded-xl p-5 bg-white dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10"
                >
                  <blockquote className="text-sm md:text-base text-gray-700 dark:text-gray-200">
                    {q}
                  </blockquote>
                  <figcaption className="mt-2 text-xs text-gray-500">— {by}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Ready to build maps faster?
          </h2>
          <p className="mt-2 opacity-90">
            Start free — upgrade anytime for team collaboration, exports, and more.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/register" className="px-6 py-3 rounded-lg bg-white text-emerald-700 font-semibold hover:bg-gray-100 transition">
              Get Started
            </Link>
            <Link href="/pricing" className="px-6 py-3 rounded-lg ring-1 ring-white/50 font-semibold hover:bg-white/10">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* styles nền động */}
      <style jsx global>{`
        :root{--mx:50vw;--my:50vh}
        .bg-scene{position:fixed;inset:0;z-index:-30;background:#070b0b}
        .gridlines{position:fixed;inset:0;z-index:-28;pointer-events:none;opacity:.35;background:repeating-linear-gradient(to right,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 100px),repeating-linear-gradient(to bottom,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 100px);animation:gridMove 30s linear infinite}
        @keyframes gridMove{0%{background-position:0 0,0 0}100%{background-position:1000px 0,0 1000px}}
        .beam{position:fixed;left:50%;top:50%;width:120vmax;height:120vmax;z-index:-27;transform:translate(-50%,-50%);filter:blur(70px);opacity:.45;pointer-events:none}
        .beam-a{background:conic-gradient(from 0deg,rgba(16,185,129,0) 0deg,rgba(16,185,129,.14) 30deg,rgba(16,185,129,0) 65deg);animation:spinA 42s linear infinite}
        .beam-b{background:conic-gradient(from 90deg,rgba(59,130,246,0) 0deg,rgba(59,130,246,.12) 28deg,rgba(59,130,246,0) 62deg);animation:spinB 56s linear infinite reverse}
        @keyframes spinA{to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes spinB{to{transform:translate(-50%,-50%) rotate(-360deg)}}
        .mesh-blob{position:fixed;left:50%;top:35%;transform:translate(-50%,-50%);width:70vmax;height:70vmax;border-radius:50%;filter:blur(80px);opacity:.35;z-index:-20;pointer-events:none}
        .blob-a{background:radial-gradient(circle at 30% 40%,rgba(16,185,129,.55),transparent 60%);animation:driftA 22s linear infinite}
        .blob-b{background:radial-gradient(circle at 70% 60%,rgba(59,130,246,.45),transparent 55%);animation:driftB 28s linear infinite reverse}
        .blob-c{background:radial-gradient(circle at 50% 50%,rgba(34,197,94,.35),transparent 60%);animation:driftC 26s ease-in-out infinite}
        .cursor-light{position:fixed;inset:0;z-index:-15;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(600px 600px at var(--mx) var(--my),rgba(16,185,129,.25),transparent 60%)}
        .vignette{position:fixed;inset:0;z-index:-10;box-shadow:inset 0 0 220px rgba(0,0,0,.55);pointer-events:none}
        .noise{position:fixed;inset:0;z-index:-5;pointer-events:none;opacity:.25;mix-blend-mode:overlay;background-image:radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px);background-size:3px 3px;animation:noiseShift 1.6s steps(2,end) infinite}
        @keyframes noiseShift{0%{transform:translate(0,0)}100%{transform:translate(3px,-3px)}}
        .marquee{animation:marquee 24s linear infinite}
        .marquee:hover{animation-play-state:paused}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes driftA{0%{transform:translate(-60%,-40%) scale(1)}33%{transform:translate(-30%,-30%) scale(1.05)}66%{transform:translate(-45%,-5%) scale(.95)}100%{transform:translate(-60%,-40%) scale(1)}}
        @keyframes driftB{0%{transform:translate(10%,-10%) scale(1)}33%{transform:translate(25%,10%) scale(1.08)}66%{transform:translate(-5%,25%) scale(.92)}100%{transform:translate(10%,-10%) scale(1)}}
        @keyframes driftC{0%{transform:translate(-10%,30%) scale(1)}50%{transform:translate(20%,20%) scale(1.06)}100%{transform:translate(-10%,30%) scale(1)}}
        @media (prefers-reduced-motion:reduce){.gridlines,.beam,.mesh-blob,.noise{animation:none}.beam,.cursor-light{opacity:.18}}
      `}</style>
    </main>
  );
}
