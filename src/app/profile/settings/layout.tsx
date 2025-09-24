"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile/settings/members", label: "Members" },
  { href: "/profile/settings/usage", label: "Usage" },
  { href: "/profile/settings/billing", label: "Billing" },
  { href: "/profile/settings/developers", label: "Developers" },
  { href: "/profile/settings/workspace", label: "Workspace" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-6 border-b border-white/10">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                "relative pb-2 px-1 text-sm transition-colors",
                active
                  ? "text-white font-semibold border-b-2 border-emerald-400"
                  : "text-zinc-400 hover:text-white",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-2">{children}</div>
    </div>
  );
}
