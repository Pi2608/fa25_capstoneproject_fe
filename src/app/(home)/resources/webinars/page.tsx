import type { Metadata } from "next";
import WebinarsClient from "../webinars/WebinarsClient";

export const metadata: Metadata = {
  title: "Webinars — IMOS",
  description:
    "Live & on-demand webinars about building maps, data layers, dashboards, and classroom story maps with IMOS.",
};

export default function WebinarsPage() {
  return <WebinarsClient />;
}
