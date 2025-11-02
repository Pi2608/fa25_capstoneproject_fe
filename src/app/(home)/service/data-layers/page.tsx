import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Layers — IMOS",
  description:
    "Bring vector & raster from files, services, and databases. Style with rules, expressions, and legends — optimized for speed.",
};

export default function DataLayersPage() {
  const sources = [
    {
      title: "Files",
      items: ["GeoJSON", "CSV", "Shapefile (.zip)", "KML", "MBTiles (vector/raster)", "TIFF/GeoTIFF"],
    },
    {
      title: "Web services",
      items: ["WMS", "WMTS", "WFS", "TMS/XYZ tiles", "OGC API Features", "ArcGIS Feature/Tile"],
    },
    {
      title: "Databases & cloud",
      items: ["PostGIS", "GeoServer", "S3/MinIO", "Google Drive", "HTTPS URLs"],
    },
  ];

  const renderers = [
    ["Simple", "Single style applied to all features — quickest for base layers."],
    ["Categorical", "Unique value / palette mapping from a string attribute."],
    ["Graduated", "Class breaks from numeric fields (equal interval, quantile, Jenks)."],
    ["Proportional", "Circle/line widths scale with data values."],
    ["Cluster & Heatmap", "Automatic clustering and density visualization."],
    ["3D Extrusions (beta)", "Extrude polygons or bars by attribute or constant."],
  ];

  const rasterTools = [
    ["Color ramps", "Preset & custom ramps (elevation, temperature, NDVI)."],
    ["Hillshade & slope", "Derive shaded relief from DEM."],
    ["Blend modes", "Multiply, Screen, Overlay, Hard light, and more."],
    ["Resampling", "Nearest, bilinear, cubic for crisp or smooth imagery."],
    ["Opacity by zoom", "Fade imagery in/out across scales."],
  ];

  const scheduling = [
    ["Live refresh", "Auto-refresh tiles/layers on a defined interval."],
    ["Sync jobs", "Schedule hourly/daily fetches from Sheets/URLs/S3."],
    ["Webhooks", "Trigger re-builds when upstream data changes."],
    ["Caching", "Global CDN with smart cache-busting on updates."],
  ];

  const chips = (list: string[]) =>
    list.map((t) => (
      <span
        key={t}
        className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300"
      >
        {t}
      </span>
    ));

  return (
    <>
      {/* Hero */}
      <header className="mb-10">
        <div
          data-reveal
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-emerald-300"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Vector & raster. Your way.
        </div>
        <h1 data-reveal className="mt-4 text-3xl md:text-4xl font-semibold text-white">
          Data Layers
        </h1>
        <p data-reveal className="mt-2 max-w-3xl text-zinc-400">
          Connect files, services, and databases. Build rich, fast cartography with rules,
          expressions, and legends — optimized for rendering at any scale.
        </p>
      </header>

      {/* Connectors */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {sources.map((s) => (
          <div key={s.title} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 100 20 10 10 0 000-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z"
                  />
                </svg>
              </span>
              <h3 className="font-semibold text-white">{s.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2">{chips(s.items)}</div>
          </div>
        ))}
      </section>

      {/* Styling system */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Styling controls</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Fill, stroke, width, dash, join/cap, opacity, icons, label halos, and zoom-based rules.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Fill & stroke", "Dash", "Opacity", "Icons", "Labels", "Zoom rules"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Data-driven expressions</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Build rules from attributes: math, string ops, cases, and scale functions.
          </p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">
{`"stroke-width": case(
  [["zoom"] > 10, 2.5],
  [["zoom"] > 7, 1.5],
  1
)`}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Case/when", "Scale", "Interpolate", "Match", "Concat"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Legends</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Auto-generated, editable labels, class swatches, and exportable legend images.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Auto", "Custom labels", "Swatches", "Export PNG/SVG"])}
          </div>
        </div>
      </section>

      {/* Renderers */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">Renderers</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">
          Choose the right renderer for the story your data should tell.
        </p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {renderers.map(([t, d]) => (
            <div key={t} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="font-semibold text-white">{t}</div>
              <p className="mt-1 text-sm text-zinc-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Raster processing */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">Raster tools</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">
          Make imagery readable and expressive across zoom levels.
        </p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rasterTools.map(([t, d]) => (
            <div key={t} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="font-semibold text-white">{t}</div>
              <p className="mt-1 text-sm text-zinc-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Queries & joins */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Filters & queries</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Visual builder or advanced SQL-like syntax for PostGIS/WFS/OGC services.
          </p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">
{`WHERE "population" > 50000
AND   "type" IN ('urban', 'suburban')`}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Spatial predicates", "BBox by view", "Time windows", "Sort & limit"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Joins</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Join layers to sheets or tables by key. Keep attributes synced automatically.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Left/inner join", "Preview rows", "Conflict rules", "Refresh on schedule"])}
          </div>
        </div>
      </section>

      {/* Performance & refresh */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Tiling & performance</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Vector tiling, geometry simplification, and CDN caching keep maps snappy.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Vector tiles", "Generalization by zoom", "Sprite atlas", "HTTP/2 + CDN"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">Refresh & automation</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Keep layers up-to-date with schedules, sync jobs, and webhooks.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {scheduling.map(([t, d]) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <div>
                  <div className="font-medium text-white">{t}</div>
                  <div className="text-zinc-400">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">Frequently asked</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            [
              "Can I blend multiple sources into one layer?",
              "Yes. Merge multiple files/services into a composite layer and keep each source’s refresh rules.",
            ],
            [
              "Does styling persist to exports?",
              "PNG/PDF/SVG exports preserve styles; GeoJSON exports include raw geometry/attributes.",
            ],
            [
              "How big can datasets be?",
              "Millions of features are supported via vector tiling and generalization; heavy layers can be streamed.",
            ],
            [
              "Is there reprojection?",
              "Files/services are reprojected to your project CRS on the fly. PostGIS queries can run in native SRIDs.",
            ],
          ].map(([q, a]) => (
            <details
              key={q}
              data-reveal
              className="rounded-xl bg-white/5 ring-1 ring-white/10 open:bg-white/10 p-4"
            >
              <summary className="cursor-pointer list-none select-none font-medium text-white">
                {q}
              </summary>
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
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Style richer maps with Data Layers
          </h3>
          <p className="mt-1 opacity-90">Connect any source • Build rules • Publish fast</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a
              href="/register"
              className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100"
            >
              Get Started
            </a>
            <a
              href="/resources/dev-docs"
              className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10"
            >
              Dev Docs
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
