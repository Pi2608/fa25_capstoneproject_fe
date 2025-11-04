import type { Metadata } from "next";
import DashboardsClient from "./DashboardsClient";

export const metadata: Metadata = {
  title: "Dashboards — IMOS",
  description:
    "Compose maps, charts, and metrics into fast, real-time dashboards. Cross-filter, drill-through, collaborate, and publish securely.",
};

export default function DashboardsPage() {
  const features = [
    { title: "Map + Charts", desc: "Link layers with bar/line/pie tables and KPIs for instant context." },
    { title: "Cross-filtering", desc: "Select on the map to filter every widget, or lasso in a chart to update the map." },
    { title: "Drill-through", desc: "Open detail panels or navigate to deep-dive views with preserved filters." },
    { title: "Realtime & Alerts", desc: "Live tiles and streaming data with threshold-based alerts and email digests." },
    { title: "Calculated Fields", desc: "Create metrics with expressions, groupings, bins, and date windows." },
    { title: "Permissions", desc: "Roles and row-level security inherited from sources with audit trails." },
  ];

  const steps = [
    { k: "Connect", t: "Add sources", d: "PostGIS, GeoServer, S3/MinIO, Sheets, OGC/ArcGIS, HTTPS." },
    { k: "Model", t: "Define metrics", d: "Joins, filters, expressions, time windows, and categories." },
    { k: "Compose", t: "Arrange widgets", d: "Map, KPIs, charts, tables, cards, and notes on a responsive grid." },
    { k: "Publish", t: "Share & embed", d: "Links, permissions, schedules, and export to PNG/PDF." },
  ];

  const kpis = [
    { label: "Incidents today", value: "128", sub: "+12 vs. yesterday" },
    { label: "Avg response", value: "7.4 min", sub: "P95 12.1 min" },
    { label: "Affected districts", value: "9", sub: "out of 24" },
    { label: "Open tasks", value: "42", sub: "12 overdue" },
  ];

  const presets = [
    { title: "Operations Command", desc: "Live incidents, crews, and service levels with alerting.", href: "/templates/ops-command" },
    { title: "Urban Planning Review", desc: "Zoning, permits, timelines, and stakeholder feedback.", href: "/templates/urban-review" },
    { title: "Environment Monitor", desc: "Air/water sensors, raster overlays, and compliance KPIs.", href: "/templates/env-monitor" },
  ];

  const integrations = [
    "PostGIS", "GeoServer", "S3/MinIO", "Google Sheets", "CSV/GeoJSON URLs", "BigQuery", "Snowflake", "OGC API Features", "WMS/WMTS/WFS", "ArcGIS Feature/Tile", "HTTPS tiles", "MQTT"
  ];

  const interactions = [
    { title: "Cross-highlighting", desc: "Hover bars to highlight features; hover features to glow bars." },
    { title: "Bookmarks", desc: "Save views with filters, time range, and camera position." },
    { title: "Global date slider", desc: "One control to shift time windows across all widgets." },
    { title: "Quick search", desc: "Spotlight for places, layers, and records with jump-to actions." },
  ];

  const faqs: [string, string][] = [
    ["Can I embed a dashboard?", "Yes. Publish with an embed code or private link with SSO/role checks."],
    ["Does it support big rasters?", "Yes. Add GeoTIFF/MBTiles or XYZ; rendering uses tiling, overviews, and WebGL."],
    ["How fast are filters?", "Typical interactions resolve in under 200 ms with server-side aggregation and caching."],
  ];

  return (
    <DashboardsClient
      features={features}
      steps={steps}
      kpis={kpis}
      presets={presets}
      integrations={integrations}
      interactions={interactions}
      faqs={faqs}
    />
  );
}
