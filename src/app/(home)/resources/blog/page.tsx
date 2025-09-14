import type { Metadata } from "next";
export const metadata: Metadata = { title: "Blog — CustomMapOSM" };

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-zinc-100">
      <h1 className="text-3xl font-semibold">Blog</h1>
      <p className="mt-2 text-zinc-400">Product updates and stories.</p>
    </main>
  );
}
