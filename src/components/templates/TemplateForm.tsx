"use client";

import { createMapTemplateFromGeoJson } from "@/lib/api-maps";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface ApiError {
  message?: string;
}

export default function TemplateForm() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("Sample Template");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit() {
    if (!file) {
      setMsg(t("templates", "form_choose_file"));
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
          : t("templates", "form_error_create");
      setMsg(msg ?? t("templates", "form_error_create"));
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
        placeholder={t("templates", "form_placeholder_name")}
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
        {loading ? t("templates", "form_button_creating") : t("templates", "form_button_create")}
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
