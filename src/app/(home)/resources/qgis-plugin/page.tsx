import type { Metadata } from "next";
export const metadata: Metadata = { title: "QGIS Plugin — CustomMapOSM" };

export default function QgisPluginPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <h1 className="text-3xl font-semibold">QGIS Plugin</h1>
      <p className="mt-2 text-zinc-400">Sync QGIS projects to the cloud.</p>
    </main>
  );
}
