import type { Metadata } from "next";
export const metadata: Metadata = { title: "Developer Docs — IMOS" };

export default function DevDocsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <h1 className="text-3xl font-semibold">Developer Docs</h1>
      <p className="mt-2 text-zinc-400">APIs, SDKs, and integration guides.</p>
    </main>
  );
}
