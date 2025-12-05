import type { Metadata } from "next";
import Link from "next/link";
import GalleryClient from "./GalleryClient";
import { MapGallerySummaryResponse } from "@/lib/api-map-gallery";

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

const MAPS: MapGallerySummaryResponse[] = [
  {
    id: "story-maps-history",
    mapId: "story-maps-history",
    mapName: "Vietnam History Story Map",
    description: "A story map of Vietnam's history",
    previewImage: "/images/story-maps-history.png",
    category: "education",
    tags: ["Education", "History", "Story Maps"],
    authorName: "Lan Pham",
    status: "approved",
    isFeatured: true,
    viewCount: 2540,
    likeCount: 188,
    createdAt: "2025-08-21",
    publishedAt: "2025-08-21",
  },
  {
    id: "urban-green-space",
    mapId: "urban-green-space",
    mapName: "Urban Green Space Access",
    description: "A map of urban green space access",
    previewImage: "/images/urban-green-space.png",
    category: "education",
    tags: ["Urban", "Environment"],
    authorName: "Minh Tran",
    status: "approved",
    isFeatured: true,
    viewCount: 1320,
    likeCount: 96,
    createdAt: "2025-07-12",
    publishedAt: "2025-07-12",
  },
  {
    id: "disaster-response-flood",
    mapId: "disaster-response-flood",
    mapName: "Flood Response – Evacuation Zones",
    description: "A map of flood response evacuation zones",
    previewImage: "/images/disaster-response-flood.png",
    category: "education",
    tags: ["Disaster", "Zones"],
    authorName: "Quang Nguyen",
    status: "approved",
    isFeatured: true,
    viewCount: 3110,
    likeCount: 241,
    createdAt: "2025-06-30",
    publishedAt: "2025-06-30",
  },
];

export default function MapGalleryPage() {
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
        <GalleryClient />
      </section>
    </main>
  );
}