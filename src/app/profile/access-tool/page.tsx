"use client";

import { useEffect, useState } from "react";
import { getUserAccessTools, type UserAccessTool } from "@/lib/api";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Request failed";
}

export default function AccessToolsPage() {
  const [tools, setTools] = useState<UserAccessTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getUserAccessTools();
        if (alive) setTools(data);
      } catch (err: unknown) {
        if (alive) setError(safeMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="text-zinc-100">
      <h1 className="text-2xl font-semibold mb-4">Access Tools</h1>

      {loading && <p className="text-sm text-zinc-400">Loading…</p>}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && tools.length === 0 && (
        <p className="text-sm text-zinc-400">No access tools granted yet.</p>
      )}

      <ul className="mt-4 space-y-3">
        {tools.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-zinc-400">
                {t.description ?? "No description"} · expires {new Date(t.expiredAt).toLocaleDateString()}
              </div>
            </div>
            <div className={`text-xs ${t.isActive ? "text-emerald-400" : "text-zinc-400"}`}>
              {t.isActive ? "Active" : "Inactive"}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
