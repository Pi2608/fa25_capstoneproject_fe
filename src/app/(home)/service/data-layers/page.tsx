import type { Metadata } from "next";
import DataLayersClient from "./DataLayersClient";

export const metadata: Metadata = {
  title: "Data Layers — IMOS",
  description:
    "Bring vector & raster from files, services, and databases. Style with rules, expressions, and legends — optimized for speed.",
};

export default function DataLayersPage() {
  return <DataLayersClient />;
}
