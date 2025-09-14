
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getPlans,
  type Plan,
  processPayment,
  type ProcessPaymentRes,
  type ProcessPaymentReq,
  confirmPaymentWithContext, type ConfirmPaymentWithContextReq,
  cancelPaymentWithContext, type CancelPaymentWithContextReq,
  getJson,
} from "@/lib/api";
import { useAuthStatus } from "@/contexts/useAuthStatus";

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
      const req: ConfirmPaymentWithContextReq = {
        paymentGateway: "payOS",
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
        purpose: "membership",
        transactionId,
        userId: "08ddedf7-64e8-40ca-8fff-4d303167014d", // test
        orgId: "550e8400-e29b-41d4-a716-446655440000", // test
        planId: Number(localStorage.getItem("planId")) || 0,
        autoRenew: true,
      };

      confirmPaymentWithContext(req)
        .then(() => setPopup({ type: "success", msg: "Thanh toán thành công!" }))
        .catch((res) => { setPopup({ type: "cancel", msg: "Thanh toán thất bại." }); console.log(res); });
    }

    if (finalStatus === "cancel") {
      const req: CancelPaymentWithContextReq = {
        paymentGateway: "payOS",
        transactionId,
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
      };

      cancelPaymentWithContext(req)
        .then(() => setPopup({ type: "cancel", msg: "Bạn đã hủy thanh toán." }))
        .catch(() => setPopup({ type: "cancel", msg: "Có lỗi khi hủy giao dịch." }));
    }
  }, [searchParams]);

  const handleSelectPlan = async (plan: Plan) => {
    try {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }

      const req: ProcessPaymentReq = {
        paymentGateway: "payOS",
        purpose: "membership",
        // total: plan.priceMonthly,
        total: 0.1, // test
        PlanId: plan.planId,
        UserId: "08ddedf7-64e8-40ca-8fff-4d303167014d", // test
        AutoRenew: true,
      };

      const res: ProcessPaymentRes = await processPayment(req);

      localStorage.setItem("planId", String(plan.planId));

      window.location.href = res.approvalUrl;
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

  /** Gọi thanh toán cho 1 plan trả phí */
  // const pay = async (plan: Plan) => {
  //   const price = plan.priceMonthly ?? 0;
  //   if (price <= 0) return;
  //   if (isPlanSubmitting(plan.planId)) return;

  //   setPlanSubmitting(plan.planId, true);
  //   setError(null);

  //   try {
  //     const FE_ORIGIN = window.location.origin;

  //     const reqBody: ProcessPaymentReq = {
  //       paymentGateway: "PayPal",
  //       purpose: "membership",
  //       total: price,
  //       currency: "USD",
  //       // tuỳ BE: các url này sẽ được PayPal redirect về
  //       returnUrl: `${FE_ORIGIN}/payment/paypal-return`,
  //       successUrl: `${FE_ORIGIN}/payment/return`,
  //       cancelUrl: `${FE_ORIGIN}/profile/select-plan?status=cancelled`,
  //       context: {
  //         PlanId: plan.planId,
  //       },
  //     };

  //     // Lưu planId để trang return có thể confirm membership
  //     sessionStorage.setItem("pendingPlanId", String(plan.planId));

  //     const res: ProcessPaymentRes = await processPayment(reqBody);

  //     // Chuẩn tên field approve url (BE của bạn đang dùng approveUrl)
  //     const approveUrl =
  //       (res as { approveUrl?: string }).approveUrl ??
  //       // fallback nếu BE đổi tên về sau:
  //       (res as { approvalUrl?: string }).approvalUrl ??
  //       "";

  //     if (!approveUrl) {
  //       throw new Error("Thiếu URL thanh toán từ PayPal.");
  //     }

  //     setHint("Đang chuyển đến PayPal…");
  //     window.location.href = approveUrl;
  //   } catch (e) {
  //     setError(safeMessage(e, "Không khởi tạo được thanh toán."));
  //   } finally {
  //     setPlanSubmitting(plan.planId, false);
  //   }
  // };

  /** Badge hiển thị trạng thái của 1 plan so với membership hiện tại */
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
    <main className="relative text-zinc-100">
      <h1 className="text-2xl font-semibold">Chọn gói</h1>
      <p className="mt-1 text-zinc-400">
        Các gói đơn giản, mở rộng theo nhu cầu. Không phí ẩn.
      </p>

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
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                          onClick={() => handleSelectPlan(p)}
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-zinc-950"
                        >
                          {isSubmitting
                            ? "Đang chuyển tới PayOS"
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

      {popup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 text-white rounded-xl p-6 max-w-sm">
            <h2 className="text-3xl font-semibold mb-4">
              {popup.type === "success" ? "Thành công" : "Thanh toán thất bại"}
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
              Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
