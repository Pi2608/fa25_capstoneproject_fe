"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getMyOrganizations, type GetMyOrganizationsResDto } from "@/lib/api-organizations";

type Tab = { href: string; i18nKey: string; ownerOnly?: boolean; label?: string };

const ALL_TABS: Tab[] = [
  { href: "/profile/settings/members",     i18nKey: "tabs_members" },
  { href: "/profile/settings/my-exports",  i18nKey: "tabs_my_exports" },
  { href: "/profile/settings/usage",       i18nKey: "tabs_usage", ownerOnly: true },
  { href: "/profile/settings/plans",       i18nKey: "tabs_plans" },
  { href: "/profile/settings/billing",     i18nKey: "tabs_billing" },
  { href: "/profile/settings/workspace",   i18nKey: "tabs_workspace" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname() || "";
  const router = useRouter();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const [orgs, setOrgs] = useState<GetMyOrganizationsResDto["organizations"]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Get selected organization ID from URL or localStorage
  const getSelectedOrgId = () => {
    try {
      const url = new URL(window.location.href);
      const orgIdFromUrl = url.searchParams.get("orgId");
      if (orgIdFromUrl) return orgIdFromUrl;

      const saved = localStorage.getItem("cmosm:selectedOrgId");
      return saved || null;
    } catch {
      return null;
    }
  };

  // Update selectedOrgId when component mounts and listen for changes
  useEffect(() => {
    const updateSelectedOrg = () => {
      setSelectedOrgId(getSelectedOrgId());
    };

    updateSelectedOrg();

    // Listen for storage changes (when user changes organization in dropdown)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cmosm:selectedOrgId") {
        updateSelectedOrg();
      }
    };

    // Listen for custom events from organization selector changes
    const handleOrgChange = () => {
      updateSelectedOrg();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("organizationChanged", handleOrgChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("organizationChanged", handleOrgChange);
    };
  }, []);

  // Check if current user is owner of selected organization
  const isOwnerOfSelectedOrg = () => {
    if (!selectedOrgId) return false;
    const selectedOrg = orgs.find(org => org.orgId === selectedOrgId);
    return selectedOrg?.myRole === "Owner";
  };

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const response = await getMyOrganizations();
        setOrgs(response.organizations || []);
      } catch (error) {
        console.error("Failed to load organizations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const userIsOwner = isOwnerOfSelectedOrg();

  // Filter tabs based on permissions
  const TABS = ALL_TABS.filter(tab => !tab.ownerOnly || userIsOwner);

  // Re-calculate tabs when organization changes
  useEffect(() => {
    // This will trigger a re-render when selectedOrgId changes
  }, [selectedOrgId, orgs]);

  // Redirect if user tries to access owner-only page without permission
  useEffect(() => {
    if (!loading && pathname.includes("/usage") && !userIsOwner && selectedOrgId) {
      router.push("/profile/settings/members");
    }
  }, [pathname, userIsOwner, loading, selectedOrgId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
        </div>
      </div>
    );
  }

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
                {tab.label || (tab.i18nKey ? t(`settings.${tab.i18nKey}`) : "")}
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
