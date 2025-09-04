// app/templates/page.tsx
export const dynamic = "force-dynamic"; 
export const revalidate = 0;

import { getMapTemplates, type MapTemplate } from "@/lib/api";

export default async function TemplatesPage() {
  let templates: MapTemplate[] = [];
  try {
    templates = await getMapTemplates();
  } catch {
    templates = [];
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 text-white">
      <h1 className="text-3xl font-bold mb-6">Danh sách mẫu</h1>

      {templates.length === 0 ? (
        <div className="rounded-lg bg-white/5 p-6">
          <p className="text-white/80">
            Chưa có mẫu nào hoặc không tải được dữ liệu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {templates.map((t) => (
            <div
              key={t.templateId}
              className="rounded-lg bg-white/10 p-6 transition"
            >
              <h2 className="font-semibold text-lg">{t.templateName}</h2>
              <p className="text-sm text-white/70 mt-2 line-clamp-2">
                {t.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
