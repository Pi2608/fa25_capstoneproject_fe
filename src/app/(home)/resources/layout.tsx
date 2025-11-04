import type { ReactNode } from "react";
import { ImosBg, RevealOnScroll } from "@/components/common";
import { Footer } from "@/components/layout";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-gray-900 dark:text-white">
      <ImosBg />
      <RevealOnScroll />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 -z-10
                   bg-[linear-gradient(to_bottom,rgba(255,255,255,0.85),transparent)]
                   dark:bg-[linear-gradient(to_bottom,rgba(7,11,11,0.65),transparent)]"
      />

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
