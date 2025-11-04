import type { Metadata } from "next";
import ExportEmbedClient from "./ExportEmbedClient";

export const metadata: Metadata = {
  title: "Export & Embed — IMOS",
  description:
    "Export high-resolution PNG/PDF and embed interactive maps anywhere. Brand controls, print presets, tokens, and domain allowlists.",
};

export default function ExportEmbedPage() {
  const features = [
    { title: "High-res output", desc: "PNG/PDF up to 8K with DPI, transparent background, and vector text." },
    { title: "Print presets", desc: "A-series sizes, margins/bleed, scale bars, grids, and legends." },
    { title: "Batch & queue", desc: "Schedule export jobs, webhooks on completion, retry with backoff." },
    { title: "Live embed", desc: "Responsive iframe or React component with theme, legend, and filters." },
    { title: "Branding", desc: "Logo, title block, colors, and watermark per org or per export." },
    { title: "Access control", desc: "Domain allowlist, signed URLs, SSO tokens, and view permissions." },
  ];

  const formats: [string, string][] = [
    ["PNG", "Raster image for reports and slides. Supports HiDPI and transparency."],
    ["PDF", "Vector printing with selectable text, CMYK-friendly colors, and layers legend."],
    ["SVG", "Scalable vector for design tools; great for posters and infographics."],
  ];

  const presets = [
    { title: "Report A4", desc: "Portrait A4 with title, legend, scale bar, and footer.", ratio: "210×297 mm" },
    { title: "Poster A2", desc: "Large format for exhibitions with grid and credits.", ratio: "420×594 mm" },
    { title: "Social 16:9", desc: "Landscape 1920×1080 with safe areas and watermark.", ratio: "1920×1080" },
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
    ["Legend", "Dock left/right, collapsed by default, custom titles."],
    ["Watermark", "Per-org or per-export watermark, opacity and position."],
    ["Safe areas", "Guides for titles/logos; prevent overlap with important features."],
    ["Localization", "Date/number formats, locale labels, and RTL support in PDFs."],
  ];

  const faqs: [string, string][] = [
    ["Can I lock embeds to my domain?", "Yes. Add domains to the allowlist. Requests from other domains are blocked."],
    ["Do PDFs keep vector quality?", "Yes. Symbols and labels remain vector where possible; rasters are tiled with overviews."],
    ["How are export jobs delivered?", "Large jobs run in a queue. Poll the job endpoint or register a webhook to receive the file URL."],
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
