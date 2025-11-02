"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/profile/settings/members", label: "Members" },
  { href: "/profile/settings/usage", label: "Usage" },
  { href: "/profile/settings/billing", label: "Billing" },
  { href: "/profile/settings/developers", label: "Developers" },
  { href: "/profile/settings/workspace", label: "Workspace" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-white/10">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="group relative -mb-px px-1 pb-3 text-sm"
            >
              <span
                className={
                  active
                    ? "font-semibold text-emerald-700 dark:text-emerald-300"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white"
                }
              >
                {t.label}
              </span>

              <span
                aria-hidden
                className={
                  active
                    ? "absolute left-0 -bottom-[1px] h-0.5 w-full rounded-full bg-emerald-600 dark:bg-emerald-400"
                    : "absolute left-0 -bottom-[1px] h-0.5 w-0 rounded-full bg-transparent transition-all duration-200 group-hover:w-full group-hover:bg-zinc-300/70 dark:group-hover:bg-white/30"
                }
              />
            </Link>
          );
        })}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}
