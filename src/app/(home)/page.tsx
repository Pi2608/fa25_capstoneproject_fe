"use client";

import Link from "next/link";
import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  ReactNode,
  useMemo,
} from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getHomeStats, type HomeStatsResponse } from "@/lib/api-home";
import { useI18n } from "@/i18n/I18nProvider";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";
import "@/styles/home-landing.css";

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
      <CountUp
        value={value}
        className="text-3xl font-extrabold tracking-tight"
      />
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [stats, setStats] = useState<HomeStatsResponse>({
    organizationCount: 0,
    templateCount: 0,
    totalMaps: 0,
    monthlyExports: 0,
  });
  const mouseRAF = useRef<number>(0);

  useGsapHomeScroll({
    reduce,
    heroSelectors: {
      title: ".hero-title",
      subtitle: ".hero-subtitle",
      cta: ".hero-cta",
    },
    fadeSelector: ".fade-in",
    stagger: {
      container: ".stagger-card",
      card: ".card",
    },
  });

  const features = useMemo<
    ReadonlyArray<{ title: string; desc: string }>
  >(
    () => [
      { title: t("home", "feat0_title"), desc: t("home", "feat0_desc") },
      { title: t("home", "feat1_title"), desc: t("home", "feat1_desc") },
      { title: t("home", "feat2_title"), desc: t("home", "feat2_desc") },
      { title: t("home", "feat3_title"), desc: t("home", "feat3_desc") },
      { title: t("home", "feat4_title"), desc: t("home", "feat4_desc") },
      { title: t("home", "feat5_title"), desc: t("home", "feat5_desc") },
    ],
    [t]
  );

  const templates = useMemo<
    ReadonlyArray<{ label: string; href: string }>
  >(
    () => [
      { label: t("home", "tpl0"), href: "/templates/urban-planning" },
      { label: t("home", "tpl1"), href: "/templates/field-survey" },
      { label: t("home", "tpl2"), href: "/templates/research-report" },
    ],
    [t]
  );

  const steps = useMemo<
    ReadonlyArray<{ title: string; desc: string }>
  >(
    () => [
      { title: t("home", "step0_title"), desc: t("home", "step0_desc") },
      { title: t("home", "step1_title"), desc: t("home", "step1_desc") },
      { title: t("home", "step2_title"), desc: t("home", "step2_desc") },
    ],
    [t]
  );

  const quotes = useMemo<
    ReadonlyArray<{ q: string; by: string }>
  >(
    () => [
      { q: t("home", "quote0_q"), by: t("home", "quote0_by") },
      { q: t("home", "quote1_q"), by: t("home", "quote1_by") },
      { q: t("home", "quote2_q"), by: t("home", "quote2_by") },
    ],
    [t]
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await getHomeStats();
        if (!cancel && res) {
          setStats({
            organizationCount: Number(res.organizationCount) || 0,
            templateCount: Number(res.templateCount) || 0,
            totalMaps: Number(res.totalMaps) || 0,
            monthlyExports: Number(res.monthlyExports) || 0,
          });
        }
      } catch {
        if (!cancel) {
          setStats({
            organizationCount: 0,
            templateCount: 0,
            totalMaps: 0,
            monthlyExports: 0,
          });
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

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
        (window.history as unknown as { scrollRestoration: string }).scrollRestoration =
          prev;
      };
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="home-landing relative min-h-screen text-gray-900 dark:text-white transition-colors">
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

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[64vh] md:min-h-[72vh] flex flex-col items-center justify-center text-center gap-6">
          <Pill>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t("home", "heroPill")}
          </Pill>
          <h1 className="hero-title text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-600">
              {t("home", "heroTitleA")}
            </span>
            .{" "}
            <span className="text-gray-900 dark:text-white">
              {t("home", "heroTitleB")}
            </span>
          </h1>
          <p className="hero-subtitle text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
            {t("home", "heroSubtitle")}
          </p>
          <div className="hero-cta flex items-center gap-3">
            <Link
              href="/service"
              className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold shadow hover:bg-emerald-400 transition"
            >
              {t("home", "ctaPrimary")}
            </Link>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t("home", "freeBadge")}
          </div>
        </section>
      </div>

      <section className="relative z-10 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="overflow-hidden rounded-2xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
            <div className="relative flex items-center gap-12 whitespace-nowrap px-6 py-3 marquee">
              {["EduTech", "GeoGov", "FieldLab", "GreenMaps", "CivilWorks", "OpenGIS"]
                .concat([
                  "EduTech",
                  "GeoGov",
                  "FieldLab",
                  "GreenMaps",
                  "CivilWorks",
                  "OpenGIS",
                ])
                .map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-gray-700 dark:text-gray-200"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">{b}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard label={t("home", "statMaps")} value={stats.totalMaps} />
          <StatCard
            label={t("home", "statOrgs")}
            value={stats.organizationCount}
          />
          <StatCard
            label={t("home", "statTemplates")}
            value={stats.templateCount}
          />
          <StatCard
            label={t("home", "statExports")}
            value={stats.monthlyExports}
          />
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        <div className="text-center space-y-6 fade-in">
          <h2 className="text-3xl font-bold section-title">
            {t("home", "whyTitle")}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("home", "whyDesc")}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 stagger-card">
          {features.map((f, idx) => (
            <div
              key={idx}
              className="card rounded-2xl p-6 ring-1 ring-black/5 dark:ring-white/10 bg-gray-50 dark:bg-white/5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                  <svg
                    className="h-4 w-4 text-emerald-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z" />
                  </svg>
                </span>
                <h3 className="font-semibold">{f.title}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">
            {t("home", "tplTitle")}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("home", "tplDesc")}
          </p>
          <div className="stagger-card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
            {templates.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="card rounded-xl p-6 h-44 flex items-center justify-center font-bold text-lg bg-gray-50 hover:bg-gray-100 dark:bg-white/10 dark:hover:bg-white/20 transition"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-6">
          <h2 className="section-title text-3xl font-bold">
            {t("home", "howTitle")}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t("home", "howDesc")}
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div
              key={i}
              className="fade-in rounded-2xl p-6 bg-gray-50 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10"
            >
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                {t("home", "step")} {i + 1}
              </div>
              <h4 className="font-semibold mb-1">{s.title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl p-8 md:p-12 text-center ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t("home", "finalTitle")}
          </h2>
          <p className="mt-2 opacity-90">{t("home", "finalDesc")}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-3 rounded-lg bg-white text-emerald-700 font-semibold hover:bg-gray-100 transition"
            >
              {t("home", "finalPrimary")}
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-lg ring-1 ring-white/50 font-semibold hover:bg-white/10"
            >
              {t("home", "finalSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
