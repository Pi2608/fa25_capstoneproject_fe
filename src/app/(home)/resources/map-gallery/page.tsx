"use client";

import Link from "next/link";
import GalleryClient from "./GalleryClient";
import { useI18n } from "@/i18n/I18nProvider";

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z"
      />
    </svg>
  );
}

export default function MapGalleryPage() {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="text-sm tracking-wide text-emerald-300/90">
            {t("map_gallery", "breadcrumb")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            {t("map_gallery", "title")}
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-300">
            {t("map_gallery", "subtitle")}
          </p>

          {/* <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="#gallery"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              {t("map_gallery", "browse_btn")}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>

            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              {t("map_gallery", "templates_btn")}
            </Link>
          </div> */}
        </div>

        {/* Glow effects */}
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      {/* Gallery list */}
      <section id="gallery" className="mt-10">
        <GalleryClient />
      </section>
    </main>
  );
}
