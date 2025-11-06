"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const DANH_SACH_TAB = [
  { href: "/profile/settings/members", label: "Thành viên" },
  { href: "/profile/settings/usage", label: "Sử dụng" },
  { href: "/profile/settings/plans", label: "Gói" },
  { href: "/profile/settings/billing", label: "Thanh toán" },
  { href: "/profile/settings/developers", label: "Nhà phát triển" },
  { href: "/profile/settings/workspace", label: "Workspace" },
];

export default function BoCucCaiDat({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const laDangChon = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-white/10">
        {DANH_SACH_TAB.map((tab) => {
          const active = laDangChon(tab.href);
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
                {tab.label}
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
