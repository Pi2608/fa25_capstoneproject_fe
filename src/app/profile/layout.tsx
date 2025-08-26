"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SidebarLink = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative block px-3 py-2 text-sm rounded-lg transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        active
          ? "text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-400/30"
          : "text-zinc-300 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded bg-emerald-400/80"
        />
      )}
      {label}
    </Link>
  );
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen text-zinc-100 bg-gradient-to-b from-[#0b0f0e] via-emerald-900/10 to-[#0b0f0e]">
      <div className="flex min-h-screen">
        <aside className="w-72 hidden md:flex md:flex-col justify-between border-r border-white/10 p-6 bg-gradient-to-b from-zinc-950/70 via-emerald-900/5 to-zinc-950/70 backdrop-blur">
          <div>
            {/* <div className="mb-8 flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-400/90 shadow" />
              <Link
                href="/"
                className="text-lg font-semibold tracking-tight hover:underline bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200 bg-clip-text text-transparent"
              >
                CustomMapOSM
              </Link>
            </div> */}

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300/70 mb-2">
                Your Profile
              </div>
              <div className="space-y-1">
                <SidebarLink href="/" label="Home" />
                <SidebarLink href="/profile" label="Personal Info" />
                <SidebarLink href="/profile/membership" label="Membership" />
                <SidebarLink href="/profile/access-tool" label="Access Tools" />
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300/70 mb-2">
                Other
              </div>
              <div className="space-y-1">
                <SidebarLink href="/profile/recents" label="Recents" />
                <SidebarLink href="/profile/drafts" label="Drafts" />
                <SidebarLink href="/profile/settings" label="Settings" />
                <SidebarLink href="/profile/invite" label="Invite Members" />
                <SidebarLink href="/profile/help" label="Help" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Link
              href="/login"
              className="block w-full text-center text-sm font-medium rounded-lg px-4 py-2 bg-red-500/90 hover:bg-red-400 ring-1 ring-transparent hover:ring-red-300/40 transition"
            >
              Logout
            </Link>
          </div>
        </aside>

        <header className="md:hidden w-full sticky top-0 z-20 bg-zinc-900/70 backdrop-blur-sm border-b border-emerald-400/20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-400/90 shadow" />
              <span className="text-lg font-semibold bg-gradient-to-r from-emerald-300 to-emerald-200 bg-clip-text text-transparent">
                CustomMapOSM
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <Link href="/" className="text-zinc-300 hover:text-white">
                Home
              </Link>
              <Link href="/profile" className="text-zinc-300 hover:text-white">
                Profile
              </Link>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto px-4 sm:px-8 lg:px-10 py-8 max-w-6xl mx-auto">
          {children}
        </section>
      </div>
    </main>
  );
}
