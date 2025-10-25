import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community — IMOS",
  description: "Join the IMOS community.",
};

export default function CommunityPage() {
  return (
    <main className="relative mx-auto max-w-7xl px-4 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.15),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.1),transparent)]" />
      <h1 className="text-3xl font-semibold mb-2">Community</h1>
      <p className="text-zinc-400">
        Welcome to the community. Updates, discussions, and resources coming soon.
      </p>
    </main>
  );
}
