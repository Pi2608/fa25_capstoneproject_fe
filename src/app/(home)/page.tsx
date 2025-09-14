"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: { label: string; desc?: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLDivElement>("[data-menu]");
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (open) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: -8, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: reduce ? 0 : 0.2, ease: "power2.out" }
      );
    } else {
      gsap.to(el, { autoAlpha: 0, y: -8, scale: 0.98, duration: reduce ? 0 : 0.15, ease: "power1.in" });
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition"
      >
        {label}
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      <div
        data-menu
        role="menu"
        tabIndex={-1}
        className={`${open ? "pointer-events-auto" : "pointer-events-none"} absolute left-1/2 -translate-x-1/2 mt-4 w-[640px] max-w-[90vw] rounded-2xl bg-zinc-900/90 backdrop-blur-md ring-1 ring-white/10 shadow-2xl p-4 md:p-5`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              className="group flex items-start gap-3 rounded-xl p-3 md:p-4 hover:bg-white/10 focus:bg-white/10 outline-none transition"
              onClick={() => setOpen(false)}
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400">
                  <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z" />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="text-[15px] md:text-[16px] font-semibold text-white group-hover:text-emerald-400">
                  {it.label}
                </div>
                {it.desc && <p className="text-sm text-white/70 mt-1">{it.desc}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  const SERVICES = [
    { label: "Map Builder", desc: "Create interactive web maps quickly.", href: "/service/map-builder" },
    { label: "Data Layers", desc: "Vector & raster with flexible styling.", href: "/service/data-layers" },
    { label: "Cloud Sources", desc: "PostGIS, GeoServer, S3, Google Drive…", href: "/service/cloud-sources" },
    { label: "Dashboards", desc: "Maps + charts & metrics.", href: "/service/dashboards" },
    { label: "Collaboration", desc: "Share & edit with teams.", href: "/service/collaboration" },
    { label: "Export & Embed", desc: "Export PNG/PDF, embed anywhere.", href: "/service/export-embed" },
  ];

  const RESOURCES = [
    { label: "Customers", desc: "How 500+ teams build GIS with us.", href: "/resources/customers" },
    { label: "Webinars", desc: "Live and on-demand sessions.", href: "/resources/webinars" },
    { label: "Help Center", desc: "Guides & troubleshooting.", href: "/resources/help-center" },
    { label: "Developer Docs", desc: "APIs, SDKs, integration.", href: "/resources/developer-docs" },
    { label: "Map Gallery", desc: "Curated maps from community.", href: "/resources/map-gallery" },
    { label: "Blog", desc: "Updates and tutorials.", href: "/resources/blog" },
    { label: "QGIS Plugin", desc: "Sync projects to cloud.", href: "/resources/qgis-plugin" },
  ];

  useLayoutEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const base = { ease: "power2.out", duration: reduce ? 0 : 0.9 } as const;
      gsap.set([".hero-title", ".hero-subtitle", ".hero-cta"], { autoAlpha: 0, y: 20 });
      gsap.timeline()
        .to(".hero-title", { autoAlpha: 1, y: 0, ...base })
        .to(".hero-subtitle", { autoAlpha: 1, y: 0, ...base }, "<0.08")
        .to(".hero-cta", { autoAlpha: 1, y: 0, ...base }, "<0.08");
      gsap.set(".tpl-card", { autoAlpha: 0, y: 24 });
      ScrollTrigger.batch(".tpl-card", {
        start: "top 80%",
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.08,
            duration: reduce ? 0 : 0.7,
            ease: "power2.out",
          }),
      });
      gsap.utils.toArray<HTMLElement>(".step").forEach((s) => {
        gsap.set(s, { autoAlpha: 0, y: 16 });
        ScrollTrigger.create({
          trigger: s,
          start: "top 85%",
          onEnter: () =>
            gsap.to(s, {
              autoAlpha: 1,
              y: 0,
              duration: reduce ? 0 : 0.6,
              ease: "power2.out",
            }),
        });
      });
      gsap.utils.toArray<HTMLElement>(".section-title").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 12 });
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          onEnter: () =>
            gsap.to(el, {
              autoAlpha: 1,
              y: 0,
              duration: reduce ? 0 : 0.6,
              ease: "power2.out",
            }),
        });
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <main className="relative min-h-screen text-white">
      <header className="sticky top-0 z-40">
        <div className="pointer-events-none absolute inset-x-0 -z-10 h-20 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-400 shadow" />
            <span className="text-lg md:text-xl font-bold tracking-tight text-white">CustomMapOSM</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <NavDropdown label="Services" items={SERVICES} />
            <Link href="/tutorial" className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition">Tutorials</Link>
            {/* <Link href="/templates" className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition">Templates</Link> */}
            <Link href="/pricing" className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition">Pricing</Link>
            <NavDropdown label="Resources" items={RESOURCES} />
            <Link href="/community" className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition">Community</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-white">Log in</Link>
                <Link href="/register" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Get Started</Link>
              </>
            ) : (
              <>
                <Link href="/profile" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Profile</Link>
                <button onClick={onLogout} className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-red-400">Log out</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
          <h1 className="hero-title text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">Create maps. Customize easily.</h1>
          <p className="hero-subtitle text-lg text-gray-200 max-w-xl leading-relaxed">
            Build interactive, high-quality maps in minutes — perfect for planning, reporting, and exploration.
          </p>
          <Link href="/service" className="hero-cta inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors">
            Start now
          </Link>
        </section>
      </div>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 space-y-24 text-white">
        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">Featured Templates</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">Choose from many ready-to-use map templates for different fields.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
            <Link href="/templates/urban-planning" className="tpl-card bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">Urban Planning</Link>
            <Link href="/templates/field-survey" className="tpl-card bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">Field Survey</Link>
            <Link href="/templates/research-report" className="tpl-card bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">Research Report</Link>
          </div>
        </div>

        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">How it works</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">Just 3 steps to get a complete map.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="step bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">1. Choose a template</h4>
              <p className="text-sm text-gray-300">Start from a pre-made template or a blank page.</p>
            </div>
            <div className="step bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">2. Customize the map</h4>
              <p className="text-sm text-gray-300">Add data, markers, layers, and personalize the look.</p>
            </div>
            <div className="step bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">3. Export & Share</h4>
              <p className="text-sm text-gray-300">Download or embed the map to use anywhere.</p>
            </div>
          </div>
        </div>

        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">Trusted by professionals</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">Used by teams of engineers, educators, NGOs, and governments.</p>
        </div>
      </section>
    </main>
  );
}
