"use client";
type Template = {
  templateId: string;
  templateName: string;
  description?: string;
  previewImage?: string | null;
  category?: string;
};

export default function TemplateCard({
  t, onUse, disabled,
}: { t: Template; onUse: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-zinc-900/60 p-3 flex flex-col gap-2">
      <div className="aspect-video rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center">
        {t.previewImage ? (
          <img src={t.previewImage} alt={t.templateName} className="w-full h-full object-cover" />
        ) : (
          <div className="text-xs text-white/60">No preview</div>
        )}
      </div>
      <div className="text-sm font-semibold">{t.templateName}</div>
      <div className="text-xs text-white/60 line-clamp-2">{t.description || "—"}</div>
      <button
        disabled={disabled}
        onClick={() => onUse(t.templateId)}
        className="mt-1 rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        Dùng template này
      </button>
    </div>
  );
}
