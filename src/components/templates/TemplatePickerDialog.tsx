"use client";

import { useEffect, useState, useCallback } from "react";
import TemplateCard from "./TemplateCard";
import { apiFetch } from "@/lib/api";

type Template = {
  templateId: string;
  templateName: string;
  description?: string;
  previewImage?: string | null;
  category?: string;
};

type CreateFromTemplateRes = { mapId: string };

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
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Template[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setErr(null);
      try {
        const res = await apiFetch<{ templates: Template[] }>("/maps/templates", {
          method: "GET",
        });
        setList(res?.templates ?? []);
      } catch (err: unknown) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? (err as ApiError).message
            : "Không tải được danh sách template";
        setErr(msg ?? "Không tải được danh sách template");
      }
    })();
  }, [open]);

  const useTemplate = useCallback(
    async (templateId: string) => {
      setLoading(true);
      setErr(null);
      try {
        const body = {
          templateId,
          customName: mapName?.trim() || "Untitled Map",
          customDescription: "",
          isPublic,
        };
        const res = await apiFetch<CreateFromTemplateRes>("/maps/from-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        onDone(res.mapId);
      } catch (err: unknown) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? (err as ApiError).message
            : "Tạo map từ template thất bại";
        setErr(msg ?? "Tạo map từ template thất bại");
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
          <div className="text-lg font-semibold">Chọn template</div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"
          >
            Đóng
          </button>
        </div>

        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}

        {list.length === 0 ? (
          <div className="text-sm text-white/70">
            Chưa có template nào. Bạn có thể tạo ở trang{" "}
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
