import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customers — CustomMapOSM" };

export default function CustomersPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <h1 className="text-3xl font-semibold">Customers</h1>
      <p className="mt-2 text-zinc-400">Stories from teams using CustomMapOSM.</p>
    </main>
  );
}
