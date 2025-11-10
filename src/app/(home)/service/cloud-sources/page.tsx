import type { Metadata } from "next";
import CloudSourcesClient from "./CloudSourcesClient";

export const metadata: Metadata = {
  title: "Cloud Sources — IMOS",
  description:
    "Connect PostGIS, GeoServer, S3/MinIO, Google Drive, OGC/ArcGIS and HTTPS sources. Stream live or schedule sync with caching & webhooks.",
};

export default function CloudSourcesPage() {
  return <CloudSourcesClient />;
}
