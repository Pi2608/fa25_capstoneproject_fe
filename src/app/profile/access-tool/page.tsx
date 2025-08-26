"use client";

import { useEffect, useState } from "react";
import { getUserAccessTools, type UserAccessTool } from "@/lib/api";

export default function AccessToolPage() {
  const [tools, setTools] = useState<UserAccessTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getUserAccessTools();
        setTools(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load access tools");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Access Tools</h1>
        <p className="text-zinc-400 text-sm">All tools you can use in your workspace.</p>
      </div>

      {loading && <p className="text-sm text-zinc-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <li
            key={tool.id}
            className="bg-zinc-900 border border-white/10 rounded-xl p-5 shadow-sm hover:border-emerald-500 transition"
          >
            <div className="text-white font-semibold text-lg">{tool.name}</div>
            {tool.description && (
              <p className="text-sm text-zinc-400 mt-1">{tool.description}</p>
            )}
          </li>
        ))}
      </ul>

      {!loading && tools.length === 0 && (
        <p className="text-sm text-zinc-400 italic">No access tools granted yet.</p>
      )}
    </div>
  );
}
