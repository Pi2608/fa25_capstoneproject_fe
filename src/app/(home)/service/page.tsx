import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services — IMOS",
  description:
    "Everything you need to build, style, and publish interactive maps.",
};

const SERVICES = [
  {
    title: "Map Builder",
    desc: "Draw, edit, and organize layers visually with precision tools.",
    href: "/service/map-builder",
  },
  {
    title: "Data Layers",
    desc: "Vector & raster styling, attribute-driven rules, legends.",
    href: "/service/data-layers",
  },
  {
    title: "Cloud Sources",
    desc: "PostGIS, GeoServer, S3, Google Drive, WMS/WMTS/XYZ…",
    href: "/service/cloud-sources",
  },
  {
    title: "Dashboards",
    desc: "Combine maps with charts, metrics, and filters.",
    href: "/service/dashboards",
  },
  // {
  //   title: "Collaboration",
  //   desc: "Share, comment, versioning, and granular permissions.",
  //   href: "/service/collaboration",
  // },
  {
    title: "Export & Embed",
    desc: "High-quality PNG/PDF exports and simple website embed.",
    href: "/service/export-embed",
  },
];

const USE_CASES = [
  "Urban planning",
  "Field survey",
  "Environment",
  "Education",
  "Transportation",
  "Emergency response",
];

export default function ServicePage() {
  return (
    <main className="relative mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.08),transparent)]" />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Services</h1>
        <p className="mt-2 text-zinc-400">
          Build faster with a complete toolset for mapping, data, and publishing.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICES.map((it) => (
          <Link
            key={it.title}
            href={it.href}
            className="group block rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400">
                  {it.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">{it.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-12">
        <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold">Popular use cases</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Where IMOS fits best across industries.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {USE_CASES.map((u) => (
              <span
                key={u}
                className="rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-sm"
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          [
            "Fast to set up",
            "Start from a template and publish in minutes. No desktop installs.",
          ],
          [
            "Scales with your team",
            "Roles & permissions, versioning, and audit-friendly exports.",
          ],
          [
            "Dev-friendly",
            "REST APIs, webhooks, and SDKs to automate your workflows.",
          ],
        ].map(([t, d]) => (
          <div
            key={t as string}
            className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z"
                  />
                </svg>
              </span>
              <h3 className="font-semibold">{t}</h3>
            </div>
            <p className="text-sm text-zinc-400">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
