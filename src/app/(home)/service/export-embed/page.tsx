import type { Metadata } from "next";
import ExportEmbedClient from "./ExportEmbedClient";

export const metadata: Metadata = {
  title: "Export & Embed — IMOS",
  description:
    "Export high-resolution PNG/PDF and embed interactive maps anywhere. Brand controls, print presets, tokens, and domain allowlists.",
};

export default function ExportEmbedPage() {
  const features = [
    { titleKey: "fea_highres_t", descKey: "fea_highres_d" },
    { titleKey: "fea_print_t", descKey: "fea_print_d" },
    { titleKey: "fea_batch_t", descKey: "fea_batch_d" },
    { titleKey: "fea_live_t", descKey: "fea_live_d" },
    { titleKey: "fea_brand_t", descKey: "fea_brand_d" },
    { titleKey: "fea_access_t", descKey: "fea_access_d" },
  ];

  const formats: [string, string][] = [
    ["fmt_png_t", "fmt_png_d"],
    ["fmt_pdf_t", "fmt_pdf_d"],
    ["fmt_svg_t", "fmt_svg_d"],
  ];

  const presets = [
    { titleKey: "pre_a4_t", descKey: "pre_a4_d", ratioKey: "pre_a4_r" },
    { titleKey: "pre_a2_t", descKey: "pre_a2_d", ratioKey: "pre_a2_r" },
    { titleKey: "pre_169_t", descKey: "pre_169_d", ratioKey: "pre_169_r" },
  ];

  const embedSnippets = {
    iframe: `<iframe
  src="https://app.imos.dev/embed/map/abc123?theme=dark&legend=1&controls=zoom,scale"
  width="100%" height="520" style="border:0;border-radius:12px" allow="clipboard-write"
></iframe>`,
    react: `import { IMOSEmbed } from "@imos/embed";
<IMOSEmbed
  mapId="abc123"
  token="eyJhbGciOi..." 
  theme="dark"
  options={{ legend: true, controls: ["zoom","scale"], search: true }}
/>`,
    rest: `POST /api/exports/png
{ "mapId":"abc123", "width":3840, "height":2160, "dpi":300, "transparent":true, "scale":5000 }`,
    signed: `GET /embed/map/abc123?expires=1735689600&sig=2d9f2c...`,
  };

  const controls: [string, string][] = [
    ["ctl_legend_t", "ctl_legend_d"],
    ["ctl_watermark_t", "ctl_watermark_d"],
    ["ctl_safe_t", "ctl_safe_d"],
    ["ctl_l10n_t", "ctl_l10n_d"],
  ];

  const faqs: [string, string][] = [
    ["faq_domain_q", "faq_domain_a"],
    ["faq_pdf_q", "faq_pdf_a"],
    ["faq_jobs_q", "faq_jobs_a"],
  ];

  return (
    <ExportEmbedClient
      features={features}
      formats={formats}
      presets={presets}
      embedSnippets={embedSnippets}
      controls={controls}
      faqs={faqs}
    />
  );
}
