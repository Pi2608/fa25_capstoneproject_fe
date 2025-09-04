// app/templates/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMapTemplateWithDetails } from "@/lib/api";

export default async function TemplateDetail({ params }: { params: { id: string } }) {
  const tpl = await getMapTemplateWithDetails(params.id).catch(() => null);
  if (!tpl) return notFound();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 text-white">
      <h1 className="text-3xl font-bold">{tpl.templateName}</h1>
      {tpl.description && <p className="mt-2 text-white/70">{tpl.description}</p>}

      {tpl.layers?.length ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Các lớp trong mẫu</h2>
          <ul className="space-y-2">
            {tpl.layers.map(l => (
              <li key={l.layerId} className="px-4 py-2 bg-white/10 rounded-md">
                {l.layerName} {l.geometryType ? `(${l.geometryType})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-white/70">Mẫu này chưa có lớp nào.</p>
      )}
    </main>
  );
}
