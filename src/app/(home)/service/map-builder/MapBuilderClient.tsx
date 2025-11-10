"use client";

import { useI18n } from "@/i18n/I18nProvider";

export default function MapBuilderClient() {
  const { t } = useI18n();

  const features = [
    { title: t("map_builder", "feat_precision_title"), desc: t("map_builder", "feat_precision_desc") },
    { title: t("map_builder", "feat_style_title"), desc: t("map_builder", "feat_style_desc") },
    { title: t("map_builder", "feat_layers_title"), desc: t("map_builder", "feat_layers_desc") },
    { title: t("map_builder", "feat_attrs_title"), desc: t("map_builder", "feat_attrs_desc") },
    { title: t("map_builder", "feat_media_title"), desc: t("map_builder", "feat_media_desc") },
    { title: t("map_builder", "feat_history_title"), desc: t("map_builder", "feat_history_desc") },
  ];

  const steps = [
    { n: "01", title: t("map_builder", "step1_title"), desc: t("map_builder", "step1_desc") },
    { n: "02", title: t("map_builder", "step2_title"), desc: t("map_builder", "step2_desc") },
    { n: "03", title: t("map_builder", "step3_title"), desc: t("map_builder", "step3_desc") },
    { n: "04", title: t("map_builder", "step4_title"), desc: t("map_builder", "step4_desc") },
  ];

  const shortcuts = [
    { k: "V", label: t("map_builder", "sc_select") },
    { k: "P", label: t("map_builder", "sc_point") },
    { k: "L", label: t("map_builder", "sc_line") },
    { k: "G", label: t("map_builder", "sc_polygon") },
    { k: "T", label: t("map_builder", "sc_text") },
    { k: "Ctrl / ⌘ + Z", label: t("map_builder", "sc_undo") },
  ];

  const outputs = ["PNG", "PDF", t("map_builder", "out_svg"), "GeoJSON", t("map_builder", "out_tiles")];

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
          {t("map_builder", "hero_pill")}
        </div>
        <h1 data-reveal className="mt-4 text-3xl md:text-4xl font-semibold text-white">
          {t("map_builder", "hero_title")}
        </h1>
        <p data-reveal className="mt-2 max-w-2xl text-zinc-400">{t("map_builder", "hero_desc")}</p>
      </header>

      {/* Feature grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z" />
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
        <h2 data-reveal className="text-xl font-semibold text-white">{t("map_builder", "how_title")}</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">{t("map_builder", "how_desc")}</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {steps.map((s) => (
            <div key={s.n} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="text-emerald-300 text-xs font-bold tracking-wider">
                {t("map_builder", "step_label")} {s.n}
              </div>
              <h3 className="mt-1 font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Panels & tools */}
      <section className="mt-12">
        <h2 data-reveal className="text-xl font-semibold text-white">{t("map_builder", "panels_title")}</h2>
        <p data-reveal className="mt-1 text-sm text-zinc-400">{t("map_builder", "panels_desc")}</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            [t("map_builder", "panel_layer"), t("map_builder", "panel_layer_desc")],
            [t("map_builder", "panel_draw"), t("map_builder", "panel_draw_desc")],
            [t("map_builder", "panel_style"), t("map_builder", "panel_style_desc")],
            [t("map_builder", "panel_attr"), t("map_builder", "panel_attr_desc")],
          ].map(([t1, d1]) => (
            <div key={String(t1)} data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <h3 className="font-semibold text-white">{t1}</h3>
              <p className="mt-1 text-sm text-zinc-400">{d1}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shortcuts & outputs */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("map_builder", "kb_title")}</h3>
          <p data-reveal className="mt-1 text-sm text-zinc-400">{t("map_builder", "kb_desc")}</p>
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
          <h3 className="font-semibold text-white">{t("map_builder", "carto_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("map_builder", "carto_desc")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              t("map_builder", "chip_rules"),
              t("map_builder", "chip_legends"),
              t("map_builder", "chip_palettes"),
              t("map_builder", "chip_zoom"),
              t("map_builder", "chip_patterns"),
            ].map((chip) => (
              <span key={chip} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
          <h3 className="font-semibold text-white">{t("map_builder", "out_title")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("map_builder", "out_desc")}</p>
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
        <h2 data-reveal className="text-xl font-semibold text-white">{t("map_builder", "faq_title")}</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            [t("map_builder", "faq1_q"), t("map_builder", "faq1_a")],
            [t("map_builder", "faq2_q"), t("map_builder", "faq2_a")],
            [t("map_builder", "faq3_q"), t("map_builder", "faq3_a")],
            [t("map_builder", "faq4_q"), t("map_builder", "faq4_a")],
          ].map(([q, a]) => (
            <details key={String(q)} data-reveal className="rounded-xl bg-white/5 ring-1 ring-white/10 open:bg-white/10 p-4">
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
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">{t("map_builder", "cta_title")}</h3>
          <p className="mt-1 opacity-90">{t("map_builder", "cta_desc")}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/register" className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100">
              {t("common", "get_started")}
            </a>
            <a href="/resources/webinars" className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">
              {t("common", "watch_demo")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
