"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMapTemplateFromGeoJson } from "@/lib/api";

interface ApiError {
  message?: string;
}

export default function CreateTemplatePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [layerName, setLayerName] = useState("Layer 1");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <main className="max-w-2xl mx-auto p-6 text-white">
      <h1 className="text-xl font-semibold mb-4">Tạo template</h1>

      <div className="space-y-4">
        <input
          type="file"
          accept=".geojson,.json"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !templateName) {
              const base = f.name.replace(/\.(geo)?json$/i, "");
              setTemplateName(base);
              if (layerName === "Layer 1") setLayerName(base);
            }
          }}
          className="block"
        />

        <div>
          <label className="block text-sm text-white/70 mb-1">Tên template</label>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white text-black"
            placeholder="VD: Thu Duc - Wards"
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">Tên layer</label>
          <input
            value={layerName}
            onChange={(e) => setLayerName(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white text-black"
            placeholder="VD: Wards"
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white text-black"
            rows={3}
          />
        </div>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Công khai
        </label>

        <div className="flex gap-2">
          <button
            disabled={!file || !templateName || busy}
            onClick={async () => {
              try {
                setBusy(true);
                await createMapTemplateFromGeoJson({
                  geoJsonFile: file!, 
                  templateName,
                  description,
                  layerName,
                  category: "General",
                  isPublic,
                });
                alert("Tạo template thành công!");
                router.push("/maps/new?pickTemplate=1");
              } catch (err: unknown) {
                const msg =
                  typeof err === "object" && err !== null && "message" in err
                    ? (err as ApiError).message
                    : "Lỗi tạo template";
                alert(msg);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl px-4 py-2 bg-emerald-500 text-black font-semibold disabled:opacity-60"
          >
            {busy ? "Đang tạo…" : "Tạo template"}
          </button>

          <button
            className="rounded-xl px-4 py-2 bg-zinc-800"
            onClick={() => router.back()}
          >
            Hủy
          </button>
        </div>
      </div>
    </main>
  );
}
