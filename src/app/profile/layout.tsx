"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { getPlans, getMyMembership, type Plan } from "@/lib/api-membership";
import { getMyOrganizations, type MyOrganizationDto } from "@/lib/api-organizations";
import { getUnreadNotificationCount } from "@/lib/api-user";

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

const SidebarLink = ({
  href,
  label,
  right,
  match = "prefix",
}: {
  href: string;
  label: string;
  right?: ReactNode;
  match?: "exact" | "prefix";
}) => {
  const pathname = usePathname() || "";
  const active =
    match === "exact" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
        active
          ? "text-emerald-800 bg-emerald-100 ring-1 ring-emerald-300 dark:text-emerald-100 dark:bg-emerald-900/40 dark:ring-emerald-800"
          : "text-zinc-800 hover:text-emerald-700 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/5",
      ].join(" ")}
    >
      <span className="truncate">
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded bg-emerald-500"
          />
        )}
        {label}
      </span>
      {right}
    </Link>
  );
};

function Bell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3a6 6 0 00-6 6v2.586l-.707 1.414A1 1 0 006.172 14h11.656a1 1 0 00.879-1.5L18 11.586V9a6 6 0 00-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M9 18a3 3 0 006 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Sun({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-[100px] rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60" />;

  const isDark = (resolvedTheme ?? "light") === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Đổi chế độ sáng/tối"
      title={isDark ? "Chuyển sang nền sáng" : "Chuyển sang nền tối"}
      className="inline-flex items-center gap-2 h-8 px-3 text-xs rounded-lg border transition-colors bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:bg-zinc-900/40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900/60"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoggedIn } = useAuthStatus();

  const isFullScreenMap = /\/profile\/organizations\/[^/]+\/maps\/new\/?$/.test(pathname || "");

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<MyOrganizationDto[] | null>(null);
  const [orgsErr, setOrgsErr] = useState<string | null>(null);
  const [currentOrgMembership, setCurrentOrgMembership] = useState<MyMembership | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadPlans() {
      if (!isLoggedIn) {
        setPlanLabel(null);
        setPlanStatus(null);
        return null;
      }
      try {
        const ps = await getPlans();
        if (!alive) return null;
        setPlans(ps);
        return ps;
      } catch {
        setPlanLabel("Miễn phí");
        setPlanStatus("active");
        return null;
      }
    }

    async function loadOrgs(plansData?: Plan[] | null) {
      if (!isLoggedIn) {
        setOrgs(null);
        setOrgsErr(null);
        return;
      }
      try {
        const res = await getMyOrganizations();
        if (!alive) return;
        let items: MyOrganizationDto[] = [];
        if (
          typeof res === "object" &&
          res !== null &&
          Array.isArray((res as { organizations?: unknown }).organizations)
        ) {
          items = (res as { organizations: MyOrganizationDto[] }).organizations;
        } else if (Array.isArray(res)) {
          items = res as MyOrganizationDto[];
        }
        setOrgs(items);
        setOrgsErr(null);

        if (items.length > 0) {
          try {
            const membership = (await getMyMembership(items[0].orgId)) as MyMembership;
            if (!alive) return;
            setCurrentOrgMembership(membership);
            if (membership && plansData) {
              const found = plansData.find((p) => p.planId === membership.planId);
              if (found) {
                setPlanLabel(found.planName);
                setPlanStatus(membership.status ?? "active");
              }
            }
          } catch {
            if (plansData) {
              const free = plansData.find((p) => p.priceMonthly === 0);
              setPlanLabel(free?.planName ?? "Miễn phí");
              setPlanStatus("active");
            }
          }
        }
      } catch {
        if (!alive) return;
        setOrgsErr("Không thể tải danh sách tổ chức.");
        setOrgs([]);
      }
    }

    async function loadUnread() {
      if (!isLoggedIn) {
        setUnread(0);
        return;
      }
      try {
        const n = await getUnreadNotificationCount();
        if (!alive) return;
        setUnread(n || 0);
      } catch {
        if (!alive) return;
        setUnread(0);
      }
    }

    loadPlans().then((ps) => loadOrgs(ps));
    loadUnread();

    const onAuthChanged = () => {
      loadPlans().then((ps) => loadOrgs(ps));
      loadUnread();
    };
    const onOrgsChanged = () => loadOrgs(plans);
    const onNotifChanged = () => loadUnread();

    let timer: number | undefined;
    if (typeof window !== "undefined") {
      window.addEventListener("auth-changed", onAuthChanged);
      window.addEventListener("orgs-changed", onOrgsChanged as EventListener);
      window.addEventListener("notifications-changed", onNotifChanged as EventListener);
      timer = window.setInterval(loadUnread, 30000);
    }

    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-changed", onAuthChanged);
        window.removeEventListener("orgs-changed", onOrgsChanged as EventListener);
        window.removeEventListener("notifications-changed", onNotifChanged as EventListener);
        if (timer) clearInterval(timer);
      }
    };
  }, [isLoggedIn]);

  if (isFullScreenMap) {
    return (
      <main className="fixed inset-0 m-0 p-0 overflow-hidden bg-black">
        {children}
        <style jsx global>{`
          html,
          body {
            height: 100%;
            overflow: hidden;
          }
          .leaflet-container {
            width: 100%;
            height: 100%;
          }
        `}</style>
      </main>
    );
  }

  const pageBg =
    "min-h-screen text-zinc-900 dark:text-zinc-100 bg-gradient-to-b from-emerald-50 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]";
  const asideClass =
    "hidden lg:flex lg:flex-col justify-between w-64 fixed left-0 top-0 h-screen z-10 border-r border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-background/80 supports-[backdrop-filter]:dark:bg-background/60 dark:backdrop-blur";
  const headerClass =
    "lg:hidden w-full md:sticky md:top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-background/80 supports-[backdrop-filter]:dark:bg-background/60";

  return (
    <main className={pageBg}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className={asideClass}>
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-md bg-emerald-600 shadow" />
                <span className="text-lg font-semibold">IMOS</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-800 dark:text-emerald-300/70 mb-2">
                Chung
              </div>
              <div className="space-y-1">
                <SidebarLink href="/" label="Trang chủ" />
                <SidebarLink match="exact" href="/profile" label="Thông tin cá nhân" />
                <SidebarLink href="/profile/recents" label="Gần đây" />
                <SidebarLink href="/profile/drafts" label="Bản nháp" />
                <SidebarLink href="/profile/invite" label="Mời thành viên" />
                <SidebarLink
                  href="/profile/notifications"
                  label="Thông báo"
                  right={
                    unread > 0 ? (
                      <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 px-2 text-[11px] font-semibold dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-800">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null
                  }
                />
                <SidebarLink href="/profile/settings" label="Cài đặt" />
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-800 dark:text-emerald-300/70 mb-2">
                Tổ chức
              </div>
              <div className="space-y-1">
                <SidebarLink href="/register/organization" label="Tạo tổ chức" />
                {orgs === null && (
                  <>
                    <div className="h-8 rounded-md bg-zinc-100 dark:bg-white/5 animate-pulse" />
                    <div className="h-8 rounded-md bg-zinc-100 dark:bg-white/5 animate-pulse" />
                  </>
                )}
                {orgsErr && (
                  <div className="px-3 py-2 text-xs rounded-md border border-red-300 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                    {orgsErr}
                  </div>
                )}
                {orgs && !orgsErr && orgs.length === 0 && (
                  <div className="px-3 py-2 text-xs rounded-md border border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    Chưa có tổ chức nào. Hãy tạo tổ chức đầu tiên!
                  </div>
                )}
                {(orgs ?? []).slice(0, 5).map((o) => (
                  <SidebarLink key={o.orgId} href={`/profile/organizations/${o.orgId}`} label={o.orgName} />
                ))}
                {(orgs ?? []).length > 5 && <SidebarLink href="/organizations" label="Xem tất cả tổ chức" />}
                <SidebarLink href="/profile/help" label="Trợ giúp" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-white/10 space-y-3">
            {isLoggedIn && (
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-zinc-700 dark:text-zinc-400">Gói hiện tại</span>
                  {planLabel ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        {planLabel}
                      </span>
                      {planStatus === "active" && (
                        <span className="rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[11px] font-semibold dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30">
                          Đang hoạt động
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[12px] text-zinc-500">—</span>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-800 dark:text-emerald-300/80 mb-2">
                Nâng cấp
              </div>
              <Link
                href="/profile/select-plan"
                className="block w-full text-center text-sm font-semibold rounded-lg px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                Chọn gói
              </Link>
            </div>

            <Link
              href="/login"
              className="block w-full text-center text-sm font-medium rounded-lg px-4 py-2 bg-red-500 text-white hover:bg-red-400"
            >
              Đăng xuất
            </Link>
          </div>
        </aside>

        <header className={headerClass}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-600 shadow" />
              <span className="text-lg font-semibold">IMOS</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/profile/notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                aria-label="Thông báo"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white px-1">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>

              <ThemeToggle />

              <Link
                href="/profile/select-plan"
                className="rounded px-2 py-1 font-semibold bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
              >
                Chọn gói
              </Link>

              <button
                type="button"
                aria-label="Mở menu"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <span className="block h-0.5 w-4 bg-current" />
                <span className="sr-only">Menu</span>
              </button>
            </div>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-30">
            <button
              type="button"
              aria-label="Đóng menu"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-zinc-950/95 backdrop-blur border-r border-zinc-200 dark:border-white/10 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-700 dark:text-zinc-400">Điều hướng</span>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                <SidebarLink href="/" label="Trang chủ" />
                <SidebarLink href="/profile" label="Thông tin cá nhân" />
                <SidebarLink href="/profile/recents" label="Gần đây" />
                <SidebarLink href="/profile/drafts" label="Bản nháp" />
                <SidebarLink href="/profile/invite" label="Mời thành viên" />
                <SidebarLink href="/profile/notifications" label="Thông báo" />
                <SidebarLink href="/profile/settings" label="Cài đặt" />
                <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-white/10" />
                <SidebarLink href="/register/organization" label="Tạo tổ chức" />
                <SidebarLink href="/profile/help" label="Trợ giúp" />
              </div>
            </div>
          </div>
        )}

        <section className="flex-1 overflow-auto px-4 sm:px-8 lg:px-10 py-8 lg:ml-64">
          {children}
        </section>
      </div>
    </main>
  );
}
