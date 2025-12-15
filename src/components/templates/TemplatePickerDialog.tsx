"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import TemplateCard from "./TemplateCard";
import { getMapTemplates, createMapFromTemplate, type MapTemplate } from "@/lib/api-maps";


interface ApiError {
  message?: string;
}

export default function TemplatePickerDialog({
  open,
  onClose,
  onDone,
  mapName,
  isPublic = false,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (newMapId: string) => void;
  mapName?: string;
  isPublic?: boolean;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MapTemplate[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setErr(null);
      try {
        const templates = await getMapTemplates();
        setList(templates ?? []);
      } catch (err: unknown) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? (err as ApiError).message
            : t("templates", "picker_error_load");
        setErr(msg ?? t("templates", "picker_error_load"));
      }
    })();
  }, [open]);

  const useTemplate = useCallback(
    async (templateId: string) => {
      setLoading(true);
      setErr(null);
      try {
        const res = await createMapFromTemplate({
          templateId,
          customName: mapName?.trim() || "Untitled Map",
          customDescription: "",
          isPublic,
          customInitialLatitude: undefined,
          customInitialLongitude: undefined,
          customInitialZoom: undefined,
          workspaceId: null,
        });
        onDone(res.mapId);
      } catch (err: unknown) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? (err as ApiError).message
            : t("templates", "picker_error_create");
        setErr(msg ?? t("templates", "picker_error_create"));
      } finally {
        setLoading(false);
      }
    },
    [mapName, isPublic, onDone]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-zinc-950 rounded-2xl ring-1 ring-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">{t("templates", "picker_title")}</div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"
          >
            {t("templates", "picker_close_btn")}
          </button>
        </div>

        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

        {list.length === 0 ? (
          <div className="text-sm text-white/70">
            {t("templates", "picker_empty_title")}. {t("templates", "picker_empty_desc")}{" "}
            <code className="px-1 py-0.5 bg-zinc-800 rounded">/templates/new</code>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((t) => (
              <TemplateCard
                key={t.templateId}
                t={t}
                onUse={useTemplate}
                disabled={loading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
