import type { Metadata } from "next";
import QgisPluginClient from "../qgis-plugin/QgisPluginClient";

export const metadata: Metadata = {
  title: "QGIS Plugin — IMOS",
  description: "Sync QGIS projects and layers with IMOS. Install the plugin, sign in, and publish maps to the cloud.",
};

export default function QgisPluginPage() {
  return <QgisPluginClient />;
}
