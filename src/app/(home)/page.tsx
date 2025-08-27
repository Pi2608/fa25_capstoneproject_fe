import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CustomMapOSM — Map your world, fast & simple",
  description: "Felt-style landing page in dark green tone with category bar and sections.",
};

const NAV = [
  { label: "Service", href: "/service" },
  { label: "Tutorial", href: "/tutorial" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Community", href: "/community" },
] as const;

const CATEGORIES = [
  "Geospatial",
  "Planning",
  "Reports",
  "Education",
  "Engineering",
  "Research",
  "Operations",
  "Fieldwork",
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.18),transparent)] bg-gradient-to-b from-zinc-950 via-emerald-950/30 to-zinc-950 text-zinc-100">
      <section className="relative">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Map your world
              <span className="block bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                fast & simple
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-zinc-300 md:text-lg">
              Plan, analyze, and present on an elegant, collaborative map canvas. Import data, sketch ideas, and share instantly.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400"
              >
                Start for free
              </Link>
              <Link
                href="/templates"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Explore templates
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-3xl bg-emerald-500/10 blur-2xl" />
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-800/60 p-3 shadow-2xl backdrop-blur">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <div className="h-2 w-2 rounded-full bg-emerald-300/80" />
                  <div className="h-2 w-2 rounded-full bg-emerald-200/70" />
                </div>
                <div className="aspect-[16/10] w-full rounded-xl bg-[linear-gradient(120deg,rgba(16,185,129,0.25),transparent),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}