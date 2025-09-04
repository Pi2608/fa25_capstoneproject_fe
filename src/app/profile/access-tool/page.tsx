"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await getUserAccessTools();
      setTools(data);
    } catch (err) {
      setError(safeMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="text-zinc-100 max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Access Tools</h1>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-zinc-800/60 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && tools.length === 0 && (
        <p className="text-sm text-zinc-400">No access tools granted yet.</p>
      )}

      <ul className="mt-6 space-y-4">
        {tools.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 hover:bg-zinc-800/60 transition"
          >
            <div className="flex items-start gap-4">
              {t.iconUrl ? (
                <Image
                  src={t.iconUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md bg-zinc-800/70 p-1 object-contain"
                  unoptimized
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-zinc-800/50" />
              )}

              <div className="flex-1">
                <div className="text-lg font-semibold text-white">{t.name}</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {(t.description && String(t.description)) || "No description"}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 border-t border-white/5 pt-2">
                  <span className={t.isActive ? "text-emerald-400" : "text-red-400"}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-right">
                    Expires:{" "}
                    {/^0001-01-01/.test(t.expiredAt)
                      ? "No expiry"
                      : new Date(t.expiredAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
