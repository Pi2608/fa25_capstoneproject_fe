import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resources — IMOS",
  description: "Customers, webinars, docs, help center, and more.",
};

const ITEMS = [
  { title: "Customers", desc: "How 500+ teams build GIS with IMOS.", href: "/resources/customers" },
  { title: "Webinars", desc: "Live sessions and on-demand recordings.", href: "/resources/webinars" },
  { title: "Help Center", desc: "Common questions answered with clear steps.", href: "/resources/help-center" },
  { title: "Developer Docs", desc: "APIs, SDKs, and integration guides.", href: "/resources/developer-docs" },
  { title: "Map Gallery", desc: "Curated interactive maps from our community.", href: "/resources/map-gallery" },
  { title: "Blog", desc: "Product updates, tutorials, and stories.", href: "/resources/blog" },
  { title: "QGIS Plugin", desc: "Sync projects to the cloud from QGIS.", href: "/resources/qgis-plugin" },
];

export default function ResourcesPage() {
  return (
    <main className="relative mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.08),transparent)]" />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Resources</h1>
        <p className="mt-2 text-zinc-400">Everything you need to learn, build, and get inspired.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {ITEMS.map((it) => (
          <Link
            key={it.title}
            href={it.href}
            className="group rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 hover:bg-white/10 transition block"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z"/></svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400">{it.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{it.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
