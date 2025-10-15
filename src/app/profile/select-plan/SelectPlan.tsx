
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type PaymentGateway,
  getPlans,
  type Plan,
  subscribeToPlan,
  type SubscribeRequest,
  type SubscribeResponse,
  confirmPayment,
  type PaymentConfirmationRequest,
  cancelPayment,
  type CancelPaymentRequest,
  getJson,
  getMyOrganizations,
  type MyOrganizationDto,
  getMyInvitations,
  type InvitationDto,
  getMyMembership,
  type CurrentMembershipDto,
} from "@/lib/api";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import PaymentMethodPopup from "./PaymentMethodPopup";

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

function safeMessage(err: unknown, fallback = "Yêu cầu thất bại"): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

function formatUSD(n?: number | null): string {
  const v = typeof n === "number" ? n : 0;
  return `$${v.toFixed(2)}`;
}

export default function SelectPlanPage() {
  const { isLoggedIn } = useAuthStatus();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Plan | null>(null);
  const [submittingByPlan, setSubmittingByPlan] = useState<Record<number, boolean>>({});

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  
  const [popup, setPopup] = useState<{ type: "success" | "cancel"; msg: string } | null>(null);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

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
        const [ps, orgsRes, invitesRes] = await Promise.all([
          getPlans(),
          getMyOrganizations().catch(() => ({ organizations: [] })),
          getMyInvitations().catch(() => ({ invitations: [] }))
        ]);
        
        if (!alive) return;
        
        setPlans(ps);
        setOrganizations(orgsRes.organizations || []);
        setInvitations(invitesRes.invitations || []);

        // Auto-select first organization if user has one
        if (orgsRes.organizations && orgsRes.organizations.length > 0) {
          setSelectedOrg(orgsRes.organizations[0]);
          // Load memberships for all organizations
          loadOrgMemberships(orgsRes.organizations);
        }

        try {
          const me = await getJson<MyMembership>("/membership/me");
          if (!alive) return;

          const found = ps.find((p) => p.planId === me.planId) ?? null;

          if (found) {
            setCurrentPlan(found);
            setStatus(me.status ?? "active");
          } else {
            const free = ps.find((p) => (p.priceMonthly ?? 0) <= 0) ?? null;
            setCurrentPlan(free ?? null);
            setStatus(free ? "active" : null);
          }

          setHint(
            me.status === "pending"
              ? "Bạn có giao dịch đang chờ thanh toán. Hãy bấm \"Tiếp tục thanh toán\"."
              : null
          );
        } catch {
          const free = ps.find((p) => (p.priceMonthly ?? 0) <= 0) ?? null;
          setCurrentPlan(free ?? null);
          setStatus(free ? "active" : null);
        }
      } catch (e) {
        if (!alive) return;
        setError(safeMessage(e, "Không tải được danh sách gói."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const transactionId = searchParams?.get("transactionId") ?? null;
    const code = searchParams?.get("code") ?? null;
    const cancel = searchParams?.get("cancel") ?? null;
    const status = searchParams?.get("status") ?? null;
    const orderCode = searchParams?.get("orderCode") ?? null;
    const paymentId = searchParams?.get("id") ?? null;

    if (!transactionId) return;

    let finalStatus: "success" | "cancel" | null = null;

    console.log({ transactionId, code, cancel, status, orderCode, paymentId });

    if (code === "00" && cancel === "false" && status?.toUpperCase() === "PAID") {
      finalStatus = "success";
    } else if (cancel === "true" || status?.toUpperCase() === "CANCELLED") {
      finalStatus = "cancel";
    }

    console.log({ finalStatus });

    if (finalStatus === "success") {
      const req: PaymentConfirmationRequest = {
        paymentGateway: "payOS",
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
        purpose: "membership",
        transactionId,
        status: "success",
      };

      confirmPayment(req)
        .then(() => setPopup({ type: "success", msg: "Thanh toán thành công!" }))
        .catch((res) => { setPopup({ type: "cancel", msg: "Thanh toán thất bại." }); console.log(res); });
    }

    if (finalStatus === "cancel") {
      const req: CancelPaymentRequest = {
        paymentGateway: "payOS",
        transactionId,
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
      };

      cancelPayment(req)
        .then(() => setPopup({ type: "cancel", msg: "Bạn đã hủy thanh toán." }))
        .catch(() => setPopup({ type: "cancel", msg: "Có lỗi khi hủy giao dịch." }));
    }
  }, [searchParams]);

  const handleSelectPlan = async (plan: Plan) => {
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
    
    setSelectedPlan(plan);
    setShowPaymentPopup(true);
  };

  const handlePaymentClick = () => {
    if (!selected) return;
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
    if (isPlanDisabled(selected)) {
      return; // Don't allow payment for disabled plans
    }
    
    const isFree = (selected.priceMonthly ?? 0) <= 0;
    if (isFree) {
      alert("Bạn đã chọn gói miễn phí!");
      return;
    }
    
    setSelectedPlan(selected);
    setShowPaymentPopup(true);
  };

  const handleSelectPaymentMethod = async (method: PaymentGateway) => {
    if (!selectedPlan || !selectedOrg) return;
    
    try {
      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21", // test - should get from auth context
        orgId: selectedOrg.orgId,
        planId: selectedPlan.planId,
        paymentMethod: method,
        autoRenew: true,
      };

      const res: SubscribeResponse = await subscribeToPlan(req);
      localStorage.setItem("planId", String(selectedPlan.planId));
      window.location.href = res.paymentUrl;
    } catch (err) {
      alert(safeMessage(err));
    }
  };

  const currentId = currentPlan?.planId ?? null;
  const paidPlans = useMemo<Plan[]>(
    () => plans.filter((p) => (p.priceMonthly ?? 0) > 0),
    [plans]
  );

  const setPlanSubmitting = (planId: number, v: boolean) =>
    setSubmittingByPlan((prev) => ({ ...prev, [planId]: v }));

  const isPlanSubmitting = (planId: number) => Boolean(submittingByPlan[planId]);

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

  // Get the reason why a plan is disabled
  const getPlanDisabledReason = (plan: Plan): string | null => {
    if (!selectedOrg) return null;
    
    const currentPlan = getCurrentPlanForOrg(selectedOrg.orgId);
    const membershipStatus = getMembershipStatusForOrg(selectedOrg.orgId);
    
    if (!currentPlan || !membershipStatus) return null;
    
    if (membershipStatus === "active") {
      const currentPlanPrice = currentPlan.priceMonthly || 0;
      const planPrice = plan.priceMonthly || 0;
      
      if (planPrice === currentPlanPrice) {
        return "Current plan";
      } else if (planPrice < currentPlanPrice) {
        return "Lower tier plan";
      }
    }
    
    return null;
  };

  // Refresh memberships when organization selection changes
  useEffect(() => {
    if (selectedOrg && organizations.length > 0) {
      loadOrgMemberships(organizations);
    }
  }, [selectedOrg]);

  /** Badge hiển thị trạng thái của 1 plan so với membership hiện tại */
  const renderStatusBadge = (p: Plan) => {
    if (!selectedOrg) return null;
    
    const currentPlan = getCurrentPlanForOrg(selectedOrg.orgId);
    const membershipStatus = getMembershipStatusForOrg(selectedOrg.orgId);
    
    const isCurrent = currentPlan?.planId === p.planId && membershipStatus === "active";
    const isPending = currentPlan?.planId === p.planId && membershipStatus === "pending";
    const isExpired = currentPlan?.planId === p.planId && membershipStatus === "expired";

    if (isCurrent)
      return (
        <span className="inline-flex items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          In use
        </span>
      );
    if (isPending)
      return (
        <span className="inline-flex items-center rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300">
          Pending payment
        </span>
      );
    if (isExpired)
      return (
        <span className="inline-flex items-center rounded-xl border border-zinc-400/30 bg-zinc-600/10 px-3 py-1.5 text-xs font-semibold text-zinc-300">
          Expired
        </span>
      );
    return null;
  };

  return (
    <main className="relative text-zinc-100">
      <h1 className="text-2xl font-semibold">Plans</h1>
      <p className="mt-1 text-zinc-400">
        Simple plans, scalable as needed. No hidden fees.
      </p>

      {/* Organization Memberships Summary */}
      {organizations.length > 1 && !loadingMemberships && (
        <div className="mt-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">All Organization Memberships</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {organizations.map((org) => {
              const membership = orgMemberships[org.orgId];
              const currentPlan = getCurrentPlanForOrg(org.orgId);
              const membershipStatus = getMembershipStatusForOrg(org.orgId);
              
              return (
                <div key={org.orgId} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{org.orgName}</p>
                    {membership && currentPlan ? (
                      <p className="text-xs text-zinc-400">{currentPlan.planName}</p>
                    ) : (
                      <p className="text-xs text-zinc-500">No membership</p>
                    )}
                  </div>
                  <div>
                    {membership && membershipStatus ? (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        membershipStatus === "active" 
                          ? "bg-emerald-500/20 text-emerald-300" 
                          : membershipStatus === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}>
                        {membershipStatus === "active" ? "Active" : 
                         membershipStatus === "pending" ? "Pending" : 
                         membershipStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">No plan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Organization Selection */}
      {organizations.length > 0 && (
        <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
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
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              membershipStatus === "active" 
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

      {organizations.length === 0 && (
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <h3 className="text-amber-200 font-medium mb-2">No Organization Found</h3>
          <p className="text-sm text-amber-300 mb-3">
            You need to be part of an organization to purchase a membership plan.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/organizations/create")}
              className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors"
            >
              Create Organization
            </button>
            <button
              onClick={() => router.push("/organizations")}
              className="px-3 py-1 text-xs border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              Join Organization
            </button>
          </div>
        </div>
      )}

      {hint && (
        <div className="mt-3 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {hint}
        </div>
      )}

      {error && (
        <div className="mt-3 mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-sm text-zinc-400">Fetching plans…</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const isFree = (p.priceMonthly ?? 0) <= 0;
              const isSelected = selected?.planId === p.planId;
              const isSubmitting = isPlanSubmitting(p.planId);
              const isDisabled = isPlanDisabled(p);
              const disabledReason = getPlanDisabledReason(p);
              
              // Use selected organization's membership status
              const currentPlan = selectedOrg ? getCurrentPlanForOrg(selectedOrg.orgId) : null;
              const membershipStatus = selectedOrg ? getMembershipStatusForOrg(selectedOrg.orgId) : null;
              const isCurrentActive = currentPlan?.planId === p.planId && membershipStatus === "active";
              const isCurrentPending = currentPlan?.planId === p.planId && membershipStatus === "pending";

              return (
                <div
                  key={p.planId}
                  className={[
                    "relative rounded-2xl border p-6 bg-zinc-900/50 backdrop-blur-sm shadow-lg",
                    isDisabled 
                      ? "opacity-60 cursor-not-allowed" 
                      : "transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                    isSelected ? "border-emerald-400/60 ring-1 ring-emerald-400/40" : "border-white/10",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-lg font-semibold">{p.planName}</div>
                      {isDisabled && disabledReason && (
                        <div className="text-xs text-zinc-500 mt-1">
                          {disabledReason === "Current plan" 
                            ? "Currently active" 
                            : "Downgrade not allowed"}
                        </div>
                      )}
                    </div>
                    {renderStatusBadge(p)}
                  </div>

                  <p className="mt-1 text-sm text-zinc-400">{p.description}</p>

                  <div className="mt-5">
                    <span className="text-2xl font-bold text-emerald-400">
                      {isFree ? "$0.00" : formatUSD(p.priceMonthly)}
                    </span>
                    <span className="ml-1 text-sm text-zinc-400">/month</span>
                  </div>

                  <div className="mt-5">
                    {isCurrentActive ? (
                      <span className="inline-flex items-center justify-center w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                        In use
                      </span>
                    ) : isDisabled ? (
                      <div className="w-full">
                        <button
                          disabled={true}
                          className="w-full rounded-xl border border-zinc-600 bg-zinc-700 text-zinc-500 px-4 py-2 text-sm font-medium cursor-not-allowed"
                        >
                          {disabledReason || "Not available"}
                        </button>
                        {disabledReason && (
                          <p className="text-xs text-zinc-500 mt-1 text-center">
                            {disabledReason === "Current plan" 
                              ? "You are already using this plan" 
                              : "Upgrade to a higher tier plan"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelected(p)}
                        disabled={isSubmitting}
                        className={[
                          "w-full rounded-xl border px-4 py-2 text-sm font-medium transition",
                          isSelected
                            ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 text-zinc-300 hover:text-white hover:border-zinc-600",
                          isSubmitting ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    )}
                  </div>

                  {isCurrentPending && currentPlan?.planId === p.planId && (
                    <div className="mt-3 text-center">
                      <span className="text-xs text-yellow-400">
                        You have one pending payment
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Single Payment Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handlePaymentClick}
              disabled={!selected || !isLoggedIn || !selectedOrg || (selected && isPlanDisabled(selected)) || (selectedOrg && getCurrentPlanForOrg(selectedOrg.orgId)?.planId === selected?.planId && getMembershipStatusForOrg(selectedOrg.orgId) === "active")}
              className={[
                "px-4 py-2 rounded-xl font-semibold text-md transition-all min-w-[200px]",
                selected && isLoggedIn && selectedOrg && !isPlanDisabled(selected) && !(getCurrentPlanForOrg(selectedOrg.orgId)?.planId === selected?.planId && getMembershipStatusForOrg(selectedOrg.orgId) === "active")
                  ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              ].join(" ")}
            >
              {!isLoggedIn 
                ? "Login to select plan"
                : !selectedOrg
                  ? "Select organization first"
                : !selected
                  ? "Select a plan to continue"
                : selected && isPlanDisabled(selected)
                  ? "Plan not available"
                  : selectedOrg && getCurrentPlanForOrg(selectedOrg.orgId)?.planId === selected?.planId && getMembershipStatusForOrg(selectedOrg.orgId) === "active"
                    ? "You are using this plan"
                    : selectedOrg && getCurrentPlanForOrg(selectedOrg.orgId)?.planId === selected?.planId && getMembershipStatusForOrg(selectedOrg.orgId) === "pending"
                      ? "Continue pending payment"
                      : (selected.priceMonthly ?? 0) <= 0
                        ? "Choose Free Plan"
                        : "Proceed to Payment"
              }
            </button>
          </div>

          {selected && (
            <div className="mt-4 text-center">
              <p className="text-sm text-zinc-400">
                Selected: <span className="text-emerald-400 font-medium">{selected.planName}</span>
                {(selected.priceMonthly ?? 0) > 0 && (
                  <span> - {formatUSD(selected.priceMonthly)}/month</span>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {paidPlans.length > 0 && (
        <p className="mt-6 text-xs text-zinc-500 text-center">
          * Payment is required only for paid plans. The Free plan comes with no registration needed.
        </p>
      )}

      <PaymentMethodPopup
        isOpen={showPaymentPopup}
        onClose={() => setShowPaymentPopup(false)}
        onSelectMethod={handleSelectPaymentMethod}
        planName={selectedPlan?.planName}
        planPrice={selectedPlan?.priceMonthly}
      />

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
                        <p className="text-sm text-zinc-400">Role: {org.myRole}</p>
                        {membership && currentPlan ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              membershipStatus === "active" 
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
                onClick={() => {
                  setShowOrgSelection(false);
                  if (selectedPlan) {
                    setShowPaymentPopup(true);
                  }
                }}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 text-white rounded-xl p-6 max-w-sm">
            <h2 className="text-3xl font-semibold mb-4">
              {popup.type === "success" ? "Payment success" : "Payment failed"}
            </h2>
            <p>{popup.msg}</p>
            <button
              onClick={() => {
                setPopup(null);
                router.replace("/profile/select-plan");
                localStorage.removeItem("planId");
              }}
              className="mt-4 px-4 py-2 rounded bg-emerald-500 text-black"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
