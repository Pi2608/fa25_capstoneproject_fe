"use client";

import { useState } from "react";
import { createMapTemplateFromGeoJson } from "@/lib/api";

interface ApiError {
  message?: string;
}

export default function TemplateForm() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("Sample Template");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit() {
    if (!file) {
      setMsg("Chọn file .geojson trước");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await createMapTemplateFromGeoJson({
        geoJsonFile: file,
        templateName: name,
        description: "",
        layerName: "Layer 1",
        category: "General",
        isPublic: true,
      });
      setMsg(`OK. TemplateId: ${res?.templateId || "(xem response)"}`);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? (err as ApiError).message
          : "Tạo template thất bại";
      setMsg(msg ?? "Tạo template thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl ring-1 ring-white/10 p-4 bg-zinc-900/50 flex flex-col gap-3">
      <input
        className="px-3 py-2 rounded bg-white text-black"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên template"
      />
      <input
        type="file"
        accept=".geojson,application/json"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        disabled={loading}
        onClick={handleSubmit}
        className="rounded-lg px-3 py-2 bg-emerald-500 text-zinc-950 font-medium disabled:opacity-60"
      >
        {loading ? "Đang tạo…" : "Tạo template từ GeoJSON"}
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
