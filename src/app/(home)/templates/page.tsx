// app/templates/page.tsx
import Link from "next/link";
import { getMapTemplates } from "@/lib/api";

export default async function TemplatesPage() {
  const templates = await getMapTemplates();

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 text-white">
      <h1 className="text-3xl font-bold mb-6">Danh sách mẫu</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {templates.map(t => (
          <Link
            key={t.templateId}
            href={`/templates/${t.templateId}`}
            className="rounded-lg bg-white/10 p-6 hover:bg-white/20 transition"
          >
            <h2 className="font-semibold text-lg">{t.templateName}</h2>
            <p className="text-sm text-white/70 mt-2 line-clamp-2">{t.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
