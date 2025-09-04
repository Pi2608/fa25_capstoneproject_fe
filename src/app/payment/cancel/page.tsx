"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  cancelPaymentWithContext,
  type CancelPaymentWithContextReq,
} from "@/lib/api";

function pretty(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string")
    return (e as any).message as string;
  if (e instanceof Error) return e.message;
  return "Hủy thanh toán thất bại.";
}

export default function PaymentCancelPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Đang hủy giao dịch…");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // PayPal: ?paymentId=...&token=...&intent=...&transactionId=...
        // PayOS : ?orderCode=...&signature=...&status=CANCELLED&transactionId=...
        const paymentId  = sp.get("paymentId") ?? undefined;
        const token      = sp.get("token") ?? undefined;
        const intent     = sp.get("intent") ?? undefined;

        const orderCode  = sp.get("orderCode") ?? undefined;
        const signature  = sp.get("signature") ?? undefined;
        const status     = sp.get("status") ?? undefined;

        const transactionId = sp.get("transactionId") ?? undefined;

        const paymentGateway = orderCode ? "PayOS" : "PayPal";

        const payload: CancelPaymentWithContextReq = {
          paymentGateway,
          paymentId,
          token,
          intent,
          orderCode,
          signature,
          transactionId,
        };

        await cancelPaymentWithContext(payload);

        if (!alive) return;
        setMsg("Bạn đã hủy thanh toán. Không có khoản phí nào được trừ.");
        setTimeout(() => {
          if (!alive) return;
          router.replace("/plans"); // quay lại trang chọn gói
        }, 1500);
      } catch (e) {
        if (!alive) return;
        setMsg(pretty(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, sp]);

  return (
    <main className="max-w-xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-xl font-semibold">Hủy thanh toán</h1>
      <p className="mt-3 text-zinc-300">{msg}</p>
    </main>
  );
}
