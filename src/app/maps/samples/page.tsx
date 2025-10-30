"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMapFromTemplate, createMap } from "@/lib/api";
import { convertPresetToNewFormat } from "@/utils/mapApiHelpers";

type Sample = {
  key: string;
  title: string;
  author: string;
  lastViewed: string;
  blurb: string;
  templateId?: string;
  preset?: {
    name: string;
    description?: string;
    baseMapProvider?: "OSM" | "Satellite" | "Dark";
    initialLatitude: number;
    initialLongitude: number;
    initialZoom: number;
  };
};

const SAMPLES: Sample[] = [
  {
    key: "reservoir-precip",
    title: "Example: Reservoir Levels & Precipitation",
    author: "Yên Nhi Đặng",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Kết hợp lớp mực nước hồ chứa với mưa tích lũy để theo dõi hạn – ngập.",
    preset: {
      name: "Reservoir Levels & Precip",
      baseMapProvider: "OSM",
      initialLatitude: 15.95,
      initialLongitude: 107.8,
      initialZoom: 5,
    },
  },
  {
    key: "sandy-inundation",
    title: "Example: Hurricane Sandy Inundation Zone",
    author: "Yên Nhi Đặng",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Vùng ngập do bão lịch sử, minh họa các dải nguy cơ và tác động.",
    preset: {
      name: "Sandy Inundation Zone",
      baseMapProvider: "OSM",
      initialLatitude: 40.71,
      initialLongitude: -74.0,
      initialZoom: 10,
    },
  },
  {
    key: "bike-collisions",
    title: "Example: City of Toronto Bike Collisions",
    author: "Yên Nhi Đặng",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Điểm va chạm xe đạp theo thời gian/khu vực để phân tích an toàn.",
    preset: {
      name: "Toronto Bike Collisions",
      baseMapProvider: "OSM",
      initialLatitude: 43.65,
      initialLongitude: -79.38,
      initialZoom: 11,
    },
  },
  {
    key: "sales-territories",
    title: "Example: Sales Territories",
    author: "Yên Nhi Đặng",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Ranh giới lãnh thổ bán hàng, phân bổ khu vực và KPI căn bản.",
    preset: {
      name: "Sales Territories",
      baseMapProvider: "OSM",
      initialLatitude: 39.5,
      initialLongitude: -98.35,
      initialZoom: 4,
    },
  },
  {
    key: "getting-started",
    title: "Getting started with Felt",
    author: "Yên Nhi Đặng",
    lastViewed: "Last viewed 3 months ago",
    blurb: "Mẫu nhập môn: lớp điểm/khu vực mẫu, style cơ bản để bạn thử nhanh.",
    preset: {
      name: "Getting Started",
      baseMapProvider: "OSM",
      initialLatitude: 21.03,
      initialLongitude: 105.85,
      initialZoom: 11,
    },
  },
];

function Thumb({ k }: { k: string }) {
  const bg = useMemo(() => {
    const palette: Record<string, string> = {
      "reservoir-precip": "from-cyan-700 to-emerald-700",
      "sandy-inundation": "from-amber-600 to-rose-600",
      "bike-collisions": "from-fuchsia-700 to-indigo-700",
      "sales-territories": "from-emerald-700 to-teal-700",
      "getting-started": "from-zinc-700 to-zinc-800",
    };
    return palette[k] ?? "from-zinc-700 to-zinc-800";
  }, [k]);
  return (
    <div className={`h-40 w-full rounded-lg border border-white/10 bg-gradient-to-br ${bg} grid place-items-center`}>
      <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur-sm" />
    </div>
  );
}

export default function SamplesPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const createFromSample = async (s: Sample) => {
    setErr(null);
    setBusy(s.key);
    try {
      if (s.templateId) {
        const res = await createMapFromTemplate({
          templateId: s.templateId,
          customName: s.title?.trim() || "Bản đồ mới từ template",
          workspaceId: null,
        });

        router.push(`/maps/${res.mapId}`);
      } else if (s.preset) {
        const presetData = convertPresetToNewFormat(s.preset);
        const r = await createMap({
          name: s.preset.name,
          description: s.blurb,
          isPublic: false,
          ...presetData,
          workspaceId: null,
        });
        router.push(`/maps/${r.mapId}`);
      } else {
        router.push("/maps/new");
      }
    } catch (e) {
      setErr("Không thể tạo bản đồ. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 pb-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">Sample templates</h1>
        <Link
          href="/maps/new"
          className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
        >
          New map
        </Link>
      </div>

      {err && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200">{err}</div>}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SAMPLES.map((s) => (
          <li key={s.key} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <Thumb k={s.key} />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-zinc-400">{s.author}</div>
              </div>
            </div>
            <p className="mt-2 text-sm text-zinc-300 line-clamp-2">{s.blurb}</p>
            <div className="mt-2 text-xs text-zinc-400">{s.lastViewed}</div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => createFromSample(s)}
                disabled={busy === s.key}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-70"
              >
                {busy === s.key ? "Creating…" : "Use this template"}
              </button>
              <Link
                href={`/samples/${s.key}`}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10"
              >
                Preview
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
