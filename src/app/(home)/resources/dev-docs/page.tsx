import type { Metadata } from "next";
import DevDocsClient from "./DevDocsClient";

export const metadata: Metadata = {
  title: "Developer Docs — IMOS",
  description: "APIs, SDKs, and integration guides for IMOS.",
};

export default function DevDocsPage() {
  return <DevDocsClient />;
}
