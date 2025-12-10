"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import {
  CurrentMembershipDto,
  getMyMembership,
  getMyMembershipStatus,
  getPlans,
  Plan,
  SubscribeRequest,
  SubscribeResponse,
  subscribeToPlan,
  parsePlanFeatures,
} from "@/lib/api-membership";
import {
  getMyInvitations,
  getMyOrganizations,
  InvitationDto,
  MyOrganizationDto,
} from "@/lib/api-organizations";
import { useI18n } from "@/i18n/I18nProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGsapHomeScroll } from "@/components/common/useGsapHomeScroll";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

export default function PricingPage() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();

  const fmtCurrency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [locale]
  );

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  useGsapHomeScroll({
    reduce,
    fadeSelector: "[data-reveal]",
  });

  const handleSelectPlan = async (plan: Plan) => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(`/profile/select-plan?planId=${plan.planId}`);

    try {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }

      if (organizations.length === 0) {
        setShowOrgSelection(true);
        return;
      }

      if (isPlanDisabled(plan)) {
        return;
      }

      if (!selectedOrg) {
        setShowOrgSelection(true);
        return;
      }

      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21",
        orgId: selectedOrg.orgId,
        planId: plan.planId,
        paymentMethod: "payOS",
        autoRenew: true,
      };

      const res: SubscribeResponse = await subscribeToPlan(req);
      localStorage.setItem("planId", String(plan.planId));
      window.location.href = res.paymentUrl;
    } catch (err) {
      alert(safeMessage(err));
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<MyOrganizationDto[]>([]);
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<MyOrganizationDto | null>(null);
  const [showOrgSelection, setShowOrgSelection] = useState(false);

  const [orgMemberships, setOrgMemberships] = useState<Record<string, CurrentMembershipDto | null>>({});
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  const loadOrgMemberships = async (orgs: MyOrganizationDto[]) => {
    if (orgs.length === 0) return;
    setLoadingMemberships(true);
    const memberships: Record<string, CurrentMembershipDto | null> = {};

    try {
      await Promise.all(
        orgs.map(async (org) => {
          try {
            const membership = await getMyMembership(org.orgId);
            memberships[org.orgId] = membership;
          } catch (error) {
            memberships[org.orgId] = null;
          }
        })
      );
      setOrgMemberships(memberships);
    } finally {
      setLoadingMemberships(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, orgsRes, invitesRes] = await Promise.all([
          getPlans(),
          isLoggedIn ? getMyOrganizations().catch(() => ({ organizations: [] })) : Promise.resolve({ organizations: [] }),
          isLoggedIn ? getMyInvitations().catch(() => ({ invitations: [] })) : Promise.resolve({ invitations: [] }),
        ]);

        if (!alive) return;
        setPlans(data);
        setOrganizations(orgsRes.organizations || []);
        setInvitations(invitesRes.invitations || []);

        if (orgsRes.organizations && orgsRes.organizations.length > 0) {
          setSelectedOrg(orgsRes.organizations[0]);
          loadOrgMemberships(orgsRes.organizations);
        }

        if (isLoggedIn) {
          try {
            const me = await getMyMembershipStatus();
            if (!alive) return;
            const found = data.find((p) => p.planId === me.planId);
            if (found) {
              setCurrentPlan(found);
              setStatus(me.status ?? "active");
            } else {
              const free = data.find((p) => (p.priceMonthly ?? 0) <= 0) || null;
              setCurrentPlan(free);
              setStatus(free ? "active" : null);
            }
          } catch {
            const free = data.find((p) => (p.priceMonthly ?? 0) <= 0) || null;
            setCurrentPlan(free);
            setStatus(free ? "active" : null);
          }
        } else {
          setCurrentPlan(null);
          setStatus(null);
        }
      } catch (err: unknown) {
        if (!alive) return;
        setError(safeMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  const popularIds = useMemo(() => {
    const s = new Set<number>();
    plans.forEach((p) => {
      if (/pro/i.test(p.planName)) s.add(p.planId);
    });
    return s;
  }, [plans]);

  const currentId = currentPlan?.planId ?? null;

  const getCurrentPlanForOrg = (orgId: string): Plan | null => {
    const membership = orgMemberships[orgId];
    if (!membership) return null;
    return plans.find((p) => p.planId === membership.planId) || null;
  };

  const getMembershipStatusForOrg = (orgId: string): string | null => {
    const membership = orgMemberships[orgId];
    return membership?.status || null;
  };

  const isPlanDisabled = (plan: Plan): boolean => {
    if (!selectedOrg) return false;
    const cur = getCurrentPlanForOrg(selectedOrg.orgId);
    const memStatus = getMembershipStatusForOrg(selectedOrg.orgId);
    if (!cur || !memStatus) return false;
    if (memStatus === "active") {
      const curPrice = cur.priceMonthly || 0;
      const planPrice = plan.priceMonthly || 0;
      return planPrice <= curPrice;
    }
    return false;
  };

  const renderStatusBadge = (p: Plan) => {
    if (!selectedOrg) return null;
    const cur = getCurrentPlanForOrg(selectedOrg.orgId);
    const memStatus = getMembershipStatusForOrg(selectedOrg.orgId);

    const isCurrent = cur?.planId === p.planId && memStatus === "active";
    const isPending = cur?.planId === p.planId && memStatus === "pending";
    const isExpired = cur?.planId === p.planId && memStatus === "expired";

    if (isCurrent)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          {t("pricing", "badge_current")}
        </span>
      );
    if (isPending)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-yellow-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          {t("pricing", "badge_pending")}
        </span>
      );
    if (isExpired)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-zinc-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          {t("pricing", "badge_expired")}
        </span>
      );
    return null;
  };

  return (
    <main className="relative min-h-screen text-white">
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14" data-reveal>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t("pricing", "title")}
        </h1>
        <p className="mt-2 text-zinc-200">
          {t("pricing", "subtitle")}
        </p>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16" data-reveal>
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {isLoggedIn && organizations.length > 0 && (
          <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-300 mb-2">{t("pricing", "selected_org")}</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-zinc-100 font-medium">{selectedOrg?.orgName}</p>
                {selectedOrg && (
                  <div className="mt-1">
                    {loadingMemberships ? (
                      <p className="text-xs text-zinc-500">{t("pricing", "loading_membership")}</p>
                    ) : (
                      (() => {
                        const membership = orgMemberships[selectedOrg.orgId];
                        const curPlan = getCurrentPlanForOrg(selectedOrg.orgId);
                        const memStatus = getMembershipStatusForOrg(selectedOrg.orgId);

                        if (membership && curPlan) {
                          return (
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  memStatus === "active"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : memStatus === "pending"
                                    ? "bg-yellow-500/20 text-yellow-300"
                                    : "bg-zinc-500/20 text-zinc-400"
                                }`}
                              >
                                {memStatus === "active"
                                  ? t("pricing", "status_active")
                                  : memStatus === "pending"
                                  ? t("pricing", "status_pending")
                                  : memStatus || t("pricing", "status_none")}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {curPlan.planName} — {fmtCurrency.format(curPlan.priceMonthly ?? 0)}/{t("pricing", "per_month")}
                              </span>
                            </div>
                          );
                        } else {
                          return <span className="text-xs text-zinc-500">{t("pricing", "no_membership")}</span>;
                        }
                      })()
                    )}
                  </div>
                )}
              </div>
              {organizations.length > 1 && (
                <button
                  onClick={() => setShowOrgSelection(true)}
                  className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                >
                  {t("pricing", "change")}
                </button>
              )}
            </div>
          </div>
        )}

        {isLoggedIn && organizations.length === 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="text-amber-200 font-medium mb-2">{t("pricing", "no_org_title")}</h3>
            <p className="text-sm text-amber-300 mb-3">{t("pricing", "no_org_desc")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/register/organization")}
                className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors"
              >
                {t("pricing", "create_org")}
              </button>
              <button
                onClick={() => router.push("/profile/organizations")}
                className="px-3 py-1 text-xs border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
              >
                {t("pricing", "join_org")}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(loading ? Array.from({ length: 4 }) : plans).map((p, i) => {
            if (loading) {
              return (
                <div
                  key={`skeleton-${i}`}
                  className="relative rounded-2xl border p-6 bg-zinc-900/40 backdrop-blur-sm border-white/10 shadow-lg animate-pulse"
                >
                  <div className="h-5 w-28 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-40 rounded bg-white/5" />
                  <div className="mt-6 h-8 w-32 rounded bg-white/10" />
                  <div className="mt-6 h-10 w-full rounded-xl bg-white/5" />
                </div>
              );
            }

            const plan = p as Plan;
            const isPopular = popularIds.has(plan.planId);
            const isFree = (plan.priceMonthly ?? 0) === 0;
            const disabled = isPlanDisabled(plan);

            const curPlan = selectedOrg ? getCurrentPlanForOrg(selectedOrg.orgId) : null;
            const memStatus = selectedOrg ? getMembershipStatusForOrg(selectedOrg.orgId) : null;
            const isCurrentActive = curPlan?.planId === plan.planId && memStatus === "active";
            const isCurrentPending = curPlan?.planId === plan.planId && memStatus === "pending";

            const feats = parsePlanFeatures(plan);
            const features = feats.length
              ? feats
              : [
                  t("pricing", "feature_max_orgs") +
                    ": " +
                    ((plan.maxOrganizations ?? 0) < 0 ? t("pricing", "unlimited") : plan.maxOrganizations),
                  t("pricing", "feature_max_users") +
                    ": " +
                    ((plan.maxUsersPerOrg ?? 0) < 0 ? t("pricing", "unlimited") : plan.maxUsersPerOrg),
                  t("pricing", "feature_max_maps") +
                    ": " +
                    ((plan.maxMapsPerMonth ?? 0) < 0 ? t("pricing", "unlimited") : plan.maxMapsPerMonth),
                ];

            return (
              <div
                key={plan.planId}
                className={[
                  "relative rounded-2xl border p-6",
                  "bg-zinc-900/60 backdrop-blur-sm border-white/10",
                  disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "shadow-lg transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                  isPopular ? "ring-1 ring-emerald-400/30" : "",
                ].join(" ")}
              >
                {isPopular && !isCurrentActive && (
                  <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
                    {t("pricing", "popular")}
                  </span>
                )}

                {renderStatusBadge(plan)}

                <div className="flex h-full flex-col">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.planName}</h3>
                  </div>

                  <div className="mt-3">
                    <span className="text-3xl font-bold text-emerald-400">
                      {isFree ? fmtCurrency.format(0) : fmtCurrency.format(plan.priceMonthly ?? 0)}
                    </span>
                    <span className="ml-1 text-sm text-zinc-300">/{t("pricing", "per_month")}</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-zinc-300 flex-1">
                    {features.slice(0, 6).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrentActive ? (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
                        {t("pricing", "badge_current")}
                      </span>
                    ) : disabled ? (
                      <div className="w-full">
                        <button
                          disabled
                          className="w-full rounded-xl border border-zinc-600 bg-zinc-700 text-zinc-500 px-4 py-2.5 text-sm font-medium cursor-not-allowed"
                        >
                          {t("pricing", "unavailable")}
                        </button>
                        <p className="text-xs text-zinc-500 mt-1 text-center">
                          {t("pricing", "reason_unavailable")}
                        </p>
                      </div>
                    ) : (
                      <button
                        className="w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500/90 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 transition"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {isCurrentPending && curPlan?.planId === plan.planId
                          ? t("pricing", "continue_payment")
                          : t("pricing", "choose_plan")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.some((p) => (p.priceMonthly ?? 0) > 0) && (
          <p className="mt-6 text-xs text-zinc-500">{t("pricing", "footnote_paid")}</p>
        )}
      </section>

      {showOrgSelection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">{t("pricing", "selorg_title")}</h2>
            <div className="space-y-3 mb-6">
              {organizations.map((org) => {
                const membership = orgMemberships[org.orgId];
                const curPlan = getCurrentPlanForOrg(org.orgId);
                const memStatus = getMembershipStatusForOrg(org.orgId);

                return (
                  <div
                    key={org.orgId}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedOrg?.orgId === org.orgId
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-zinc-700 hover:border-zinc-600"
                    }`}
                    onClick={() => setSelectedOrg(org)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{org.orgName}</p>
                        <p className="text-sm text-zinc-400">
                          {t("pricing", "role")}: {org.myRole}
                        </p>
                        {membership && curPlan ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                memStatus === "active"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : memStatus === "pending"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-zinc-500/20 text-zinc-400"
                              }`}
                            >
                              {memStatus === "active"
                                ? t("pricing", "status_active")
                                : memStatus === "pending"
                                ? t("pricing", "status_pending")
                                : memStatus || t("pricing", "status_none")}
                            </span>
                            <span className="text-xs text-zinc-400">{curPlan.planName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 mt-1">
                            {t("pricing", "no_membership")}
                          </span>
                        )}
                      </div>
                      {selectedOrg?.orgId === org.orgId && <div className="w-4 h-4 rounded-full bg-emerald-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOrgSelection(false)}
                className="flex-1 px-4 py-2 border border-zinc-600 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                {t("common", "cancel")}
              </button>
              <button
                onClick={() => setShowOrgSelection(false)}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 rounded-lg transition-colors"
              >
                {t("common", "continue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
