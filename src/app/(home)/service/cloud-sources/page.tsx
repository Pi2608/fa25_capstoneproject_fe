import type { Metadata } from "next";
import CloudSourcesClient from "./CloudSourcesClient";

export const metadata: Metadata = {
  title: "Cloud Sources — IMOS",
  description:
    "Connect PostGIS, GeoServer, S3/MinIO, Google Drive, OGC/ArcGIS and HTTPS sources. Stream live or schedule sync with caching & webhooks.",
};

export default function CloudSourcesPage() {
  const connectors = [
    { cat: "Databases", items: ["PostGIS", "PgBouncer", "Materialized views"] },
    { cat: "OGC / GIS", items: ["WMS", "WMTS", "WFS", "OGC API Features", "GeoServer"] },
    { cat: "Cloud storage", items: ["S3 / MinIO", "GCS", "Azure Blob", "MBTiles"] },
    { cat: "Drives & sheets", items: ["Google Drive", "Google Sheets", "CSV/GeoJSON URLs"] },
    { cat: "ArcGIS", items: ["Feature Service", "Tile Service"] },
    { cat: "Generic web", items: ["HTTPS tiles (XYZ/TMS)", "Signed URLs"] },
  ];

  const syncModes = [
    ["Live proxy", "Forward queries to the origin in real-time, with smart CDN caching and cache-busting on edits."],
    ["Schedule pulls", "Mirror data to IMOS on a cadence (minutely/hourly/daily). Delta-aware to save bandwidth."],
    ["Webhooks", "Trigger incremental refresh when upstream changes. Ideal for ETL pipelines & CI/CD."],
  ];

  const reliability = [
    ["Retries & backoff", "Auto-retries with jittered exponential backoff for flaky endpoints."],
    ["Health checks", "Background pings and fast-failover for primary/replica origins."],
    ["Cold → warm cache", "Seamless warmup as tiles/queries get popular; LRU eviction."],
    ["SLA monitoring", "Latency and error budgets surfaced to the dashboard."],
  ];

  const security = [
    "Row-level security (PostGIS)",
    "Signed URLs / pre-signed S3",
    "IP allowlist & private links",
    "OAuth 2.0 & API keys vault",
    "At-rest encryption",
    "Audit trail",
  ];

  return (
    <CloudSourcesClient
      connectors={connectors}
      syncModes={syncModes}
      reliability={reliability}
      security={security}
    />
  );
}
