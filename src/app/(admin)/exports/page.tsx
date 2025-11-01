"use client";

import { useMemo, useState } from "react";
import s from "../admin.module.css";

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
    <main className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Exports</h3>
          <div className={s.filters}>
            <input
              className={s.input}
              placeholder="Search file or user…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className={s.select} value={kind} onChange={handleKindChange}>
              <option>All</option>
              <option>PDF</option>
              <option>PNG</option>
              <option>GeoJSON</option>
              <option>CSV</option>
            </select>
            <select className={s.select} value={status} onChange={handleStatusChange}>
              <option>All</option>
              <option>Completed</option>
              <option>Processing</option>
              <option>Failed</option>
            </select>
            <button
              className={s.primary}
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

        <div className={s.tableWrap}>
          <table className={s.table}>
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
                      <span className={s.badgeSuccess}>Completed</span>
                    )}
                    {r.status === "Processing" && (
                      <span className={s.badgeWarn}>Processing</span>
                    )}
                    {r.status === "Failed" && (
                      <span
                        className={s.badgeWarn}
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
                  <td className={s.rowActions}>
                    <button className={s.linkBtn}>View</button>
                    {r.status === "Completed" && (
                      <a className={s.linkBtn} href="#" download>
                        Download
                      </a>
                    )}
                    <button
                      className={s.linkBtn}
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

        <div className={s.pagination}>
          <button className={s.pageBtn}>Prev</button>
          <div className={s.pageDots}>
            <b>1</b>
            <span>2</span>
            <span>3</span>…<span>10</span>
          </div>
          <button className={s.pageBtn}>Next</button>
        </div>
      </section>
    </main>
  );
}
