"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";

const NAV = [
  { label: "Service", href: "/service" },
  { label: "Tutorial", href: "/tutorial" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Community", href: "/community" },
] as const;

export default function Header() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/10 shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-400 shadow" />
            <span className="text-base font-semibold tracking-tight text-white">
              CustomMapOSM
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="hover:text-white transition"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {!isLoggedIn ? (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow hover:bg-emerald-400 transition"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/profile"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow hover:bg-emerald-400 transition"
                >
                  Profile
                </Link>
                <button
                  onClick={onLogout}
                  className="rounded-lg px-3 py-2 text-sm text-white/80 hover:text-red-400"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
