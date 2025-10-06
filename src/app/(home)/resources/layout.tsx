import type { ReactNode } from "react";
import HomeHeader from "@/components/HomeHeader";

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen text-gray-900 dark:text-white transition-colors">
      <div className="absolute inset-0 -z-20 bg-white dark:bg-[#070b0b]" aria-hidden />
      <div
        className="absolute inset-0 -z-10
                   bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.18),transparent_60%)]
                   dark:bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10
                   bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)]
                   dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
        aria-hidden
      />

      <HomeHeader />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">{children}</div>
    </main>
  );
}
