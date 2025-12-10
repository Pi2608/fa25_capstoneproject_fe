"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";

type Tab = { href: string; i18nKey: string };

const TABS: Tab[] = [
  { href: "/profile/settings/members",     i18nKey: "tabs_members" },
  { href: "/profile/settings/my-exports",  i18nKey: "tabs_my_exports" },
  { href: "/profile/settings/usage",       i18nKey: "tabs_usage" },
  { href: "/profile/settings/plans",       i18nKey: "tabs_plans" },
  { href: "/profile/settings/billing",     i18nKey: "tabs_billing" },
  { href: "/profile/settings/developers",  i18nKey: "tabs_developers" },
  { href: "/profile/settings/workspace",   i18nKey: "tabs_workspace" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname() || "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-white/10">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
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
                {tab.label || (tab.i18nKey ? t("settings", tab.i18nKey) : "")}
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
