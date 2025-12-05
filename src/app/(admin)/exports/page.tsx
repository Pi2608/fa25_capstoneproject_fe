"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string;
  fileName: string;
  kind: "PDF" | "PNG" | "GeoJSON" | "CSV";
  size: string;
  owner: string;
  createdAt: string;
  status: "Completed" | "Processing" | "Failed";
};

const seed: Row[] = [
  { id: "e1", fileName: "map-overview.pdf", kind: "PDF", size: "1.2 MB", owner: "admin", createdAt: "2025-09-20 09:12", status: "Completed" },
  { id: "e2", fileName: "districts.geojson", kind: "GeoJSON", size: "5.8 MB", owner: "duy.ng", createdAt: "2025-09-20 08:22", status: "Processing" },
  { id: "e3", fileName: "heatmap.png", kind: "PNG", size: "820 KB", owner: "mai.ph", createdAt: "2025-09-19 17:41", status: "Completed" },
  { id: "e4", fileName: "poi-export.csv", kind: "CSV", size: "342 KB", owner: "linh.tr", createdAt: "2025-09-19 10:03", status: "Failed" },
  { id: "e5", fileName: "ward-boundary.geojson", kind: "GeoJSON", size: "3.4 MB", owner: "system", createdAt: "2025-09-18 22:11", status: "Completed" },
];

export default function ExportsPage() {
  const [rows, setRows] = useState<Row[]>(seed);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | Row["status"]>("All");
  const [kind, setKind] = useState<"All" | Row["kind"]>("All");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okQ = q
        ? r.fileName.toLowerCase().includes(q.toLowerCase()) ||
          r.owner.toLowerCase().includes(q.toLowerCase())
        : true;
      const okS = status === "All" ? true : r.status === status;
      const okK = kind === "All" ? true : r.kind === kind;
      return okQ && okS && okK;
    });
  }, [rows, q, status, kind]);

  const allChecked = filtered.length > 0 && filtered.every((r) => checked[r.id]);

  const handleKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Row["kind"] | "All";
    setKind(value);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Row["status"] | "All";
    setStatus(value);
  };

  return (
    <main className="p-5">
      <section className="bg-zinc-900/50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3>Exports</h3>
          <div className="flex items-center gap-2">
            <input
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
              placeholder="Search file or user…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors" value={kind} onChange={handleKindChange}>
              <option>All</option>
              <option>PDF</option>
              <option>PNG</option>
              <option>GeoJSON</option>
              <option>CSV</option>
            </select>
            <select className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors" value={status} onChange={handleStatusChange}>
              <option>All</option>
              <option>Completed</option>
              <option>Processing</option>
              <option>Failed</option>
            </select>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={!Object.values(checked).some(Boolean)}
              onClick={() => {
                setRows((prev) => prev.filter((r) => !checked[r.id]));
                setChecked({});
              }}
            >
              Delete selected
            </button>
          </div>
        </div>

          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      const v = e.target.checked;
                      const next = { ...checked };
                      filtered.forEach((r) => (next[r.id] = v));
                      setChecked(next);
                    }}
                  />
                </th>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>User</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!checked[r.id]}
                      onChange={(e) =>
                        setChecked((p) => ({ ...p, [r.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="font-medium">{r.fileName}</td>
                  <td>{r.kind}</td>
                  <td>{r.size}</td>
                  <td>{r.owner}</td>
                  <td>{r.createdAt}</td>
                  <td>
                    {r.status === "Completed" && (
                      <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-500">Completed</span>
                    )}
                    {r.status === "Processing" && (
                      <span className="px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500">Processing</span>
                    )}
                    {r.status === "Failed" && (
                      <span
                        className="px-2 py-1 rounded-md bg-red-500/10 text-red-500"
                        style={{
                          color: "#ef4444",
                          background:
                            "color-mix(in srgb,#ef4444 14%, transparent)",
                        }}
                      >
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="flex items-center gap-2">
                    <button className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors">View</button>
                    {r.status === "Completed" && (
                      <a className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors" href="#" download>
                        Download
                      </a>
                    )}
                    <button
                      className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
                      onClick={() =>
                        setRows((prev) => prev.filter((x) => x.id !== r.id))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[--muted]">
                    No exports found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors">Prev</button>
          <div className="flex items-center gap-2">
            <b>1</b>
            <span>2</span>
            <span>3</span>…<span>10</span>
          </div>
          <button className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors">Next</button>
        </div>
      </section>
    </main>
  );
}
