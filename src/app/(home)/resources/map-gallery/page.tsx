import type { Metadata } from "next";
import Link from "next/link";
import GalleryClient, { MapItem } from "./GalleryClient";

export const metadata: Metadata = {
  title: "Map Gallery — CustomMapOSM",
  description:
    "Showcase of community maps built with CustomMapOSM. Browse, learn, and duplicate templates.",
};

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z" />
    </svg>
  );
}

const MAPS: MapItem[] = [
  {
    id: "story-maps-history",
    title: "Vietnam History Story Map",
    author: "Lan Pham",
    tags: ["Education", "History", "Story Maps"],
    views: 2540,
    likes: 188,
    updated: "2025-08-21",
    href: "/maps/story-maps-history",
    duplicateHref: "/templates/duplicate?src=story-maps-history",
  },
  {
    id: "urban-green-space",
    title: "Urban Green Space Access",
    author: "Minh Tran",
    tags: ["Urban", "Environment"],
    views: 1320,
    likes: 96,
    updated: "2025-07-12",
    href: "/maps/urban-green-space",
    duplicateHref: "/templates/duplicate?src=urban-green-space",
  },
  {
    id: "disaster-response-flood",
    title: "Flood Response – Evacuation Zones",
    author: "Quang Nguyen",
    tags: ["Disaster", "Zones"],
    views: 3110,
    likes: 241,
    updated: "2025-06-30",
    href: "/maps/disaster-response-flood",
    duplicateHref: "/templates/duplicate?src=disaster-response-flood",
  },
];

export default function MapGalleryPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-zinc-900/60 p-8 shadow-xl ring-1 ring-emerald-500/10">
        <div className="relative z-10">
          <p className="text-sm tracking-wide text-emerald-300/90">Resources / Map Gallery</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Showcase of Community Maps</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Explore featured maps from the community—education, environment, urban planning, and more.
            Open any map, learn the setup, or duplicate it as a starting template.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="#gallery"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              Browse maps
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70"
            >
              View templates
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section id="gallery" className="mt-10">
        <GalleryClient maps={MAPS} />
      </section>
    </main>
  );
}
