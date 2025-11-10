import type { Metadata } from "next";
import MapBuilderClient from "./MapBuilderClient";

export const metadata: Metadata = {
  title: "Map Builder — IMOS",
  description:
    "Design interactive maps visually: draw, style, organize layers, and publish in minutes.",
};

export default function Page() {
  return <MapBuilderClient />;
}
