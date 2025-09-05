"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPlans,
  type Plan,
  processPayment,
  type ProcessPaymentRes,
  type ProcessPaymentReq,
  getJson,
} from "@/lib/api";

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

function formatUSD(n?: number | null): string {
  const v = typeof n === "number" ? n : 0;
  return `$${v.toFixed(2)}`;
}

export default function SelectPlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Plan | null>(null);
  const [submittingByPlan, setSubmittingByPlan] = useState<Record<number, boolean>>({});

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ps = await getPlans();
        if (!alive) return;
        setPlans(ps);

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
              ? "Bạn có giao dịch đang chờ thanh toán. Hãy bấm “Tiếp tục thanh toán”."
              : null
          );
        } catch {
          const free = ps.find((p) => (p.priceMonthly ?? 0) <= 0) ?? null;
          setCurrentPlan(free ?? null);
          setStatus(free ? "active" : null);
        }
      } catch (e) {
        if (!alive) return;
        setError(safeMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentId = currentPlan?.planId ?? null;
  const paidPlans = useMemo<Plan[]>(() => plans.filter((p) => (p.priceMonthly ?? 0) > 0), [plans]);

  const setPlanSubmitting = (planId: number, v: boolean) =>
    setSubmittingByPlan((prev) => ({ ...prev, [planId]: v }));

  const isPlanSubmitting = (planId: number) => Boolean(submittingByPlan[planId]);

  const pay = async (plan: Plan) => {
    const price = plan.priceMonthly ?? 0;
    if (price <= 0) return;
    if (isPlanSubmitting(plan.planId)) return;

    setPlanSubmitting(plan.planId, true);
    setError(null);

    try {
      const FE_ORIGIN = window.location.origin;

      const reqBody: ProcessPaymentReq = {
        paymentGateway: "PayPal",
        purpose: "membership",
        total: price,
        currency: "USD",
        returnUrl: `${FE_ORIGIN}/payment/paypal-return`,
        successUrl: `${FE_ORIGIN}/payment/return`,
        cancelUrl: `${FE_ORIGIN}/profile/select-plan?status=cancelled`,
        context: {
          PlanId: plan.planId,
        },
      };

      // Lưu planId để confirm sau
      sessionStorage.setItem("pendingPlanId", String(plan.planId));

      const res: ProcessPaymentRes = await processPayment(reqBody);

      if (!res.approvalUrl) {
        throw new Error("Thiếu URL thanh toán từ PayPal.");
      }

      setHint("Đang chuyển đến PayPal…");
      window.location.href = res.approvalUrl;
    } catch (e) {
      setError(safeMessage(e));
    } finally {
      setPlanSubmitting(plan.planId, false);
    }
  };

  const renderStatusBadge = (p: Plan) => {
    const isCurrent = currentId === p.planId && status === "active";
    const isPending = currentId === p.planId && status === "pending";
    const isExpired = currentId === p.planId && status === "expired";

    if (isCurrent)
      return (
        <span className="inline-flex items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          Đang dùng
        </span>
      );
    if (isPending)
      return (
        <span className="inline-flex items-center rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300">
          Đang chờ thanh toán
        </span>
      );
    if (isExpired)
      return (
        <span className="inline-flex items-center rounded-xl border border-zinc-400/30 bg-zinc-600/10 px-3 py-1.5 text-xs font-semibold text-zinc-300">
          Hết hạn
        </span>
      );
    return null;
  };

  return (
    <main className="relative mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="text-2xl font-semibold">Chọn gói</h1>
      <p className="mt-1 text-zinc-400">Các gói đơn giản, mở rộng theo nhu cầu. Không phí ẩn.</p>

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
        <div className="mt-6 text-sm text-zinc-400">Đang tải gói…</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isFree = (p.priceMonthly ?? 0) <= 0;
            const isSelected = selected?.planId === p.planId;
            const isSubmitting = isPlanSubmitting(p.planId);
            const isCurrentActive = currentId === p.planId && status === "active";
            const isCurrentPending = currentId === p.planId && status === "pending";

            return (
              <div
                key={p.planId}
                className={[
                  "relative rounded-2xl border p-6 bg-zinc-900/50 backdrop-blur-sm shadow-lg",
                  "transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                  isSelected ? "border-emerald-400/60 ring-1 ring-emerald-400/40" : "border-white/10",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-semibold">{p.planName}</div>
                  {renderStatusBadge(p)}
                </div>

                <p className="mt-1 text-sm text-zinc-400">{p.description}</p>

                <div className="mt-5">
                  <span className="text-2xl font-bold text-emerald-400">
                    {isFree ? "$0.00" : formatUSD(p.priceMonthly)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-400">/tháng</span>
                </div>

                <div className="mt-5 flex gap-3">
                  {isCurrentActive ? (
                    <span className="inline-flex items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                      Đang dùng
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelected(p)}
                        disabled={isSubmitting}
                        className={[
                          "flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition",
                          isSelected
                            ? "border-emerald-400/70 text-emerald-300"
                            : "border-white/10 text-zinc-300 hover:text-white",
                          isSubmitting ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {isSelected ? "Đã chọn" : "Chọn gói"}
                      </button>

                      {!isFree && (
                        <button
                          onClick={() => pay(p)}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-zinc-950"
                        >
                          {isSubmitting
                            ? "Đang chuyển tới PayPal…"
                            : isCurrentPending && currentId === p.planId
                            ? "Tiếp tục thanh toán"
                            : "Đăng ký"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paidPlans.length > 0 && (
        <p className="mt-6 text-xs text-zinc-500">
          * Chỉ các gói trả phí mới yêu cầu thanh toán. Gói Free không cần đăng ký.
        </p>
      )}
    </main>
  );
}
