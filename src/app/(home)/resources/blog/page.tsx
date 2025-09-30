import type { Metadata } from "next";
import BlogClient from "./BlogClient";

export const metadata: Metadata = {
  title: "Blog — IMOS",
  description:
    "Friendly updates, practical tips, and real stories about building great maps with IMOS.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BlogPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  return <BlogClient searchParams={sp} />;
}
