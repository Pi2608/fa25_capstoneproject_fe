"use client";

import { useI18n } from "@/i18n/I18nProvider";

export default function DataLayersClient() {
  const { t } = useI18n();

  const sources = [
    {
      title: t("data_layers", "src_files"),
      items: ["GeoJSON", "CSV", "Shapefile (.zip)", "KML", "MBTiles (vector/raster)", "TIFF/GeoTIFF"],
    },
    {
      title: t("data_layers", "src_web"),
      items: ["WMS", "WMTS", "WFS", "TMS/XYZ tiles", "OGC API Features", "ArcGIS Feature/Tile"],
    },
    {
      title: t("data_layers", "src_db"),
      items: ["PostGIS", "GeoServer", "S3/MinIO", "Google Drive", "HTTPS URLs"],
    },
  ];

  const renderers: [string, string][] = [
    [t("data_layers", "rend_simple_t"), t("data_layers", "rend_simple_d")],
    [t("data_layers", "rend_cat_t"), t("data_layers", "rend_cat_d")],
    [t("data_layers", "rend_grad_t"), t("data_layers", "rend_grad_d")],
    [t("data_layers", "rend_prop_t"), t("data_layers", "rend_prop_d")],
    [t("data_layers", "rend_cluster_t"), t("data_layers", "rend_cluster_d")],
    [t("data_layers", "rend_3d_t"), t("data_layers", "rend_3d_d")],
  ];

  const rasterTools: [string, string][] = [
    [t("data_layers", "ras_ramps_t"), t("data_layers", "ras_ramps_d")],
    [t("data_layers", "ras_hill_t"), t("data_layers", "ras_hill_d")],
    [t("data_layers", "ras_blend_t"), t("data_layers", "ras_blend_d")],
    [t("data_layers", "ras_resamp_t"), t("data_layers", "ras_resamp_d")],
    [t("data_layers", "ras_opacity_t"), t("data_layers", "ras_opacity_d")],
  ];

  const scheduling: [string, string][] = [
    [t("data_layers", "sch_live_t"), t("data_layers", "sch_live_d")],
    [t("data_layers", "sch_sync_t"), t("data_layers", "sch_sync_d")],
    [t("data_layers", "sch_hooks_t"), t("data_layers", "sch_hooks_d")],
    [t("data_layers", "sch_cache_t"), t("data_layers", "sch_cache_d")],
  ];

  const chips = (list: string[]) =>
    list.map((t) => (
      <span key={t} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">
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
          {t("data_layers", "hero_pill")}
        </div>
        <h1 data-reveal className="mt-4 text-3xl md:text-4xl font-semibold text-white">
          {t("data_layers", "hero_title")}
        </h1>
        <p data-reveal className="mt-2 max-w-3xl text-zinc-400">{t("data_layers", "hero_desc")}</p>
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
          <h3 className="font-semibold text-white">{t("data_layers", "sty_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "sty_desc")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips([t("data_layers", "chip_fill"), t("data_layers", "chip_dash"), "Opacity", "Icons", "Labels", t("data_layers", "chip_zoom")])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("data_layers", "expr_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "expr_desc")}</p>
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
          <h3 className="font-semibold text-white">{t("data_layers", "legend_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "legend_desc")}</p>
          <div className="mt-3 flex flex-wrap gap-2">{chips([t("data_layers", "chip_auto"), t("data_layers", "chip_custom"), "Swatches", "Export PNG/SVG"])}</div>
        </div>
      </section>

      {/* Renderers */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">{t("data_layers", "rend_title")}</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">{t("data_layers", "rend_desc")}</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {renderers.map(([t1, d1]) => (
            <div key={t1} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="font-semibold text-white">{t1}</div>
              <p className="mt-1 text-sm text-zinc-400">{d1}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Raster processing */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">{t("data_layers", "ras_title")}</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">{t("data_layers", "ras_desc")}</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rasterTools.map(([t1, d1]) => (
            <div key={t1} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="font-semibold text-white">{t1}</div>
              <p className="mt-1 text-sm text-zinc-400">{d1}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Queries & joins */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("data_layers", "filter_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "filter_desc")}</p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">
{`WHERE "population" > 50000
AND   "type" IN ('urban', 'suburban')`}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips([t("data_layers", "chip_spatial"), "BBox by view", "Time windows", "Sort & limit"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("data_layers", "join_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "join_desc")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips([t("data_layers", "chip_join"), t("data_layers", "chip_preview"), t("data_layers", "chip_conflict"), t("data_layers", "chip_refresh")])}
          </div>
        </div>
      </section>

      {/* Performance & refresh */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("data_layers", "perf_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "perf_desc")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips(["Vector tiles", t("data_layers", "chip_generalize"), "Sprite atlas", "HTTP/2 + CDN"])}
          </div>
        </div>
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("data_layers", "auto_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("data_layers", "auto_desc")}</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {scheduling.map(([t1, d1]) => (
              <li key={t1} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <div>
                  <div className="font-medium text-white">{t1}</div>
                  <div className="text-zinc-400">{d1}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">{t("data_layers", "faq_title")}</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            [t("data_layers", "faq1_q"), t("data_layers", "faq1_a")],
            [t("data_layers", "faq2_q"), t("data_layers", "faq2_a")],
            [t("data_layers", "faq3_q"), t("data_layers", "faq3_a")],
            [t("data_layers", "faq4_q"), t("data_layers", "faq4_a")],
          ].map(([q, a]) => (
            <details key={q as string} data-reveal className="rounded-xl bg-white/5 ring-1 ring-white/10 open:bg-white/10 p-4">
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
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">{t("data_layers", "cta_title")}</h3>
          <p className="mt-1 opacity-90">{t("data_layers", "cta_desc")}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/register" className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100">
              {t("common", "get_started")}
            </a>
            <a href="/resources/dev-docs" className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">
              {t("common", "dev_docs")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
