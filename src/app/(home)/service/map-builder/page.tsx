import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map Builder — IMOS",
  description:
    "Design interactive maps visually: draw, style, organize layers, and publish in minutes.",
};

export default function MapBuilderPage() {
  const features: { title: string; desc: string }[] = [
    { title: "Precision drawing", desc: "Point, line, polygon, circle, and text with smart snapping & guides." },
    { title: "Flexible styling", desc: "Fill, stroke, dashes, opacity, halos, patterns, and data-driven rules." },
    { title: "Layer management", desc: "Groups, lock, hide, reorder, duplicate, and quick search across layers." },
    { title: "Attributes & forms", desc: "Add fields, edit values, quick tags, and bulk updates on selections." },
    { title: "Media & labels", desc: "Rich labels, icons, images, legends, and per-zoom visibility." },
    { title: "History & safety", desc: "Undo/redo timeline, autosave drafts, version restore, and audit notes." },
  ];

  const steps: { n: string; title: string; desc: string }[] = [
    { n: "01", title: "Create or pick a template", desc: "Start from an urban plan, survey, or a clean slate. Set projection and defaults." },
    { n: "02", title: "Import or draw data", desc: "Upload GeoJSON/CSV/Shapefile or sketch directly with snapping and constraints." },
    { n: "03", title: "Style and organize", desc: "Apply rules, define legends, group layers, and set zoom-based visibility." },
    { n: "04", title: "Publish & share", desc: "Export PNG/PDF/GeoJSON, or embed the live map with a secure share link." },
  ];

  const shortcuts: { k: string; label: string }[] = [
    { k: "V", label: "Select / move" },
    { k: "P", label: "Add point" },
    { k: "L", label: "Draw line" },
    { k: "G", label: "Draw polygon" },
    { k: "T", label: "Add text" },
    { k: "Ctrl / ⌘ + Z", label: "Undo" },
  ];

  const outputs = ["PNG", "PDF", "SVG (beta)", "GeoJSON", "Tiles (beta)"];

  return (
    <main className="relative mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
                   bg-[radial-gradient(900px_420px_at_18%_0%,rgba(16,185,129,0.10),transparent),
                       radial-gradient(900px_420px_at_82%_0%,rgba(16,185,129,0.08),transparent)]"
      />

      {/* Hero */}
      <header className="mb-10">
        <div
          data-reveal
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-emerald-300"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Build visually. Publish fast.
        </div>
        <h1 data-reveal className="mt-4 text-3xl md:text-4xl font-semibold text-white">
          Map Builder
        </h1>
        <p data-reveal className="mt-2 max-w-2xl text-zinc-400">
          Draw, style, and organize layers with a clean UI. Import data, craft beautiful cartography, and export or embed with one click.
        </p>
      </header>

      {/* Feature grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z"
                  />
                </svg>
              </span>
              <h3 className="font-semibold text-white">{f.title}</h3>
            </div>
            <p className="text-sm text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Workflow */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">How it works</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">Four quick steps from blank canvas to a shareable map.</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {steps.map((s) => (
            <div key={s.n} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="text-emerald-300 text-xs font-bold tracking-wider">STEP {s.n}</div>
              <h3 className="mt-1 font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Panels & tools (thêm chút mô tả giao diện) */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">Panels & tools</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">
          Everything you need is one click away — layers, styles, attributes, and exports.
        </p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            ["Layer Panel", "Group layers, reorder, lock/hide, and search instantly."],
            ["Drawing Toolbar", "Add points/lines/polygons, with snapping and constraints."],
            ["Styling Panel", "Color, width, dashes, patterns, rules, and legends."],
            ["Attribute Table", "Edit values, add fields, and bulk-apply quick tags."],
          ].map(([t, d]) => (
            <div key={t} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="mt-1 text-sm text-zinc-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shortcuts & outputs */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Keyboard shortcuts</h3>
          <p className="mt-1 text-sm text-zinc-400">Power-users draw faster with keys.</p>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {shortcuts.map((s) => (
              <li key={s.k + s.label} className="flex items-center gap-2 text-sm text-zinc-300">
                <kbd className="rounded-md bg-white/10 px-2 py-1 text-[11px] ring-1 ring-white/15">{s.k}</kbd>
                <span className="text-zinc-400">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Cartography you control</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Set class breaks, categorical palettes, scale-dependent rules, and design legends that match your brand.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Rules", "Legends", "Palettes", "Zoom visibility", "Patterns"].map((t) => (
              <span key={t} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">High-quality outputs</h3>
          <p className="mt-1 text-sm text-zinc-400">Download crisp exports or keep the map live for collaborators.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {outputs.map((o) => (
              <span key={o} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">
                {o}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">Frequently asked</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["Can I edit attributes in bulk?", "Yes. Use multi-select, then apply edits or formulas across selected features."],
            ["Does it support snapping?", "Snapping to vertices, edges, and grid is available with adjustable tolerance."],
            ["What about coordinate systems?", "Choose a project CRS or work in web mercator; reprojection happens on import."],
            ["Is collaboration real-time?", "You can share links for comment and edit with role-based permissions."],
          ].map(([q, a]) => (
            <details key={q} data-reveal className="rounded-xl bg-white/5 ring-1 ring-white/10 open:bg-white/10 p-4">
              <summary className="cursor-pointer list-none select-none font-medium text-white">{q}</summary>
              <p className="mt-2 text-sm text-zinc-300">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12">
        <div
          data-reveal
          className="rounded-3xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-center"
        >
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">Start your first map in minutes</h3>
          <p className="mt-1 opacity-90">Free plan available • No credit card required</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/register" className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100">Get Started</a>
            <a href="/resources/webinars" className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">Watch demo</a>
          </div>
        </div>
      </section>
    </main>
  );
}
