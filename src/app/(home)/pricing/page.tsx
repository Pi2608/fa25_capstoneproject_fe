"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { CurrentMembershipDto, getMyMembership, getMyMembershipStatus, getPlans, Plan, SubscribeRequest, SubscribeResponse, subscribeToPlan } from "@/lib/api-membership";
import { getMyInvitations, getMyOrganizations, InvitationDto, MyOrganizationDto } from "@/lib/api-organizations";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

const fmtCurrency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});


export default function PricingPage() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

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

      // Check if user has an organization
      if (organizations.length === 0) {
        setShowOrgSelection(true);
        return;
      }

      // Check if plan is disabled
      if (isPlanDisabled(plan)) {
        return; // Don't allow selection of disabled plans
      }

      if (!selectedOrg) {
        setShowOrgSelection(true);
        return;
      }

      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21", // test - should get from auth context
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
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target as Element); } });
    }, { threshold: 0.18 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

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

  const NAV = [
    { label: "Service", href: "/service" },
    { label: "Tutorials", href: "/tutorial" },
    { label: "Templates", href: "/templates" },
    { label: "Pricing", href: "/pricing" },
    { label: "Community", href: "/community" },
  ] as const;

  const DICH_VU: { label: string; desc: string; href: string }[] = [
    { label: "Trình tạo bản đồ", desc: "Tạo bản đồ web tương tác nhanh, không cần cài đặt.", href: "/service/map-builder" },
    { label: "Lớp dữ liệu", desc: "Quản lý lớp vector & raster, style linh hoạt.", href: "/service/data-layers" },
    { label: "Nguồn đám mây", desc: "Kết nối PostGIS, GeoServer, S3, Google Drive…", href: "/service/cloud-sources" },
    { label: "Bảng điều khiển", desc: "Ghép bản đồ với biểu đồ & số liệu thành dashboard.", href: "/service/dashboards" },
    { label: "Cộng tác", desc: "Chia sẻ & chỉnh sửa nhóm theo thời gian thực.", href: "/service/collaboration" },
    { label: "Xuất & Nhúng", desc: "Xuất PNG/PDF, nhúng vào website hoặc ứng dụng.", href: "/service/export-embed" },
  ];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Organization state
  const [organizations, setOrganizations] = useState<MyOrganizationDto[]>([]);
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<MyOrganizationDto | null>(null);
  const [showOrgSelection, setShowOrgSelection] = useState(false);

  // Membership state by organization
  const [orgMemberships, setOrgMemberships] = useState<Record<string, CurrentMembershipDto | null>>({});
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  // Load memberships for all organizations
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
            console.log(`No membership found for org ${org.orgId}:`, error);
            memberships[org.orgId] = null;
          }
        })
      );

      setOrgMemberships(memberships);
    } catch (error) {
      console.error("Error loading memberships:", error);
    } finally {
      setLoadingMemberships(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Load plans and organizations in parallel
        const [data, orgsRes, invitesRes] = await Promise.all([
          getPlans(),
          isLoggedIn ? getMyOrganizations().catch(() => ({ organizations: [] })) : Promise.resolve({ organizations: [] }),
          isLoggedIn ? getMyInvitations().catch(() => ({ invitations: [] })) : Promise.resolve({ invitations: [] })
        ]);

        if (!alive) return;
        setPlans(data);
        setOrganizations(orgsRes.organizations || []);
        setInvitations(invitesRes.invitations || []);

        // Auto-select first organization if user has one
        if (orgsRes.organizations && orgsRes.organizations.length > 0) {
          setSelectedOrg(orgsRes.organizations[0]);
          // Load memberships for all organizations
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
    return () => { alive = false; };
  }, [isLoggedIn]);

  const popularIds = useMemo(() => {
    const s = new Set<number>();
    plans.forEach((p) => { if (/pro/i.test(p.planName)) s.add(p.planId); });
    return s;
  }, [plans]);

  const currentId = currentPlan?.planId ?? null;

  // Get current plan for a specific organization
  const getCurrentPlanForOrg = (orgId: string): Plan | null => {
    const membership = orgMemberships[orgId];
    if (!membership) return null;

    return plans.find(p => p.planId === membership.planId) || null;
  };

  // Get membership status for a specific organization
  const getMembershipStatusForOrg = (orgId: string): string | null => {
    const membership = orgMemberships[orgId];
    return membership?.status || null;
  };

  // Check if a plan should be disabled for the selected organization
  const isPlanDisabled = (plan: Plan): boolean => {
    if (!selectedOrg) return false;

    const currentPlan = getCurrentPlanForOrg(selectedOrg.orgId);
    const membershipStatus = getMembershipStatusForOrg(selectedOrg.orgId);

    // If no current membership, all plans are available
    if (!currentPlan || !membershipStatus) return false;

    // If current plan is active, disable current plan and lower-tier plans
    if (membershipStatus === "active") {
      const currentPlanPrice = currentPlan.priceMonthly || 0;
      const planPrice = plan.priceMonthly || 0;

      // Disable if it's the same plan or a lower-tier plan
      return planPrice <= currentPlanPrice;
    }

    // If membership is pending or expired, allow all plans
    return false;
  };

  const renderStatusBadge = (p: Plan) => {
    if (!selectedOrg) return null;

    const currentPlan = getCurrentPlanForOrg(selectedOrg.orgId);
    const membershipStatus = getMembershipStatusForOrg(selectedOrg.orgId);

    const isCurrent = currentPlan?.planId === p.planId && membershipStatus === "active";
    const isPending = currentPlan?.planId === p.planId && membershipStatus === "pending";
    const isExpired = currentPlan?.planId === p.planId && membershipStatus === "expired";

    if (isCurrent)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Đang dùng
        </span>
      );
    if (isPending)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-yellow-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Đang chờ thanh toán
        </span>
      );
    if (isExpired)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-zinc-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Hết hạn
        </span>
      );
    return null;
  };

  return (
    <main className="relative min-h-screen text-white">
      {/* <div className="absolute inset-0 -z-10">
        <Image
          src="/bg.avif"
          alt="Nền bản đồ"
          fill
          priority
          unoptimized
          quality={100}
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div> */}

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14" data-reveal>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bảng giá</h1>
        <p className="mt-2 text-zinc-200">
          Các gói đơn giản, mở rộng theo nhu cầu. Không phí ẩn.
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
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Selected Organization</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-zinc-100 font-medium">{selectedOrg?.orgName}</p>
                {selectedOrg && (
                  <div className="mt-1">
                    {loadingMemberships ? (
                      <p className="text-xs text-zinc-500">Loading membership...</p>
                    ) : (
                      (() => {
                        const membership = orgMemberships[selectedOrg.orgId];
                        const currentPlan = getCurrentPlanForOrg(selectedOrg.orgId);
                        const membershipStatus = getMembershipStatusForOrg(selectedOrg.orgId);

                        if (membership && currentPlan) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${membershipStatus === "active"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : membershipStatus === "pending"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-zinc-500/20 text-zinc-400"
                                }`}>
                                {membershipStatus === "active" ? "Active" :
                                  membershipStatus === "pending" ? "Pending" :
                                    membershipStatus || "No Plan"}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {currentPlan.planName} - ${currentPlan.priceMonthly}/month
                              </span>
                            </div>
                          );
                        } else {
                          return (
                            <span className="text-xs text-zinc-500">No membership plan</span>
                          );
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
                  Change
                </button>
              )}
            </div>
          </div>
        )}

        {isLoggedIn && organizations.length === 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <h3 className="text-amber-200 font-medium mb-2">No Organization Found</h3>
            <p className="text-sm text-amber-300 mb-3">
              You need to be part of an organization to purchase a membership plan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/register/organization")}
                className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors"
              >
                Create Organization
              </button>
              <button
                onClick={() => router.push("/profile/organizations")}
                className="px-3 py-1 text-xs border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
              >
                Join Organization
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
            const isDisabled = isPlanDisabled(plan);

            // Use selected organization's membership status
            const currentPlan = selectedOrg ? getCurrentPlanForOrg(selectedOrg.orgId) : null;
            const membershipStatus = selectedOrg ? getMembershipStatusForOrg(selectedOrg.orgId) : null;
            const isCurrentActive = currentPlan?.planId === plan.planId && membershipStatus === "active";
            const isCurrentPending = currentPlan?.planId === plan.planId && membershipStatus === "pending";

            return (
              <div
                key={plan.planId}
                className={[
                  "relative rounded-2xl border p-6",
                  "bg-zinc-900/60 backdrop-blur-sm border-white/10",
                  isDisabled
                    ? "opacity-60 cursor-not-allowed"
                    : "shadow-lg transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                  isPopular ? "ring-1 ring-emerald-400/30" : "",
                ].join(" ")}
              >
                {isPopular && !isCurrentActive && (
                  <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
                    Phổ biến
                  </span>
                )}

                {renderStatusBadge(plan)}

                <div className="flex h-full flex-col">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.planName}</h3>
                    {plan.description && (
                      <p className="mt-1 text-sm text-zinc-300">{plan.description}</p>
                    )}
                  </div>

                  <div className="mt-5">
                    <span className="text-3xl font-bold text-emerald-400">
                      {isFree ? "$0.00" : fmtCurrency.format(plan.priceMonthly)}
                    </span>
                    <span className="ml-1 text-sm text-zinc-300">/tháng</span>
                  </div>

                  <div className="mt-auto">
                    {isCurrentActive ? (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
                        Đang dùng
                      </span>
                    ) : isDisabled ? (
                      <div className="w-full">
                        <button
                          disabled={true}
                          className="w-full rounded-xl border border-zinc-600 bg-zinc-700 text-zinc-500 px-4 py-2.5 text-sm font-medium cursor-not-allowed"
                        >
                          Không khả dụng
                        </button>
                        <p className="text-xs text-zinc-500 mt-1 text-center">
                          Bạn đang sử dụng gói này hoặc gói cao hơn
                        </p>
                      </div>
                    ) : (
                      <button
                        className="w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500/90 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 transition"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {isCurrentPending && currentPlan?.planId === plan.planId
                          ? "Tiếp tục thanh toán"
                          : "Chọn gói"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.some((p) => (p.priceMonthly ?? 0) > 0) && (
          <p className="mt-6 text-xs text-zinc-500">
            * Chỉ các gói trả phí mới yêu cầu thanh toán. Gói Free không cần đăng ký.
          </p>
        )}
      </section>

      {/* Organization Selection Popup */}
      {showOrgSelection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Select Organization</h2>
            <div className="space-y-3 mb-6">
              {organizations.map((org) => {
                const membership = orgMemberships[org.orgId];
                const currentPlan = getCurrentPlanForOrg(org.orgId);
                const membershipStatus = getMembershipStatusForOrg(org.orgId);

                return (
                  <div
                    key={org.orgId}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedOrg?.orgId === org.orgId
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-zinc-700 hover:border-zinc-600"
                      }`}
                    onClick={() => setSelectedOrg(org)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{org.orgName}</p>
                        <p className="text-sm text-zinc-400">Role: {org.myRole}</p>
                        {membership && currentPlan ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${membershipStatus === "active"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : membershipStatus === "pending"
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-zinc-500/20 text-zinc-400"
                              }`}>
                              {membershipStatus === "active" ? "Active" :
                                membershipStatus === "pending" ? "Pending" :
                                  membershipStatus || "No Plan"}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {currentPlan.planName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 mt-1">No membership plan</span>
                        )}
                      </div>
                      {selectedOrg?.orgId === org.orgId && (
                        <div className="w-4 h-4 rounded-full bg-emerald-400"></div>
                      )}
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
                Cancel
              </button>
              <button
                onClick={() => setShowOrgSelection(false)}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        [data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
        [data-reveal].in{opacity:1;transform:none}
      `}</style>
    </main>
  );
}
