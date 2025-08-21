"use client";

import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.18),transparent)] bg-gradient-to-b from-zinc-950 via-emerald-950/30 to-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="w-64 bg-zinc-950/70 border-r border-white/10 p-6 flex flex-col justify-between">
          <div>
            <div className="text-2xl font-bold text-white mb-8">CustomMapOSM</div>
            <nav className="space-y-4 text-sm text-zinc-300">
              <div className="space-y-2">
                <Link href="#" className="block text-emerald-400 font-medium">
                  Recents
                </Link>
                <Link href="#" className="block hover:text-white">
                  Drafts
                </Link>
                <Link href="#" className="block hover:text-white">
                  Settings
                </Link>
                <Link href="#" className="block hover:text-white">
                  Invite members
                </Link>
                <Link href="#" className="block hover:text-white">
                  Help
                </Link>
              </div>
              <div className="mt-8">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                  Projects
                </div>
                <Link href="#" className="text-sm text-emerald-400 hover:underline">
                  + Create project
                </Link>
              </div>
            </nav>
          </div>

          <div className="text-xs text-zinc-500 mt-6">
            You’re on CustomMapOSM’s Free plan
            <Link
              href="#"
              className="mt-2 block rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-zinc-950 text-center hover:bg-emerald-400"
            >
              Select plan
            </Link>
            <Link
              href="#"
              className="mt-2 block text-center text-xs text-emerald-300 hover:underline"
            >
              Talk to Sales
            </Link>
          </div>
        </aside>

        <section className="flex-1 p-10 overflow-auto">
          <h1 className="text-3xl font-semibold mb-2">Welcome to CustomMapOSM!</h1>
          <p className="text-zinc-400 mb-8">Here are a few videos to help get you started.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {["Getting started", "Uploading your data", "Styling your data", "Easily share maps"].map((title, index) => (
              <div
                key={index}
                className="h-36 rounded-xl bg-zinc-800/50 border border-white/10 flex items-center justify-center text-zinc-500 text-sm font-medium"
              >
                {title}
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold mt-12 mb-4">Your maps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 shadow-md"
              >
                <div className="aspect-[16/10] rounded-t-xl bg-[linear-gradient(140deg,rgba(16,185,129,0.22),transparent)]" />
                <div className="p-4">
                  <div className="text-sm font-medium text-white mb-1">
                    Example: Project #{i + 1}
                  </div>
                  <div className="text-xs text-zinc-400">Last viewed {i + 1} days ago</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}