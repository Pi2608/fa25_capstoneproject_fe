"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type BaseMap = "OSM" | "Satellite" | "Dark";

type PresetPayload = {
  templateId: string | null;
  blurb?: string;
  title?: string;
  preset: {
    name: string;
    description?: string;
    baseMapProvider?: BaseMap;
    initialLatitude: number;
    initialLongitude: number;
    initialZoom: number;
  } | null;
};

function NewTemplateInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [layerName, setLayerName] = useState("Lớp chính");
  const [category, setCategory] = useState("Chung");
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [base, setBase] = useState<BaseMap>("OSM");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [zoom, setZoom] = useState<number | undefined>(undefined);

  useEffect(() => {
    const raw = sp?.get("from");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as PresetPayload;
      if (parsed?.preset) {
        setName(parsed.preset.name ?? parsed.title ?? "");
        setDesc(parsed.preset.description ?? parsed.blurb ?? "");
        setBase(parsed.preset.baseMapProvider ?? "OSM");
        setLat(parsed.preset.initialLatitude);
        setLng(parsed.preset.initialLongitude);
        setZoom(parsed.preset.initialZoom);
      }
    } catch {
    }
  }, [sp]);

  const handleSubmit = async () => {
    if (!file) {
      setMessage("Vui lòng chọn tệp bản đồ.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("geoJsonFile", file);
      formData.append("templateName", name);
      formData.append("description", desc);
      formData.append("layerName", layerName);
      formData.append("category", category);
      formData.append("isPublic", String(isPublic));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/maps/create-template`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Request failed");
      }
      const json = (await res.json()) as { templateId: string };
      setMessage("Tạo mẫu thành công!");
      setTimeout(() => router.push(`/templates/${json.templateId}`), 900);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Tạo mẫu thất bại. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const onBaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBase(e.target.value as BaseMap);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };
  const toNumOrUndefined = (v: string) => (v === "" ? undefined : Number(v));

  const label = "text-sm text-zinc-700";
  const input =
    "w-full rounded-lg bg-white border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";
  const select =
    "w-full rounded-lg bg-white border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";
  const fileInput =
    "block w-full rounded-lg bg-white border border-zinc-300 text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-zinc-50 file:px-3 file:py-2 file:text-zinc-900 hover:file:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";
  const smallInput =
    "rounded-lg bg-white border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";

  return (
    <main className="p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold mb-5">Tạo template</h1>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-8">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4">
                <div>
                  <label className={label}>Tên template</label>
                  <input
                    className={input}
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="VD: Thu Duc - Wards"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Tên layer</label>
                    <input
                      className={input}
                      value={layerName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLayerName(e.target.value)}
                      placeholder="Layer 1"
                    />
                  </div>
                  <div>
                    <label className={label}>Danh mục</label>
                    <select
                      className={select}
                      value={category}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
                    >
                      <option value="Chung">Chung</option>
                      <option value="Hạ tầng">Hạ tầng</option>
                      <option value="Môi trường">Môi trường</option>
                      <option value="Dân số">Dân số</option>
                      <option value="Kinh tế">Kinh tế</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={label}>Mô tả</label>
                  <textarea
                    className={`${input} resize-y min-h-[110px]`}
                    value={desc}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
                    placeholder="Mô tả ngắn gọn"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="isPublic"
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/60"
                    checked={isPublic}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPublic(e.target.checked)}
                  />
                  <label htmlFor="isPublic" className={label}>
                    Công khai
                  </label>
                </div>

                <div>
                  <label className={label}>Tải tệp (GeoJSON, KML, GPX, CSV, XLSX, GeoTIFF)</label>
                  <input
                    type="file"
                    accept=".geojson,.kml,.gpx,.csv,.xlsx,.tiff,.tif"
                    onChange={onFileChange}
                    className={fileInput}
                  />
                  {file && (
                    <div className="mt-2 text-xs text-zinc-600">
                      {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-[1fr,1fr,1fr,1fr] gap-3">
                  <div>
                    <label className={label}>Bản đồ nền</label>
                    <select className={select} value={base} onChange={onBaseChange}>
                      <option value="OSM">OSM</option>
                      <option value="Satellite">Vệ tinh</option>
                      <option value="Dark">Tối</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Vĩ độ (Lat)</label>
                    <input
                      className={smallInput + " w-full"}
                      type="number"
                      step="0.0001"
                      value={lat ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLat(toNumOrUndefined(e.target.value))}
                      placeholder="21.0278"
                    />
                  </div>
                  <div>
                    <label className={label}>Kinh độ (Lng)</label>
                    <input
                      className={smallInput + " w-full"}
                      type="number"
                      step="0.0001"
                      value={lng ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLng(toNumOrUndefined(e.target.value))}
                      placeholder="105.8342"
                    />
                  </div>
                  <div>
                    <label className={label}>Thu phóng (Zoom)</label>
                    <input
                      className={smallInput + " w-full"}
                      type="number"
                      value={zoom ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZoom(toNumOrUndefined(e.target.value))}
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={busy}
                    className="w-full rounded-xl bg-emerald-500 text-white font-semibold px-4 py-2.5 hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {busy ? "Đang tạo..." : "Tạo template"}
                  </button>
                  {message && <div className="mt-3 text-sm text-zinc-700">{message}</div>}
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold mb-2">Mẹo</div>
                <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
                  <li>Ưu tiên dùng GeoJSON</li>
                  <li>Kích thước tệp nên &lt; 10MB</li>
                  <li>Đặt tên layer ngắn gọn, dễ hiểu</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold mb-2">Định dạng được hỗ trợ</div>
                <div className="text-sm text-zinc-700">.geojson, .kml, .gpx, .csv, .xlsx, .tif, .tiff</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-900">Đang tải...</div>}>
      <NewTemplateInner />
    </Suspense>
  );
}
