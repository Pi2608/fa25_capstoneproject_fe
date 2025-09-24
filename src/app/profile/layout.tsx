"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  getPlans,
  type Plan,
  getJson,
  getMyOrganizations,
  type MyOrganizationDto,
} from "@/lib/api";
import { useAuthStatus } from "@/contexts/useAuthStatus";

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

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
  const pathname = usePathname(); 
  const { isLoggedIn } = useAuthStatus();

  const isFullScreenMap = /\/profile\/organizations\/[^/]+\/maps\/new\/?$/.test(
    pathname || ""
  );

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<MyOrganizationDto[] | null>(null);
  const [orgsErr, setOrgsErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadPlanBadge() {
      if (!isLoggedIn) {
        setPlanLabel(null);
        setPlanStatus(null);
        return;
      }

      try {
        const ps = await getPlans();
        if (!alive) return;
        setPlans(ps);

        try {
          const me = await getJson<MyMembership>("/membership/me");
          if (!alive) return;
          const found = ps.find((p) => p.planId === me.planId);
          if (found) {
            setPlanLabel(found.planName);
            setPlanStatus(me.status ?? "active");
            return;
          }
        } catch {}

        const free = ps.find((p) => p.priceMonthly === 0);
        setPlanLabel(free?.planName ?? "Free");
        setPlanStatus("active");
      } catch {
        setPlanLabel("Free");
        setPlanStatus("active");
      }
    }

    async function loadOrgs() {
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
      } catch {
        if (!alive) return;
        setOrgsErr("Failed to load organizations.");
        setOrgs([]);
      }
    }

    loadPlanBadge();
    loadOrgs();

    const onAuthChanged = () => {
      loadPlanBadge();
      loadOrgs();
    };
    const onOrgsChanged = () => {
      loadOrgs();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth-changed", onAuthChanged);
      window.addEventListener("orgs-changed", onOrgsChanged as EventListener);
    }
    return () => {
      alive = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-changed", onAuthChanged);
        window.removeEventListener("orgs-changed", onOrgsChanged as EventListener);
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

  return (
    <main className="min-h-screen text-zinc-100 bg-gradient-to-b from-[#0b0f0e] via-emerald-900/10 to-[#0b0f0e]">
      <div className="flex min-h-screen">
        <aside className="w-72 hidden md:flex md:flex-col justify-between border-r border-white/10 p-6 bg-gradient-to-b from-zinc-950/70 via-emerald-900/5 to-zinc-950/70 backdrop-blur">
          <div>
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300/70 mb-2">
                General
              </div>
              <div className="space-y-1">
                <SidebarLink href="/" label="Home" />
                <SidebarLink href="/profile" label="Personal Information" />
                <SidebarLink href="/profile/recents" label="Recents" />
                <SidebarLink href="/profile/drafts" label="Drafts" />
                <SidebarLink href="/profile/invite" label="Invite Members" />
                <SidebarLink href="/profile/settings" label="Settings" />
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-widest text-emerald-300/70 mb-2">
                Projects
              </div>
              <div className="space-y-1">
                <SidebarLink
                  href="/profile/create-project"
                  label="Create Organization"
                />

                {orgs === null && (
                  <>
                    <div className="h-8 rounded-md bg-white/5 animate-pulse" />
                    <div className="h-8 rounded-md bg-white/5 animate-pulse" />
                  </>
                )}

                {orgsErr && (
                  <div className="px-3 py-2 text-xs rounded-md border border-red-400/40 bg-red-500/10 text-red-200">
                    {orgsErr}
                  </div>
                )}

                {orgs && !orgsErr && orgs.length === 0 && (
                  <div className="px-3 py-2 text-xs rounded-md border border-white/10 bg-white/5 text-zinc-300">
                    No organizations yet. Create your first one!
                  </div>
                )}

                {(orgs ?? []).slice(0, 5).map((o) => (
                  <SidebarLink
                    key={o.orgId}
                    href={`/profile/organizations/${o.orgId}`}
                    label={o.orgName}
                  />
                ))}
                {(orgs ?? []).length > 5 && (
                  <SidebarLink href="/organizations" label="View all organizations" />
                )}

                <SidebarLink href="/profile/help" label="Help" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            {isLoggedIn && (
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-zinc-400">Current Plan</span>
                  {planLabel ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-300">
                        {planLabel}
                      </span>
                      {planStatus === "active" && (
                        <span className="rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 text-[11px] font-semibold">
                          Active
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
              <div className="text-[11px] uppercase tracking-widest text-emerald-300/80 mb-2">
                Upgrade
              </div>
              <Link
                href="/profile/select-plan"
                className="block w-full text-center text-sm font-semibold rounded-lg px-4 py-2 bg-gradient-to-r from-emerald-400 to-emerald-500 text-zinc-950 shadow-lg shadow-emerald-900/30 ring-1 ring-emerald-300/40 hover:from-emerald-300 hover:to-emerald-400 transition"
              >
                Choose Plan
              </Link>
            </div>

            <Link
              href="/login"
              className="block w-full text-center text-sm font-medium rounded-lg px-4 py-2 bg-red-500/90 hover:bg-red-400 ring-1 ring-transparent hover:ring-red-300/40 transition"
            >
              Log out
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
            <div className="flex items-center gap-2 text-xs">
              {isLoggedIn && planLabel && (
                <span className="hidden xs:flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                  <span className="text-[11px] text-zinc-400">Plan:</span>
                  <span className="text-[12px] font-semibold text-emerald-300">
                    {planLabel}
                  </span>
                  {planStatus === "active" && (
                    <span className="ml-1 rounded bg-emerald-500/15 border border-emerald-400/30 px-1 text-[10px] text-emerald-300">
                      Active
                    </span>
                  )}
                </span>
              )}
              <Link
                href="/profile/select-plan"
                className="rounded px-2 py-1 font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              >
                Choose Plan
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
