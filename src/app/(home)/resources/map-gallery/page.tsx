import type { Metadata } from "next";
import Link from "next/link";
import GalleryClient, { MapItem } from "./GalleryClient";
import { getPublishedMaps, type MapGallerySummaryResponse } from "@/lib/api-map-gallery";

export const metadata: Metadata = {
  title: "Map Gallery — IMOS",
  description:
    "Trình diễn bản đồ cộng đồng được xây dựng bằng IMOS. Duyệt, tìm hiểu và sao chép các mẫu.",
};

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z" />
    </svg>
  );
}

function mapApiResponseToMapItem(response: MapGallerySummaryResponse): MapItem {
  return {
    id: response.id,
    title: response.mapName,
    author: response.authorName || "Unknown",
    tags: response.tags || [],
    views: response.viewCount || 0,
    likes: response.likeCount || 0,
    updated: response.publishedAt || response.createdAt,
    href: `/maps/${response.mapId}`,
    duplicateHref: `/templates/duplicate?src=${response.mapId}`,
  };
}

export default async function MapGalleryPage() {
  let maps: MapItem[] = [];
  const apiMaps = await getPublishedMaps();
  maps = apiMaps.map(mapApiResponseToMapItem);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="text-sm tracking-wide text-emerald-300/90">Tài nguyên / Thư viện Bản đồ</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Bộ sưu tập Bản đồ Cộng đồng</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Khám phá các bản đồ nổi bật từ cộng đồng — giáo dục, môi trường, quy hoạch đô thị và hơn thế nữa.
            Mở bất kỳ bản đồ nào, tìm hiểu cách thiết lập hoặc nhân bản nó làm mẫu khởi đầu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="#gallery"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              Duyệt bản đồ
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              Xem mẫu
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section id="gallery" className="mt-10">
        <GalleryClient maps={maps} />
      </section>
    </main>
  );
}
