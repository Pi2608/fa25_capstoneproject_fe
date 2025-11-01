import Image from "next/image";
import Link from "next/link";

export default function TemplatesPage() {
  const templates = [
    { id: "1", name: "City Roads", thumb: "https://your-cdn.com/thumbs/city-roads.jpg" },
    { id: "2", name: "Rivers & Lakes", thumb: "https://your-cdn.com/thumbs/waters.jpg" },
  ];

  return (
    <main style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Templates</h1>
        <Link
          href="/templates/new"
          style={{ background: "#22c55e", color: "#0a0a0a", padding: "8px 12px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}
        >
          + Create template
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {templates.map(t => (
          <Link key={t.id} href={`/templates/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, overflow: "hidden" }}>
              <Image
                src={t.thumb}
                alt={t.name}
                width={400}
                height={220}
                style={{ width: "100%", height: "auto", display: "block" }}
                sizes="(max-width: 600px) 100vw, 400px"
              />
              <div style={{ padding: 10, fontWeight: 600 }}>{t.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
