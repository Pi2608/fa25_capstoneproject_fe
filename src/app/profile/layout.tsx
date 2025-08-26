"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const SidebarLink = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname();
  const active = pathname === href;
  const router = useRouter();


  return (
    <Link
      href={href}
      className={[
        "block px-3 py-2 text-sm rounded-lg transition-colors",
        active
          ? "text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-400/30"
          : "text-zinc-300 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {label}
    </Link>
  );
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen text-zinc-100 bg-[#0a0c0b] bg-gradient-to-b from-[#0a0c0b] via-emerald-900/10 to-[#0a0c0b]">
      <div className="flex min-h-screen">
        <aside className="w-72 hidden md:flex md:flex-col justify-between bg-zinc-900/60 backdrop-blur-sm border-r border-white/10 p-6">
          <div>
            {/* <div className="text-2xl font-bold mb-8">
              <Link
                href="/"
                className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200 bg-clip-text text-transparent hover:underline"
              >
                CustomMapOSM
              </Link>
            </div> */}

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
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
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
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
              className="block w-full text-center text-sm font-medium rounded-lg px-4 py-2 bg-red-500/90 hover:bg-red-400 transition-colors"
            >
              Logout
            </Link>
          </div>
        </aside>

        <header className="md:hidden w-full sticky top-0 z-20 bg-zinc-900/70 backdrop-blur-sm border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="text-lg font-semibold">
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-200 bg-clip-text text-transparent">
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
