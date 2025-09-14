"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative min-h-screen text-zinc-100">
      <header className="sticky top-0 z-40 bg-black/40 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="h-14 grid grid-cols-12 items-center gap-3">
            <div className="col-span-4 flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-400 shadow" />
                <span className="text-lg font-bold tracking-tight text-white">CustomMapOSM</span>
              </Link>
              <span className="ml-2 text-xs font-semibold tracking-wide text-zinc-300/80">RESOURCES</span>
            </div>
            <div className="col-span-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask or search..."
                  className="w-full rounded-lg bg-zinc-900/70 ring-1 ring-white/10 px-4 py-2.5 pr-24 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                  Ctrl K
                </span>
              </div>
            </div>
            <nav className="col-span-4 justify-end hidden md:flex items-center gap-5 text-sm">
              <Link href="/register" className="text-zinc-300 hover:text-white">Sign up</Link>
              <Link href="/resources/developer-docs" className="text-zinc-300 hover:text-white">Developer Docs</Link>
              <Link href="/contact" className="text-zinc-300 hover:text-white">Contact</Link>
              <Link href="/social" className="text-zinc-300 hover:text-white">Social</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.08),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {children}
      </div>
    </main>
  );
}
