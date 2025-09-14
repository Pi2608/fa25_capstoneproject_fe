import type { Metadata } from "next";
export const metadata: Metadata = { title: "Webinars — CustomMapOSM" };

export default function WebinarsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <h1 className="text-3xl font-semibold">Webinars</h1>
      <p className="mt-2 text-zinc-400">Live & on-demand sessions.</p>
    </main>
  );
}
