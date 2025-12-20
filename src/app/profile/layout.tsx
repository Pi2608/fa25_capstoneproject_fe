"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJson } from "@/lib/api-core";
import { getPlans, type Plan, getMyMembership } from "@/lib/api-membership";
import { getMyOrganizations, type MyOrganizationDto, getMyInvitations } from "@/lib/api-organizations";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bell,
  Home,
  User,
  Clock,
  FileText,
  UserPlus,
  Settings,
  HelpCircle,
  Building2,
  PlusCircle,
  LogOut,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import { getThemeClasses } from "@/utils/theme-utils";

export type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  right,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  right?: ReactNode;
}) {
  const activeCls = active
    ? "relative bg-emerald-500/10 text-emerald-900 ring-1 ring-emerald-500/35 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded before:bg-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-50"
    : "hover:bg-muted/60 dark:hover:bg-white/10";

  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <Button
        variant="ghost"
        className={`w-full justify-between px-2.5 lg:px-3 py-2 h-8 lg:h-9 transition-colors ${activeCls}`}
      >
        <span className="flex items-center gap-1.5 lg:gap-2 truncate">
          <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4 opacity-90" />
          <span className="truncate text-xs lg:text-sm">{label}</span>
        </span>
        {right}
      </Button>
    </Link>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = current === "dark";
  const themeClasses = getThemeClasses(isDark);

  if (!mounted) {
    // Return static placeholder to prevent hydration mismatch
    return (
      <div className="inline-flex h-8 w-[100px] items-center justify-center rounded-md border shadow-sm bg-white dark:bg-zinc-800" />
    );
  }

  const base =
    "inline-flex items-center gap-1.5 lg:gap-2 h-7 lg:h-8 px-2 lg:px-3 rounded-md text-[10px] lg:text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("profilelayout.theme_toggle_aria")}
      title={isDark ? t("profilelayout.switch_to_light") : t("profilelayout.switch_to_dark")}
      className={`${base} ${themeClasses.button}`}
    >
      {isDark ? <Moon className="h-3 w-3 lg:h-4 lg:w-4" /> : <Sun className="h-3 w-3 lg:h-4 lg:w-4" />}
      <span className="hidden sm:inline">{isDark ? t("profilelayout.theme_dark") : t("profilelayout.theme_light")}</span>
    </button>
  );
}

function ProfileLayoutContent({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname() || "";
  const router = useRouter();
  const { isLoggedIn } = useAuthStatus();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const { unreadCount: unread } = useNotifications();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mainClass = !mounted
    ? "min-h-screen text-zinc-900 bg-gradient-to-b from-emerald-100 via-white to-emerald-50"
    : isDark
      ? "min-h-screen text-zinc-100 bg-gradient-to-b from-[#0b0f0e] via-emerald-900/10 to-[#0b0f0e]"
      : "min-h-screen text-zinc-900 bg-gradient-to-b from-emerald-100 via-white to-emerald-50";

  const isFullScreenMap = useMemo(() => /\/profile\/organizations\/[^/]+\/maps\/new\/?$/.test(pathname), [pathname]);

  const plansRef = useRef<Plan[] | null>(null);

  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<MyOrganizationDto[] | null>(null);
  const [orgsErr, setOrgsErr] = useState<string | null>(null);
  const [invitationCount, setInvitationCount] = useState<number>(0);
  const [orgPlanLabels, setOrgPlanLabels] = useState<Record<string, string>>({});

  type MeResponse = {
    user?: {
      accountStatus?: string;
    };
  };

  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const isSuspended = accountStatus === "Suspended";

  useEffect(() => {
    let alive = true;

    const loadPlans = async () => {
      if (!isLoggedIn) {
        plansRef.current = null;
        setPlanLabel(null);
        setPlanStatus(null);
        return null;
      }
      try {
        const ps = await getPlans();
        if (!alive) return null;
        plansRef.current = ps ?? null;
        return ps ?? null;
      } catch {
        plansRef.current = null;
        setPlanLabel(t("profilelayout.plan_free"));
        setPlanStatus("active");
        return null;
      }
    };

    const loadMe = async () => {
      if (!isLoggedIn) {
        setAccountStatus(null);
        return;
      }
      try {
        const me = await getJson<MeResponse>("/user/me");
        if (!alive) return;
        setAccountStatus(me?.user?.accountStatus ?? null);
      } catch {
        if (!alive) return;
        setAccountStatus(null);
      }
    };

    const loadInvitations = async () => {
      if (!isLoggedIn) {
        setInvitationCount(0);
        return;
      }
      try {
        const res = await getMyInvitations();
        if (!alive) return;
        const pending = (res.invitations ?? []).filter(
          (i) => !i.isAccepted && !(i as { isRejected?: boolean }).isRejected
        );
        setInvitationCount(pending.length);
      } catch {
        if (!alive) return;
        setInvitationCount(0);
      }
    };

    const loadOrgs = async (plansData?: Plan[] | null) => {
      if (!isLoggedIn) {
        setOrgs(null);
        setOrgsErr(null);
        setOrgPlanLabels({});
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

        // Load plan labels for all organizations
        const planLabelsMap: Record<string, string> = {};
        for (const org of items) {
          try {
            const membership = (await getMyMembership(org.orgId)) as MyMembership;
            if (!alive) return;
            if (membership && plansData) {
              const found = plansData.find(
                (p) => (p as unknown as { planId: number }).planId === membership.planId
              );
              if (found) {
                const name =
                  (found as unknown as { planName?: string; name?: string }).planName ?? (found as any).name;
                planLabelsMap[org.orgId] = name ?? "";
              } else {
                planLabelsMap[org.orgId] = "";
              }
            } else {
              planLabelsMap[org.orgId] = "";
            }
          } catch {
            planLabelsMap[org.orgId] = "";
          }
        }

        if (!alive) return;
        setOrgPlanLabels(planLabelsMap);

        // Set the first organization's plan as the current plan
        if (items.length > 0 && planLabelsMap[items[0].orgId]) {
          setPlanLabel(planLabelsMap[items[0].orgId]);
          setPlanStatus("active");
        }
      } catch {
        if (!alive) return;
        setOrgsErr(t("profilelayout.orgs_load_error"));
        setOrgs([]);
        setOrgPlanLabels({});
      }
    };

    loadMe();
    loadPlans().then((ps) => loadOrgs(ps));
    loadInvitations();

    const onAuthChanged = () => {
      loadMe();
      loadPlans().then((ps) => loadOrgs(ps));
      loadInvitations();
    };
    const onOrgsChanged = () => loadOrgs(plansRef.current);
    const onInvitationsChanged = () => loadInvitations();

    if (typeof window !== "undefined") {
      window.addEventListener("auth-changed", onAuthChanged);
      window.addEventListener("orgs-changed", onOrgsChanged as EventListener);
      window.addEventListener("invitations-changed", onInvitationsChanged);
    }

    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-changed", onAuthChanged);
        window.removeEventListener("orgs-changed", onOrgsChanged as EventListener);
        window.removeEventListener("invitations-changed", onInvitationsChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // Remove 't' from dependencies to prevent re-renders when translation function reference changes

  // If account is suspended, force user to stay on Help only
  useEffect(() => {
    if (isSuspended && pathname !== "/profile/help") {
      router.replace("/profile/help");
    }
  }, [isSuspended, pathname, router]);

  const commonNav = [
    // { href: "/", label: t("profilelayout.nav_home"), icon: Home },
    { href: "/profile/information", label: t("profilelayout.nav_information"), icon: User },
    { href: "/profile/recents", label: t("profilelayout.nav_recents"), icon: Clock },
    { href: "/profile/drafts", label: t("profilelayout.nav_drafts"), icon: FileText },
    { href: "/profile/invite", label: t("profilelayout.nav_invite"), icon: UserPlus },
    { href: "/profile/notifications", label: t("profilelayout.nav_notifications"), icon: Bell },
    { href: "/profile/settings", label: t("profilelayout.nav_settings"), icon: Settings },
  ];

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

  return (
    <main suppressHydrationWarning key={mounted ? currentTheme : "initial"} className={mainClass}>
      <div className="flex min-h-screen">
        <aside className="hidden md:flex md:flex-col w-64 lg:w-72 fixed left-0 top-0 h-screen z-20 border-r bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex-1 min-h-0 overflow-hidden p-3 lg:p-4 flex flex-col gap-3 lg:gap-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-md bg-emerald-500 shadow" />
                <span className="text-base lg:text-lg font-semibold">IMOS</span>
              </Link>

              <ThemeToggle />
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-1 space-y-1">
                {isSuspended ? (
                  <NavItem
                    href="/profile/help"
                    label={t("profilelayout.help")}
                    icon={HelpCircle}
                    active={pathname === "/profile/help"}
                  />
                ) : (
                  commonNav.map((n) => (
                    <NavItem
                      key={n.href}
                      href={n.href}
                      label={n.label}
                      icon={n.icon}
                      active={pathname === n.href || pathname.startsWith(`${n.href}/`)}
                      right={
                        n.href === "/profile/notifications" && unread > 0 ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
                          >
                            {unread > 99 ? "99+" : unread}
                          </Badge>
                        ) : n.href === "/profile/invite" && invitationCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="text-[11px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
                          >
                            {invitationCount > 99 ? "99+" : invitationCount}
                          </Badge>
                        ) : undefined
                      }
                    />
                  ))
                )}
              </div>

              {!isSuspended && (
                <div className="px-1 mt-5">
                  <div
                    suppressHydrationWarning
                    className={`text-[11px] uppercase tracking-widest ${themeClasses.textMuted} mb-2`}
                  >
                    {t("profilelayout.orgs_title")}
                  </div>

                  <NavItem
                    href="/register/organization"
                    label={t("profilelayout.create_org")}
                    icon={PlusCircle}
                    active={pathname === "/register/organization"}
                  />

                  {orgs === null && (
                    <div className="space-y-2 py-2">
                      <div className="h-8 rounded-md bg-muted animate-pulse" />
                      <div className="h-8 rounded-md bg-muted animate-pulse" />
                    </div>
                  )}

                  {orgsErr && (
                    <div className="px-3 py-2 text-xs rounded-md border bg-destructive/10 text-destructive">
                      {orgsErr}
                    </div>
                  )}

                  {orgs && !orgsErr && orgs.length === 0 && (
                    <div className={`px-3 py-2 text-xs rounded-md border ${themeClasses.tableBorder} ${themeClasses.textMuted}`}>
                      {t("profilelayout.no_orgs")}
                    </div>
                  )}

                  {(orgs ?? []).slice(0, 5).map((o) => {
                    const planLabel = orgPlanLabels[o.orgId];
                    const isActive = pathname.startsWith(`/profile/organizations/${o.orgId}`);
                    return (
                      <NavItem
                        key={o.orgId}
                        href={`/profile/organizations/${o.orgId}`}
                        label={o.orgName}
                        icon={Building2}
                        active={isActive}
                        right={
                          <Badge variant="secondary" className="text-[11px] font-semibold">
                            <span
                              className={`text-sm font-semibold ${isDark ? "text-emerald-300" : isActive ? "text-emerald-500" : "text-emerald-600"
                                }`}
                            >
                              {planLabel}
                            </span>
                          </Badge>
                        }
                      />
                    );
                  })}

                  {(orgs ?? []).length > 5 && (
                    <NavItem
                      href="/organizations"
                      label={t("profilelayout.view_all_orgs")}
                      icon={Building2}
                      active={pathname === "/organizations"}
                    />
                  )}

                  <NavItem
                    href="/profile/help"
                    label={t("profilelayout.help")}
                    icon={HelpCircle}
                    active={pathname === "/profile/help"}
                  />

                  <div className="h-3" />
                </div>
              )}
            </ScrollArea>

            <Separator className="my-2" />

            <div className="space-y-3">
              {!isSuspended && (
                <Link href="/profile/settings/plans">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs lg:text-sm py-1.5 lg:py-2 h-8 lg:h-9">
                    {t("profilelayout.select_plan")}
                  </Button>
                </Link>
              )}

              <Link href="/login">
                <Button variant="destructive" className="w-full text-xs lg:text-sm py-1.5 lg:py-2 h-8 lg:h-9">
                  <LogOut className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  {t("profilelayout.logout")}
                </Button>
              </Link>
            </div>
          </div>
        </aside>

        <header className="md:hidden w-full fixed top-0 left-0 right-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-3 xs:px-4 py-3 xs:py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 xs:h-10 xs:w-10"
                    aria-label={t("profilelayout.open_menu")}
                  >
                    <Menu className="h-4.5 w-4.5 xs:h-5 xs:w-5" />
                  </Button>
                </SheetTrigger>

                <SheetContent side="left" className="w-72 p-0 [&>button]:hidden">
                  <div className="h-full flex flex-col">
                    <div className="p-4 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-md bg-emerald-500 shadow" />
                        <span className="text-lg font-semibold">IMOS</span>
                      </div>
                      <ThemeToggle />
                    </div>

                    <ScrollArea className="flex-1 min-h-0 p-3">
                      <div className="px-1 space-y-1">
                        {isSuspended ? (
                          <NavItem
                            href="/profile/help"
                            label={t("profilelayout.help")}
                            icon={HelpCircle}
                            active={pathname === "/profile/help"}
                          />
                        ) : (
                          commonNav.map((n) => (
                            <NavItem
                              key={n.href}
                              href={n.href}
                              label={n.label}
                              icon={n.icon}
                              active={pathname === n.href || pathname.startsWith(`${n.href}/`)}
                              right={
                                n.href === "/profile/notifications" && unread > 0 ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[11px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
                                  >
                                    {unread > 99 ? "99+" : unread}
                                  </Badge>
                                ) : n.href === "/profile/invite" && invitationCount > 0 ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[11px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
                                  >
                                    {invitationCount > 99 ? "99+" : invitationCount}
                                  </Badge>
                                ) : undefined
                              }
                            />
                          ))
                        )}
                      </div>

                      {!isSuspended && (
                        <div className="px-1 mt-5">
                          <div
                            suppressHydrationWarning
                            className={`text-[11px] uppercase tracking-widest ${themeClasses.textMuted} mb-2`}
                          >
                            {t("profilelayout.orgs_title")}
                          </div>

                          <NavItem
                            href="/register/organization"
                            label={t("profilelayout.create_org")}
                            icon={PlusCircle}
                            active={pathname === "/register/organization"}
                          />

                          {(orgs ?? []).slice(0, 5).map((o) => {
                            const planLabel = orgPlanLabels[o.orgId];
                            return (
                              <NavItem
                                key={o.orgId}
                                href={`/profile/organizations/${o.orgId}`}
                                label={o.orgName}
                                icon={Building2}
                                active={pathname.startsWith(`/profile/organizations/${o.orgId}`)}
                                right={
                                  planLabel ? (
                                    <Badge variant="secondary" className="text-[11px] font-semibold">
                                      {planLabel}
                                    </Badge>
                                  ) : undefined
                                }
                              />
                            );
                          })}

                          <NavItem
                            href="/profile/help"
                            label={t("profilelayout.help")}
                            icon={HelpCircle}
                            active={pathname === "/profile/help"}
                          />
                          <div className="h-3" />
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-md bg-emerald-500 shadow" />
                <span className="text-base xs:text-lg font-semibold">IMOS</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {!isSuspended && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/profile/notifications">
                          <Button
                            variant="outline"
                            size="icon"
                            className="relative h-9 w-9 xs:h-10 xs:w-10"
                            aria-label={t("profilelayout.nav_notifications")}
                          >
                            <Bell className="h-4.5 w-4.5 xs:h-5 xs:w-5" />
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white px-1">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{t("profilelayout.nav_notifications")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Link href="/profile/select-plan" className="hidden sm:inline-flex">
                    <Button className="font-semibold text-sm px-3 h-9">{t("profilelayout.select_plan")}</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 pt-16 xs:pt-18 sm:pt-20 md:pt-8 pb-3 xs:pb-4 sm:pb-6 md:pb-8 md:ml-64 lg:ml-72">
          {children}
        </section>
      </div>
    </main>
  );
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <ProfileLayoutContent>{children}</ProfileLayoutContent>
    </NotificationProvider>
  );
}
